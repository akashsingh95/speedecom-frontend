/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Full-screen viewer for chat screenshots. Click the image to zoom to its real size
 * (screenshots are often larger than the screen), arrows/keys to move, Esc or backdrop to close.
 */
const ImageLightbox = ({ urls, startIndex = 0, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const count = urls.length;
  const url = urls[index];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && count > 1) setIndex((i) => (i + 1) % count);
      else if (e.key === 'ArrowLeft' && count > 1) setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onClose]);

  useEffect(() => setZoomed(false), [index]);

  const go = (step) => (e) => {
    e.stopPropagation();
    setIndex((i) => (i + step + count) % count);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot viewer"
      onClick={onClose}
      className="fixed inset-0 z-[11000] bg-slate-900/90 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-medium text-slate-300">{count > 1 ? `${index + 1} / ${count}` : 'Screenshot'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomed((z) => !z)}
            aria-label={zoomed ? 'Fit to screen' : 'Actual size'}
            title={zoomed ? 'Fit to screen' : 'Actual size'}
            className="p-2 rounded-lg hover:bg-white/10"
          >
            {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in new tab"
            title="Open in new tab"
            className="p-2 rounded-lg hover:bg-white/10"
          >
            <ExternalLink size={18} />
          </a>
          <button onClick={onClose} aria-label="Close" title="Close (Esc)" className="p-2 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className={`relative flex-1 min-h-0 ${zoomed ? 'overflow-auto' : 'flex items-center justify-center px-4 pb-6'}`}>
        <img
          src={url}
          alt={`Screenshot ${index + 1}`}
          onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
          className={zoomed
            ? 'max-w-none cursor-zoom-out mx-auto'
            : 'max-h-full max-w-full object-contain rounded-lg shadow-2xl cursor-zoom-in bg-white'}
        />
        {count > 1 && (
          <>
            <button
              onClick={go(-1)}
              aria-label="Previous screenshot"
              className="fixed left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={go(1)}
              aria-label="Next screenshot"
              className="fixed right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ImageLightbox;
