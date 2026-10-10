import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { listingStudioApi, byteLen } from '../../../components/listingStudio/api';
import { validateUploadFiles } from '../../../components/listingStudio/helpers';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { Toast } from '../../../components/listingStudio/ui/Toast';
import { FormField } from '../../../components/listingStudio/ui/FormField';
import { GeneratedImageModal } from '../../../components/listingStudio/ui/GeneratedImageModal';
import { ImageLightbox } from '../../../components/listingStudio/ui/ImageLightbox';
import {
  PAGE_HEAD,
  PAGE_TITLE,
  BTN,
  BTN_PRIMARY,
  BTN_SMALL,
  CARD,
  MUTED,
  GRID_CARDS,
  BADGE_GOOD,
  NOTICE_WARN,
  CONCEPT_CARD,
  GALLERY,
  GEN_CARD,
  GEN_CARD_IMG,
  GEN_CARD_REMOVE,
  GEN_CARD_EDIT,
  GEN_CARD_FOOTER,
  GEN_CARD_TYPE_BADGE,
  GEN_CARD_CONCEPT_LABEL,
} from '../../../components/listingStudio/ui/classNames';
import { getErrorMessage } from '../../../components/listingStudio/errors';

/** Ported from speed-listing's pages/project/ListingPage.tsx. */
export default function ListingPage() {
  const { project, refresh } = useProjectCtx();
  const [conceptError, setConceptError] = useState(null);
  const [addingConceptId, setAddingConceptId] = useState('');
  const fileRef = useRef(null);

  const images = project.generatedImages ?? [];
  const concepts = project.aplus?.concepts ?? [];
  const addedConceptIds = new Set(images.map((i) => i.sourceConceptId).filter(Boolean));

  const [draft, setDraft] = useState(project.listing ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project.listing && !dirty) setDraft(JSON.parse(JSON.stringify(project.listing)));
  }, [project.listing, dirty]);

  const applyConcept = async (conceptId) => {
    setConceptError(null);
    setAddingConceptId(conceptId);
    try {
      await listingStudioApi.generateListingFromConcept(project.id, conceptId);
      await refresh();
    } catch (e) {
      // concept_no_images gets its own inline card with a link to the Module Editor — more
      // useful here than the generic toast the shared axios interceptor already showed for
      // this same failed request. Anything else just relies on that toast.
      if (e?.response?.data?.code === 'concept_no_images') {
        setConceptError({ conceptId, message: getErrorMessage(e) });
      }
    } finally {
      setAddingConceptId('');
    }
  };

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
    const form = new FormData();
    for (const f of Array.from(files)) form.append('images', f);
    try {
      await listingStudioApi.uploadImages(project.id, form);
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

      <div className={CARD}>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Choose an A+ concept for your listing</h2>
        <p className={`${MUTED} mb-3`}>
          Pick a concept to build your listing from — its already-generated module images are pulled into the gallery
          below, and the listing copy is written to match its creative direction.
        </p>
        {concepts.length === 0 && (
          <p className={MUTED}>
            No A+ concepts yet — generate some on the{' '}
            <Link to="../aplus" className="text-brand-600 underline">
              A+ Content
            </Link>{' '}
            page first.
          </p>
        )}
        <div className={GRID_CARDS}>
          {concepts.map((c) => {
            const added = addedConceptIds.has(c.id);
            const attachedCount = c.modules.reduce((n, m) => n + m.images.filter((s) => s.path).length, 0);
            return (
              <div key={c.id} className={`${CONCEPT_CARD} flex flex-col h-full`}>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-slate-500 text-xs mt-0.5 mb-2">{c.rationale}</p>
                  <div className="text-slate-500 text-xs mb-2">
                    {attachedCount} image{attachedCount === 1 ? '' : 's'} generated
                  </div>
                </div>
                {added ? (
                  <span className={BADGE_GOOD}>✓ Added to listing</span>
                ) : (
                  <button
                    type="button"
                    className={`${BTN_PRIMARY} w-full`}
                    disabled={addingConceptId === c.id}
                    onClick={() => void applyConcept(c.id)}
                  >
                    {addingConceptId === c.id ? 'Adding…' : 'Use for listing'}
                  </button>
                )}
                {conceptError?.conceptId === c.id && (
                  <div className={`${NOTICE_WARN} mt-2 flex-col items-start`}>
                    <p>{conceptError.message}</p>
                    <Link className={`${BTN} ${BTN_SMALL}`} to={`../editor/${c.id}`}>
                      Go to Module Editor
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {images.length > 0 && (
        <div className={CARD}>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Generated images</h2>
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
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
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
