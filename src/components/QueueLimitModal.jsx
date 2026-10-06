import React from 'react';
import { X, AlertTriangle, Clock, CheckCircle, Loader2, Upload } from 'lucide-react';

const QueueLimitModal = ({
    isOpen,
    totalFiles,
    slots,
    activeQueueCount,
    maxQueueCount,
    onClose,
    onProceed,
}) => {
    if (!isOpen) return null;

    const isHardLimit = totalFiles > maxQueueCount;
    const isReady     = !isHardLimit && slots >= totalFiles;
    const isWaiting   = !isHardLimit && !isReady;
    const needMore    = totalFiles - slots;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden ring-1 ring-black/5">

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0 transition-all duration-500 ${
                            isHardLimit ? 'bg-red-500 shadow-red-200'
                            : isReady   ? 'bg-emerald-500 shadow-emerald-200'
                            :             'bg-amber-500 shadow-amber-200'
                        }`}>
                            {isHardLimit ? <AlertTriangle size={18} className="text-white" />
                            : isReady    ? <CheckCircle size={18} className="text-white" />
                            :              <Clock size={18} className="text-white" />}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900 leading-tight transition-all">
                                {isHardLimit ? 'Too Many Files' : isReady ? 'Slots Ready!' : 'Queue Busy'}
                            </h2>
                            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                                {isHardLimit ? `Max ${maxQueueCount} files allowed` : `${activeQueueCount} / ${maxQueueCount} slots in use`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 pb-6 space-y-4">

                    {/* Hard limit — selected more than max ever allows */}
                    {isHardLimit && (
                        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-4 text-center space-y-1">
                            <p className="text-sm font-bold text-red-700">Max {maxQueueCount} files at a time.</p>
                            <p className="text-xs text-red-500">
                                You selected <span className="font-bold">{totalFiles}</span>. Reselect up to <span className="font-bold">{maxQueueCount}</span>.
                            </p>
                        </div>
                    )}

                    {/* Waiting — live slot counter */}
                    {isWaiting && (
                        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-4 space-y-3">
                            <div className="flex items-center justify-center gap-3">
                                <div className="flex flex-col items-center bg-white rounded-2xl px-5 py-2.5 shadow-sm border border-amber-100">
                                    <span className="text-2xl font-black text-gray-900 leading-none">{totalFiles}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">Selected</span>
                                </div>
                                <span className="text-amber-400 font-black text-lg">→</span>
                                <div className="flex flex-col items-center bg-white rounded-2xl px-5 py-2.5 shadow-sm border border-amber-100">
                                    <span className="text-2xl font-black text-amber-500 leading-none">{slots}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">Free</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-1.5">
                                <Loader2 size={12} className="animate-spin text-amber-500" />
                                <p className="text-xs font-semibold text-amber-700">
                                    Waiting for {needMore} slot{needMore !== 1 ? 's' : ''} to free up…
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Ready — slots freed up */}
                    {isReady && (
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-4 text-center space-y-1">
                            <p className="text-sm font-bold text-emerald-700">
                                {totalFiles} slot{totalFiles !== 1 ? 's are' : ' is'} now free.
                            </p>
                            <p className="text-xs text-emerald-600">
                                Your {totalFiles} {totalFiles === 1 ? 'file is' : 'files are'} ready to queue.
                            </p>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 h-11 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all"
                        >
                            {isHardLimit ? 'Got it' : 'Cancel'}
                        </button>
                        {isReady && (
                            <button
                                onClick={onProceed}
                                className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200 hover:-translate-y-px active:translate-y-0 transition-all"
                            >
                                <Upload size={14} />
                                Confirm
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QueueLimitModal;
