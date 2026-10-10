/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, GitCompare } from 'lucide-react';
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

/** For each gallery position, pick the newest final (else newest draft) and report how many candidates share that slot. */
function bestByPosition(images) {
  const byPosition = new Map();
  for (const img of images) {
    const pos = img.position ?? 0;
    const group = byPosition.get(pos) ?? [];
    group.push(img);
    byPosition.set(pos, group);
  }
  const maxPos = byPosition.size ? Math.max(...byPosition.keys()) : -1;
  const paths = [];
  const counts = [];
  for (let p = 0; p <= maxPos; p++) {
    const group = byPosition.get(p) ?? [];
    counts.push(group.length > 1 ? group.length : undefined);
    if (group.length === 0) {
      paths.push(undefined);
      continue;
    }
    const finals = group.filter((g) => g.quality === 'final');
    const pool = finals.length > 0 ? finals : group;
    paths.push(pool.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).path);
  }
  return { images: paths, counts };
}

function generatedColumn(p, label) {
  const { images, counts } = bestByPosition(p.generatedImages ?? []);
  return { key: `gen-${p.id}`, label, sublabel: p.input.name, images, counts, highlight: true };
}

export default function ComparisonShelfPage() {
  const { project } = useProjectCtx();
  const [extraProjects, setExtraProjects] = useState([]);
  const [picker, setPicker] = useState(false);
  const [allProjects, setAllProjects] = useState(null);

  useEffect(() => {
    if (picker && !allProjects) {
      // The shared axios instance's response interceptor already shows a toast on failure.
      listingStudioApi.listProjects().then((data) => setAllProjects(data.projects), () => {});
    }
  }, [picker, allProjects]);

  const addProject = async (id) => {
    setPicker(false);
    try {
      const full = await listingStudioApi.getProject(id);
      setExtraProjects((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, full]));
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
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
    for (const p of extraProjects) cols.push(generatedColumn(p, 'Previous Campaign'));
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
        <button className={BTN} onClick={() => setPicker(true)}>
          + Add campaign to compare
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
                    <span className={c.highlight ? BADGE_GOOD : BADGE}>{c.label}</span>
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
