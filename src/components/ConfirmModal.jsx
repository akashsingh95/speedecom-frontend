import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, details, confirmText = 'Confirm', cancelText, secondaryText, onSecondary, danger = false }) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onClose();
        onConfirm?.();
    };

    const handleSecondary = () => {
        onClose();
        onSecondary?.();
    };

    return (
        <div className="fixed bg-black/40 backdrop-blur-sm inset-0 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className={`p-5 border-b rounded-t-2xl ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
                                <AlertTriangle className={danger ? 'text-red-600' : 'text-amber-600'} size={20} />
                            </div>
                            <h2 className={`text-base font-bold ${danger ? 'text-red-800' : 'text-amber-800'}`}>{title}</h2>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="p-5">
                    <p className="text-slate-700 text-sm">{message}</p>
                    {details && (
                        <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm text-slate-600 space-y-1">
                            {details.map((d, i) => (
                                <div key={i}><span className="font-medium">{d.label}:</span> {d.value}</div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="px-5 pb-5 flex justify-end gap-3">
                    {cancelText && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    {secondaryText && (
                        <button
                            onClick={handleSecondary}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            {secondaryText}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
