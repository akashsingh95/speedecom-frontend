import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, ChevronDown, Loader2, AlertTriangle, Sparkles, PackageSearch, Search, Puzzle, Image as ImageIcon,
} from 'lucide-react';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { CARD, MUTED, BTN_PRIMARY, ERROR_TEXT } from '../../../components/listingStudio/ui/classNames';
import { formatClock, usePipelineClock, clearPipelineClock } from '../../../components/listingStudio/pipelineClock';
import { creditNotificationMessage } from '../../../components/listingStudio/creditNotifications';
import { toast } from 'sonner';

// Shown for any of the three background jobs (research/strategy/aplus) — see ProjectLayout's
// pipelineActive check. Research auto-starts server-side right after an ASIN import (see
// server/listingStudio/routes.js's /projects/from-asin handler) and runs image-library analysis,
// market synthesis, and all 6 recommended-image generations itself, THEN unconditionally
// auto-chains a brand-new 'strategy' job (pipeline/research.js's enqueueJob(fresh, 'strategy'))
// before finally reporting its own "done" — so this page sees the polled job id/kind flip from
// research to strategy mid-flight on every single run, not just when a user manually starts one
// (see pipelineClock.js's usePipelineClock for why the ETA clock no longer keys off that id).
// A+ has no such auto-chain — an 'aplus' job only lands here because a user started one by hand
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

export default function ProcessingPage() {
  const { project, job, refresh } = useProjectCtx();
  const navigate = useNavigate();

  // The job record polled by ProjectLayout can transiently point at an unrelated follow-on
  // job (e.g. "image-library" — research.js spins one up mid-flight for its own "Analyzing
  // product photos" step, with its own progress that resets to 0 — see the STAGES comment
  // above) — track the furthest visible stage reached so the stepper never flickers backward
  // while a non-'research' job is briefly the one being polled.
  const isResearchJob = (job?.kind ?? 'research') === 'research';
  const [maxStage, setMaxStage] = useState(0);
  const rawStage = isResearchJob
    ? STAGES.reduce((acc, s, i) => ((job?.progress ?? 0) >= s.minProgress ? i : acc), 0)
    : -1;
  useEffect(() => {
    if (rawStage > maxStage) setMaxStage(rawStage);
  }, [rawStage, maxStage]);
  const currentStage = Math.max(maxStage, 0);

  // The job record polled by ProjectLayout isn't guaranteed to be one of the three pipeline
  // kinds this page knows how to narrate — it can be null (no job has ever run for this
  // project), or the most recent job could be an unrelated background one (e.g. 'image-library')
  // if that's all that's ever run. Landing here with a job like that used to fall through to the
  // default "Building your campaign" branch anyway, which then never resolves (allDone can only
  // become true for a pipeline-kind job) — an empty-looking page that spins forever with no way
  // out. isPipelineJob gates every other branch below so that case gets its own explicit message
  // instead of a permanently stuck spinner.
  const isPipelineJob = ['research', 'strategy', 'aplus'].includes(job?.kind);
  const allDone = isPipelineJob && job.status === 'done';
  const isError = isPipelineJob && job.status === 'error';
  const noActiveJob = !isPipelineJob;

  // Where to send the user back to once the job finishes: wherever ProjectLayout redirected them
  // FROM (e.g. 'aplus' if they clicked "Generate 3 concepts" on the A+ Content page), falling back
  // to 'research' for the unattended research pipeline (no originating page to return to) or if
  // that value is ever missing.
  const fromKey = `listingStudio:pipelineFrom:${project.id}`;
  useEffect(() => {
    if (!allDone) return undefined;
    const message = creditNotificationMessage(job?.billing, 'Campaign completed');
    if (message) toast.success(message);
    let from = 'research';
    try {
      from = window.localStorage.getItem(fromKey) || 'research';
    } catch {
      // ignore — falls back to 'research'
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      // watchJob's own `void refresh()` (ProjectLayout) is fire-and-forget, so `project` isn't
      // guaranteed to reflect this completed job yet — await a fresh refresh() here so Research/
      // Strategy don't render against stale data the instant we land there.
      await refresh().catch(() => {});
      if (cancelled) return;
      navigate(`/listing-studio/p/${project.id}/${from}`);
      try {
        window.localStorage.removeItem(fromKey);
      } catch {
        // ignore
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [allDone, navigate, project.id, fromKey, refresh]);

  // Shared with ProjectLayout's outer jobbar (keyed by project, not by which page renders it) so
  // both read the exact same clock instead of two independently running timers that could drift
  // apart. It also has to survive leaving and re-entering this page (ProjectLayout forces the
  // user back onto /processing on every reload while the pipeline is active) — see
  // usePipelineClock for why it's anchored to a persisted wall-clock start time rather than a
  // plain `useState` countdown, which would otherwise restart at a fresh 10:00 on every remount.
  const { secondsLeft } = usePipelineClock(project.id, { ticking: !allDone });
  useEffect(() => {
    // Clear on error too, not just success — otherwise a later genuinely new run (started after
    // a fresh mount, e.g. a reopened tab) would resume this failed run's stale clock instead of
    // starting its own.
    if (allDone || isError) clearPipelineClock(project.id);
  }, [allDone, isError, project.id]);

  const isAwaitingSelection = isPipelineJob && job.status === 'awaiting_selection';

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
        ) : noActiveJob ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-1">Nothing is processing right now</h1>
            <p className={`${MUTED} mb-4`}>
              There's no research, strategy, or A+ generation currently running for this campaign.
            </p>
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
                <span>{job?.progress ?? 0}%</span>
              </div>
            )}
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mb-7">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-1000 ease-linear overflow-hidden"
                style={{ width: `${allDone ? 100 : (job?.progress ?? 0)}%` }}
              >
                {!allDone && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
                )}
              </div>
            </div>

            {isResearchJob ? (
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
            ) : (
              // The 4-stage stepper above is bucketed off the 'research' job's own progress (see
              // the STAGES comment) and has no meaning for a 'strategy'/'aplus' job's independent
              // 0-100 progress — rendering it for those just left every icon frozen on "Analyze
              // Product" for the whole run, which read as "nothing is happening" even though the
              // job really was moving (job.step was only visible buried in the collapsed history
              // list below). Show that live step directly instead, so progress is visible without
              // opening anything.
              !allDone && (
                <div className="flex items-center gap-2.5 mb-5 text-sm font-medium text-slate-700">
                  <Loader2 size={16} className="animate-spin text-brand-600 flex-shrink-0" />
                  <span>{job?.step || 'Working…'}</span>
                </div>
              )
            )}

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
