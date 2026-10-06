import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle, Eye, Download, Info, Trash2, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../AuthContext';
import MarketplaceAccountSelector from '../components/MarketplaceAccountSelector';
import { getFriendlySyncErrorMessage } from '../utils/meeshoSyncErrorMessages';

const UploadHistoryTab = ({ activeMarketplaces, defaultMarketplaceKey, defaultAccountId }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canDeleteUploads = user?.role === 'SuperAdmin' || (user?.role === 'SBM' && user?.permissions?.deleteUpload);
    const canRetryUploads = user?.role === 'SuperAdmin' || user?.role === 'SBM' || user?.role === 'RM';

    const [uploadHistory, setUploadHistory] = useState([]);
    const [dlqUploadIds, setDlqUploadIds] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
    const [uploadTypesConfig, setUploadTypesConfig] = useState({});

    // Delete confirmation modal state
    const [deleteTarget, setDeleteTarget] = useState(null);   // upload object or null
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletingNow, setDeletingNow] = useState(false);

    // Cascading filters: marketplace -> account -> type -> status
    // Default to the account currently selected in Uploads
    const [filterMarketplace, setFilterMarketplace] = useState(() => {
        const uploadSaved = localStorage.getItem('uploads_marketplaceKey');
        if (uploadSaved) return uploadSaved;
        const histSaved = localStorage.getItem('uploadHist_marketplace');
        if (histSaved && histSaved !== 'all') return histSaved;
        return defaultMarketplaceKey || '';
    });
    const [filterAccount, setFilterAccount] = useState(() => {
        const uploadSaved = localStorage.getItem('uploads_marketplaceId');
        if (uploadSaved) return uploadSaved;
        const histSaved = localStorage.getItem('uploadHist_account');
        if (histSaved && histSaved !== 'all') return histSaved;
        return defaultAccountId || '';
    });
    const [filterType, setFilterType] = useState(() => localStorage.getItem('uploadHist_type') || 'all');
    const [filterStatus, setFilterStatus] = useState(() => localStorage.getItem('uploadHist_status') || 'all');

    const isInitializedRef = useRef(false);

    // Sync with default upload account when activeMarketplaces loads on initial mount
    useEffect(() => {
        if (!activeMarketplaces || activeMarketplaces.length === 0) return;
        if (isInitializedRef.current) return;

        const currentUploadMpKey = defaultMarketplaceKey || localStorage.getItem('uploads_marketplaceKey');
        const currentUploadAccId = defaultAccountId || localStorage.getItem('uploads_marketplaceId');

        let targetMp = activeMarketplaces.find(m => m.key === filterMarketplace && m.key !== 'all') ||
            activeMarketplaces.find(m => m.key === currentUploadMpKey) ||
            activeMarketplaces.find(m => m.accounts?.some(a => a.status !== 'inactive')) ||
            activeMarketplaces[0];

        if (targetMp) {
            let targetAcc = (targetMp.accounts || []).find(a => a._id === filterAccount && a._id !== 'all') ||
                (targetMp.accounts || []).find(a => a._id === currentUploadAccId) ||
                (targetMp.accounts || []).find(a => a.status !== 'inactive') ||
                targetMp.accounts?.[0];

            const hasValidAccount = (targetMp.accounts || []).some(a => a._id === filterAccount);
            if (!filterMarketplace || filterMarketplace === 'all' || !filterAccount || filterAccount === 'all' || !hasValidAccount) {
                setFilterMarketplace(targetMp.key);
                if (targetAcc) setFilterAccount(targetAcc._id);
            }
        }
        isInitializedRef.current = true;
    }, [activeMarketplaces, defaultMarketplaceKey, defaultAccountId]);

    // Save filters to localStorage whenever they change
    useEffect(() => {
        if (filterMarketplace) localStorage.setItem('uploadHist_marketplace', filterMarketplace);
        if (filterAccount) localStorage.setItem('uploadHist_account', filterAccount);
        localStorage.setItem('uploadHist_type', filterType);
        localStorage.setItem('uploadHist_status', filterStatus);
    }, [filterMarketplace, filterAccount, filterType, filterStatus]);

    // Fetch upload types configuration from backend
    useEffect(() => {
        const fetchUploadTypesConfig = async () => {
            try {
                const { data } = await api.get('/upload/types');
                setUploadTypesConfig(data);
            } catch (error) {
                console.error('Error fetching upload types config', error);
            }
        };
        fetchUploadTypesConfig();
    }, []);

    // Fetch history on mount and whenever filters / page change.
    useEffect(() => {
        fetchUploadHistory();
    }, [filterMarketplace, filterAccount, filterType, filterStatus, pagination.page]);

    // Fetch DLQ IDs if user has retry permissions
    useEffect(() => {
        if (!canRetryUploads) return;
        
        // Stop background polling when there are no failed uploads visible
        const hasFailedUploads = uploadHistory.some(u => u.status === 'failed');
        if (!hasFailedUploads) return;

        const fetchDlqIds = async () => {
            try {
                const response = await api.get('/upload/dlq/ids');
                const ids = Array.isArray(response.data) ? response.data : (response.data?.data || []);
                setDlqUploadIds(ids);
            } catch (err) {
                console.error('Failed to fetch DLQ upload IDs', err);
            }
        };
        fetchDlqIds();
        const dlqInterval = setInterval(fetchDlqIds, 30000);
        return () => clearInterval(dlqInterval);
    }, [canRetryUploads, uploadHistory]);

    // Poll for status while any row is in-flight. Driven off uploadHistory so it
    // auto-starts when a row becomes active (e.g. a delete flips a row to
    // 'deleting') and auto-stops once nothing is active — no refresh needed.
    useEffect(() => {
        const ACTIVE = ['processing', 'pending', 'validating', 'deleting'];
        if (!uploadHistory.some(u => ACTIVE.includes(u.status))) return;

        const pollInterval = setInterval(async () => {
            try {
                const uploadIds = uploadHistory
                    .filter(u => ACTIVE.includes(u.status))
                    .map(u => u.uploadId);
                if (uploadIds.length === 0) return;

                // Impersonation tenantId is appended automatically by the axios interceptor.
                const { data: statuses } = await api.post('/upload/status', { uploadIds });

                setUploadHistory(prev => {
                    const newUploads = [...prev];

                    // Track which polled uploadIds came back (so we can drop rows
                    // whose doc was hard-deleted by the cascade worker).
                    const returnedIds = new Set(statuses.map(s => s.uploadId).filter(Boolean));
                    uploadIds.forEach(id => {
                        if (!returnedIds.has(id)) {
                            const i = newUploads.findIndex(u => u.uploadId === id);
                            if (i !== -1) newUploads.splice(i, 1);
                        }
                    });

                    statuses.forEach(statusUpdate => {
                        const index = newUploads.findIndex(u => u.uploadId === statusUpdate.uploadId);
                        if (index !== -1) {
                            newUploads[index] = { ...newUploads[index], ...statusUpdate };
                        }
                    });

                    return newUploads;
                });
            } catch (error) {
                console.error('Error polling history status', error);
            }
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [uploadHistory]);

    const fetchUploadHistory = async (callback, pageNumber = pagination.page) => {
        // If marketplace or account is cleared or set to 'all', do not fetch or show data
        if (!filterMarketplace || filterMarketplace === 'all' || !filterAccount || filterAccount === 'all') {
            setUploadHistory([]);
            setPagination({ total: 0, page: 1, limit: 50, totalPages: 0 });
            setLoadingHistory(false);
            if (callback) callback([]);
            return;
        }

        setLoadingHistory(true);
        try {
            // Build query parameters
            const params = new URLSearchParams();
            params.append('marketplace', filterMarketplace);
            params.append('accountId', filterAccount);

            if (filterType !== 'all') {
                params.append('uploadType', filterType);
            }
            if (filterStatus !== 'all') {
                params.append('status', filterStatus);
            }
            // Impersonation tenantId is appended automatically by the axios interceptor.
            params.append('page', pageNumber.toString());
            params.append('limit', '50');

            const { data } = await api.get(`/upload?${params.toString()}`);
            setUploadHistory(data.uploads || []);
            setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
            if (callback) callback(data.uploads || []);
        } catch (error) {
            console.error('Error fetching upload history', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const availableUploadTypes = useMemo(() => {
        if (filterMarketplace === 'all') return [];

        const key = filterMarketplace?.toLowerCase();
        if (key === 'flipkart' || key?.includes('flipkart')) {
            return uploadTypesConfig.flipkart || [];
        } else if (key === 'meesho') {
            return uploadTypesConfig.meesho || [];
        } else if (key?.includes('amazon')) {
            return uploadTypesConfig.amazon || [];
        } else if (key?.includes('myntra')) {
            return uploadTypesConfig.myntra || [];
        }
        return [];
    }, [filterMarketplace, uploadTypesConfig]);

    // Format upload type for display
    const formatUploadType = (type) => {
        const typeLabels = {
            orders: 'Orders',
            payments: 'Payments',
            ads: 'Ads',
            costsheet: 'Cost Sheet',
            meesho_payments: 'Meesho Payments',
            meesho_sales: 'Meesho Sales',
            meesho_claims: 'Meesho Claims',
            meesho_returns: 'Meesho Returns',
            amazon_payments: 'Amazon Payments',
            amazon_orders: 'Amazon Orders',
            amazon_ads: 'Amazon Ads',
            amazon_returns: 'Amazon Returns',
            amazon_b2b_b2c: 'Amazon B2B/B2C',
            myntra_payments: 'Myntra Payments',
            myntra_orders: 'Myntra Orders',
            myntra_returns_seller: 'Myntra Returns (Seller)',
            myntra_returns_delivery: 'Myntra Returns (Delivery)'
        };
        return typeLabels[type] || type;
    };

    // Statuses where a worker may still be writing — Delete must wait.
    const IN_FLIGHT_STATUSES = ['pending_upload', 'pending', 'validating', 'validation_warning',
        'queued_for_processing', 'processing', 'deleting'];
    // 'deleted' rows are already soft-deleted (cascade succeeded) — re-deleting is a no-op.
    const canDeleteUpload = (status) =>
        canDeleteUploads && !IN_FLIGHT_STATUSES.includes(status) && status !== 'deleted';

    const submitDelete = async () => {
        if (!deleteTarget) return;
        setDeletingNow(true);
        try {
            await api.delete(`/upload/${deleteTarget.uploadId}`);
            // Optimistic flip — polling will catch the row when the doc disappears.
            setUploadHistory(prev => prev.map(u =>
                u.uploadId === deleteTarget.uploadId ? { ...u, status: 'deleting', errorMessage: null } : u
            ));
            setDeleteTarget(null);
            setDeleteConfirmText('');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to delete upload';
            alert(`Could not delete upload: ${msg}`);
        } finally {
            setDeletingNow(false);
        }
    };

    const handleRetryUpload = async (uploadId) => {
        try {
            await api.post(`/upload/${uploadId}/retry`);
            setUploadHistory(prev => prev.map(u =>
                u.uploadId === uploadId ? { ...u, status: 'pending', errorMessage: null } : u
            ));
            setDlqUploadIds(prev => prev.filter(id => id !== uploadId));
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to retry upload';
            alert(`Could not retry upload: ${msg}`);
        }
    };

    const getRelativeTime = (date) => {
        const diff = Date.now() - new Date(date);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1) return 'just now';
        if (hours < 1) return `${minutes} min ago`;
        if (days < 1) return `${hours} h ago`;
        if (days < 30) return `${days} d ago`;
        return `${Math.floor(days / 30)} mo ago`;
    };

    // Shorten filename for display
    // Strips the internal "_YYYY-MM-DDTHH-MM-SS-mmmZ" uniqueness suffix the
    // auto-sync services bake into the GCS object key (toISOString() with
    // ':'/'.' swapped for '-', since those aren't valid in a storage key) —
    // needed there to avoid collisions between syncs, meaningless to a user
    // looking at a file name.
    const stripSyncTimestamp = (name) =>
        name.replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/g, '');

    const shortenFilename = (filename) => {
        let cleanName = filename.replace(/^uploads\//, '');
        // Strip auto-sync GCS path prefix (e.g. "meesho-auto-sync/{objectId}/")
        cleanName = cleanName.replace(/^[\w-]+-auto-sync\/[a-f0-9]{24}\//, '');
        cleanName = stripSyncTimestamp(cleanName);
        if (cleanName.length > 50) {
            const start = cleanName.substring(0, 25);
            const end = cleanName.substring(cleanName.length - 20);
            return `${start}...${end}`;
        }
        return cleanName;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle className="text-emerald-600" size={20} />;
            case 'failed':
            case 'validation_failed':
            case 'deletion_failed': return <XCircle className="text-red-600" size={20} />;
            case 'cancelled': return <XCircle className="text-slate-400" size={20} />;
            case 'deleted': return <Trash2 className="text-slate-500" size={20} />;
            case 'processing': return <Loader2 className="text-indigo-500 animate-spin" size={20} />;
            case 'validating': return <Loader2 className="text-orange-500 animate-spin" size={20} />;
            case 'deleting': return <Loader2 className="text-rose-500 animate-spin" size={20} />;
            case 'queued_for_processing': return <Clock className="text-sky-500" size={20} />;
            case 'validation_warning': return <AlertTriangle className="text-amber-500" size={20} />;
            case 'validated': return <CheckCircle className="text-emerald-500" size={20} />;
            default: return <Clock className="text-slate-400" size={20} />;
        }
    };

    const STATUS_LABEL = {
        pending_upload:        'Pending Upload',
        validating:            'Validating',
        validation_warning:    'Warning',
        validation_failed:     'Validation failed',
        validated:             'Validated',
        queued_for_processing: 'Queued',
        processing:            'Processing',
        completed:             'Completed',
        failed:                'Failed',
        cancelled:             'Cancelled',
        deleting:              'Deleting…',
        deletion_failed:       'Deletion Failed',
        deleted:               'Deleted',
    };

    const getStatusBadge = (status) => {
        const styles = {
            completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            failed: 'bg-red-50 text-red-700 border-red-200',
            validation_failed: 'bg-red-50 text-red-700 border-red-200',
            processing: 'bg-indigo-50 text-indigo-600 border-indigo-200',
            validating: 'bg-orange-50 text-orange-700 border-orange-200',
            validation_warning: 'bg-amber-50 text-amber-700 border-amber-200',
            queued_for_processing: 'bg-sky-50 text-sky-700 border-sky-200',
            pending_upload: 'bg-slate-50 text-slate-600 border-slate-200',
            validated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
            deleting: 'bg-rose-50 text-rose-700 border-rose-200',
            deletion_failed: 'bg-red-50 text-red-700 border-red-200',
            deleted: 'bg-slate-100 text-slate-700 border-slate-300',
        };
        const label = STATUS_LABEL[status] || status;
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {label}
            </span>
        );
    };

    // Returns { type, message } for statuses that have detail worth showing, else null
    const getStatusDetail = (upload) => {
        const { status, errorMessage, validationResult } = upload;

        if (status === 'failed' && errorMessage) {
            const message = upload.source === 'sync' ? getFriendlySyncErrorMessage(errorMessage) : errorMessage;
            return { type: 'error', message };
        }
        if (status === 'validation_failed') {
            const errors = validationResult?.errors;
            if (Array.isArray(errors) && errors.length > 0) {
                return { type: 'error', message: errors.join(' · ') };
            }
            if (errorMessage) return { type: 'error', message: errorMessage };
        }
        if (status === 'validation_warning') {
            const warnings = validationResult?.warnings;
            if (Array.isArray(warnings) && warnings.length > 0) {
                const preview = warnings[0];
                const suffix = warnings.length > 1 ? ` (+${warnings.length - 1} more)` : '';
                return { type: 'warning', message: preview + suffix, full: warnings.join('\n') };
            }
        }
        if (status === 'cancelled' && errorMessage) {
            return { type: 'info', message: errorMessage };
        }
        return null;
    };

    return (
        <div className='relative h-full flex flex-col'>
            {/* Improved Filters Section */}
            <div className="z-10 bg-slate-50/90 backdrop-blur-md pt-1 pb-3 px-4 md:px-8 border-b border-slate-200/40 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] transition-shadow shrink-0">
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">

                        {/* Marketplace & Account Selector */}
                        <MarketplaceAccountSelector
                            marketplaces={activeMarketplaces}
                            selectedMarketplaceKey={filterMarketplace !== 'all' ? filterMarketplace : ''}
                            selectedAccountId={filterAccount !== 'all' ? filterAccount : ''}
                            onSelect={({ marketplaceKey, accountId }) => {
                                setFilterMarketplace(marketplaceKey);
                                setFilterAccount(accountId);
                                setFilterType('all');
                                setPagination(prev => ({ ...prev, page: 1 }));
                                if (accountId) {
                                    localStorage.setItem('dashboardSelectedMarketplaces', JSON.stringify([accountId]));
                                    localStorage.setItem('uploads_marketplaceId', accountId);
                                    localStorage.setItem('uploads_marketplaceKey', marketplaceKey);
                                    localStorage.setItem('uploadHist_marketplace', marketplaceKey);
                                    localStorage.setItem('uploadHist_account', accountId);
                                }
                            }}
                        />

                        {/* Type Filter - Only show when marketplace is selected */}
                        {filterMarketplace !== 'all' && (
                            <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                                <select
                                    value={filterType}
                                    onChange={(e) => {
                                        setFilterType(e.target.value);
                                        setPagination(prev => ({ ...prev, page: 1 }));
                                    }}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-colors min-w-[140px]"
                                >
                                    <option value="all">All Types</option>
                                    {availableUploadTypes.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Status Filter - Always visible */}
                        <div className="flex flex-col gap-1">
                            <select
                                value={filterStatus}
                                onChange={(e) => {
                                    setFilterStatus(e.target.value);
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-colors min-w-[140px]"
                            >
                                <option value="all">All Status</option>
                                <option value="completed">Completed</option>
                                <option value="processing">Processing</option>
                                <option value="failed">Failed</option>
                                <option value="validation_failed">Validation Failed</option>
                                <option value="cancelled">Cancelled</option>
                                {canDeleteUploads && (
                                    <>
                                        <option value="deletion_failed">Deletion Failed</option>
                                        <option value="deleted">Deleted</option>
                                    </>
                                )}
                            </select>
                        </div>

                        {/* Clear Filters Button */}
                        {(filterMarketplace !== 'all' || filterAccount !== 'all' || filterType !== 'all' || filterStatus !== 'all') && (
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => {
                                        setFilterMarketplace('all');
                                        setFilterAccount('all');
                                        setFilterType('all');
                                        setFilterStatus('all');
                                        setPagination(prev => ({ ...prev, page: 1 }));
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 bg-transparent p-4 md:p-8">
                {/* History Table */}
                <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-auto">
                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-brand-600" size={32} />
                        </div>
                    ) : (!filterMarketplace || filterMarketplace === 'all' || !filterAccount || filterAccount === 'all') ? (
                        <div className="text-center py-16 px-4 animate-in fade-in duration-300">
                            <div className="w-16 h-16 bg-slate-100 mx-auto rounded-2xl flex items-center justify-center mb-4 text-slate-400 shadow-sm border border-slate-200">
                                <FileSpreadsheet size={30} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 mb-1">No Account Selected</h3>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                Please select a marketplace and account from the filter above to view upload history.
                            </p>
                        </div>
                    ) : uploadHistory.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-500">No uploads found.</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase max-w-[30%]">File Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Source</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Rows</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {uploadHistory.map((upload) => (
                                <tr key={upload.uploadId} className="hover:bg-slate-50 transition-colors">
                                     <td className="px-6 py-4 text-xs text-slate-800 font-medium">
                                        <div className="max-w-md break-all">
                                            {upload.fileName.replace(/^uploads\//, '').replace(/^[\w-]+-auto-sync\/[a-f0-9]{24}\//, '')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs ${upload.uploadType.startsWith('meesho_')
                                            ? 'bg-purple-100 text-purple-700'
                                            : upload.uploadType.startsWith('amazon_')
                                                ? 'bg-orange-100 text-orange-700'
                                                : upload.uploadType.startsWith('myntra_')
                                                    ? 'bg-pink-100 text-pink-700'
                                                    : 'bg-slate-100 text-slate-700'
                                            }`}>
                                            {formatUploadType(upload.uploadType)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {upload.source === 'sync' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-teal-100 text-teal-700">
                                                Auto-Sync
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600">
                                                Manual
                                            </span>
                                        )}
                                    </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const detail = getStatusDetail(upload);
                                                const iconColor = {
                                                    error: 'text-red-400',
                                                    warning: 'text-amber-500',
                                                    info: 'text-slate-400',
                                                };
                                                return (
                                                    <div
                                                        className="flex items-center gap-2"
                                                        title={detail ? (detail.full || detail.message) : undefined}
                                                    >
                                                        {getStatusIcon(upload.status)}
                                                        {getStatusBadge(upload.status)}
                                                        {detail && (
                                                            <Info
                                                                size={13}
                                                                className={`shrink-0 cursor-help ${iconColor[detail.type]}`}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{upload.rowCount || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            <div>
                                                {new Date(upload.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })},&nbsp;
                                                {new Date(upload.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-xs text-slate-400 border-b border-dotted border-slate-300 w-fit cursor-default">
                                                {getRelativeTime(upload.createdAt)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {upload.status === 'completed' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/upload-history/${upload.uploadId}`)}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm"
                                                        title="View Data"
                                                    >
                                                        <Eye size={16} />
                                                        View Data
                                                    </button>
                                                )}

                                                {upload.status === 'completed' && upload.fileName && (() => {
                                                    const isOld = new Date() - new Date(upload.createdAt) > 365 * 24 * 60 * 60 * 1000;
                                                    return (
                                                        <button
                                                            type="button"
                                                            disabled={isOld}
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (isOld) return;
                                                                try {
                                                                    const { data } = await api.get(`/upload/${upload.uploadId}/download`);
                                                                    if (data.downloadUrl) {
                                                                        window.location.assign(data.downloadUrl);
                                                                    } else {
                                                                        alert('Failed to get download link');
                                                                    }
                                                                } catch (error) {
                                                                    console.error('Error downloading file:', error);
                                                                    alert('Failed to get download link');
                                                                }
                                                            }}
                                                            className={`flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-sm ${isOld ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 transition-colors'
                                                                }`}
                                                            title={isOld ? "Download expired (older than 365 days)" : "Download Original File"}
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                    );
                                                })()}

                                                {canDeleteUploads && (
                                                    <button
                                                        type="button"
                                                        disabled={!canDeleteUpload(upload.status)}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (!canDeleteUpload(upload.status)) return;
                                                            setDeleteTarget(upload);
                                                            setDeleteConfirmText('');
                                                        }}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${canDeleteUpload(upload.status)
                                                            ? 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                                            : 'bg-slate-50 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'
                                                            }`}
                                                        title={
                                                            canDeleteUpload(upload.status)
                                                                ? 'Delete upload + all derived data (cascade)'
                                                                : 'Cannot delete while in-flight'
                                                        }
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                                
                                            {upload.status === 'failed' && canRetryUploads && dlqUploadIds.includes(upload.uploadId) && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleRetryUpload(upload.uploadId);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-white text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors text-sm"
                                                    title="Retry from Dead Letter Queue"
                                                >
                                                    <RefreshCw size={16} />
                                                </button>
                                            )}
                                        </div>
                                            {upload.status === 'deletion_failed' && upload.errorMessage && (
                                                <div className="mt-2 text-xs text-red-600 max-w-md truncate" title={upload.errorMessage}>
                                                    {upload.errorMessage}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Pagination Controls */}
                    {!loadingHistory && uploadHistory.length > 0 && pagination.totalPages > 1 && (
                        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200">
                            <p className="text-sm text-slate-600">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} uploads
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={pagination.page === 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <div className="flex items-center gap-2 px-3">
                                    <span className="text-sm text-slate-600">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </span>
                                </div>
                                <button
                                    disabled={pagination.page === pagination.totalPages}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Cascade-delete confirmation modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-red-50 rounded-lg shrink-0">
                                <Trash2 size={20} className="text-red-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-lg font-bold text-slate-900">Delete upload + all derived data?</h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    This permanently removes every row this upload produced across Postgres
                                    (marketplace tables, calculations), the original file in GCS,
                                    and the upload record itself. It cannot be undone.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                            <div className="text-slate-500 text-xs">File</div>
                            <div className="mt-1 inline-flex max-w-full rounded-md border border-red-200 bg-red-50 px-2 py-1 font-semibold text-red-800 shadow-sm" title={deleteTarget.fileName}>
                                <span className="truncate">
                                    {shortenFilename(deleteTarget.fileName || '')}
                                </span>
                            </div>
                            <div className="mt-1.5 text-slate-500 text-xs">Upload ID</div>
                            <div className="font-mono text-xs text-slate-800 break-all">{deleteTarget.uploadId}</div>
                        </div>

                        <label className="block mt-4 text-sm font-medium text-slate-700">
                            Type the upload ID to confirm:
                        </label>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={deleteTarget.uploadId}
                            className="mt-1.5 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                            autoFocus
                        />

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}
                                disabled={deletingNow}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitDelete}
                                disabled={deletingNow || deleteConfirmText !== deleteTarget.uploadId}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                {deletingNow && <Loader2 size={14} className="animate-spin" />}
                                Delete permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadHistoryTab;

