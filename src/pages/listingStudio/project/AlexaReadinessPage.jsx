/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, ChevronRight, HelpCircle, CheckCircle2, Circle } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { toneForValue } from '../../../components/listingStudio/ui/StatTile';
import {
  PAGE_HEAD,
  PAGE_TITLE,
  CARD_TITLE,
  MUTED,
  BTN_PRIMARY,
  BTN,
  EMPTY_STATE,
  READINESS_SUMMARY_GRID,
  READINESS_SUMMARY_CARD,
  READINESS_CARD_VARIANTS,
  READINESS_CARD_LABEL,
  READINESS_BIG_VALUE,
  READINESS_PILL,
  READINESS_TABLE_CARD,
  READINESS_TABLE,
  READINESS_TH,
  READINESS_TD,
  READINESS_MINI_BAR,
} from '../../../components/listingStudio/ui/classNames';

// Ported from speed-listing's pages/project/AlexaReadinessPage.tsx — score dashboard for
// how well the listing answers Amazon's shopping AI questions vs. competitors. The two
// headline numbers (text + image coverage) each get their own card that plots you against
// the competitor average on one bar, so the gap is the thing you read first; everything
// else lives in the per-category table below.

const COLUMNS = [
  { key: 'yourText', header: 'Text', title: 'Your text coverage', body: (v) => `${v}% of this category's questions are answered by your current listing copy (title, bullets, description).` },
  { key: 'yourImage', header: 'Images', title: 'Your image coverage', body: (v) => `${v}% of this category's questions are answered by your current product images.` },
  { key: 'competitorText', header: 'Comp. text', title: 'Competitor text coverage', body: (v) => `${v}% of this category's questions are answered by competitors' listing copy, on average.` },
  { key: 'competitorImage', header: 'Comp. images', title: 'Competitor image coverage', body: (v) => `${v}% of this category's questions are answered by competitors' product images, on average.` },
  { key: 'afterCampaignImage', header: 'After campaign', title: 'Projected coverage', body: (v) => `${v}% of this category's questions are expected to be answered once this campaign's generated visuals are live.` },
];

// Every column — competitor ones included — is coloured by the same legend printed above
// the table, so a number reads the same way wherever it appears: 70+ green, 40-69 amber.
const TONE_BAR = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', empty: 'bg-slate-200' };
const TONE_TEXT = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', empty: 'text-slate-300' };
const LEGEND = [
  { tone: 'green', label: '70+ strong' },
  { tone: 'amber', label: '40–69 partial' },
  { tone: 'red', label: 'Under 40 gap' },
];

function clampPct(v) {
  return Math.max(0, Math.min(100, v));
}

function toneFor(value) {
  if (value === null || value === undefined) return 'empty';
  return toneForValue(value);
}

function stripes(hex) {
  return { backgroundImage: `repeating-linear-gradient(45deg, ${hex} 0 3px, transparent 3px 6px)` };
}

function LegendSwatch({ barClass, hex, striped, marker }) {
  if (marker) return <span className="w-[3px] h-2.5 rounded-full bg-slate-900 flex-shrink-0" />;
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${striped ? '' : barClass}`}
      style={striped ? stripes(hex) : undefined}
    />
  );
}

/** One headline coverage number: your score, the competitor average marked on the same bar,
 *  and (for images) the striped segment this campaign's generated visuals are projected to
 *  add. `variant` is a fixed hue per card (never the score's green/amber/red — how you're
 *  doing is in the pill and in how far the bar falls short of the competitor marker), so the
 *  row reads as one set of tiles like Research's. `value === null` is the pre-analysis shape. */
function CoverageCard({ variant, label, value, competitor, projected, projectedLabel }) {
  const v = READINESS_CARD_VARIANTS[variant];
  const diff = value === null ? null : value - competitor;
  const showProjected = projected !== undefined && projected !== null && value !== null && projected > value;

  return (
    <div className={`${READINESS_SUMMARY_CARD} ${v.tile}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={READINESS_CARD_LABEL}>{label}</span>
        {diff !== null && (
          <span
            className={`${READINESS_PILL} bg-white/70 ${
              diff < 0 ? 'text-red-600' : diff > 0 ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            {diff === 0 ? 'Matches competitors' : `${Math.abs(diff)} pts ${diff < 0 ? 'below' : 'above'} competitors`}
          </span>
        )}
      </div>

      <strong className={`${READINESS_BIG_VALUE} ${value === null ? 'text-slate-400' : v.text}`}>
        {value === null ? '—' : `${value}%`}
      </strong>

      <div className="relative h-3 flex items-center">
        <div className="relative h-2 w-full rounded-full bg-black/[0.07] overflow-hidden">
          {showProjected && (
            <span
              className="absolute inset-y-0"
              style={{ left: `${clampPct(value)}%`, width: `${clampPct(projected) - clampPct(value)}%`, ...stripes(v.hex) }}
            />
          )}
          {value !== null && <span className={`absolute inset-y-0 left-0 ${v.bar}`} style={{ width: `${clampPct(value)}%` }} />}
        </div>
        {competitor !== null && competitor !== undefined && (
          <span
            className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-slate-900"
            style={{ left: `${clampPct(competitor)}%` }}
            title={`Competitor avg ${competitor}%`}
          />
        )}
      </div>

      {value !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <LegendSwatch barClass={v.bar} /> You {value}%
          </span>
          {showProjected && (
            <span className="inline-flex items-center gap-1.5">
              <LegendSwatch hex={v.hex} striped /> {projectedLabel} {projected}%
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <LegendSwatch marker /> Competitor avg {competitor}%
          </span>
        </div>
      )}
    </div>
  );
}

/** One metric's number+bar inside a category row. Clicking it opens a small explanation
 *  popover below it (closes on a second click, or when another cell is opened) — it never
 *  toggles the row's own expand/collapse, which has its own button in the first column. */
function MetricCell({ column, value, open, onToggle, onExpandQuestions }) {
  const tone = toneFor(value);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="block w-[108px] max-w-full text-left rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-slate-100"
        title={`${column.title}: ${value}%`}
      >
        <span className={`text-sm font-semibold ${TONE_TEXT[tone]}`}>{value}</span>
        <span className={`block ${READINESS_MINI_BAR}`}>
          <span className={`block h-full ${TONE_BAR[tone]}`} style={{ width: `${clampPct(value)}%` }} />
        </span>
      </button>

      {open && (
        <div
          className="absolute z-20 top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 text-left"
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
              e.stopPropagation();
              onExpandQuestions();
            }}
            className="text-xs text-brand-600 hover:underline mt-2"
          >
            Expand to see per-question evidence →
          </button>
        </div>
      )}
    </>
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
          <p className={`${MUTED} mt-1 max-w-xl`}>
            How well your listing answers the questions Amazon&apos;s shopping AI asks about your product, compared
            to your competitors.
          </p>
        </div>
        {!readiness && (
          <button className={`${BTN_PRIMARY} gap-1.5`} onClick={analyze} disabled={jobRunning || blocked}>
            {jobRunning ? (
              'Analyzing…'
            ) : (
              <>
                <Mic size={16} /> Analyze Shopping Readiness
              </>
            )}
          </button>
        )}
      </div>

      {blocked && (
        <div className={`${EMPTY_STATE} !py-14`}>
          <span className="inline-grid w-14 h-14 rounded-2xl place-items-center mb-4 text-white shadow-sm ring-8 ring-violet-100 bg-gradient-to-br from-violet-400 to-violet-500">
            <Mic size={24} />
          </span>
          <h2 className={`${CARD_TITLE} mb-1.5`}>Not ready to analyze yet</h2>
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

      {!blocked && (
        <>
          {/* Shown greyed out before the first run too, so the page previews its own final
              shape instead of saying "not analyzed yet" over blank space. */}
          <div className={READINESS_SUMMARY_GRID}>
            <CoverageCard
              variant="violet"
              label="Text coverage"
              value={readiness ? readiness.yourTextCoverage : null}
              competitor={readiness ? readiness.competitorTextCoverage : null}
            />
            <CoverageCard
              variant="blue"
              label="Image coverage"
              value={readiness ? readiness.yourImageCoverage : null}
              competitor={readiness ? readiness.competitorImageCoverage : null}
              projected={readiness ? readiness.afterCampaignImageCoverage : null}
              projectedLabel="After campaign"
            />
            <div className={`${READINESS_SUMMARY_CARD} ${READINESS_CARD_VARIANTS.green.tile}`}>
              <span className={READINESS_CARD_LABEL}>Question set</span>
              <div className="flex items-baseline gap-2">
                <strong className={`${READINESS_BIG_VALUE} ${READINESS_CARD_VARIANTS.green.text}`}>
                  {readiness ? readiness.totalQuestions : '—'}
                </strong>
                <span className="text-sm text-slate-500">questions</span>
              </div>
              <p className="text-[12px] text-slate-500 leading-snug mt-auto pt-1">
                {readiness
                  ? `Across ${readiness.categories.length} categories, scored on text and image coverage.`
                  : 'Not analyzed yet — run the analysis to score your listing against your competitors.'}
              </p>
            </div>
          </div>

          {readiness && (
            <div className={READINESS_TABLE_CARD}>
              <div className="flex items-start justify-between gap-3 flex-wrap px-3.5 pt-4 pb-3">
                <div>
                  <h2 className={CARD_TITLE}>Coverage by category</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Based on {readiness.totalQuestions} questions across {readiness.categories.length} categories
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                  {LEGEND.map((l) => (
                    <span key={l.tone} className="inline-flex items-center gap-1.5">
                      <LegendSwatch barClass={TONE_BAR[l.tone]} /> {l.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className={READINESS_TABLE}>
                  <thead>
                    <tr>
                      <th className={`${READINESS_TH} w-[200px]`}>Category</th>
                      {COLUMNS.map((col) => (
                        <th key={col.key} className={READINESS_TH}>
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {readiness.categories.map((c) => {
                      const isOpen = expanded.has(c.name);
                      return (
                        <React.Fragment key={c.name}>
                          <tr className="transition-colors hover:bg-slate-50/70">
                            <td className={READINESS_TD}>
                              <button
                                type="button"
                                onClick={() => toggleCategory(c.name)}
                                className="flex items-start gap-1.5 text-left"
                              >
                                <ChevronRight
                                  size={15}
                                  className={`mt-0.5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                />
                                <span>
                                  <strong className="block text-[13px] font-semibold text-slate-900">{c.name}</strong>
                                  <span className="text-[11px] text-slate-400">{c.questions.length} questions</span>
                                </span>
                              </button>
                            </td>
                            {COLUMNS.map((col) => {
                              const key = `${c.name}:${col.key}`;
                              return (
                                <td key={col.key} className={`${READINESS_TD} relative`}>
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
                                </td>
                              );
                            })}
                          </tr>
                          {isOpen && (
                            <tr>
                              <td className="px-3.5 pb-3 border-b border-slate-100" colSpan={COLUMNS.length + 1}>
                                <ul className="ml-6 text-slate-500 text-[13px] list-disc">
                                  {c.questions.map((q, i) => (
                                    <li key={i}>{q}</li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
