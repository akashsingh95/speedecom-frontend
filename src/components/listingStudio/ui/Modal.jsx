/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Mirrors speed-listing's .modal-backdrop (fixed inset, grid place-items-center) /
 *  .modal (rounded panel, fade+pop-in animation) rules as literal Tailwind utilities,
 *  plus the same focus-trap/Escape-to-close behavior. */
export function Modal({ onClose, children, className = '', size = 'md' }) {
  const panelRef = useRef(null);
  // A full, mutually-exclusive class set per size (picked via ternary, never concatenated) —
  // two conflicting `max-w-[...]` utilities in the same string race on generated-stylesheet
  // order, not JSX order, so whichever "wins" isn't reliably the one written last (see
  // classNames.js's SERP_CHECK comment for the same trap elsewhere in this codebase).
  const sizeClass = size === 'lg' ? 'max-w-[1180px] w-[95%] max-h-[88vh]' : 'max-w-[640px] w-[92%] max-h-[80vh]';

  // Runs once on mount only — not on every `onClose` change (a caller re-rendering with a fresh
  // inline onClose, e.g. after an autosave updates parent state, must never steal focus back from
  // whatever the user is actively typing in).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // Deliberately mount-only: a caller passing an inline `onClose` (e.g. `() => setX(null)`)
    // gets a new function identity on every parent re-render. Depending on `onClose` here would
    // re-run this effect — and its `panelRef.current?.focus()` — on every keystroke of any input
    // inside the modal, stealing focus back to the panel after each character typed.
     
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 animate-[modal-fade-in_0.15s_ease]"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white rounded-2xl p-5 ${sizeClass} overflow-auto animate-[modal-pop-in_0.15s_ease] ${className}`}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 grid place-items-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
