import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { useLocation, Link } from 'react-router-dom';
import { Calendar, Settings as Search, LayoutDashboard, TrendingUp, LogOut, User as UserIcon, ChevronDown, Loader2, AlertCircle, Store } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import ViewToggle from '../components/ViewToggle';
import MarketplaceAccountFilter from '../components/MarketplaceAccountFilter';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import api from '../api';

const Dashboard = () => {
    const { user, logout, isImpersonating, impersonatedTenant } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [viewingTenantName, setViewingTenantName] = useState(null);
    const [activeTab, setActiveTab] = useState('calculations'); // Default to calculations as per user flow
    const [viewModes, setViewModes] = useState(() => {
        const stored = localStorage.getItem('analyticsViewModes');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                }
            } catch {}
        }
        return { actions: 'grid', calculations: 'grid', payments: 'list', ads: 'grid', returns: 'grid' };
    });

    const getViewMode = (tab) => viewModes[tab] || 'grid';

    const setViewModeForTab = (tab, mode) => {
        setViewModes(prev => {
            const next = { ...prev, [tab]: mode };
            localStorage.setItem('analyticsViewModes', JSON.stringify(next));
            return next;
        });
    };
    const location = useLocation();

    const {
        filterData,
        hasMarketplacesSelected,
        handleFilterChange,
    } = useDateRangeFilter();

    // Determine which tabs the user has permission to see
    const visibleTabs = useMemo(() => {
        const tabs = [];
        if (user?.permissions?.actionRequired !== false) tabs.push('actions');
        if (user?.permissions?.orderAnalysis !== false) tabs.push('calculations');
        if (user?.permissions?.paymentAnalysis !== false) tabs.push('payments');
        if (user?.permissions?.adsAnalysis !== false) tabs.push('ads');
        if (user?.permissions?.returnsAnalysis !== false) tabs.push('returns');
        return tabs;
    }, [user?.permissions]);

    // Save viewMode to localStorage whenever it changes
    // (Deprecated: viewModes is now used instead)

    useEffect(() => {
        // Check if navigated from cost sheet with specific tab
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }

        if (isImpersonating && impersonatedTenant?.name) {
            setViewingTenantName(impersonatedTenant.name);
            return;
        }

        setViewingTenantName(null);
    }, [location.state, user, isImpersonating, impersonatedTenant?.name]);

    // Redirect to first visible tab if current tab is not permitted
    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
            setActiveTab(visibleTabs[0]);
        }
    }, [visibleTabs, activeTab]);

    // Compute a flag so content knows whether to render the empty state
    const hasNoAccess = visibleTabs.length === 0;

    // Sync viewMode when activeTab changes (handles refresh edge case, deep links from cost sheet)
    useEffect(() => {
        const currentMode = getViewMode(activeTab);
        if ((activeTab === 'actions' || activeTab === 'calculations') && currentMode === 'list') {
            setViewModeForTab(activeTab, 'grid');
        }
        if (activeTab === 'payments' && currentMode === 'grid') {
            setViewModeForTab(activeTab, 'list');
        }
    }, [activeTab, viewModes]);

    // Force grid view when switching to unsupported tabs
    const handleTabChange = (tab) => {
        const currentMode = getViewMode(tab);
        if ((tab === 'actions' || tab === 'calculations') && currentMode === 'list') {
            setViewModeForTab(tab, 'grid');
        }
        if (tab === 'payments' && currentMode === 'grid') {
            setViewModeForTab(tab, 'list');
        }
        setActiveTab(tab);
    };

    // Import tabs dynamically or define above if simple
    // Note: Assuming imports are at the top, but for now we'll define components or import them

    return (
        <DashboardLayout>
            {/* Header */}
            <header className="bg-slate-50 backdrop-blur-md sticky top-0 z-[100] px-8 py-3 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-heading font-bold text-slate-800">
                        {viewingTenantName ? `Viewing: ${viewingTenantName}` : 'Dashboard'}
                    </h2>
                </div>

                <div className="flex items-center gap-5">
                    {/* User Profile Code ... */}
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                        >
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-brand-500/20 ring-2 ring-white overflow-hidden">
                                {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                ) : isImpersonating ? (
                                    impersonatedTenant?.adminName ? impersonatedTenant.adminName.charAt(0).toUpperCase() : (impersonatedTenant?.name?.charAt(0).toUpperCase() || 'A')
                                ) : (
                                    user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'
                                )}
                            </div>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Profile Dropdown */}
                        {isProfileOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-[110]"
                                    onClick={() => setIsProfileOpen(false)}
                                ></div>
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-[110]">
                                    <div className="px-4 py-3 border-b border-slate-50 mb-1">
                                        <p className="text-sm font-bold text-slate-800 truncate">
                                            {isImpersonating ? (impersonatedTenant?.adminName || impersonatedTenant?.name || 'Tenant Admin') : (user?.fullName || 'User')}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {isImpersonating ? (impersonatedTenant?.adminEmail || 'No Email') : (user?.email || 'No Email')}
                                        </p>
                                    </div>

                                    <Link
                                        to="/profile"
                                        className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-600 flex items-center gap-2 transition-colors"
                                        onClick={() => setIsProfileOpen(false)}
                                    >
                                        <UserIcon size={16} />
                                        Profile Settings
                                    </Link>

                                    <div className="h-px bg-slate-100 my-1"></div>

                                    {!isImpersonating && (
                                        <button
                                            onClick={logout}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                        >
                                            <LogOut size={16} />
                                            Sign Out
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full flex flex-col overflow-hidden bg-slate-50 relative">

                {hasNoAccess ? (
                    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-slate-100/80">
                        <div className="text-center">
                            <LayoutDashboard size={48} className="mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-500">No Dashboard Access</h3>
                            <p className="text-sm text-slate-400 mt-1">You don't have permission to view any dashboard tabs.</p>
                        </div>
                    </div>
                ) : (
                    <>
                {/* Tabs with View Toggle */}
                <div className="z-10 bg-slate-50/90 backdrop-blur-md pt-4 pb-4 px-4 md:px-8 border-b border-slate-200/40 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] shrink-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center p-1.5 bg-slate-100/80 rounded-2xl overflow-x-auto custom-scrollbar w-full md:w-auto">
                        {visibleTabs.includes('actions') && (
                            <button onClick={() => handleTabChange('actions')}
                                className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'actions'
                                    ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}>Action Required</button>
                        )}
                        {visibleTabs.includes('calculations') && (
                            <button onClick={() => handleTabChange('calculations')}
                                className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'calculations'
                                    ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}>Calculations Analysis</button>
                        )}
                        {visibleTabs.includes('payments') && (
                            <button onClick={() => handleTabChange('payments')}
                                className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'payments'
                                    ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}>Payments Analysis</button>
                        )}
                        {visibleTabs.includes('ads') && (
                            <button onClick={() => handleTabChange('ads')}
                                className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'ads'
                                    ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}>Ads Analysis</button>
                        )}
                        {visibleTabs.includes('returns') && (
                            <button onClick={() => setActiveTab('returns')}
                                className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'returns'
                                    ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}>Returns Analysis</button>
                        )}
                    </div>

                    {/* View Toggle - only shown for tabs that support both views */}
                    {activeTab === 'ads' && (
                    <div>
                        <ViewToggle
                            view={getViewMode(activeTab)}
                            onViewChange={(mode) => setViewModeForTab(activeTab, mode)}
                        />
                    </div>
                    )}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-gradient-to-br from-gray-50 to-slate-100/80">
                    {/* Conditionally render filters so they remount from localStorage on tab switch */}
                    {activeTab === 'actions' && visibleTabs.includes('actions') && (
                        <div className="mb-4">
                            <MarketplaceAccountFilter onChange={handleFilterChange} dateLabel="Filter by Date" />
                        </div>
                    )}
                    {activeTab === 'calculations' && visibleTabs.includes('calculations') && (
                        <div className="mb-4">
                            <MarketplaceAccountFilter
                                onChange={handleFilterChange}
                                dateLabel="Filter by Payment Date"
                                maxMonths={3}
                                defaultRangeType="lastMonth"
                                storagePrefix="calculations"
                            />
                        </div>
                    )}
                    {activeTab === 'ads' && getViewMode('ads') === 'grid' && visibleTabs.includes('ads') && (
                        <div className="mb-4">
                            <MarketplaceAccountFilter onChange={handleFilterChange} dateLabel="Filter by Date" />
                        </div>
                    )}

                    {/* Keep all tabs mounted but hide inactive ones so data isn't re-fetched on tab switch */}
                    <div className={activeTab === 'actions' && visibleTabs.includes('actions') ? '' : 'hidden'}>
                        <ActionRequiredTab
                            sharedFilterData={filterData}
                            sharedHasMarketplacesSelected={hasMarketplacesSelected}
                            sharedHandleFilterChange={handleFilterChange}
                        />
                    </div>
                    <div className={activeTab === 'calculations' && visibleTabs.includes('calculations') ? '' : 'hidden'}>
                        <CalculationsTab viewMode={getViewMode('calculations')} filterData={filterData} hasMarketplacesSelected={hasMarketplacesSelected} handleFilterChange={handleFilterChange} />
                    </div>
                    <div className={activeTab === 'payments' && visibleTabs.includes('payments') ? '' : 'hidden'}>
                        <PaymentsTab viewMode={getViewMode('payments')} />
                    </div>
                    <div className={activeTab === 'ads' && visibleTabs.includes('ads') ? '' : 'hidden'}>
                        <AdsTab viewMode={getViewMode('ads')} filterData={filterData} hasMarketplacesSelected={hasMarketplacesSelected} handleFilterChange={handleFilterChange} />
                    </div>
                    <div className={activeTab === 'returns' && visibleTabs.includes('returns') ? '' : 'hidden'}>
                        <ReturnsTab viewMode={getViewMode('returns')} />
                    </div>
                </div>
                </>)}

            </main>
        </DashboardLayout>
    );
};

// Sub-components
import CalculationsTab from '../components/dashboard/CalculationsTab';
import PaymentsTab from '../components/dashboard/PaymentsTab';
import AdsTab from '../components/dashboard/AdsTab';
import ReturnsTab from '../components/dashboard/ReturnsTab';
import ExportButton from '../components/ExportButton';

const ActionRequiredTab = ({ sharedFilterData, sharedHasMarketplacesSelected, sharedHandleFilterChange }) => {
    const { user, isImpersonating, impersonatedTenant } = useAuth();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState({
        highPriority: { count: 0, amount: 0 },
        mediumPriority: { count: 0, amount: 0 },
        lowPriority: { count: 0, amount: 0 },
        totalPending: 0
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 50
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    // Dynamic filter state
    const [paymentStatus, setPaymentStatus] = useState('pending'); // 'pending' | 'completed' | 'all'
    const [availableStatuses, setAvailableStatuses] = useState([]);  // [{value, count}]
    const [selectedOrderStatuses, setSelectedOrderStatuses] = useState([]); // string[]
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const defaultOrderStatus = React.useRef(null); // stores DELIVERED or first status value

    // Use the shared date range filter from Dashboard
    const filterData = sharedFilterData;
    const handleFilterChange = sharedHandleFilterChange;
    const hasMarketplacesSelected = sharedHasMarketplacesSelected;

    // Use impersonated tenant context when in view-as mode.
    const effectiveTenantId = useMemo(() => {
        if (isImpersonating && (impersonatedTenant?.id || impersonatedTenant?._id)) {
            return impersonatedTenant.id || impersonatedTenant._id;
        }
        return user?.tenantId || null;
    }, [isImpersonating, impersonatedTenant?.id, impersonatedTenant?._id, user?.tenantId]);

    // Debounce search term - wait 500ms after user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setPagination(prev => ({ ...prev, currentPage: 1 }));
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch available statuses when marketplace/date changes
    const prevMarketplaceIds = React.useRef(filterData.marketplaceIds);
    useEffect(() => {
        if (effectiveTenantId && hasMarketplacesSelected) {
            const isMarketplaceChange = prevMarketplaceIds.current !== filterData.marketplaceIds;
            prevMarketplaceIds.current = filterData.marketplaceIds;
            fetchAvailableStatuses(isMarketplaceChange);
        }
    }, [effectiveTenantId, filterData.marketplaceIds, filterData.startDate, filterData.endDate]);

    // Fetch data on any filter change
    useEffect(() => {
        if (effectiveTenantId && hasMarketplacesSelected) {
            fetchActionRequiredData();
            fetchStats();
        }
    }, [effectiveTenantId, pagination.currentPage, debouncedSearchTerm, filterData.marketplaceIds, filterData.startDate, filterData.endDate, paymentStatus, selectedOrderStatuses]);

    const buildCommonParams = () => {
        const params = { tenantId: effectiveTenantId, paymentStatus };
        if (filterData.startDate) params.startDate = filterData.startDate;
        if (filterData.endDate) params.endDate = filterData.endDate;
        if (filterData.marketplaceIds?.length > 0 && filterData.marketplaceIds !== 'ALL')
            params.marketplaceIds = JSON.stringify(filterData.marketplaceIds);
        if (selectedOrderStatuses.length > 0)
            params.orderItemStatuses = JSON.stringify(selectedOrderStatuses);
        return params;
    };

    // Track first load so the DELIVERED default only applies once per marketplace change
    const statusesInitialized = React.useRef(false);

    const fetchAvailableStatuses = async (isMarketplaceChange = false) => {
        try {
            const params = { tenantId: effectiveTenantId };
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
            if (filterData.marketplaceIds?.length > 0 && filterData.marketplaceIds !== 'ALL')
                params.marketplaceIds = JSON.stringify(filterData.marketplaceIds);
            const res = await api.get('/action-required/statuses', { params });
            const statuses = res.data.statuses || [];
            setAvailableStatuses(statuses);

            // Default: select DELIVERED + any SHIPPED/READY_TO_SHIP variant
            const defaultStatuses = statuses.filter(s => {
                const v = s.value.toUpperCase();
                return v.includes('DELIVERED') || v.includes('SHIP');
            });
            const defaultValues = defaultStatuses.length > 0
                ? defaultStatuses.map(s => s.value)
                : (statuses.length > 0 ? [statuses[0].value] : []);

            defaultOrderStatus.current = defaultValues; // store array for toggle reset
            
            if (!statusesInitialized.current || isMarketplaceChange) {
                setSelectedOrderStatuses(defaultValues);
                statusesInitialized.current = true;
                setPagination(prev => ({ ...prev, currentPage: 1 }));
            }

        } catch (err) {
            console.error('Error fetching available statuses:', err);
        }
    };


    const fetchActionRequiredData = async () => {
        if (!effectiveTenantId || !hasMarketplacesSelected) return;
        setLoading(true);
        try {
            const params = { ...buildCommonParams(), page: pagination.currentPage, limit: 50 };
            if (debouncedSearchTerm) params.search = debouncedSearchTerm;
            const response = await api.get('/action-required', { params });
            setItems(response.data.items || []);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Error fetching action required data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        if (!effectiveTenantId || !hasMarketplacesSelected) return;
        try {
            const response = await api.get('/action-required/stats', { params: buildCommonParams() });
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const toggleOrderStatus = (value) => {
        setSelectedOrderStatuses(prev => {
            if (prev.length === 0) {
                // "All" is currently active → deselect just this one, keep rest selected
                return availableStatuses.map(s => s.value).filter(v => v !== value);
            }
            const isSelected = prev.includes(value);
            if (isSelected) {
                const next = prev.filter(s => s !== value);
                // Last item deselected → fall back to All
                return next.length === 0 ? [] : next;
            }
            const next = [...prev, value];
            // All individual items now selected → treat as All
            return next.length === availableStatuses.length ? [] : next;
        });
        setPagination(prev => ({ ...prev, currentPage: 1 }));
    };

    const paymentStatusOptions = [
        { value: 'pending',   label: 'Pending',   active: 'bg-amber-100 text-amber-700' },
        { value: 'completed', label: 'Completed', active: 'bg-green-100 text-green-700' },
        { value: 'all',       label: 'All',       active: 'bg-slate-200 text-slate-700' },
    ];

    const getPaymentStatusBadge = (status) => {
        if (status === 'completed') return 'bg-green-100 text-green-700';
        if (status === 'pending')   return 'bg-amber-100 text-amber-700';
        return 'bg-slate-100 text-slate-600';
    };

    const selectedMarketplaceIds =
        filterData.marketplaceIds &&
            filterData.marketplaceIds !== 'ALL' &&
            hasMarketplacesSelected
            ? filterData.marketplaceIds
            : null;

    const statsData = [
        {
            label: 'High Priority',
            value: `${stats.highPriority.count}`,
            count: stats.highPriority.count,
            color: 'text-red-600',
            bg: 'bg-red-50',
            border: 'border-red-200',
            description: 'Settlement overdue (15+ days)',
            unit: 'orders'
        },
        {
            label: 'Medium Priority',
            value: `${stats.mediumPriority.count}`,
            count: stats.mediumPriority.count,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            description: 'Pending settlement (7-14 days)',
            unit: 'orders'
        },
        {
            label: 'Low Priority',
            value: `${stats.lowPriority.count}`,
            count: stats.lowPriority.count,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            description: 'Recently delivered (0-6 days)',
            unit: 'orders'
        },
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Dynamic Filters Row */}
            {hasMarketplacesSelected && (
                <div className="mb-6 flex flex-wrap items-center gap-3 relative z-[15]">
                    {/* Payment Status Toggle */}
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                        {paymentStatusOptions.map(opt => (
                            <button key={opt.value}
                                onClick={() => { setPaymentStatus(opt.value); setPagination(p => ({ ...p, currentPage: 1 })); }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                                    paymentStatus === opt.value ? opt.active + ' shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                            >{opt.label}</button>
                        ))}
                    </div>

                    {/* Order Status Multi-Select */}
                    {availableStatuses.length > 0 && (
                        <div className="relative">
                            <button onClick={() => setStatusDropdownOpen(o => !o)}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-all shadow-sm"
                            >
                                <span>{selectedOrderStatuses.length === 0 ? 'All Order Statuses' : `${selectedOrderStatuses.length} status${selectedOrderStatuses.length > 1 ? 'es' : ''} selected`}</span>
                                <ChevronDown size={13} className={`transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {statusDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setStatusDropdownOpen(false)} />
                                    <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                        {/* All Statuses row */}
                                        <label className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors ${selectedOrderStatuses.length === 0 ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedOrderStatuses.length === 0}
                                                onChange={() => {
                                                    if (selectedOrderStatuses.length === 0) {
                                                        // "All" is active → revert to default (DELIVERED + SHIPPED)
                                                        const def = defaultOrderStatus.current;
                                                        const defaults = Array.isArray(def) ? def : (def ? [def] : []);
                                                        setSelectedOrderStatuses(defaults);
                                                    } else {
                                                        // Individual items selected → reset to All
                                                        setSelectedOrderStatuses([]);
                                                    }
                                                    setPagination(prev => ({ ...prev, currentPage: 1 }));
                                                }}
                                                className="rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-bold text-slate-800">All Statuses</span>
                                        </label>

                                        {/* Individual statuses */}
                                        <div className="max-h-52 overflow-y-auto">
                                            {availableStatuses.map(s => (
                                                <label key={s.value} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedOrderStatuses.length === 0 || selectedOrderStatuses.includes(s.value)}
                                                        onChange={() => toggleOrderStatus(s.value)}
                                                        className="rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{s.value}</span>
                                                </label>
                                            ))}
                                        </div>

                                        {/* Done button */}
                                        <div className="p-3 border-t border-slate-100">
                                            <button
                                                onClick={() => setStatusDropdownOpen(false)}
                                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Active filter chips */}
                    {selectedOrderStatuses.map(s => (
                        <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 border border-brand-100 rounded-full text-xs font-semibold">
                            {s}
                            <button onClick={() => toggleOrderStatus(s)} className="hover:text-brand-900 font-bold ml-0.5">×</button>
                        </span>
                    ))}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
                {statsData.map((stat, index) => (
                    <div key={index} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col hover:shadow-card-hover transition-shadow duration-300 cursor-default group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${stat.color}`}>
                            <TrendingUp size={64} />
                        </div>
                        <h3 className={`text-sm font-semibold mb-2 tracking-wide uppercase ${stat.color}`}>{stat.label}</h3>
                        <p className="text-xs text-slate-500 mb-3">{stat.description}</p>
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-heading font-bold text-slate-800">{stat.count}</span>
                                <span className="text-sm text-slate-400 font-medium">orders</span>
                            </div>
                            <span className="text-lg font-semibold text-slate-600">{stat.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions Section */}
            <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                <div className="border-b border-slate-100 px-8 py-6 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <h3 className="font-heading font-bold text-lg text-slate-800">
                            {paymentStatus === 'all' ? 'All Orders' : paymentStatus === 'completed' ? 'Completed Payments' : 'Pending Payments'}
                        </h3>
                        <span className="bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-brand-100">
                            {pagination.totalItems}
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <ExportButton
                            exportType="pending_payments"
                            marketplaceId={selectedMarketplaceIds}
                            startDate={filterData.startDate || undefined}
                            endDate={filterData.endDate || undefined}
                            paymentStatus={paymentStatus}
                            orderItemStatuses={selectedOrderStatuses.length > 0 ? selectedOrderStatuses : undefined}
                            buttonText="Export"
                            buttonClassName="px-3 py-2 text-sm"
                        />

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search orders..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="min-h-[400px] flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-brand-600 mb-4" size={48} />
                        <p className="text-slate-500">Loading pending payments...</p>
                    </div>
                ) : (!hasMarketplacesSelected) ? (
                    <div className="min-h-[400px] flex flex-col items-center justify-center text-slate-400 animate-in fade-in duration-300">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                            <Store size={32} />
                        </div>
                        <p className="font-medium text-slate-500">Please select a marketplace</p>
                        <p className="text-sm text-slate-400 mt-1 max-w-sm text-center">
                            Select one or more marketplaces to view pending payments.
                        </p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="min-h-[400px] flex flex-col items-center justify-center text-slate-400">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                            <LayoutDashboard size={32} />
                        </div>
                        <p className="font-medium text-slate-500">No pending payments</p>
                        <p className="text-sm text-slate-400 mt-1 max-w-sm text-center">
                            All delivered orders have completed payments. Great job on collections!
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Order ID</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Order Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">SKU</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Order Item Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                                {item.order_id}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {new Date(item.order_date).toLocaleDateString('en-IN', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    timeZone: 'UTC' // order_date is a naive wall-clock; render its stored digits, not the browser's local shift
                                                })}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                <div className="max-w-xs">
                                                    <div className="font-medium text-slate-800">{item.sku}</div>
                                                    {item.product_title && (
                                                        <div className="text-xs text-slate-500 truncate">
                                                            {item.product_title}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                    {item.order_item_status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${getPaymentStatusBadge(item.payment_status)}`}>
                                                    <AlertCircle size={12} />
                                                    {item.payment_status?.charAt(0).toUpperCase() + item.payment_status?.slice(1)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                                <p className="text-sm text-slate-600">
                                    Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
                                    {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
                                    {pagination.totalItems} results
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })}
                                        disabled={pagination.currentPage === 1}
                                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })}
                                        disabled={pagination.currentPage === pagination.totalPages}
                                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
export default Dashboard;

