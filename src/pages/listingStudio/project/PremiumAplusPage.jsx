/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Layers, Download, CheckCircle2, Clock, RefreshCw, X, Monitor, Smartphone, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { creditNotificationMessage, multiImageCreditNotificationMessage } from '../../../components/listingStudio/creditNotifications';
import { premiumAplusApi } from '../../../components/listingStudio/premiumAplusApi';
import { uploadImagesViaSignedUrl } from '../../../components/listingStudio/api';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { getErrorMessage } from '../../../components/listingStudio/errors';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import { GeneratedImageModal } from '../../../components/listingStudio/ui/GeneratedImageModal';
import { ImageLightbox } from '../../../components/listingStudio/ui/ImageLightbox';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import { AnglePicker } from '../../../components/listingStudio/AnglePicker';
import {
  PAGE_HEAD, PAGE_TITLE, CARD, CARD_TITLE, MUTED, BTN, BTN_SMALL, ICON_LABEL, JOBBAR, JOBBAR_SUCCESS,
  GEN_CARD, GEN_CARD_GENERATE,
} from '../../../components/listingStudio/ui/classNames';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 150; // ~6 minutes — same bound ProjectLayout's pollUntil defaults to
// An edit is one model call plus a Real-ESRGAN upscale and can run far longer than a fresh
// render, so it gets its own bound: just past the server's 15-minute abandoned-edit window
// (EDIT_STALE_MS in pipeline/premiumAplus.js), after which the design itself reports the failure.
const EDIT_POLL_MAX_ATTEMPTS = 400; // ~16.5 minutes

// Same pill-on-hover shape as the Images tab's GEN_CARD_EDIT, pinned top-right: these tiles have
// no Remove button contesting that corner (same choice AplusPage made for its overlay card).
const ASSET_EDIT_BTN =
  'absolute top-1 right-1 rounded-full bg-white shadow-md ring-1 ring-slate-200 text-slate-600 grid place-items-center opacity-90 group-hover:opacity-100 transition-opacity hover:text-brand-600 hover:ring-brand-200 disabled:opacity-50 disabled:cursor-not-allowed';

/** The `edits` map key the server writes a composite's edit state under (pipeline/premiumAplus.js's
 *  editKeyFor). Only the full banner image is editable from this page — the slices below it are
 *  cut from whatever the banner currently is, so editing the banner is what updates them all. */
const compositeEditKey = (side) => `${side}-composite`;

/** What this design is, in one line — the popup's AI edit suggestions are generated from it
 *  (GeneratedImageModal reads `image.prompt` for that, and rejects an empty one). A Premium A+
 *  asset has no per-asset brief of its own, so the design's own name/rationale is the context. */
const designContext = (d) => [d.name, d.rationale].filter(Boolean).join(' — ') || 'Premium A+ design';

/** The banner's Edit affordance. Shows a spinner while its edit is in flight, and is disabled
 *  while a regeneration of the same canvas would overwrite what the edit is about to write. */
function AssetEditButton({ busy, disabled, title, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled || busy}
      onClick={onClick}
      className={`${ASSET_EDIT_BTN} w-7 h-7`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />}
    </button>
  );
}

const VIEW_OPTIONS = [
  { key: 'desktop', label: 'Desktop', icon: Monitor },
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
];

/** Segmented Desktop/Mobile switch — a sliding white pill marks the active side. */
function ViewToggle({ value, onChange }) {
  const activeIndex = VIEW_OPTIONS.findIndex((o) => o.key === value);
  return (
    <div
      role="tablist"
      aria-label="Preview device"
      className="relative inline-grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200 shadow-inner"
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {VIEW_OPTIONS.map(({ key, label, icon: Icon }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            title={`${label} view`}
            onClick={() => onChange(key)}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
              active ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Premium A+ Content: for each selected marketing-angle combination, one 650x1027 "desktop"
 * composite plus a 608x1824 "mobile" companion, both generated from one shared concept, each
 * sliced into 4 bands for upload into Amazon's Premium A+ builder (pipeline/premiumAplus.js).
 * Besides viewing and downloading, each side's full banner image carries an Edit button, opening
 * the same GeneratedImageModal the Images tab and the A+ module editor use; the edit is billed as
 * one image and the slices below are re-cut from the edited banner (see editAsset below). The
 * slices themselves are not separately editable — they are cuts of the banner, so the banner is
 * the one place an edit belongs. Angles can be picked and new designs generated from this page's own picker
 * modal (the same AnglePicker Standard A+ uses, sharing one checked selection between both).
 */
export default function PremiumAplusPage() {
  const { project, creditRates } = useProjectCtx();
  const [designs, setDesigns] = useState(null);
  const [error, setError] = useState('');
  // Opens the shared AnglePicker in a modal right on this page — an angle may be picked for any
  // number of designs (only an exact-combination repeat is rejected server-side), so this is
  // always available.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Busy only while the start request is in flight, not while designs are generating — several
  // designs may generate at once, so another combination can be started right away.
  const [premiumStarting, setPremiumStarting] = useState(false);
  // { images: [{ src, alt }], initialIndex } | null — a single-item array for the composite
  // view, all 6 of that side's slices (in order) for a slice click, so arrowing through the
  // gallery in ImageLightbox never needs to leave this page.
  const [lightbox, setLightbox] = useState(null);
  // `${designId}:${side}` currently being retried, or null — disables that one tile's Regenerate
  // button while its own request/poll is in flight, without affecting any other tile.
  const [regeneratingKey, setRegeneratingKey] = useState(null);
  // Set right after a design finishes generating successfully — the page's visible
  // confirmation that something was generated besides the design showing up in the
  // gallery below. Cleared on dismiss or the next generation.
  // One banner per finished design — a list, not a single slot, since several designs may
  // generate at once and starting a new one shouldn't wipe an earlier one's banner.
  const [justGenerated, setJustGenerated] = useState([]); // [{ id, name, angleNames }]
  const dismissJustGenerated = (id) => setJustGenerated((prev) => prev.filter((g) => g.id !== id));
  // Tracks which `${designId}:${side}` combos already have a poll running, so the
  // resume-on-mount effect below never starts a second parallel poll for the same side.
  const resumedRef = useRef(new Set());
  // Which canvas each design card shows, keyed by design id — Desktop unless toggled.
  const [viewSides, setViewSides] = useState({});
  // The banner whose Edit popup is open: { designId, side, path, label, context, … } | null.
  // A design has one banner per canvas, so this identifies a side of a design, not just a design.
  const [editingAsset, setEditingAsset] = useState(null);

  const loadDesigns = useCallback(async () => {
    try {
      const list = await premiumAplusApi.listDesigns(project.id);
      setDesigns(list);
      return list;
    } catch (e) {
      setError(getErrorMessage(e));
      return null;
    }
  }, [project.id]);

  useEffect(() => {
    void loadDesigns();
  }, [loadDesigns]);

  // Premium A+ designs aren't embedded in `project` (separate collection, fetched via
  // premiumAplusApi). This polls the design/side directly on a 2500ms cadence.
  const waitForSideResult = useCallback(async (designId, side) => {
    const key = `${designId}:${side}`;
    try {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const d = await premiumAplusApi.getDesign(project.id, designId);
        if (!d) return; // design deleted mid-poll
        setDesigns((prev) => prev?.map((x) => (x.id === designId ? d : x)) ?? prev);
        if (d[`${side}Generating`]) continue;
        if (d[`${side}Error`]) throw new Error(d[`${side}Error`]);
        return d;
      }
      throw new Error('Still generating — this is taking longer than usual. Check back shortly.');
    } finally {
      resumedRef.current.delete(key);
    }
  }, [project.id]);

  // An edit is queued server-side and tracked under the design's `edits` map, so this polls that
  // one entry (not the canvas's `[side]Generating`, which an edit deliberately never touches:
  // that flag clears the images on screen, while an edit leaves them up until the replacement
  // lands). Resolves with the settled entry so the caller can read its `billing`.
  const waitForEditResult = useCallback(async (designId, editKey) => {
    const resumeKey = `${designId}:edit:${editKey}`;
    try {
      for (let attempt = 0; attempt < EDIT_POLL_MAX_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const d = await premiumAplusApi.getDesign(project.id, designId);
        if (!d) return null; // design deleted mid-poll
        setDesigns((prev) => prev?.map((x) => (x.id === designId ? d : x)) ?? prev);
        const state = d.edits?.[editKey];
        if (state?.editing) continue;
        if (state?.error) throw new Error(state.error);
        return state ?? null;
      }
      throw new Error('Still editing — this is taking longer than usual. Check back shortly.');
    } finally {
      resumedRef.current.delete(resumeKey);
    }
  }, [project.id]);

  // Resume polling for any design left mid-generation, mid-retry or mid-edit across a page reload.
  useEffect(() => {
    (designs || []).forEach((d) => {
      ['desktop', 'mobile'].forEach((side) => {
        const key = `${d.id}:${side}`;
        if (d[`${side}Generating`] && !resumedRef.current.has(key)) {
          resumedRef.current.add(key);
          waitForSideResult(d.id, side).catch(() => {});
        }
      });
      Object.entries(d.edits || {}).forEach(([editKey, state]) => {
        const key = `${d.id}:edit:${editKey}`;
        if (state?.editing && !resumedRef.current.has(key)) {
          resumedRef.current.add(key);
          waitForEditResult(d.id, editKey).catch(() => {});
        }
      });
    });
  }, [designs, waitForSideResult, waitForEditResult]);

  /** From the Edit popup on a side's banner image: queues the edit, then resolves once that
   *  banner's edit entry settles — GeneratedImageModal awaits this for its progress bar, closes
   *  itself on resolve, and turns the returned `billing` into the "credits deducted" toast (one
   *  image per edit, billed exactly like an Images-tab or A+ slot edit). The server re-cuts this
   *  side's slices from the edited banner, so the strip below updates with it. Must reject on
   *  failure so the modal surfaces the error instead of closing as if the edit had landed. */
  const editAsset = async (asset, prompt, referenceImageIds, referenceFile) => {
    const { designId, side } = asset;
    const editKey = compositeEditKey(side);
    const [referencePhotoKey] = referenceFile ? await uploadImagesViaSignedUrl([referenceFile], { transient: true }) : [];
    await premiumAplusApi.editAsset(project.id, designId, side, { prompt, referenceImageIds, referencePhotoKey });
    // Reflect the server's claim right away so the banner shows as editing without waiting for
    // the first poll 2.5s from now.
    resumedRef.current.add(`${designId}:edit:${editKey}`);
    setDesigns((prev) =>
      prev?.map((x) =>
        x.id === designId
          ? { ...x, edits: { ...(x.edits || {}), [editKey]: { ...(x.edits?.[editKey] || {}), editing: true, error: null } } }
          : x,
      ) ?? prev,
    );
    const done = await waitForEditResult(designId, editKey);
    return { billing: done?.billing ?? null };
  };

  const regenerateSide = async (designId, side) => {
    const key = `${designId}:${side}`;
    if (regeneratingKey === key) return;
    setRegeneratingKey(key);
    resumedRef.current.add(key);
    try {
      await premiumAplusApi.regenerateSide(project.id, designId, side);
      setDesigns((prev) =>
        prev?.map((x) => (x.id === designId ? { ...x, [`${side}Generating`]: true, [`${side}Error`]: null } : x)) ?? prev,
      );
      const done = await waitForSideResult(designId, side);
      toast.success(
        creditNotificationMessage(done?.[`${side}Billing`], `Premium A+ ${side} image`) ||
          `Premium A+ ${side} image regenerated.`,
      );
    } catch (e) {
      setError(getErrorMessage(e));
      toast.error(getErrorMessage(e));
    } finally {
      setRegeneratingKey(null);
    }
  };

  const strategy = project.aplus?.strategy?.angles ? project.aplus.strategy : undefined;

  /** Starts a new Premium A+ design straight from this page's own picker modal.
   *  Closes the modal immediately, reloads designs so the generating tiles show up right away,
   *  and monitors both canvas sides until completion to display the success banner. */
  const generatePremiumDesign = async (selectedAngleNames) => {
    setPickerOpen(false);
    try {
      setPremiumStarting(true);
      let created;
      try {
        created = await premiumAplusApi.startPremiumAplus(project.id, selectedAngleNames);
      } finally {
        setPremiumStarting(false);
      }
      await loadDesigns();
      if (created?.id) {
        await Promise.all([
          waitForSideResult(created.id, 'desktop').catch(() => {}),
          waitForSideResult(created.id, 'mobile').catch(() => {}),
        ]);
        const latest = await premiumAplusApi.getDesign(project.id, created.id);
        if (latest && (latest.compositePath || latest.mobileCompositePath)) {
          setJustGenerated((prev) => [
            ...prev.filter((g) => g.id !== created.id),
            { id: created.id, name: latest.name, angleNames: latest.sourceAngleNames ?? [] },
          ]);
          toast.success(
            multiImageCreditNotificationMessage([latest.desktopBilling, latest.mobileBilling], 'Premium A+ image generation') ||
              `Premium A+ images generated${latest.name ? ` — ${latest.name}` : ''}.`,
          );
        } else {
          toast.error('Premium A+ image generation failed. Please try again.');
        }
      }
    } catch (e) {
      setError(getErrorMessage(e));
      toast.error(getErrorMessage(e));
    }
  };

  const downloadDesktopZip = async (designId) => {
    try {
      await premiumAplusApi.downloadDesignZip(project.id, designId);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const downloadMobileZip = async (designId) => {
    try {
      await premiumAplusApi.downloadMobileZip(project.id, designId);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const downloadBothZip = async (designId) => {
    try {
      await premiumAplusApi.downloadCombinedZip(project.id, designId);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const renderSideTile = (d, side, compositePath, slicePaths) => {
    const generating = d[`${side}Generating`];
    const err = d[`${side}Error`];
    const busy = regeneratingKey === `${d.id}:${side}`;
    const sideLabel = side === 'desktop' ? 'Desktop (1536×2464)' : 'Mobile (608×1824)';
    // An edit and a regeneration both rewrite this canvas's banner AND every slice cut from it,
    // so each locks the other out for the duration rather than letting one silently overwrite
    // the other's result.
    const compositeEdit = d.edits?.[compositeEditKey(side)];
    const editing = Boolean(compositeEdit?.editing);
    const editError = compositeEdit?.error;
    return (
      <div className="px-3 sm:px-12 lg:px-24">
        <div className="flex items-center justify-between mb-1">
          <p className={`${MUTED} text-xs`}>{sideLabel}</p>
          {(compositePath || err) && (
            <button
              type="button"
              className={`${BTN} ${BTN_SMALL}`}
              disabled={busy || generating || editing}
              title={editing ? 'An edit is in progress on this canvas' : undefined}
              onClick={() => regenerateSide(d.id, side)}
            >
              <span className={ICON_LABEL}>
                <RefreshCw size={12} className={busy || generating ? 'animate-spin' : ''} /> Regenerate
              </span>
            </button>
          )}
        </div>
        {compositePath && (
          <div className="relative group mb-1.5">
            <button
              type="button"
              title={`View ${side} design`}
              onClick={() => setLightbox({ images: [{ src: compositePath, alt: `${d.name} (${side})` }], initialIndex: 0 })}
              className="block w-full rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-brand-300"
            >
              <img src={compositePath} alt={d.name} className="w-full object-contain block" />
            </button>
            <AssetEditButton
              busy={editing}
              disabled={busy || generating}
              title={`Edit the full ${side} image`}
              onClick={() =>
                setEditingAsset({
                  designId: d.id,
                  side,
                  target: 'composite',
                  path: compositePath,
                  label: `Premium A+ ${side}`,
                  context: designContext(d),
                })
              }
            />
          </div>
        )}
        {!compositePath && generating && (
          <div className={`${GEN_CARD} grid place-items-center text-slate-400 text-sm p-6 mb-1.5`}>
            <span className={ICON_LABEL}>
              <Clock size={12} /> Generating {side}…
            </span>
          </div>
        )}
        {!compositePath && !generating && err && (
          <div className={`${GEN_CARD} grid place-items-center p-3 text-center text-red-600 text-xs mb-1.5`}>{err}</div>
        )}
        {slicePaths?.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {/* View-only: a slice is a cut of the banner above, so it has no Edit button of its
                own — editing the banner re-cuts all of them. */}
            {slicePaths.map((path, i) => (
              <button
                key={path}
                type="button"
                title={`View ${side} slot ${i + 1}`}
                onClick={() =>
                  setLightbox({
                    images: slicePaths.map((p, idx) => ({ src: p, alt: `${side} slot ${idx + 1}` })),
                    initialIndex: i,
                  })
                }
                className="block rounded-md overflow-hidden border border-slate-200 hover:ring-2 hover:ring-brand-300"
              >
                <img src={path} alt={`${side} slot ${i + 1}`} className="w-full object-contain block" />
              </button>
            ))}
          </div>
        )}
        {/* An edit that failed after the popup was closed (or after a reload) has nowhere else to
            report it — the toast is long gone by then. */}
        {editError && <p className="text-red-600 text-xs mt-1.5">{editError}</p>}
      </div>
    );
  };

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-fuchsia-100 text-fuchsia-600 grid place-items-center flex-shrink-0">
            <Layers size={16} />
          </span>
          <h1 className={PAGE_TITLE}>Premium A+ Content</h1>
        </div>
      </div>

      {justGenerated.map((g) => (
        <div key={g.id} className={`${JOBBAR} ${JOBBAR_SUCCESS} flex items-start justify-between gap-3`}>
          <span className="inline-flex items-start gap-2">
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>{g.name}</strong> is ready
              {g.angleNames.length > 0 && ` — covering ${g.angleNames.join(', ')}`}.
            </span>
          </span>
          <button
            type="button"
            onClick={() => dismissJustGenerated(g.id)}
            aria-label="Dismiss"
            className="flex-shrink-0 text-emerald-600 hover:text-emerald-800"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {error && <p className="text-red-600 mb-3">{error}</p>}

      {!strategy && (
        <EmptyStateCard
          tone="violet"
          icon={Sparkles}
          title="No marketing angles yet"
          description="Generate a creative strategy first — Premium A+ designs are built from your marketing angles, the same way A+ Content is."
          action={
            <Link className={BTN} to="../strategy">
              Go to Creative Strategy
            </Link>
          }
        />
      )}

      {strategy && designs?.length === 0 && (
        <div className="max-w-xs mx-auto">
          <button type="button" onClick={() => setPickerOpen(true)} className={`${GEN_CARD_GENERATE} w-full`}>
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white grid place-items-center shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Sparkles size={24} />
            </span>
            <span className="font-semibold text-slate-900">Generate new design</span>
            <span className="text-sm text-slate-400">Pick angles — AI builds the hero design</span>
          </button>
        </div>
      )}

      {designs === null && !error && <p className={MUTED}>Loading…</p>}

      {designs?.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className={CARD_TITLE}>Generated designs</h2>
          </div>
          {strategy && (
            <div className="max-w-xs mx-auto mb-4">
              <button type="button" onClick={() => setPickerOpen(true)} className={`${GEN_CARD_GENERATE} w-full`}>
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white grid place-items-center shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
                  <Sparkles size={24} />
                </span>
                <span className="font-semibold text-slate-900">Generate new design</span>
                <span className="text-sm text-slate-400">Pick angles — AI builds the hero design</span>
              </button>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {designs.map((d) => {
              const viewSide = viewSides[d.id] ?? 'desktop';
              const hasSideSlices = viewSide === 'desktop' ? d.slicePaths?.length > 0 : d.mobileSlicePaths?.length > 0;
              return (
                <div key={d.id} className={CARD}>
                  <div className="min-w-0 mb-3">
                    <strong className="text-slate-900">{d.name}</strong>
                    <p className={`${MUTED} text-sm`}>{d.rationale}</p>
                    {d.sourceAngleNames?.length > 0 && (
                      <p className="text-xs text-violet-600 mt-1">Angles: {d.sourceAngleNames.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {hasSideSlices && (
                        <button
                          type="button"
                          className={BTN}
                          onClick={() => (viewSide === 'desktop' ? downloadDesktopZip(d.id) : downloadMobileZip(d.id))}
                        >
                          <span className={ICON_LABEL}>
                            <Download size={14} /> Download {viewSide}
                          </span>
                        </button>
                      )}
                      {d.slicePaths?.length > 0 && d.mobileSlicePaths?.length > 0 && (
                        <button type="button" className={BTN} onClick={() => downloadBothZip(d.id)}>
                          <span className={ICON_LABEL}>
                            <Download size={14} /> Download both
                          </span>
                        </button>
                      )}
                    </div>
                    <div className="ml-auto">
                      <ViewToggle value={viewSide} onChange={(side) => setViewSides((prev) => ({ ...prev, [d.id]: side }))} />
                    </div>
                  </div>
                  <div>
                    {viewSide === 'desktop'
                      ? renderSideTile(d, 'desktop', d.compositePath, d.slicePaths)
                      : renderSideTile(d, 'mobile', d.mobileCompositePath, d.mobileSlicePaths)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {lightbox && (
        <ImageLightbox images={lightbox.images} initialIndex={lightbox.initialIndex} onClose={() => setLightbox(null)} />
      )}

      {editingAsset && (
        <GeneratedImageModal
          projectId={project.id}
          image={{
            // Per-banner id: it keys the modal's own "an edit is in flight" marker, so closing and
            // reopening the popup on the same banner picks that edit back up instead of looking idle.
            id: `${editingAsset.designId}:${compositeEditKey(editingAsset.side)}`,
            path: editingAsset.path,
            prompt: editingAsset.context,
            type: editingAsset.label,
          }}
          libraryEntries={project.imageLibrary?.entries ?? []}
          imageCost={creditRates?.imageCost ?? null}
          freeImagesRemaining={creditRates?.freeImagesRemaining ?? 0}
          onClose={() => setEditingAsset(null)}
          onRegenerate={(prompt, referenceImageIds, referenceFile) =>
            editAsset(editingAsset, prompt, referenceImageIds, referenceFile)
          }
          onRegenerated={async () => setEditingAsset(null)}
        />
      )}

      {pickerOpen && strategy && (
        <Modal onClose={() => setPickerOpen(false)} size="lg">
          <AnglePicker
            angles={strategy.angles}
            heading="Premium A+ designs"
            description="One continuous hero design combining all the angles you check below, generated as a single image and sliced for Amazon's Seamless A+ builder. Pick any combination — an angle can be reused in a different combination later, you just can't regenerate the exact same set twice."
            actions={[
              {
                key: 'premium',
                label: (n) => `Generate 1 Premium A+ design covering ${n} angle${n === 1 ? '' : 's'}`,
                onGenerate: generatePremiumDesign,
                busy: premiumStarting,
                // Premium A+ charges 2 separate images (desktop + mobile) — free-image allowance
                // is spent per image, so this can be fully free, fully paid, or split across both.
                costNote: {
                  type: 'pill',
                  imageCost: creditRates?.imageCost ?? null,
                  freeRemaining: creditRates?.freeImagesRemaining ?? 0,
                  count: 2,
                },
              },
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
