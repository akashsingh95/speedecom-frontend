import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Loader2, X, CheckCircle, Clock } from 'lucide-react';
import api from '../api';
import { toast } from 'sonner';

const CostSheetNotGeneratedModal = ({
    isOpen,
    onClose,
    marketplaceId, // Can be a single ID or an array of IDs
    onGenerateSuccess,
    mode = 'not_generated',
    lastUploadDate = null,
    lastCostsheetDate = null,
}) => {
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

    const isStale = mode === 'stale';

    const fmt = (iso) => {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch { return iso; }
    };

    const handleGenerate = async () => {
        if (!marketplaceId || (Array.isArray(marketplaceId) && marketplaceId.length === 0)) return;
        setIsGenerating(true);
        try {
            await api.post('/cost-sheet/generate', { 
                marketplaceIds: Array.isArray(marketplaceId) ? marketplaceId : [marketplaceId] 
            });
            toast.success('Cost sheet generated successfully');
            if (onGenerateSuccess) await onGenerateSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to generate cost sheet');
        } finally {
            setIsGenerating(false);
        }
    };

    const hasMarketplace = marketplaceId && (!Array.isArray(marketplaceId) || marketplaceId.length > 0);

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b flex items-start justify-between gap-4 bg-amber-50 border-amber-100">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100">
                            {isStale
                                ? <RefreshCw className="text-amber-600" size={20} />
                                : <AlertTriangle className="text-amber-600" size={22} />
                            }
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-amber-900">
                                {isStale ? 'Action Required: Update Cost Sheet' : 'Cost Sheet Required'}
                            </h3>
                            <p className="text-sm mt-0.5 text-amber-700">
                                {isStale
                                    ? 'New uploads found or costsheet is out of date'
                                    : 'Template must exist first before running calculations'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-100/50 rounded-lg transition-colors flex-shrink-0"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                        {isStale
                            ? 'Please click the button below to sync the latest SKUs into your cost sheet. This is a mandatory step to ensure your calculations use the most up-to-date information from your uploads.'
                            : 'No cost sheet has been generated for this marketplace account. Please initialize it using the button below before trying to calculate margins.'
                        }
                    </p>

                    {isStale && (lastUploadDate || lastCostsheetDate) && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-xs">
                            <div className="flex items-center gap-3 px-4 py-2.5">
                                <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                                <span className="text-slate-500 w-36 flex-shrink-0">Last Cost Sheet</span>
                                <span className="text-slate-700 font-medium">{fmt(lastCostsheetDate)}</span>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-2.5">
                                <Clock size={14} className="text-blue-500 flex-shrink-0" />
                                <span className="text-slate-500 w-36 flex-shrink-0">Latest Upload</span>
                                <span className="text-slate-700 font-medium">{fmt(lastUploadDate)}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 pb-6">
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                    >
                        Cancel
                    </button>
                    <div className="relative group flex items-center gap-2">
                        <button
                            onClick={handleGenerate}
                            disabled={!hasMarketplace || isGenerating}
                            className="px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    {isStale ? 'Regenerating...' : 'Generating...'}
                                </>
                            ) : (
                                <>
                                    {isStale ? <RefreshCw size={14} /> : null}
                                    {isStale ? 'Regenerate Cost Sheet' : 'Generate Cost Sheet'}
                                </>
                            )}
                        </button>

                        {!hasMarketplace && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 w-48 text-center text-wrap shadow-xl">
                                Please select at least one marketplace to generate.
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CostSheetNotGeneratedModal;
