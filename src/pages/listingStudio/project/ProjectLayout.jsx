import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, NavLink, Link, useParams, useLocation } from 'react-router-dom';
import {
    ArrowLeft, ExternalLink, Search, Target, Puzzle, Layers, Image as ImageIcon, Images as ImagesIcon, GitCompare, Mic,
    Loader2, X, FileUp, Clock, Palette, Video, Boxes,
  } from 'lucide-react';
  import { getErrorMessage } from '../../../components/listingStudio/errors';
  import { listingStudioApi } from '../../../components/listingStudio/api';
  import { formatClock, usePipelineClock } from '../../../components/listingStudio/pipelineClock';
  import { brandkitApi } from '../../../components/listingStudio/brandkitApi';
  import { BrandkitSelect } from '../../../components/listingStudio/BrandkitSelect';
  import { amazonUrl, marketplaceCode } from '../../../components/listingStudio/helpers';
  import { FillSellerTemplateModal } from '../../../components/listingStudio/FillSellerTemplateModal';
  import { Modal } from '../../../components/listingStudio/ui/Modal';
  import {
  NAV_ITEM_BASE,
  NAV_ITEM_ACTIVE,
  SECTION_PAGER,
  BTN,
  BTN_PRIMARY,
  JOBBAR,
  JOBBAR_ERROR,
  JOBBAR_TRACK,
  JOBBAR_FILL,
  PAGE_CENTER,
  CARD_TITLE,
} from '../../../components/listingStudio/ui/classNames';

// Campaign shell — ported from speed-listing's pages/project/ProjectLayout.tsx. Only its
// `isEmbedded` branch is kept (a single horizontal TopNav): this always runs inside
// speedecom now, so the standalone full-sidebar branch (+ the mobile Drawer it needed)
// is dead code, same collapse ListingStudioShell already applied to AppShell.tsx.
const NAV = [
  { to: 'research', label: 'Research', icon: Search },
  { to: 'images', label: 'Images', icon: ImagesIcon },
  { to: 'videos', label: 'Videos', icon: Video },
  { to: 'strategy', label: 'Creative Strategy', icon: Target },
  { to: 'aplus', label: 'A+ Content', icon: Puzzle },
  { to: 'premium-aplus', label: 'Premium A+', icon: Layers },
  { to: 'listing', label: 'Listing', icon: ImageIcon },
  { to: 'compare', label: 'Comparison Shelf', icon: GitCompare },
  { to: 'readiness', label: 'Alexa Shopping', icon: Mic },
  { to: 'variants', label: 'Variants', icon: Boxes },
];

/** Product identity bar — back arrow + thumbnail + campaign name + ASIN, with the section
 *  tabs directly below. Also carries the "Fill My Template" action: it needs to reach
 *  every section (not just Images), so it lives here rather than in any one page. */
function TopNav({ project, onProjectUpdate }) {
  const [showFillTemplate, setShowFillTemplate] = useState(false);
  const [showBrandkitPicker, setShowBrandkitPicker] = useState(false);
  // Stable across re-renders — an inline arrow recreated on every parent re-render would give
  // Modal a fresh onClose identity each time for no reason.
  const closeFillTemplate = useCallback(() => setShowFillTemplate(false), []);

  // Live reference, not a snapshot: changing the linked Brandkit here takes effect on the very
  // next generation with no separate "save" step. Feeds the response into onProjectUpdate so the
  // page reflects the change without a full refetch.
  const changeBrandkit = async (nextBrandKitId) => {
    try {
      const updated = await brandkitApi.setProjectBrandKit(project.id, nextBrandKitId || null);
      onProjectUpdate(updated);
      setShowBrandkitPicker(false);
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            to="/listing-studio/campaigns"
            aria-label="Back to campaigns"
            className="flex-shrink-0 w-8 h-8 rounded-lg grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          {project.images[0] ? (
            <img src={project.images[0]} alt="" className="w-9 h-9 rounded-md object-cover bg-white border border-slate-200 flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-md bg-slate-50 border border-slate-200 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate" title={project.input.name}>
              {project.input.name}
            </div>
            {project.sourceAsin && (
              <div className="flex items-center gap-1.5 text-xs">
                <a
                  href={amazonUrl(project.sourceAsin, project.marketplace)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                >
                  {project.sourceAsin} <ExternalLink size={10} />
                </a>
                {project.marketplace && <span className="text-slate-400">{marketplaceCode(project.marketplace)}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowBrandkitPicker(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50"
          >
            <Palette size={15} /> {project.brandKit?.name ?? 'No Brandkit'}
          </button>
          <button
            type="button"
            onClick={() => setShowFillTemplate(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
          >
            <FileUp size={15} /> Fill My Template
          </button>
        </div>
      </div>
      <nav className="flex flex-nowrap items-center gap-1 px-4">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `${NAV_ITEM_BASE} ${isActive ? NAV_ITEM_ACTIVE : ''}`}
          >
            <n.icon size={18} className="flex-shrink-0" /> {n.label}
          </NavLink>
        ))}
      </nav>

      {showFillTemplate && <FillSellerTemplateModal project={project} onClose={closeFillTemplate} />}

      {showBrandkitPicker && (
        <Modal onClose={() => setShowBrandkitPicker(false)}>
          <h2 className={`${CARD_TITLE} mb-3`}>Change Brandkit</h2>
          <BrandkitSelect value={project.brandKitId ?? ''} onChange={changeBrandkit} />
        </Modal>
      )}
    </div>
  );
}

function SectionPager({ index, researchContinue }) {
  if (index === -1) return null;
  const prev = index > 0 ? NAV[index - 1] : null;
  const next = index < NAV.length - 1 ? NAV[index + 1] : null;
  return (
    <div className={SECTION_PAGER}>
      {prev ? (
        <Link to={prev.to} className={BTN}>
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {index === 0 && researchContinue ? (
        <button
          type="button"
          onClick={researchContinue.onClick}
          disabled={researchContinue.disabled}
          className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {researchContinue.busy ? 'Starting research…' : `Continue with ${researchContinue.selectedCount} selected →`}
        </button>
      ) : next ? (
        <Link to={next.to} className={BTN_PRIMARY}>
          {next.label} →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

export default function ProjectLayout() {
  const { id = '' } = useParams();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [job, setJob] = useState(null);
  const [jobChecked, setJobChecked] = useState(false);
  const [error, setError] = useState('');
  const [dismissedJobId, setDismissedJobId] = useState(null);
  const [researchContinue, setResearchContinue] = useState(null);
  const pollRef = useRef(null);
  // Id of the 800ms "check for an auto-chained follow-on job" timeout watchJob() schedules
  // after a job finishes — tracked so stopPolling() can cancel it too, not just the interval.
  const followUpTimerRef = useRef(null);
  // Job ids we've already auto-sent the user to /processing for (see pipelineActive below) —
  // lets that redirect fire once per job without re-firing on every poll tick for the rest of
  // that job's run, so a user who deliberately switches to another tab to check e.g. Research
  // results while Strategy is still generating doesn't get bounced straight back.
  const autoRedirectedJobIds = useRef(new Set());

  // A failed job (e.g. an OpenAI billing error) otherwise stays the "most recent job"
  // for the whole project — and thus keeps rendering this banner — until some other job
  // runs, even long after the underlying issue is fixed and later generations succeed.
  // Persist the dismissal per project so it survives navigation and reloads.
  useEffect(() => {
    try {
      setDismissedJobId(window.localStorage.getItem(`listingStudio:dismissedJob:${id}`));
    } catch {
      setDismissedJobId(null);
    }
  }, [id]);

  const dismissJobError = useCallback(() => {
    if (!job) return;
    setDismissedJobId(job.id);
    try {
      window.localStorage.setItem(`listingStudio:dismissedJob:${id}`, job.id);
    } catch {
      // ignore — dismissal is a client-side convenience, not critical
    }
  }, [job, id]);

  const refresh = useCallback(async () => {
    try {
      setProject(await listingStudioApi.getProject(id));
    } catch (e) {
      // Unlike the other error states in this module, this one isn't a redundant banner next
      // to otherwise-working content — with no project loaded, this is the whole page's only
      // content, and without it a failed fetch would just leave the skeleton loader spinning
      // forever with no way back to the campaigns list.
      setError(getErrorMessage(e));
    }
  }, [id]);

  // A bounded, one-shot "wait until some project-derived condition settles" primitive, exposed
  // on context for pages that need to wait on a narrower condition than watchJob's indefinite
  // job-status subscription below covers — e.g. AplusPage waiting on one A+ module image slot's
  // generating/error/path fields. Those slot updates are deliberately NOT part of the job system
  // (ADR-0009: module image generation is a single-image action kept outside the project's
  // shared job/status system), so watchJob's job-polling never sees them; this is the shared
  // machinery such a narrower poll reuses instead of hand-rolling its own interval and
  // attempt-cap. Each tick refreshes the shared `project` state too, so a caller never needs its
  // own trailing refresh() once `check` is satisfied.
  const pollUntil = useCallback(
    async (check, { intervalMs = 2000, maxAttempts = 150, timeoutMessage } = {}) => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        const p = await listingStudioApi.getProject(id);
        setProject(p);
        const result = check(p);
        if (result !== undefined) {
          if (result instanceof Error) throw result;
          return result;
        }
      }
      throw new Error(timeoutMessage ?? 'Still generating — this is taking longer than usual. Check back shortly.');
    },
    [id],
  );

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (followUpTimerRef.current !== null) {
      window.clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
  };

  const watchJob = useCallback(() => {
    stopPolling();
    const tick = async () => {
      try {
        const j = await listingStudioApi.getJob(id);
        setJob(j);
        if (j.status === 'done' || j.status === 'error' || j.status === 'awaiting_selection') {
          stopPolling();
          if (j.status === 'done') {
            void refresh();
            // Landing the user on Images once research (with its baked-in image generation)
            // finishes is handled by ProcessingPage's own allDone check, not here — it's the
            // page the user is forced onto while the pipeline runs (see pipelineActive below).
            // Some jobs auto-chain a follow-on job server-side without any user action.
            // One-shot check shortly after "done" for a newer job id; if one appeared, resume
            // watching it. If not, this is a no-op.
            followUpTimerRef.current = window.setTimeout(async () => {
              followUpTimerRef.current = null;
              try {
                const next = await listingStudioApi.getJob(id);
                if (next.id !== j.id) {
                  setJob(next);
                  watchJob();
                }
              } catch {
                // ignore — the UI already reflects the completed job
              }
            }, 800);
          }
        }
      } catch {
        stopPolling();
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, 2500);
  }, [id, refresh]);

  useEffect(() => {
    void refresh();
    // Resume polling if a job is mid-flight (e.g. after page refresh).
    listingStudioApi
      .getJob(id)
      .then((j) => {
        setJob(j);
        if (j.status === 'running' || j.status === 'queued') watchJob();
      })
      .catch(() => undefined)
      .finally(() => setJobChecked(true));
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Same clock ProcessingPage's live-progress view ticks (keyed by project id, not by which page
  // renders it — see usePipelineClock) so the countdown shown here matches exactly rather than
  // running as a second, independently-drifting timer. Computed ahead of the early returns below
  // since hooks can't follow a conditional return.
  const jobRunning = job?.status === 'running' || job?.status === 'queued';
  // jobChecked gates this: `job` (and so jobRunning) is unknown, not "not running", until the
  // initial getJob() fetch above resolves — see usePipelineClock's `ready` param.
  const { secondsLeft } = usePipelineClock(id, { ticking: jobRunning, ready: jobChecked });

  if (error) {
    return (
      <div className={PAGE_CENTER}>
        <p className="text-red-600">{error}</p>
        <Link to="/listing-studio/campaigns" className="text-brand-600">
          ← Back to campaigns
        </Link>
      </div>
    );
  }
  if (!project || !jobChecked) {
    return (
      <div className={PAGE_CENTER}>
        <div className="w-full max-w-[420px] p-1">
          <div className="h-6 w-2/5 mb-4 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-3 w-[70%] mb-2.5 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-3 w-[85%] mb-2.5 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }


  const ctx = { project, job, jobRunning, refresh, watchJob, pollUntil, setResearchContinue };
  const currentSection = location.pathname.split('/').filter(Boolean).pop() ?? '';
  const navIndex = NAV.findIndex((n) => n.to === currentSection);
  // ProcessingPage has its own full progress display (timer, stepper, live step text) and its
  // own error handling — showing this generic bar there too just duplicated it (two "timers"
  // stacked on the same page). Every other page still gets it as their only progress feedback
  // when a job is running.
  const showGenericJobbar = currentSection !== 'processing';
  const showJobProgressBar = showGenericJobbar;

  // Any of the three jobs (research/strategy/aplus) takes the user to the full-page Processing
  // view once when it starts — including strategy/aplus jobs a user starts by hand from their
  // own page (e.g. AplusPage's "Generate 3 concepts") — and also on a fresh page load that lands
  // mid-job on whatever section the URL happened to point at (e.g. the campaigns list link's
  // default "images" tab), so the user always has at least one obvious way to reach the live
  // progress view. awaiting_selection is excluded since that's a real user action (choosing
  // competitors on the Research page), not autopilot.
  //
  // Past that first redirect, the job keeps running in the background (this layout, and every
  // page's own JOBBAR below, still shows live progress) but the user is free to switch to any
  // other tab to check already-generated data without being bounced back on every poll tick —
  // autoRedirectedJobIds tracks which job ids we've already sent them to Processing for, so this
  // only fires once per job (once more for each auto-chained follow-on job, since that's a new
  // job id and genuinely worth a heads-up, but never on every render of the same job).
  //
  // ProcessingPage needs to know which page to return the user to once the job is done (A+ if
  // they started an aplus job from AplusPage, images by default otherwise) — router navigation
  // state doesn't survive a hard reload, so this is stashed in localStorage the same way
  // ProcessingPage already persists its own ETA clock across remounts.
  const pipelineActive = jobRunning && ['research', 'strategy', 'aplus'].includes(job?.kind);
  const alreadyRedirectedForJob = job && autoRedirectedJobIds.current.has(job.id);
  if (pipelineActive && currentSection !== 'processing' && !alreadyRedirectedForJob) {
    try {
      window.localStorage.setItem(`listingStudio:pipelineFrom:${project.id}`, currentSection);
    } catch {
      // ignore — ProcessingPage just falls back to the default redirect target
    }
    if (job) autoRedirectedJobIds.current.add(job.id);
    return <Navigate to="processing" replace />;
  }

  return (
    <div className="flex flex-col min-h-0">
      <TopNav project={project} onProjectUpdate={setProject} />
      <main className="flex-1 min-w-0 p-6">
        {showJobProgressBar && jobRunning && job && (
          <div className={JOBBAR}>
            <div className={JOBBAR_TRACK}>
              <div className={JOBBAR_FILL} style={{ width: `${job.progress}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Loader2 className="animate-spin flex-shrink-0" size={14} /> {job.step} ({job.progress}%)
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400 flex-shrink-0">
                  <Clock size={12} /> {formatClock(secondsLeft)} left
                </span>
              </span>
              {/* No nav tab points at /processing — since leaving it no longer force-redirects
               *  the user back (see pipelineActive above), this is the only way back to the
               *  live progress view once they've navigated elsewhere. Plain "processing", not
               *  "../processing": this Link is rendered by ProjectLayout itself, which is
               *  already the element for the p/:id route — that route is one level in the
               *  route tree (even though its path spans two URL segments), so a ".." here
               *  overshoots past p/:id entirely, landing on /listing-studio/processing (no
               *  project id) instead of this project's own processing page. That produced a
               *  route that matches nothing — ListingStudioShell's brand bar still renders,
               *  but its <Outlet/> has no matching child route, so the whole page under it was
               *  blank. The pipelineActive redirect just below (`<Navigate to="processing" .../>`)
               *  already gets this right by using a plain relative path. */}
              <Link to="processing" className="text-brand-600 hover:underline flex-shrink-0">
                View live progress →
              </Link>
            </div>
          </div>
        )}
        {showGenericJobbar && job?.status === 'error' && job.id !== dismissedJobId && (
          <div className={`${JOBBAR} ${JOBBAR_ERROR} flex items-start justify-between gap-3`}>
            <span>Job failed: {job.error}</span>
            <button
              type="button"
              onClick={dismissJobError}
              aria-label="Dismiss"
              className="flex-shrink-0 text-red-500 hover:text-red-700"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <Outlet context={ctx} />
        <SectionPager index={navIndex} researchContinue={researchContinue} />
      </main>
    </div>
  );
}
