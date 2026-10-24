/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BTN, FIELD_INPUT } from './ui/classNames';

// Only the first few matches are rendered — typing narrows the rest.
const MAX_VISIBLE = 20;

/**
 * "Search by tenant ID" picker for the cross-tenant campaigns list. Owns its own text,
 * open and highlight state so typing and hovering re-render only this component — not
 * the whole page and its campaign grid. Reports the tenant whose numeric tenantId exactly
 * matches the text (or null) through onChange.
 *
 * `options` must only contain tenants with a non-null tenantId.
 */
export function TenantCombobox({ options, onChange }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const optionRefs = useRef([]);

  const query = text.trim().toLowerCase();
  const filtered = useMemo(
    () => (query ? options.filter((t) => String(t.tenantId).includes(query) || t.name.toLowerCase().includes(query)) : options),
    [options, query]
  );
  const visible = filtered.slice(0, MAX_VISIBLE);
  const hiddenCount = filtered.length - visible.length;
  const matched = useMemo(() => options.find((t) => String(t.tenantId) === text.trim()) || null, [options, text]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [text, open]);

  useEffect(() => {
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const updateText = (next) => {
    setText(next);
    onChange(options.find((t) => String(t.tenantId) === next.trim()) || null);
  };

  const select = (t) => {
    updateText(String(t.tenantId));
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || visible.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % visible.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? visible.length - 1 : i - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      select(visible[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2.5 -mt-2 mb-4">
      <div className="relative w-[260px]">
        <input
          type="text"
          placeholder="Search by tenant ID…"
          value={text}
          className={`${FIELD_INPUT} w-full pr-8`}
          onChange={(e) => {
            updateText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        {open && visible.length > 0 && (
          <div
            className="absolute top-[calc(100%+4px)] left-0 right-0 z-30 bg-white border border-slate-200 rounded-lg shadow-md max-h-[280px] overflow-y-auto p-1"
            onMouseDown={(e) => e.preventDefault()}
          >
            {visible.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => (optionRefs.current[i] = el)}
                type="button"
                className={`flex items-baseline gap-2 w-full text-left px-2.5 py-2 rounded-md text-[13px] text-slate-900 ${
                  i === highlightedIndex ? 'bg-brand-50' : 'hover:bg-brand-50'
                }`}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => select(t)}
              >
                <span className="font-semibold text-brand-600 flex-shrink-0">#{t.tenantId}</span>
                <span className="text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">{t.name}</span>
              </button>
            ))}
            {hiddenCount > 0 && (
              <p className="px-2.5 py-2 text-xs text-slate-500">
                +{hiddenCount} more — type to narrow
              </p>
            )}
          </div>
        )}
      </div>
      {text && !matched && <p className="text-slate-500 text-xs">No tenant with that ID — showing all tenants.</p>}
      {matched && (
        <button type="button" className={BTN} onClick={() => updateText('')}>
          Clear ({matched.name})
        </button>
      )}
    </div>
  );
}
