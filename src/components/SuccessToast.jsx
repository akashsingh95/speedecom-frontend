import React, { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

const SuccessToast = ({ message, onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className="fixed top-4 right-4 z-[70] animate-in slide-in-from-top-4 duration-300">
            <div className="bg-white rounded-xl shadow-2xl border border-emerald-200 p-4 flex items-center gap-3 min-w-[320px] max-w-md">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 animate-successPulse">
                    <CheckCircle className="text-emerald-600" size={20} />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{message}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default SuccessToast;
