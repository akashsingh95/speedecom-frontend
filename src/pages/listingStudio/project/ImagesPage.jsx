/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState } from 'react';
import { Images as ImagesIcon, Camera, Download, Loader2, Pencil, Sparkles } from 'lucide-react';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import { GeneratedImageModal } from '../../../components/listingStudio/ui/GeneratedImageModal';
import { GenerateNewImageModal } from '../../../components/listingStudio/ui/GenerateNewImageModal';
import { ImageLightbox } from '../../../components/listingStudio/ui/ImageLightbox';
import { listingStudioApi } from '../../../components/listingStudio/api';
import {
  PAGE_HEAD, PAGE_TITLE, CARD_TITLE, MUTED, SMALL, ICON_LABEL, CARD, BADGE, BADGE_GOOD, BTN,
  GALLERY, GEN_CARD, GEN_CARD_GENERATE, GEN_CARD_IMG, GEN_CARD_BADGES, GEN_CARD_EDIT,
  SERP_GRID, SERP_ITEM_SELECTABLE, SERP_IMG, SERP_TITLE,
} from '../../../components/listingStudio/ui/classNames';

/** Ported from speed-listing's pages/project/ImagesPage.tsx. */
export default function ImagesPage() {
  const { project, refresh, creditRates } = useProjectCtx();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [generatingNew, setGeneratingNew] = useState(false);
  // Fetched in createdAt order (insertion order), which is effectively random relative to
  // primary/secondary — the images.edit calls for a project's whole recommended set run
  // concurrently, so whichever one the model finishes first lands first. `position` (0/1 for
  // the 2 primary images, 2-5 for the 4 secondary ones — see pipeline/research.js) is the
  // stable intent order; sort=stable in modern JS keeps createdAt as the tiebreak.
  const generated = [...(project.generatedImages ?? [])].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
  const library = project.imageLibrary?.entries ?? [];

  const downloadAll = () => {
    setDownloading(true);
    listingStudioApi
      .downloadImagesZip(project.id)
      .catch((err) => console.error('Image export failed:', err))
      .finally(() => setDownloading(false));
  };

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 grid place-items-center flex-shrink-0">
              <ImagesIcon size={16} />
            </span>
            <h1 className={PAGE_TITLE}>Images</h1>
          </div>
          <p className={`${MUTED} ${SMALL} mt-1`}>Every AI-generated image for this campaign, plus the analyzed source photo library.</p>
        </div>
      </div>

      <div className={CARD}>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className={CARD_TITLE}>Generated images</h2>
          {generated.length > 0 && (
            <button type="button" className={BTN} disabled={downloading} onClick={downloadAll}>
              <span className={ICON_LABEL}>
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading ? 'Preparing…' : 'Export & download all (.zip)'}
              </span>
            </button>
          )}
        </div>
        <div className={GALLERY}>
          {generated.map((img) => (
            <div key={img.id} className={GEN_CARD}>
              <button type="button" title="Edit" onClick={() => setActiveImage(img)} className={GEN_CARD_EDIT}>
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => setLightboxSrc(img.path)} className="cursor-zoom-in block w-full">
                <img src={img.path} alt={img.type} className={GEN_CARD_IMG} />
              </button>
              <div className={GEN_CARD_BADGES}>
                <span className={BADGE}>{img.type}</span>
                <span className={img.quality === 'final' ? BADGE_GOOD : BADGE}>{img.quality}</span>
                {img.role && <span className={BADGE}>{img.role}</span>}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setGeneratingNew(true)}
            disabled={!project.research}
            title={project.research ? undefined : 'Complete market research first'}
            className={`${GEN_CARD_GENERATE} ${project.research ? '' : 'opacity-50 cursor-not-allowed pointer-events-none'}`}
          >
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white grid place-items-center shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Sparkles size={24} />
            </span>
            <span className="font-semibold text-slate-900">Generate new image</span>
            <span className="text-sm text-slate-400">{project.research ? 'Describe it — AI brings it to life' : 'Available once market research is complete'}</span>
          </button>
        </div>
        {generated.length === 0 && (
          <p className={`${MUTED} ${SMALL} mt-3`}>Drafts and finals from Listing &amp; Images and A+ Content will also appear here.</p>
        )}
      </div>

      <div className={CARD}>
        <h2 className={`${CARD_TITLE} mb-1 ${ICON_LABEL}`}>
          <Camera size={18} /> Image library
        </h2>
        {library.length === 0 ? (
          <p className={`${MUTED} ${SMALL}`}>
            {project.images.length > 0
              ? 'Photo analysis runs automatically once market research completes.'
              : 'Upload product photos to build a reference library for image generation.'}
          </p>
        ) : (
          <>
            <p className={`${MUTED} ${SMALL} mb-2`}>
              What the AI sees in each product photo — click a photo for the full breakdown. Used to pick accurate
              references when generating A+ concept images.
            </p>
            <div className={SERP_GRID}>
              {library.map((e) => (
                <button key={e.id} type="button" className={SERP_ITEM_SELECTABLE} onClick={() => setSelectedPhoto(e)}>
                  <img src={e.sourcePath} alt="" className={SERP_IMG} />
                  <div className={SERP_TITLE}>{e.sceneDescription}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedPhoto && (
        <Modal onClose={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto.sourcePath} alt="" className="w-full rounded-lg mb-3" />
          <span className={BADGE}>{selectedPhoto.presentationStyle}</span>
          <h3 className="font-medium text-slate-900 mt-2">Description</h3>
          <p>{selectedPhoto.sceneDescription}</p>
          {selectedPhoto.productComponents.length > 0 && (
            <>
              <h3 className="font-medium text-slate-900 mt-2">Product components</h3>
              <ul className="list-disc pl-4">
                {selectedPhoto.productComponents.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
          <h3 className="font-medium text-slate-900 mt-2">Suitability notes</h3>
          <p>{selectedPhoto.suitabilityNotes}</p>
          <p className={`${MUTED} ${SMALL}`}>Confidence: {Math.round(selectedPhoto.confidence * 100)}%</p>
          <button type="button" className={`${BTN} mt-3`} onClick={() => setSelectedPhoto(null)}>
            Close
          </button>
        </Modal>
      )}

      {activeImage && (
        <GeneratedImageModal
          projectId={project.id}
          image={activeImage}
          libraryEntries={library}
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

      {generatingNew && (
        <GenerateNewImageModal
          projectId={project.id}
          libraryEntries={library}
          onClose={() => setGeneratingNew(false)}
          onCreated={async () => {
            setGeneratingNew(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
