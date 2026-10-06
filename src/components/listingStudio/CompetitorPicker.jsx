import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { listingStudioApi } from './api';
import {
  CARD, CARD_TITLE, MUTED, SMALL, BTN_PRIMARY, SERP_GRID, SERP_ITEM_SELECTABLE, SERP_ITEM_SELECTED,
  SERP_CHECK, SERP_CHECK_SELECTED, SERP_CHECK_UNSELECTED, SERP_IMG, SERP_THUMB_EMPTY, SERP_TITLE,
} from './ui/classNames';

/** Splits a pasted block of ASINs/URLs on commas, whitespace, or newlines into clean tokens. */
function splitInputs(text) {
  return text.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

// Ported from speed-listing's components/CompetitorPicker.tsx — the widened
// candidate pool a research job pauses on ("awaiting_selection") for the user to
// hand-pick which competitors get a full deep-dive scrape + review mining.
export default function CompetitorPicker({ project, candidates, watchJob, onContinueChange }) {
  const [candidateList, setCandidateList] = useState(candidates);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const [addText, setAddText] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const toggle = (asin) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(asin)) next.delete(asin);
      else next.add(asin);
      return next;
    });

  const addCompetitors = async () => {
    const inputs = splitInputs(addText);
    if (inputs.length === 0) return;
    setAddBusy(true);
    try {
      const { added, notFound } = await listingStudioApi.addResearchCandidates(project.id, inputs);
      setCandidateList((prev) => [...prev, ...added]);
      setSelected((s) => new Set([...s, ...added.map((a) => a.asin)]));
      setAddText('');
      // A partial-success case — the request itself succeeded, so the shared axios
      // interceptor never sees a failure to toast on its own; surface it here instead.
      if (notFound?.length) {
        toast.error(`Couldn't fetch: ${notFound.join(', ')}`);
      }
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setAddBusy(false);
    }
  };

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      await listingStudioApi.submitCompetitorSelection(project.id, Array.from(selected));
      watchJob();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setBusy(false);
    }
  }, [project.id, selected, watchJob]);

  // Keep the single forward action in the project footer in sync with this picker.
  useEffect(() => {
    onContinueChange?.({ onClick: submit, disabled: busy || selected.size === 0, busy, selectedCount: selected.size });
    return () => onContinueChange?.(null);
  }, [onContinueChange, submit, selected.size, busy]);

  return (
    <div className={CARD}>
      <h2 className={CARD_TITLE}>Choose competitors to research</h2>
      <p className={`${MUTED} ${SMALL}`}>
        We found {candidateList.length} candidates. Pick the ones worth a full deep-dive (detail scrape + review
        mining), or add your own below.
      </p>

      <div className="flex gap-2 mt-3 mb-1">
        <input
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCompetitors())}
          placeholder="Paste ASINs or Amazon URLs — comma, space, or new-line separated"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
        />
        <button
          type="button"
          onClick={addCompetitors}
          disabled={addBusy || splitInputs(addText).length === 0}
          className={`${BTN_PRIMARY} gap-1.5 whitespace-nowrap`}
        >
          {addBusy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Add Competitor
        </button>
      </div>
      <p className={`${MUTED} text-xs mb-3`}>Comma, space, or new-line separated · up to 10 per add</p>

      <div className={SERP_GRID}>
        {candidateList.map((c) => (
          <label
            key={c.asin}
            className={`${SERP_ITEM_SELECTABLE} ${selected.has(c.asin) ? SERP_ITEM_SELECTED : ''}`}
          >
            <input type="checkbox" className="sr-only" checked={selected.has(c.asin)} onChange={() => toggle(c.asin)} />
            <span className={`${SERP_CHECK} ${selected.has(c.asin) ? SERP_CHECK_SELECTED : SERP_CHECK_UNSELECTED}`}>
              {selected.has(c.asin) && <Check size={12} strokeWidth={3} />}
            </span>
            {c.imageUrl ? <img src={c.imageUrl} alt="" className={SERP_IMG} /> : <div className={SERP_THUMB_EMPTY} />}
            <div className={SERP_TITLE}>{c.title}</div>
            {(c.rating !== undefined || c.reviewsCount !== undefined) && (
              <div className={`${MUTED} ${SMALL}`}>
                {c.rating !== undefined && `${c.rating}★ `}
                {c.reviewsCount !== undefined ? `(${c.reviewsCount.toLocaleString()} reviews)` : ''}
              </div>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
