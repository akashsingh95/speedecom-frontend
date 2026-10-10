import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Puzzle, Image as ImageIcon } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { useProjectCtx } from '../../../components/listingStudio/context';
import {
  PAGE_HEAD, PAGE_TITLE, MUTED, BTN, BTN_PRIMARY, ICON_LABEL, GRID_CARDS, CARD, BADGE,
  TABLE_WRAP, TABLE, TH, TD, SLOT, SLOT_EMPTY, PILL_BTN_AMBER,
} from '../../../components/listingStudio/ui/classNames';

const PLACEHOLDER_CONCEPT_COUNT = 3;

/** Ported from speed-listing's pages/project/AplusPage.tsx. */
export default function AplusPage() {
  const { project, jobRunning, watchJob } = useProjectCtx();
  const [compare, setCompare] = useState(false);
  const concepts = project.aplus?.concepts ?? [];

  const generate = async () => {
    try {
      await listingStudioApi.startAplus(project.id);
      watchJob();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  const moduleLabel = (type) => type.replace('STANDARD_', '').replaceAll('_', ' ').toLowerCase();

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
          {concepts.length > 1 && (
            <button type="button" className={BTN} onClick={() => setCompare(!compare)}>
              {compare ? 'Card view' : 'Compare side-by-side'}
            </button>
          )}
          <button type="button" className={BTN_PRIMARY} onClick={generate} disabled={jobRunning}>
            {jobRunning ? (
              'Generating…'
            ) : concepts.length ? (
              'Regenerate concepts'
            ) : (
              <span className={ICON_LABEL}>
                <Sparkles size={16} /> Generate 3 concepts
              </span>
            )}
          </button>
        </div>
      </div>
      {!project.imageLibrary?.entries?.length && (
        <p className={`${MUTED} mb-3`}>
          Photo analysis runs automatically after market research — once it's done, concepts will pick accurate image
          references from it. If you don't see it yet, check the{' '}
          <Link className="text-brand-600 underline" to="../listing">Listing &amp; Images</Link> page.
        </p>
      )}

      {/* Previews the grid the real concept cards will land in once generated — one slot per
       *  concept the pipeline is about to produce, each with its own "Generate" pill, rather
       *  than a single generic message floating in an otherwise-blank page. All 3 pills trigger
       *  the same batch generate() (concepts are always generated together, never one at a
       *  time), same as the header's own "Generate 3 concepts" button. */}
      {concepts.length === 0 && !jobRunning && (
        <div className={GRID_CARDS}>
          {Array.from({ length: PLACEHOLDER_CONCEPT_COUNT }, (_, i) => (
            <div key={i} className={`${CARD} flex flex-col h-full`}>
              <div className={SLOT} style={{ aspectRatio: '4/3' }}>
                <div className={SLOT_EMPTY}>
                  <div className="flex flex-col items-center gap-1.5">
                    <ImageIcon size={22} className="text-slate-400" />
                    <span>Not generated yet</span>
                    <button type="button" className={PILL_BTN_AMBER} onClick={generate}>
                      <Sparkles size={12} /> Generate
                    </button>
                  </div>
                </div>
              </div>
              <p className={`${MUTED} text-sm text-center mt-3`}>Concept {i + 1}</p>
            </div>
          ))}
        </div>
      )}

      {concepts.length > 0 && !compare && (
        <div className={GRID_CARDS}>
          {concepts.map((c) => (
            <div key={c.id} className={`${CARD} flex flex-col h-full`}>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">{c.name}</h2>
                <p className={`${MUTED} text-sm mb-2`}>{c.rationale}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {c.modules.map((m, i) => (
                    <span key={i} className={BADGE} title={Object.values(m.fields ?? {})[0] ?? ''}>
                      {moduleLabel(m.type)}
                    </span>
                  ))}
                </div>
                <div className={`${MUTED} text-xs mb-3`}>
                  {c.modules.length} modules ·{' '}
                  {c.modules.reduce((n, m) => n + m.images.filter((s) => s.path).length, 0)}/
                  {c.modules.reduce((n, m) => n + m.images.length, 0)} images attached
                </div>
              </div>
              <Link className={`${BTN_PRIMARY} w-full`} to={`../editor/${c.id}`}>
                Open in Module Editor
              </Link>
            </div>
          ))}
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
                    {c.modules.map((m) => m.fields.headline).find(Boolean) ?? '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th className={TH} />
                {concepts.map((c) => (
                  <td key={c.id} className={TD}>
                    <Link className={BTN} to={`../editor/${c.id}`}>Edit</Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
