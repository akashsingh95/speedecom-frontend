import React, { useState } from 'react';
import { FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { initiateExport, forceCreateExport, pollExportStatus } from '../utils/exportUtils';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';

/**
 * Export Button Component
 * Handles export initiation, duplicate detection, and polling
 */
const ExportButton = ({ 
    exportType, 
    marketplaceId, 
    startDate, 
    endDate,
    nullOrderDate,
    buttonText = 'Export',
    buttonClassName = '',
    disabled = false,
    dataTypeFilter,
    warehouses,
    brands,
    adsType,
    gstMode,
    returnStatuses,
    shopsyFilter,
    meeshoOrderSource,
    paymentStatus,
    orderItemStatuses,
    compensationReasons,
    recoveryReasons,
    sizes,
    orderMonth,
    onExportStart,
    onExportComplete,
    onExportError
}) => {
    const { isImpersonating } = useAuth();
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState(null);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState(null);

    const handleExport = async (force = false) => {
        // Some exports can be generated without marketplace (exports all marketplaces)
        if (!marketplaceId && exportType !== 'payment_metrics' && exportType !== 'payment_calculations' && exportType !== 'pending_payments' && !exportType.endsWith('_payment_details')) {
            toast.error('Please select a marketplace');
            return;
        }

        setIsExporting(true);
        setShowDuplicateDialog(false);

        try {
            // Call onExportStart callback
            if (onExportStart) {
                onExportStart();
            }

            // Initiate export
            const exportFn = force ? forceCreateExport : initiateExport;
            const result = await exportFn({
                exportType,
                marketplaceId,
                startDate,
                endDate,
                nullOrderDate,
                dataTypeFilter,
                warehouses,
                brands,
                adsType,
                gstMode,
                returnStatuses,
                shopsyFilter,
                meeshoOrderSource,
                compensationReasons,
                recoveryReasons,
                sizes,
                paymentStatus,
                orderItemStatuses,
                orderMonth
            });

            // Check for duplicate (response is auto-unwrapped by api.js interceptor)
            if (result?.duplicate) {
                setDuplicateInfo(result.existing_export);
                setShowDuplicateDialog(true);
                setIsExporting(false);
                return;
            }

            const exportId = result.export_id;

            toast.success('Export initiated! Processing in background...', {
                description: 'You can continue working. Check Downloads page for status.',
                duration: 5000
            });

            // Poll for completion
            pollExportStatus(
                exportId,
                (status) => {
                    setExportStatus(status.status);
                },
                180, // max attempts (180 * 5s = 15 minutes)
                5000 // interval (5 seconds)
            )
                .then(async (finalStatus) => {
                    setIsExporting(false);
                    setExportStatus('completed');

                    toast.success('Export completed!', {
                        description: 'View and download from the Downloads page. File expires in 7 days.',
                        icon: <CheckCircle className="text-green-500" />,
                        duration: 6000
                    });

                    if (onExportComplete) {
                        onExportComplete(finalStatus);
                    }
                })
                .catch((error) => {
                    setIsExporting(false);
                    setExportStatus('failed');
                    
                    toast.error('Export failed', {
                        description: error.message || 'Please try again or contact support',
                        icon: <AlertCircle className="text-red-500" />
                    });

                    if (onExportError) {
                        onExportError(error);
                    }
                });

        } catch (error) {
            setIsExporting(false);
            setExportStatus('failed');
            
            toast.error('Failed to initiate export', {
                description: error.message || 'Please try again'
            });

            if (onExportError) {
                onExportError(error);
            }
        }
    };

    const handleDuplicateConfirm = () => {
        handleExport(true); // Force create
    };

    const handleDuplicateCancel = () => {
        setShowDuplicateDialog(false);
        setDuplicateInfo(null);
        setIsExporting(false);
    };

    const getStatusText = () => {
        if (exportStatus === 'pending') return 'Queued...';
        if (exportStatus === 'processing') return 'Generating...';
        if (exportStatus === 'completed') return 'Downloading...';
        return 'Exporting...';
    };

    return (
        <>
            <button
                onClick={() => handleExport(false)}
                disabled={disabled || isExporting}
                className={`inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${buttonClassName}`}
            >
                {isExporting ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>{getStatusText()}</span>
                    </>
                ) : (
                    <>
                        <FileSpreadsheet size={18} />
                        <span>{buttonText}</span>
                    </>
                )}
            </button>

            {/* Duplicate Confirmation Dialog */}
            {showDuplicateDialog && duplicateInfo && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="text-yellow-600" size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-800 mb-2">
                                    Similar Export Already Exists
                                </h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    An export with the same filters was created recently:
                                </p>
                                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Created:</span>
                                        <span className="font-medium text-slate-800">
                                            {new Date(duplicateInfo.created_at).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Status:</span>
                                        <span className={`font-medium ${
                                            duplicateInfo.status === 'completed' 
                                                ? 'text-green-600' 
                                                : duplicateInfo.status === 'processing'
                                                ? 'text-blue-600'
                                                : 'text-yellow-600'
                                        }`}>
                                            {duplicateInfo.status.charAt(0).toUpperCase() + duplicateInfo.status.slice(1)}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 mt-4">
                                    Do you want to generate this export again?
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleDuplicateCancel}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            {duplicateInfo.status === 'completed' && duplicateInfo.download_url && (
                                <button
                                    onClick={() => {
                                        window.open(duplicateInfo.download_url, '_blank');
                                        handleDuplicateCancel();
                                    }}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Download Existing
                                </button>
                            )}
                            <button
                                onClick={handleDuplicateConfirm}
                                className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors"
                            >
                                Generate New
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExportButton;
