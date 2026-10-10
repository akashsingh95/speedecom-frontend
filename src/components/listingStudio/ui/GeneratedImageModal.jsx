import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { listingStudioApi } from '../api';
import { MUTED, BTN, BTN_PRIMARY, BADGE, BADGE_GOOD, ERROR_TEXT, FIELD_LABEL, FIELD_INPUT, CANDIDATE_BADGE } from './classNames';

/**
 * Shared "click a generated image" popup for ImagesPage, ListingPage, and the A+ module editor's
 * "Edit" action, so an image's prompt/references/AI-assist behave identically everywhere it's
 * edited. One combined view — the image itself, its prompt (editable), which reference photos it
 * used (editable), and a single Regenerate action.
 *
 * By default Regenerate calls the Images-tab regenerate endpoint directly (which also persists
 * the prompt/references as it goes — there's no standalone "save" for that flow, since nothing
 * else ever reads a generatedImages entry's prompt again once it exists). Pass `onRegenerate` to
 * override this for a host with its own persistence step (the A+ editor's slot is a fixed
 * position patched via PATCH, not a swappable gallery entry) — it receives
 * (prompt, referenceImageIds, referenceFile) and should throw on failure so the error surfaces
 * here rather than being silently swallowed.
 */
export function GeneratedImageModal({ projectId, image, libraryEntries, onClose, onRegenerated, onRegenerate }) {
  const [prompt, setPrompt] = useState(image.prompt ?? '');
  const [selectedIds, setSelectedIds] = useState(
    image.referenceImageIds?.length ? image.referenceImageIds : libraryEntries.map((e) => e.id),
  );
  const [busy, setBusy] = useState(false);

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

  const [editRequest, setEditRequest] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [referenceFile, setReferenceFile] = useState(null);
  const referenceFileRef = useRef(null);

  const toggle = (id) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const applyEdit = async () => {
    setMerging(true);
    setMergeError('');
    try {
      const r = await listingStudioApi.mergeEditPrompt(projectId, prompt, editRequest);
      setPrompt(r.prompt);
      setEditRequest('');
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : String(e));
    } finally {
      setMerging(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      if (onRegenerate) {
        await onRegenerate(prompt, selectedIds, referenceFile);
      } else {
        const form = new FormData();
        form.append('prompt', prompt);
        form.append('referenceImageIds', JSON.stringify(selectedIds));
        if (referenceFile) form.append('referencePhoto', referenceFile);
        await listingStudioApi.regenerateGeneratedImage(projectId, image.id, form);
      }
      await onRegenerated();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      {image.path && <img src={image.path} alt={image.type} className="w-full max-h-72 object-contain rounded-lg mb-3 bg-slate-50" />}
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
              onClick={() => setEditRequest(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <label className={FIELD_LABEL}>
        <span>Describe your edit</span>
        <div className="flex gap-2">
          <input
            type="text"
            className={`${FIELD_INPUT} flex-1`}
            placeholder="e.g. make the background brighter"
            value={editRequest}
            onChange={(e) => setEditRequest(e.target.value)}
          />
          <button type="button" className={BTN} disabled={merging || !editRequest.trim()} onClick={() => void applyEdit()}>
            {merging ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </label>
      {mergeError && <p className={`${ERROR_TEXT} mb-2`}>{mergeError}</p>}

      <label className={FIELD_LABEL}>
        <span>Concept</span>
        <textarea rows={4} className={FIELD_INPUT} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>

      <span className={`${MUTED} text-xs block mb-1`}>Reference photos:</span>
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
        <span>Attach a reference photo for this edit</span>
        <div className="flex items-center gap-2">
          <button type="button" className={BTN} onClick={() => referenceFileRef.current?.click()}>
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

      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className={BTN} onClick={onClose} disabled={busy}>
          Close
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={busy || !prompt.trim()} onClick={() => void regenerate()}>
          {busy ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>
    </Modal>
  );
}
