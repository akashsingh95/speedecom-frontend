import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Mic, ChevronRight, HelpCircle, CheckCircle2, Circle } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { StatTile, toneForValue } from '../../../components/listingStudio/ui/StatTile';
import {
  PAGE_HEAD,
  PAGE_TITLE,
  MUTED,
  SMALL,
  BTN_PRIMARY,
  BTN,
  EMPTY_STATE,
  STAT_TILES_GRID,
  READINESS_CATEGORIES,
  READINESS_ROW,
} from '../../../components/listingStudio/ui/classNames';

// Mirrors the 5 StatTiles the real dashboard renders once analysis completes (see the
// readiness.* block below) — shown greyed out beforehand so the page previews its own final
// shape instead of just saying "not analyzed yet" over blank space.
const PLACEHOLDER_METRICS = [
  'Your Text Coverage',
  'Your Image Coverage',
  'Competitor Avg Text',
  'Competitor Avg Images',
  'Image Coverage (After Campaign)',
];

// Ported from speed-listing's pages/project/AlexaReadinessPage.tsx — score dashboard for
// how well the listing answers Amazon's shopping-AI questions vs. competitors. Restyled to
// color every number by how good it actually is (green/amber/red) instead of a fixed hue per
// metric, and clicking a column's number now surfaces a plain-language explanation of what
// that number means, instead of only being able to expand the raw question list.

const COLUMNS = [
  { key: 'yourText', header: 'Text', title: 'Your text coverage', body: (v) => `${v}% of this category's questions are answered by your current listing copy (title, bullets, description).` },
  { key: 'yourImage', header: 'Images', title: 'Your image coverage', body: (v) => `${v}% of this category's questions are answered by your current product images.` },
  { key: 'competitorText', header: 'Comp. text', title: 'Competitor text coverage', body: (v) => `${v}% of this category's questions are answered by competitors' listing copy, on average.` },
  { key: 'competitorImage', header: 'Comp. images', title: 'Competitor image coverage', body: (v) => `${v}% of this category's questions are answered by competitors' product images, on average.` },
  { key: 'afterCampaignImage', header: 'After campaign', title: 'Projected coverage', body: (v) => `${v}% of this category's questions are expected to be answered once this campaign's generated visuals are live.` },
];

function clampPct(v) {
  return Math.max(0, Math.min(100, v));
}

/** One metric's bar+number for a category row. Clicking it opens a small explanation popover
 *  right below it (closes on a second click, or when another column/row is opened) — it never
 *  toggles the row's own expand/collapse, even though it lives inside the row's clickable header. */
function MetricCell({ column, value, open, onToggle, onExpandQuestions }) {
  const tone = toneForValue(value);
  const barColor = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }[tone];
  const textColor = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600' }[tone];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-100 transition-colors"
        title={`${column.title}: ${value}%`}
      >
        <div className="w-[60px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${clampPct(value)}%` }} />
        </div>
        <span className={`text-xs font-semibold w-[26px] text-right ${textColor}`}>{value}</span>
      </button>

      {open && (
        <div
          className="absolute z-20 top-full right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <HelpCircle size={13} className="text-slate-400" />
            <strong className="text-sm text-slate-900">{column.title}</strong>
          </div>
          <p className="text-[13px] text-slate-600 leading-snug">{column.body(value)}</p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onExpandQuestions();
            }}
            className="text-xs text-brand-600 hover:underline mt-2"
          >
            Expand to see per-question evidence →
          </button>
        </div>
      )}
    </div>
  );
}

export default function AlexaReadinessPage() {
  const { project, jobRunning, watchJob } = useProjectCtx();
  const [expanded, setExpanded] = useState(() => new Set());
  const [openPopover, setOpenPopover] = useState(null); // `${categoryName}:${columnKey}` or null
  const readiness = project.alexaReadiness;

  useEffect(() => {
    if (!openPopover) return undefined;
    const close = () => setOpenPopover(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openPopover]);

  const analyze = async () => {
    try {
      await listingStudioApi.startAlexaReadiness(project.id);
      watchJob();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  const toggleCategory = (name) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const missingListing = !project.listing;
  const missingCompetitors = !project.competitors?.length;
  const blocked = missingListing || missingCompetitors;

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 grid place-items-center flex-shrink-0">
              <Mic size={16} />
            </span>
            <h1 className={PAGE_TITLE}>Alexa Shopping Readiness</h1>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Beta</span>
          </div>
          <p className={`${MUTED} mt-1`}>
            How well your listing answers the questions Amazon&apos;s shopping AI asks about your product — compared
            to your competitors.
          </p>
        </div>
        <button className={`${BTN_PRIMARY} gap-1.5`} onClick={analyze} disabled={jobRunning || blocked}>
          {jobRunning ? (
            'Analyzing…'
          ) : readiness ? (
            <>
              <RefreshCw size={16} /> Re-analyze
            </>
          ) : (
            <>
              <Mic size={16} /> Analyze Shopping Readiness
            </>
          )}
        </button>
      </div>
      {blocked && (
        <div className={`${EMPTY_STATE} !py-14`}>
          <span className="inline-grid w-14 h-14 rounded-2xl place-items-center mb-4 text-white shadow-sm ring-8 ring-violet-100 bg-gradient-to-br from-violet-400 to-violet-500">
            <Mic size={24} />
          </span>
          <h2 className="text-lg font-semibold text-slate-900 mb-1.5">Not ready to analyze yet</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-5">
            Shopping Readiness compares your listing&apos;s text and images against your competitors&apos;, so it
            needs both in place first.
          </p>
          <div className="flex flex-col items-center gap-1.5 mb-6">
            <span className={`inline-flex items-center gap-1.5 text-sm ${missingListing ? 'text-amber-600' : 'text-emerald-600'}`}>
              {missingListing ? <Circle size={15} /> : <CheckCircle2 size={15} />} Listing copy
            </span>
            <span className={`inline-flex items-center gap-1.5 text-sm ${missingCompetitors ? 'text-amber-600' : 'text-emerald-600'}`}>
              {missingCompetitors ? <Circle size={15} /> : <CheckCircle2 size={15} />} Competitor research
            </span>
          </div>
          <Link className={BTN} to={missingListing ? '../listing' : '../research'}>
            {missingListing ? 'Go to Listing & Images' : 'Go to Research'}
          </Link>
        </div>
      )}

      {!readiness && !blocked && (
        <>
          <div className={STAT_TILES_GRID}>
            {PLACEHOLDER_METRICS.map((label) => (
              <StatTile key={label} tone="slate" value="—" label={label} />
            ))}
          </div>
          <p className={MUTED}>Not analyzed yet — click &quot;Analyze Shopping Readiness&quot; above.</p>
        </>
      )}

      {readiness && (
        <>
          <div className={STAT_TILES_GRID}>
            <StatTile tone={toneForValue(readiness.yourTextCoverage)} value={`${readiness.yourTextCoverage}%`} progress={readiness.yourTextCoverage} label="Your Text Coverage" />
            <StatTile tone={toneForValue(readiness.yourImageCoverage)} value={`${readiness.yourImageCoverage}%`} progress={readiness.yourImageCoverage} label="Your Image Coverage" />
            <StatTile
              tone={toneForValue(readiness.competitorTextCoverage)}
              value={`${readiness.competitorTextCoverage}%`}
              progress={readiness.competitorTextCoverage}
              label="Competitor Avg Text"
            />
            <StatTile
              tone={toneForValue(readiness.competitorImageCoverage)}
              value={`${readiness.competitorImageCoverage}%`}
              progress={readiness.competitorImageCoverage}
              label="Competitor Avg Images"
            />
            <StatTile
              tone={toneForValue(readiness.afterCampaignImageCoverage)}
              value={`${readiness.afterCampaignImageCoverage}%`}
              progress={readiness.afterCampaignImageCoverage}
              label="Image Coverage (After Campaign)"
            />
          </div>
          <p className={`${MUTED} ${SMALL}`}>Based on {readiness.totalQuestions} questions across all categories</p>

          {/* Column legend — bare numbers in each row aren't self-explanatory, so label the columns once up top. */}
          <div className="hidden md:flex items-center gap-3 flex-wrap ml-auto pr-1 pb-1.5 justify-end text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            {COLUMNS.map((c) => (
              <span key={c.key} className="w-[86px] text-right">
                {c.header}
              </span>
            ))}
          </div>

          <div className={READINESS_CATEGORIES}>
            {readiness.categories.map((c) => {
              const isOpen = expanded.has(c.name);
              return (
                <div key={c.name} className={READINESS_ROW}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleCategory(c.name)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCategory(c.name)}
                    className="flex items-center gap-3 flex-wrap cursor-pointer"
                  >
                    <ChevronRight size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <strong className="text-slate-900">{c.name}</strong>
                    <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                      {c.questions.length} questions
                    </span>
                    <div className="flex gap-3 flex-wrap ml-auto">
                      {COLUMNS.map((col) => {
                        const key = `${c.name}:${col.key}`;
                        return (
                          <div key={col.key} className="w-[86px] flex justify-end">
                            <MetricCell
                              column={col}
                              value={c[col.key]}
                              open={openPopover === key}
                              onToggle={() => setOpenPopover((cur) => (cur === key ? null : key))}
                              onExpandQuestions={() => {
                                setOpenPopover(null);
                                setExpanded((s) => new Set(s).add(c.name));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {isOpen && (
                    <ul className="mt-2.5 ml-[28px] text-slate-500 text-[13px] list-disc">
                      {c.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
