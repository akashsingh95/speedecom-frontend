import React, { useState, useEffect } from 'react';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';
import { CheckCircle, Clock, Search, ShieldCheck, CreditCard, XCircle, Loader2, Building, RefreshCw, ClipboardCheck, Users, AlertTriangle, TrendingUp, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatTenantLabel } from '../utils/tenantDisplay';

const GST_RATE = Number(import.meta.env.VITE_GST_RATE || 18) / 100;

const AdminApprovals = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const canApproveTenants = user?.role === 'SuperAdmin' || user?.permissions?.approveTenants;
    const canApproveSubscriptions = user?.role === 'SuperAdmin' || user?.permissions?.approveSubscriptions;
    const canRejectRegistrations = user?.role === 'SuperAdmin' || user?.permissions?.rejectRegistrations;
    const isSuperAdmin = user?.role === 'SuperAdmin';

    const [activeTab, setActiveTab] = useState(
        canApproveTenants ? 'tenants' : 
        canApproveSubscriptions ? 'subscriptions' : 
        canRejectRegistrations ? 'rejected' : 'tenants'
    );

    // Tenants State
    const [pendingTenants, setPendingTenants] = useState([]);
    const [tenantsLoading, setTenantsLoading] = useState(canApproveTenants);
    const [tenantSearch, setTenantSearch] = useState('');

    // Rejected Tenants State
    const [rejectedTenants, setRejectedTenants] = useState([]);
    const [rejectedLoading, setRejectedLoading] = useState(canRejectRegistrations);
    const [rejectedSearch, setRejectedSearch] = useState('');

    // Subscriptions State
    const [pendingSubscriptions, setPendingSubscriptions] = useState([]);
    const [subsLoading, setSubsLoading] = useState(canApproveSubscriptions);
    const [subActionLoading, setSubActionLoading] = useState(null);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'confirm', // or 'danger'
        onConfirm: null
    });
    const closeConfirmModal = () => setConfirmModal({ ...confirmModal, isOpen: false });


    // System Tools State
    const [recalcPlatform, setRecalcPlatform] = useState('Meesho');
    const [recalcLoading, setRecalcLoading] = useState(false);

    // Redirect SBM with no approval permissions away from this page
    useEffect(() => {
        if (user?.role === 'SBM' && !canApproveTenants && !canApproveSubscriptions && !canRejectRegistrations) {
            navigate('/profile', { replace: true });
        }
    }, [user, navigate, canApproveTenants, canApproveSubscriptions, canRejectRegistrations]);

    useEffect(() => {
        if (canApproveTenants) fetchPendingTenants();
        if (canRejectRegistrations) fetchRejectedTenants();
        if (canApproveSubscriptions) fetchPendingSubscriptions();
    }, [canApproveTenants, canRejectRegistrations, canApproveSubscriptions]);

    const fetchPendingTenants = async () => {
        try {
            const res = await api.get('/auth/pending-tenants');
            setPendingTenants(res.data);
        } catch (error) {
            console.error('Error fetching pending tenants', error);
        } finally {
            setTenantsLoading(false);
        }
    };

    const fetchRejectedTenants = async () => {
        try {
            const res = await api.get('/auth/rejected-tenants');
            setRejectedTenants(res.data);
        } catch (error) {
            console.error('Error fetching rejected tenants', error);
        } finally {
            setRejectedLoading(false);
        }
    };

    const fetchPendingSubscriptions = async () => {
        try {
            const res = await api.get('/subscriptions/pending');
            setPendingSubscriptions(res.data);
        } catch (error) {
            console.error('Error fetching pending subscriptions', error);
        } finally {
            setSubsLoading(false);
        }
    };

    const handleApproveTenant = async (id) => {
        try {
            await api.put(`/auth/approve-tenant/${id}`);
            setPendingTenants(pendingTenants.filter(tenant => tenant._id !== id));
            toast.success('Tenant approved successfully');
        } catch (error) {
            console.error('Error approving tenant', error);
        }
    };

    const handleRejectTenant = (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Reject Registration',
            message: 'Are you sure you want to reject this tenant registration? The data will be kept but they will not be able to log in.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await api.put(`/auth/reject-tenant/${id}`);
                    setPendingTenants(prev => prev.filter(t => t._id !== id));
                    if (canApproveTenants) fetchRejectedTenants(); // update rejected list
                    toast.success('Tenant registration rejected');
                } catch (error) {
                    console.error('Error rejecting tenant', error);
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleReviveTenant = (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Revive Registration',
            message: 'Are you sure you want to revive this tenant registration? They will be moved back to the pending approvals list.',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await api.put(`/auth/revive-tenant/${id}`);
                    setRejectedTenants(prev => prev.filter(t => t._id !== id));
                    if (canApproveTenants) fetchPendingTenants(); // update pending list
                    toast.success('Tenant registration revived successfully');
                } catch (error) {
                    console.error('Error reviving tenant', error);
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleDeleteTenant = (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Registration',
            message: 'Are you sure you want to permanently delete this rejected tenant registration? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await api.delete(`/auth/rejected-tenant/${id}`);
                    setRejectedTenants(prev => prev.filter(t => t._id !== id));
                    toast.success('Rejected tenant permanently deleted');
                } catch (error) {
                    console.error('Error deleting rejected tenant', error);
                    toast.error(error.response?.data?.message || 'Failed to delete tenant');
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleSubscriptionAction = (id, status) => {
        setConfirmModal({
            isOpen: true,
            title: status === 'approved' ? 'Approve Subscription' : 'Reject Subscription',
            message: `Are you sure you want to ${status} this request?`,
            type: status === 'approved' ? 'confirm' : 'danger',
            onConfirm: async () => {
                setSubActionLoading(id);
                try {
                    await api.post(`/subscriptions/${id}/handle`, { status });
                    setPendingSubscriptions(prev => prev.filter(r => r._id !== id));
                    toast.success(`Request ${status} successfully`);
                } catch (error) {
                    console.error(`Error marking request as ${status}`, error);
                    // Global handler catches this now
                } finally {
                    setSubActionLoading(null);
                    closeConfirmModal();
                }
            }
        });
    };

    const handleFlagRecalculation = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Flag Recalculation',
            message: `Are you sure you want to flag all ${recalcPlatform} marketplaces for recalculation? The next time a SuperAdmin, SBM, or RM visits their payments page, they will see a Recalculate button.`,
            type: 'confirm',
            onConfirm: async () => {
                setRecalcLoading(true);
                try {
                    await api.put('/marketplaces/flag-recalculation', { platform: recalcPlatform });
                    toast.success(`${recalcPlatform} marketplaces flagged successfully`);
                } catch (error) {
                    console.error('Error flagging recalculation', error);
                    toast.error(error.response?.data?.message || 'Failed to flag marketplaces for recalculation');
                } finally {
                    setRecalcLoading(false);
                    closeConfirmModal();
                }
            }
        });
    };

    const filteredTenants = pendingTenants.filter(tenant =>
        tenant.fullName.toLowerCase().includes(tenantSearch.toLowerCase()) ||
        tenant.email.toLowerCase().includes(tenantSearch.toLowerCase()) ||
        (tenant.tenantId && tenant.tenantId.name.toLowerCase().includes(tenantSearch.toLowerCase()))
    );

    const filteredRejected = rejectedTenants.filter(tenant =>
        tenant.fullName.toLowerCase().includes(rejectedSearch.toLowerCase()) ||
        tenant.email.toLowerCase().includes(rejectedSearch.toLowerCase()) ||
        (tenant.tenantId && tenant.tenantId.name.toLowerCase().includes(rejectedSearch.toLowerCase()))
    );

    // Current search term based on active tab
    const currentSearch = activeTab === 'tenants' ? tenantSearch : activeTab === 'rejected' ? rejectedSearch : '';
    const setCurrentSearch = activeTab === 'tenants' ? setTenantSearch : activeTab === 'rejected' ? setRejectedSearch : () => {};

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
                                    <ClipboardCheck size={20} className="text-white" />
                                </div>
                                <h1 className="text-xl font-bold tracking-tight">Approval & Review Panel</h1>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════ STATS ROW ═══════════════ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Pending Tenants */}
                        {canApproveTenants && (
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                        <Clock size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">Pending registrations</span>
                                </div>
                                <div className="flex items-baseline gap-2.5">
                                    <p className={`text-3xl font-bold ${pendingTenants.length > 0 ? 'text-amber-700' : 'text-slate-800'}`}>{pendingTenants.length}</p>
                                    {pendingTenants.length > 0 && (
                                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                            Needs review
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Rejected */}
                        {canRejectRegistrations && (
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-red-50 rounded-lg text-red-500">
                                        <XCircle size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">Rejected registrations</span>
                                </div>
                                <p className="text-3xl font-bold text-slate-800">{rejectedTenants.length}</p>
                            </div>
                        )}

                        {/* Pending Subscriptions */}
                        {canApproveSubscriptions && (
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                        <CreditCard size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">Pending recharges</span>
                                </div>
                                <div className="flex items-baseline gap-2.5">
                                    <p className={`text-3xl font-bold ${pendingSubscriptions.length > 0 ? 'text-blue-700' : 'text-slate-800'}`}>{pendingSubscriptions.length}</p>
                                    {pendingSubscriptions.length > 0 && (
                                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                            Awaiting
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══════════════ TOOLBAR (Tabs + Search) ═══════════════ */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                        <div className="px-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                            {/* Tabs */}
                            <div className="flex items-center">
                                {canApproveTenants && (
                                    <button
                                        onClick={() => setActiveTab('tenants')}
                                        className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'tenants'
                                            ? 'border-brand-600 text-brand-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        <Building size={16} />
                                        Tenant Registrations
                                        {pendingTenants.length > 0 && (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === 'tenants' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{pendingTenants.length}</span>
                                        )}
                                    </button>
                                )}
                                {canRejectRegistrations && (
                                    <button
                                        onClick={() => setActiveTab('rejected')}
                                        className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'rejected'
                                            ? 'border-red-500 text-red-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        <XCircle size={16} />
                                        Rejected Registrations
                                        {rejectedTenants.length > 0 && (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{rejectedTenants.length}</span>
                                        )}
                                    </button>
                                )}
                                {canApproveSubscriptions && (
                                    <button
                                        onClick={() => setActiveTab('subscriptions')}
                                        className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'subscriptions'
                                            ? 'border-brand-600 text-brand-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        <CreditCard size={16} />
                                        Subscription Recharges
                                        {pendingSubscriptions.length > 0 && (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === 'subscriptions' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{pendingSubscriptions.length}</span>
                                        )}
                                    </button>
                                )}
                                {(isSuperAdmin || user?.role === 'SBM') && (
                                    <button
                                        onClick={() => setActiveTab('system_tools')}
                                        className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'system_tools'
                                            ? 'border-brand-600 text-brand-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        <Settings size={16} />
                                        System Tools
                                    </button>
                                )}
                            </div>

                            {/* Search — only for tenant/rejected tabs */}
                            {(activeTab === 'tenants' || activeTab === 'rejected') && (
                                <div className="relative w-full sm:max-w-xs py-3">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder={activeTab === 'tenants' ? 'Search tenants or emails...' : 'Search rejected tenants...'}
                                        value={currentSearch}
                                        onChange={(e) => setCurrentSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white transition-all duration-200"
                                    />
                                </div>
                            )}
                        </div>

                        {/* ═══════════════ TABLE CONTENT ═══════════════ */}
                        <div className="overflow-x-auto">
                            {/* Tenants Tab */}
                            {activeTab === 'tenants' && (
                                <>
                                    {tenantsLoading ? (
                                        <div className="flex flex-col items-center justify-center min-h-[300px]">
                                            <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
                                            <p className="text-slate-500">Loading pending tenants...</p>
                                        </div>
                                    ) : filteredTenants.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                                            <div className="p-4 bg-slate-100 rounded-2xl">
                                                <ShieldCheck className="w-10 h-10 text-emerald-400" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-semibold text-slate-700">No Pending Tenants</p>
                                                <p className="text-sm text-slate-500 mt-1">All tenant registrations have been processed.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50/70">
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Tenant Name</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Admin User</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Email</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Sales Person</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Per Day Orders</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">No. of Accounts</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Status</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredTenants.map((tenant) => (
                                                    <tr key={tenant._id} className="group hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-semibold text-slate-800">
                                                                {formatTenantLabel(tenant)}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-700">{tenant.fullName}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-500">{tenant.email}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-700">{tenant.tenantId?.salesPersonName || '-'}</span>
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            <span className="text-sm font-semibold text-slate-800">{tenant.tenantId?.perDayOrder || 0}</span>
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            <span className="text-sm font-semibold text-slate-800">{tenant.tenantId?.numberOfAccount || 0}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                Pending
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleApproveTenant(tenant._id)}
                                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-[11px] font-bold uppercase rounded-lg hover:bg-brand-600 hover:shadow-lg hover:shadow-brand-500/20 transition-all active:scale-95"
                                                                >
                                                                    <CheckCircle size={13} />
                                                                    Approve
                                                                </button>
                                                                {canRejectRegistrations && (
                                                                    <button
                                                                        onClick={() => handleRejectTenant(tenant._id)}
                                                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold uppercase rounded-lg hover:bg-red-100 transition-all active:scale-95"
                                                                    >
                                                                        <XCircle size={13} />
                                                                        Reject
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </>
                            )}

                            {/* Rejected Tab */}
                            {activeTab === 'rejected' && (
                                <>
                                    {rejectedLoading ? (
                                        <div className="flex flex-col items-center justify-center min-h-[300px]">
                                            <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
                                            <p className="text-slate-500">Loading rejected tenants...</p>
                                        </div>
                                    ) : filteredRejected.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                                            <div className="p-4 bg-slate-100 rounded-2xl">
                                                <XCircle className="w-10 h-10 text-slate-400" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-semibold text-slate-700">No Rejected Registrations</p>
                                                <p className="text-sm text-slate-500 mt-1">No tenant registrations have been rejected.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50/70">
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Tenant Name</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Admin User</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Email</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Sales Person</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Per Day Orders</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">No. of Accounts</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Rejected At</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Status</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredRejected.map((tenant) => (
                                                    <tr key={tenant._id} className="group hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-semibold text-slate-800">
                                                                {formatTenantLabel(tenant)}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-700">{tenant.fullName}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-500">{tenant.email}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-700">{tenant.tenantId?.salesPersonName || '-'}</span>
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            <span className="text-sm font-semibold text-slate-800">{tenant.tenantId?.perDayOrder || 0}</span>
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            <span className="text-sm font-semibold text-slate-800">{tenant.tenantId?.numberOfAccount || 0}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-500">{new Date(tenant.updatedAt).toLocaleDateString()}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                                Rejected
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleReviveTenant(tenant._id)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 text-[11px] font-bold uppercase rounded-lg hover:bg-blue-100 transition-all active:scale-95"
                                                                    title="Move back to Pending Approvals"
                                                                >
                                                                    <RefreshCw size={13} />
                                                                    Restore
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteTenant(tenant._id)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold uppercase rounded-lg hover:bg-red-100 transition-all active:scale-95"
                                                                    title="Permanently delete this rejected tenant"
                                                                >
                                                                    <Trash2 size={13} />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </>
                            )}

                            {/* Subscriptions Tab */}
                            {activeTab === 'subscriptions' && (
                                <>
                                    {subsLoading ? (
                                        <div className="flex flex-col items-center justify-center min-h-[300px]">
                                            <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
                                            <p className="text-slate-500">Loading pending recharges...</p>
                                        </div>
                                    ) : pendingSubscriptions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                                            <div className="p-4 bg-slate-100 rounded-2xl">
                                                <CheckCircle className="w-10 h-10 text-emerald-400" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-semibold text-slate-700">No Pending Recharges</p>
                                                <p className="text-sm text-slate-500 mt-1">All subscription recharge requests have been processed.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50/70">
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Tenant</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Plan Name</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Taxable Amount</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Tax</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Final Amount</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Transaction ID</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Requested At</th>
                                                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {pendingSubscriptions.map((req) => (
                                                    <tr key={req._id} className="group hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-semibold text-slate-800">{formatTenantLabel(req)}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-medium text-slate-700">{req.planName}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-bold text-emerald-600">₹{req.amount.toLocaleString()}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-bold text-amber-600">₹{parseFloat((Number(req.amount) * GST_RATE).toFixed(2)).toFixed(2)}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-bold text-slate-800">₹{(Number(req.amount) + parseFloat((Number(req.amount) * GST_RATE).toFixed(2))).toFixed(2)}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="font-mono text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200">{req.transactionId}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-500">{new Date(req.createdAt).toLocaleString()}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            {subActionLoading === req._id ? (
                                                                <div className="flex justify-end pr-4">
                                                                    <Loader2 className="animate-spin text-brand-600" size={20} />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleSubscriptionAction(req._id, 'approved')}
                                                                        className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:scale-105 transition-all"
                                                                        title="Approve"
                                                                    >
                                                                        <CheckCircle size={20} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleSubscriptionAction(req._id, 'rejected')}
                                                                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 hover:scale-105 transition-all"
                                                                        title="Reject"
                                                                    >
                                                                        <XCircle size={20} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </>
                            )}

                            {/* System Tools Tab */}
                            {activeTab === 'system_tools' && (isSuperAdmin || user?.role === 'SBM') && (
                                <div className="p-6">
                                    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
                                                <RefreshCw size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-slate-800 mb-1">Force Schema Recalculation</h3>
                                                <p className="text-sm text-slate-500 mb-6">
                                                    Flag all tenant accounts for a specific marketplace platform to display the "Recalculate" button. Use this after deploying new calculation schema changes so that the system can rebuild the spine records.
                                                </p>
                                                
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                                                            Platform to Flag
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                value={recalcPlatform}
                                                                onChange={(e) => setRecalcPlatform(e.target.value)}
                                                                className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white transition-all cursor-pointer"
                                                            >
                                                                <option value="Meesho">Meesho</option>
                                                                <option value="Flipkart">Flipkart</option>
                                                                <option value="Amazon India (Seller)">Amazon</option>
                                                                <option value="Myntra">Myntra</option>
                                                            </select>
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="pt-6">
                                                        <button
                                                            onClick={handleFlagRecalculation}
                                                            disabled={recalcLoading}
                                                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                                        >
                                                            {recalcLoading ? (
                                                                <Loader2 size={18} className="animate-spin" />
                                                            ) : (
                                                                <AlertTriangle size={18} />
                                                            )}
                                                            Flag for Recalculation
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {activeTab === 'tenants' && !tenantsLoading && filteredTenants.length > 0 && (
                            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <p className="text-xs text-slate-500">
                                    Showing <span className="font-semibold text-slate-700">{filteredTenants.length}</span> of <span className="font-semibold text-slate-700">{pendingTenants.length}</span> pending
                                </p>
                            </div>
                        )}
                        {activeTab === 'rejected' && !rejectedLoading && filteredRejected.length > 0 && (
                            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <p className="text-xs text-slate-500">
                                    Showing <span className="font-semibold text-slate-700">{filteredRejected.length}</span> of <span className="font-semibold text-slate-700">{rejectedTenants.length}</span> rejected
                                </p>
                            </div>
                        )}
                        {activeTab === 'subscriptions' && !subsLoading && pendingSubscriptions.length > 0 && (
                            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <p className="text-xs text-slate-500">
                                    Showing <span className="font-semibold text-slate-700">{pendingSubscriptions.length}</span> recharge request{pendingSubscriptions.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'
                                }`}>
                                {confirmModal.type === 'danger' ? <XCircle size={24} /> : <CheckCircle size={24} />}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmModal.title}</h3>
                            <p className="text-slate-500">{confirmModal.message}</p>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end">
                            <button
                                onClick={closeConfirmModal}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className={`px-4 py-2 text-white font-medium rounded-lg transition-colors shadow-lg ${confirmModal.type === 'danger'
                                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                                    : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'
                                    }`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default AdminApprovals;

