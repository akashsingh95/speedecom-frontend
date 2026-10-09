/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, X, Pencil, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { listingStudioApi, byteLen, uploadImagesViaSignedUrl } from '../../../components/listingStudio/api';
import { validateUploadFiles } from '../../../components/listingStudio/helpers';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { Toast } from '../../../components/listingStudio/ui/Toast';
import { FormField } from '../../../components/listingStudio/ui/FormField';
import { GeneratedImageModal } from '../../../components/listingStudio/ui/GeneratedImageModal';
import { ImageLightbox } from '../../../components/listingStudio/ui/ImageLightbox';
import { AmazonPreviewPanel, sortedGeneratedImages } from '../../../components/listingStudio/AmazonPreviewPanel';
import {
  PAGE_HEAD,
  PAGE_TITLE,
  CARD_TITLE,
  BTN,
  BTN_PRIMARY,
  CARD,
  MUTED,
  GALLERY,
  GEN_CARD,
  GEN_CARD_IMG,
  GEN_CARD_REMOVE,
  GEN_CARD_EDIT,
  GEN_CARD_FOOTER,
  GEN_CARD_TYPE_BADGE,
  GEN_CARD_CONCEPT_LABEL,
} from '../../../components/listingStudio/ui/classNames';

/** Ported from speed-listing's pages/project/ListingPage.tsx. The "Amazon Preview" button
 *  toggles in AmazonPreviewPanel's pixel-accurate Amazon PDP mockup in place of this form
 *  editor; draft/dirty/saving state lives here so edits stay in sync between the two views.
 *
 *  `startInPreview` is the dedicated /p/:id/preview route: the "Amazon Preview" button opens it in
 *  a new browser tab, and "back" there returns to this page's editor route. */
export default function ListingPage({ startInPreview = false }) {
  const { project, refresh, creditRates } = useProjectCtx();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const images = project.generatedImages ?? [];
  // Only used to label a generated image's provenance below (GEN_CARD_CONCEPT_LABEL) — the
  // project's listing copy is generated once, synthesized across every marketing angle
  // (pipeline/strategy.js generateAndSaveStrategy), not per concept; there is no "pick a
  // concept to build the listing from" action anymore.
  const concepts = project.aplus?.concepts ?? [];

  const [draft, setDraft] = useState(project.listing ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project.listing && !dirty) setDraft(JSON.parse(JSON.stringify(project.listing)));
  }, [project.listing, dirty]);

  const [removingImage, setRemovingImage] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const libraryEntries = project.imageLibrary?.entries ?? [];

  const finalizeRemoveImage = async (imageId) => {
    try {
      await listingStudioApi.removeGeneratedImage(project.id, imageId);
      await refresh();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  // Removal is staged: the image is hidden immediately and a toast offers "Undo" — only
  // once that toast closes (dismissed or timed out, not undone) does the delete actually
  // reach the backend, since removeGeneratedImage has no restore endpoint.
  const removeImage = (img) => {
    if (removingImage && removingImage.id !== img.id) void finalizeRemoveImage(removingImage.id);
    setRemovingImage(img);
  };

  const uploadMore = async (files) => {
    if (!files?.length) return;
    const issue = validateUploadFiles(files);
    if (issue) {
      toast.error(issue);
      return;
    }
    try {
      const keys = await uploadImagesViaSignedUrl(files);
      await listingStudioApi.uploadImages(project.id, { keys });
      await refresh();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  const setField = (key, value) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDirty(true);
  };

  const setBullet = (i, value) => {
    setDraft((d) => {
      if (!d) return d;
      const bullets = [...d.bullets];
      bullets[i] = value;
      return { ...d, bullets };
    });
    setDirty(true);
  };

  const saveListing = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await listingStudioApi.updateListing(project.id, {
        title: draft.title,
        bullets: draft.bullets,
        description: draft.description,
        backendKeywords: draft.backendKeywords,
      });
      setDirty(false);
      await refresh();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setSaving(false);
    }
  };

  const reorderImages = async (from, to) => {
    const ids = sortedGeneratedImages(project).map((img) => img.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    try {
      await listingStudioApi.reorderGeneratedImages(project.id, ids);
      await refresh();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  if (startInPreview) {
    return (
      <AmazonPreviewPanel
        project={project}
        draft={draft}
        dirty={dirty}
        saving={saving}
        setField={setField}
        setBullet={setBullet}
        onSave={() => void saveListing()}
        onBack={() => navigate(`/listing-studio/p/${project.id}/listing`)}
        onReorderImages={project.generatedImages?.length ? reorderImages : undefined}
        showShare
      />
    );
  }

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 grid place-items-center flex-shrink-0">
            <ImageIcon size={16} />
          </span>
          <h1 className={PAGE_TITLE}>Listing &amp; Images</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.open(`/client/listing-studio/p/${project.id}/preview`, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] text-sm font-bold text-[#0f1111] shadow-[0_2px_8px_-1px_rgba(168,135,52,0.55)] ring-2 ring-[#f0c14b]/30 transition-all hover:from-[#f5d78c] hover:to-[#eeb933] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-[#f0c14b]/70"
          >
            <Eye size={16} strokeWidth={2.5} /> Amazon Preview
          </button>
          <button type="button" className={BTN} onClick={() => fileRef.current?.click()}>
            + Add product photos
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              void uploadMore(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {images.length > 0 && (
        <div className={CARD}>
          <h2 className={`${CARD_TITLE} mb-3`}>Generated images</h2>
          <div className={GALLERY}>
            {images
              .filter((img) => img.id !== removingImage?.id)
              .map((img) => {
                const sourceConcept = concepts.find((c) => c.id === img.sourceConceptId);
                return (
                  <div key={img.id} className={GEN_CARD}>
                    <button
                      type="button"
                      title="Remove from listing"
                      aria-label="Remove from listing"
                      onClick={() => removeImage(img)}
                      className={GEN_CARD_REMOVE}
                    >
                      <X size={13} />
                    </button>
                    <button type="button" title="Edit" onClick={() => setActiveImage(img)} className={GEN_CARD_EDIT}>
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => setLightboxSrc(img.path)} className="cursor-zoom-in">
                      <img src={img.path} alt={img.type} className={GEN_CARD_IMG} />
                    </button>
                    <div className={GEN_CARD_FOOTER}>
                      <span className={GEN_CARD_TYPE_BADGE}>{img.type}</span>
                      {sourceConcept && (
                        <span className={GEN_CARD_CONCEPT_LABEL} title={sourceConcept.name}>
                          {sourceConcept.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {draft && (
        <div className={CARD}>
          <div className="flex justify-between items-center mb-3">
            <h2 className={`${CARD_TITLE} flex items-center gap-2`}>
              Listing copy {dirty && <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-600 bg-amber-50 text-amber-600">unsaved</span>}
            </h2>
            <button type="button" className={BTN_PRIMARY} onClick={() => void saveListing()} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <FormField
            label="Title"
            value={draft.title}
            onChange={(e) => setField('title', e.target.value)}
            counter={{ value: draft.title.length, max: 200 }}
            invalid={draft.title.length > 200}
          />
          <span className={`${MUTED} text-xs`}>Bullets</span>
          {draft.bullets.map((b, i) => (
            <FormField
              key={i}
              label=""
              multiline
              rows={2}
              value={b}
              onChange={(e) => setBullet(i, e.target.value)}
              counter={{ value: b.length, max: 250 }}
              invalid={b.length > 250}
            />
          ))}
          <FormField
            label="Description"
            multiline
            rows={5}
            value={draft.description}
            onChange={(e) => setField('description', e.target.value)}
          />
          <FormField
            label="Backend search terms"
            multiline
            rows={2}
            value={draft.backendKeywords}
            onChange={(e) => setField('backendKeywords', e.target.value)}
            counter={{ value: byteLen(draft.backendKeywords), max: 249 }}
            invalid={byteLen(draft.backendKeywords) > 249}
          />
        </div>
      )}

      {activeImage && (
        <GeneratedImageModal
          projectId={project.id}
          image={activeImage}
          libraryEntries={libraryEntries}
          imageCost={creditRates?.imageCost ?? null}
          freeImagesRemaining={creditRates?.freeImagesRemaining ?? 0}
          onClose={() => setActiveImage(null)}
          onRegenerated={async () => {
            setActiveImage(null);
            await refresh();
          }}
        />
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {removingImage && (
        <Toast
          message="Image removed"
          duration={5000}
          onClose={() => {
            const id = removingImage.id;
            setRemovingImage(null);
            void finalizeRemoveImage(id);
          }}
          action={{ label: 'Undo', onClick: () => setRemovingImage(null) }}
        />
      )}
    </div>
  );
}
