import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, Clock, CheckCircle, XCircle, Trash2, RefreshCw, Calendar, Store } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import api from '../api';
import { useAuth } from '../AuthContext';
import { TOUR } from '../tour/targets';
import MarketplaceAccountSelector from '../components/MarketplaceAccountSelector';

const Downloads = () => {
    const { user } = useAuth();
    const canRetryExports = user?.role === 'SuperAdmin' || user?.role === 'SBM' || user?.role === 'RM';
    const [exports, setExports] = useState([]);
    const [dlqExportIds, setDlqExportIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState(() => {
        try {
            const savedFilters = localStorage.getItem('downloadFilters');
            if (savedFilters) {
                return JSON.parse(savedFilters);
            }
        } catch (e) {
            console.error('Failed to load filters from localStorage', e);
        }
        return {
            exportType: '',
            marketplaceKey: '',
            marketplaceId: '',
            status: ''
        };
    });
    const [marketplaces, setMarketplaces] = useState([]);
    const [pollingExports, setPollingExports] = useState(new Set());

    // Save filters to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('downloadFilters', JSON.stringify(filters));
        } catch (e) {
            console.error('Failed to save filters to localStorage', e);
        }
    }, [filters]);

    // Fetch marketplaces once on initial mount
    useEffect(() => {
        const fetchMarketplaces = async () => {
            try {
                const response = await api.get('/marketplaces/filter-options?includeInactive=true');
                const data = response.data || [];
                setMarketplaces(data);

                if (data.length > 0) {
                    const savedId = localStorage.getItem('uploads_marketplaceId') || filters.marketplaceId;
                    const matchingMp = data.find(m => m.accounts?.some(a => a._id === savedId));
                    if (matchingMp) {
                        setFilters(prev => {
                            if (prev.marketplaceId === savedId && prev.marketplaceKey === matchingMp.key) return prev;
                            return { ...prev, marketplaceKey: matchingMp.key, marketplaceId: savedId };
                        });
                    } else {
                        const firstWithActive = data.find(m => m.accounts?.some(a => a.status !== 'inactive')) || data[0];
                        const firstAcc = firstWithActive?.accounts?.find(a => a.status !== 'inactive') || firstWithActive?.accounts?.[0];
                        if (firstWithActive && firstAcc) {
                            setFilters(prev => {
                                if (prev.marketplaceId === firstAcc._id && prev.marketplaceKey === firstWithActive.key) return prev;
                                return { ...prev, marketplaceKey: firstWithActive.key, marketplaceId: firstAcc._id };
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching marketplaces:', err);
            }
        };

        fetchMarketplaces();
    }, []);

    // Fetch exports whenever page or filters change
    useEffect(() => {
        fetchExports();
    }, [currentPage, filters.exportType, filters.marketplaceId, filters.status]);

    // Poll for pending/processing exports every 5 seconds
    useEffect(() => {
        if (pollingExports.size === 0) return;
        const interval = setInterval(() => {
            fetchExports(true);
        }, 5000);

        return () => clearInterval(interval);
    }, [pollingExports]);

    // Fetch DLQ IDs if user has retry permissions
    useEffect(() => {
        if (!canRetryExports) return;

        // Stop background polling when there are no failed exports visible
        const hasFailedExports = exports.some(e => e.status === 'failed');
        if (!hasFailedExports) return;

        const fetchDlqIds = async () => {
            try {
                const response = await api.get('/downloads/dlq/ids');
                const ids = Array.isArray(response.data) ? response.data : (response.data?.data || []);
                setDlqExportIds(ids);
            } catch (err) {
                console.error('Failed to fetch DLQ export IDs', err);
            }
        };
        fetchDlqIds();
        const dlqInterval = setInterval(fetchDlqIds, 30000);
        return () => clearInterval(dlqInterval);
    }, [canRetryExports, exports]);

    const fetchExports = async (silent = false) => {
        if (!silent) setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: 20,
                ...(filters.exportType && { exportType: filters.exportType }),
                ...(filters.marketplaceId && { marketplaceId: filters.marketplaceId }),
                ...(filters.status && { status: filters.status })
            });

            const response = await api.get(`/downloads/history?${params}`);

            setExports(response.data.exports);
            setTotalPages(response.data.pagination.total_pages);

            // Track exports that need polling
            const needsPolling = new Set();
            response.data.exports.forEach(exp => {
                if (exp.status === 'pending' || exp.status === 'processing') {
                    needsPolling.add(exp._id);
                }
            });
            setPollingExports(needsPolling);
        } catch (err) {
            setError('Failed to fetch exports');
            console.error('Error fetching exports:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleDownload = async (exportId) => {
        try {
            const response = await api.post(`/downloads/${exportId}/download`);
            // Open download URL in new tab
            window.open(response.data.download_url, '_blank');
            // Refresh the list to update download count
            fetchExports(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to get download URL');
        }
    };

    const handleDelete = async (exportId) => {
        if (!window.confirm('Are you sure you want to delete this export?')) {
            return;
        }

        try {
            await api.delete(`/downloads/${exportId}`);
            fetchExports(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete export');
        }
    };

    const handleRetryExport = async (exportId) => {
        try {
            await api.post(`/downloads/${exportId}/retry`);
            setDlqExportIds(prev => prev.filter(id => id !== exportId));
            fetchExports(true);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to retry export');
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Pending' },
            processing: { color: 'bg-blue-100 text-blue-800', icon: RefreshCw, text: 'Processing' },
            completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Ready' },
            failed: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Failed' }
        };

        const config = statusConfig[status] || statusConfig.pending;
        const Icon = config.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
                <Icon size={14} className={status === 'processing' ? 'animate-spin' : ''} />
                {config.text}
            </span>
        );
    };

    const getExportTypeLabel = (type) => {
        const labels = {
            cost_sheet: 'Cost Sheet',
            payment_metrics: 'Payment Metrics',
            payment_calculations: 'Payment Calculations',
            master_sku_calculations: 'Master SKU Calculations',
            pending_payments: 'Pending Payments'
        };
        return labels[type] || type;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDateRange = (startDate, endDate, filters) => {
        if (filters?.nullOrderDate) return 'N/A';
        if (!startDate && !endDate) return 'All Time';

        const formatShort = (date) => {
            if (!date) return '';
            return new Date(date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        };

        if (startDate && endDate) {
            return `${formatShort(startDate)} - ${formatShort(endDate)}`;
        } else if (startDate) {
            return `From ${formatShort(startDate)}`;
        } else {
            return `Until ${formatShort(endDate)}`;
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return 'N/A';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const getTimeRemaining = (expiresAt) => {
        if (!expiresAt) return 'N/A';

        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;

        if (diff <= 0) return 'Expired';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h`;
    };

    return (
        <DashboardLayout>
            <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">
                {/* Header */}
                <header data-tour={TOUR.downloads.header} className="bg-slate-50 backdrop-blur-md sticky top-0 z-10 px-8 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-heading font-bold text-slate-800 flex items-center gap-3">
                            Downloads Management
                        </h2>
                    </div>
                </header>

                <main className="flex-1 w-full flex flex-col overflow-hidden relative">
                    {/* Filters */}
                    <div data-tour={TOUR.downloads.filters} className="z-10 bg-slate-50/90 backdrop-blur-md pt-2 pb-3 px-4 md:px-8 border-b border-slate-200/40 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] shrink-0">
                        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                            <div className="flex flex-wrap items-center gap-4">
                                <MarketplaceAccountSelector
                                    marketplaces={marketplaces}
                                    disableInactiveAccounts={false}
                                    selectedMarketplaceKey={filters.marketplaceKey}
                                    selectedAccountId={filters.marketplaceId}
                                    onSelect={({ marketplaceKey, accountId }) => {
                                        setFilters(prev => ({ ...prev, marketplaceKey, marketplaceId: accountId }));
                                        setCurrentPage(1);
                                    }}
                                />

                                <div className="flex flex-col gap-1">
                                    <select
                                        value={filters.exportType}
                                        onChange={(e) => {
                                            setFilters({ ...filters, exportType: e.target.value });
                                            setCurrentPage(1);
                                        }}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-colors min-w-[160px]"
                                    >
                                        <option value="">All Types</option>
                                        <option value="cost_sheet">Cost Sheet</option>
                                        <option value="payment_metrics">Payment Metrics</option>
                                        <option value="payment_calculations">Payment Calculations</option>
                                        <option value="master_sku_calculations">Master SKU Calculations</option>
                                        <option value="pending_payments">Pending Payments</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <select
                                        value={filters.status}
                                        onChange={(e) => {
                                            setFilters({ ...filters, status: e.target.value });
                                            setCurrentPage(1);
                                        }}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-colors min-w-[140px]"
                                    >
                                        <option value="">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="processing">Processing</option>
                                        <option value="completed">Ready</option>
                                        <option value="failed">Failed</option>
                                    </select>
                                </div>

                                {(filters.exportType || filters.marketplaceId || filters.marketplaceKey || filters.status) && (
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => {
                                                setFilters({ exportType: '', marketplaceKey: '', marketplaceId: '', status: '' });
                                                setCurrentPage(1);
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

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-gradient-to-br from-gray-50 to-slate-100/80">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                                {error}
                            </div>
                        )}

                        {/* Table */}
                        <div data-tour={TOUR.downloads.table} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <RefreshCw className="animate-spin text-brand-600" size={32} />
                                </div>
                            ) : exports.length === 0 ? (
                                <div className="text-center py-20">
                                    <FileSpreadsheet size={48} className="mx-auto text-slate-300 mb-4" />
                                    <p className="text-slate-500 text-lg">No exports found</p>
                                    <p className="text-slate-400 text-sm mt-2">
                                        Create an export from the Dashboard, Cost Sheet, or Payments pages
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                        Type
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                        Marketplace
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                        Date Range
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                        Created
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                        Status
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                        File Size
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                        Expires
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {exports.map((exp) => (
                                                    <tr key={exp._id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <FileSpreadsheet size={18} className="text-brand-600" />
                                                                <span className="text-sm font-medium text-slate-700">
                                                                    {getExportTypeLabel(exp.export_type)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <Store size={16} className="text-slate-400" />
                                                                <div>
                                                                    <div className="text-sm font-medium text-slate-700">
                                                                        {exp.marketplace_name}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">
                                                                        {exp.marketplace_key}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar size={16} className="text-slate-400" />
                                                                <span className="text-sm text-slate-600">
                                                                    {formatDateRange(exp.filters?.startDate, exp.filters?.endDate, exp.filters)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-slate-600">
                                                                {formatDate(exp.created_at)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {getStatusBadge(exp.status)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-slate-600">
                                                                {formatFileSize(exp.file_size)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-slate-600">
                                                                {getTimeRemaining(exp.expires_at)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {exp.status === 'completed' && (
                                                                    <button
                                                                        data-tour={TOUR.downloads.downloadBtn}
                                                                        onClick={() => handleDownload(exp._id)}
                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
                                                                    >
                                                                        <Download size={16} />
                                                                        Download
                                                                    </button>
                                                                )}
                                                                {exp.status === 'failed' && exp.error_message && (
                                                                    <span className="text-xs text-red-600" title={exp.error_message}>
                                                                        Error
                                                                    </span>
                                                                )}
                                                                {exp.status === 'failed' && canRetryExports && dlqExportIds.includes(exp._id) && (
                                                                    <button
                                                                        onClick={() => handleRetryExport(exp._id)}
                                                                        className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                                        title="Retry from Dead Letter Queue"
                                                                    >
                                                                        <RefreshCw size={16} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDelete(exp._id)}
                                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                                            <div className="text-sm text-slate-600">
                                                Page {currentPage} of {totalPages}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
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
                </main>
            </div>
        </DashboardLayout>
    );
};
export default Downloads;