import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Sparkles, RefreshCw, ArrowUp, Library, Pencil, AlertTriangle } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import { GeneratedImageModal } from '../../../components/listingStudio/ui/GeneratedImageModal';
import { ImageLightbox } from '../../../components/listingStudio/ui/ImageLightbox';
import { Toast } from '../../../components/listingStudio/ui/Toast';
import { IMAGE_MODELS } from '../../../components/listingStudio/constants';
import {
  PAGE_HEAD, MUTED, BTN, BTN_PRIMARY, BADGE, BADGE_GOOD, BADGE_WARN, BADGE_BAD, ERROR_TEXT, ICON_LABEL, THUMBS, ISSUE_WARN,
  EDITOR_GRID, EDITOR_LIST, MODULE_ITEM, MODULE_ITEM_ACTIVE, EDITOR_CANVAS, EDITOR_FOOTER,
  EDITOR_ISSUE, EDITOR_ISSUE_ERROR, EDITOR_ISSUE_WARN,
  SLOT_ROW, SLOT_ROW_MULTI, SLOT_BLOCK, SLOT_BLOCK_MULTI, SLOT, SLOT_IMG, SLOT_EMPTY, SLOT_ACTIONS,
  SLOT_ACTION_BTN, SLOT_UPSCALED_BADGE,
  // SLOT_PROMPT_PREVIEW, SLOT_PROMPT_PRE, — only used by the commented-out "Final generation prompt" preview below
  CANDIDATE_ROW, CANDIDATES, CANDIDATE, CANDIDATE_SELECTED, CANDIDATE_BADGE,
  FIELD_LABEL, FIELD_LABEL_INVALID, FIELD_COUNTER, FIELD_COUNTER_OVER, FIELD_INPUT, FIELD_INPUT_INVALID,
} from '../../../components/listingStudio/ui/classNames';

/**
 * Ported from speed-listing's pages/project/EditorPage.tsx — the module editor for one A+
 * concept. State machine preserved 1:1 from the source: a local `draft` clone is edited freely
 * (dirty tracking), saved via PATCH (which also returns fresh compliance issues), and per-slot
 * image generation supports best-of-N draft candidates plus a one-way "high quality" upscale of
 * whichever candidate is currently picked.
 */
export default function EditorPage() {
  const { project, refresh } = useProjectCtx();
  const { conceptId = '' } = useParams();
  const source = project.aplus?.concepts.find((c) => c.id === conceptId);

  const [catalog, setCatalog] = useState([]);
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busySlot, setBusySlot] = useState('');
  const [library, setLibrary] = useState(null);
  // slotKey while the "Edit" popup (GeneratedImageModal, shared with the Images tab) is open, else null.
  const [editingSlot, setEditingSlot] = useState(null);
  // { slotKey, selectedIds } while the "Reference photos" picker is open, else null.
  const [referencePicker, setReferencePicker] = useState(null);
  // Per-slot model override, keyed by "<moduleIdx>:<slotKey>" — a request-time-only choice,
  // never persisted on the slot; falls back to the project's default model (set at Create
  // Campaign) whenever a slot has no override selected here.
  const [slotModel, setSlotModel] = useState({});
  const [notice, setNotice] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState(null);
  // Authoritative — fetched from the same validateConcept() the backend gates export on, never
  // reimplemented client-side. Refreshed on load and whenever a save/generate round-trip hands
  // back a fresh copy for free; per-field char counters below stay purely local since that math
  // can't drift.
  const [issues, setIssues] = useState([]);
  // Undefined while unchecked, so the button below stays enabled (rather than flashing
  // disabled-then-enabled) until we actually know Replicate isn't configured.
  const [replicateConfigured, setReplicateConfigured] = useState(true);

  useEffect(() => {
    listingStudioApi.getCatalog().then(setCatalog, () => setCatalog([]));
  }, []);
  useEffect(() => {
    listingStudioApi.getHealth().then((h) => setReplicateConfigured(h.replicateConfigured), () => undefined);
  }, []);
  useEffect(() => {
    if (source && !dirty) setDraft(JSON.parse(JSON.stringify(source)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, project]);
  useEffect(() => {
    if (!conceptId) return;
    listingStudioApi.getCompliance(project.id, conceptId).then(setIssues, () => setIssues([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, conceptId]);

  if (!source || !draft) {
    return (
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-slate-900 mb-2">Module Editor</h1>
        <p className={MUTED}>
          Concept not found. <Link className="text-brand-600 underline" to="../aplus">Back to A+ Content</Link>
        </p>
      </div>
    );
  }

  const mod = draft.modules[selected];
  const spec = catalog.find((c) => c.type === mod?.type);

  const setField = (key, value) => {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, modules: d.modules.map((m, i) => (i === selected ? { ...m, fields: { ...m.fields, [key]: value } } : m)) };
    });
    setDirty(true);
  };

  /** Shape the backend's PATCH endpoint expects — shared by every save path so the two never drift apart. */
  const patchPayloadFor = (d) => ({
    name: d.name,
    modules: d.modules.map((m) => ({
      fields: m.fields,
      images: m.images.map((s) => ({ key: s.key, path: s.path ?? '', brief: s.brief ?? '', referenceImageIds: s.referenceImageIds ?? [] })),
    })),
  });

  const save = async (overrideDraft) => {
    const target = overrideDraft ?? draft;
    setSaving(true);
    try {
      const { issues: freshIssues } = await listingStudioApi.patchConcept(project.id, target.id, patchPayloadFor(target));
      setIssues(freshIssues);
      setDirty(false);
      await refresh();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setSaving(false);
    }
  };

  const modelForSlot = (slotKey) => slotModel[`${selected}:${slotKey}`] || project.imageModel;

  /** Writes a freshly generated slot (path/candidates/upscaled) back into draft state. */
  const applyGeneratedSlot = (slotKey, slot) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        modules: d.modules.map((m, i) =>
          i === selected
            ? { ...m, images: m.images.map((s) => (s.key === slotKey ? { ...s, path: slot.path, candidates: slot.candidates, upscaled: slot.upscaled } : s)) }
            : m,
        ),
      };
    });
  };

  const generateSlot = async (slotKey, quality, variants = 2) => {
    if (dirty) await save();
    setBusySlot(`${selected}:${slotKey}`);
    try {
      // "high" never calls the model again — the backend upscales the slot's currently-picked
      // draft (Real-ESRGAN via Replicate) and overwrites slot.path in place, so this
      // permanently replaces the old image with the upscaled one. The model override only
      // matters for the "low" draft call below, but is harmless to send either way.
      const { slot, issues: freshIssues } = await listingStudioApi.generateModuleImage(
        project.id,
        draft.id,
        selected,
        slotKey,
        quality,
        variants,
        modelForSlot(slotKey),
      );
      setIssues(freshIssues);
      applyGeneratedSlot(slotKey, slot);
      await refresh();
      if (quality === 'high') setNotice('Image upscaled successfully');
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setBusySlot('');
    }
  };

  /** From the "Edit" popup (GeneratedImageModal, shared with the Images tab): persists the
   *  edited brief + references, then regenerates just this slot's single current image
   *  (variants=1) — no extra unselected draft candidate left behind. Builds the save payload
   *  from a locally-computed draft rather than a `setDraft` call whose state update hasn't
   *  flushed yet, so the edited text is never lost to a stale closure. Unlike this file's other
   *  handlers, a failure here must stay a rejected promise rather than being swallowed: the
   *  modal awaits this via its `onRegenerate` prop and only calls `onRegenerated()` (closing
   *  itself) if it resolves — swallowing the error here would close the modal as if the edit had
   *  succeeded even when it didn't. The shared axios interceptor still shows its toast either
   *  way; only the local `busySlot` reset belongs in `finally`. */
  const regenerateSlotViaModal = async (slotKey, prompt, referenceImageIds, referenceFile) => {
    const nextDraft = {
      ...draft,
      modules: draft.modules.map((m, i) =>
        i === selected ? { ...m, images: m.images.map((s) => (s.key === slotKey ? { ...s, brief: prompt, referenceImageIds } : s)) } : m,
      ),
    };
    setDraft(nextDraft);
    setBusySlot(`${selected}:${slotKey}`);
    try {
      const { issues: patchIssues } = await listingStudioApi.patchConcept(project.id, nextDraft.id, patchPayloadFor(nextDraft));
      setIssues(patchIssues);
      setDirty(false);
      const form = new FormData();
      form.append('quality', 'low');
      form.append('variants', '1');
      form.append('imageModel', modelForSlot(slotKey));
      form.append('editSlotImage', 'true');
      if (referenceFile) form.append('referencePhoto', referenceFile);
      const { slot, issues: genIssues } = await listingStudioApi.generateModuleImageWithReferencePhoto(
        project.id,
        nextDraft.id,
        selected,
        slotKey,
        form,
      );
      setIssues(genIssues);
      applyGeneratedSlot(slotKey, slot);
      await refresh();
    } finally {
      setBusySlot('');
    }
  };

  /** From the reference-photos popup: just persists the selection. Regeneration (if wanted) is
   *  a separate, explicit step via the slot's own Generate button — picking references doesn't
   *  imply the user wants to spend on a new draft right now. */
  const saveReferenceImageIds = async (slotKey, referenceImageIds) => {
    const nextDraft = {
      ...draft,
      modules: draft.modules.map((m, i) =>
        i === selected ? { ...m, images: m.images.map((s) => (s.key === slotKey ? { ...s, referenceImageIds } : s)) } : m,
      ),
    };
    setDraft(nextDraft);
    setReferencePicker(null);
    await save(nextDraft);
  };

  /** Pick one of the best-of-N candidates for a slot. */
  const pickCandidate = (slotKey, path) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        modules: d.modules.map((m, i) => (i === selected ? { ...m, images: m.images.map((s) => (s.key === slotKey ? { ...s, path, upscaled: false } : s)) } : m)),
      };
    });
    setDirty(true);
  };

  const attachFromLibrary = (path) => {
    if (!library) return;
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        modules: d.modules.map((m, i) =>
          i === library.moduleIdx ? { ...m, images: m.images.map((s) => (s.key === library.slotKey ? { ...s, path, upscaled: false } : s)) } : m,
        ),
      };
    });
    setDirty(true);
    setLibrary(null);
  };

  const libraryImages = [...(project.generatedImages ?? []).map((g) => g.path), ...project.images];
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const moduleLabel = (type) => type.replace('STANDARD_', '').replaceAll('_', ' ').toLowerCase();

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-slate-900">
            Module Editor — {draft.name} {dirty && <span className={BADGE_WARN}>unsaved</span>}
          </h1>
          <p className={`${MUTED} text-sm`}>
            <Link className="text-brand-600 underline" to="../aplus">← A+ concepts</Link>
          </p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
      {notice && <Toast message={notice} onClose={() => setNotice('')} />}

      {!replicateConfigured && (
        <p className={ISSUE_WARN}>
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            "High quality" upscale is disabled: the server has no <code>REPLICATE_API_TOKEN</code> configured. Add it to
            the server env to enable it.
          </span>
        </p>
      )}

      <div className={EDITOR_GRID}>
        {/* Module list */}
        <div className={EDITOR_LIST}>
          {draft.modules.map((m, i) => {
            const modIssues = issues.filter((x) => x.moduleIndex === i);
            const modErrors = modIssues.filter((x) => x.severity === 'error').length;
            return (
              <button
                key={i}
                type="button"
                className={`${MODULE_ITEM} ${i === selected ? MODULE_ITEM_ACTIVE : ''}`}
                onClick={() => setSelected(i)}
              >
                <span>{i + 1}. {moduleLabel(m.type)}</span>
                {modErrors > 0 ? (
                  <span className={BADGE_BAD}>{modErrors}</span>
                ) : modIssues.length > 0 ? (
                  <span className={BADGE_WARN}>{modIssues.length}</span>
                ) : (
                  <span className={BADGE_GOOD}>✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Canvas */}
        <div className={EDITOR_CANVAS}>
          {spec && mod && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">{spec.label}</h2>
              <p className={`${MUTED} text-xs mb-3`}>{spec.description}</p>

              {mod.images.length > 0 && (
                <div className={mod.images.length > 1 ? SLOT_ROW_MULTI : SLOT_ROW}>
                  {mod.images.map((slot) => {
                    const busy = busySlot === `${selected}:${slot.key}`;
                    const referencedEntries = (project.imageLibrary?.entries ?? []).filter((e) =>
                      (slot.referenceImageIds ?? []).includes(e.id),
                    );
                    return (
                      <div key={slot.key} className={mod.images.length > 1 ? SLOT_BLOCK_MULTI : SLOT_BLOCK}>
                        <div className={SLOT} style={{ aspectRatio: `${slot.width}/${slot.height}` }}>
                          {slot.path ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setLightboxSrc(slot.path)}
                                className="block w-full h-full cursor-zoom-in"
                              >
                                <img className={SLOT_IMG} src={slot.path} alt={slot.label} />
                              </button>
                              {slot.upscaled && (
                                <span className={SLOT_UPSCALED_BADGE}>
                                  <ArrowUp size={11} className="inline -mt-0.5" /> Upscaled
                                </span>
                              )}
                            </>
                          ) : (
                            <div className={SLOT_EMPTY}>
                              <div>
                                {slot.label}
                                <br />
                                <span className={`${MUTED} text-xs`}>{slot.width}×{slot.height}</span>
                              </div>
                            </div>
                          )}
                          <div className={SLOT_ACTIONS}>
                            <button type="button" className={`${BTN} ${SLOT_ACTION_BTN}`} disabled={busy} onClick={() => void generateSlot(slot.key, 'low')}>
                              {busy ? 'Generating…' : slot.path ? (
                                <span className={ICON_LABEL}><RefreshCw size={13} /> 2 drafts</span>
                              ) : (
                                <span className={ICON_LABEL}><Sparkles size={13} /> Generate 2 drafts</span>
                              )}
                            </button>
                            <button
                              type="button"
                              className={`${BTN} ${SLOT_ACTION_BTN}`}
                              disabled={busy || !replicateConfigured}
                              title={replicateConfigured ? undefined : 'REPLICATE_API_TOKEN is not configured on the server'}
                              onClick={() => void generateSlot(slot.key, 'high')}
                            >
                              <span className={ICON_LABEL}><ArrowUp size={13} /> High quality</span>
                            </button>
                            <button type="button" className={`${BTN} ${SLOT_ACTION_BTN}`} onClick={() => setLibrary({ moduleIdx: selected, slotKey: slot.key })}>
                              <span className={ICON_LABEL}><Library size={13} /> Library</span>
                            </button>
                            <button
                              type="button"
                              className={`${BTN} ${SLOT_ACTION_BTN}`}
                              onClick={() => setEditingSlot(slot.key)}
                            >
                              <span className={ICON_LABEL}><Pencil size={13} /> Edit</span>
                            </button>
                          </div>
                        </div>
                        {(slot.candidates?.length ?? 0) > 1 && (
                          <div className={CANDIDATE_ROW}>
                            <span className={`${MUTED} text-xs`}>Pick the best draft:</span>
                            <div className={CANDIDATES}>
                              {slot.candidates.map((c, n) => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`${CANDIDATE} ${slot.path === c ? CANDIDATE_SELECTED : ''}`}
                                  onClick={() => pickCandidate(slot.key, c)}
                                  title={`Use draft ${n + 1}`}
                                >
                                  <img src={c} alt={`Draft ${n + 1}`} className="w-full block" />
                                  {slot.path === c && <span className={CANDIDATE_BADGE}>✓ using</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <label className={FIELD_LABEL}>
                          <span>Model for this image</span>
                          <select
                            className="block w-full mt-1 px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
                            value={modelForSlot(slot.key)}
                            onChange={(e) =>
                              setSlotModel((m) => ({ ...m, [`${selected}:${slot.key}`]: e.target.value }))
                            }
                          >
                            {IMAGE_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                                {m.id === project.imageModel ? ' (campaign default)' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="flex gap-2 items-center mt-1"
                          onClick={() => setReferencePicker({ slotKey: slot.key, selectedIds: [...(slot.referenceImageIds ?? [])] })}
                        >
                          <span className={`${MUTED} text-xs`}>Reference photos:</span>
                          {referencedEntries.length > 0 ? (
                            referencedEntries.map((e) => (
                              <img key={e.id} src={e.sourcePath} alt="" className="w-10 h-10 rounded-md object-cover border border-slate-200" />
                            ))
                          ) : (
                            <span className={`${MUTED} text-xs italic`}>None — click to choose</span>
                          )}
                        </button>
                        {/* Prompt preview hidden from UI for now — uncomment to bring it back.
                        {slot.flattenedPrompt && (
                          <details className={SLOT_PROMPT_PREVIEW}>
                            <summary className={`${MUTED} text-xs cursor-pointer`}>Final generation prompt</summary>
                            <pre className={SLOT_PROMPT_PRE}>{slot.flattenedPrompt}</pre>
                          </details>
                        )}
                        */}
                      </div>
                    );
                  })}
                </div>
              )}

              {spec.fields.map((f) => {
                const value = mod.fields[f.key] ?? '';
                const over = value.length > f.maxChars;
                const missingRequired = f.required && !value.trim();
                const invalid = over || missingRequired;
                return (
                  <label key={f.key} className={`${FIELD_LABEL} ${invalid ? FIELD_LABEL_INVALID : ''}`}>
                    <span>
                      {f.label}{' '}
                      {missingRequired && <span className={`${FIELD_COUNTER} ${FIELD_COUNTER_OVER}`}>required</span>}{' '}
                      <span className={`${FIELD_COUNTER} ${over ? FIELD_COUNTER_OVER : ''}`}>{value.length}/{f.maxChars}</span>
                    </span>
                    {f.multiline ? (
                      <textarea
                        rows={4}
                        className={`${FIELD_INPUT} ${invalid ? FIELD_INPUT_INVALID : ''}`}
                        value={value}
                        onChange={(e) => setField(f.key, e.target.value)}
                        onBlur={() => void (dirty && save())}
                      />
                    ) : (
                      <input
                        className={`${FIELD_INPUT} ${invalid ? FIELD_INPUT_INVALID : ''}`}
                        value={value}
                        onChange={(e) => setField(f.key, e.target.value)}
                        onBlur={() => void (dirty && save())}
                      />
                    )}
                  </label>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Compliance footer — spans the full page width below the module list/canvas */}
      <div className={EDITOR_FOOTER}>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Compliance</h2>
        {issues.length === 0 && <p className={BADGE_GOOD}>All checks pass ✓</p>}
        {errors.length > 0 && (
          <>
            <h3 className={`${ERROR_TEXT} text-sm font-semibold mt-3 mb-1`}>{errors.length} error(s)</h3>
            {errors.map((i, n) => (
              <button key={n} type="button" className={`${EDITOR_ISSUE} ${EDITOR_ISSUE_ERROR}`} onClick={() => setSelected(i.moduleIndex)}>
                {i.message}
              </button>
            ))}
          </>
        )}
        {warnings.length > 0 && (
          <>
            <h3 className="text-amber-600 text-sm font-semibold mt-3 mb-1">{warnings.length} warning(s)</h3>
            {warnings.map((i, n) => (
              <button key={n} type="button" className={`${EDITOR_ISSUE} ${EDITOR_ISSUE_WARN}`} onClick={() => setSelected(i.moduleIndex)}>
                {i.message}
              </button>
            ))}
          </>
        )}
        <p className={`${MUTED} text-xs mt-3`}>
          Amazon rejects A+ submissions over character limits. Warnings (missing images) don't block editing but
          must be resolved before export.
        </p>
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* "Edit" popup — same GeneratedImageModal component the Images tab uses, so edit
          suggestions/describe-your-edit/reference-photo-attach behave identically here. */}
      {editingSlot && (() => {
        const slot = mod?.images.find((s) => s.key === editingSlot);
        if (!slot) return null;
        return (
          <GeneratedImageModal
            projectId={project.id}
            image={{ id: `${selected}:${slot.key}`, prompt: slot.brief ?? '', path: slot.path, type: slot.label, referenceImageIds: slot.referenceImageIds }}
            libraryEntries={project.imageLibrary?.entries ?? []}
            onClose={() => setEditingSlot(null)}
            onRegenerate={(prompt, referenceImageIds, referenceFile) =>
              regenerateSlotViaModal(slot.key, prompt, referenceImageIds, referenceFile)
            }
            onRegenerated={async () => setEditingSlot(null)}
          />
        );
      })()}

      {/* Reference photos picker: left sidebar = every library photo (click to toggle), main
          area = the photos currently referenced, shown larger. */}
      {referencePicker && (() => {
        const allEntries = project.imageLibrary?.entries ?? [];
        const selectedEntries = allEntries.filter((e) => referencePicker.selectedIds.includes(e.id));
        const toggle = (id) =>
          setReferencePicker((p) => {
            if (!p) return p;
            const selectedIds = p.selectedIds.includes(id) ? p.selectedIds.filter((x) => x !== id) : [...p.selectedIds, id];
            return { ...p, selectedIds };
          });
        return (
          <Modal onClose={() => setReferencePicker(null)}>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Reference photos</h2>
            <p className={`${MUTED} text-xs mb-2`}>
              Real product photos the model sees as input when generating this image. 1-2 usually works best, but pick as many as you need.
            </p>
            <div className="flex gap-3">
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pr-1 shrink-0">
                {allEntries.map((e) => {
                  const isSelected = referencePicker.selectedIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      title={e.suitabilityNotes || e.sceneDescription}
                      className={`relative rounded-md overflow-hidden border-2 ${isSelected ? 'border-brand-500' : 'border-slate-200'}`}
                      onClick={() => toggle(e.id)}
                    >
                      <img src={e.sourcePath} alt="" className="w-14 h-14 object-cover block" />
                    </button>
                  );
                })}
                {allEntries.length === 0 && <p className={`${MUTED} text-xs w-14`}>No photos in the library yet.</p>}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2 content-start min-h-[140px]">
                {selectedEntries.length === 0 && (
                  <p className={`${MUTED} text-xs col-span-2`}>No reference photos selected yet — click photos on the left to add them.</p>
                )}
                {selectedEntries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    title="Click to remove"
                    className="relative rounded-lg overflow-hidden border-2 border-brand-500"
                    onClick={() => toggle(e.id)}
                  >
                    <img src={e.sourcePath} alt="" className="w-full aspect-square object-cover block" />
                    <span className={CANDIDATE_BADGE}>✓ using</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" className={BTN} onClick={() => setReferencePicker(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => void saveReferenceImageIds(referencePicker.slotKey, referencePicker.selectedIds)}
              >
                Save
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* Library modal */}
      {library && (
        <Modal onClose={() => setLibrary(null)}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Choose an image</h2>
          <div className={THUMBS}>
            {libraryImages.map((p) => (
              <button
                key={p}
                type="button"
                className="rounded-lg focus:outline-none focus:ring-4 focus:ring-brand-100"
                onClick={() => attachFromLibrary(p)}
              >
                <img src={p} alt="" className="w-[84px] h-[84px] object-cover rounded-lg border border-slate-200 bg-white" />
              </button>
            ))}
            {libraryImages.length === 0 && <p className={MUTED}>No images in the library yet.</p>}
          </div>
          <button type="button" className={`${BTN} mt-2`} onClick={() => setLibrary(null)}>Close</button>
        </Modal>
      )}
    </div>
  );
}
