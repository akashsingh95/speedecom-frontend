import { useState } from 'react';
import { Search, CheckCircle2, BarChart3, ThumbsUp, AlertTriangle, Lightbulb, LayoutGrid, Heart, ExternalLink, Star, Users, Leaf, DollarSign, Brain, ZoomIn, LineChart } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { amazonUrl } from '../../../components/listingStudio/helpers';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { SentimentDonut, DemographicsBars } from '../../../components/listingStudio/charts';
import { TrendChart } from '../../../components/listingStudio/KeywordTrendChart';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import CompetitorPicker from '../../../components/listingStudio/CompetitorPicker';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import { ImageLightbox } from '../../../components/listingStudio/ui/ImageLightbox';
import {
  PAGE_HEAD, CARD_TITLE, MUTED, SMALL, ICON_LABEL, CARD,
  BTN_PRIMARY, BADGE, SERP_GRID, SERP_ITEM, SERP_IMG, SERP_THUMB_EMPTY,
  SERP_TITLE, SERP_YOU, STAT_TILES_GRID, STAT_TILE, STAT_TILE_VALUE, STAT_TILE_LABEL, STAT_TILE_VARIANTS,
  DASH_GRID, THEME_COLS, THEME_COL_GOOD, THEME_COL_BAD, THEME_COL_BLUE, THEME_ITEM,
} from '../../../components/listingStudio/ui/classNames';

/** Splits the AI pricing insight into bullet points: one per line when the model returned
 *  newline-separated takeaways, otherwise one per sentence (older research saved as a single
 *  paragraph). The sentence split only breaks after `.!?` followed by whitespace and a capital,
 *  so prices like "$19.99" stay intact. */
function toBulletPoints(text) {
  if (!text) return [];
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
}

/** ASIN badge that links out to the real Amazon product page — used everywhere an ASIN
 *  is shown standalone (not already part of a bigger "open this listing" link). */
function AsinLink({ asin, marketplace, className = '' }) {
  return (
    <a
      href={amazonUrl(asin, marketplace)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-brand-600 hover:underline ${className}`}
    >
      {asin} <ExternalLink size={11} />
    </a>
  );
}

// Ported from speed-listing's pages/project/ResearchPage.tsx — trigger + results view
// for the market-research pipeline (Bright Data scrape + OpenAI synthesis).

/** Turns Amazon's bucketed sales text into a unit count, using the lower bound ("4K+" -> 4000,
 *  "1.5K+" -> 1500, "2,000+" -> 2000). Returns undefined when there's no usable number. */
function parseBoughtCount(text) {
  const m = String(text ?? '').match(/([\d.,]+)\s*([KkMm])?\+?/);
  if (!m) return undefined;
  const base = parseFloat(m[1].replace(/,/g, ''));
  if (!isFinite(base)) return undefined;
  const multiplier = { k: 1_000, m: 1_000_000 }[(m[2] || '').toLowerCase()] ?? 1;
  return base * multiplier;
}


export default function ResearchPage() {
  const { project, job, jobRunning, watchJob, setResearchContinue } = useProjectCtx();
  const r = project.research;
  const meta = project.researchMeta;
  const isAwaitingSelection = job?.status === 'awaiting_selection';
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [trendKeyword, setTrendKeyword] = useState(null);


  // A concept's A+ overlay image lives at modules[].images[].path, keyed by module type/slot —
  // same lookup AplusPage uses, kept local here since this is the only other place a concept's
  // image needs opening (Research page's pain-point "Addressed by" row).
  const conceptOverlayPath = (concept) => {
    const module = concept.modules?.find((m) => m.type === 'STANDARD_IMAGE_TEXT_OVERLAY');
    return module?.images?.find((s) => s.key === 'main')?.path ?? null;
  };

  // buyerPsychology briefly shipped as {psychographics, buyingBehavior} before settling on a
  // single blended string — old stored research can still have that shape, so tolerate both
  // rather than rendering an object directly (React throws on that).
  const buyerPsychologyText =
    typeof r?.buyerPsychology === 'string'
      ? r.buyerPsychology
      : [r?.buyerPsychology?.psychographics, r?.buyerPsychology?.buyingBehavior].filter(Boolean).join(' ') || null;

  // r.competitorInsights (LLM-synthesized) has no brand field — pull it from the raw
  // scraped competitors saved alongside research, keyed by ASIN.
  const brandByAsin = Object.fromEntries((project.competitors ?? []).map((c) => [c.asin, c.brand]));
   // Amazon's bucketed monthly sales text per competitor, e.g. "4K+ bought in past month".
  const boughtByAsin = Object.fromEntries((project.competitors ?? []).map((c) => [c.asin, c.boughtPastMonth]));
  // Market share: each competitor's share of the analyzed set's total monthly units (lower-bound count).
  const unitsByAsin = Object.fromEntries(
    (project.competitors ?? []).map((c) => [c.asin, parseBoughtCount(c.boughtPastMonth) ?? 0]),
  );
  // Numeric price per ASIN, from the saved competitors (r.competitorInsights stores it as text with a currency sign).
  const priceByAsin = Object.fromEntries((project.competitors ?? []).map((c) => [c.asin, Number(c.price)]));
  const totalCompetitorUnits = r
    ? r.competitorInsights.reduce((sum, c) => sum + (unitsByAsin[c.asin] || 0), 0)
    : 0;

  // Pricing card's price-ladder strip — competitor prices plus this project's own planned
  // price (project.input.price), highlighted. That field is optional and inconsistently
  // formatted (a bare number from manual campaign creation, or "USD 24.99" from ASIN import),
  // so it's parsed defensively and only shown when a numeric value can be recovered.
  const priceCurrency = (r?.competitorInsights?.[0]?.price ?? '').match(/^[^0-9.]+/)?.[0] ?? '';
  const ownPriceRaw = project.input?.price;
  const ownPriceValue = ownPriceRaw !== undefined ? parseFloat(String(ownPriceRaw).replace(/[^0-9.]/g, '')) : NaN;
  const priceLadder = r
    ? [
        ...r.competitorInsights.map((c) => ({
          key: c.asin,
          asin: c.asin,
          price: c.price,
          label: brandByAsin[c.asin] || c.title,
          value: parseFloat(String(c.price).replace(/[^0-9.]/g, '')) || 0,
          isYou: false,
        })),
        ...(!Number.isNaN(ownPriceValue)
          ? [
              {
                key: 'you',
                asin: null,
                price: /^[0-9.]+$/.test(String(ownPriceRaw).trim()) ? `${priceCurrency}${ownPriceRaw}` : String(ownPriceRaw),
                label: 'You',
                value: ownPriceValue,
                isYou: true,
              },
            ]
          : []),
      ].sort((a, b) => a.value - b.value)
    : [];

  const start = async () => {
    try {
      await listingStudioApi.startResearch(project.id);
      watchJob();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div>
          <p className={`${MUTED} flex items-center gap-1 flex-wrap`}>
            {project.input.brand} · {project.input.category}
            {project.sourceAsin && (
              <>
                {' '}· imported from ASIN <AsinLink asin={project.sourceAsin} marketplace={project.marketplace} />
              </>
            )}
          </p>
        </div>
        {!r && (
          <button className={BTN_PRIMARY} onClick={start} disabled={jobRunning || isAwaitingSelection}>
            {jobRunning ? (
              'Researching…'
            ) : (
              <span className={ICON_LABEL}>
                <Search size={16} /> Run market research
              </span>
            )}
          </button>
        )}
      </div>
      {isAwaitingSelection && job?.candidates && (
        <CompetitorPicker project={project} candidates={job.candidates} watchJob={watchJob} onContinueChange={setResearchContinue} />
      )}

      {!r && !jobRunning && !isAwaitingSelection && (
        <EmptyStateCard
          tone="blue"
          icon={Search}
          title="No market research yet"
          description="Scrape your top competitors, mine their reviews for pain points and motivations, and get a full market report — everything else in this campaign builds on it."
          features={[
            { icon: Users, label: 'Competitor analysis' },
            { icon: ThumbsUp, label: 'Customer sentiment' },
            { icon: LayoutGrid, label: 'SERP simulation' },
            { icon: Lightbulb, label: 'Keyword opportunities' },
          ]}
          action={
            <button type="button" className={BTN_PRIMARY} onClick={start}>
              <span className={ICON_LABEL}>
                <Search size={16} /> Run market research
              </span>
            </button>
          }
        />
      )}

      {r && (
        <>
          <div className={CARD}>
            <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
              <CheckCircle2 size={18} className="text-emerald-600" /> Analysis Complete
            </h2>
            <p>{r.marketSummary}</p>
            {meta && (
              <div className={STAT_TILES_GRID}>
                <div className={`${STAT_TILE} ${STAT_TILE_VARIANTS.violet.tile}`}>
                  <strong className={`${STAT_TILE_VALUE} ${STAT_TILE_VARIANTS.violet.text}`}>{meta.reviewsMined}</strong>
                  <span className={STAT_TILE_LABEL}>Reviews Analyzed</span>
                </div>
                <div className={`${STAT_TILE} ${STAT_TILE_VARIANTS.blue.tile}`}>
                  <strong className={`${STAT_TILE_VALUE} ${STAT_TILE_VARIANTS.blue.text}`}>{meta.competitorsAnalyzed}</strong>
                  <span className={STAT_TILE_LABEL}>Competitors Studied</span>
                </div>
                <div className={`${STAT_TILE} ${STAT_TILE_VARIANTS.green.tile}`}>
                  <strong className={`${STAT_TILE_VALUE} ${STAT_TILE_VARIANTS.green.text}`}>{r.motivations?.length ?? r.painPoints.length}</strong>
                  <span className={STAT_TILE_LABEL}>Customer Motivations</span>
                </div>
                <div className={`${STAT_TILE} ${STAT_TILE_VARIANTS.amber.tile}`}>
                  <strong className={`${STAT_TILE_VALUE} ${STAT_TILE_VARIANTS.amber.text}`}>{meta.dataPoints ?? meta.reviewsMined + meta.competitorsAnalyzed}</strong>
                  <span className={STAT_TILE_LABEL}>Data Points</span>
                </div>
              </div>
            )}
          </div>

          {(meta?.sentiment || r.demographics) && (
            <div className={CARD}>
              <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
                <BarChart3 size={18} /> Review Analysis Dashboard
              </h2>
              <div className={DASH_GRID}>
                {meta?.sentiment && (
                  <div>
                    <SentimentDonut {...meta.sentiment} />
                    <h3 className="text-base font-semibold text-slate-900 mt-3 text-center">Sentiment Distribution</h3>
                  </div>
                )}
                {r.demographics && (
                  <div>
                    <DemographicsBars brackets={r.demographics.brackets} />
                    <h3 className="text-base font-semibold text-slate-900 mt-3 text-center">Customer Demographics</h3>
                  </div>
                )}
              </div>
            </div>
          )}

          {(r.positiveThemes?.length || r.featureRequests?.length) && (
            <div className={THEME_COLS}>
              <div className={THEME_COL_GOOD}>
                <h3 className={`${ICON_LABEL} font-semibold text-emerald-700 mt-0 mb-3`}>
                  <ThumbsUp size={15} /> What customers love
                </h3>
                {(r.positiveThemes ?? []).map((t) => (
                  <div key={t.theme} className={`${THEME_ITEM} flex items-start gap-2`}>
                    <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <strong className="text-emerald-800 text-base">{t.theme}</strong>
                  </div>
                ))}
              </div>
              <div className={THEME_COL_BAD}>
                <h3 className={`${ICON_LABEL} font-semibold text-red-700 mt-0 mb-3`}>
                  <AlertTriangle size={15} /> Pain points
                </h3>
                {r.painPoints.map((p) => (
                  <div key={p.id ?? p.theme} className={`${THEME_ITEM} flex items-start gap-2`}>
                    <CheckCircle2 size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <strong className="text-red-800 text-base">{p.theme}</strong>
                  </div>
                ))}
              </div>
              <div className={THEME_COL_BLUE}>
                <h3 className={`${ICON_LABEL} font-semibold text-brand-700 mt-0 mb-3`}>
                  <Lightbulb size={15} /> Feature requests
                </h3>
                {(r.featureRequests ?? []).map((f) => (
                  <div key={f.request} className={`${THEME_ITEM} flex items-start gap-2`}>
                    <CheckCircle2 size={15} className="text-brand-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="text-brand-800 text-base">{f.request}</strong>
                      <p className="text-brand-700/70 text-base">{f.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.serp && project.serp.length > 0 && (
            <div className={CARD}>
              <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
                <LayoutGrid size={18} /> SERP Simulation
              </h2>
              <p className={`${MUTED} ${SMALL}`}>
                The search results your customers see for "{meta?.keywords[0]}" — with your listing's slot highlighted.
              </p>
              <div className={SERP_GRID}>
                <div className={`${SERP_ITEM} ${SERP_YOU} hover-lift hover:shadow-card-hover`}>
                  {project.images[0] ? <img src={project.images[0]} alt="" className={SERP_IMG} /> : <div className={SERP_THUMB_EMPTY}>Your images</div>}
                  <div className={SERP_TITLE}>{project.listing?.title ?? project.input.name}</div>
                  <span className={`${BADGE} border-emerald-600 bg-emerald-50 text-emerald-600`}>Your listing</span>
                </div>
                {project.serp.slice(0, 7).map((s) => (
                  <a key={s.asin} className={`${SERP_ITEM} hover-lift hover:shadow-card-hover hover:border-slate-300`} href={s.url} target="_blank" rel="noreferrer">
                    {s.imageUrl ? <img src={s.imageUrl} alt="" className={SERP_IMG} /> : <div className={SERP_THUMB_EMPTY} />}
                    <div className={SERP_TITLE}>{s.title}</div>
                    <div className={`${MUTED} ${SMALL}`}>
                      {s.rating !== undefined ? `★ ${s.rating}` : ''}
                      {s.reviewsCount !== undefined ? ` (${s.reviewsCount.toLocaleString()})` : ''}
                      {s.price !== undefined ? ` · ${s.currency ?? '$'}${s.price}` : ''}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className={CARD}>
            <h2 className={`${CARD_TITLE} mb-1`}>Competitors</h2>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full border-collapse text-base min-w-[720px] border border-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 w-[26%] border border-slate-200">Brand</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 border border-slate-200">Price</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 border border-slate-200">Rating</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 w-[32%] border border-slate-200">Strengths</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 border border-slate-200">Bought last month</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 border border-slate-200">Approx monthly sales</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 w-[20%] border border-slate-200">Market Share (depends on bought last month)</th>
                  </tr>
                </thead>
                <tbody>
                  {r.competitorInsights.map((c) => (
                    <tr key={c.asin} className="align-top hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4 border border-slate-200">
                        <div className="font-semibold text-slate-900 leading-snug">{brandByAsin[c.asin] || c.title}</div>
                        <div className={`${MUTED} ${SMALL} mt-0.5 leading-snug`}>{c.title}</div>
                        <AsinLink asin={c.asin} marketplace={project.marketplace} className="text-sm mt-1" />
                      </td>
                      <td className="py-4 px-4 text-slate-700 whitespace-nowrap border border-slate-200">{c.price}</td>
                      <td className="py-4 px-4 text-slate-700 whitespace-nowrap border border-slate-200">
                        <span className="inline-flex items-center gap-1">
                          <Star size={13} className="text-amber-500 fill-amber-500" /> {c.rating}
                        </span>
                      </td>
                      <td className="py-4 px-4 border border-slate-200">
                        <ul className="space-y-1">
                          {c.strengths.map((s) => (
                            <li key={s} className="flex items-start gap-1.5 text-slate-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" /> {s}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-4 px-4 border border-slate-200">
                        {boughtByAsin[c.asin] ? boughtByAsin[c.asin].replace(/\s*bought.*$/i, '') : <span className={MUTED}>—</span>}
                      </td>
                      <td className="py-4 px-4 text-slate-700 whitespace-nowrap border border-slate-200 tabular-nums">
                        {(() => {
                          const units = unitsByAsin[c.asin];
                          const price = priceByAsin[c.asin];
                          return units && price > 0 ? `${priceCurrency}${Math.round(units * price).toLocaleString('en-US')}` : <span className={MUTED}>—</span>;
                        })()}
                      </td>
                      <td className="py-4 px-4 border border-slate-200">
                        {(() => {
                          const units = unitsByAsin[c.asin];
                          const pct = units && totalCompetitorUnits > 0 ? (units / totalCompetitorUnits) * 100 : null;
                          return pct === null ? <span className={MUTED}>—</span> : <span className="text-slate-700 font-medium">{pct.toFixed(1)}%</span>;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={CARD}>
            <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
              <AlertTriangle size={18} className="text-red-600" /> Top Customer Pain Points
            </h2>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
              {r.painPoints.map((pp) => {
                const addressingImages = pp.id ? (project.generatedImages ?? []).filter((img) => img.addressesPainPointIds?.includes(pp.id)) : [];
                const addressingConcepts = pp.id ? (project.aplus?.concepts ?? []).filter((c) => c.addressesPainPointIds?.includes(pp.id)) : [];
                return (
                  <div key={pp.id ?? pp.theme} className="bg-red-50 border border-slate-200 border-l-4 border-l-red-600 rounded-xl p-5 text-base leading-relaxed">
                    <div className={`${ICON_LABEL} mb-1.5`}>
                      <AlertTriangle size={16} className="text-red-700 flex-shrink-0" />
                      <strong className="text-red-700 text-lg">{pp.theme}</strong>
                    </div>
                    {pp.impact && (
                      <p className="mt-2">
                        <b className="text-red-700">Impact:</b> <span className="text-black">{pp.impact}</span>
                      </p>
                    )}
                    <p className="mt-1.5">
                      <b className="text-red-700">How to win:</b> <span className="text-black">{pp.howToAddress}</span>
                    </p>
                    {(addressingImages.length > 0 || addressingConcepts.length > 0) && (
                      <div className="mt-2.5 pt-2.5 border-t border-red-200">
                        <p className="text-sm font-medium text-red-700 mb-1.5">Addressed by</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {addressingImages.map((img) => (
                            <button
                              key={img.id}
                              type="button"
                              title={`Open generated image (${img.type})`}
                              onClick={() => setLightboxSrc(img.path)}
                              className="relative group w-8 h-8 rounded-md overflow-hidden border border-red-200 cursor-zoom-in"
                            >
                              <img src={img.path} alt={img.type} className="w-full h-full object-cover" />
                              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 grid place-items-center transition-colors">
                                <ZoomIn size={12} className="text-white opacity-0 group-hover:opacity-100" />
                              </span>
                            </button>
                          ))}
                          {addressingConcepts.map((c) => {
                            const overlayPath = conceptOverlayPath(c);
                            return overlayPath ? (
                              <button
                                key={c.id}
                                type="button"
                                title={`Open ${c.name}'s image`}
                                onClick={() => setLightboxSrc(overlayPath)}
                                className={`${BADGE} cursor-zoom-in hover:border-red-400 hover:text-red-600`}
                              >
                                {c.name}
                              </button>
                            ) : (
                              <span key={c.id} title={c.name} className={BADGE}>
                                {c.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

              {trendKeyword && meta?.keywordTrends?.[trendKeyword]?.length > 0 && (
            <Modal onClose={() => setTrendKeyword(null)}>
              <h2 className="text-lg font-semibold text-slate-900 mb-4 pr-8">{trendKeyword}</h2>
              <TrendChart points={meta.keywordTrends[trendKeyword]} />
            </Modal>
          )}


          {r.motivations && r.motivations.length > 0 && (
            <div className={CARD}>
              <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
                <Heart size={18} className="text-emerald-600" /> Primary Customer Motivations
              </h2>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
                {r.motivations.map((m) => (
                  <div key={m.motivation} className="bg-slate-50 border border-slate-200 border-l-4 border-l-emerald-500 rounded-xl p-5 text-base leading-relaxed">
                    <div className={`${ICON_LABEL} mb-1.5`}>
                      <Leaf size={16} className="text-emerald-600 flex-shrink-0" />
                      <strong className="text-emerald-700 text-lg">{m.motivation}</strong>
                    </div>
                    <p className="text-slate-700">{m.description}</p>
                    <p className="mt-1.5">
                      <b className="text-emerald-700">Frequency:</b> <span className="text-emerald-400">{m.frequency}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {meta?.topKeywords?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card mb-4">
              <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
                <Search size={16} className="text-brand-600" /> Top keywords by monthly searches
              </h2>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-10">
                {meta.topKeywords.map((k, i) => (
                  <li key={k.keyword} className="flex items-center gap-2.5 py-2.5 border-b border-slate-100">
                    <span className="w-5 text-sm font-semibold text-slate-400 tabular-nums">{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800" title={k.keyword}>
                      {k.keyword}
                    </span>
                    <span className="text-sm text-right tabular-nums font-semibold text-slate-900">
                      {k.searchVolume.toLocaleString('en-US')}
                    </span>
                    {meta?.keywordTrends?.[k.keyword]?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTrendKeyword(k.keyword)}
                        title={`Search trend for "${k.keyword}"`}
                        className="shrink-0 w-7 h-7 grid place-items-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <LineChart size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Shown only when DataForSEO produced no top keywords; otherwise the top-10 card above is the keyword list. */}
          {!(meta?.topKeywords?.length > 0) && (

          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5 shadow-card mb-4">
            <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
              <Search size={16} className="text-brand-600" /> Keywords &amp; guidance
            </h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr>
                    <th className="text-left pb-2.5 border-b border-slate-200 text-sm font-bold uppercase tracking-wide text-slate-500">
                      Keyword
                    </th>
                    <th className="text-left pb-2.5 border-b border-slate-200 text-sm font-bold uppercase tracking-wide text-slate-500">
                      Why it matters
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.keywordOpportunities.map((k) => (
                    <tr key={k.keyword} className="border-b border-slate-200/70 last:border-b-0">
                      <td className="py-3.5 pr-6 align-top whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 font-semibold text-blue-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-600 flex-shrink-0" aria-hidden="true" />
                          {k.keyword}
                        </span>
                      </td>
                      <td className="py-3.5 align-top text-slate-700">{k.rationale || <span className="text-slate-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
           )}

          {buyerPsychologyText && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 shadow-card mb-4">
              <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
                <Brain size={16} className="text-violet-600" /> User Psychology
              </h2>
              <p className="text-base leading-relaxed text-slate-700 mt-2">{buyerPsychologyText}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 shadow-card mb-4">
            <h2 className={`${ICON_LABEL} ${CARD_TITLE}`}>
              <DollarSign size={16} className="text-amber-600" /> Pricing
            </h2>
            <ul className={`space-y-2 mt-2 ${priceLadder.length > 0 ? 'mb-4' : ''}`}>
              {toBulletPoints(r.pricingInsight).map((point, i) => (
                <li key={i} className="flex items-start gap-2.5 text-base leading-relaxed text-slate-700">
                  <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {priceLadder.length > 0 && (
              <div className="flex gap-2 flex-wrap items-stretch">
                {priceLadder.map((c) => {
                  // Colored relative to our own planned price, not just "you vs. everyone else":
                  // a competitor at or below our price is undercutting us (red, a risk), one
                  // priced above us is headroom (green). Only meaningful when we actually have a
                  // parsed own-price to compare against — priceLadder only ever contains a "you"
                  // entry when ownPriceValue parsed successfully, so competitors fall back to the
                  // old neutral styling on the rare project with no own price at all.
                  const priceVsUs = c.isYou || Number.isNaN(ownPriceValue) ? null : c.value <= ownPriceValue ? 'below' : 'above';
                  const tone = c.isYou
                    ? { box: 'bg-brand-600 border-brand-600 shadow-sm', price: 'text-white', label: 'text-brand-50' }
                    : priceVsUs === 'below'
                      ? { box: 'bg-red-50 border-red-200', price: 'text-red-700', label: 'text-red-500' }
                      : priceVsUs === 'above'
                        ? { box: 'bg-emerald-50 border-emerald-200', price: 'text-emerald-700', label: 'text-emerald-600' }
                        : { box: 'bg-white border-amber-200', price: 'text-slate-900', label: 'text-slate-500' };
                  return (
                    <div key={c.key} className={`flex-1 min-w-[150px] text-center px-3 py-3.5 rounded-lg border ${tone.box}`}>
                      <div className={`text-xl font-bold ${tone.price}`}>{c.price}</div>
                      <div className={`text-sm mt-0.5 truncate ${tone.label}`}>{c.label}</div>
                      {c.asin && (
                        <AsinLink
                          asin={c.asin}
                          marketplace={project.marketplace}
                          className={`text-xs mt-1 justify-center ${c.isYou ? 'text-brand-100' : ''}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
