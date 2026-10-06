import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/** Click-to-view full image overlay — Escape or backdrop click to close. Deliberately its
 *  own component rather than reusing Modal: Modal's panel is sized/padded for form-like
 *  content (max-w-[640px], p-5), which would crop or letterbox a photo awkwardly.
 *
 *  Single-image callers keep passing `src`/`alt` unchanged (every existing caller —
 *  ResearchPage/AplusPage/ListingPage/ImagesPage — does this and needs no changes). Pass
 *  `images` (an array of `{ src, alt }`) instead for a gallery the viewer can arrow through
 *  (prev/next buttons, left/right arrow keys, wraps around at both ends) without closing and
 *  reopening — `initialIndex` picks which one it opens on. */
export function ImageLightbox({ src, alt = '', images, initialIndex = 0, onClose }) {
  const gallery = images && images.length > 0 ? images : [{ src, alt }];
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), gallery.length - 1));
  const hasNav = gallery.length > 1;
  const current = gallery[index];

  const goNext = () => setIndex((i) => (i + 1) % gallery.length);
  const goPrev = () => setIndex((i) => (i - 1 + gallery.length) % gallery.length);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      else if (hasNav && e.key === 'ArrowRight') goNext();
      else if (hasNav && e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, hasNav, gallery.length]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/75 p-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed top-4 right-4 z-10 w-9 h-9 grid place-items-center rounded-full bg-white/90 text-slate-700 transition-colors hover:bg-white"
      >
        <X size={18} />
      </button>

      {hasNav && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="fixed left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 grid place-items-center rounded-full bg-white/90 text-slate-700 transition-colors hover:bg-white"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="fixed right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 grid place-items-center rounded-full bg-white/90 text-slate-700 transition-colors hover:bg-white"
          >
            <ChevronRight size={22} />
          </button>
          <span className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 px-2.5 py-1 rounded-full bg-white/90 text-slate-700 text-xs font-medium">
            {index + 1} / {gallery.length}
          </span>
        </>
      )}

      {/* Image is capped to the viewport (minus the p-6 backdrop padding) on both axes so
          object-contain can always scale it to fit fully on screen, with no scrolling needed. */}
      <div className="h-full flex items-center justify-center">
        <img
          src={current.src}
          alt={current.alt}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-[calc(100vh-3rem)] rounded-lg shadow-2xl object-contain"
        />
      </div>
    </div>
  );
}
