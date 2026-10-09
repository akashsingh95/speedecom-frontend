/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { listingStudioApi, uploadImagesViaSignedUrl } from '../api';
import { creditNotificationMessage } from '../creditNotifications';
import { MUTED, BTN, BTN_PRIMARY, ERROR_TEXT, FIELD_LABEL, FIELD_INPUT, CANDIDATE_BADGE } from './classNames';

const CONCEPT_TYPES = [
  { value: 'main', label: 'Main Image' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'infographic', label: 'Infographic' },
];

/** Images tab "+ Generate new image" modal — unlike GeneratedImageModal (which always edits an
 *  existing gallery entry), this creates a brand-new one from a short user brief. If the user
 *  picks no reference photo and attaches none, the server picks one from the image library
 *  itself (see pipeline/images.js createImage) rather than silently using every raw upload. */
export function GenerateNewImageModal({ projectId, libraryEntries, onClose, onCreated }) {
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState('main');
  const [selectedIds, setSelectedIds] = useState([]);
  const [referenceFile, setReferenceFile] = useState(null);
  const referenceFileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const [referencePhotoKey] = referenceFile ? await uploadImagesViaSignedUrl([referenceFile], { transient: true }) : [];
      const result = await listingStudioApi.generateNewImage(projectId, {
        prompt,
        type,
        referenceImageIds: selectedIds,
        referencePhotoKey,
      });
      const message = creditNotificationMessage(result?.billing, 'Image generation');
      if (message) toast.success(message);
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-900 mb-3">Generate new image</h2>

      <label className={FIELD_LABEL}>
        <span>Concept type</span>
        <select className={FIELD_INPUT} value={type} onChange={(e) => setType(e.target.value)}>
          {CONCEPT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className={FIELD_LABEL}>
        <span>Describe what you want</span>
        <textarea
          rows={3}
          className={FIELD_INPUT}
          placeholder="e.g. product on a marble kitchen counter with morning light"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>

      <span className={`${MUTED} text-xs block mb-1`}>
        Reference photos (optional — leave none selected and we'll pick the best match):
      </span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {libraryEntries.map((e) => {
          const isSelected = selectedIds.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              title={e.suitabilityNotes || e.sceneDescription}
              className={`relative shrink-0 rounded-md overflow-hidden border-2 ${isSelected ? 'border-brand-500' : 'border-slate-200'}`}
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
        <span>Or upload a new reference photo</span>
        <div className="flex items-center gap-2">
          <button type="button" className={BTN} onClick={() => referenceFileRef.current?.click()}>
            {referenceFile ? 'Change photo' : '+ Upload photo'}
          </button>
          {referenceFile && (
            <>
              <span className={`${MUTED} text-xs truncate max-w-[10rem]`}>{referenceFile.name}</span>
              <button
                type="button"
                className={BTN}
                onClick={() => {
                  setReferenceFile(null);
                  // Reset so re-selecting the same file fires onChange again — the browser
                  // doesn't treat picking an unchanged value as a change otherwise.
                  if (referenceFileRef.current) referenceFileRef.current.value = '';
                }}
              >
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

      {error && <p className={`${ERROR_TEXT} mb-2`}>{error}</p>}

      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className={BTN} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={busy || !prompt.trim()} onClick={() => void generate()}>
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </Modal>
  );
}
