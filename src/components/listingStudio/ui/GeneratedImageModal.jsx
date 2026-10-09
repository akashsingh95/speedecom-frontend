import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { CreditCostPill } from './CreditCostPill';
import { listingStudioApi, uploadImagesViaSignedUrl } from '../api';
import { creditNotificationMessage } from '../creditNotifications';
import { formatClock } from '../pipelineClock';
import { MUTED, BTN, BTN_PRIMARY, BADGE, BADGE_GOOD, ERROR_TEXT, FIELD_LABEL, FIELD_INPUT, CANDIDATE_BADGE } from './classNames';

// Same shape as pipelineClock.js's useSlotGenerationClock (built for exactly this — "a single
// quick model call" like A+'s per-slot overlay generation, per that file's own comment) — but NOT
// that hook itself: it persists its clock in localStorage under a key shared by every consumer on
// the same project, which is right for a page-level "is anything generating" indicator that must
// survive a remount, but wrong here — this modal is short-lived and scoped to one edit, and
// sharing that key would fight with AplusPage's own overlayBusyIds-driven clock.
// ETA is 120s, not useSlotGenerationClock's 60s — OpenAI's own docs say gpt-image generation/edit
// can take up to 2 minutes for a complex prompt (no ETA or progress is ever returned in the
// response itself, confirmed against their current API reference), and an edit of an existing
// image is exactly the complex case. 60s made the bar spend most of a real edit already past 100% and
// cycling grace periods, reading as "running long" for the common case rather than the exception.
const EDIT_ETA_SECONDS = 120;
const EDIT_GRACE_SECONDS = 30;

// Persists which image has an edit in flight, and since when, so a modal reopened on the same
// image (after being closed mid-edit — see the note by "You can close this" below) can detect
// and resume showing real progress instead of quietly starting blank, as if nothing were
// happening. Same localStorage-backed approach as pipelineClock.js, just keyed per-image instead
// of per-project — this genuinely needs cross-remount persistence (unlike the elapsed-time math
// itself, which has no reason to survive anything beyond a single mounted instance).
const editInFlightKey = (imageId) => `listingStudio:imageEditInFlight:${imageId}`;

function readEditStartedAt(imageId) {
  try {
    const raw = window.localStorage.getItem(editInFlightKey(imageId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.startedAt === 'number' ? parsed.startedAt : null;
  } catch {
    return null;
  }
}
function markEditInFlight(imageId, startedAt) {
  try {
    window.localStorage.setItem(editInFlightKey(imageId), JSON.stringify({ startedAt }));
  } catch {
    // ignore — worst case a reopened modal just won't be able to resume the progress bar
  }
}
function clearEditInFlight(imageId) {
  try {
    window.localStorage.removeItem(editInFlightKey(imageId));
  } catch {
    // ignore
  }
}

const EDIT_POLL_INTERVAL_MS = 2000;

/** Polls a queued Images-tab edit (server: pipeline/images.js queueImageEdit) until it finishes.
 *  Resolves with the replacement image; rejects with the server's error message on failure.
 *  `isCancelled` lets a caller stop polling early (e.g. a resumed modal that was closed).
 *  Gives up after the server's own stale-edit window (15 min) plus a margin. */
async function waitForImageEdit(projectId, imageId, isCancelled = () => false) {
  const maxAttempts = Math.ceil((20 * 60 * 1000) / EDIT_POLL_INTERVAL_MS);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, EDIT_POLL_INTERVAL_MS));
    if (isCancelled()) return null;
    const result = await listingStudioApi.getImageEditStatus(projectId, imageId);
    if (result.status === 'done') return result.image;
    if (result.status === 'error') throw new Error(result.error || 'Image edit failed.');
    if (result.status === 'idle') return null; // nothing in flight for this image
  }
  throw new Error('The edit is taking too long — check back in a few minutes.');
}

/** Elapsed-time-based progress for an edit in flight — `pct` for the bar, `secondsLeft` for the
 *  countdown text next to it. Not tied to any real server-reported progress (there isn't any for
 *  a single model call); once past the ETA it holds near 100% and the countdown starts ticking
 *  back down each grace-period cycle instead, same "still going, not stuck" shape as the ETA
 *  clocks used elsewhere in Listing Studio. `startedAt` is owned by the caller (not computed
 *  here) specifically so a resumed edit can seed it from the persisted value above instead of
 *  restarting the clock at 0 on every reopen. */
function useEditProgress(active, startedAt) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);

  if (!active || !startedAt) return { pct: 0, secondsLeft: EDIT_ETA_SECONDS };
  const elapsedSeconds = (now - startedAt) / 1000;
  const overtimeSeconds = Math.max(0, elapsedSeconds - EDIT_ETA_SECONDS);
  const secondsLeft =
    overtimeSeconds === 0
      ? Math.ceil(EDIT_ETA_SECONDS - elapsedSeconds)
      : Math.ceil(EDIT_GRACE_SECONDS - (overtimeSeconds % EDIT_GRACE_SECONDS));
  const pct = Math.min(100, (elapsedSeconds / EDIT_ETA_SECONDS) * 100);
  return { pct, secondsLeft };
}

/**
 * Shared "click a generated image" popup for ImagesPage, ListingPage, and the A+ module editor's
 * "Edit" action, so an image's prompt/references/AI-assist behave identically everywhere it's
 * edited. One combined view — the image itself, its prompt (editable), which reference photos it
 * used (editable), and a single Regenerate action.
 *
 * By default Edit calls the Images-tab regenerate endpoint directly (which also persists the
 * prompt/references as it goes — there's no standalone "save" for that flow, since nothing else
 * ever reads a generatedImages entry's prompt again once it exists). Pass `onRegenerate` to
 * override this for a host with its own persistence step (the A+ editor's slot is a fixed
 * position patched via PATCH, not a swappable gallery entry) — it receives
 * (prompt, referenceImageIds, referenceFile) and should throw on failure so the error surfaces
 * here rather than being silently swallowed. Both paths edit the existing image from the typed
 * instruction (server: llm/images.js editImage).
 */
// Mirrors the server-side cap in llm/images.js editImage (3 references + the edited image = 4 sent).
const MAX_EDIT_REFERENCES = 3;

export function GeneratedImageModal({
  projectId,
  image,
  libraryEntries,
  onClose,
  onRegenerated,
  onRegenerate,
  imageCost = null,
  freeImagesRemaining = 0,
}) {
  // Starts empty — this is now the actual edit instruction sent to the API (see regenerate()
  // below), not the original generation concept, so prefilling it with image.prompt would just
  // be old scene-description text sitting in front of a "describe your edit" field.
  const [prompt, setPrompt] = useState('');
  // Starts unticked — an edit sends only the references the seller deliberately ticks (server:
  // editImage), since every extra photo pulls the result away from the image being edited.
  const [selectedIds, setSelectedIds] = useState([]);
  // If this same image already has an edit in flight (started by a previous instance of this
  // modal, before it was closed — see the Close button below), pick that up on mount instead of
  // rendering as if nothing were happening: `busy` starts true and `editStartedAt` seeds from the
  // real start time, not the moment this instance happened to mount. On the Images-tab path the
  // server's own `editing` flag counts too, so an edit survives a page reload.
  const [editStartedAt, setEditStartedAt] = useState(() => {
    const serverStartedAt = !onRegenerate && image.editing ? Date.parse(image.editStartedAt) || Date.now() : null;
    return serverStartedAt ?? readEditStartedAt(image.id);
  });
  const [busy, setBusy] = useState(() => editStartedAt !== null);
  // True only for the "detected on mount" case above — this instance didn't itself call
  // regenerate() for the in-flight edit, so it has no promise of its own to await completion on;
  // the effect below polls the same in-flight marker instead, purely to know when to stop
  // showing progress and pull the result, without double-firing onRegenerated()/the toast for an
  // edit this instance never actually started.
  const resumedEditRef = useRef(editStartedAt !== null);
  // Hosts pass `onRegenerated` inline (a new function every render, and the progress bar
  // re-renders every 250ms), so the resume effects below read it through a ref — depending on it
  // directly would tear down and restart their polling before a single poll ever fired.
  const onRegeneratedRef = useRef(onRegenerated);
  onRegeneratedRef.current = onRegenerated;

  // Quick-pick edit ideas, fetched fresh every time the modal opens — cheap text-only call, so
  // no caching.
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoadingSuggestions(true);
    listingStudioApi
      .getImageEditSuggestions(projectId, image.prompt ?? '')
      .then((r) => {
        if (!cancelled) setSuggestions(r.suggestions || []);
      })
      .catch((e) => {
        if (!cancelled) setSuggestionsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, image.id]);

  const [referenceFile, setReferenceFile] = useState(null);
  const referenceFileRef = useRef(null);
  const { pct: editProgressPct, secondsLeft: editSecondsLeft } = useEditProgress(busy, editStartedAt);

  // Only for the resumed case (see resumedEditRef above). Images-tab edits are queued server-side,
  // so this polls the server's edit status directly — which also works after a page reload,
  // when no other instance is left to clear the localStorage marker.
  useEffect(() => {
    if (!resumedEditRef.current || !busy || onRegenerate) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const replacement = await waitForImageEdit(projectId, image.id, () => cancelled);
        if (cancelled) return;
        clearEditInFlight(image.id);
        setBusy(false);
        if (replacement) await onRegeneratedRef.current();
      } catch (e) {
        if (cancelled) return;
        clearEditInFlight(image.id);
        setBusy(false);
        toast.error(e instanceof Error ? e.message : 'Image edit failed.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [busy, image.id, onRegenerate, projectId]);

  // The A+ path's resumed case (see resumedEditRef above) — watches the in-flight marker this
  // instance didn't create, and treats it disappearing as "done" (the instance that actually ran
  // the edit clears it in its own regenerate()'s finally below, whether it succeeded or failed).
  useEffect(() => {
    if (!resumedEditRef.current || !busy || !onRegenerate) return undefined;
    const interval = setInterval(async () => {
      if (readEditStartedAt(image.id) !== null) return;
      clearInterval(interval);
      setBusy(false);
      try {
        await onRegeneratedRef.current();
      } catch {
        // The instance that actually ran the edit already surfaced any real failure via its own
        // toast when it cleared the marker — this is just catching up the currently-open modal.
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [busy, image.id, onRegenerate]);

  // The server sends at most MAX_EDIT_REFERENCES references (llm/images.js editImage) — the attached photo
  // counts toward it — so stop the seller ticking ones that would be dropped.
  const referenceCount = selectedIds.length + (referenceFile ? 1 : 0);
  const atReferenceCap = referenceCount >= MAX_EDIT_REFERENCES;
  const toggle = (id) =>
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return atReferenceCap ? ids : [...ids, id];
    });

  const regenerate = async () => {
    const startedAt = Date.now();
    setEditStartedAt(startedAt);
    markEditInFlight(image.id, startedAt);
    setBusy(true);
    try {
      // One success toast for the whole edit: the credit message when there is one (it already
      // says the edit completed), otherwise a plain "Image updated." — two toasts overlapped.
      let doneMessage = null;
      let doneToastId;
      if (onRegenerate) {
        const result = await onRegenerate(prompt, selectedIds, referenceFile);
        doneMessage = creditNotificationMessage(result?.billing, 'Image edit');
      } else {
        const [referencePhotoKey] = referenceFile ? await uploadImagesViaSignedUrl([referenceFile], { transient: true }) : [];
        // Fire once (the server queues the edit and replies 202), then poll until the edited
        // image exists — the edit + upscale can take minutes.
        await listingStudioApi.regenerateGeneratedImage(projectId, image.id, {
          prompt,
          referenceImageIds: selectedIds,
          referencePhotoKey,
        });
        const replacement = await waitForImageEdit(projectId, image.id);
        doneMessage = creditNotificationMessage(replacement?.billing, 'Image edit');
        // Same id notifyImageEditCharge uses, so a resumed modal showing this edit can't toast twice.
        if (replacement?.id) doneToastId = `image-edit-credit-${replacement.id}`;
      }
      // The user may well have already closed this modal by now — that's fine (see the Close
      // button and the note near it below): onRegenerated() still runs and still refreshes the
      // gallery on the parent page, and this toast is a global notification (sonner), not tied
      // to this modal being open, so it still surfaces the result either way. React 19 makes
      // setBusy below a harmless no-op if this component has already unmounted.
      toast.success(doneMessage || 'Image updated.', doneToastId ? { id: doneToastId } : undefined);
      await onRegenerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Image generation failed.');
    } finally {
      setBusy(false);
      clearEditInFlight(image.id);
    }
  };

  return (
    <Modal onClose={onClose}>
      {image.path && <img src={image.path} alt={image.type} className="w-full max-h-[32rem] object-contain rounded-lg mb-3 bg-slate-50" />}
      <div className="flex gap-1.5 mb-3">
        {image.type && <span className={BADGE}>{image.type}</span>}
        {image.quality && <span className={image.quality === 'final' ? BADGE_GOOD : BADGE}>{image.quality}</span>}
        {image.role && <span className={BADGE}>{image.role}</span>}
      </div>

      {loadingSuggestions && <p className={`${MUTED} text-xs mb-2 italic`}>Analyzing your image to suggest edits…</p>}
      {suggestionsError && <p className={`${ERROR_TEXT} mb-2 text-xs`}>Couldn't load edit suggestions: {suggestionsError}</p>}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`${BADGE} hover:border-brand-500 cursor-pointer`}
              onClick={() => setPrompt(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Sent to the image API as the edit instruction, alongside the image itself — no
       *  intermediate LLM rewrite into a full scene description, which made the model redraw
       *  the whole image instead of changing just what was asked. */}
      <label className={FIELD_LABEL}>
        <span>Describe your edit</span>
        <textarea
          rows={4}
          className={FIELD_INPUT}
          placeholder="e.g. make the background brighter"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>

      <span className={`${MUTED} text-xs block mb-1`}>Reference photos (optional — tick one only if your edit should match it; max {MAX_EDIT_REFERENCES}):</span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {libraryEntries.map((e) => {
          const isSelected = selectedIds.includes(e.id);
          const capped = atReferenceCap && !isSelected;
          return (
            <button
              key={e.id}
              type="button"
              disabled={capped}
              title={e.suitabilityNotes || e.sceneDescription}
              className={`relative shrink-0 rounded-md overflow-hidden border-2 ${isSelected ? 'border-brand-500' : 'border-slate-200'} ${capped ? 'opacity-40 cursor-not-allowed' : ''}`}
              onClick={() => toggle(e.id)}
            >
              <img src={e.sourcePath} alt="" className="w-14 h-14 object-cover block" />
              {isSelected && <span className={CANDIDATE_BADGE}>✓</span>}
            </button>
          );
        })}
        {libraryEntries.length === 0 && <p className={`${MUTED} text-xs`}>No analyzed photos in the library yet.</p>}
      </div>

      <div className={`${FIELD_LABEL} mt-2`}>
        <span>Attach a reference photo for this edit</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={BTN}
            disabled={atReferenceCap && !referenceFile}
            title={atReferenceCap && !referenceFile ? `Up to ${MAX_EDIT_REFERENCES} references — untick one first` : undefined}
            onClick={() => referenceFileRef.current?.click()}
          >
            {referenceFile ? 'Change photo' : '+ Attach photo'}
          </button>
          {referenceFile && (
            <>
              <span className={`${MUTED} text-xs truncate max-w-[10rem]`}>{referenceFile.name}</span>
              <button type="button" className={BTN} onClick={() => setReferenceFile(null)}>
                Remove
              </button>
            </>
          )}
          <input
            ref={referenceFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => setReferenceFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      {busy && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-linear"
              style={{ width: `${editProgressPct}%` }}
            />
          </div>
          <p className={`${MUTED} text-xs text-right mt-1.5`}>
            Editing… {formatClock(editSecondsLeft)} — you can close this, the image will update automatically.
          </p>
        </div>
      )}
      {!busy && (
        <div className="flex justify-end mt-2">
          <CreditCostPill imageCost={imageCost} freeRemaining={freeImagesRemaining} />
        </div>
      )}
      <div className="flex items-center justify-end gap-2 mt-1.5">
        <button type="button" className={BTN} onClick={onClose}>
          Close
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={busy || !prompt.trim()} onClick={() => void regenerate()}>
          {busy ? 'Editing…' : 'Apply edit'}
        </button>
      </div>
    </Modal>
  );
}
