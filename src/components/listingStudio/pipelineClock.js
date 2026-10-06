import { useEffect, useRef, useState } from 'react';

// Soft ETA for the research/strategy/aplus background pipeline, not a hard deadline — real
// completion is always driven by the job record, never by this clock. See ProcessingPage for why
// the bar/percentage are tied to elapsed time rather than job.progress (which resets and jumps
// around as each of the three real jobs runs its own 0-100 internally).
export const ETA_SECONDS = 10 * 60;

// Once a run has genuinely blown past its ETA, counting a fresh 10:00 back down again reads as
// "it's starting over" and is discouraging for something that's actually still making progress —
const GRACE_SECONDS = 3 * 60;

// A+ per-slot overlay image generation (AplusPage) is a single quick model call, not a multi-step
// pipeline — a 10-minute ETA would read as wildly wrong for something that finishes in seconds, so
// it gets its own much shorter ETA/overtime cycle. 120s/30s, not 60s/15s — OpenAI's own docs say
// gpt-image generation/edit can take up to 2 minutes for a complex prompt (no ETA or progress is
// ever returned in the response itself), and this same call now also runs image edits via
// GeneratedImageModal, whose own progress bar uses the identical 120s/30s shape for the same
// reason — kept in sync rather than showing two different ETAs for the one underlying call.
const SLOT_ETA_SECONDS = 120;
const SLOT_GRACE_SECONDS = 30;

export function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function clockKey(projectId) {
  return `listingStudio:pipelineStart:${projectId}`;
}

function slotClockKey(projectId) {
  return `listingStudio:slotClockStart:${projectId}`;
}

function useClock({ ticking, ready = true, etaSeconds, graceSeconds, persistKey }) {
  const [clock, setClock] = useState(() => {
    if (!persistKey) return null;
    try {
      const raw = window.localStorage.getItem(persistKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed.startedAt === 'number') return parsed;
    } catch {
      // ignore — falls through to no stored clock yet; the effect below sets one once ticking starts
    }
    return null;
  });
  // Tracks ticking as of the last *ready* render, not the component's literal first render — for a
  // caller like ProjectLayout, `ticking` depends on a job record fetched asynchronously, so it's
  // always false for a render or two after mount purely because that fetch hasn't resolved yet, not
  // because nothing is running. Baselining off that transient false made every remount (leaving a
  // campaign and reopening it, or just reloading the page) look identical to "a fresh run just
  // started" once the real job data arrived a beat later, resetting the countdown to a full 10:00
  // in the middle of an already-running job. `ready` lets a caller hold off judging "did ticking
  // just turn on" until it actually knows the answer.
  const initialized = useRef(false);
  const wasTicking = useRef(false);

  useEffect(() => {
    if (!ready) return;
    const startingFresh = ticking && initialized.current && !wasTicking.current;
    initialized.current = true;
    wasTicking.current = ticking;
    if (!ticking) return;
    const sameRun = clock && !startingFresh;
    if (sameRun) return;
    const next = { startedAt: Date.now() };
    setClock(next);
    if (persistKey) {
      try {
        window.localStorage.setItem(persistKey, JSON.stringify(next));
      } catch {
        // ignore — the clock still works for this render, just won't survive a remount
      }
    }
  }, [ticking, ready, clock, persistKey]);

  const clockStart = clock?.startedAt ?? Date.now();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!ticking) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ticking]);

  const elapsedSeconds = Math.floor((now - clockStart) / 1000);
  const overtimeSeconds = Math.max(0, elapsedSeconds - etaSeconds);
  const secondsLeft = !ticking
    ? 0
    : overtimeSeconds === 0
      ? etaSeconds - elapsedSeconds
      : graceSeconds - (overtimeSeconds % graceSeconds);
  // Mirrors secondsLeft's sawtooth once past the ETA — a run that's still going after 10:00 keeps
  // cycling through 3-minute laps (0% -> 100% -> 0% ...) for as long as the job runs, rather than
  // freezing the bar at 100% while the "time left" text keeps counting down underneath it.
  const elapsedPct = !ticking
    ? 100
    : overtimeSeconds === 0
      ? Math.round((elapsedSeconds / etaSeconds) * 100)
      : Math.round(((graceSeconds - secondsLeft) / graceSeconds) * 100);
  return { elapsedSeconds, secondsLeft, elapsedPct };
}

// Anchors the pipeline's elapsed/ETA clock to a real wall-clock start time persisted in
// localStorage, keyed by project (not by which page renders it) so ProjectLayout's outer jobbar
// and ProcessingPage's full live-progress view read the exact same clock instead of two
// independently running timers that could drift apart.
//
// No resetKey: research.js *always* auto-chains straight into a brand-new 'strategy' job right
// before marking itself done (enqueueJob(fresh, 'strategy') then job.status = 'done') — so the
// job id/kind polled here changes mid-flight on every single run, not just on genuinely separate
// runs. Keying the reset off job id used to restart the countdown back to 10:00 right at that
// handoff (typically ~when research finishes) even though it's the same campaign build to the
// user. useClock's own `startingFresh` check (ticking flips false -> true) already covers the
// cases that actually need a fresh clock — a genuinely new run started after the previous one
// finished and got cleared — without keying off which job happens to be polled at the moment.
export function usePipelineClock(projectId, { ticking, ready }) {
  return useClock({ ticking, ready, etaSeconds: ETA_SECONDS, graceSeconds: GRACE_SECONDS, persistKey: clockKey(projectId) });
}

export function clearPipelineClock(projectId) {
  try {
    window.localStorage.removeItem(clockKey(projectId));
  } catch {
    // ignore
  }
}

export function useSlotGenerationClock(active, projectId) {
  return useClock({
    ticking: active,
    etaSeconds: SLOT_ETA_SECONDS,
    graceSeconds: SLOT_GRACE_SECONDS,
    persistKey: projectId ? slotClockKey(projectId) : null,
  });
}

export function clearSlotGenerationClock(projectId) {
  try {
    window.localStorage.removeItem(slotClockKey(projectId));
  } catch {
    // ignore
  }
}
