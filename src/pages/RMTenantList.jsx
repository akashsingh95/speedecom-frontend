import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, Search, Users, CreditCard, Clock, TrendingUp, Loader2, Eye, ChevronRight,
    LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, AlertTriangle, Mail, User,
    LayoutDashboard, ArrowUpRight, Info, ChevronLeft, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import TenantToolbar from '../components/TenantToolbar';
import { formatTenantLabel, getTenantCompanyName, getTenantNumericId, toTitleCase } from '../utils/tenantDisplay';

// Consistent avatar color from a string
const getAvatarColor = (str = '') => {
    const colors = [
        { bg: 'bg-brand-100', text: 'text-brand-700' },
        { bg: 'bg-violet-100', text: 'text-violet-700' },
        { bg: 'bg-emerald-100', text: 'text-emerald-700' },
        { bg: 'bg-amber-100', text: 'text-amber-700' },
        { bg: 'bg-rose-100', text: 'text-rose-700' },
        { bg: 'bg-indigo-100', text: 'text-indigo-700' },
        { bg: 'bg-teal-100', text: 'text-teal-700' },
        { bg: 'bg-cyan-100', text: 'text-cyan-700' },
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

// Sortable table header component
const SortableHeader = ({ label, columnKey, sortBy, sortOrder, onSort, className = '' }) => {
    const active = sortBy === columnKey;
    return (
        <th
            onClick={() => onSort(columnKey)}
            className={`py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-brand-600 transition-colors ${className}`}
        >
            <div className={`flex items-center gap-1.5 ${className.includes('text-center') ? 'justify-center' : className.includes('text-right') ? 'justify-end' : ''}`}>
                {label}
                {active
                    ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-brand-500" /> : <ArrowDown size={13} className="text-brand-500" />)
                    : <ArrowUpDown size={13} className="opacity-30" />
                }
            </div>
        </th>
    );
};

const RMTenantList = () => {
    const { startImpersonating } = useAuth();
    const navigate = useNavigate();
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('rmTenantsViewMode') || 'grid');
    const [dateSort, setDateSort] = useState('none');
    const [sortBy, setSortBy] = useState('tenantNumericId');
    const [sortOrder, setSortOrder] = useState('asc');

    const [lowBalanceThreshold, setLowBalanceThreshold] = useState(() => {
        const saved = localStorage.getItem('lowBalanceThreshold');
        return saved ? parseInt(saved, 10) : 500;
    });
    const [isEditingThreshold, setIsEditingThreshold] = useState(false);
    const [tempThreshold, setTempThreshold] = useState(lowBalanceThreshold.toString());

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 12;

    useEffect(() => { localStorage.setItem('lowBalanceThreshold', lowBalanceThreshold.toString()); }, [lowBalanceThreshold]);
    useEffect(() => { fetchTenants(); }, []);
    useEffect(() => { localStorage.setItem('rmTenantsViewMode', viewMode); }, [viewMode]);
    useEffect(() => { setPage(1); }, [searchTerm, activeFilter, dateSort, sortBy, sortOrder, lowBalanceThreshold]);

    const fetchTenants = async () => {
        try {
            const res = await api.get('/auth/rm/tenants');
            setTenants(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch your tenants');
        } finally {
            setLoading(false);
        }
    };

    const handleImpersonate = (tenant) => {
        if (tenant.status === 'inactive') {
            toast.error('Cannot access inactive organization.');
            return;
        }
        if (!tenant.isApproved) {
            toast.warning('Organization is pending approval.');
            return;
        }
        const displayName = formatTenantLabel(tenant);
        startImpersonating({
            _id: tenant._id,
            name: displayName,
            adminName: tenant.adminUser?.fullName,
            adminEmail: tenant.adminUser?.email
        });
        toast.success(`Now managing: ${displayName}`);
        navigate('/dashboard');
    };

    const handleSort = (key) => {
        if (sortBy === key) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortOrder('asc');
        }
    };

    const handleToolbarChange = React.useCallback((state) => {
        setSearchTerm(state.search);
        setActiveFilter(state.filter);
        setDateSort(state.dateSort || 'none');
        setSortBy(state.sortBy);
        setSortOrder(state.sortDir);
        setViewMode(state.viewMode);
    }, []);

    // --- Computed Data ---
    const activeCount = tenants.filter(t => t.status === 'active' && t.isApproved).length;
    const inactiveCount = tenants.filter(t => t.status === 'inactive').length;
    const lowBalanceCount = tenants.filter(t => (t.balance || 0) < lowBalanceThreshold).length;

    const processedTenants = useMemo(() => {
        let result = [...tenants];

        // Search filter
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(q) ||
                (t.adminUser?.fullName?.toLowerCase().includes(q)) ||
                (t.adminUser?.email?.toLowerCase().includes(q)) ||
                (t.tenantId?.toString().includes(q))
            );
        }

        // Category filter
        if (activeFilter === 'active') result = result.filter(t => t.status === 'active' && t.isApproved);
        else if (activeFilter === 'inactive') result = result.filter(t => t.status === 'inactive');
        else if (activeFilter === 'lowBalance') result = result.filter(t => (t.balance || 0) < lowBalanceThreshold);

        // Sort
        if (dateSort !== 'none') {
            result.sort((a, b) => {
                const av = new Date(a.approvedAt || 0).getTime();
                const bv = new Date(b.approvedAt || 0).getTime();
                return dateSort === 'newer' ? bv - av : av - bv;
            });
        } else {
            result.sort((a, b) => {
                let valA, valB;
                switch (sortBy) {
                    case 'tenantNumericId': valA = getTenantNumericId(a) || 0; valB = getTenantNumericId(b) || 0; break;
                    case 'tenantName': valA = getTenantNumericId(a) || 0; valB = getTenantNumericId(b) || 0; break;
                    case 'adminName': valA = a.adminUser?.fullName?.toLowerCase() || ''; valB = b.adminUser?.fullName?.toLowerCase() || ''; break;
                    case 'email': valA = a.adminUser?.email?.toLowerCase() || ''; valB = b.adminUser?.email?.toLowerCase() || ''; break;
                    case 'status': valA = a.status || ''; valB = b.status || ''; break;
                    case 'balance': valA = a.balance || 0; valB = b.balance || 0; break;
                    default: valA = getTenantNumericId(a) || 0; valB = getTenantNumericId(b) || 0;
                }
                if (typeof valA === 'number') return sortOrder === 'asc' ? valA - valB : valB - valA;
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            });
        }

        return result;
    }, [tenants, searchTerm, activeFilter, dateSort, sortBy, sortOrder, lowBalanceThreshold]);

    // Pagination (client-side)
    const totalPagesComputed = Math.max(1, Math.ceil(processedTenants.length / limit));
    const maxVisiblePages = 10;
    const startPage = Math.floor((page - 1) / maxVisiblePages) * maxVisiblePages + 1;
    const endPage = Math.min(totalPagesComputed, startPage + maxVisiblePages - 1);
    const paginatedTenants = processedTenants.slice((page - 1) * limit, page * limit);

    const getStatusConfig = (tenant) => {
        if (tenant.status === 'inactive') return { label: 'Inactive', dotColor: 'bg-rose-500', bgColor: 'bg-rose-50', textColor: 'text-rose-600' };
        if (!tenant.isApproved) return { label: 'Pending', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-600' };
        return { label: 'Active', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' };
    };

    const isLowBalance = (tenant) => (tenant.balance || 0) < lowBalanceThreshold;

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[500px]">
                    <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
                    <p className="text-slate-500">Loading your organizations...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 overflow-y-auto h-full custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* ═══════════════ HERO HEADER ═══════════════ */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-blue-800 rounded-2xl p-7 text-white shadow-lg">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                    <Building2 size={20} className="text-white" />
                                </div>
                                <h1 className="text-xl font-bold tracking-tight">My Organizations</h1>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════ STATS ROW (4 cards) ═══════════════ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Organizations */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                                    <Users size={18} />
                                </div>
                                <span className="text-[13px] font-medium text-slate-500">Total organizations</span>
                            </div>
                            <p className="text-3xl font-bold text-slate-800">{tenants.length}</p>
                        </div>

                        {/* Active — clickable */}
                        <div
                            onClick={() => setActiveFilter(prev => prev === 'active' ? 'all' : 'active')}
                            className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-sm ${
                                activeFilter === 'active' ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200/80'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                    <TrendingUp size={18} />
                                </div>
                                <span className="text-[13px] font-medium text-slate-500">Active</span>
                            </div>
                            <div className="flex items-baseline gap-2.5">
                                <p className="text-3xl font-bold text-slate-800">{activeCount}</p>
                            </div>
                        </div>

                        {/* Inactive — clickable */}
                        <div
                            onClick={() => setActiveFilter(prev => prev === 'inactive' ? 'all' : 'inactive')}
                            className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-sm ${
                                activeFilter === 'inactive' ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200/80'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-2 bg-red-50 rounded-lg text-red-500">
                                    <AlertTriangle size={18} />
                                </div>
                                <span className="text-[13px] font-medium text-slate-500">Inactive</span>
                            </div>
                            <p className="text-3xl font-bold text-slate-800">{inactiveCount}</p>
                        </div>

                        {/* Low Balance */}
                        <div
                            className={`bg-white rounded-2xl border overflow-hidden cursor-pointer transition-all hover:shadow-sm group/card ${
                                activeFilter === 'lowBalance' ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200/80'
                            }`}
                            onClick={(e) => {
                                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                                    setActiveFilter(prev => prev === 'lowBalance' ? 'all' : 'lowBalance');
                                }
                            }}
                        >
                            <div className="flex items-stretch h-full">
                                <div className="w-1.5 bg-amber-400 flex-shrink-0"></div>
                                <div className="flex-1 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="relative p-2 bg-amber-50 rounded-lg text-amber-600">
                                                <AlertTriangle size={18} />
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {isEditingThreshold ? (
                                                    <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-lg pr-1" onClick={(e) => e.stopPropagation()}>
                                                        <span className="text-[13px] font-medium text-slate-500 pl-2">&lt;</span>
                                                        <input 
                                                            type="number" 
                                                            value={tempThreshold}
                                                            onChange={(e) => setTempThreshold(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    const val = parseInt(tempThreshold, 10);
                                                                    if (!isNaN(val) && val > 0) {
                                                                        setLowBalanceThreshold(val);
                                                                        setIsEditingThreshold(false);
                                                                    }
                                                                } else if (e.key === 'Escape') {
                                                                    setIsEditingThreshold(false);
                                                                    setTempThreshold(lowBalanceThreshold.toString());
                                                                }
                                                            }}
                                                            className="w-16 h-6 text-[13px] font-medium text-amber-700 bg-transparent border-none outline-none focus:ring-0 p-0"
                                                            autoFocus
                                                        />
                                                        <button 
                                                            onClick={() => {
                                                                const val = parseInt(tempThreshold, 10);
                                                                if (!isNaN(val) && val > 0) {
                                                                    setLowBalanceThreshold(val);
                                                                    setIsEditingThreshold(false);
                                                                }
                                                            }}
                                                            className="text-emerald-600 hover:text-emerald-700 flex items-center justify-center p-1 rounded hover:bg-emerald-50"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[13px] font-medium text-slate-500 flex items-center">
                                                        Low balance (&lt; {lowBalanceThreshold} credits)
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setTempThreshold(lowBalanceThreshold.toString());
                                                                setIsEditingThreshold(true);
                                                            }}
                                                            className="ml-2 p-1.5 rounded text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 transition-all font-normal opacity-0 group-hover/card:opacity-100 border border-emerald-200/60 shadow-sm"
                                                            title="Edit threshold"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                        </button>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className={`text-3xl font-bold ${lowBalanceCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>{lowBalanceCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════ TOOLBAR ═══════════════ */}
                    <div className="mb-6">
                        <TenantToolbar 
                            globalStats={{ 
                                activeCount, 
                                inactiveCount, 
                                lowBalanceCount 
                            }}
                            uniqueRMs={[]}
                            totalCount={tenants.length}
                            currentFilter={activeFilter}
                            onChange={handleToolbarChange}
                        />
                    </div>

                    {/* ═══════════════ CONTENT ═══════════════ */}
                    {processedTenants.length === 0 ? (
                        /* Empty State */
                        <div className="bg-white rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                            <div className="p-4 bg-slate-100 rounded-2xl">
                                <Building2 className="w-10 h-10 text-slate-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-slate-700">No organizations found</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    {searchTerm || activeFilter !== 'all'
                                        ? 'Try adjusting your search or filter'
                                        : 'No organizations have been assigned to you yet'}
                                </p>
                            </div>
                            {(searchTerm || activeFilter !== 'all') && (
                                <button
                                    onClick={() => { setSearchTerm(''); setActiveFilter('all'); }}
                                    className="text-sm text-brand-600 font-medium hover:text-brand-700 transition-colors"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>

                    ) : viewMode === 'grid' ? (
                        /* ═══════════════ GRID VIEW ═══════════════ */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {paginatedTenants.map((tenant) => {
                                const status = getStatusConfig(tenant);
                                const lowBal = isLowBalance(tenant);
                                return (
                                    <div
                                        key={tenant._id}
                                        className={`group bg-white rounded-2xl border hover:shadow-md transition-all duration-300 overflow-hidden ${
                                            lowBal ? 'border-amber-200' : 'border-slate-200/80'
                                        }`}
                                    >
                                        <div className="p-5 flex flex-col h-full">
                                            {/* Avatar & Status */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white font-medium text-2xl shadow-sm overflow-hidden ${!tenant.adminUser?.profilePicture ? 'bg-[#4589df]' : ''}`}>
                                                    {tenant.adminUser?.profilePicture ? (
                                                        <img src={tenant.adminUser.profilePicture} alt="" className="w-full h-full object-cover" />
                                                    ) : getTenantCompanyName(tenant).charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${status.bgColor} ${status.textColor}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`}></span>
                                                    {status.label}
                                                </span>
                                            </div>

                                            {/* Name & Date */}
                                            <div className="mb-4">
                                                <h3 className="font-semibold text-slate-800 text-lg leading-tight group-hover:text-brand-600 transition-colors line-clamp-1 mb-1">
                                                    {formatTenantLabel(tenant)}
                                                </h3>
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Mail size={13} className="text-slate-400 flex-shrink-0" />
                                                    <span className="text-[13px] text-slate-500 truncate" title={tenant.adminUser?.email || tenant.email}>
                                                        {tenant.adminUser?.email || tenant.email || 'No email provided'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Admin & Credits */}
                                            <div className="flex-grow flex gap-3 mb-5">
                                                <div className="flex-1 flex flex-col justify-center bg-[#f5f4f1] rounded-xl p-3">
                                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                        <User size={11} className="text-slate-400" /> Admin
                                                    </span>
                                                    {tenant.adminUser ? (
                                                        <span className="text-[14px] font-medium text-slate-800 truncate" title={tenant.adminUser.email}>
                                                            {toTitleCase(tenant.adminUser.fullName.split(' ')[0])}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[13px] text-slate-400 italic">Unassigned</span>
                                                    )}
                                                </div>
                                                <div className={`flex-1 flex flex-col justify-center rounded-xl p-3 ${lowBal ? 'bg-amber-50/80' : 'bg-[#f5f4f1]'}`}>
                                                    <span className={`text-[10px] font-medium uppercase tracking-wider mb-1.5 flex justify-between items-center ${lowBal ? 'text-amber-600' : 'text-slate-500'}`}>
                                                        <span className="flex items-center gap-1.5">
                                                            <CreditCard size={11} className={lowBal ? 'text-amber-500' : 'text-slate-400'} /> Credits
                                                        </span>
                                                        {lowBal && <AlertTriangle size={11} className="text-amber-500" />}
                                                    </span>
                                                    <span className={`text-[14px] font-medium truncate ${lowBal ? 'text-amber-700' : 'text-slate-800'}`}>
                                                        {(tenant.balance || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Dashboard Button */}
                                            <button
                                                onClick={() => handleImpersonate(tenant)}
                                                disabled={tenant.status === 'inactive'}
                                                className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                                                    tenant.status === 'inactive'
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-[#eef5fd] text-[#1c64c7] hover:bg-[#e0edf8] active:scale-[0.98]'
                                                }`}
                                            >
                                                <LayoutDashboard size={15} />
                                                <span>Dashboard</span>
                                                <ArrowUpRight size={15} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    ) : (
                        /* ═══════════════ LIST VIEW ═══════════════ */
                        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-100/60">
                                            <SortableHeader label="Organization" columnKey="tenantName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader label="Admin" columnKey="adminName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader label="Email" columnKey="email" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader label="Status" columnKey="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-center" />
                                            <SortableHeader label="Credits" columnKey="balance" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-right" />
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedTenants.map((tenant) => {
                                            const status = getStatusConfig(tenant);
                                            const lowBal = isLowBalance(tenant);
                                            const avatarColor = getAvatarColor(getTenantCompanyName(tenant));
                                            
                                            return (
                                                <tr 
                                                    key={tenant._id} 
                                                    onClick={() => handleImpersonate(tenant)}
                                                    className={`group transition-colors cursor-pointer ${lowBal ? 'bg-[#FFFBEB] hover:bg-[#FFF4D6]' : 'hover:bg-slate-50/50'}`}
                                                >
                                                    {/* Organization */}
                                                    <td className="py-4 px-6 max-w-[220px]">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0 overflow-hidden ${tenant.adminUser?.profilePicture ? '' : `${avatarColor.bg} ${avatarColor.text}`}`}>
                                                                {tenant.adminUser?.profilePicture ? (
                                                                    <img src={tenant.adminUser.profilePicture} alt="" className="w-full h-full object-cover" />
                                                                ) : getTenantCompanyName(tenant).charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[14px] font-bold text-slate-800 truncate">{formatTenantLabel(tenant)}</p>
                                                                <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                                                                    Joined {new Date(tenant.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Admin */}
                                                    <td className="py-4 px-6 max-w-[160px]">
                                                        {tenant.adminUser ? (
                                                            <div className="flex items-center gap-2">
                                                                <User size={14} className="text-slate-400 flex-shrink-0" />
                                                                <span className="text-sm text-slate-700 truncate">{toTitleCase(tenant.adminUser.fullName)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">Not assigned</span>
                                                        )}
                                                    </td>

                                                    {/* Email */}
                                                    <td className="py-4 px-6 max-w-[200px]">
                                                        {tenant.adminUser?.email ? (
                                                            <div className="flex items-center gap-2">
                                                                <Mail size={14} className="text-slate-400 flex-shrink-0" />
                                                                <span className="text-sm text-slate-500 truncate">{tenant.adminUser.email}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">—</span>
                                                        )}
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-4 px-6 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold ${status.bgColor} ${status.textColor}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`}></span>
                                                            {status.label}
                                                        </span>
                                                    </td>

                                                    {/* Credits */}
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex items-center justify-end">
                                                            {lowBal ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[12px] font-bold" title={`Below ${lowBalanceThreshold} credits`}>
                                                                    {(tenant.balance || 0).toLocaleString()}
                                                                    <AlertTriangle size={12} className="text-amber-500" />
                                                                </span>
                                                            ) : (
                                                                <span className="text-[14px] font-bold text-slate-800">
                                                                    {(tenant.balance || 0).toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Action */}
                                                    <td className="py-4 px-6 text-center">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleImpersonate(tenant); }}
                                                        disabled={tenant.status === 'inactive'}
                                                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                                            tenant.status === 'inactive'
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : 'bg-[#eef5fd] text-[#1c64c7] hover:bg-[#e0edf8]'
                                                        }`}
                                                    >
                                                            <LayoutDashboard size={14} />
                                                            Dashboard
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Pagination */}
                    {processedTenants.length > limit && (
                        <div className="flex justify-center items-center pt-4 gap-2">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                            >
                                <ChevronsLeft size={16} /> First
                            </button>
                            <button 
                                onClick={() => setPage(Math.max(1, startPage - maxVisiblePages))}
                                disabled={startPage === 1}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-9 h-9 text-sm font-medium rounded-lg transition-all ${
                                            p === page
                                                ? 'bg-brand-600 text-white shadow-sm'
                                                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <button 
                                onClick={() => setPage(Math.min(totalPagesComputed, startPage + maxVisiblePages))}
                                disabled={startPage + maxVisiblePages > totalPagesComputed}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => setPage(totalPagesComputed)}
                                disabled={page === totalPagesComputed}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                            >
                                Last <ChevronsRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default RMTenantList;
