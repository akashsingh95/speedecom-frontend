import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, GitCompare, X } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { amazonUrl } from '../../../components/listingStudio/helpers';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import {
  PAGE_HEAD,
  PAGE_TITLE,
  MUTED,
  SMALL,
  BTN,
  BADGE,
  BADGE_GOOD,
  GRID_CARDS,
  PROJECT_CARD,
  THUMB_PLACEHOLDER,
  SHELF_WRAP,
  SHELF_TABLE,
  SHELF_CELL,
  SHELF_HEAD_STICKY,
  SHELF_ROW_HEAD,
  SHELF_ROW_HEAD_TOPLEFT,
  SHELF_SUBLABEL,
  SHELF_IMAGE_CELL,
  SHELF_COUNT_BADGE,
} from '../../../components/listingStudio/ui/classNames';

// Ported from speed-listing's pages/project/ComparisonShelfPage.tsx — side-by-side
// comparison table (new listing vs. current listing vs. competitors vs. other campaigns),
// row by image position. Sticky table header/first-column via Tailwind `sticky` utilities
// in place of the source's plain CSS `position: sticky` rules.

// Campaigns added via "+ Add campaign to compare" are persisted on the project itself
// (`project.compareWith`, PATCH /projects/:id/compare-with), not in component state: this shelf
// is one section route among many, so switching section tabs unmounts the page and local-only
// state silently dropped every added column. Server-side rather than localStorage so a shelf
// follows the account across devices and teammates instead of one browser profile.
// Mirrors the server's own cap (projectsService.MAX_COMPARE_WITH).
const MAX_COMPARE_WITH = 8;

// One-shot carry-over from the short-lived localStorage-backed version of this list. The key is
// removed only once the server has accepted the ids, so a failed carry-over is retried on the
// next visit rather than dropped.
const legacyStorageKey = (projectId) => `listingStudio:compareWith:${projectId}`;

function takeLegacyIds(projectId) {
  try {
    const raw = window.localStorage.getItem(legacyStorageKey(projectId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function dropLegacyIds(projectId) {
  try {
    window.localStorage.removeItem(legacyStorageKey(projectId));
  } catch {
    // ignore — worst case the (idempotent) carry-over runs again on the next visit
  }
}

/** One row per occupied gallery position, in ascending position order: the newest final (else
 *  newest draft) image for that slot, and how many candidates share it. */
function bestByPosition(images) {
  const byPosition = new Map();
  for (const img of images) {
    const pos = img.position ?? 0;
    const group = byPosition.get(pos) ?? [];
    group.push(img);
    byPosition.set(pos, group);
  }
  // Ranked, not indexed by absolute position. `position` values are not dense: deleting an image
  // leaves a hole, and so does a reorder (the backend's reservation counter stays monotonic on
  // purpose — see store.setGeneratedImagePositions). Walking 0..maxPos instead would emit a blank
  // row per hole and push this column's images down against the Before/Competitor columns, which
  // are plain dense path lists that maxRows/rowLabel index the same way — i.e. a gap would
  // silently compare the wrong images side by side.
  const paths = [];
  const counts = [];
  for (const pos of [...byPosition.keys()].sort((a, b) => a - b)) {
    const group = byPosition.get(pos);
    counts.push(group.length > 1 ? group.length : undefined);
    // A raw upload (type 'photo') is stored as quality 'final' from the moment it's added —
    // that's just "this isn't a draft render," not "this was picked as the campaign's image."
    // Letting it win a tied slot over an actual AI draft/final would show the seller's own
    // before-photo as the campaign's "after" image, so it's excluded from the final-over-draft
    // preference here; among non-photo entries the usual final-over-draft, newest-wins rule applies.
    const finals = group.filter((g) => g.quality === 'final' && g.type !== 'photo');
    const pool = finals.length > 0 ? finals : group;
    paths.push(pool.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).path);
  }
  return { images: paths, counts };
}

function generatedColumn(p, label, onRemove) {
  const { images, counts } = bestByPosition(p.generatedImages ?? []);
  return { key: `gen-${p.id}`, label, sublabel: p.input.name, images, counts, highlight: true, onRemove };
}

export default function ComparisonShelfPage() {
  const { project, refresh } = useProjectCtx();
  const [extraProjects, setExtraProjects] = useState([]);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allProjects, setAllProjects] = useState(null);

  useEffect(() => {
    if (picker && !allProjects) {
      // The shared axios instance's response interceptor already shows a toast on failure.
      listingStudioApi.listProjects().then((data) => setAllProjects(data.projects), () => {});
    }
  }, [picker, allProjects]);

  // Stable dependency for the loader below. project.compareWith is a fresh array on every
  // refresh() of the project — and a running job refreshes it every few seconds — so depending
  // on the array itself would re-fetch every pinned campaign on each poll tick.
  const compareKey = (project.compareWith ?? []).join(',');
  const compareIds = compareKey ? compareKey.split(',') : [];

  // The pinned ids are resolved to full projects here rather than stored as a snapshot: the
  // shelf shows each one's *current* generated images.
  useEffect(() => {
    const ids = compareKey ? compareKey.split(',') : [];
    if (ids.length === 0) {
      setExtraProjects([]);
      return undefined;
    }
    let active = true;
    // getProjectIfVisible, not getProject: a campaign deleted in another tab since this shelf
    // was last loaded resolves to null and is dropped from the row instead of raising an error
    // toast. The id itself is unpinned server-side by store.deleteProject.
    Promise.all(ids.map((cid) => listingStudioApi.getProjectIfVisible(cid))).then((loaded) => {
      if (active) setExtraProjects(loaded.filter(Boolean));
    });
    return () => {
      active = false;
    };
  }, [compareKey]);

  /** Replaces the whole pinned set, then pulls the updated project through the layout's shared
   *  state so `compareKey` (and the loader above) reacts to it — rather than keeping a second,
   *  separately-drifting copy of the list in this component. */
  const saveCompareWith = async (ids) => {
    setSaving(true);
    try {
      await listingStudioApi.setProjectCompareWith(project.id, ids);
      await refresh();
      return true;
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Carry over whatever the previous localStorage-backed version of this shelf still holds, so
  // the columns a user pinned before this change don't silently vanish. Intentionally keyed on
  // project.id alone — it must run once per campaign, not on every compareWith change.
  useEffect(() => {
    const legacy = takeLegacyIds(project.id);
    if (legacy.length === 0) return;
    const current = project.compareWith ?? [];
    const merged = [...current, ...legacy.filter((id) => id !== project.id && !current.includes(id))];
    if (merged.length === current.length) {
      dropLegacyIds(project.id);
      return;
    }
    void saveCompareWith(merged.slice(0, MAX_COMPARE_WITH)).then((ok) => {
      if (ok) dropLegacyIds(project.id);
    });
  }, [project.id]);

  const addProject = (id) => {
    setPicker(false);
    if (saving || compareIds.includes(id) || compareIds.length >= MAX_COMPARE_WITH) return;
    void saveCompareWith([...compareIds, id]);
  };

  const removeProject = (id) => {
    if (saving) return;
    void saveCompareWith(compareIds.filter((cid) => cid !== id));
  };

  const columns = useMemo(() => {
    const cols = [generatedColumn(project, 'After')];
    cols.push({
      key: 'current',
      label: 'Before',
      sublabel: project.sourceAsin ?? 'No source ASIN',
      asin: project.sourceAsin,
      images: project.images,
    });
    for (const c of project.competitors ?? []) {
      cols.push({ key: `cmp-${c.asin}`, label: 'Competitor', sublabel: c.asin, asin: c.asin, images: c.images ?? [] });
    }
    for (const p of extraProjects) {
      cols.push(generatedColumn(p, 'Previous Campaign', () => removeProject(p.id)));
    }
    return cols;
  }, [project, extraProjects]);

  const maxRows = Math.max(0, ...columns.map((c) => c.images.length));
  const rowLabel = (i) => (i === 0 ? 'Main Image' : `Secondary Image ${i}`);
  // Excludes campaigns the user started but never finished (e.g. abandoned the wizard before any
  // image was generated) — there'd be nothing to show in a "Previous Campaign" column for those.
  const pickerCandidates = (allProjects ?? []).filter(
    (p) => p.id !== project.id && p.hasGeneratedImages && !extraProjects.some((e) => e.id === p.id),
  );

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 grid place-items-center flex-shrink-0">
              <GitCompare size={16} />
            </span>
            <h1 className={PAGE_TITLE}>Comparison Shelf</h1>
          </div>
          <p className={MUTED}>
            Your new creative set, your current live listing, and your competitors&apos; listings, row by image
            position — so the shelf space they cover and you don&apos;t is visible at a glance.
          </p>
        </div>
        <button
          className={`${BTN} disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={() => setPicker(true)}
          disabled={saving || compareIds.length >= MAX_COMPARE_WITH}
          title={compareIds.length >= MAX_COMPARE_WITH ? `Up to ${MAX_COMPARE_WITH} campaigns can be compared at once` : undefined}
        >
          {saving ? 'Saving…' : '+ Add campaign to compare'}
        </button>
      </div>
      {!project.competitors && (
        <p className={`${SMALL} text-amber-600 mb-3`}>No competitor data yet — run (or re-run) Research to populate competitor columns.</p>
      )}

      {maxRows === 0 ? (
        <EmptyStateCard
          tone="blue"
          icon={GitCompare}
          title="Nothing to compare yet"
          description="This shelf lines up your new creative set against your current listing and competitors, row by image position — add product photos or generated images, and run research to bring in competitor listings."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link className={BTN} to="../listing">Go to Listing &amp; Images</Link>
              <Link className={BTN} to="../research">Go to Research</Link>
            </div>
          }
        />
      ) : (
        <div className={SHELF_WRAP}>
          <table className={SHELF_TABLE}>
            <thead>
              <tr>
                <th className={`${SHELF_CELL} ${SHELF_ROW_HEAD_TOPLEFT}`}>Image Position</th>
                {columns.map((c) => (
                  <th key={c.key} className={`${SHELF_CELL} ${SHELF_HEAD_STICKY}`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={c.highlight ? BADGE_GOOD : BADGE}>{c.label}</span>
                      {c.onRemove && (
                        <button
                          type="button"
                          onClick={c.onRemove}
                          disabled={saving}
                          aria-label={`Remove ${c.sublabel} from comparison`}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                    <div className={`${MUTED} ${SMALL} ${SHELF_SUBLABEL}`}>
                      {c.asin ? (
                        <a
                          href={amazonUrl(c.asin, project.marketplace)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                        >
                          {c.asin} <ExternalLink size={10} />
                        </a>
                      ) : (
                        c.sublabel
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, i) => (
                <tr key={i} className="even:bg-slate-50 hover:bg-brand-50">
                  <th className={`${SHELF_CELL} ${SHELF_ROW_HEAD}`}>{rowLabel(i)}</th>
                  {columns.map((c) => (
                    <td key={c.key} className={SHELF_CELL}>
                      {c.images[i] ? (
                        <div className={SHELF_IMAGE_CELL}>
                          <img src={c.images[i]} alt="" className="w-full h-full object-cover block" />
                          {c.counts?.[i] && <span className={SHELF_COUNT_BADGE}>{c.counts[i]}</span>}
                        </div>
                      ) : (
                        <div
                          className={`${SHELF_IMAGE_CELL} bg-slate-50`}
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 8px, #f8fafc 8px, #f8fafc 16px)',
                          }}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {picker && (
        <Modal onClose={() => setPicker(false)}>
          <h2 className="text-lg font-medium mb-3">Add a campaign to compare</h2>
          <div className={GRID_CARDS}>
            {pickerCandidates.map((p) => (
              <div key={p.id} className={`${PROJECT_CARD} cursor-pointer`} onClick={() => void addProject(p.id)}>
                {p.images[0] ? (
                  <img src={p.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover bg-white border border-slate-200 flex-shrink-0" />
                ) : (
                  <div className={THUMB_PLACEHOLDER} />
                )}
                <div>
                  <strong className="text-slate-900">{p.input.name}</strong>
                  <div className={`${MUTED} ${SMALL}`}>
                    {p.input.brand}
                    {p.sourceAsin ? ` · ASIN ${p.sourceAsin}` : ''}
                  </div>
                </div>
              </div>
            ))}
            {allProjects && pickerCandidates.length === 0 && <p className={MUTED}>No other campaigns to add.</p>}
          </div>
          <button className={BTN} onClick={() => setPicker(false)}>
            Close
          </button>
        </Modal>
      )}
    </div>
  );
}
