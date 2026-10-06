import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import api from '../api';
import { useAuth } from '../AuthContext';
import { FileSpreadsheet, DollarSign, Loader2, CheckCircle, XCircle, Clock, FileText, RotateCcw, AlertCircle, Package, TrendingUp, RefreshCw, FileBarChart, Trash2, Upload, ShieldCheck, Settings, PlayCircle } from 'lucide-react';
import FileSelector from '../components/FileSelector';
import UploadQueue, { calculateQueueStats } from '../components/UploadQueue';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { toast } from 'sonner';
import UploadHistoryTab from './UploadHistory';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
import QueueLimitModal from '../components/QueueLimitModal';
import YouTubeModal from '../components/YouTubeModal';
import MarketplaceAccountSelector from '../components/MarketplaceAccountSelector';

const MAX_FILES_PER_UPLOAD = 5;

// Step number badge
const StepBadge = ({ number }) => (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-2 flex-shrink-0">
        {number}
    </span>
);

// Map of YouTube tutorial links for each upload type
const YOUTUBE_TUTORIAL_LINKS = {
    // Amazon
    'amazon_payments': 'https://youtu.be/GOwS45rgN-Y?si=WD7OUBfWk0grxU7U',
    'amazon_orders': 'https://youtu.be/T5iOjMXuA6E?si=zNxhV5IRziwg-PUC',
    'amazon_ads': 'https://youtu.be/Hs5ib93Rec4?si=LNe0tsklWKUWtYvV',
    'amazon_returns': 'https://youtu.be/e-ZU750zipA?si=zCzSwh5p4a0HBkFY',
    'amazon_b2b_b2c': 'https://youtu.be/621qyZvZdgo?si=K3fcmywAZ1Knl89J',
    // Meesho
    'meesho_payments': 'https://youtu.be/oKk4mhG1t2I?si=b9iIviPJF2dWxH2z',
    'meesho_sales': 'https://youtu.be/TxE8SmhZKSs?si=eRP7K2mR5f0VcL-8',
    'meesho_claims': 'https://youtu.be/wJlegzsrZs8?si=Q3_gpWRh7_v8_ZED',
    'meesho_returns': 'https://youtu.be/jYmtQBQtCcY?si=V5vqI1moIdUuJWry',
    // Flipkart / General
    'orders': 'https://youtu.be/jk0XOVzMjtI?si=S3KOwG4XemZU0ukB',
    'payments': 'https://youtu.be/_mIa0d73DhA?si=RWIbAA93BM6IgH4c',
    'ads': 'https://youtu.be/DzFRvw2q-pw?si=-mP1gV4eLDjFkgjc',
    'costsheet': 'https://youtube.com/watch?v=placeholder_costsheet'
};

// Upload type selection card
const UploadTypeCard = ({ id, currentId, onClick, icon: Icon, title, subtitle, onOpenVideo }) => {
    const isSelected = currentId === id;
    const videoLink = YOUTUBE_TUTORIAL_LINKS[id] && !YOUTUBE_TUTORIAL_LINKS[id].includes('placeholder_') ? YOUTUBE_TUTORIAL_LINKS[id] : null;

    return (
        <div className="relative group w-full h-full">
            <button
                onClick={() => onClick(id)}
                className={`p-3 rounded-xl border-2 transition-all duration-150 min-h-[108px] h-full flex flex-col items-center justify-center gap-2 outline-none w-full ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 bg-white'
                    }`}
            >
                <Icon
                    size={26}
                    strokeWidth={1.5}
                    className={`transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}
                />
                <div className="text-center">
                    <h3 className={`font-semibold text-xs sm:text-sm leading-tight ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
                        {title}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{subtitle}</p>
                </div>
            </button>
            {videoLink && (
                <div className="absolute top-2 right-2 z-10 block">
                    <button
                        type="button"
                        className="text-red-400 hover:text-red-600 bg-white hover:bg-red-50 rounded-full p-1.5 shadow-sm border border-gray-200 hover:border-red-200 transition-all flex items-center justify-center"
                        title="Watch Upload Tutorial"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenVideo?.(videoLink, `${title} Tutorial`);
                        }}
                    >
                        <PlayCircle size={18} strokeWidth={2} />
                    </button>
                </div>
            )}
        </div>
    );
};

const Uploads = () => {
    const { user, isImpersonating } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => {
        return searchParams.get('tab') === 'history' ? 'history' : 'upload';
    });

    // Redirect to valid tab based on permissions (non-User roles always have access)
    useEffect(() => {
        const isUser = user?.role === 'User';
        const canUpload = !isUser || user?.permissions?.uploadNew;
        const canViewHistory = !isUser || user?.permissions?.uploadHistory;
        if (activeTab === 'upload' && !canUpload && canViewHistory) {
            setActiveTab('history');
        } else if (activeTab === 'history' && !canViewHistory && canUpload) {
            setActiveTab('upload');
        }
    }, [user?.role, user?.permissions?.uploadNew, user?.permissions?.uploadHistory, activeTab]);

    useEffect(() => {
        if (activeTab === 'history') {
            setSearchParams({ tab: 'history' }, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    }, [activeTab, setSearchParams]);

    const [uploadType, setUploadType] = useState(() => localStorage.getItem('uploads_type') || 'orders');
    useEffect(() => {
        localStorage.setItem('uploads_type', uploadType);
    }, [uploadType]);

    const [uploadHistory, setUploadHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [filterType, setFilterType] = useState('all');

    const uploadQueue = useUploadQueue({
        maxConcurrentUploads: 3,
    });

    // Initial account: own saved value first, else fall back to whatever the Dashboard tab has selected
    const [marketplaceId, setMarketplaceId] = useState(() => {
        const saved = localStorage.getItem('uploads_marketplaceId');
        if (saved) return saved;
        try {
            const dashSaved = localStorage.getItem('dashboardSelectedMarketplaces');
            if (dashSaved) {
                const parsed = JSON.parse(dashSaved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
            }
        } catch (_) { }
        return '';
    });
    useEffect(() => {
        localStorage.setItem('uploads_marketplaceId', marketplaceId);
    }, [marketplaceId]);

    const [selectedMarketplaceKey, setSelectedMarketplaceKey] = useState(() => localStorage.getItem('uploads_marketplaceKey') || '');
    useEffect(() => {
        if (selectedMarketplaceKey) {
            localStorage.setItem('uploads_marketplaceKey', selectedMarketplaceKey);
        }
    }, [selectedMarketplaceKey]);

    const [allMarketplaces, setAllMarketplaces] = useState([]); // includes inactive — used by Upload History filter
    const [activeMarketplaces, setActiveMarketplaces] = useState([]);
    const [loadingMarketplaces, setLoadingMarketplaces] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, files: [], uploadType: '', marketplaceId: '', marketplaceName: '', accountName: '' });
    const [fileLimitModal, setFileLimitModal] = useState({ isOpen: false, totalFiles: 0, limit: MAX_FILES_PER_UPLOAD });
    const [tutorialVideo, setTutorialVideo] = useState(null);

    const selectedMarketplace = activeMarketplaces.find(m =>
        m.accounts?.some(acc => acc._id === marketplaceId)
    ) || activeMarketplaces.find(m => m.key === selectedMarketplaceKey);
    const marketplaceKey = selectedMarketplace?.key?.toLowerCase() || '';
    const selectedAccount = selectedMarketplace?.accounts?.find(acc => acc._id === marketplaceId);
    const isMeeshoMarketplace = marketplaceKey === 'meesho';
    const isMyntraMarketplace = marketplaceKey === 'myntra';
    const isAmazonMarketplace = marketplaceKey.includes('amazon');

    const deriveUploadType = (key) => {
        const lowerKey = key?.toLowerCase() || '';
        if (lowerKey === 'meesho') return 'meesho_payments';
        if (lowerKey.includes('amazon')) return 'amazon_payments';
        if (lowerKey === 'myntra') return 'myntra_payments';
        return 'orders';
    };

    // Called when the user picks a different account (also derives and syncs its marketplace)
    const handleAccountSelect = (newId) => {
        setMarketplaceId(newId);
        localStorage.setItem('uploads_marketplaceId', newId);
        localStorage.setItem('uploadHist_account', newId);
        localStorage.setItem('dashboardSelectedMarketplaces', JSON.stringify([newId]));

        const mp = activeMarketplaces.find(m => m.accounts?.some(acc => acc._id === newId));
        const key = mp?.key || selectedMarketplaceKey;
        if (mp) {
            setSelectedMarketplaceKey(mp.key);
            localStorage.setItem('uploads_marketplaceKey', mp.key);
            localStorage.setItem('uploadHist_marketplace', mp.key);
        }
        setUploadType(deriveUploadType(key));
    };

    const [costSheetUploadEnabled, setCostSheetUploadEnabled] = useState(false);

    // Compute queue stats at component level — no IIFE needed
    const queueStats = calculateQueueStats(uploadQueue.state.files);
    const hasFiles = uploadQueue.state.files.length > 0;

    // Warn user before refreshing/closing when uploads are in progress
    useEffect(() => {
        const hasActiveUploads = uploadQueue.state.files.some(f =>
            ['queued', 'uploading'].includes(f.stage)
        );
        if (!hasActiveUploads) return;

        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [uploadQueue.state.files]);

    // Track previous completed count to avoid spamming fetchUploadHistory
    const prevCompletedCountRef = useRef(0);

    useEffect(() => {
        fetchFeatureFlags();
        fetchAllMarketplaces(); // fetch all (including inactive) for history filters
        const canUpload = user?.role !== 'User' || user?.permissions?.uploadNew;
        if (user?.role === 'User' && !canUpload) {
            setActiveTab('history');
        }
        fetchActiveMarketplaces();
    }, [user]);

    const fetchFeatureFlags = async () => {
        try {
            const { data } = await api.get('/config/features');
            setCostSheetUploadEnabled(data.costSheetUploadEnabled || false);
        } catch (error) {
            console.error('Error fetching feature flags', error);
            setCostSheetUploadEnabled(false);
        }
    };

    const fetchActiveMarketplaces = async () => {
        setLoadingMarketplaces(true);
        try {
            const { data } = await api.get('/marketplaces/filter-options');
            setActiveMarketplaces(data);

            if (data && data.length > 0) {
                let targetAccId = marketplaceId;
                let matchingMp = data.find(m => m.accounts?.some(acc => acc._id === targetAccId));

                // Own saved account not found — fall back to the Dashboard tab's selection
                if (!matchingMp) {
                    try {
                        const dashSaved = localStorage.getItem('dashboardSelectedMarketplaces');
                        if (dashSaved) {
                            const parsed = JSON.parse(dashSaved);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                const dashAccId = parsed[0];
                                matchingMp = data.find(m => m.accounts?.some(acc => acc._id === dashAccId));
                                if (matchingMp) targetAccId = dashAccId;
                            }
                        }
                    } catch (_) { }
                }

                // Still nothing — default to the first marketplace/account
                if (!matchingMp) {
                    matchingMp = data[0];
                    targetAccId = matchingMp?.accounts?.[0]?._id || '';
                }

                setSelectedMarketplaceKey(matchingMp.key);
                localStorage.setItem('uploads_marketplaceKey', matchingMp.key);
                setMarketplaceId(targetAccId);
                setUploadType(deriveUploadType(matchingMp.key));
            }
        } catch (error) {
            console.error('Error fetching marketplaces', error);
        } finally {
            setLoadingMarketplaces(false);
        }
    };

    const fetchAllMarketplaces = async () => {
        try {
            const { data } = await api.get('/marketplaces/filter-options?includeInactive=true');
            setAllMarketplaces(data);
        } catch (error) {
            console.error('Error fetching all marketplaces', error);
        }
    };

    useEffect(() => {
        let pollInterval;

        const startPollingHistory = (currentUploads) => {
            const activeUploads = currentUploads.filter(u =>
                ['processing', 'pending', 'validating'].includes(u.status)
            );
            if (activeUploads.length === 0) return;

            pollInterval = setInterval(async () => {
                try {
                    const uploadIds = activeUploads.map(u => u.uploadId);
                    const { data: statuses } = await api.post('/upload/status', { uploadIds });

                    setUploadHistory(prev => {
                        const newUploads = [...prev];
                        let stillActive = false;
                        statuses.forEach(statusUpdate => {
                            const index = newUploads.findIndex(u => u.uploadId === statusUpdate.uploadId);
                            if (index !== -1) {
                                newUploads[index] = { ...newUploads[index], ...statusUpdate };
                                if (['processing', 'pending', 'validating'].includes(statusUpdate.status)) {
                                    stillActive = true;
                                }
                            }
                        });
                        if (!stillActive) clearInterval(pollInterval);
                        return newUploads;
                    });
                } catch (error) {
                    console.error('Error polling history status', error);
                }
            }, 5000);
        };

        if (activeTab === 'history') {
            fetchUploadHistory(startPollingHistory);
        }

        return () => { if (pollInterval) clearInterval(pollInterval); };
    }, [activeTab]);

    const fetchUploadHistory = async (callback) => {
        setLoadingHistory(true);
        try {
            const { data } = await api.get('/upload');
            // Check if backend returns `{ uploads: [...] }` or `[...]`
            const historyData = Array.isArray(data) ? data : (data.uploads || []);
            setUploadHistory(historyData);
            if (callback) callback(historyData);
        } catch (error) {
            console.error('Error fetching upload history', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleFilesSelected = (files) => {
        if (!marketplaceId) { toast.error('Please select an account first'); return; }
        if (!uploadType) { toast.error('Please select an upload type'); return; }

        const limit = uploadType === 'myntra_payments' ? 30 : MAX_FILES_PER_UPLOAD;

        if (files.length > limit) {
            setFileLimitModal({ isOpen: true, totalFiles: files.length, limit });
            return;
        }
        setConfirmModal({
            isOpen: true,
            files,
            uploadType,
            marketplaceId,
            marketplaceName: selectedMarketplace?.key || '',
            accountName: selectedAccount?.name || '',
        });
    };

    const handleConfirmUpload = () => {
        uploadQueue.addFiles(confirmModal.files, confirmModal.uploadType, confirmModal.marketplaceId);
        setConfirmModal({ isOpen: false, files: [], uploadType: '', marketplaceId: '', marketplaceName: '', accountName: '' });
    };

    const handleCancelConfirm = () => {
        setConfirmModal({ isOpen: false, files: [], uploadType: '', marketplaceId: '', marketplaceName: '', accountName: '' });
    };

    const handleRetry = (fileId) => uploadQueue.retryFile(fileId);
    const handleRemove = (fileId) => uploadQueue.removeFile(fileId);
    const handleApprove = (fileId) => uploadQueue.approveFile(fileId);
    const handleReject = (fileId) => uploadQueue.cancelFile(fileId);
    const handleApproveAll = () => uploadQueue.approveAllValid();
    const handleRetryAll = () => {
        const failedFiles = uploadQueue.state.files.filter(f => f.error && f.retryable);
        failedFiles.forEach(file => uploadQueue.retryFile(file.id));
        if (failedFiles.length > 0) toast.info(`Retrying ${failedFiles.length} failed file(s)`);
    };
    const handleClearCompleted = () => uploadQueue.clearCompleted();
    const handleClearAll = () => uploadQueue.clearAll();
    const handleCancelAll = () => uploadQueue.cancelAll();

    // Fetch upload history only when completed count increases (not on every state change)
    useEffect(() => {
        const completedCount = uploadQueue.state.files.filter(f => f.stage === 'completed').length;
        if (completedCount > prevCompletedCountRef.current) {
            fetchUploadHistory();
            prevCompletedCountRef.current = completedCount;
        }
    }, [uploadQueue.state.files]);

    const filteredHistory = filterType === 'all'
        ? uploadHistory
        : uploadHistory.filter(u => u.uploadType === filterType);

    const formatUploadType = (type) => {
        const typeLabels = {
            orders: 'Orders', payments: 'Payments', ads: 'Ads',
            costsheet: 'Cost Sheet', meesho_payments: 'Meesho Payments',
            meesho_sales: 'Meesho Sales', meesho_claims: 'Meesho Claims',
            meesho_returns: 'Meesho Returns', amazon_payments: 'Amazon Payments',
            amazon_orders: 'Amazon Orders', amazon_ads: 'Amazon Ads',
            amazon_returns: 'Amazon Returns', amazon_b2b_b2c: 'Amazon B2B/B2C',
            myntra_payments: 'Myntra Payments', myntra_orders: 'Myntra Orders',
            myntra_returns_seller: 'Myntra Returns (Seller)', myntra_returns_delivery: 'Myntra Returns (Delivery)'
        };
        return typeLabels[type] || type;
    };

    const shortenFilename = (filename) => {
        let cleanName = filename.replace(/^uploads\//, '');
        // Strip auto-sync GCS path prefix (e.g. "meesho-auto-sync/{objectId}/")
        cleanName = cleanName.replace(/^[\w-]+-auto-sync\/[a-f0-9]{24}\//, '');
        // Strip the internal "_YYYY-MM-DDTHH-MM-SS-mmmZ" uniqueness suffix the
        // auto-sync services bake into the object key — meaningless to a user.
        cleanName = cleanName.replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/g, '');
        if (cleanName.length > 50) {
            return `${cleanName.substring(0, 25)}...${cleanName.substring(cleanName.length - 20)}`;
        }
        return cleanName;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle className="text-emerald-500" size={14} />;
            case 'failed':
            case 'validation_failed': return <XCircle className="text-red-500" size={14} />;
            case 'processing': return <Loader2 className="text-indigo-500 animate-spin" size={14} />;
            case 'validating': return <Loader2 className="text-orange-500 animate-spin" size={14} />;
            case 'validated': return <CheckCircle className="text-amber-500" size={14} />;
            default: return <Clock className="text-amber-500" size={14} />;
        }
    };

    const getStatusBadge = (status) => {
        const config = {
            completed: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Completed' },
            failed: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Failed' },
            validation_failed: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Validation Failed' },
            processing: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Processing' },
            validating: { cls: 'bg-orange-50 text-orange-600 border-orange-200', label: 'Validating' },
            pending: { cls: 'bg-slate-50 text-slate-600 border-slate-200', label: 'Pending' },
            validated: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Validated' },
        };
        const { cls, label } = config[status] || config.pending;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
                {getStatusIcon(status)}
                {label}
            </span>
        );
    };

    const formatDate = (dateStr) =>
        new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const memoizedMarketplaces = useMemo(() => {
        return (allMarketplaces.length > 0 ? allMarketplaces : activeMarketplaces)
            .map(m => ({ ...m, accounts: (m.accounts || []).filter(a => a.status !== 'inactive') }))
            .filter(m => (m.accounts || []).length > 0);
    }, [allMarketplaces, activeMarketplaces]);

    return (
        <DashboardLayout>
            <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">
                {/* Header */}
                <header className="bg-slate-50 backdrop-blur-md sticky top-0 z-10 px-8 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-heading font-bold text-slate-800 flex items-center gap-3">
                            Uploads Management
                        </h2>
                    </div>
                </header>

                <main className="flex-1 w-full flex flex-col overflow-hidden relative">
                    {/* Tab Navigation */}
                    <div className="z-10 bg-slate-50/90 backdrop-blur-md pt-2 pb-2 px-4 md:px-8 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl shadow-sm">
                                {(user?.role !== 'User' || user?.permissions?.uploadNew) && (
                                    <button
                                        onClick={() => setActiveTab('upload')}
                                        className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'upload'
                                            ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                            }`}
                                    >
                                        Upload New
                                    </button>
                                )}

                                {(user?.role !== 'User' || user?.permissions?.uploadHistory) && (
                                    <button
                                        onClick={() => setActiveTab('history')}
                                        className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'history'
                                            ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                            }`}
                                    >
                                        Upload History
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-br from-gray-50 to-slate-100/80">

                        {/* Upload Tab */}
                        {activeTab === 'upload' && (user?.role !== 'User' || user?.permissions?.uploadNew) && (
                            <div className={`p-4 md:p-8 grid grid-cols-1 gap-5 ${hasFiles ? 'xl:grid-cols-3' : ''}`}>

                                {/* Left: Upload Form */}
                                <div className={hasFiles ? 'xl:col-span-2' : ''}>
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
                                            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">New Upload</h2>
                                        </div>

                                        <div className="p-5 sm:p-7 space-y-7">
                                            {/* Step 1: Marketplace & Account Selection */}
                                            <div className="space-y-4">
                                                <label className="flex items-center text-sm font-semibold text-gray-800">
                                                    <StepBadge number="1" />
                                                    Select Account
                                                    <span className="text-red-400 ml-1">*</span>
                                                </label>
                                                {loadingMarketplaces ? (
                                                    <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                                                        <Loader2 className="animate-spin" size={15} /> Loading accounts...
                                                    </div>
                                                ) : activeMarketplaces.length === 0 ? (
                                                    <div className="p-3.5 bg-amber-50 text-amber-800 rounded-xl text-sm border border-amber-200 flex items-start gap-2.5">
                                                        <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                                        <span>No active marketplaces found. Go to <a href="/client/settings/marketplace" className="underline font-semibold hover:text-amber-900">Settings</a> to connect one.</span>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3.5">
                                                        <MarketplaceAccountSelector
                                                            marketplaces={memoizedMarketplaces}
                                                            disableInactiveAccounts={true}
                                                            selectedMarketplaceKey={selectedMarketplaceKey}
                                                            selectedAccountId={marketplaceId}
                                                            onSelect={({ accountId }) => {
                                                                handleAccountSelect(accountId);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Step 2: Upload Type */}
                                            {marketplaceId && (
                                                <div className="space-y-3 animate-slideInFromBottom">
                                                    <label className="flex items-center text-sm font-semibold text-gray-800">
                                                        <StepBadge number="2" />
                                                        Select Upload Type
                                                    </label>
                                                    {isAmazonMarketplace ? (
                                                        <div className={`grid gap-3 ${costSheetUploadEnabled ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
                                                            <UploadTypeCard id="amazon_payments" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={DollarSign} title="Payments" subtitle="Settlements" />
                                                            <UploadTypeCard id="amazon_orders" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={Package} title="Orders" subtitle="Order data" />
                                                            <UploadTypeCard id="amazon_ads" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={TrendingUp} title="Ads" subtitle="Brand/Display/Product" />
                                                            <UploadTypeCard id="amazon_returns" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={RefreshCw} title="Returns" subtitle="FBA/Flex/SmartHub" />
                                                            <UploadTypeCard id="amazon_b2b_b2c" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={FileBarChart} title="B2B/B2C" subtitle="Tax invoices" />
                                                            {costSheetUploadEnabled && (
                                                                <UploadTypeCard id="costsheet" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={FileText} title="Cost Sheet" subtitle="Cost sheet data" />
                                                            )}
                                                        </div>
                                                    ) : isMeeshoMarketplace ? (
                                                        <div className={`grid gap-3 ${costSheetUploadEnabled ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
                                                            <UploadTypeCard id="meesho_payments" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={DollarSign} title="Payments" subtitle="Payment settlement" />
                                                            <UploadTypeCard id="meesho_sales" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={Package} title="Sales" subtitle="Sales data" />
                                                            <UploadTypeCard id="meesho_claims" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={AlertCircle} title="Claims" subtitle="Claims data" />
                                                            <UploadTypeCard id="meesho_returns" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={RotateCcw} title="Returns" subtitle="Returns data" />
                                                            {costSheetUploadEnabled && (
                                                                <UploadTypeCard id="costsheet" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={FileText} title="Cost Sheet" subtitle="Cost sheet data" />
                                                            )}
                                                        </div>
                                                    ) : isMyntraMarketplace ? (
                                                        <div className={`grid gap-3 ${costSheetUploadEnabled ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
                                                            <UploadTypeCard id="myntra_payments" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={DollarSign} title="Payments" subtitle="Payment settlement" />
                                                            <UploadTypeCard id="myntra_orders" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={Package} title="Orders" subtitle="Order data" />
                                                            <UploadTypeCard id="myntra_returns_seller" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={RotateCcw} title="Seller Returns" subtitle="Returns data" />
                                                            <UploadTypeCard id="myntra_returns_delivery" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={RefreshCw} title="Delivery Returns" subtitle="Returns data" />
                                                            {costSheetUploadEnabled && (
                                                                <UploadTypeCard id="costsheet" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={FileText} title="Cost Sheet" subtitle="Cost sheet data" />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className={`grid gap-3 ${costSheetUploadEnabled ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                                                            <UploadTypeCard id="payments" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={DollarSign} title="Payments" subtitle="Payment settlement" />
                                                            <UploadTypeCard id="orders" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={FileSpreadsheet} title="Orders" subtitle="Order sheet data" />
                                                            <UploadTypeCard id="ads" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={FileSpreadsheet} title="Ads" subtitle="Ads campaign reports (PLA / PCA / Google)" />
                                                            {costSheetUploadEnabled && (
                                                                <UploadTypeCard id="costsheet" currentId={uploadType} onClick={setUploadType} onOpenVideo={(url, title) => setTutorialVideo({ url, title })} icon={FileText} title="Cost Sheet" subtitle="Cost sheet data" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Step 3: File Upload */}
                                            <div className="space-y-2.5">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <label className="flex items-center text-sm font-semibold text-gray-800">
                                                        <StepBadge number="3" />
                                                        Select Files
                                                        <span className="text-xs text-gray-400 font-normal ml-2">(Multiple files supported)</span>
                                                    </label>
                                                </div>
                                                <FileSelector
                                                    onFilesSelected={handleFilesSelected}
                                                    disabled={!marketplaceId || !uploadType}
                                                    multiple={true}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Upload Queue */}
                                {hasFiles && (
                                    <div className="xl:col-span-1">
                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">

                                            {/* Queue Header */}
                                            <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3.5 bg-gray-50/70">
                                                {/* Single row: Title left | badges + trash right */}
                                                <div className="flex items-center justify-between gap-2 mb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-semibold text-gray-900">Upload Queue</h3>
                                                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-semibold rounded-full">
                                                            {queueStats.total}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {/* Icon + spinner status badges */}
                                                        {queueStats.uploading > 0 && (
                                                            <div title={`${queueStats.uploading} uploading`} className="flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                                                                <Upload size={10} />
                                                                <Loader2 size={10} className="animate-spin" />
                                                                <span>{queueStats.uploading}</span>
                                                            </div>
                                                        )}
                                                        {queueStats.validating > 0 && (
                                                            <div title={`${queueStats.validating} validating`} className="flex items-center gap-0.5 text-[11px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">
                                                                <ShieldCheck size={10} />
                                                                <Loader2 size={10} className="animate-spin" />
                                                                <span>{queueStats.validating}</span>
                                                            </div>
                                                        )}
                                                        {queueStats.processing > 0 && (
                                                            <div title={`${queueStats.processing} processing`} className="flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-200">
                                                                <Settings size={10} />
                                                                <Loader2 size={10} className="animate-spin" />
                                                                <span>{queueStats.processing}</span>
                                                            </div>
                                                        )}
                                                        {queueStats.completedCount > 0 && queueStats.completedCount === queueStats.total && (
                                                            <div title="All done" className="flex items-center gap-0.5 text-[11px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                                                                <CheckCircle size={10} />
                                                            </div>
                                                        )}
                                                        {(queueStats.completedCount > 0 || queueStats.errors > 0) && (
                                                            <button
                                                                onClick={handleClearAll}
                                                                className="flex items-center justify-center w-6 h-6 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Clear completed and failed items"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Refresh warning — shown only when files are actively uploading */}
                                                {queueStats.uploading > 0 && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-2">
                                                        <AlertCircle size={11} className="flex-shrink-0" />
                                                        Don't refresh — active uploads will fail and queued files will be lost.
                                                    </div>
                                                )}

                                                {/* Bulk action buttons */}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {queueStats.completedCount > 0 && (
                                                        <button
                                                            onClick={handleClearCompleted}
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium"
                                                            title="Clear completed items only"
                                                        >
                                                            <CheckCircle size={12} />
                                                            Clear Completed ({queueStats.completedCount})
                                                        </button>
                                                    )}
                                                    {queueStats.warningsNeedingApproval > 0 && (
                                                        <button
                                                            onClick={handleApproveAll}
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs font-medium"
                                                        >
                                                            <CheckCircle size={12} />
                                                            Approve All ({queueStats.warningsNeedingApproval})
                                                        </button>
                                                    )}
                                                    {queueStats.failedCount > 0 && (
                                                        <button
                                                            onClick={handleRetryAll}
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs font-medium"
                                                        >
                                                            <RotateCcw size={12} />
                                                            Retry All ({queueStats.failedCount})
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Queue Content */}
                                            <div className="overflow-y-auto custom-scrollbar p-3 max-h-[calc(100vh-320px)] min-h-[220px]">
                                                <UploadQueue
                                                    files={uploadQueue.state.files}
                                                    onRetry={handleRetry}
                                                    onCancel={handleRemove}
                                                    onApprove={handleApprove}
                                                    onReject={handleReject}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* History Tab */}
                        {activeTab === 'history' && (user?.role !== 'User' || user?.permissions?.uploadHistory) && (
                            <UploadHistoryTab
                                activeMarketplaces={allMarketplaces}
                                defaultMarketplaceKey={selectedMarketplaceKey}
                                defaultAccountId={marketplaceId}
                            />
                        )}
                    </div>
                </main>
            </div>
            <QueueLimitModal
                isOpen={fileLimitModal.isOpen}
                totalFiles={fileLimitModal.totalFiles}
                slots={0}
                activeQueueCount={0}
                maxQueueCount={fileLimitModal.limit || MAX_FILES_PER_UPLOAD}
                onClose={() => setFileLimitModal({ isOpen: false, totalFiles: 0, limit: MAX_FILES_PER_UPLOAD })}
                onProceed={undefined}
            />
            <UploadConfirmationModal
                isOpen={confirmModal.isOpen}
                files={confirmModal.files}
                uploadType={confirmModal.uploadType || uploadType}
                marketplaceName={confirmModal.marketplaceName || ''}
                accountName={confirmModal.accountName || ''}
                onConfirm={handleConfirmUpload}
                onCancel={handleCancelConfirm}
            />
            <YouTubeModal
                isOpen={!!tutorialVideo}
                videoUrl={tutorialVideo?.url}
                title={tutorialVideo?.title}
                onClose={() => setTutorialVideo(null)}
            />
        </DashboardLayout >
    );
};

export default Uploads;
