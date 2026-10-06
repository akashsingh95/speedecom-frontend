import React from 'react';
import {
    Clock,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Eye,
    X,
    RotateCcw,
} from 'lucide-react';

const QueueItem = ({
    fileItem,
    onRetry,
    onCancel,
    onViewDetails,
    onApprove,
    onReject,
}) => {
    const getStageIcon = () => {
        switch (fileItem.stage) {
            case 'queued':
                return <Clock className="text-slate-400" size={17} />;
            case 'uploading':
                return <Loader2 className="text-blue-500 animate-spin" size={17} />;
            case 'uploaded':
                return <CheckCircle className="text-green-500" size={17} />;
            case 'validating':
                return <Loader2 className="text-orange-500 animate-spin" size={17} />;
            case 'validated':
                if (fileItem.hasValidationErrors) return <XCircle className="text-red-500" size={17} />;
                if (fileItem.hasValidationWarnings) return <AlertTriangle className="text-amber-500" size={17} />;
                return <CheckCircle className="text-green-500" size={17} />;
            case 'pending_processing':
                return <Clock className="text-sky-500" size={17} />;
            case 'processing':
                return <Loader2 className="text-indigo-500 animate-spin" size={17} />;
            case 'cancelling':
                return <Loader2 className="text-orange-400 animate-spin" size={17} />;
            case 'completed':
                return <CheckCircle className="text-green-600" size={17} />;
            case 'timed_out':
                return <Clock className="text-amber-500" size={17} />;
            case 'failed':
                return <XCircle className="text-red-600" size={17} />;
            default:
                return <Clock className="text-slate-400" size={17} />;
        }
    };

    const getStageLabel = () => {
        switch (fileItem.stage) {
            case 'queued': return 'Queued';
            case 'uploading': return `${fileItem.uploadProgress}%`;
            case 'uploaded': return 'Uploaded';
            case 'validating': return 'Validating';
            case 'validated':
                if (fileItem.hasValidationErrors) return 'Failed';
                if (fileItem.hasValidationWarnings) return 'Warning';
                return 'Validated';
            case 'pending_processing': return 'Queued';
            case 'processing': return 'Processing';
            case 'cancelling': return 'Cancelling...';
            case 'completed': return 'Done';
            case 'timed_out': return 'Check History';
            case 'failed': return 'Failed';
            default: return 'Unknown';
        }
    };

    const getBadgeStyle = () => {
        if (fileItem.stage === 'completed') return 'bg-green-100 text-green-700 border-green-200';
        if (fileItem.stage === 'timed_out') return 'bg-amber-100 text-amber-700 border-amber-200';
        if (fileItem.stage === 'failed' || fileItem.hasValidationErrors) return 'bg-red-100 text-red-700 border-red-200';
        if (fileItem.stage === 'validating') return 'bg-orange-100 text-orange-700 border-orange-200';
        if (fileItem.stage === 'uploading') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (fileItem.stage === 'pending_processing') return 'bg-sky-100 text-sky-700 border-sky-200';
        if (fileItem.stage === 'processing') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        if (fileItem.stage === 'cancelling') return 'bg-orange-100 text-orange-600 border-orange-200';
        if (fileItem.stage === 'validated' && !fileItem.hasValidationErrors) return 'bg-green-100 text-green-700 border-green-200';
        return 'bg-gray-100 text-gray-500 border-gray-200';
    };

    const getCardStyle = () => {
        if (fileItem.stage === 'queued') return 'bg-slate-50 border-slate-200';
        if (fileItem.stage === 'uploading') return 'bg-blue-50/50 border-blue-200';
        if (fileItem.stage === 'validating') return 'bg-orange-50/50 border-orange-200';
        if (fileItem.stage === 'pending_processing') return 'bg-sky-50/50 border-sky-200';
        if (fileItem.stage === 'processing') return 'bg-indigo-50/50 border-indigo-200';
        if (fileItem.stage === 'cancelling') return 'bg-orange-50/50 border-orange-200';
        if (fileItem.stage === 'completed') return 'bg-green-50/50 border-green-200';
        if (fileItem.stage === 'timed_out') return 'bg-amber-50/50 border-amber-200';
        if (fileItem.stage === 'failed' || fileItem.hasValidationErrors) return 'bg-red-50/50 border-red-200';
        if (fileItem.stage === 'validated' && fileItem.hasValidationWarnings && !fileItem.hasValidationErrors) return 'bg-amber-50/50 border-amber-200';
        if (fileItem.stage === 'validated' && !fileItem.hasValidationErrors) return 'bg-green-50/50 border-green-200';
        return 'bg-white border-gray-200 hover:border-gray-300';
    };

    const showCancelButton = ['queued', 'uploading', 'validating', 'pending_processing', 'processing'].includes(fileItem.stage);
    const isCancelling = fileItem.stage === 'cancelling';

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className={`rounded-xl border transition-all duration-200 animate-slideInFromBottom ${getCardStyle()}`}>
            <div className="p-3.5">
                <div className="flex items-start gap-2.5">
                    {/* Stage Icon */}
                    <div className="flex-shrink-0 mt-0.5">{getStageIcon()}</div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                                    {fileItem.file?.name ?? fileItem.fileName.split('/').pop()}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {fileItem.file ? `${formatFileSize(fileItem.file.size)} · ` : ''}{fileItem.uploadType.replace(/_/g, ' ')}
                                </p>
                            </div>

                            {/* Status Badge + Action Buttons */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getBadgeStyle()}`}>
                                    {getStageLabel()}
                                </span>

                                {/* View details */}
                                {fileItem.validationResult && fileItem.stage === 'validated' && !fileItem.hasValidationErrors && (
                                    <button
                                        onClick={() => onViewDetails(fileItem)}
                                        className="p-1 hover:bg-black/5 rounded-lg transition-colors"
                                        title="View Details"
                                    >
                                        <Eye size={14} className="text-gray-500" />
                                    </button>
                                )}

                                {/* Cancel */}
                                {(showCancelButton || isCancelling) && (
                                    <button
                                        onClick={() => !isCancelling && onCancel(fileItem.id)}
                                        disabled={isCancelling}
                                        className={`p-1 rounded-lg transition-colors ${isCancelling ? 'opacity-40 cursor-not-allowed' : fileItem.stage === 'processing' ? 'hover:bg-orange-100' : 'hover:bg-red-100'}`}
                                        title={isCancelling ? 'Cancelling...' : fileItem.stage === 'processing' ? 'Cancel Processing' : fileItem.stage === 'pending_processing' ? 'Remove from Queue' : 'Cancel'}
                                    >
                                        <X size={14} className={isCancelling ? 'text-orange-400' : fileItem.stage === 'processing' ? 'text-orange-500' : 'text-red-500'} />
                                    </button>
                                )}

                                {/* Retry */}
                                {fileItem.error && fileItem.retryable && (
                                    <button
                                        onClick={() => onRetry(fileItem.id)}
                                        className="p-1 hover:bg-orange-100 rounded-lg transition-colors"
                                        title="Retry"
                                    >
                                        <RotateCcw size={14} className="text-orange-500" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Upload Progress Bar */}
                        {fileItem.stage === 'uploading' && (
                            <div className="mt-2.5">
                                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-300 rounded-full"
                                        style={{ width: `${fileItem.uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Validating Progress Bar */}
                        {fileItem.stage === 'validating' && (
                            <div className="mt-2.5">
                                <div className="h-1.5 bg-orange-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-orange-300 to-orange-500 rounded-full animate-pulse w-full" />
                                </div>
                            </div>
                        )}

                        {/* Cancelling Progress Bar */}
                        {fileItem.stage === 'cancelling' && (
                            <div className="mt-2.5">
                                <div className="h-1.5 bg-orange-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-orange-300 to-orange-400 rounded-full animate-pulse w-full" />
                                </div>
                            </div>
                        )}

                        {/* Pending Processing Progress Bar */}
                        {fileItem.stage === 'pending_processing' && (
                            <div className="mt-2.5">
                                <div className="h-1.5 bg-sky-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-sky-300 to-sky-400 rounded-full animate-pulse w-full" />
                                </div>
                            </div>
                        )}

                        {/* Processing Progress Bar */}
                        {fileItem.stage === 'processing' && (
                            <div className="mt-2.5">
                                <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-indigo-300 to-indigo-500 rounded-full animate-pulse w-full" />
                                </div>
                            </div>
                        )}

                        {/* Validation passed (no warnings) */}
                        {fileItem.stage === 'validated' && !fileItem.hasValidationErrors && !fileItem.hasValidationWarnings && fileItem.validationResult && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-700">
                                <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
                                Validation passed — processing started
                            </div>
                        )}

                        {/* Timeout Message — amber, not red */}
                        {fileItem.stage === 'timed_out' && fileItem.error && (
                            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-100 rounded-lg px-2.5 py-1.5">
                                <Clock size={11} className="text-amber-500 flex-shrink-0 mt-px" />
                                <span>{fileItem.error}</span>
                            </div>
                        )}

                        {/* Error Message */}
                        {fileItem.stage !== 'timed_out' && (fileItem.error || fileItem.hasValidationErrors) && (
                            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-700 bg-red-100 rounded-lg px-2.5 py-1.5">
                                <XCircle size={11} className="text-red-500 flex-shrink-0 mt-px" />
                                <span>{fileItem.error || 'Validation failed — check your file format'}</span>
                            </div>
                        )}

                        {/* Warning + Approve Section */}
                        {fileItem.hasValidationWarnings && !fileItem.hasValidationErrors && fileItem.userDecision === 'pending' && fileItem.stage === 'validated' && (
                            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-2">
                                <div className="flex items-start gap-1.5">
                                    <AlertTriangle size={11} className="text-amber-500 flex-shrink-0 mt-px" />
                                    <p className="text-[11px] text-amber-700 font-medium leading-tight">
                                        File has warnings — review and approve to continue
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onApprove(fileItem.id)}
                                        className="flex-1 py-1 px-3 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors font-semibold"
                                    >
                                        Approve &amp; Continue
                                    </button>
                                    <button
                                        onClick={() => onReject(fileItem.id)}
                                        className="px-3 py-1 bg-white border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Skip
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QueueItem;
