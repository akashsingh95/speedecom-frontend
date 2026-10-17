/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, Video, Clock, X, Pencil } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { videoCreditNotificationMessage } from '../../../components/listingStudio/creditNotifications';
import { formatClock, useVideoGenerationClock, clearVideoGenerationClock } from '../../../components/listingStudio/pipelineClock';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import { CreditCostPill } from '../../../components/listingStudio/ui/CreditCostPill';
import { VideoCreatePicker } from '../../../components/listingStudio/VideoCreatePicker';
import {
  PAGE_HEAD, PAGE_TITLE, MUTED, BTN, BTN_PRIMARY, ICON_LABEL, GRID_CARDS,
  GEN_CARD, GEN_CARD_GENERATE, GEN_CARD_FOOTER, GEN_CARD_TYPE_BADGE, GEN_CARD_REMOVE, GEN_CARD_EDIT_ON_HOVER,
} from '../../../components/listingStudio/ui/classNames';

const MAX_EDIT_INSTRUCTION_LENGTH = 1000;

const OVERLAY_MODULE_TYPE = 'STANDARD_IMAGE_TEXT_OVERLAY';
const ASPECT_RATIOS = [
  { value: '16:9', label: 'Landscape (16:9)' },
  { value: '9:16', label: 'Portrait (9:16)' },
];
const cssAspectRatio = (ratio) => (ratio || '16:9').replace(':', ' / ');
const videoPolls = new Map();
const mountedRefresh = new Map();

// Network errors, 5xx and 429 are retried; any other 4xx (card deleted, access lost) ends the poll quietly.
const isRetryablePollError = (err) => {
  const status = err?.response?.status;
  return !status || status >= 500 || status === 429;
};

async function pollVideoUntilDone(projectId, conceptId, { intervalMs = 2000, fastAttempts = 150, maxIntervalMs = 30000 } = {}) {
  let delay = intervalMs;
  for (let attempt = 0; ; attempt++) {
    if (attempt >= fastAttempts) delay = Math.min(delay * 1.5, maxIntervalMs);
    await new Promise((resolve) => setTimeout(resolve, delay));
    let status;
    try {
      status = await listingStudioApi.getVideoStatus(projectId, conceptId);
    } catch (err) {
      // A blip or 5xx must not end the poll: a settled key is never re-watched while the card is still generating.
      if (isRetryablePollError(err)) continue;
      return null;
    }
    if (!status.generating) {
      if (status.error) throw new Error(status.error);
      return status;
    }
  }
}

function watchVideo(projectId, conceptId) {
  const key = `${projectId}:${conceptId}`;
  videoPolls.set(key, 'running');
  pollVideoUntilDone(projectId, conceptId)
    .then((result) => {
      const message = videoCreditNotificationMessage(result?.billing, 'Video generation');
      if (message) toast.success(message);
    })
    .catch((err) => toast.error(err?.message || 'Video generation failed'))
    .finally(() => {
      videoPolls.set(key, 'settled');
      mountedRefresh.get(projectId)?.();
    });
}

function hasReadySeedImage(aplusConcepts, angleName) {
  return aplusConcepts.some((c) => {
    if (c.sourceAngleName !== angleName) return false;
    const overlay = c.modules.find((m) => m.type === OVERLAY_MODULE_TYPE);
    return Boolean(overlay?.images.find((s) => s.key === 'main')?.path);
  });
}

export default function VideosPage() {
  const { project, jobRunning, refresh, watchJob, creditRates } = useProjectCtx();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const strategy = project.aplus?.strategy?.angles ? project.aplus.strategy : undefined;
  const aplusConcepts = project.aplus?.concepts ?? [];
  const strategyAngles = strategy?.angles ?? [];
  const readyAngles = strategyAngles.filter((a) => hasReadySeedImage(aplusConcepts, a.name));
  const generatedImages = project.generatedImages ?? [];
  const videoConcepts = project.videoConcepts ?? [];
  const canCreateVideo = readyAngles.length > 0 || generatedImages.length > 0;

  const anyGenerating = videoConcepts.some((c) => c.generating);
  const { secondsLeft } = useVideoGenerationClock(anyGenerating, project.id);
  useEffect(() => {
    if (!anyGenerating) clearVideoGenerationClock(project.id);
  }, [anyGenerating, project.id]);

  useEffect(() => {
    mountedRefresh.set(project.id, refresh);
    // A poll settled while this page was unmounted — pick up its result now.
    if ([...videoPolls].some(([key, state]) => state === 'settled' && key.startsWith(`${project.id}:`))) refresh();
    return () => {
      if (mountedRefresh.get(project.id) === refresh) mountedRefresh.delete(project.id);
    };
  }, [project.id, refresh]);

  const generateConcepts = async (angles) => {
    await listingStudioApi.startVideoConcepts(project.id, angles, aspectRatio);
    watchJob();
    setPickerOpen(false);
  };

  const generateCategoryVideo = async (kind, sourceImageIds) => {
    await listingStudioApi.generateCategoryVideo(project.id, kind, sourceImageIds, aspectRatio);
    setPickerOpen(false);
    await refresh();
  };

  const [editTarget, setEditTarget] = useState(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const openEdit = (concept) => {
    setEditTarget(concept);
    setEditInstruction('');
  };
  const submitEdit = async () => {
    const instruction = editInstruction.trim();
    if (!instruction || !editTarget) return;
    setEditSubmitting(true);
    try {
      await listingStudioApi.editVideo(project.id, editTarget.id, instruction);
      setEditTarget(null);
      await refresh();
    } catch {
      // api.js's interceptor already toasted this
    } finally {
      setEditSubmitting(false);
    }
  };

  const dismissVideo = async (conceptId) => {
    try {
      await listingStudioApi.deleteVideoConcept(project.id, conceptId);
      await refresh();
    } catch {
      // api.js's interceptor already toasted this
    }
  };

  const generatingKey = videoConcepts.map((c) => `${c.id}:${c.generating}`).join(',');
  useEffect(() => {
    videoConcepts.forEach((c) => {
      const key = `${project.id}:${c.id}`;
      // Fresh data shows it finished: forget the settled poll so a later retry can be watched again.
      if (!c.generating) {
        if (videoPolls.get(key) === 'settled') videoPolls.delete(key);
        return;
      }
      if (!videoPolls.has(key)) watchVideo(project.id, c.id);
    });
  }, [generatingKey, project.id]);

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 grid place-items-center flex-shrink-0">
            <Video size={16} />
          </span>
          <h1 className={PAGE_TITLE}>Videos</h1>
        </div>
      </div>

      {!canCreateVideo && videoConcepts.length === 0 && !jobRunning && (
        <EmptyStateCard
          tone="violet"
          icon={Video}
          title="No images to build a video from yet"
          description="A video animates an existing image — generate a Standard A+ hero image or a product image on the Images tab first."
          action={
            <div className="flex gap-2 flex-wrap justify-center">
              <Link className={BTN_PRIMARY} to="../aplus">
                <span className={ICON_LABEL}>
                  <Sparkles size={16} /> Go to A+ Content
                </span>
              </Link>
              <Link className={BTN} to="../images">
                <span className={ICON_LABEL}>
                  <Sparkles size={16} /> Go to Images
                </span>
              </Link>
            </div>
          }
        />
      )}

      {canCreateVideo && videoConcepts.length === 0 && !jobRunning && (
        <EmptyStateCard
          tone="violet"
          icon={Video}
          title="No videos yet"
          description="Pick a product category or one of your marketing angles to generate your first video."
          action={
            <button type="button" className={BTN_PRIMARY} onClick={() => setPickerOpen(true)}>
              <span className={ICON_LABEL}>
                <Sparkles size={16} /> Generate new video
              </span>
            </button>
          }
        />
      )}

      {videoConcepts.length > 0 && (
        <div className={`${GRID_CARDS} items-start`}>
          {videoConcepts.map((c) => {
            const busy = Boolean(c.generating);
            const dismissible = Boolean(c.error) && !c.path && !busy;
            return (
              <div key={c.id} className={GEN_CARD}>
                {dismissible && (
                  <button
                    type="button"
                    title="Remove"
                    aria-label="Remove"
                    onClick={() => dismissVideo(c.id)}
                    className={GEN_CARD_REMOVE}
                  >
                    <X size={13} />
                  </button>
                )}
                {c.path && !busy && (
                  <button
                    type="button"
                    title="Edit video"
                    aria-label="Edit video"
                    onClick={() => openEdit(c)}
                    className={GEN_CARD_EDIT_ON_HOVER}
                  >
                    <Pencil size={13} />
                  </button>
                )}
                {c.path && !busy ? (
                  <video
                    src={c.path}
                    controls
                    className="w-full object-contain block bg-black"
                    style={{ aspectRatio: cssAspectRatio(c.aspectRatio) }}
                  />
                ) : (
                  <div
                    className="w-full flex items-center justify-center bg-slate-50 px-4 text-center"
                    style={{ aspectRatio: cssAspectRatio(c.aspectRatio) }}
                  >
                    {busy ? (
                      <span className={`${ICON_LABEL} ${MUTED} text-sm`}>
                        Generating… <Clock size={12} /> {formatClock(secondsLeft)}
                      </span>
                    ) : c.error ? (
                      <span className="text-xs text-red-600">{c.error}</span>
                    ) : (
                      <span className={`${MUTED} text-sm`}>Queued…</span>
                    )}
                  </div>
                )}
                <div className={GEN_CARD_FOOTER}>
                  <span className={GEN_CARD_TYPE_BADGE}>{c.editOf ? c.name : c.sourceAngleName || c.name}</span>
                </div>
              </div>
            );
          })}
          {canCreateVideo && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`${GEN_CARD_GENERATE} w-full`}
              style={{ aspectRatio: '16 / 9' }}
            >
              <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white grid place-items-center shadow-md shadow-violet-500/30 group-hover:scale-105 transition-transform">
                <Sparkles size={24} />
              </span>
              <span className="font-semibold text-slate-900">Generate new video</span>
              <span className="text-sm text-slate-400">A product category or a marketing angle</span>
            </button>
          )}
        </div>
      )}

      {editTarget && (
        <Modal onClose={() => !editSubmitting && setEditTarget(null)}>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Edit video</h2>
          <video
            src={editTarget.path}
            muted
            className="w-full max-h-[240px] object-contain block bg-black rounded-lg mb-3"
            style={{ aspectRatio: cssAspectRatio(editTarget.aspectRatio) }}
          />
          <textarea
            value={editInstruction}
            onChange={(e) => setEditInstruction(e.target.value)}
            maxLength={MAX_EDIT_INSTRUCTION_LENGTH}
            rows={4}
            placeholder="What should change?"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 resize-y focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
          <div className="flex justify-between items-center mt-3">
            <span>
              {!editSubmitting && (
                <CreditCostPill imageCost={creditRates?.videoCost ?? null} freeRemaining={creditRates?.freeVideosRemaining ?? 0} unit="video" />
              )}
            </span>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={submitEdit}
              disabled={editSubmitting || !editInstruction.trim()}
            >
              <span className={ICON_LABEL}>
                <Pencil size={14} /> {editSubmitting ? 'Starting…' : 'Edit video'}
              </span>
            </button>
          </div>
        </Modal>
      )}

      {pickerOpen && (
        <Modal onClose={() => setPickerOpen(false)}>
          <div className="flex justify-end mb-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <span>Orientation</span>
              <select
                className="w-auto px-2 py-1 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
              >
                {ASPECT_RATIOS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <VideoCreatePicker
            angles={strategyAngles}
            hasReadySeedImage={(name) => hasReadySeedImage(aplusConcepts, name)}
            generatedImages={generatedImages}
            onGenerateCategory={generateCategoryVideo}
            onGenerateAngles={generateConcepts}
            busy={jobRunning}
            videoCost={creditRates?.videoCost ?? null}
            freeVideosRemaining={creditRates?.freeVideosRemaining ?? 0}
          />
        </Modal>
      )}
    </div>
  );
}
