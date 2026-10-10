import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserPen, Search, Plus, ShieldCheck, Mail, Phone, Settings, Trash2, Building, ChevronDown, Users, Shield, Eye, X, Copy, AlertTriangle, Check, ToggleLeft, ToggleRight, Calendar, ChevronLeft, ChevronRight, Clock, User, Gift, Minus, Download, XCircle, LifeBuoy } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import api from '../api';
import { useAuth } from '../AuthContext';

// Generate a consistent color from a string (user name/id)
const getAvatarColor = (str) => {
    const colors = [
        { bg: 'bg-brand-100', text: 'text-brand-700', ring: 'ring-brand-200' },
        { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200' },
        { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
        { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200' },
        { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-200' },
        { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200' },
        { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'ring-teal-200' },
        { bg: 'bg-cyan-100', text: 'text-cyan-700', ring: 'ring-cyan-200' },
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// ─── Future-only single date picker ───
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const ExpiryDatePicker = ({ value, onChange }) => {
    const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
    const initial = value ? new Date(value) : (() => { const d = new Date(); d.setMonth(d.getMonth()+1); return d; })();
    const [viewYear, setViewYear] = useState(initial.getFullYear());
    const [viewMonth, setViewMonth] = useState(initial.getMonth());
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = value ? new Date(value) : null;

    const calDays = useMemo(() => {
        const first = new Date(viewYear, viewMonth, 1);
        const last = new Date(viewYear, viewMonth + 1, 0);
        const pad = first.getDay();
        const days = [];
        const prevLast = new Date(viewYear, viewMonth, 0).getDate();
        for (let i = pad - 1; i >= 0; i--) days.push({ date: new Date(viewYear, viewMonth - 1, prevLast - i), cur: false });
        for (let d = 1; d <= last.getDate(); d++) days.push({ date: new Date(viewYear, viewMonth, d), cur: true });
        while (days.length < 35) days.push({ date: new Date(viewYear, viewMonth + 1, days.length - pad - last.getDate() + 1), cur: false });
        return days;
    }, [viewYear, viewMonth]);

    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const displayFmt = (d) => `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}, ${d.getFullYear()}`;

    const prevMonth = () => { if (viewMonth === 0) { setViewYear(y=>y-1); setViewMonth(11); } else setViewMonth(m=>m-1); };
    const nextMonth = () => { if (viewMonth === 11) { setViewYear(y=>y+1); setViewMonth(0); } else setViewMonth(m=>m+1); };
    const isPast = (d) => d < today;
    const isSelected = (d) => selected && fmt(d) === fmt(selected);

    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-left hover:border-brand-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className={selected ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                    {selected ? displayFmt(selected) : 'Select expiry date'}
                </span>
            </button>
            {open && (
                <div className="absolute z-50 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-sm font-bold text-slate-800">{MONTHS[viewMonth]} {viewYear}</span>
                        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAYS_SHORT.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
                    </div>
                    {/* Days */}
                    <div className="grid grid-cols-7 gap-y-0.5">
                        {calDays.map(({ date, cur }, i) => {
                            const past = isPast(date);
                            const sel = isSelected(date);
                            return (
                                <button key={i} type="button"
                                    disabled={past}
                                    onClick={() => { onChange(fmt(date)); setOpen(false); }}
                                    className={`h-8 w-8 mx-auto rounded-lg text-xs font-medium transition-all duration-150
                                        ${!cur ? 'text-slate-300' : ''}
                                        ${past ? 'opacity-30 cursor-not-allowed' : 'hover:bg-brand-50 hover:text-brand-700 cursor-pointer'}
                                        ${sel ? '!bg-brand-500 !text-white font-bold shadow-sm' : ''}
                                        ${cur && !past && !sel ? 'text-slate-700' : ''}
                                    `}
                                >{date.getDate()}</button>
                            );
                        })}
                    </div>
                    {/* Clear */}
                    {selected && (
                        <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                            className="mt-3 w-full text-xs text-slate-500 hover:text-red-500 transition-colors text-center">
                            Remove expiry date
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// Skeleton row for loading state
const SkeletonRow = () => (
    <tr className="animate-pulse">
        <td className="py-4 px-5">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200"></div>
                <div className="space-y-2">
                    <div className="h-3.5 w-24 bg-slate-200 rounded-md"></div>
                    <div className="h-2.5 w-20 bg-slate-100 rounded-md"></div>
                </div>
            </div>
        </td>
        <td className="py-4 px-5">
            <div className="space-y-2">
                <div className="h-3 w-32 bg-slate-200 rounded-md"></div>
                <div className="h-3 w-24 bg-slate-100 rounded-md"></div>
            </div>
        </td>
        <td className="py-4 px-5"><div className="h-6 w-16 bg-slate-200 rounded-lg"></div></td>
        <td className="py-4 px-5"><div className="h-5 w-20 bg-slate-200 rounded-md"></div></td>
        <td className="py-4 px-5 text-right"><div className="h-8 w-20 bg-slate-100 rounded-lg ml-auto"></div></td>
    </tr>
);

const SBMRMManagement = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(user?.role === 'SuperAdmin' ? 'SBM' : 'RM');
    const [users, setUsers] = useState({ sbmUsers: [], rmUsers: [] });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [selectedTargetRM, setSelectedTargetRM] = useState('');
    const [transferring, setTransferring] = useState(false);
    const [createdUserCredentials, setCreatedUserCredentials] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [unassignedTenants, setUnassignedTenants] = useState([]);
    const [assignSearch, setAssignSearch] = useState('');
    const [selectedTenantIds, setSelectedTenantIds] = useState(new Set());
    const [bulkAssigning, setBulkAssigning] = useState(false);
    const [copiedCredentials, setCopiedCredentials] = useState(false);
    const [visibleTenantCount, setVisibleTenantCount] = useState(30);
    const TENANTS_PAGE_SIZE = 30;
    const tenantPermsBackup = useRef({ giftCredits: true, deductCredits: true, suspendTenant: true, deleteUpload: true, deactivateMarketplace: true });
    
    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        mobileNumber: '',
        password: '',
        role: 'RM',
        approveTenants: true,
        approveSubscriptions: true,
        rejectRegistrations: true,
        viewTenants: false,
        viewPricing: true,
        manageRM: true,
            giftCredits: true,
            deductCredits: true,
            suspendTenant: true,
            deleteUpload: true,
            deactivateMarketplace: true,
            manageInvoices: true,
            exportInvoices: false,
            viewSupport: true,
        hasExpiry: false,
        expiresAt: '',
    });

    useEffect(() => {
        fetchUsers();
    }, [activeTab]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/auth/admin-users?role=${activeTab}`);
            setUsers(res.data);
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnassignedTenants = async () => {
        try {
            const res = await api.get('/auth/tenants/unassigned');
            setUnassignedTenants(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch unassigned tenants', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                fullName: formData.fullName,
                email: formData.email,
                mobileNumber: formData.mobileNumber,
                role: formData.role,
            };

            if (formData.password && formData.password.trim()) {
                payload.password = formData.password.trim();
            }

            if (formData.role === 'SBM') {
                payload.permissions = {
                    approveTenants: formData.approveTenants,
                    approveSubscriptions: formData.approveSubscriptions,
                    rejectRegistrations: formData.rejectRegistrations,
                    viewTenants: formData.viewTenants,
                    viewPricing: formData.viewPricing,
                    manageRM: formData.manageRM,
                    giftCredits: formData.viewTenants ? formData.giftCredits : false,
                    deductCredits: formData.viewTenants ? formData.deductCredits : false,
                    suspendTenant: formData.viewTenants ? formData.suspendTenant : false,
                    deleteUpload: formData.viewTenants ? formData.deleteUpload : false,
                    deactivateMarketplace: formData.viewTenants ? formData.deactivateMarketplace : false,
                    manageInvoices: formData.manageInvoices,
                    exportInvoices: formData.manageInvoices ? formData.exportInvoices : false,
                    viewSupport: formData.viewSupport,
                };
            }

            // Expiry
            payload.expiresAt = formData.hasExpiry && formData.expiresAt ? formData.expiresAt : null;

            if (selectedUser && selectedUser._id) {
                await api.put(`/auth/admin-users/${selectedUser._id}`, payload);
                toast.success(`${payload.role} updated successfully`);
                setIsAddModalOpen(false);
            } else {
                const res = await api.post('/auth/admin-users', payload);
                toast.success(`${payload.role} created successfully`);
                
                setCreatedUserCredentials({
                    fullName: payload.fullName,
                    email: payload.email,
                    role: payload.role,
                    password: res.data.password || formData.password
                });
                setIsAddModalOpen(false);
            }
            
            fetchUsers();
            resetForm();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        }
    };

    const handleDeactivate = async (id, role) => {
        if (!window.confirm(`Are you sure you want to deactivate this ${role}?`)) return;
        try {
            await api.delete(`/auth/admin-users/${id}`);
            toast.success(`${role} deactivated successfully`);
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to deactivate');
        }
    };

    const handleStatusToggle = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            await api.put(`/auth/admin-users/${id}`, { status: newStatus });
            toast.success(`Status changed to ${newStatus}`);
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    const handleAssignTenant = async (tenantId) => {
        if (!selectedUser) return;
        try {
            await api.post('/auth/tenants/bulk-assign', { rmId: selectedUser._id, tenantIds: [tenantId] });
            toast.success('Tenant assigned successfully');
            fetchUnassignedTenants();
            fetchUsers();
            
            const updatedUser = { ...selectedUser };
            const assigned = unassignedTenants.find(t => t._id === tenantId);
            updatedUser.assignedTenantIds.push({ _id: tenantId, name: assigned?.name, tenantId: assigned?.tenantId });
            setSelectedUser(updatedUser);
            setSelectedTenantIds(prev => { const s = new Set(prev); s.delete(tenantId); return s; });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign tenant');
        }
    };

    const handleBulkAssign = async () => {
        if (!selectedUser || selectedTenantIds.size === 0) return;
        setBulkAssigning(true);
        try {
            await api.post('/auth/tenants/bulk-assign', {
                rmId: selectedUser._id,
                tenantIds: Array.from(selectedTenantIds),
            });
            toast.success(`${selectedTenantIds.size} tenant(s) assigned successfully`);
            const justAssigned = unassignedTenants.filter(t => selectedTenantIds.has(t._id));
            const updatedUser = { ...selectedUser };
            updatedUser.assignedTenantIds = [
                ...updatedUser.assignedTenantIds,
                ...justAssigned.map(t => ({ _id: t._id, name: t.name }))
            ];
            setSelectedUser(updatedUser);
            setSelectedTenantIds(new Set());
            fetchUnassignedTenants();
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to bulk assign');
        } finally {
            setBulkAssigning(false);
        }
    };

    const handleUnassignTenant = async (tenantId) => {
        try {
            await api.post('/auth/tenants/bulk-unassign', { tenantIds: [tenantId] });
            toast.success('Tenant unassigned successfully');
            fetchUnassignedTenants();
            fetchUsers();
            
            const updatedUser = { ...selectedUser };
            updatedUser.assignedTenantIds = updatedUser.assignedTenantIds.filter(t => t._id !== tenantId);
            setSelectedUser(updatedUser);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to unassign tenant');
        }
    };

    const openCreateModal = () => {
        resetForm();
        formData.role = activeTab;
        setIsAddModalOpen(true);
    };

    const openEditModal = (u) => {
        setSelectedUser(u);
        const expiry = u.expiresAt ? u.expiresAt.slice(0, 10) : '';
        setFormData({
            fullName: u.fullName,
            email: u.email,
            mobileNumber: u.mobileNumber || '',
            password: '',
            role: u.role,
            approveTenants: u.permissions?.approveTenants || false,
            approveSubscriptions: u.permissions?.approveSubscriptions || false,
            rejectRegistrations: u.permissions?.rejectRegistrations || false,
            viewTenants: u.permissions?.viewTenants || false,
            viewPricing: u.permissions?.viewPricing || false,
            manageRM: u.permissions?.manageRM || false,
            giftCredits: u.permissions?.giftCredits || false,
            deductCredits: u.permissions?.deductCredits || false,
            suspendTenant: u.permissions?.suspendTenant || false,
            deleteUpload: u.permissions?.deleteUpload || false,
            deactivateMarketplace: u.permissions?.deactivateMarketplace || false,
            manageInvoices: u.permissions?.manageInvoices || false,
            exportInvoices: u.permissions?.exportInvoices || false,
            viewSupport: u.permissions?.viewSupport !== undefined ? u.permissions.viewSupport : true,
            hasExpiry: !!expiry,
            expiresAt: expiry,
        });
        setIsAddModalOpen(true);
    };

    const openAssignModal = (u) => {
        setSelectedUser(u);
        setAssignSearch('');
        setSelectedTenantIds(new Set());
        fetchUnassignedTenants();
        setIsAssignModalOpen(true);
    };

    const openTransferModal = (u) => {
        setSelectedUser(u);
        setSelectedTargetRM('');
        setIsTransferModalOpen(true);
    };

    const handleTransferPortfolio = async () => {
        if (!selectedUser || !selectedTargetRM) return;
        setTransferring(true);
        try {
            const res = await api.post('/auth/rm/transfer', {
                fromRMId: selectedUser._id,
                toRMId: selectedTargetRM,
            });
            toast.success(res.data.message || 'Portfolio transferred successfully');
            fetchUsers();
            setIsTransferModalOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to transfer portfolio');
        } finally {
            setTransferring(false);
        }
    };

    const resetForm = () => {
        setSelectedUser(null);
        setFormData({
            fullName: '', email: '', mobileNumber: '', password: '', role: activeTab,
            approveTenants: true, approveSubscriptions: true,
            rejectRegistrations: true, viewTenants: false, viewPricing: true, manageRM: true,
            giftCredits: true, deductCredits: true, suspendTenant: true, deleteUpload: true, deactivateMarketplace: true,
            exportInvoices: false, viewSupport: true,
            hasExpiry: false, expiresAt: '',
        });
        tenantPermsBackup.current = { giftCredits: true, deductCredits: true, suspendTenant: true, deleteUpload: true, deactivateMarketplace: true };
    };

    const currentList = activeTab === 'SBM' ? users.sbmUsers : users.rmUsers;
    const filteredList = currentList?.filter(u => 
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    // Stats
    const totalActive = currentList?.filter(u => u.status === 'active').length || 0;
    const totalInactive = currentList?.filter(u => u.status === 'inactive').length || 0;
    const totalCount = currentList?.length || 0;

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 overflow-y-auto h-full custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* ═══════════════ HERO HEADER ═══════════════ */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-blue-800 rounded-2xl p-7 text-white shadow-lg">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                        <Users size={20} className="text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold tracking-tight">Role Management</h1>
                                </div>
                            </div>
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 text-sm font-semibold rounded-xl hover:bg-white/90 active:scale-95 transition-all duration-200 shadow-md shrink-0"
                            >
                                <Plus className="w-4 h-4" />
                                Add {activeTab}
                            </button>
                        </div>
                    </div>

                    {/* ═══════════════ STATS ROW ═══════════════ */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Total */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                                    <Users size={18} />
                                </div>
                                <span className="text-[13px] font-medium text-slate-500">Total {activeTab}s</span>
                            </div>
                            <p className="text-3xl font-bold text-slate-800">{totalCount}</p>
                        </div>

                        {/* Active */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                    <Check size={18} />
                                </div>
                                <span className="text-[13px] font-medium text-slate-500">Active</span>
                            </div>
                            <p className="text-3xl font-bold text-slate-800">{totalActive}</p>
                        </div>

                        {/* Inactive */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-2 bg-red-50 rounded-lg text-red-500">
                                    <AlertTriangle size={18} />
                                </div>
                                <span className="text-[13px] font-medium text-slate-500">Inactive</span>
                            </div>
                            <p className="text-3xl font-bold text-slate-800">{totalInactive}</p>
                        </div>
                    </div>

                    {/* ═══════════════ MAIN TABLE CARD ═══════════════ */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">

                        {/* Toolbar — tabs + search */}
                        <div className="px-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                            <div className="flex items-center">
                                {user?.role === 'SuperAdmin' && (
                                    <button
                                        onClick={() => setActiveTab('SBM')}
                                        className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${
                                            activeTab === 'SBM'
                                                ? 'border-brand-600 text-brand-600'
                                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <Shield className="w-4 h-4" />
                                        Senior Business Managers
                                        {users.sbmUsers?.length > 0 && (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === 'SBM' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {users.sbmUsers.length}
                                            </span>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveTab('RM')}
                                    className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${
                                        activeTab === 'RM'
                                            ? 'border-brand-600 text-brand-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    <UserPen className="w-4 h-4" />
                                    Relationship Managers
                                    {users.rmUsers?.length > 0 && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === 'RM' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {users.rmUsers.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative w-full sm:max-w-xs py-3">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder={`Search ${activeTab}s...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white transition-all duration-200"
                                />
                            </div>
                        </div>

                        {/* Table Content */}
                        <div className="overflow-x-auto">
                            {loading ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/70">
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">User Info</th>
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contact</th>
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{activeTab === 'SBM' ? 'Permissions' : 'Assigned Tenants'}</th>
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
                                    </tbody>
                                </table>
                            ) : filteredList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
                                    <div className="p-4 bg-slate-100 rounded-2xl">
                                        <UserPen className="w-10 h-10 text-slate-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-slate-700">No {activeTab}s found</p>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {searchTerm ? 'Try adjusting your search term' : `Click "Add ${activeTab}" above to create one`}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/70">
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">User Info</th>
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contact</th>
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                            {activeTab === 'SBM' && <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Permissions</th>}
                                            {activeTab === 'RM' && <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned Tenants</th>}
                                            <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredList.map((u, index) => {
                                            const avatarColor = getAvatarColor(u._id || u.fullName);
                                            return (
                                                <tr
                                                    key={u._id}
                                                    className="group hover:bg-slate-50/80 transition-colors duration-150"
                                                >
                                                    {/* User Info */}
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3.5">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${!u.profilePicture ? `${avatarColor.bg} ${avatarColor.text} ring-1 ${avatarColor.ring}` : ''}`}>
                                                                {u.profilePicture ? (
                                                                    <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                                                                ) : u.fullName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-slate-800 truncate">{u.fullName}</div>
                                                                <div className="text-xs text-slate-400 mt-0.5">
                                                                    Added {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Contact */}
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center gap-2 text-slate-600">
                                                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                <span className="truncate max-w-[180px] text-sm">{u.email}</span>
                                                            </div>
                                                            {u.mobileNumber && (
                                                                <div className="flex items-center gap-2 text-slate-500">
                                                                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                    <span className="text-sm">{u.mobileNumber}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                                                                u.status === 'inactive'
                                                                    ? 'bg-red-50 text-red-600 border-red-200'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.status === 'inactive' ? 'bg-red-400' : 'bg-emerald-500 animate-pulse'}`}></span>
                                                                {u.status === 'inactive' ? 'Inactive' : 'Active'}
                                                            </span>
                                                            {u.expiresAt && (
                                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                                                                    new Date(u.expiresAt) < new Date()
                                                                        ? 'bg-red-50 text-red-500 border-red-200'
                                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                }`}>
                                                                    <Clock className="w-3 h-3 shrink-0" />
                                                                    {new Date(u.expiresAt) < new Date() ? 'Expired' : `Expires ${new Date(u.expiresAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Permissions (SBM) */}
                                                    {activeTab === 'SBM' && (
                                                        <td className="py-4 px-6">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {u.permissions?.approveTenants && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-[11px] font-semibold">
                                                                        <Building className="w-3 h-3" />
                                                                        Tenants
                                                                    </span>
                                                                )}
                                                                {u.permissions?.approveSubscriptions && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold">
                                                                        <Shield className="w-3 h-3" />
                                                                        Subscriptions
                                                                    </span>
                                                                )}
                                                                {u.permissions?.rejectRegistrations && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-semibold">
                                                                        <X className="w-3 h-3" />
                                                                        Reject
                                                                    </span>
                                                                )}
                                                                {u.permissions?.viewTenants && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg text-[11px] font-semibold">
                                                                        <Eye className="w-3 h-3" />
                                                                        View Tenants
                                                                    </span>
                                                                )}
                                                                {u.permissions?.viewPricing && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-semibold">
                                                                        <Eye className="w-3 h-3" />
                                                                        Pricing
                                                                    </span>
                                                                )}
                                                                {u.permissions?.manageRM && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-[11px] font-semibold">
                                                                        <User className="w-3 h-3" />
                                                                        Manage RM
                                                                    </span>
                                                                )}
                                                                {u.permissions?.giftCredits && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-[11px] font-semibold">
                                                                        <Gift className="w-3 h-3" />
                                                                        Gift Credits
                                                                    </span>
                                                                )}
                                                                {u.permissions?.suspendTenant && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-semibold">
                                                                        <ShieldCheck className="w-3 h-3" />
                                                                        Suspend
                                                                    </span>
                                                                )}
                                                                {u.permissions?.deductCredits && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold">
                                                                        <Minus className="w-3 h-3" />
                                                                        Deduct Credits
                                                                    </span>
                                                                )}
                                                                {u.permissions?.deleteUpload && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-semibold">
                                                                        <Trash2 className="w-3 h-3" />
                                                                        Delete Uploads
                                                                    </span>
                                                                )}
                                                                {u.permissions?.exportInvoices && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-semibold">
                                                                        <Download className="w-3 h-3" />
                                                                        Export Invoices
                                                                    </span>
                                                                )}
                                                                {u.permissions?.deactivateMarketplace && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold">
                                                                        <XCircle className="w-3 h-3" />
                                                                        Deactivate Marketplace
                                                                    </span>
                                                                )}
                                                                {u.permissions?.viewSupport !== false && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold">
                                                                        <LifeBuoy className="w-3 h-3" />
                                                                        Support
                                                                    </span>
                                                                )}
                                                                {!u.permissions?.approveTenants && !u.permissions?.approveSubscriptions && !u.permissions?.rejectRegistrations && !u.permissions?.viewTenants && !u.permissions?.viewPricing && !u.permissions?.manageRM && !u.permissions?.giftCredits && !u.permissions?.deductCredits && !u.permissions?.suspendTenant && !u.permissions?.deleteUpload && !u.permissions?.exportInvoices && !u.permissions?.deactivateMarketplace && u.permissions?.viewSupport === false && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg text-[11px] font-medium">
                                                                        <Eye className="w-3 h-3" />
                                                                        View Only
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* Assigned Tenants (RM) */}
                                                    {activeTab === 'RM' && (
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="flex items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100">
                                                                    <Building className="w-3.5 h-3.5 text-brand-500" />
                                                                    <span className="font-bold text-brand-700 text-sm">{u.assignedTenantIds?.length || 0}</span>
                                                                    <span className="text-xs text-brand-400">tenants</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => openAssignModal(u)}
                                                                    className="text-xs text-slate-500 hover:text-brand-600 font-medium bg-slate-50 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-200 hover:border-brand-200"
                                                                >
                                                                    Manage
                                                                </button>
                                                                {u.assignedTenantIds?.length > 0 && (
                                                                    <button
                                                                        onClick={() => openTransferModal(u)}
                                                                        className="text-xs text-slate-500 hover:text-indigo-600 font-medium bg-slate-50 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-200 hover:border-indigo-200"
                                                                    >
                                                                        Transfer
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* Actions */}
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => openEditModal(u)}
                                                                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all duration-200"
                                                                title="Edit"
                                                            >
                                                                <Settings className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeactivate(u._id, u.role)}
                                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                                                                title="Deactivate"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer */}
                        {!loading && filteredList.length > 0 && (
                            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <p className="text-xs text-slate-500">
                                    Showing <span className="font-semibold text-slate-700">{filteredList.length}</span> of <span className="font-semibold text-slate-700">{totalCount}</span> {activeTab}s
                                </p>
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-brand-600 font-semibold bg-brand-50 border border-brand-100 px-3 py-1 rounded-full">
                                    {activeTab === 'SBM' ? <><Shield className="w-3 h-3" /> Senior Business Managers</> : <><UserPen className="w-3 h-3" /> Relationship Managers</>}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Add/Edit Modal ─── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-zoomIn ring-1 ring-slate-200/50">
                        
                        {/* Modal Header */}
                        <div className="relative p-6 border-b border-slate-100">
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-50/50 to-violet-50/30"></div>
                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedUser ? 'bg-amber-100 text-amber-600' : 'bg-brand-100 text-brand-600'}`}>
                                        {selectedUser ? <Settings className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">
                                            {selectedUser ? `Edit ${formData.role}` : `Add New ${formData.role}`}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {selectedUser ? 'Update user details and permissions' : 'Create a new team member'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsAddModalOpen(false)} 
                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
                                {user?.role === 'SuperAdmin' && !selectedUser && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                                            Role
                                        </label>
                                        <select 
                                            value={formData.role}
                                            onChange={(e) => setFormData({...formData, role: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200 appearance-none cursor-pointer"
                                            disabled={!!selectedUser}
                                        >
                                            <option value="SBM">Senior Business Manager (SBM)</option>
                                            <option value="RM">Relationship Manager (RM)</option>
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                        <UserPen className="w-3.5 h-3.5 text-slate-400" />
                                        Full Name
                                    </label>
                                    <input 
                                        type="text" required
                                        placeholder="Enter full name"
                                        value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        Email Address
                                    </label>
                                    <input 
                                        type="email" required
                                        placeholder="user@company.com"
                                        value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        disabled={!!selectedUser}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                        Mobile Number 
                                        <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                                    </label>
                                    <input 
                                        type="tel"
                                        placeholder="+91 XXXXX XXXXX"
                                        value={formData.mobileNumber} onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200"
                                    />
                                </div>
                                {!selectedUser && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                            Password 
                                            <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                                        </label>
                                        <input 
                                            type="text"
                                            placeholder="Auto-generated if left blank"
                                            value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200 font-mono"
                                            minLength={8}
                                        />
                                    </div>
                                )}

                                {/* Account Status — edit mode only */}
                                {selectedUser && (
                                    <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-xl bg-slate-50/50">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedUser.status === 'active' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                                {selectedUser.status === 'active'
                                                    ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                                                    : <ToggleLeft className="w-4 h-4 text-red-500" />
                                                }
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">Account Status</div>
                                                <div className="text-xs text-slate-500">Currently <span className={`font-semibold ${selectedUser.status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>{selectedUser.status}</span></div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { handleStatusToggle(selectedUser._id, selectedUser.status); setIsAddModalOpen(false); }}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                                                selectedUser.status === 'active'
                                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                            }`}
                                        >
                                            {selectedUser.status === 'active' ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </div>
                                )}

                                {/* Account Expiry */}
                                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.hasExpiry ? 'bg-amber-100' : 'bg-slate-100'}`}>
                                                <Clock className={`w-4 h-4 ${formData.hasExpiry ? 'text-amber-600' : 'text-slate-400'}`} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">Account Expiry</div>
                                                <div className="text-xs text-slate-500">Auto-deactivate on a specific date</div>
                                            </div>
                                        </div>
                                        {/* Toggle switch */}
                                        <button
                                            type="button"
                                            onClick={() => setFormData(f => ({ ...f, hasExpiry: !f.hasExpiry, expiresAt: !f.hasExpiry ? f.expiresAt : '' }))}
                                            className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none ${formData.hasExpiry ? 'bg-amber-400' : 'bg-slate-200'}`}
                                            style={{ minWidth: '40px', height: '22px' }}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200 ${formData.hasExpiry ? 'translate-x-[18px]' : 'translate-x-0'}`}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                        </button>
                                    </div>
                                    {formData.hasExpiry && (
                                        <ExpiryDatePicker
                                            value={formData.expiresAt}
                                            onChange={(date) => setFormData(f => ({ ...f, expiresAt: date }))}
                                        />
                                    )}
                                </div>

                                {formData.role === 'SBM' && (
                                    <div className="pt-3 border-t border-slate-100 mt-5">
                                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-brand-500" />
                                            Permissions
                                        </h4>
                                        <div className="space-y-3">
                                            <label className={`flex items-center gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.approveTenants 
                                                    ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-200/50 shadow-sm' 
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.approveTenants}
                                                    onChange={(e) => setFormData({...formData, approveTenants: e.target.checked})}
                                                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Approve Tenants</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to view and approve pending organizations.</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.approveSubscriptions 
                                                    ? 'border-violet-300 bg-violet-50/50 ring-1 ring-violet-200/50 shadow-sm' 
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.approveSubscriptions}
                                                    onChange={(e) => setFormData({...formData, approveSubscriptions: e.target.checked})}
                                                    className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Approve Subscriptions</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to approve manual subscription payments.</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.rejectRegistrations 
                                                    ? 'border-red-300 bg-red-50/50 ring-1 ring-red-200/50 shadow-sm' 
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.rejectRegistrations}
                                                    onChange={(e) => setFormData({...formData, rejectRegistrations: e.target.checked})}
                                                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Reject Registrations</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to reject pending tenant registrations.</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.viewPricing 
                                                    ? 'border-amber-300 bg-amber-50/50 ring-1 ring-amber-200/50 shadow-sm' 
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.viewPricing}
                                                    onChange={(e) => setFormData({...formData, viewPricing: e.target.checked})}
                                                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">View Pricing</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to view and manage tenant pricing tiers.</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.viewTenants 
                                                    ? 'border-cyan-300 bg-cyan-50/50 ring-1 ring-cyan-200/50 shadow-sm' 
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.viewTenants}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        setFormData(prev => {
                                                            if (isChecked) {
                                                                return { ...prev, viewTenants: true, ...tenantPermsBackup.current };
                                                            }
                                                            tenantPermsBackup.current = {
                                                                giftCredits: prev.giftCredits,
                                                                deductCredits: prev.deductCredits,
                                                                suspendTenant: prev.suspendTenant,
                                                                deleteUpload: prev.deleteUpload,
                                                            };
                                                            return { ...prev, viewTenants: false };
                                                        });
                                                    }}
                                                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">View Tenants</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to view the Tenant Management directory.</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.manageRM 
                                                    ? 'border-teal-300 bg-teal-50/50 ring-1 ring-teal-200/50 shadow-sm' 
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.manageRM}
                                                    onChange={(e) => setFormData({...formData, manageRM: e.target.checked})}
                                                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Manage RMs</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to create and manage Relationship Managers.</div>
                                                </div>
                                            </label>
                                            <label 
                                                title={!formData.viewTenants ? "Please select 'View Tenants' permission first" : ""}
                                                className={`flex items-center gap-3.5 p-3.5 border rounded-xl transition-all duration-200 ${
                                                !formData.viewTenants
                                                    ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                                                    : formData.giftCredits 
                                                        ? 'border-violet-300 bg-violet-50/50 ring-1 ring-violet-200/50 shadow-sm cursor-pointer' 
                                                        : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.giftCredits}
                                                    onChange={(e) => setFormData({...formData, giftCredits: e.target.checked})}
                                                    disabled={!formData.viewTenants}
                                                    className={`w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500 ${!formData.viewTenants ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Gift Credits</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to gift credits to tenant accounts.</div>
                                                </div>
                                            </label>
                                            <label 
                                                title={!formData.viewTenants ? "Please select 'View Tenants' permission first" : ""}
                                                className={`flex items-center gap-3.5 p-3.5 border rounded-xl transition-all duration-200 ${
                                                !formData.viewTenants
                                                    ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                                                    : formData.suspendTenant 
                                                        ? 'border-amber-300 bg-amber-50/50 ring-1 ring-amber-200/50 shadow-sm cursor-pointer' 
                                                        : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.suspendTenant}
                                                    onChange={(e) => setFormData({...formData, suspendTenant: e.target.checked})}
                                                    disabled={!formData.viewTenants}
                                                    className={`w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 ${!formData.viewTenants ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Suspend / Activate Tenant</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to suspend or reactivate tenant accounts.</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.manageInvoices 
                                                    ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-200/50 shadow-sm' 
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.manageInvoices}
                                                    onChange={(e) => setFormData({...formData, manageInvoices: e.target.checked, exportInvoices: e.target.checked ? formData.exportInvoices : false})}
                                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Manage Invoices</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to view, create, and edit invoices.</div>
                                                </div>
                                            </label>
                                            <label
                                                title={!formData.manageInvoices ? "Please select 'Manage Invoices' permission first" : ""}
                                                className={`flex items-center gap-3.5 p-3.5 border rounded-xl transition-all duration-200 ${
                                                !formData.manageInvoices
                                                    ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                                                    : formData.exportInvoices
                                                        ? 'border-sky-300 bg-sky-50/50 ring-1 ring-sky-200/50 shadow-sm cursor-pointer'
                                                        : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                                            }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.exportInvoices}
                                                    onChange={(e) => setFormData({...formData, exportInvoices: e.target.checked})}
                                                    disabled={!formData.manageInvoices}
                                                    className={`w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 ${!formData.manageInvoices ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Export Invoices &amp; Credits</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to export invoices, free trial credits, and admin gifts as PDF/Excel.</div>
                                                </div>
                                            </label>
                                            <label
                                                title={!formData.viewTenants ? "Please select 'View Tenants' permission first" : ""}
                                                className={`flex items-center gap-3.5 p-3.5 border rounded-xl transition-all duration-200 ${
                                                !formData.viewTenants
                                                    ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                                                    : formData.deductCredits 
                                                        ? 'border-rose-300 bg-rose-50/50 ring-1 ring-rose-200/50 shadow-sm cursor-pointer' 
                                                        : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.deductCredits}
                                                    onChange={(e) => setFormData({...formData, deductCredits: e.target.checked})}
                                                    disabled={!formData.viewTenants}
                                                    className={`w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 ${!formData.viewTenants ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Deduct Credits</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to deduct credits from tenant accounts.</div>
                                                </div>
                                            </label>
                                            <label 
                                                title={!formData.viewTenants ? "Please select 'View Tenants' permission first" : ""}
                                                className={`flex items-center gap-3.5 p-3.5 border rounded-xl transition-all duration-200 ${
                                                !formData.viewTenants
                                                    ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                                                    : formData.deleteUpload 
                                                        ? 'border-red-300 bg-red-50/50 ring-1 ring-red-200/50 shadow-sm cursor-pointer' 
                                                        : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                                            }`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.deleteUpload}
                                                    onChange={(e) => setFormData({...formData, deleteUpload: e.target.checked})}
                                                    disabled={!formData.viewTenants}
                                                    className={`w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 ${!formData.viewTenants ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Delete Uploads</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to delete upload history entries.</div>
                                                </div>
                                            </label>
                                            <label
                                                title={!formData.viewTenants ? "Please select 'View Tenants' permission first" : ""}
                                                className={`flex items-center gap-3.5 p-3.5 border rounded-xl transition-all duration-200 ${
                                                !formData.viewTenants
                                                    ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                                                    : formData.deactivateMarketplace
                                                        ? 'border-purple-300 bg-purple-50/50 ring-1 ring-purple-200/50 shadow-sm cursor-pointer'
                                                        : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                                            }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.deactivateMarketplace}
                                                    onChange={(e) => setFormData({...formData, deactivateMarketplace: e.target.checked})}
                                                    disabled={!formData.viewTenants}
                                                    className={`w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 ${!formData.viewTenants ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">Deactivate Marketplace</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow SBM to deactivate marketplace accounts (reactivation is SuperAdmin-only).</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.viewSupport
                                                    ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200/50 shadow-sm'
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.viewSupport}
                                                    onChange={(e) => setFormData({...formData, viewSupport: e.target.checked})}
                                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">View Support Portal</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Allow this SBM to access and manage the support ticket portal.</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex justify-end gap-3 shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setIsAddModalOpen(false)} 
                                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                form="user-form" 
                                className="px-5 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold rounded-xl hover:from-brand-600 hover:to-brand-700 transition-all duration-200 shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/30"
                            >
                                {selectedUser ? 'Save Changes' : 'Create User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Transfer Portfolio Modal ─── */}
            {isTransferModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-zoomIn ring-1 ring-slate-200/50">
                        {/* Header */}
                        <div className="relative p-6 border-b border-slate-100">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-violet-50/30"></div>
                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Building className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Transfer Portfolio</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Transfer all {selectedUser.assignedTenantIds?.length} tenants
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsTransferModalOpen(false)} 
                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="text-sm text-slate-600">
                                Select a new Relationship Manager for the <span className="font-bold text-slate-800">{selectedUser.assignedTenantIds?.length}</span> tenants currently managed by <span className="font-bold text-slate-800">{selectedUser.fullName}</span>.
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                                    <User className="w-4 h-4 text-slate-400" />
                                    Transfer to RM
                                </label>
                                <select 
                                    value={selectedTargetRM}
                                    onChange={(e) => setSelectedTargetRM(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                                >
                                    <option value="" disabled>Select an RM</option>
                                    {(users.rmUsers || []).filter(u => u.role === 'RM' && u.status === 'active' && u._id !== selectedUser._id).map(u => (
                                        <option key={u._id} value={u._id}>{u.fullName} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex justify-end gap-3 shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setIsTransferModalOpen(false)} 
                                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={handleTransferPortfolio}
                                disabled={transferring || !selectedTargetRM}
                                className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {transferring ? 'Transferring...' : 'Confirm Transfer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Assign Tenants Modal ─── */}
            {isAssignModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-zoomIn ring-1 ring-slate-200/50">
                        
                        {/* Header */}
                        <div className="relative p-6 border-b border-slate-100">
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-50/50 to-indigo-50/30"></div>
                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                                        <Building className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Manage Assigned Tenants</h3>
                                        <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                                            RM: <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-xs">{selectedUser.fullName}</span>
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsAssignModalOpen(false)} 
                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Unified Search Input */}
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search by tenant number, name, admin name, or email..."
                                    value={assignSearch}
                                    onChange={(e) => { setAssignSearch(e.target.value); setVisibleTenantCount(TENANTS_PAGE_SIZE); }}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white transition-all shadow-sm"
                                />
                            </div>

                            {/* Currently Assigned Section */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Currently Assigned</h4>
                                    <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200/50">
                                        {selectedUser.assignedTenantIds?.length || 0}
                                    </span>
                                </div>
                                {(() => {
                                    const filteredAssigned = (selectedUser.assignedTenantIds || []).filter(t => {
                                        if (!assignSearch) return true;
                                        const q = assignSearch.toLowerCase();
                                        return (t.tenantId?.toString().includes(q)) ||
                                            (t.name && t.name.toLowerCase().includes(q)) ||
                                            (t.adminUserId?.fullName && t.adminUserId.fullName.toLowerCase().includes(q)) ||
                                            (t.adminUserId?.email && t.adminUserId.email.toLowerCase().includes(q));
                                    });

                                    if (selectedUser.assignedTenantIds?.length === 0) {
                                        return (
                                            <div className="p-5 bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl text-center">
                                                <Building className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                <p className="text-slate-500 text-sm font-medium">No tenants assigned to this RM yet.</p>
                                            </div>
                                        );
                                    }

                                    if (filteredAssigned.length === 0 && assignSearch) {
                                        return (
                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                                <p className="text-slate-500 text-sm font-medium">No assigned tenants match your search.</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {filteredAssigned.map(t => (
                                                <div key={t._id} className="flex flex-col p-3.5 border border-slate-200/80 rounded-xl bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                                <Building className="w-4 h-4 text-indigo-500" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-slate-800 text-sm truncate">{t.tenantId ? `${t.tenantId} - ` : ''}{t.name}</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleUnassignTenant(t._id)}
                                                            className="shrink-0 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="text-xs text-slate-600 ml-11">
                                                        <span className="font-medium text-slate-700">{t.perDayOrder || 0}</span> orders/day
                                                        <span className="mx-2">•</span>
                                                        <span className="font-medium text-slate-700">{t.numberOfAccount || 0}</span> accounts
                                                        {t.platform && (
                                                            <>
                                                                <span className="mx-2">•</span>
                                                                <span className="font-medium text-blue-600">{t.platform}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-widest">Available</span></div>
                            </div>

                            {/* Available to Assign */}
                            <div>
                                {/* Section header with search + select all */}
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                        Unassigned Tenants
                                        {unassignedTenants.length > 0 && (
                                            <span className="ml-2 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full normal-case tracking-normal">
                                                {unassignedTenants.length}
                                            </span>
                                        )}
                                    </h4>
                                    {(() => {
                                        const filtered = unassignedTenants.filter(t => {
                                            if (!assignSearch) return true;
                                            const q = assignSearch.toLowerCase();
                                            return (t.tenantId?.toString().includes(q)) ||
                                                (t.name && t.name.toLowerCase().includes(q)) ||
                                                (t.adminUserId?.fullName && t.adminUserId.fullName.toLowerCase().includes(q)) ||
                                                (t.adminUserId?.email && t.adminUserId.email.toLowerCase().includes(q));
                                        });
                                        const allFilteredSelected = filtered.length > 0 && filtered.every(t => selectedTenantIds.has(t._id));
                                        if (filtered.length === 0) return null;
                                        return (
                                            <button
                                                onClick={() => {
                                                    if (allFilteredSelected) {
                                                        setSelectedTenantIds(prev => {
                                                            const s = new Set(prev);
                                                            filtered.forEach(t => s.delete(t._id));
                                                            return s;
                                                        });
                                                    } else {
                                                        setSelectedTenantIds(prev => {
                                                            const s = new Set(prev);
                                                            filtered.forEach(t => s.add(t._id));
                                                            return s;
                                                        });
                                                    }
                                                }}
                                                className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1 rounded-lg transition-colors"
                                            >
                                                {allFilteredSelected ? 'Deselect All' : `Select All (${filtered.length})`}
                                            </button>
                                        );
                                    })()}
                                </div>

                                {unassignedTenants.length === 0 ? (
                                    <div className="p-5 bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl text-center">
                                        <Check className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                                        <p className="text-slate-500 text-sm font-medium">No unassigned active tenants available.</p>
                                    </div>
                                ) : (() => {
                                    const filtered = unassignedTenants.filter(t => {
                                        if (!assignSearch) return true;
                                        const q = assignSearch.toLowerCase();
                                        return (t.tenantId?.toString().includes(q)) ||
                                            (t.name && t.name.toLowerCase().includes(q)) ||
                                            (t.adminUserId?.fullName && t.adminUserId.fullName.toLowerCase().includes(q)) ||
                                            (t.adminUserId?.email && t.adminUserId.email.toLowerCase().includes(q));
                                    });
                                    if (filtered.length === 0) return (
                                        <div className="p-5 bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl text-center">
                                            <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                                            <p className="text-slate-500 text-sm font-medium">No tenants match your search.</p>
                                        </div>
                                    );
                                    const visible = filtered.slice(0, visibleTenantCount);
                                    const hasMore = filtered.length > visibleTenantCount;
                                    return (
                                        <>
                                            {/* Showing X of Y indicator */}
                                            {filtered.length > TENANTS_PAGE_SIZE && (
                                                <div className="text-xs text-slate-400 mb-2 font-medium">
                                                    Showing <span className="text-slate-600 font-semibold">{Math.min(visibleTenantCount, filtered.length)}</span> of <span className="text-slate-600 font-semibold">{filtered.length}</span> tenants
                                                    {assignSearch && ` matching "${assignSearch}"`}
                                                </div>
                                            )}
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                                {visible.map(t => {
                                                    const isChecked = selectedTenantIds.has(t._id);
                                                    return (
                                                        <div
                                                            key={t._id}
                                                            onClick={() => setSelectedTenantIds(prev => {
                                                                const s = new Set(prev);
                                                                isChecked ? s.delete(t._id) : s.add(t._id);
                                                                return s;
                                                            })}
                                                            className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-all duration-150 ${
                                                                isChecked
                                                                    ? 'border-brand-300 bg-brand-50/60 ring-1 ring-brand-200/50'
                                                                    : 'border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    readOnly
                                                                    className="w-4 h-4 rounded border-slate-300 text-brand-600 accent-brand-600 cursor-pointer shrink-0"
                                                                />
                                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                                    <Building className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-slate-800 text-sm">{t.tenantId ? `${t.tenantId} - ` : ''}{t.name}</div>
                                                                    <div className="text-xs text-slate-500 mt-1">
                                                                        <span className="font-medium text-slate-700">{t.perDayOrder || 0}</span> orders/day
                                                                        <span className="mx-2">•</span>
                                                                        <span className="font-medium text-slate-700">{t.numberOfAccount || 0}</span> accounts
                                                                        {t.platform && (
                                                                            <>
                                                                                <span className="mx-2">•</span>
                                                                                <span className="font-medium text-blue-600">{t.platform}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-slate-400 mt-0.5">Joined {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleAssignTenant(t._id); }}
                                                                className="shrink-0 px-3.5 py-1.5 bg-white text-brand-600 hover:bg-brand-100 hover:text-brand-700 text-xs font-bold rounded-lg transition-all duration-200 border border-brand-200/60 hover:border-brand-300 hover:shadow-sm"
                                                            >
                                                                + Assign
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {/* Show More button */}
                                                {hasMore && (
                                                    <button
                                                        onClick={() => setVisibleTenantCount(prev => prev + TENANTS_PAGE_SIZE)}
                                                        className="w-full py-2.5 text-sm font-semibold text-brand-600 hover:text-brand-700 bg-brand-50/60 hover:bg-brand-100 border border-brand-200/50 hover:border-brand-300 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5"
                                                    >
                                                        <ChevronDown className="w-4 h-4" />
                                                        Show More ({filtered.length - visibleTenantCount} remaining)
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                        </div>

                        {/* Bulk assign footer — visible only when items are selected */}
                        {selectedTenantIds.size > 0 && (
                            <div className="shrink-0 p-4 border-t border-slate-100 bg-brand-50/60 flex items-center justify-between gap-3">
                                <span className="text-sm text-slate-600 font-medium">
                                    <span className="font-bold text-brand-700">{selectedTenantIds.size}</span> tenant{selectedTenantIds.size !== 1 ? 's' : ''} selected
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedTenantIds(new Set())}
                                        className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={handleBulkAssign}
                                        disabled={bulkAssigning}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 active:scale-95 transition-all shadow-md shadow-brand-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {bulkAssigning ? (
                                            <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Assigning...</>
                                        ) : (
                                            <><Check className="w-4 h-4" /> Assign {selectedTenantIds.size} Selected</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Success Credentials Modal ─── */}
            {createdUserCredentials && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-zoomIn ring-1 ring-slate-200/50">
                        
                        {/* Success Banner */}
                        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-8 flex flex-col items-center justify-center text-white text-center overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md mx-auto shadow-lg shadow-emerald-700/20 ring-1 ring-white/20">
                                    <ShieldCheck className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold">{createdUserCredentials.role} Created!</h3>
                                <p className="opacity-80 mt-1.5 text-sm">Take note of these initial login credentials.</p>
                            </div>
                        </div>
                        
                        {/* Credentials Card */}
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                                    <div className="text-slate-900 font-semibold font-mono text-sm select-all bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                                        {createdUserCredentials.email}
                                    </div>
                                </div>
                                <div className="h-px bg-slate-200/60 w-full" />
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Initial Password</label>
                                    <div className="text-brand-600 font-bold font-mono text-lg select-all bg-white px-3 py-2 rounded-lg border border-brand-200/50">
                                        {createdUserCredentials.password}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-amber-50/80 border border-amber-200/80 text-amber-800 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <p><strong>Important:</strong> Passwords are securely hashed in the database. This plain-text password will only be shown this one time. Please securely share it with the user.</p>
                            </div>
                        </div>
                        
                        {/* Footer Actions */}
                        <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex gap-3">
                            <button 
                                onClick={() => { setCreatedUserCredentials(null); setCopiedCredentials(false); }} 
                                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                            >
                                Close
                            </button>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(`Login URL: ${window.location.origin}/client/login\nEmail: ${createdUserCredentials.email}\nPassword: ${createdUserCredentials.password}`);
                                    setCopiedCredentials(true);
                                    toast.success('Credentials copied to clipboard!');
                                    setTimeout(() => setCopiedCredentials(false), 2000);
                                }} 
                                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 shadow-md ${
                                    copiedCredentials 
                                        ? 'bg-emerald-500 text-white shadow-emerald-500/25' 
                                        : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-brand-500/25 hover:from-brand-600 hover:to-brand-700 hover:shadow-lg hover:shadow-brand-500/30'
                                }`}
                            >
                                {copiedCredentials ? (
                                    <><Check className="w-4 h-4" /> Copied!</>
                                ) : (
                                    <><Copy className="w-4 h-4" /> Copy Credentials</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </DashboardLayout>
    );
};

export default SBMRMManagement;
