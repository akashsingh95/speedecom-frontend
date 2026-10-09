/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useLayoutEffect, useRef, useState } from 'react';

/** Long free-text (product descriptions, AI-generated summaries) clamped to `lines` with a
 *  "Read more"/"Show less" toggle — only shown when the text actually overflows that clamp,
 *  so a short description never gets a dangling toggle that has nothing left to reveal. */
export function ExpandableText({ text, lines = 5, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (ref.current) setIsTruncated(ref.current.scrollHeight > ref.current.clientHeight + 1);
    // Measured while still collapsed (the clamp is what creates the overflow to detect);
    // `expanded` is deliberately excluded so toggling back doesn't erase that reading.
     
  }, [text, lines]);

  if (!text) return null;

  return (
    <div>
      <p
        ref={ref}
        className={className}
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: lines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {text}
      </p>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-brand-600 hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
