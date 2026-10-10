import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, ChevronDown, Loader2, AlertTriangle, Sparkles, PackageSearch, Search, Puzzle, Image as ImageIcon,
} from 'lucide-react';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { CARD, MUTED, BTN_PRIMARY, ERROR_TEXT } from '../../../components/listingStudio/ui/classNames';

// Shown for any of the three background jobs (research/strategy/aplus) — see ProjectLayout's
// pipelineActive check. Research auto-starts server-side right after an ASIN import (see
// server/listingStudio/routes.js's /projects/from-asin handler) and runs image-library analysis,
// market synthesis, and all 6 recommended-image generations itself before reporting "done"; the
// strategy/A+ auto-chain this page's history once described is intentionally not wired up (see
// pipeline/research.js) — strategy/aplus jobs only land here because a user started one by hand
// from their own page (e.g. AplusPage's "Generate 3 concepts"), and ProcessingPage redirects them
// back to that same page once done (see the `fromKey` redirect below), not on to Images.
//
// These 4 stages are sub-buckets of the single 'research' job's own monotonically-increasing
// job.progress (see server/listingStudio/pipeline/research.js's `update()` calls: 5/15% keyword
// derivation+search, 35/55/65% competitor fetch+reviews+photo analysis, 80% synthesis, 90-100%
// image generation) — NOT one stage per background job kind. An earlier version of this stepper
// mapped one stage per job *kind* (research/strategy/aplus, each its own job with its own 0-100
// progress) and got retired because those separate jobs' progress numbers reset independently,
// making the stepper and the ETA clock below visibly disagree. Bucketing by one job's own
// progress can't regress like that — it only ever moves forward within the same number.
const STAGES = [
  { label: 'Analyze Product', icon: PackageSearch, minProgress: 0 },
  { label: 'Research Market', icon: Search, minProgress: 20 },
  { label: 'Create Concepts', icon: Puzzle, minProgress: 70 },
  { label: 'Generate Images', icon: ImageIcon, minProgress: 85 },
];

// A soft ETA, not a hard deadline — real completion is always driven by the job record (the
// stepper and step text below), never by this clock. The bar/percentage are deliberately tied
// to elapsed time, not to job.progress: job.progress resets and jumps around as each of the
// three real jobs (research/strategy/aplus) runs its own 0-100 internally, which made the bar
// and the "time left" figure visibly disagree (e.g. "8 min left" next to "55%"). A single
// smooth time-based clock is honest about what it is — an estimate — and reads as one coherent
// number instead of two disagreeing ones. If the job finishes before 10 minutes (the common
// case), the page moves on immediately regardless of how much of the bar is filled; if 10
// minutes pass first, it just holds at 100% and keeps waiting on the real job status.
const ETA_SECONDS = 10 * 60;

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ProcessingPage() {
  const { project, job } = useProjectCtx();
  const navigate = useNavigate();

  // The job record polled by ProjectLayout can transiently point at an unrelated follow-on
  // job (e.g. "image-library" — research.js spins one up mid-flight for its own "Analyzing
  // product photos" step, with its own progress that resets to 0 — see the STAGES comment
  // above) — track the furthest visible stage reached so the stepper never flickers backward
  // while a non-'research' job is briefly the one being polled.
  const [maxStage, setMaxStage] = useState(0);
  const rawStage =
    job?.kind === 'research' ? STAGES.reduce((acc, s, i) => ((job.progress ?? 0) >= s.minProgress ? i : acc), 0) : -1;
  useEffect(() => {
    if (rawStage > maxStage) setMaxStage(rawStage);
  }, [rawStage, maxStage]);
  const currentStage = Math.max(maxStage, 0);

  const allDone = ['research', 'strategy', 'aplus'].includes(job?.kind) && job.status === 'done';

  // Where to send the user back to once the job finishes: wherever ProjectLayout redirected them
  // FROM (e.g. 'aplus' if they clicked "Generate 3 concepts" on the A+ Content page), falling back
  // to 'research' for the unattended research pipeline (no originating page to return to) or if
  // that value is ever missing.
  const fromKey = `listingStudio:pipelineFrom:${project.id}`;
  useEffect(() => {
    if (!allDone) return undefined;
    let from = 'research';
    try {
      from = window.localStorage.getItem(fromKey) || 'research';
    } catch {
      // ignore — falls back to 'research'
    }
    const t = setTimeout(() => {
      navigate(`/listing-studio/p/${project.id}/${from}`);
      try {
        window.localStorage.removeItem(fromKey);
      } catch {
        // ignore
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [allDone, navigate, project.id, fromKey]);

  // The countdown has to survive leaving and re-entering this page (ProjectLayout now forces
  // the user back onto /processing on every reload while the pipeline is active) — a clock that
  // just counted down from a `useState` would otherwise restart at a fresh 10:00 on every
  // remount, since that state (and the component) is recreated from scratch each time. Anchor
  // it instead to a real wall-clock start time persisted in localStorage per project.
  //
  // The stored value is keyed by job.id, not by catching the job at a particular status/progress
  // snapshot — a fast worker can already have picked the job up and moved it past 'queued'/0
  // progress before this page's very first poll ever observes it, so resetting only on that exact
  // snapshot missed the reset entirely depending on timing (the "sometimes works" bug). Comparing
  // job ids is not racy: whatever status the first poll happens to catch a new job at, its id is
  // already different from whatever job the stored clock belongs to, so the reset always fires
  // exactly once per real job, the moment this page learns that job exists.
  const startKey = `listingStudio:pipelineStart:${project.id}`;
  const [clock, setClock] = useState(() => {
    try {
      const raw = window.localStorage.getItem(startKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed.jobId === 'string' && typeof parsed.startedAt === 'number') return parsed;
    } catch {
      // ignore — falls through to no stored clock yet; the effect below sets one once job.id is known
    }
    return null;
  });
  useEffect(() => {
    if (!job?.id || clock?.jobId === job.id) return;
    const next = { jobId: job.id, startedAt: Date.now() };
    setClock(next);
    try {
      window.localStorage.setItem(startKey, JSON.stringify(next));
    } catch {
      // ignore — the clock still works for this page view, just won't survive a remount
    }
  }, [job?.id, clock?.jobId, startKey]);
  const pipelineStart = clock?.startedAt ?? Date.now();
  useEffect(() => {
    if (!allDone) return;
    try {
      window.localStorage.removeItem(startKey);
    } catch {
      // ignore
    }
  }, [allDone, startKey]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (allDone) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [allDone]);
  const elapsedSeconds = Math.floor((now - pipelineStart) / 1000);
  const secondsLeft = allDone ? 0 : Math.max(0, ETA_SECONDS - elapsedSeconds);
  const elapsedPct = allDone ? 100 : Math.min(100, Math.round((elapsedSeconds / ETA_SECONDS) * 100));

  const isError = job?.status === 'error';
  const isAwaitingSelection = job?.status === 'awaiting_selection';

  // A running log of every distinct step the real job has reported, newest first — the closest
  // approximation we can build client-side to a real backend audit trail (the job record only
  // ever holds its *current* step, not a history of past ones). Persists across the
  // research -> strategy -> A+ handoff since this component stays mounted for all three; a full
  // page reload naturally starts a fresh log, which is an acceptable approximation given there's
  // no server-side step history to restore from.
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!job?.step) return;
    setHistory((prev) => {
      const top = prev[0];
      if (top && top.label === job.step && top.kind === job.kind) return prev;
      const rest = top ? [{ ...top, done: true }, ...prev.slice(1)] : prev;
      return [{ key: `${job.kind}:${job.step}:${prev.length}`, label: job.step, kind: job.kind, startedAt: Date.now(), done: false }, ...rest];
    });
  }, [job?.step, job?.kind]);
  useEffect(() => {
    if (!allDone) return;
    setHistory((prev) => (prev.length && !prev[0].done ? [{ ...prev[0], done: true }, ...prev.slice(1)] : prev));
  }, [allDone]);
  const [expandedKey, setExpandedKey] = useState(null);
  useEffect(() => {
    if (history[0]) setExpandedKey(history[0].key);
  }, [history[0]?.key]);

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn">
      <div className={`${CARD} p-6 sm:p-8`}>
        {isAwaitingSelection ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-1">Please choose competitors</h1>
            <p className={`${MUTED} mb-4`}>
              You asked to pick the competitors yourself — head to Research to choose which ones to analyze, then
              the rest of this campaign will keep building automatically.
            </p>
            <button type="button" className={BTN_PRIMARY} onClick={() => navigate(`/listing-studio/p/${project.id}/research`)}>
              Choose competitors
            </button>
          </>
        ) : isError ? (
          <>
            <h1 className={`${ERROR_TEXT} text-lg font-semibold mb-1 flex items-center gap-2`}>
              <AlertTriangle size={18} /> Something went wrong
            </h1>
            <p className={`${MUTED} mb-4`}>{job.error}</p>
            <button type="button" className={BTN_PRIMARY} onClick={() => navigate(`/listing-studio/p/${project.id}/research`)}>
              View campaign
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span
                key={allDone ? 'done' : 'pending'}
                className={`w-9 h-9 rounded-xl grid place-items-center flex-shrink-0 animate-zoomIn ${allDone ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}
              >
                {allDone ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
              </span>
              <h1 className="text-xl font-semibold text-slate-900">
                {allDone ? 'Your campaign is ready' : 'Building your campaign'}
              </h1>
            </div>
            <p className={`${MUTED} mb-6`}>
              {allDone
                ? 'Research, creative strategy, and A+ concepts are all set — taking you there now.'
                : "Good things take time — it's safe to leave this page and come back later, this keeps running in the background."}
            </p>

            {!allDone && (
              <div className="flex items-center justify-between text-sm text-slate-600 font-medium mb-1.5">
                <span>{formatClock(secondsLeft)} left</span>
                <span>{elapsedPct}%</span>
              </div>
            )}
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mb-7">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-1000 ease-linear overflow-hidden"
                style={{ width: `${elapsedPct}%` }}
              >
                {!allDone && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
                )}
              </div>
            </div>

            <div className="flex items-start mb-2">
              {STAGES.map((s, i) => {
                const done = i < currentStage || allDone;
                const active = i === currentStage && !allDone;
                return (
                  <React.Fragment key={s.label}>
                    {i > 0 && (
                      <div className={`flex-1 h-0.5 mx-2 mt-[22px] rounded-full transition-colors duration-500 ${done ? 'bg-brand-600' : 'bg-slate-200'}`} />
                    )}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0 w-24">
                      <div className="relative">
                        {active && <span className="absolute inset-0 rounded-full bg-brand-400/40 animate-ping" />}
                        <div
                          className={`relative w-11 h-11 rounded-full grid place-items-center border-2 transition-colors duration-300 ${
                            done
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : active
                                ? 'border-brand-600 text-brand-600 shadow-[0_0_0_4px_rgba(37,99,235,0.1)]'
                                : 'border-slate-200 text-slate-400'
                          }`}
                        >
                          {done ? <CheckCircle2 size={20} /> : active ? <Loader2 size={18} className="animate-spin" /> : <s.icon size={18} />}
                        </div>
                      </div>
                      <span className={`text-xs font-medium text-center leading-tight ${active ? 'text-brand-600' : done ? 'text-slate-900' : 'text-slate-400'}`}>
                        {s.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {history.length > 0 && (
              <div className="border-t border-slate-100 mt-5 pt-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Progress history</h2>
                <div className="space-y-1.5">
                  {history.map((h) => {
                    const isOpen = expandedKey === h.key;
                    return (
                      <div key={h.key} className="rounded-lg border border-slate-100 overflow-hidden animate-slideInFromBottom">
                        <button
                          type="button"
                          onClick={() => setExpandedKey(isOpen ? null : h.key)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-full grid place-items-center flex-shrink-0 ${
                                h.done ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'
                              }`}
                            >
                              {h.done ? <CheckCircle2 size={12} /> : <Loader2 size={11} className="animate-spin" />}
                            </span>
                            <span className="text-sm font-medium text-slate-900 truncate">{h.label}</span>
                          </span>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs font-medium ${h.done ? 'text-emerald-600' : 'text-brand-600'}`}>
                              {h.done ? 'Completed' : 'In progress'}
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-2.5 -mt-1 text-xs text-slate-400 border-t border-slate-50 pt-2">
                            Started {new Date(h.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
