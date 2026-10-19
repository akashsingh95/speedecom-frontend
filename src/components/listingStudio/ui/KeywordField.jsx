/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { highlightSegments, keywordLower, volumeTier } from '../keywordHighlights';

/** A FormField that also highlights the research keywords found in its own text, with the
 *  keyword's monthly search volume on hover.
 *
 *  A textarea cannot style its own content, so the highlights are painted by a backdrop div
 *  sitting exactly under the control: identical font, padding and border box, text rendered
 *  transparent, and only the matched runs carrying a background. The real glyphs the seller
 *  reads and edits are still the control's own, so typing, selection, the caret, undo and the
 *  character counters all behave exactly as they did before.
 *
 *  The backdrop is pointer-events-none — clicks must reach the control — so hover is resolved by
 *  hit-testing the painted marks' own client rects against the cursor on mousemove instead of
 *  with :hover. getClientRects() (not getBoundingClientRect) because a keyword wrapped across
 *  two lines is two rects, and only the line the cursor is actually on should answer.
 *
 *  Hit-testing is a pointer affordance and cannot be the only one, so the same volumes are also
 *  listed under each field by a disclosure button — see the comment on it below. */

// Shared by the control and the backdrop: every property that decides where a glyph lands.
// Font size and line height are pinned explicitly because @tailwindcss/forms sets 1rem/1.5rem on
// form controls only — the backdrop div would otherwise inherit the label's text-sm and drift.
const METRICS = 'block w-full px-2.5 py-2 border rounded-lg text-base leading-6 font-sans';

const TIER_MARK = {
  high: 'bg-blue-300/75 ring-1 ring-blue-400/60',
  medium: 'bg-blue-200/70 ring-1 ring-blue-300/50',
  low: 'bg-blue-100 ring-1 ring-blue-200/60',
};

// The volume number itself carries the tier colour in the tooltip, echoing the shade of the
// highlight the cursor is on, so the two read as the same scale rather than two colour systems.
const TIER_VALUE = {
  high: 'text-blue-300',
  medium: 'text-blue-200',
  low: 'text-slate-100',
};

export function KeywordField({
  label,
  value,
  onChange,
  keywords,
  highlight = true,
  usage,
  counter,
  invalid,
  multiline = false,
  rows,
  ...rest
}) {
  const backdropRef = useRef(null);
  const controlRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  const segments = useMemo(
    () => highlightSegments(value, highlight ? keywords : []),
    [value, keywords, highlight],
  );

  /** The distinct research keywords this field's own copy contains, richest first — the same
   *  data the hover card shows, but as a list that exists without a pointer.
   *
   *  Derived from the painted segments rather than re-matching, so the summary can never
   *  disagree with the highlights: a keyword claimed by a longer overlapping phrase is absent
   *  from both. Empty whenever highlighting is off, which collapses the disclosure with it. */
  const fieldKeywords = useMemo(() => {
    const byKeyword = new Map();
    for (const segment of segments) {
      if (segment.entry) byKeyword.set(keywordLower(segment.entry), segment.entry);
    }
    return [...byKeyword.values()].sort((a, b) => b.searchVolume - a.searchVolume);
  }, [segments]);
  const fieldVolume = fieldKeywords.reduce((sum, entry) => sum + entry.searchVolume, 0);
  const summaryId = useId();
  const [summaryOpen, setSummaryOpen] = useState(false);

  /** Keeps the backdrop's text box identical to the control's.
   *
   *  Scroll offset, because marks are placed by the backdrop's own scrolling; and the right
   *  padding, because a textarea long enough to scroll grows a scrollbar that eats into its text
   *  column while the overflow-hidden backdrop keeps its full width. A few pixels of difference
   *  re-wraps every line below the first and slides the highlights off their words, so the
   *  backdrop reserves the same gutter. Measured rather than assumed: scrollbar width is
   *  platform- and zoom-dependent, and the control is user-resizable. */
  const syncMetrics = useCallback(() => {
    const backdrop = backdropRef.current;
    const control = controlRef.current;
    if (!backdrop || !control) return;
    const style = window.getComputedStyle(control);
    const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const scrollbar = Math.max(control.offsetWidth - control.clientWidth - borders, 0);
    backdrop.style.paddingRight = `${parseFloat(style.paddingRight) + scrollbar}px`;
    backdrop.scrollTop = control.scrollTop;
    backdrop.scrollLeft = control.scrollLeft;
  }, []);

  useLayoutEffect(syncMetrics, [value, syncMetrics]);

  // The control is resizable by its own grip and by the window; either changes the wrap.
  useEffect(() => {
    const control = controlRef.current;
    if (!control || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(syncMetrics);
    observer.observe(control);
    return () => observer.disconnect();
  }, [syncMetrics]);

  // A tooltip anchored to a page position goes stale the moment anything scrolls underneath it.
  // Escape dismisses it too: it can cover the copy underneath, and a pointer user who wants it
  // gone needs a way to say so without the cursor being the only means.
  useEffect(() => {
    if (!hovered) return undefined;
    const hide = () => setHovered(null);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setHovered(null);
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [hovered]);

  const onMouseMove = (event) => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    const { clientX, clientY } = event;
    for (const node of backdrop.querySelectorAll('[data-kw]')) {
      for (const rect of node.getClientRects()) {
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
        const index = Number(node.dataset.kw);
        const entry = segments[index]?.entry;
        if (!entry) return;
        if (hovered?.entry === entry && hovered?.rect.top === rect.top && hovered?.rect.left === rect.left) return;
        setHovered({ entry, rect });
        return;
      }
    }
    if (hovered) setHovered(null);
  };

  const controlClass = `${METRICS} relative bg-transparent text-slate-900 transition-colors focus:outline focus:outline-2 focus:outline-brand-100 ${
    invalid ? 'border-red-600 focus:border-red-600' : 'border-slate-200 focus:border-brand-600'
  }`;

  const over = counter ? counter.value > counter.max : false;

  return (
    // The field is a <div> wrapping a <label>, not a <label> wrapping everything: the keyword
    // summary below is a real button, and an interactive control inside a label would steal
    // the click that belongs to the input it labels.
    <div className="mb-3">
      <label className="block text-sm text-slate-500">
        {label}
        <div className="relative mt-1" onMouseMove={onMouseMove} onMouseLeave={() => setHovered(null)}>
          <div
            ref={backdropRef}
            aria-hidden="true"
            className={`${METRICS} absolute inset-0 overflow-hidden pointer-events-none select-none border-transparent bg-white text-transparent ${
              multiline ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
            }`}
          >
            {segments.map((segment, i) =>
              segment.entry ? (
                <mark
                  key={i}
                  data-kw={i}
                  className={`-mx-1 rounded-md px-1 py-0.5 box-decoration-clone text-transparent ${TIER_MARK[volumeTier(segment.entry.searchVolume)]}`}
                >
                  {segment.text}
                </mark>
              ) : (
                <React.Fragment key={i}>{segment.text}</React.Fragment>
              ),
            )}
            {/* A value ending in a newline leaves the textarea one empty line taller than the
                backdrop's text would be, which shifts nothing visible but keeps scrollTop in step. */}
            {multiline ? '\n' : null}
          </div>
          {multiline ? (
            <textarea
              {...rest}
              ref={controlRef}
              rows={rows}
              value={value}
              onChange={onChange}
              onScroll={syncMetrics}
              aria-describedby={fieldKeywords.length > 0 ? summaryId : rest['aria-describedby']}
              className={controlClass}
            />
          ) : (
            <input
              {...rest}
              ref={controlRef}
              value={value}
              onChange={onChange}
              onScroll={syncMetrics}
              aria-describedby={fieldKeywords.length > 0 ? summaryId : rest['aria-describedby']}
              className={controlClass}
            />
          )}
        </div>
        {counter && (
          <span className={`text-[11px] ml-1.5 ${over ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
            {counter.value}/{counter.max}
          </span>
        )}
      </label>
      {/* The same volumes the hover card carries, reachable by keyboard and readable by a
          screen reader. The backdrop's marks are inside an aria-hidden subtree -- correctly, it
          duplicates the control's own text -- so without this the volumes and the tier shading
          exist for pointer users only, and the tier is conveyed by colour alone. One tab stop
          per field; making the ~150 marks of a long description focusable would not be. */}
      {fieldKeywords.length > 0 && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setSummaryOpen((open) => !open)}
            aria-expanded={summaryOpen}
            aria-controls={summaryId}
            className="inline-flex items-center gap-1 rounded text-[11px] text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-700 focus:outline focus:outline-2 focus:outline-brand-100"
          >
            <span aria-hidden="true" className="text-[9px]">{summaryOpen ? '\u25BC' : '\u25B6'}</span>
            {fieldKeywords.length} research {fieldKeywords.length === 1 ? 'keyword' : 'keywords'} here
            {' \u00B7 '}
            {fieldVolume.toLocaleString('en-US')} searches / mo
          </button>
          <ul id={summaryId} hidden={!summaryOpen} className="mt-1 space-y-1 text-[11px]">
            {fieldKeywords.map((entry) => {
              const uses = usage?.get(keywordLower(entry)) ?? 0;
              return (
                <li key={entry.keyword} className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 h-2.5 w-4 shrink-0 rounded-md ${TIER_MARK[volumeTier(entry.searchVolume)]}`}
                    />
                    <span className="truncate text-slate-700">{entry.keyword}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {entry.searchVolume.toLocaleString('en-US')} / mo
                    {uses > 0 && ` \u00B7 used ${uses} ${uses === 1 ? 'time' : 'times'} in this listing`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    {hovered && createPortal(<KeywordTooltip hovered={hovered} usage={usage} />, document.body)}
    </div>
  );
}

/** The hover card for one highlighted keyword.
 *
 *  Positioned after measuring itself: a fixed half-width guess clips long keywords against the
 *  viewport edge, and the mark being hovered can sit anywhere on a wide field. So the first
 *  layout pass reads the real box, clamps it into the viewport, flips it below the mark when
 *  there is no room above, and slides the arrow back onto the mark's centre — the arrow has to
 *  track the anchor independently once the card itself has been pushed sideways. */
function KeywordTooltip({ hovered, usage }) {
  const { entry, rect } = hovered;
  const cardRef = useRef(null);
  const [placement, setPlacement] = useState(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const { width, height } = card.getBoundingClientRect();
    const margin = 8;
    const gap = 10;
    const anchorX = rect.left + rect.width / 2;
    const left = Math.min(Math.max(anchorX - width / 2, margin), Math.max(window.innerWidth - width - margin, margin));
    const below = rect.top - height - gap < margin;
    setPlacement({
      left,
      top: below ? rect.bottom + gap : rect.top - height - gap,
      // Clamped to the card's own corners so the arrow never floats off its rounded edge.
      arrowLeft: Math.min(Math.max(anchorX - left, 14), Math.max(width - 14, 14)),
      below,
    });
  }, [rect, entry]);

  const tier = volumeTier(entry.searchVolume);
  const uses = usage?.get(keywordLower(entry)) ?? 0;

  return (
    <div
      ref={cardRef}
      style={
        placement
          ? { position: 'fixed', top: placement.top, left: placement.left, zIndex: 99999 }
          : { position: 'fixed', top: 0, left: 0, visibility: 'hidden', zIndex: 99999 }
      }
      className="pointer-events-none w-max max-w-[240px] animate-fade-in rounded-xl bg-slate-900 px-3 py-2.5 shadow-xl ring-1 ring-white/10"
    >
      <div className="text-[11px] font-medium leading-snug text-slate-300 break-words">{entry.keyword}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-lg font-bold leading-none tabular-nums ${TIER_VALUE[tier]}`}>
          {entry.searchVolume.toLocaleString('en-US')}
        </span>
        <span className="text-[11px] text-slate-400">searches / mo</span>
      </div>
      {uses > 0 && (
        <div className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-slate-400">
          Used {uses} {uses === 1 ? 'time' : 'times'} in this listing
        </div>
      )}
      {placement && (
        <span
          aria-hidden="true"
          style={{ left: placement.arrowLeft - 5 }}
          className={`absolute h-2.5 w-2.5 rotate-45 bg-slate-900 ${placement.below ? '-top-1' : '-bottom-1'}`}
        />
      )}
    </div>
  );
}

/** The legend shown once above the highlighted fields, so the shading is self-explanatory.
 *
 *  No "N of M keywords used" ratio here on purpose: M is every extracted candidate — hundreds of
 *  them, most long-tail noise no single listing should ever try to carry — so the fraction reads
 *  as a failing grade on copy that is in fact fine. Per-keyword usage shows on hover, and in
 *  each field's own keyword list. */
export function KeywordHighlightLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-slate-600">
      <span className="font-semibold text-slate-700">Keywords from your research</span>
      <span className="flex items-center gap-1.5">
        <span className={`h-2.5 w-4 rounded-md ${TIER_MARK.high}`} /> 5,000+ / mo
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-2.5 w-4 rounded-md ${TIER_MARK.medium}`} /> 1,000+ / mo
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-2.5 w-4 rounded-md ${TIER_MARK.low}`} /> under 1,000
      </span>
      <span className="text-slate-500">
        Hover a highlight for its monthly searches, or open a field&rsquo;s keyword list below it.
      </span>
    </div>
  );
}
