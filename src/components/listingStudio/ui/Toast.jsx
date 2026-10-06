import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

/** Bottom-right success toast that auto-dismisses after `duration` ms. */
export function Toast({ message, onClose, duration = 3000, action }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-emerald-600 shadow-md animate-[toast-in_0.2s_ease-out]"
    >
      <CheckCircle2 size={16} className="flex-shrink-0" />
      <span>{message}</span>
      {action && (
        <button type="button" className="ml-2 text-brand-600 font-semibold underline" onClick={action.onClick}>
          {action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss" className="ml-2 text-slate-500 hover:text-slate-900 flex" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
