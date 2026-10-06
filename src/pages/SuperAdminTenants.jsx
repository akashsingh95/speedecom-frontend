import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';
import { Search, Building, User, LayoutDashboard, ShieldCheck, Gift, LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown, Mail, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreVertical, Tags, Building2, Users, Loader2, ArrowUpRight, CreditCard, AlertTriangle, TrendingUp, MinusCircle, CalendarCheck, Pencil, X, UserPlus, ShoppingBag, Store, PackageOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GiftCreditsModal from '../components/GiftCreditsModal';
import TenantRatesModal from '../components/TenantRatesModal';
import TenantToolbar from '../components/TenantToolbar';
import DeductCreditsModal from '../components/DeductCreditsModal';
import ConfirmModal from '../components/ConfirmModal';
import Tooltip from '../components/Tooltip';
import { useAuth } from '../AuthContext';
import { useDragToFill } from '../hooks/useDragToFill';
import { formatTenantLabel, getTenantCompanyName, getTenantNumericId, toTitleCase } from '../utils/tenantDisplay';

// Consistent avatar color from a string — matches Manage Roles palette 

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
    for (let i = 0; i < str.length; i += 1) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// Kebab menu for row/card-level actions. Any action prop can be null — only passed ones render.
// Uses fixed positioning so the popover escapes overflow-clipped table wrappers.
const ActionMenu = ({ onView, onGift, onDeduct, onRates, onEdit, onAssignRM, onToggleStatus, onViewReason, isInactive, variant = 'header' }) => {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target) &&
                btnRef.current && !btnRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    // If there's nothing to show, don't render the button at all.
    if (!onView && !onGift && !onDeduct && !onRates && !onEdit && !onAssignRM && !onToggleStatus && !onViewReason) return null;

    const toggleOpen = () => {
        if (open) {
            setOpen(false);
            return;
        }
        const rect = btnRef.current?.getBoundingClientRect();
        if (!rect) return;
        const menuWidth = 200;

        const itemCount = [onView, onGift, onDeduct, onRates, onEdit, onAssignRM, onViewReason, onToggleStatus].filter(Boolean).length;
        const estHeight = itemCount * 38 + 15 + (hasDivider ? 9 : 0);

        const spaceBelow = window.innerHeight - rect.bottom - 6;
        const spaceAbove = rect.top - 6;

        if (spaceBelow >= estHeight || spaceBelow >= spaceAbove) {
            setCoords({ top: rect.bottom + 6, left: Math.max(8, rect.right - menuWidth) });
        } else {
            setCoords({ top: rect.top - estHeight - 6, left: Math.max(8, rect.right - menuWidth) });
        }
        setOpen(true);
    };

    const buttonClass = variant === 'row'
        ? 'inline-flex items-center justify-center p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200 transition-colors'
        : 'inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors';

    const hasTopActions = !!(onView || onGift || onDeduct || onRates);
    const hasMidActions = hasTopActions || !!(onEdit || onAssignRM || onViewReason);
    const hasDivider = hasMidActions && !!onToggleStatus;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={toggleOpen}
                className={buttonClass}
                title="More actions"
            >
                <MoreVertical size={16} />
            </button>
            {open && (
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: coords.top, left: coords.left, width: 200 }}
                    className="bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1.5"
                >
                    {onView && (
                        <button
                            type="button"
                            onClick={() => { onView(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <LayoutDashboard size={15} className="text-slate-400" />
                            View Dashboard
                        </button>
                    )}
                    {onGift && (
                        <button
                            type="button"
                            onClick={() => { onGift(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
                        >
                            <Gift size={15} className="text-brand-500" />
                            Gift Credits
                        </button>
                    )}
                    {onDeduct && (
                        <button
                            type="button"
                            onClick={() => { onDeduct(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <MinusCircle size={15} className="text-red-500" />
                            Deduct Credits
                        </button>
                    )}
                    {onRates && (
                        <button
                            type="button"
                            onClick={() => { onRates(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <Tags size={15} className="text-slate-400" />
                            Speedy Listing Rates
                        </button>
                    )}
                    {onEdit && (
                        <button
                            onClick={() => { onEdit(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <Pencil size={15} className="text-slate-400" />
                            Edit Details
                        </button>
                    )}
                    {onAssignRM && (
                        <button
                            onClick={() => { onAssignRM(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
                        >
                            <UserPlus size={15} className="text-brand-500" />
                            Assign RM
                        </button>
                    )}
                    {onViewReason && (
                        <button
                            onClick={() => { onViewReason(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <AlertTriangle size={15} className="text-red-400" />
                            Suspension Reason
                        </button>
                    )}
                    {onToggleStatus && (
                        <>
                            {hasDivider && <div className="border-t border-slate-100 my-1" />}
                            <button
                                onClick={() => { onToggleStatus(); setOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors ${isInactive
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-amber-600 hover:bg-amber-50'
                                    }`}
                            >
                                <ShieldCheck size={15} />
                                {isInactive ? 'Activate Tenant' : 'Suspend Tenant'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </>
    );
};

const SortableHeader = ({ label, columnKey, sortBy, sortOrder, onSort, className = '' }) => {
    const active = sortBy === columnKey;
    return (
        <th
            onClick={() => onSort(columnKey)}
            className={`py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-brand-600 transition-colors ${className}`}
        >
            <div className={`flex items-center gap-1.5 ${className.includes('text-center') ? 'justify-center' : className.includes('text-right') ? 'justify-end' : ''}`}>
                {label}
                {active ? (
                    sortOrder === 'asc'
                        ? <ArrowUp size={12} className="text-brand-600" />
                        : <ArrowDown size={12} className="text-brand-600" />
                ) : (
                    <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-400" />
                )}
            </div>
        </th>
    );
};

const getDisplayCredits = (tenant) =>
    tenant?.tenantId?.billedBalance ?? tenant?.tenantId?.balance ?? 0;

const getListingStudioCredits = (tenant) => tenant?.tenantId?.listingStudioBalance ?? 0;
const getListingStudioPlans = (tenant) => tenant?.tenantId?.listingStudioPlans ?? [];

// Hover content for the Speedy Listing credits tile — lists each active plan lot the
// tenant currently holds (a tenant can hold more than one, e.g. Basic then Premium).
const ListingStudioPlansTooltip = ({ plans }) => (
    <div className="flex flex-col gap-1 py-0.5">
        <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">Speedy Listing Plan{plans.length !== 1 ? 's' : ''}</span>
        {plans.length === 0 ? (
            <span className="text-xs text-slate-300">No active plan</span>
        ) : (
            plans.map((plan) => (
                <div key={plan.title} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-white">{plan.title}</span>
                    <span className="text-slate-300">{plan.remainingCredits.toLocaleString()} credits</span>
                </div>
            ))
        )}
    </div>
);

const getSortValue = (tenant, key) => {
    switch (key) {
        case 'tenantNumericId': return getTenantNumericId(tenant) || 0;
        case 'tenantName': return getTenantNumericId(tenant) || 0;
        case 'adminName': return (tenant.fullName || '').toLowerCase();
        case 'rmName': return (tenant.tenantId?.assignedToRM?.fullName || '').toLowerCase();
        case 'email': return (tenant.email || '').toLowerCase();
        case 'status': return tenant.tenantId?.status === 'inactive' ? 1 : 0;
        case 'balance': return getDisplayCredits(tenant);
        case 'approvedAt': return tenant.tenantId?.approvedAt ? new Date(tenant.tenantId.approvedAt).getTime() : 0;
        default: return '';
    }
};

const SuperAdminTenants = () => {
    const { startImpersonating, user } = useAuth();
    const canEditTenantDetails = user?.role === 'SuperAdmin' || user?.role === 'SBM';
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
    const [isDeductModalOpen, setIsDeductModalOpen] = useState(false);
    const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [suspendTargetTenant, setSuspendTargetTenant] = useState(null);
    const [suspendReason, setSuspendReason] = useState('');
    const [suspending, setSuspending] = useState(false);
    const [viewReasonTenant, setViewReasonTenant] = useState(null);
    const navigate = useNavigate();

    // Drag-to-Fill: Edit Mode toggles the RM column into editable cells with a fill handle.
    const [isEditMode, setIsEditMode] = useState(false);
    const [allRMs, setAllRMs] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTenants, setTotalTenants] = useState(0);
    const limit = 12;
    const [globalStats, setGlobalStats] = useState(null);
    const [lowBalanceThreshold, setLowBalanceThreshold] = useState(() => {
        const saved = localStorage.getItem('lowBalanceThreshold');
        return saved ? parseInt(saved, 10) : 500;
    });
    const [isEditingThreshold, setIsEditingThreshold] = useState(false);
    const [tempThreshold, setTempThreshold] = useState(lowBalanceThreshold.toString());
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('tenantsViewMode') || 'grid');
    const [dateSort, setDateSort] = useState('newer');
    const [sortBy, setSortBy] = useState('tenantNumericId');
    const [sortOrder, setSortOrder] = useState('asc');
    const [activeFilter, setActiveFilter] = useState('all');
    const [selectedRM, setSelectedRM] = useState('all');
    const [product, setProduct] = useState('all');
    const [listingStudioPlan, setListingStudioPlan] = useState('all');
    const [uniqueRMs, setUniqueRMs] = useState([]);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameTenant, setRenameTenant] = useState(null);
    const [renameTenantName, setRenameTenantName] = useState('');
    const [renameTenantNumericId, setRenameTenantNumericId] = useState('');
    const [renameError, setRenameError] = useState('');
    const [showRenameConfirm, setShowRenameConfirm] = useState(false);

    // Assign RM Modal State
    const [assignRmTargetTenant, setAssignRmTargetTenant] = useState(null);
    const [selectedRmId, setSelectedRmId] = useState('');
    const [savingRm, setSavingRm] = useState(false);

    useEffect(() => {
        localStorage.setItem('lowBalanceThreshold', String(lowBalanceThreshold));
    }, [lowBalanceThreshold]);

    useEffect(() => {
        localStorage.setItem('tenantsViewMode', viewMode);
    }, [viewMode]);

    const handleToolbarChange = React.useCallback((state) => {
        setSearchTerm(state.search);
        setActiveFilter(prev => { if (prev !== state.filter) setPage(1); return state.filter; });
        setSelectedRM(prev => { if (prev !== state.selectedRM) setPage(1); return state.selectedRM; });
        setProduct(prev => { const next = state.product || 'all'; if (prev !== next) setPage(1); return next; });
        setListingStudioPlan(prev => { const next = state.listingStudioPlan || 'all'; if (prev !== next) setPage(1); return next; });
        setDateSort(state.dateSort || 'none');
        setSortBy(prev => { if (prev !== state.sortBy) setPage(1); return state.sortBy; });
        setSortOrder(prev => { if (prev !== state.sortDir) setPage(1); return state.sortDir; });
        setViewMode(state.viewMode);
    }, []);

    const handleSort = (key) => {
        if (sortBy === key) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(key);
            setSortOrder('asc');
        }
    };

    const effectiveSortBy = dateSort !== 'none' ? 'approvedAt' : sortBy;
    const effectiveSortOrder = dateSort === 'newer' ? 'desc' : (dateSort === 'older' ? 'asc' : sortOrder);

    const sortedTenants = useMemo(() => {
        let arr = [...tenants];

        if (activeFilter === 'active') {
            arr = arr.filter(t => t.tenantId?.status !== 'inactive');
        } else if (activeFilter === 'inactive') {
            arr = arr.filter(t => t.tenantId?.status === 'inactive');
        } else if (activeFilter === 'lowBalance') {
            arr = arr.filter(t => getDisplayCredits(t) < lowBalanceThreshold);
        }

        if (selectedRM !== 'all' && !isEditMode) {
            if (selectedRM === 'unassigned') {
                arr = arr.filter(t => !t.tenantId?.assignedToRM);
            } else {
                arr = arr.filter(t => t.tenantId?.assignedToRM?._id === selectedRM);
            }
        }

        if (dateSort !== 'none') {
            arr.sort((a, b) => {
                const av = new Date(a.tenantId?.approvedAt || 0).getTime();
                const bv = new Date(b.tenantId?.approvedAt || 0).getTime();
                return dateSort === 'newer' ? bv - av : av - bv;
            });
        }
        return arr;
    }, [tenants, sortBy, sortOrder, activeFilter, selectedRM, dateSort, lowBalanceThreshold, isEditMode, searchTerm]);

    const fetchTenants = useCallback(async (currentPage, search, filter, rm, sortKey, sortDir, threshold, productFilter, listingStudioPlanFilter) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit,
                search,
                filter,
                rmId: rm,
                product: productFilter || 'all',
                listingStudioPlan: listingStudioPlanFilter || 'all',
                sortBy: sortKey,
                sortOrder: sortDir,
                lowBalanceThreshold: threshold,
            });
            const res = await api.get(`/auth/tenants?${params.toString()}`);
            // Due to the api.js interceptor unwrapping { success, data }, res.data is the array directly
            // and pagination is attached to res.pagination.
            setTenants(res.data);

            if (res.pagination) {
                setTotalPages(res.pagination.pages);
                setTotalTenants(res.pagination.total);
            }
            if (res.stats) {
                setGlobalStats(res.stats);
                if (res.stats.uniqueRMs) {
                    setUniqueRMs(res.stats.uniqueRMs);
                }
            }
        } catch (error) {
            console.error('Error fetching tenants', error);
            toast.error('Unable to load tenants');
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        const delay = setTimeout(() => {
            setDebouncedSearchTerm((prev) => {
                if (prev !== searchTerm) {
                    setPage(1);
                    return searchTerm;
                }
                return prev;
            });
        }, 500);
        return () => clearTimeout(delay);
    }, [searchTerm]);

    useEffect(() => {
        const effectiveSortBy = dateSort !== 'none' ? 'approvedAt' : sortBy;
        const effectiveSortOrder = dateSort === 'newer' ? 'desc' : (dateSort === 'older' ? 'asc' : sortOrder);
        fetchTenants(page, debouncedSearchTerm, activeFilter, selectedRM, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold, product, listingStudioPlan);
    }, [page, debouncedSearchTerm, activeFilter, selectedRM, product, listingStudioPlan, dateSort, sortBy, sortOrder, lowBalanceThreshold, fetchTenants]);

    const handleViewDashboard = (tenantAdminId, tenantName, adminName, adminEmail) => {
        startImpersonating({
            _id: tenantAdminId,
            name: tenantName,
            adminName: adminName,
            adminEmail: adminEmail
        });
        navigate('/dashboard');
    }

    const handleOpenGiftModal = (tenant) => {
        setSelectedTenant(tenant);
        setIsGiftModalOpen(true);
    };

    const handleOpenRatesModal = (tenant) => {
        setSelectedTenant(tenant);
        setIsRatesModalOpen(true);
    };

    const handleOpenDeductModal = (tenant) => {
        setSelectedTenant(tenant);
        setIsDeductModalOpen(true);
    };

    const handleOpenRenameModal = (tenant) => {
        const numericId = getTenantNumericId(tenant);
        setRenameTenant(tenant);
        setRenameTenantName(getTenantCompanyName(tenant));
        const num = getTenantNumericId(tenant);
        setRenameTenantNumericId(num != null ? String(num) : '');
        setRenameError('');
        setIsRenameModalOpen(true);
    };

    const handleCloseRenameModal = () => {
        setIsRenameModalOpen(false);
        setRenameTenant(null);
        setRenameTenantName('');
        setRenameTenantNumericId('');
        setRenameError('');
    };

    const handleRenameTenant = () => {
        if (!renameTenant?.tenantId?._id) {
            setRenameError('Invalid tenant data');
            return;
        }

        const trimmedName = renameTenantName.trim();
        if (!trimmedName) {
            setRenameError('Company name is required');
            return;
        }
        if (trimmedName.length < 2) {
            setRenameError('Company name must be at least 2 characters');
            return;
        }
        if (trimmedName.length > 100) {
            setRenameError('Company name must not exceed 100 characters');
            return;
        }

        const numericInput = renameTenantNumericId.trim();

        let parsedNumericId = null;
        if (numericInput !== '') {
            parsedNumericId = parseInt(numericInput, 10);
            if (Number.isNaN(parsedNumericId) || !Number.isInteger(parsedNumericId)) {
                setRenameError('Tenant ID must be a whole number');
                return;
            }
            if (parsedNumericId < 0) {
                setRenameError('Tenant ID must be zero or greater');
                return;
            }
        } else if (canEditTenantDetails) {
            setRenameError('Tenant ID is required');
            return;
        }

        const currentName = getTenantCompanyName(renameTenant);
        const currentNumericId = getTenantNumericId(renameTenant);
        const nameUnchanged = currentName === trimmedName;
        const idUnchanged = currentNumericId === parsedNumericId;
        if (nameUnchanged && idUnchanged) {
            handleCloseRenameModal();
            return;
        }

        setShowRenameConfirm(true);
    };

    const executeRenameTenant = async () => {
        const mongoId = renameTenant.tenantId._id;
        const trimmedName = renameTenantName.trim();
        const currentName = getTenantCompanyName(renameTenant);
        const currentNumericId = getTenantNumericId(renameTenant);
        const nameUnchanged = currentName === trimmedName;

        let parsedNumericId = null;
        if (renameTenantNumericId.trim() !== '') {
            parsedNumericId = parseInt(renameTenantNumericId.trim(), 10);
        }

        const idUnchanged = currentNumericId === parsedNumericId;

        setShowRenameConfirm(false);
        try {
            const body = {};
            if (!nameUnchanged) body.name = trimmedName;
            if (!idUnchanged && canEditTenantDetails) body.tenantId = parsedNumericId;
            if (Object.keys(body).length === 0) {
                handleCloseRenameModal();
                return;
            }
            await api.put(`/auth/tenants/${mongoId}/details`, body);
            toast.success('Tenant updated successfully');
            handleCloseRenameModal();
            fetchTenants(page, debouncedSearchTerm, activeFilter, selectedRM, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold, product, listingStudioPlan);
        } catch (error) {
            const msg = error?.response?.data?.message || "Failed to update tenant details. Please try again.";
            setRenameError(msg);
            console.error("Update tenant failed", error);
        }
    };

    const [reactivateTarget, setReactivateTarget] = useState(null);

    const handleToggleStatus = async (tenantId, currentStatus) => {
        if (currentStatus === 'inactive') {
            const tenant = sortedTenants.find(t => t.tenantId?._id === tenantId);
            setReactivateTarget(tenant || { tenantId: { _id: tenantId } });
        } else {
            const tenant = sortedTenants.find(t => t.tenantId?._id === tenantId);
            setSuspendTargetTenant(tenant || { tenantId: { _id: tenantId } });
            setSuspendReason('');
            setSuspending(false);
        }
    };

    const handleConfirmSuspend = async () => {
        if (!suspendReason.trim()) return;
        const tenantId = suspendTargetTenant?.tenantId?._id;
        if (!tenantId) return;
        setSuspending(true);
        try {
            await api.put(`/auth/tenants/${tenantId}/status`, { status: 'inactive', suspensionReason: suspendReason.trim() });
            toast.success('Tenant suspended successfully');
            setSuspendTargetTenant(null);
            setSuspendReason('');
            fetchTenants(page, debouncedSearchTerm, activeFilter, selectedRM, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold, product, listingStudioPlan);
        } catch (error) {
            console.error('Error suspending tenant', error);
            toast.error('Failed to suspend tenant');
        } finally {
            setSuspending(false);
        }
    };

    const handleConfirmReactivate = async () => {
        const tenantId = reactivateTarget?.tenantId?._id;
        if (!tenantId) return;
        try {
            await api.put(`/auth/tenants/${tenantId}/status`, { status: 'active' });
            toast.success('Tenant activated successfully');
            setReactivateTarget(null);
            fetchTenants(page, debouncedSearchTerm, activeFilter, selectedRM, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold, product, listingStudioPlan);
        } catch (error) {
            console.error('Error toggling status', error);
            toast.error('Failed to activate tenant');
        }
    };

    const handleDragComplete = useCallback(async ({ start, end }) => {
        const targetRows = sortedTenants.slice(start.rowIndex + 1, end.rowIndex + 1);
        const tenantIds = targetRows.map(t => t.tenantId?._id).filter(Boolean);
        if (tenantIds.length === 0) return;

        setTenants(prev => prev.map(t => {
            if (!tenantIds.includes(t.tenantId?._id)) return t;
            return {
                ...t,
                tenantId: {
                    ...t.tenantId,
                    assignedToRM: start.rmId ? { _id: start.rmId, fullName: start.rmName } : null,
                },
            };
        }));

        try {
            if (start.rmId) {
                await api.post('/auth/tenants/bulk-assign', { rmId: start.rmId, tenantIds });
                toast.success(`Assigned ${tenantIds.length} tenants to ${start.rmName}`);
            } else {
                await api.post('/auth/tenants/bulk-unassign', { tenantIds });
                toast.success(`Unassigned ${tenantIds.length} tenants`);
            }
        } catch (error) {
            toast.error('Failed to apply assignments');
            fetchTenants(page, debouncedSearchTerm, activeFilter, selectedRM, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold, product, listingStudioPlan);
            console.error('Bulk assign failed', error);
        }
    }, [sortedTenants, fetchTenants, page, debouncedSearchTerm, activeFilter, selectedRM, product, listingStudioPlan, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold]);

    const { isDragging, dragStart, dragPreview, startDrag, enterCell } = useDragToFill({ onComplete: handleDragComplete });

    const handleAssignRMForTenant = async (tenantDocId, rmId) => {
        const targetRM = allRMs.find(r => r._id === rmId);
        setTenants(prev => prev.map(t => t.tenantId?._id === tenantDocId
            ? { ...t, tenantId: { ...t.tenantId, assignedToRM: rmId ? { _id: rmId, fullName: targetRM?.fullName } : null } }
            : t
        ));

        try {
            if (rmId) {
                await api.post('/auth/tenants/bulk-assign', { rmId, tenantIds: [tenantDocId] });
                toast.success(`Assigned to ${targetRM?.fullName || 'RM'}`);
            } else {
                await api.post('/auth/tenants/bulk-unassign', { tenantIds: [tenantDocId] });
                toast.success('Unassigned');
            }
        } catch (error) {
            toast.error('Failed to update assignment');
            fetchTenants(page, debouncedSearchTerm, activeFilter, selectedRM, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold, product, listingStudioPlan);
            console.error('Assign RM failed', error);
        }
    };

    const handleOpenAssignRmModal = (tenant) => {
        console.log("🚀 ~ handleOpenAssignRmModal ~ tenant:", tenant)
        setAssignRmTargetTenant(tenant);
        setSelectedRmId(tenant?.tenantId?.assignedToRM?._id || '');
    };

    const handleSaveAssignRmModal = async () => {
        if (!assignRmTargetTenant) return;
        const tenantDocId = assignRmTargetTenant.tenantId?._id;
        if (!tenantDocId) return;

        setSavingRm(true);
        try {
            await handleAssignRMForTenant(tenantDocId, selectedRmId);
            setAssignRmTargetTenant(null);
        } catch (err) {
            console.error('Failed to save RM assignment', err);
        } finally {
            setSavingRm(false);
        }
    };

    useEffect(() => {
        if (allRMs.length > 0) return;
        (async () => {
            try {
                const res = await api.get('/auth/admin-users?role=RM');
                const rms = (res.data?.rmUsers || res.rmUsers || [])
                    .filter(r => r.status === 'active')
                    .map(r => ({ _id: r._id, fullName: r.fullName, email: r.email }));
                setAllRMs(rms);
            } catch (error) {
                console.error('Load RM list failed', error);
            }
        })();
    }, [allRMs.length]);
    // -------------------

    // Pagination page number window (block-based: 1-10, 11-20, etc.)
    const maxVisiblePages = 10;
    const startPage = Math.floor((page - 1) / maxVisiblePages) * maxVisiblePages + 1;
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);


    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 overflow-y-auto h-full custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-blue-800 rounded-2xl p-7 text-white shadow-lg mb-6">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                    <Building2 size={20} className="text-white" />
                                </div>
                                <h1 className="text-xl font-bold tracking-tight">Tenant Management</h1>
                            </div>
                            {(user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.manageRM)) && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditMode(v => !v)}
                                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 shadow-md shrink-0 active:scale-95 border ${isEditMode
                                        ? 'bg-brand-600 text-white border-brand-500 hover:bg-brand-700 ring-2 ring-white/20'
                                        : 'bg-white text-brand-700 border-white hover:bg-white/90'
                                        }`}
                                >
                                    {isEditMode ? <X size={16} /> : <Pencil size={16} />}
                                    {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
                                </button>
                            )}
                        </div>
                    </div>

                    {globalStats ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Total Organizations */}
                            <div
                                onClick={() => { setActiveFilter('all'); setPage(1); }}
                                className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-sm ${activeFilter === 'all' ? 'border-brand-300 ring-1 ring-brand-100' : 'border-slate-200/80'
                                    }`}
                            >
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                                        <Users size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">Total organizations</span>
                                </div>
                                <p className="text-3xl font-bold text-slate-800">{globalStats.totalTenants}</p>
                            </div>
                            <div
                                onClick={() => { setActiveFilter(prev => prev === 'active' ? 'all' : 'active'); setPage(1); }}
                                className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-sm ${activeFilter === 'active' ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200/80'
                                    }`}
                            >
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                        <TrendingUp size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">Active</span>
                                </div>
                                <div className="flex items-baseline gap-2.5">
                                    <p className="text-3xl font-bold text-slate-800">{globalStats.activeCount}</p>
                                </div>
                            </div>
                            <div
                                onClick={() => { setActiveFilter(prev => prev === 'inactive' ? 'all' : 'inactive'); setPage(1); }}
                                className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-sm ${activeFilter === 'inactive' ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200/80'
                                    }`}
                            >
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-red-50 rounded-lg text-red-500">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">Inactive</span>
                                </div>
                                <p className="text-3xl font-bold text-slate-800">{globalStats.totalTenants - globalStats.activeCount}</p>
                            </div>
                            <div
                                onClick={(e) => {
                                    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                                        setActiveFilter(prev => prev === 'lowBalance' ? 'all' : 'lowBalance');
                                        setPage(1);
                                    }
                                }}
                                className={`bg-white rounded-2xl border overflow-hidden cursor-pointer transition-all hover:shadow-sm group/card ${activeFilter === 'lowBalance' ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200/80'
                                    }`}
                            >
                                <div className="flex items-stretch h-full">
                                    <div className="w-1.5 bg-amber-400 flex-shrink-0" />
                                    <div className="flex-1 p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="relative p-2 bg-amber-50 rounded-lg text-amber-600">
                                                    <AlertTriangle size={18} />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {isEditingThreshold ? (
                                                        <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-lg pr-1" onClick={(event) => event.stopPropagation()}>
                                                            <span className="text-[13px] font-medium text-slate-500 pl-2">&lt;</span>
                                                            <input
                                                                type="number"
                                                                value={tempThreshold}
                                                                onChange={(e) => setTempThreshold(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        const val = parseInt(tempThreshold, 10);
                                                                        if (!Number.isNaN(val) && val > 0) {
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
                                                                    if (!Number.isNaN(val) && val > 0) {
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
                                                            Low balance (&lt; {lowBalanceThreshold})
                                                            <button
                                                                type="button"
                                                                onClick={(evt) => {
                                                                    evt.stopPropagation();
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
                                            <span className={`text-3xl font-bold ${globalStats.lowBalanceCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                                                {globalStats.lowBalanceCount}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                                        <Users size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">Total organizations</span>
                                </div>
                                <p className="text-3xl font-bold text-slate-800">{totalTenants || tenants.length}</p>
                            </div>
                        </div>
                    )}

                    <div className="mb-6">
                        <TenantToolbar
                            globalStats={globalStats}
                            uniqueRMs={uniqueRMs}
                            totalCount={totalTenants || tenants.length}
                            currentFilter={activeFilter}
                            onChange={handleToolbarChange}
                        />
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px]">
                            <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
                            <p className="text-slate-500">Loading organizations...</p>
                        </div>
                    ) : sortedTenants.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                            <div className="p-4 bg-slate-100 rounded-2xl">
                                <Building2 className="w-10 h-10 text-slate-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-slate-700">No organizations found</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    {searchTerm
                                        ? 'Try adjusting your search criteria'
                                        : 'No organizations have been registered yet'}
                                </p>
                            </div>
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="text-sm text-brand-600 font-medium hover:text-brand-700 transition-colors"
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {sortedTenants.map((tenant) => {
                                const isInactive = tenant.tenantId?.status === 'inactive';
                                const isApproved = tenant.tenantId?.isApproved ?? true;

                                let status = { label: 'Active', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' };
                                if (isInactive) status = { label: 'Inactive', dotColor: 'bg-rose-500', bgColor: 'bg-rose-50', textColor: 'text-rose-600' };
                                else if (!isApproved) status = { label: 'Pending', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-600' };

                                const tName = formatTenantLabel(tenant);
                                const avatarLetter = getTenantCompanyName(tenant).charAt(0).toUpperCase();
                                const lowBal = getDisplayCredits(tenant) < lowBalanceThreshold;

                                return (
                                    <div
                                        key={tenant._id}
                                        className={`group bg-white rounded-2xl border hover:shadow-md transition-all duration-300 overflow-hidden ${lowBal ? 'border-amber-200' : 'border-slate-200/80'
                                            }`}
                                    >
                                        <div className="p-5 flex flex-col h-full">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className={`w-[52px] h-[52px] rounded-2xl flex flex-shrink-0 items-center justify-center text-white font-medium text-2xl shadow-sm overflow-hidden ${!tenant.profilePicture ? 'bg-[#4589df]' : ''}`}>
                                                    {tenant.profilePicture ? (
                                                        <img src={tenant.profilePicture} alt="" className="w-full h-full object-cover" />
                                                    ) : avatarLetter}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${status.bgColor} ${status.textColor}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                                                        {status.label}
                                                    </span>
                                                    {isApproved && (
                                                        <ActionMenu
                                                            variant="header"
                                                            isInactive={isInactive}
                                                            onGift={(user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.giftCredits)) ? () => handleOpenGiftModal(tenant) : null}
                                                            onDeduct={(user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.deductCredits)) ? () => handleOpenDeductModal(tenant) : null}
                                                            onRates={user?.role === 'SuperAdmin' ? () => handleOpenRatesModal(tenant) : null}
                                                            onAssignRM={canEditTenantDetails ? () => handleOpenAssignRmModal(tenant) : null}
                                                            onViewReason={isInactive ? () => setViewReasonTenant(tenant) : null}
                                                            onToggleStatus={
                                                                (user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.suspendTenant))
                                                                    ? () => handleToggleStatus(tenant.tenantId?._id, tenant.tenantId?.status)
                                                                    : null
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <h3 className="font-semibold text-slate-800 text-lg leading-tight group-hover:text-brand-600 transition-colors line-clamp-1 mb-1">
                                                        {tName}
                                                    </h3>
                                                    {canEditTenantDetails && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenRenameModal(tenant)}
                                                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
                                                            title="Edit tenant ID and company name"
                                                        >
                                                            <Pencil size={14} />
                                                            Edit Details
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <CalendarCheck size={13} className="text-slate-400 flex-shrink-0" />
                                                    <span className="text-[13px] text-slate-500 truncate">
                                                        {(() => {
                                                            const approvedDate = tenant.tenantId?.approvedAt || tenant.tenantId?.createdAt || tenant.createdAt;
                                                            return approvedDate
                                                                ? `Approved ${new Date(approvedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                                                                : 'Approval date unavailable';
                                                        })()}



                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex-grow flex flex-col gap-2 mb-5">
                                                {/* Row 1: Admin, RM, Reconciliation credits, Speedy Listing credits */}
                                                <div className="grid grid-cols-2 gap-2.5">
                                                    <div className="min-w-0 flex flex-col justify-center bg-[#f5f4f1] rounded-xl p-2.5">
                                                        <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                            <User size={10} className="text-slate-400" /> Admin
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-800 truncate" title={tenant.email}>
                                                            {tenant.fullName ? toTitleCase(tenant.fullName.split(' ')[0]) : 'Unassigned'}
                                                        </span>
                                                    </div>
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); if (canEditTenantDetails) handleOpenAssignRmModal(tenant); }}
                                                        className={`min-w-0 flex flex-col justify-center bg-[#f5f4f1] rounded-xl p-2.5 relative group/rm ${canEditTenantDetails ? 'cursor-pointer hover:bg-brand-50/80 hover:border-brand-200 border border-transparent transition-all' : ''}`}
                                                        title={canEditTenantDetails ? "Click to assign/change RM" : ""}
                                                    >
                                                        <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                                                            <span className="flex items-center gap-1">
                                                                <User size={10} className="text-slate-400" /> RM
                                                            </span>
                                                            {canEditTenantDetails && (
                                                                <Pencil size={10} className="text-slate-400 opacity-0 group-hover/rm:opacity-100 transition-opacity" />
                                                            )}
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-800 truncate" title={tenant.tenantId?.assignedToRM?.email}>
                                                            {tenant.tenantId?.assignedToRM?.fullName ? toTitleCase(tenant.tenantId.assignedToRM.fullName.split(' ')[0]) : 'None'}
                                                        </span>
                                                    </div>
                                                    <div className={`min-w-0 flex flex-col justify-center rounded-xl p-2.5 ${lowBal ? 'bg-amber-50/80 border border-amber-100' : 'bg-[#f5f4f1]'}`}>
                                                        <span className={`text-[9px] font-medium uppercase tracking-wider mb-1 flex justify-between items-center ${lowBal ? 'text-amber-600' : 'text-slate-500'}`}>
                                                        <span className="flex items-center gap-1">
                                                                <CreditCard size={10} className={lowBal ? 'text-amber-500' : 'text-slate-400'} /> Reconciliation
                                                            </span>
                                                            {lowBal && <AlertTriangle size={10} className="text-amber-500" />}
                                                        </span>
                                                        <span className={`text-xs font-bold ${lowBal ? 'text-amber-700' : 'text-slate-700'}`}>
                                                            {getDisplayCredits(tenant).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <Tooltip content={<ListingStudioPlansTooltip plans={getListingStudioPlans(tenant)} />}>
                                                        <div className="min-w-0 w-full flex flex-col justify-center bg-violet-50/70 border border-violet-100 rounded-xl p-2.5 cursor-default">
                                                            <span className="text-[9px] font-medium text-violet-600 uppercase tracking-wider mb-1 flex items-center gap-1 whitespace-nowrap">
                                                                <PackageOpen size={10} className="text-violet-500 shrink-0" /> Speedy Listing
                                                            </span>
                                                            <span className="text-xs font-bold text-violet-800">
                                                                {getListingStudioCredits(tenant).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </Tooltip>
                                                </div>

                                                {/* Row 2: Orders/Day, Accounts, Platform */}
                                                {/* <div className="flex gap-2">
                                                    <div className="flex-1 flex flex-col justify-center bg-slate-50 border border-slate-200/70 rounded-xl p-2">
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                                            <ShoppingBag size={10} className="text-slate-400" /> Orders / Day
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {(tenant.tenantId?.perDayOrder || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 flex flex-col justify-center bg-slate-50 border border-slate-200/70 rounded-xl p-2">
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                                            <Building2 size={10} className="text-slate-400" /> Accounts
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {tenant.tenantId?.numberOfAccount || 0}
                                                        </span>
                                                    </div>
                                                    {tenant.tenantId?.platform && (
                                                        <div className="flex-1 flex flex-col justify-center bg-slate-50 border border-slate-200/70 rounded-xl p-2">
                                                            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                                                <Store size={10} className="text-slate-400" /> Platform
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-700 truncate" title={tenant.tenantId.platform}>
                                                                {tenant.tenantId.platform}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div> */}
                                            </div>

                                            <button
                                                onClick={() => handleViewDashboard(tenant.tenantId?._id, formatTenantLabel(tenant), tenant.fullName, tenant.email)}
                                                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 bg-[#eef5fd] text-[#1c64c7] hover:bg-[#e0edf8] active:scale-[0.98]"
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
                        <div className="space-y-3" style={{ userSelect: isDragging ? 'none' : 'auto' }}>
                            {(user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.manageRM)) && isEditMode && (
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-medium text-brand-600 ml-1">
                                        Edit Mode: click an RM dropdown to reassign, or drag the handle down to fill multiple rows.
                                    </div>
                                </div>
                            )}
                            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-100/60">
                                                <SortableHeader label="Organization" columnKey="tenantName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                                <SortableHeader label="Admin" columnKey="adminName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                                <SortableHeader label="RM" columnKey="rmName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                                <SortableHeader label="Email" columnKey="email" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                                <SortableHeader label="Status" columnKey="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-center" />
                                                <SortableHeader label="Credits" columnKey="balance" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-right" />
                                                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Speedy Listing</th>
                                                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sortedTenants.map((tenant, rowIndex) => {
                                                const isInactive = tenant.tenantId?.status === 'inactive';
                                                const isApproved = tenant.tenantId?.isApproved ?? true;

                                                let status = { label: 'Active', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' };
                                                if (isInactive) status = { label: 'Inactive', dotColor: 'bg-rose-500', bgColor: 'bg-rose-50', textColor: 'text-rose-600' };
                                                else if (!isApproved) status = { label: 'Pending', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-600' };

                                                const tName = formatTenantLabel(tenant);
                                                const avatarLetter = getTenantCompanyName(tenant).charAt(0).toUpperCase();

                                                const canToggle = (user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.suspendTenant)) && isApproved;
                                                const lowBal = getDisplayCredits(tenant) < lowBalanceThreshold;
                                                const avatarColor = getAvatarColor(tName);
                                                const rmId = tenant.tenantId?.assignedToRM?._id || '';
                                                const rmName = toTitleCase(tenant.tenantId?.assignedToRM?.fullName) || '';
                                                const inPreview = dragPreview.includes(rowIndex);
                                                const isDragSource = dragStart?.rowIndex === rowIndex;

                                                return (
                                                    <tr
                                                        key={tenant._id}
                                                        onClick={() => { if (isApproved && !isEditMode) handleViewDashboard(tenant.tenantId?._id, formatTenantLabel(tenant), tenant.fullName, tenant.email); }}
                                                        className={`group transition-colors cursor-pointer ${lowBal ? 'bg-[#FFFBEB] hover:bg-[#FFF4D6]' : 'hover:bg-slate-50/50'}`}
                                                    >
                                                        {/* Organization */}
                                                        <td className="py-4 px-6 max-w-[220px]">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-lg ${avatarColor.bg} flex items-center justify-center ${avatarColor.text} font-semibold text-sm flex-shrink-0`}>
                                                                    {avatarLetter}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-[14px] font-bold text-slate-800 truncate">{tName}</p>
                                                                    <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                                                                        {(() => {
                                                                            const approvedDate = tenant.tenantId?.approvedAt || tenant.tenantId?.createdAt || tenant.createdAt;
                                                                            return approvedDate
                                                                                ? `Approved ${new Date(approvedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                                                                                : 'Approval date unavailable';
                                                                        })()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Admin */}
                                                        <td className="py-4 px-6 max-w-[160px]">
                                                            <div className="flex items-center gap-2">
                                                                <User size={14} className="text-slate-400 flex-shrink-0" />
                                                                <span className="text-sm text-slate-700 truncate">{toTitleCase(tenant.fullName) || 'Unassigned'}</span>
                                                            </div>
                                                        </td>

                                                        {/* RM */}
                                                        <td
                                                            className={`py-4 px-6 relative ${isEditMode ? 'cursor-crosshair' : ''} ${inPreview && !isDragSource ? 'bg-brand-50 ring-1 ring-inset ring-brand-300' : ''} ${isDragSource ? 'bg-brand-100/50' : ''}`}
                                                            onMouseEnter={() => isEditMode && enterCell(rowIndex)}
                                                        >
                                                            {isEditMode ? (
                                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                    <User size={14} className="text-slate-400 flex-shrink-0" />
                                                                    <select
                                                                        value={rmId}
                                                                        onChange={(e) => handleAssignRMForTenant(tenant.tenantId?._id, e.target.value)}
                                                                        className="text-sm text-slate-700 bg-white border border-slate-200 rounded-md px-2 py-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-brand-400"
                                                                    >
                                                                        <option value="">Unassigned</option>
                                                                        {allRMs.map(rm => (
                                                                            <option key={rm._id} value={rm._id}>{toTitleCase(rm.fullName)}</option>
                                                                        ))}
                                                                    </select>
                                                                    {/* Fill handle — drag downward to bulk-assign this RM to following rows */}
                                                                    <button
                                                                        type="button"
                                                                        onMouseDown={(e) => startDrag(e, rowIndex, { rmId: rmId || null, rmName: rmName || null })}
                                                                        title="Drag down to fill"
                                                                        className="w-3 h-3 bg-brand-600 hover:bg-brand-700 rounded-sm cursor-crosshair flex-shrink-0"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <User size={14} className="text-slate-400 flex-shrink-0" />
                                                                    <span className="text-sm text-slate-700 truncate">{rmName || 'Unassigned'}</span>
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Email */}
                                                        <td className="py-4 px-6 max-w-[200px]">
                                                            <div className="flex items-center gap-2">
                                                                <Mail size={14} className="text-slate-400 flex-shrink-0" />
                                                                <span className="text-sm text-slate-500 truncate">{tenant.email || '—'}</span>
                                                            </div>
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
                                                                        {getDisplayCredits(tenant).toLocaleString()}
                                                                        <AlertTriangle size={12} className="text-amber-500" />
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[14px] font-bold text-slate-800">
                                                                        {getDisplayCredits(tenant).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="py-4 px-6 text-right">
                                                            <Tooltip content={<ListingStudioPlansTooltip plans={getListingStudioPlans(tenant)} />}>
                                                                <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-violet-700 justify-end w-full cursor-default">
                                                                    <PackageOpen size={14} className="text-violet-500" />
                                                                    {getListingStudioCredits(tenant).toLocaleString()}
                                                                </span>
                                                            </Tooltip>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                                                            {isApproved && (
                                                                <ActionMenu
                                                                    variant="row"
                                                                    isInactive={isInactive}
                                                                    onGift={(user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.giftCredits)) ? () => handleOpenGiftModal(tenant) : null}
                                                                    onDeduct={(user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.deductCredits)) ? () => handleOpenDeductModal(tenant) : null}
                                                            onRates={user?.role === 'SuperAdmin' ? () => handleOpenRatesModal(tenant) : null}
                                                                    onEdit={canEditTenantDetails ? () => handleOpenRenameModal(tenant) : null}
                                                                    onAssignRM={canEditTenantDetails ? () => handleOpenAssignRmModal(tenant) : null}
                                                                    onViewReason={isInactive ? () => setViewReasonTenant(tenant) : null}
                                                                    onToggleStatus={canToggle ? () => handleToggleStatus(tenant.tenantId?._id, tenant.tenantId?.status) : null}
                                                                />
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && totalPages > 1 && (
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
                                        className={`w-9 h-9 text-sm font-medium rounded-lg transition-all ${p === page
                                            ? 'bg-brand-600 text-white shadow-sm'
                                            : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setPage(Math.min(totalPages, startPage + maxVisiblePages))}
                                disabled={startPage + maxVisiblePages > totalPages}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                            >
                                Last <ChevronsRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {selectedTenant && (
                <GiftCreditsModal
                    isOpen={isGiftModalOpen}
                    onClose={() => setIsGiftModalOpen(false)}
                    tenant={selectedTenant}
                    onSuccess={() => fetchTenants(page, debouncedSearchTerm, activeFilter, selectedRM, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold)}
                />
            )}

            {selectedTenant && (
                <TenantRatesModal
                    isOpen={isRatesModalOpen}
                    onClose={() => setIsRatesModalOpen(false)}
                    tenant={selectedTenant}
                />
            )}

            {selectedTenant && (
                <DeductCreditsModal
                    isOpen={isDeductModalOpen}
                    onClose={() => setIsDeductModalOpen(false)}
                    tenant={selectedTenant}
                    onSuccess={() => fetchTenants(page, debouncedSearchTerm, activeFilter, selectedRM, effectiveSortBy, effectiveSortOrder, lowBalanceThreshold)}
                />
            )}

            {isRenameModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
                    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Edit Tenant Details</h3>
                                <p className="text-sm text-slate-500">Update the tenant number, tenant ID, and company name for {formatTenantLabel(renameTenant) || 'this tenant'}.</p>
                            </div>
                            <button type="button" onClick={handleCloseRenameModal} className="p-2 text-slate-500 hover:text-slate-900 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {canEditTenantDetails && (
                                <>
                                    <label className="block text-sm font-medium text-slate-700">Tenant Number / ID</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={renameTenantNumericId}
                                        onChange={(e) => {
                                            setRenameTenantNumericId(e.target.value);
                                            if (renameError) setRenameError('');
                                        }}
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                                        placeholder="e.g. 328"
                                    />
                                    <p className="text-xs text-slate-500">Must be unique. Super Admin can set any non-negative tenant ID, and new tenants auto-receive the next ID after the highest assigned.</p>
                                </>
                            )}
                            <label className="block text-sm font-medium text-slate-700">Company name</label>
                            <input
                                autoFocus={!canEditTenantDetails}
                                value={renameTenantName}
                                onChange={(e) => {
                                    setRenameTenantName(e.target.value);
                                    if (renameError) setRenameError('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleRenameTenant();
                                    }
                                }}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                                placeholder="e.g. Asian paints"
                            />
                            {renameError && <p className="text-xs text-rose-600">{renameError}</p>}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 pb-6">
                            <button
                                type="button"
                                onClick={handleCloseRenameModal}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRenameTenant}
                                className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showRenameConfirm && (
                <ConfirmModal
                    isOpen={showRenameConfirm}
                    onClose={() => setShowRenameConfirm(false)}
                    onConfirm={executeRenameTenant}
                    title="Confirm Changes"
                    message="Are you sure you want to update this tenant's details?"
                    details={[
                        { label: 'Tenant', value: formatTenantLabel(renameTenant) },
                        ...(renameTenantName.trim() !== getTenantCompanyName(renameTenant) ? [{ label: 'Company Name', value: renameTenantName.trim() }] : []),
                        ...(renameTenantNumericId.trim() !== '' && Number(renameTenantNumericId.trim()) !== getTenantNumericId(renameTenant) ? [{ label: 'Tenant ID', value: renameTenantNumericId.trim() }] : []),
                    ]}
                    confirmText="Save Changes"
                />
            )}

            {/* Suspend Reason Modal */}
            {/* View Suspension Reason */}
            {viewReasonTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
                    <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                                    <AlertTriangle size={18} className="text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Suspended Reason</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">{formatTenantLabel(viewReasonTenant)}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewReasonTenant(null)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5">
                            {viewReasonTenant.tenantId?.suspensionReason ? (
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                    {viewReasonTenant.tenantId.suspensionReason}
                                </p>
                            ) : (
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    A reason was not recorded when this tenant was suspended.
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setViewReasonTenant(null)}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {reactivateTarget && (
                <ConfirmModal
                    isOpen={!!reactivateTarget}
                    onClose={() => setReactivateTarget(null)}
                    onConfirm={handleConfirmReactivate}
                    title="Reactivate Tenant"
                    message={`Are you sure you want to reactivate ${formatTenantLabel(reactivateTarget)}?`}
                    confirmText="Reactivate"
                />
            )}

            {suspendTargetTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                                    <AlertTriangle size={18} className="text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Suspend Tenant</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">{formatTenantLabel(suspendTargetTenant)}</p>
                                </div>
                            </div>
                            <button onClick={() => setSuspendTargetTenant(null)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Reason for suspension <span className="text-red-500">*</span></label>
                                <textarea
                                    value={suspendReason}
                                    onChange={(e) => setSuspendReason(e.target.value)}
                                    placeholder="Please provide a reason for suspending this tenant..."
                                    rows={3}
                                    maxLength={1000}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none resize-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-slate-400"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setSuspendTargetTenant(null)}
                                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSuspend}
                                disabled={!suspendReason.trim() || suspending}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl hover:from-amber-600 hover:to-amber-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                            >
                                {suspending ? 'Suspending...' : 'Confirm Suspend'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Assign RM Modal */}
            {assignRmTargetTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                                    <UserPlus size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Assign Relationship Manager</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">{formatTenantLabel(assignRmTargetTenant)}</p>
                                </div>
                            </div>
                            <button onClick={() => setAssignRmTargetTenant(null)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Tenant details summary inside modal */}
                            <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <ShoppingBag size={11} className="text-brand-500" /> Orders / Day
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 mt-0.5">
                                        {(assignRmTargetTenant.tenantId?.perDayOrder ?? assignRmTargetTenant.perDayOrder ?? 0).toLocaleString()} orders
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <Building2 size={11} className="text-brand-500" /> Accounts
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 mt-0.5">
                                        {assignRmTargetTenant.tenantId?.numberOfAccount ?? assignRmTargetTenant.numberOfAccount ?? 0} accounts
                                    </span>
                                </div>
                                {(assignRmTargetTenant.tenantId?.platform || assignRmTargetTenant.platform) && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <Store size={11} className="text-brand-500" /> Platform
                                        </span>
                                        <span className="text-xs font-bold text-slate-800 mt-0.5 truncate" title={assignRmTargetTenant.tenantId?.platform || assignRmTargetTenant.platform}>
                                            {assignRmTargetTenant.tenantId?.platform || assignRmTargetTenant.platform}
                                        </span>
                                    </div>
                                )}
                                {(assignRmTargetTenant.tenantId?.salesPersonName || assignRmTargetTenant.salesPersonName) && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <User size={11} className="text-brand-500" /> Sales Person
                                        </span>
                                        <span className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                            {assignRmTargetTenant.tenantId?.salesPersonName || assignRmTargetTenant.salesPersonName}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                    Select Manager
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedRmId}
                                        onChange={(e) => setSelectedRmId(e.target.value)}
                                        className="w-full appearance-none rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 font-medium outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
                                    >
                                        <option value="">Unassigned (No RM)</option>
                                        {allRMs.map((rm) => (
                                            <option key={rm._id} value={rm._id}>
                                                {toTitleCase(rm.fullName)} ({rm.email})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={18} className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                type="button"
                                onClick={() => setAssignRmTargetTenant(null)}
                                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAssignRmModal}
                                disabled={savingRm}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-700 rounded-xl hover:from-brand-700 hover:to-brand-800 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
                            >
                                {savingRm ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default SuperAdminTenants;
