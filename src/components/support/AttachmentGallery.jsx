/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import ImageLightbox from './ImageLightbox';

// Stored attachments are storage paths; the API swaps them for signed URLs when a ticket is
// loaded. A live message can briefly carry the raw path until that reload lands.
const isViewable = (url) => /^https?:\/\//.test(String(url || ''));

/**
 * Screenshot thumbnails that open the full-screen viewer on click.
 * align: 'start' | 'end' — which side of the thread the images sit on.
 */
const AttachmentGallery = ({ urls, align = 'start' }) => {
  const [openIndex, setOpenIndex] = useState(null);
  const [failed, setFailed] = useState(() => new Set());
  if (!urls?.length) return null;

  const viewable = urls.filter((u) => isViewable(u) && !failed.has(u));

  return (
    <>
      <div className={`flex flex-wrap gap-1.5 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
        {urls.map((url, i) => {
          if (!isViewable(url)) {
            return <div key={`${url}-${i}`} className="w-28 h-28 rounded-xl bg-slate-100 animate-pulse" aria-label="Loading screenshot" />;
          }
          if (failed.has(url)) {
            return (
              <div key={url} className="w-28 h-28 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 flex flex-col items-center justify-center gap-1 text-[11px] text-center px-2">
                <ImageOff size={18} />
                Reload the chat to view
              </div>
            );
          }
          return (
            <button
              key={url}
              type="button"
              onClick={() => setOpenIndex(viewable.indexOf(url))}
              aria-label={`View screenshot ${i + 1}`}
              className="group w-28 h-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <img
                src={url}
                alt={`Screenshot ${i + 1}`}
                loading="lazy"
                onError={() => setFailed((f) => new Set(f).add(url))}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </button>
          );
        })}
      </div>
      {openIndex !== null && openIndex >= 0 && (
        <ImageLightbox urls={viewable} startIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
};

export default AttachmentGallery;
