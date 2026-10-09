/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Layers, Download, CheckCircle2, Clock, RefreshCw, X, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { creditNotificationMessage, multiImageCreditNotificationMessage } from '../../../components/listingStudio/creditNotifications';
import { premiumAplusApi } from '../../../components/listingStudio/premiumAplusApi';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { getErrorMessage } from '../../../components/listingStudio/errors';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import { ImageLightbox } from '../../../components/listingStudio/ui/ImageLightbox';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import { AnglePicker } from '../../../components/listingStudio/AnglePicker';
import {
  PAGE_HEAD, PAGE_TITLE, CARD, CARD_TITLE, MUTED, BTN, BTN_SMALL, ICON_LABEL, JOBBAR, JOBBAR_SUCCESS,
  GEN_CARD, GEN_CARD_GENERATE,
} from '../../../components/listingStudio/ui/classNames';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 150; // ~6 minutes — same bound ProjectLayout's pollUntil defaults to

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
 * This page is a pure viewing/downloading gallery — picking angles and triggering generation
 * both happen on the Strategy page (the same AnglePicker Standard A+ already uses, sharing one
 * checked selection between both features); this page only links there.
 */
export default function PremiumAplusPage() {
  const { project, creditRates } = useProjectCtx();
  const [designs, setDesigns] = useState(null);
  const [error, setError] = useState('');
  // Opens the shared AnglePicker in a modal right on this page — an angle may be picked for any
  // number of designs (only an exact-combination repeat is rejected server-side), so this is
  // always available.
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const [justGenerated, setJustGenerated] = useState(null); // { name, angleNames } | null
  // Tracks which `${designId}:${side}` combos already have a poll running, so the
  // resume-on-mount effect below never starts a second parallel poll for the same side.
  const resumedRef = useRef(new Set());
  // Which canvas each design card shows, keyed by design id — Desktop unless toggled.
  const [viewSides, setViewSides] = useState({});

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

  // Resume polling for any design left mid-generation or mid-retry across a page reload.
  useEffect(() => {
    (designs || []).forEach((d) => {
      ['desktop', 'mobile'].forEach((side) => {
        const key = `${d.id}:${side}`;
        if (d[`${side}Generating`] && !resumedRef.current.has(key)) {
          resumedRef.current.add(key);
          waitForSideResult(d.id, side).catch(() => {});
        }
      });
    });
  }, [designs, waitForSideResult]);

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
  const isGeneratingAny = (designs || []).some((d) => d.desktopGenerating || d.mobileGenerating);

  /** Starts a new Premium A+ design straight from this page's own picker modal.
   *  Closes the modal immediately, reloads designs so the generating tiles show up right away,
   *  and monitors both canvas sides until completion to display the success banner. */
  const generatePremiumDesign = async (selectedAngleNames) => {
    setJustGenerated(null);
    setPickerOpen(false);
    try {
      const created = await premiumAplusApi.startPremiumAplus(project.id, selectedAngleNames);
      await loadDesigns();
      if (created?.id) {
        await Promise.all([
          waitForSideResult(created.id, 'desktop').catch(() => {}),
          waitForSideResult(created.id, 'mobile').catch(() => {}),
        ]);
        const latest = await premiumAplusApi.getDesign(project.id, created.id);
        if (latest && (latest.compositePath || latest.mobileCompositePath)) {
          setJustGenerated({ name: latest.name, angleNames: latest.sourceAngleNames ?? [] });
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

  const renderSideTile = (d, side, compositePath, slicePaths, aspectClass) => {
    const generating = d[`${side}Generating`];
    const err = d[`${side}Error`];
    const busy = regeneratingKey === `${d.id}:${side}`;
    const sideLabel = side === 'desktop' ? 'Desktop (1536×2464)' : 'Mobile (608×1824)';
    return (
      <div className="px-3 sm:px-12 lg:px-24">
        <div className="flex items-center justify-between mb-1">
          <p className={`${MUTED} text-xs`}>{sideLabel}</p>
          {(compositePath || err) && (
            <button
              type="button"
              className={`${BTN} ${BTN_SMALL}`}
              disabled={busy || generating}
              onClick={() => regenerateSide(d.id, side)}
            >
              <span className={ICON_LABEL}>
                <RefreshCw size={12} className={busy || generating ? 'animate-spin' : ''} /> Regenerate
              </span>
            </button>
          )}
        </div>
        {compositePath && (
          <button
            type="button"
            title={`View ${side} design`}
            onClick={() => setLightbox({ images: [{ src: compositePath, alt: `${d.name} (${side})` }], initialIndex: 0 })}
            className="block w-full rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-brand-300 mb-1.5"
          >
            <img src={compositePath} alt={d.name} className={`w-full ${aspectClass} object-cover block`} />
          </button>
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
                <img src={path} alt={`${side} slot ${i + 1}`} className="w-full aspect-square object-cover block" />
              </button>
            ))}
          </div>
        )}
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

      {justGenerated && (
        <div className={`${JOBBAR} ${JOBBAR_SUCCESS} flex items-start justify-between gap-3`}>
          <span className="inline-flex items-start gap-2">
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>{justGenerated.name}</strong> is ready
              {justGenerated.angleNames.length > 0 && ` — covering ${justGenerated.angleNames.join(', ')}`}.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setJustGenerated(null)}
            aria-label="Dismiss"
            className="flex-shrink-0 text-emerald-600 hover:text-emerald-800"
          >
            <X size={16} />
          </button>
        </div>
      )}

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
                      ? renderSideTile(d, 'desktop', d.compositePath, d.slicePaths, 'aspect-[650/1027]')
                      : renderSideTile(d, 'mobile', d.mobileCompositePath, d.mobileSlicePaths, 'aspect-[1/3]')}
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
                busy: isGeneratingAny,
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
