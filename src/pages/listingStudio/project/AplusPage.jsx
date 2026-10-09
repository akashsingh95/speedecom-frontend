/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, Puzzle, Pencil, Clock, Download, Loader2 } from 'lucide-react';
import { listingStudioApi, uploadImagesViaSignedUrl } from '../../../components/listingStudio/api';
import { creditNotificationMessage } from '../../../components/listingStudio/creditNotifications';
import { formatClock, useSlotGenerationClock, clearSlotGenerationClock } from '../../../components/listingStudio/pipelineClock';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { ImageLightbox } from '../../../components/listingStudio/ui/ImageLightbox';
import { GeneratedImageModal } from '../../../components/listingStudio/ui/GeneratedImageModal';
import { CreditCostPill } from '../../../components/listingStudio/ui/CreditCostPill';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import { AnglePicker } from '../../../components/listingStudio/AnglePicker';
import {
  PAGE_HEAD, PAGE_TITLE, CARD_TITLE, MUTED, BTN, BTN_PRIMARY, ICON_LABEL, GRID_CARDS, CARD,
  TABLE_WRAP, TABLE, TH, TD, ISSUE_WARN,
  GEN_CARD, GEN_CARD_FOOTER, GEN_CARD_TYPE_BADGE,
} from '../../../components/listingStudio/ui/classNames';

// The banner is 970x600 (Amazon's real "Standard Image Header" module — see
// aplus/catalog.js's own comment) — GEN_CARD_IMG's square aspect-ratio (built for the Images
// tab's product photos) would crop most of it away, so this card uses its own aspect-ratio
// image instead of that shared class, everything else (GEN_CARD/GEN_CARD_FOOTER) reused as-is.
const OVERLAY_IMG = 'w-full object-cover block';
const OVERLAY_ASPECT = { aspectRatio: '970 / 600' };
// Same look as the shared GEN_CARD_EDIT, but pinned to the top-right instead of top-left —
// unlike ImagesPage/ListingPage, this card has no "Remove" button contesting that corner.
const OVERLAY_EDIT_BTN =
  'absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white shadow-md ring-1 ring-slate-200 text-slate-600 grid place-items-center opacity-90 group-hover:opacity-100 transition-opacity hover:text-brand-600 hover:ring-brand-200';

// Shown instead of a silently-disabled Generate button when a concept's AI-picked module set
// (4-6 of the catalog's 5 types, not guaranteed to include this one) skipped the overlay module
// — there's no backend endpoint to add a missing module to an existing concept after the fact,
// so the only way to get one is a fresh concept batch.
const NO_OVERLAY_MODULE_MESSAGE = 'This concept has no image-text-overlay module — regenerate concepts to get one.';

// Below this length a rationale reliably fits within the 3-line clamp anyway, so the
// "Show more" toggle would have nothing to reveal — skip rendering it in that case.
const RATIONALE_CLAMP_THRESHOLD = 140;

/** Ported from speed-listing's pages/project/AplusPage.tsx. */
export default function AplusPage() {
  const { project, jobRunning, refresh, watchJob, creditRates } = useProjectCtx();
  const [compare, setCompare] = useState(false);
  // Opens the shared AnglePicker in a modal right on this page — an angle may be picked any
  // number of times (no "already used" lock, removed by design), so this is always available,
  // never gated on whether a concept already exists for a given angle.
  const [pickerOpen, setPickerOpen] = useState(false);
  const strategy = project.aplus?.strategy?.angles ? project.aplus.strategy : undefined;
  // Concept ids currently generating their image-text-overlay — a Set, not a single flag,
  // since generation is deliberately unguarded server-side (pipeline/moduleImage.js: "a
  // single-image action a user expects to fire off freely alongside anything else running on
  // the project") and every card's "Generate" button is independent. A single shared id here
  // would make one concept's completion incorrectly clear another still-generating concept's
  // busy indicator, and would let the same concept be re-triggered mid-generation.
  // Seeded from the server's own `generating` flag (not just an empty Set) so that navigating
  // away mid-generation and back — which remounts this whole page and would otherwise lose the
  // in-memory busy flag — still shows the button as busy immediately, before the resume effect
  // below even runs. Same source of truth the resume effect below reads.
  const [overlayBusyIds, setOverlayBusyIds] = useState(() => {
    const initial = new Set();
    (project.aplus?.concepts ?? []).forEach((c) => {
      const moduleIdx = c.modules.findIndex((m) => m.type === 'STANDARD_IMAGE_TEXT_OVERLAY');
      const mainSlot = moduleIdx === -1 ? null : c.modules[moduleIdx].images.find((s) => s.key === 'main');
      if (mainSlot?.generating) initial.add(c.id);
    });
    return initial;
  });
  const setOverlayBusy = (id, isBusy) =>
    setOverlayBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
 const { secondsLeft: overlaySecondsLeft } = useSlotGenerationClock(overlayBusyIds.size > 0, project.id);
  useEffect(() => {
    if (overlayBusyIds.size === 0) clearSlotGenerationClock(project.id);
  }, [overlayBusyIds.size, project.id]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  // Id of the concept whose overlay image is open in the "Edit" popup, else null.
  const [editingId, setEditingId] = useState(null);
  // Ids of concepts whose rationale is expanded past the default 3-line clamp.
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpanded = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const concepts = project.aplus?.concepts ?? [];
  const [downloading, setDownloading] = useState(false);
  const downloadAll = () => {
    setDownloading(true);
    listingStudioApi
      .downloadAplusImagesZip(project.id)
      .catch((err) => {
        console.error('A+ content export failed:', err);
        toast.error('Export failed — please try again.');
      })
      .finally(() => setDownloading(false));
  };

  const moduleLabel = (type) => type.replace('STANDARD_', '').replaceAll('_', ' ').toLowerCase();

  // The Module Editor is gone — the only per-image action left on this page is generating the
  // STANDARD_IMAGE_TEXT_OVERLAY module's single 970×600 "main" slot, right here on the card.
  const overlayModuleIndex = (concept) => concept.modules.findIndex((m) => m.type === 'STANDARD_IMAGE_TEXT_OVERLAY');
  const overlaySlot = (concept) => {
    const idx = overlayModuleIndex(concept);
    return idx === -1 ? null : concept.modules[idx].images.find((s) => s.key === 'main') ?? null;
  };
  const hasAnyBanner = concepts.some((c) => overlaySlot(c)?.path);
  // The generate/regenerate endpoint now just queues the model call and returns immediately
  // (server/listingStudio/pipeline/moduleImage.js — no more holding one HTTP request open for
  // the whole generation, see ADR-0009). Deliberately NOT the shared pollUntil (which re-fetches
  // the FULL project — every signed image URL across generatedImages/imageLibrary/every A+
  // concept — on every tick just to check one slot's boolean): this polls the tiny
  // { generating, error } status endpoint instead, and only fetches the full project once, via
  // the normal refresh(), after the slot is actually done. Rejects on failure so callers keep the
  // same "await = done, throw = failed" contract the old synchronous request had
  // (GeneratedImageModal's onRegenerate relies on this to decide whether to close itself).
  const waitForOverlaySlotDone = async (conceptId, moduleIdx, key, { intervalMs = 2000, maxAttempts = 150 } = {}) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const status = await listingStudioApi.getModuleImageStatus(project.id, conceptId, moduleIdx, key);
      if (!status.generating) {
        if (status.error) throw new Error(status.error);
        return status;
      }
    }
    throw new Error('Still generating — this is taking longer than usual. Check back shortly.');
  };
  const waitForOverlayResult = async (conceptId, moduleIdx, key) => {
    const status = await waitForOverlaySlotDone(conceptId, moduleIdx, key);
    await refresh();
    return { billing: status.billing };
  };

  /** Starts a new A+ concept batch straight from this page's own picker modal — same endpoint
   *  StrategyPage's picker already calls, just triggered here too now that there's no angle
   *  lock stopping a repeat pick. Closes the modal immediately (fire-and-forget); the shared
   *  project-level job bar shows progress, and the new concept(s) appear via the existing
   *  polling machinery once done, no extra polling needed here. */
  const generateConcepts = async (selectedAngleNames) => {
    await listingStudioApi.startAplus(project.id, selectedAngleNames);
    watchJob();
    setPickerOpen(false);
  };

  const generateOverlay = async (concept) => {
    const moduleIdx = overlayModuleIndex(concept);
    if (moduleIdx === -1 || overlayBusyIds.has(concept.id)) return;
    setOverlayBusy(concept.id, true);
    try {
      await listingStudioApi.generateModuleImage(project.id, concept.id, moduleIdx, 'main', 'low');
      const result = await waitForOverlayResult(concept.id, moduleIdx, 'main');
      const message = creditNotificationMessage(result?.billing, 'A+ image generation');
      if (message) toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Image generation failed.');
    } finally {
      setOverlayBusy(concept.id, false);
    }
  };

  /** From the "Edit" popup (GeneratedImageModal, shared with Images/Listing): persist the edited
   *  brief + references onto this one slot, then regenerate just it — mirrors the old Module
   *  Editor's regenerateSlotViaModal, minus the local draft state (this page always reads
   *  straight from project.aplus.concepts via context, kept fresh by waitForOverlayResult's
   *  poll). A failure here must stay a rejected promise: the modal only closes itself if this
   *  resolves. */
  const regenerateOverlay = async (concept, prompt, referenceImageIds, referenceFile) => {
    const moduleIdx = overlayModuleIndex(concept);
    const slot = overlaySlot(concept);
    if (moduleIdx === -1 || !slot) return;
    // Same overlayBusyIds this card's own "Generate" button reads (see generateOverlay above) —
    // without this, editing via the modal never flipped the card's button to "Generating…" at
    // all, even the instant you clicked Edit, since nothing here was ever telling AplusPage an
    // edit was in flight. Set before the persistence/generate calls, not after, so it's instant.
    setOverlayBusy(concept.id, true);
    try {
      const modulesPatch = concept.modules.map((m, i) => ({
        fields: m.fields,
        images: m.images.map((s) =>
          i === moduleIdx && s.key === slot.key
            ? { key: s.key, path: s.path ?? '', brief: prompt, referenceImageIds }
            : { key: s.key, path: s.path ?? '', brief: s.brief ?? '', referenceImageIds: s.referenceImageIds ?? [] },
        ),
      }));
      await listingStudioApi.patchConcept(project.id, concept.id, { name: concept.name, modules: modulesPatch });
      const [referencePhotoKey] = referenceFile ? await uploadImagesViaSignedUrl([referenceFile], { transient: true }) : [];
      await listingStudioApi.generateModuleImageWithReferencePhoto(project.id, concept.id, moduleIdx, slot.key, {
        quality: 'low',
        editSlotImage: 'true',
        referencePhotoKey,
      });
      return await waitForOverlayResult(concept.id, moduleIdx, slot.key);
    } finally {
      setOverlayBusy(concept.id, false);
    }
  };
useEffect(() => {
    concepts.forEach((c) => {
      const moduleIdx = overlayModuleIndex(c);
      if (overlaySlot(c)?.generating) {
        waitForOverlayResult(c.id, moduleIdx, 'main')
          .catch(() => {})
          .finally(() => setOverlayBusy(c.id, false));
      }
    });
     
  }, [project.id]);

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 grid place-items-center flex-shrink-0">
            <Puzzle size={16} />
          </span>
          <h1 className={PAGE_TITLE}>A+ Content</h1>
        </div>
        <div className="flex gap-2 items-center">
          {hasAnyBanner && (
            <button type="button" className={BTN} disabled={downloading} onClick={downloadAll}>
              <span className={ICON_LABEL}>
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading ? 'Preparing…' : 'Export & download all (.zip)'}
              </span>
            </button>
          )}
          {concepts.length > 1 && (
            <button type="button" className={BTN} onClick={() => setCompare(!compare)}>
              {compare ? 'Card view' : 'Compare side-by-side'}
            </button>
          )}
        </div>
      </div>
      {!project.imageLibrary?.entries?.length && (
        <p className={`${MUTED} mb-3`}>
          Photo analysis runs automatically after market research — once it's done, concepts will pick accurate image
          references from it. If you don't see it yet, check the{' '}
          <Link className="text-brand-600 underline" to="../listing">Listing &amp; Images</Link> page.
        </p>
      )}

      {!strategy && concepts.length === 0 && !jobRunning && (
        <EmptyStateCard
          tone="amber"
          icon={Sparkles}
          title="No marketing angles yet"
          description="Generate a creative strategy first — A+ concepts are built from your marketing angles."
          action={
            <Link className={BTN_PRIMARY} to="../strategy">
              <span className={ICON_LABEL}>
                <Sparkles size={16} /> Go to Creative Strategy
              </span>
            </Link>
          }
        />
      )}

      {strategy && concepts.length === 0 && !jobRunning && (
        <EmptyStateCard
          tone="amber"
          icon={Sparkles}
          title="No A+ concepts yet"
          description="Pick marketing angles to generate your first A+ content concepts."
          action={
            <button type="button" className={BTN_PRIMARY} onClick={() => setPickerOpen(true)}>
              <span className={ICON_LABEL}>
                <Sparkles size={16} /> Pick angles
              </span>
            </button>
          }
        />
      )}

      {concepts.length > 0 && !compare && (
        <div className={GRID_CARDS}>
          {concepts.map((c) => {
            const slot = overlaySlot(c);
            const busy = overlayBusyIds.has(c.id);
            const expanded = expandedIds.has(c.id);
            const truncatable = c.rationale.length > RATIONALE_CLAMP_THRESHOLD;
            return (
              <div key={c.id} className="flex flex-col gap-3.5">
                <div className={`${CARD} flex flex-col !mb-0`}>
                  {/* Every piece gets its OWN fixed height (not just a min-height guess on the
                      total), so Generate always lands on the same line across every card in the
                      row regardless of actual title/rationale length: h-[3.5rem] = text-lg's
                      1.75rem line-height × the 2 lines line-clamp-2 allows; h-[3.75rem] on the
                      rationale = text-sm's 1.25rem × the 3 lines line-clamp-3 allows. A single
                      min-height on the wrapper isn't enough — if title+rationale actually filled
                      every clamped line on one card but not another, that card would still end
                      up taller than the min-height floor and push its own Generate down further
                      than the rest. Expanding via "Show more" is an explicit per-card action, so
                      it's fine for that one card to grow past this once expanded. */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className={`${CARD_TITLE} flex-1 min-w-0 ${expanded ? '' : 'h-[3.5rem] line-clamp-2'}`}>{c.name}</h2>
                      {slot && !busy && (
                        <CreditCostPill
                          imageCost={creditRates?.imageCost ?? null}
                          freeRemaining={creditRates?.freeImagesRemaining ?? 0}
                          className="flex-shrink-0"
                        />
                      )}
                    </div>
                    <p className={`${MUTED} text-sm mb-1 ${expanded ? '' : 'h-[3.75rem] line-clamp-3'}`}>{c.rationale}</p>
                    {/* Always rendered (just invisible when there's nothing to expand) so every
                        card reserves the same line for it — otherwise a truncatable card's extra
                        toggle line makes it taller than a short-rationale card next to it, and
                        Generate stops lining up again. */}
                    <button
                      type="button"
                      className={`text-brand-600 text-xs font-semibold mb-3 hover:underline ${truncatable ? '' : 'invisible'}`}
                      onClick={() => truncatable && toggleExpanded(c.id)}
                    >
                      {expanded ? 'Show less' : 'Show more'}
                    </button>
                  </div>
                  {slot ? (
                    <button
                      type="button"
                      className={BTN_PRIMARY}
                      disabled={busy}
                      onClick={() => generateOverlay(c)}
                    >
                      {busy ? (
                        <span className={ICON_LABEL}>
                          Generating… <Clock size={12} /> {formatClock(overlaySecondsLeft)}
                        </span>
                      ) : (
                        <span className={ICON_LABEL}>
                          <Sparkles size={16} /> Generate
                        </span>
                      )}
                    </button>
                  ) : (
                    <p className={ISSUE_WARN}>{NO_OVERLAY_MODULE_MESSAGE}</p>
                  )}
                </div>
                {/* Its own card, separate from the concept card above — same gallery-card shell
                    (GEN_CARD/GEN_CARD_FOOTER) the Images/Listing tabs use, just at the banner's
                    actual 970x600 aspect ratio instead of their square crop. Clicking the image
                    opens the shared ImageLightbox, same as those galleries. */}
                {slot?.path && (
                  <div className={GEN_CARD}>
                    <button type="button" title="Edit" onClick={() => setEditingId(c.id)} className={OVERLAY_EDIT_BTN}>
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxSrc(slot.path)}
                      className="block w-full cursor-zoom-in"
                    >
                      <img src={slot.path} alt={`${c.name} image text overlay`} className={OVERLAY_IMG} style={OVERLAY_ASPECT} />
                    </button>
                    <div className={GEN_CARD_FOOTER}>
                      <span className={GEN_CARD_TYPE_BADGE}>A+ overlay</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {strategy && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="group h-[220px] w-full flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-blue-50/60 p-4 text-center transition-all hover:border-brand-300 hover:shadow-card-hover self-start"
            >
              <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white grid place-items-center shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
                <Sparkles size={24} />
              </span>
              <span className="font-semibold text-slate-900">Generate new concept</span>
              <span className="text-sm text-slate-400">Pick angles — AI builds the content</span>
            </button>
          )}
        </div>
      )}

      {concepts.length > 0 && compare && (
        <div className={`${CARD} ${TABLE_WRAP}`}>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH} />
                {concepts.map((c) => (
                  <th key={c.id} className={TH}>{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className={TH}>Angle</th>
                {concepts.map((c) => (
                  <td key={c.id} className={TD}>{c.rationale}</td>
                ))}
              </tr>
              <tr>
                <th className={TH}>Modules</th>
                {concepts.map((c) => (
                  <td key={c.id} className={TD}>
                    <ol className="list-decimal pl-4">
                      {c.modules.map((m, i) => (
                        <li key={i}>{moduleLabel(m.type)}</li>
                      ))}
                    </ol>
                  </td>
                ))}
              </tr>
              <tr>
                <th className={TH}>Opening headline</th>
                {concepts.map((c) => (
                  <td key={c.id} className={TD}>
                    {c.modules
                      .map((m) => m?.fields?.headline)
                      .find(Boolean) ?? '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th className={TH} />
                {concepts.map((c) => {
                  const slot = overlaySlot(c);
                  const busy = overlayBusyIds.has(c.id);
                  return (
                    <td key={c.id} className={TD}>
                      {slot ? (
                        <div className="flex flex-col items-start gap-1.5">
                          {!busy && (
                            <CreditCostPill imageCost={creditRates?.imageCost ?? null} freeRemaining={creditRates?.freeImagesRemaining ?? 0} />
                          )}
                          <button type="button" className={BTN} disabled={busy} onClick={() => generateOverlay(c)}>
                            {busy ? `Generating… ${formatClock(overlaySecondsLeft)}` : 'Generate'}
                          </button>
                        </div>
                      ) : (
                        <p className={`${MUTED} text-xs`}>No overlay module — regenerate concepts.</p>
                      )}
                      {slot?.path && (
                        <div className={`${GEN_CARD} mt-2 max-w-[220px]`}>
                          <button type="button" title="Edit" onClick={() => setEditingId(c.id)} className={OVERLAY_EDIT_BTN}>
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLightboxSrc(slot.path)}
                            className="block w-full cursor-zoom-in"
                          >
                            <img src={slot.path} alt={`${c.name} image text overlay`} className={OVERLAY_IMG} style={OVERLAY_ASPECT} />
                          </button>
                          <div className={GEN_CARD_FOOTER}>
                            <span className={GEN_CARD_TYPE_BADGE}>A+ overlay</span>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {editingId && (() => {
        const c = concepts.find((x) => x.id === editingId);
        const slot = c && overlaySlot(c);
        if (!c || !slot) return null;
        return (
          <GeneratedImageModal
            projectId={project.id}
            image={{ id: `${c.id}:${slot.key}`, prompt: slot.brief ?? '', path: slot.path, type: 'A+ overlay', referenceImageIds: slot.referenceImageIds }}
            libraryEntries={project.imageLibrary?.entries ?? []}
            imageCost={creditRates?.imageCost ?? null}
            freeImagesRemaining={creditRates?.freeImagesRemaining ?? 0}
            onClose={() => setEditingId(null)}
            onRegenerate={(prompt, referenceImageIds, referenceFile) => regenerateOverlay(c, prompt, referenceImageIds, referenceFile)}
            onRegenerated={async () => setEditingId(null)}
          />
        );
      })()}

      {pickerOpen && strategy && (
        <Modal onClose={() => setPickerOpen(false)} size="lg">
          <AnglePicker
            angles={strategy.angles}
            heading="Marketing angles"
            description={`${strategy.angles.length} distinct angles discovered from product data, reviews, and competitive analysis — click a card for the full breakdown. Check the angles you want, then generate A+ content for them.`}
            actions={[
              {
                key: 'standard',
                label: (n) => `Generate A+ content for ${n} angle${n === 1 ? '' : 's'}`,
                onGenerate: generateConcepts,
                busy: jobRunning,
                costNote: {
                  type: 'deferred',
                  imageCost: creditRates?.imageCost ?? null,
                  freeRemaining: creditRates?.freeImagesRemaining ?? 0,
                  text: 'Free to start — charged later, per banner, when you click Generate on each one.',
                },
              },
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
