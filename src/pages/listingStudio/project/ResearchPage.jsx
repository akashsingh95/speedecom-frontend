import React from 'react';
import { Search, CheckCircle2, BarChart3, ThumbsUp, AlertTriangle, Lightbulb, LayoutGrid, Heart, ExternalLink, Star, Users } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { amazonUrl } from '../../../components/listingStudio/helpers';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { SentimentDonut, DemographicsBars } from '../../../components/listingStudio/charts';
import CompetitorPicker from '../../../components/listingStudio/CompetitorPicker';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import {
  PAGE_HEAD, MUTED, SMALL, ICON_LABEL, CARD,
  BTN_PRIMARY, BADGE, SERP_GRID, SERP_ITEM, SERP_IMG, SERP_THUMB_EMPTY,
  SERP_TITLE, SERP_YOU, STAT_TILES_GRID, STAT_TILE, STAT_TILE_VALUE, STAT_TILE_LABEL, STAT_TILE_VARIANTS,
  DASH_GRID, THEME_COLS, THEME_COL_GOOD, THEME_COL_BAD, THEME_COL_BLUE, THEME_ITEM,
  IMPACT_BAD, IMPACT_GOOD, QUOTE,
} from '../../../components/listingStudio/ui/classNames';

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
export default function ResearchPage() {
  const { project, job, jobRunning, watchJob } = useProjectCtx();
  const r = project.research;
  const meta = project.researchMeta;
  const isAwaitingSelection = job?.status === 'awaiting_selection';

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
        <button className={BTN_PRIMARY} onClick={start} disabled={jobRunning || isAwaitingSelection}>
          {jobRunning ? (
            'Researching…'
          ) : r ? (
            'Re-run market research'
          ) : (
            <span className={ICON_LABEL}>
              <Search size={16} /> Run market research
            </span>
          )}
        </button>
      </div>
      {isAwaitingSelection && job?.candidates && (
        <CompetitorPicker project={project} candidates={job.candidates} watchJob={watchJob} />
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
            <h2 className={`${ICON_LABEL} text-lg font-medium text-slate-900`}>
              <CheckCircle2 size={18} /> Analysis Complete
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
            {meta && <p className={`${MUTED} ${SMALL}`}>Provider: {meta.provider} · keywords: {meta.keywords.join(', ')}</p>}
          </div>

          {(meta?.sentiment || r.demographics) && (
            <div className={CARD}>
              <h2 className={`${ICON_LABEL} text-lg font-medium text-slate-900`}>
                <BarChart3 size={18} /> Review Analysis Dashboard
              </h2>
              <div className={DASH_GRID}>
                {meta?.sentiment && (
                  <div>
                    <h3 className="font-medium text-slate-900 mb-2">Sentiment Distribution</h3>
                    <SentimentDonut {...meta.sentiment} />
                  </div>
                )}
                {r.demographics && (
                  <div>
                    <h3 className="font-medium text-slate-900 mb-2">Customer Demographics</h3>
                    <DemographicsBars brackets={r.demographics.brackets} />
                  </div>
                )}
              </div>
            </div>
          )}

          {(r.positiveThemes?.length || r.featureRequests?.length) && (
            <div className={CARD}>
              <h2 className="text-lg font-medium text-slate-900">Review Themes</h2>
              <div className={THEME_COLS}>
                <div className={THEME_COL_GOOD}>
                  <h3 className={`${ICON_LABEL} font-medium text-slate-900 mt-0`}>
                    <ThumbsUp size={15} /> What customers love
                  </h3>
                  {(r.positiveThemes ?? []).map((t) => (
                    <div key={t.theme} className={THEME_ITEM}>
                      <strong>{t.theme}</strong>
                      <p className={MUTED}>{t.detail}</p>
                    </div>
                  ))}
                </div>
                <div className={THEME_COL_BAD}>
                  <h3 className={`${ICON_LABEL} font-medium text-slate-900 mt-0`}>
                    <AlertTriangle size={15} /> Pain points
                  </h3>
                  {r.painPoints.map((p) => (
                    <div key={p.theme} className={THEME_ITEM}>
                      <strong>{p.theme}</strong>
                    </div>
                  ))}
                </div>
                <div className={THEME_COL_BLUE}>
                  <h3 className={`${ICON_LABEL} font-medium text-slate-900 mt-0`}>
                    <Lightbulb size={15} /> Feature requests
                  </h3>
                  {(r.featureRequests ?? []).map((f) => (
                    <div key={f.request} className={THEME_ITEM}>
                      <strong>{f.request}</strong>
                      <p className={MUTED}>{f.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {project.serp && project.serp.length > 0 && (
            <div className={CARD}>
              <h2 className={`${ICON_LABEL} text-lg font-medium text-slate-900`}>
                <LayoutGrid size={18} /> SERP Simulation
              </h2>
              <p className={`${MUTED} ${SMALL}`}>
                The search results your customers see for "{meta?.keywords[0]}" — with your listing's slot highlighted.
              </p>
              <div className={SERP_GRID}>
                <div className={`${SERP_ITEM} ${SERP_YOU}`}>
                  {project.images[0] ? <img src={project.images[0]} alt="" className={SERP_IMG} /> : <div className={SERP_THUMB_EMPTY}>Your images</div>}
                  <div className={SERP_TITLE}>{project.listing?.title ?? project.input.name}</div>
                  <span className={`${BADGE} border-emerald-600 bg-emerald-50 text-emerald-600`}>Your listing</span>
                </div>
                {project.serp.slice(0, 7).map((s) => (
                  <a key={s.asin} className={SERP_ITEM} href={s.url} target="_blank" rel="noreferrer">
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
            <h2 className="text-lg font-medium text-slate-900 mb-1">Competitors</h2>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full border-collapse text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 w-[26%]">Product</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4">Price</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4">Rating</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 w-[26%]">Strengths</th>
                    <th className="text-left font-semibold text-slate-700 py-3 px-4 w-[26%]">Weaknesses</th>
                  </tr>
                </thead>
                <tbody>
                  {r.competitorInsights.map((c) => (
                    <tr key={c.asin} className="border-b border-slate-100 last:border-b-0 align-top hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900 leading-snug">{c.title}</div>
                        <AsinLink asin={c.asin} marketplace={project.marketplace} className="text-xs mt-1" />
                      </td>
                      <td className="py-4 px-4 text-slate-700 whitespace-nowrap">{c.price}</td>
                      <td className="py-4 px-4 text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Star size={13} className="text-amber-500 fill-amber-500" /> {c.rating}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <ul className="space-y-1">
                          {c.strengths.map((s) => (
                            <li key={s} className="flex items-start gap-1.5 text-slate-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" /> {s}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-4 px-4">
                        <ul className="space-y-1">
                          {c.weaknesses.map((s) => (
                            <li key={s} className="flex items-start gap-1.5 text-slate-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" /> {s}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={CARD}>
            <h2 className={`${ICON_LABEL} text-lg font-medium text-slate-900`}>
              <AlertTriangle size={18} /> Top Customer Pain Points
            </h2>
            {r.painPoints.map((pp) => (
              <div key={pp.theme} className={IMPACT_BAD}>
                <strong>{pp.theme}</strong>
                {pp.evidence.slice(0, 2).map((e) => (
                  <div key={e} className={QUOTE}>
                    &ldquo;{e}&rdquo;
                  </div>
                ))}
                {pp.impact && (
                  <p>
                    <b>Impact:</b> {pp.impact}
                  </p>
                )}
                <p>
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full border border-emerald-600 bg-emerald-50 text-emerald-600 mr-1">how to win</span> {pp.howToAddress}
                </p>
              </div>
            ))}
          </div>

          {r.motivations && r.motivations.length > 0 && (
            <div className={CARD}>
              <h2 className={`${ICON_LABEL} text-lg font-medium text-slate-900`}>
                <Heart size={18} /> Primary Customer Motivations
              </h2>
              {r.motivations.map((m) => (
                <div key={m.motivation} className={IMPACT_GOOD}>
                  <strong>{m.motivation}</strong>
                  <p>{m.description}</p>
                  <p>
                    <b>Frequency:</b> {m.frequency}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className={CARD}>
            <h2 className="text-lg font-medium text-slate-900">Keywords &amp; guidance</h2>
            <ul className="list-disc pl-4">
              {r.keywordOpportunities.map((k) => (
                <li key={k.keyword}>
                  <strong>{k.keyword}</strong> — {k.rationale}
                </li>
              ))}
            </ul>
            <h3 className="font-medium text-slate-900 mt-3">Copy guidance</h3>
            <ul className="list-disc pl-4">
              {r.copyRecommendations.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <h3 className="font-medium text-slate-900 mt-3">Recommended images</h3>
            {Array.isArray(r.imageRecommendations) ? (
              <p className={MUTED}>This report predates the new image-recommendation format — re-run research to see it.</p>
            ) : (
              [
                ['Primary', r.imageRecommendations.primaryImages],
                ['Secondary', r.imageRecommendations.secondaryImages],
              ].map(([label, list]) => (
              <div key={label} className="mt-2">
                <p className={`${MUTED} text-xs font-medium uppercase tracking-wide`}>{label}</p>
                <ul className="list-disc pl-4">
                  {list.map((i, idx) => (
                    <li key={idx}>
                      <span className={BADGE}>{i.type}</span> {i.purpose}
                      <div className={`${MUTED} text-xs`}>
                        {i.dominantVisualMoment} — {i.composition.productPlacement}, {i.composition.momentPlacement}, {i.composition.backgroundType} background
                        {i.onImageText && ` — text: "${i.onImageText.primaryText}" / "${i.onImageText.secondaryText}"`}
                        {i.supportingElement && ` — ${i.supportingElement}`}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              ))
            )}
            <h3 className="font-medium text-slate-900 mt-3">Pricing</h3>
            <p>{r.pricingInsight}</p>
          </div>
        </>
      )}
    </div>
  );
}
