import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/** Click-to-view full image overlay — Escape or backdrop click to close. Deliberately its
 *  own component rather than reusing Modal: Modal's panel is sized/padded for form-like
 *  content (max-w-[640px], p-5), which would crop or letterbox a photo awkwardly. */
export function ImageLightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 p-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed top-4 right-4 z-10 w-9 h-9 grid place-items-center rounded-full bg-white/90 text-slate-700 transition-colors hover:bg-white"
      >
        <X size={18} />
      </button>
      {/* min-h-full centers a small image within the viewport, same as before; a taller-than-
          viewport image instead grows this wrapper past 100% height, which overflow-y-auto on
          the backdrop above turns into a scrollable page instead of a clipped/inaccessible image. */}
      <div className="min-h-full flex items-center justify-center">
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full rounded-lg shadow-2xl object-contain"
        />
      </div>
    </div>
  );
}
