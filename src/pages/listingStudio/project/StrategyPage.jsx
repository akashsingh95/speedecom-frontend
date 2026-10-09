/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Target, Users, Brain, ShoppingCart, AlertTriangle, Heart, Lightbulb } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { premiumAplusApi } from '../../../components/listingStudio/premiumAplusApi';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { AnglePicker } from '../../../components/listingStudio/AnglePicker';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import {
  PAGE_HEAD,
  PAGE_TITLE,
  CARD_TITLE,
  BTN_PRIMARY,
  ICON_LABEL,
  AVATAR_CARD,
  AVATAR_HEAD,
  AVATAR_TRAITS,
  AVATAR_TRAIT,
  AVATAR_TRAIT_BLUE,
  AVATAR_TRAIT_VIOLET,
  AVATAR_TRAIT_WARN,
  AVATAR_LISTS,
  IMPACT_NEUTRAL,
  BADGE_GOOD,
  BADGE_WARN,
  BADGE_BAD,
  CARD,
  MUTED,
  STAT_TILES_GRID,
  STAT_TILE,
  STAT_TILE_VALUE,
  STAT_TILE_LABEL,
  STAT_TILE_VARIANTS,
} from '../../../components/listingStudio/ui/classNames';

/** Ported from speed-listing's pages/project/StrategyPage.tsx. */
export default function StrategyPage() {
  const navigate = useNavigate();
  const { project, job, jobRunning, watchJob, creditRates } = useProjectCtx();
  // Older stored projects still have the previous {positioning, toneOfVoice, ...} shape.
  const strategy = project.aplus?.strategy?.angles ? project.aplus.strategy : undefined;

  const researchDone = !!project.research;

  const [premiumStarting, setPremiumStarting] = useState(false);

  const generate = async () => {
    try {
      await listingStudioApi.startStrategy(project.id);
      watchJob();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  const generateMore = async (selectedAngleNames) => {
    await listingStudioApi.startAplus(project.id, selectedAngleNames);
    watchJob();
  };

  const generatePremiumAplus = async (selectedAngleNames) => {
    setPremiumStarting(true);
    try {
      await premiumAplusApi.startPremiumAplus(project.id, selectedAngleNames);
      navigate(`/listing-studio/p/${project.id}/premium-aplus`);
      // No reset on success — this component unmounts on navigation, and resetting first would
      // risk a "set state on an unmounted component" warning if that unmount lands first.
    } catch (e) {
      setPremiumStarting(false);
      throw e;
    }
  };

  const confidenceBadge =
    project.aplus?.avatar?.confidence >= 70 ? BADGE_GOOD : project.aplus?.avatar?.confidence >= 40 ? BADGE_WARN : BADGE_BAD;

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 grid place-items-center flex-shrink-0">
            <Target size={16} />
          </span>
          <h1 className={PAGE_TITLE}>Creative Strategy</h1>
        </div>
        {!strategy && (
          <button className={BTN_PRIMARY} onClick={generate} disabled={jobRunning || !researchDone} title={researchDone ? undefined : 'Complete market research first'}>
            {jobRunning ? (
              'Generating…'
            ) : (
              <span className={ICON_LABEL}>
                <Sparkles size={16} /> Generate creative strategy
              </span>
            )}
          </button>
        )}
      </div>
      {!strategy && !jobRunning && (
        <EmptyStateCard
          tone="violet"
          icon={Target}
          title="No creative strategy yet"
          description="Generate a customer avatar and marketing angles from your market research — A+ concepts are built from this next."
          features={[
            { icon: Users, label: 'Customer avatar' },
            { icon: Lightbulb, label: 'Marketing angles' },
            { icon: ShoppingCart, label: 'Conversion rationale' },
          ]}
          action={
            <button type="button" className={BTN_PRIMARY} onClick={generate} disabled={!researchDone} title={researchDone ? undefined : 'Complete market research first'}>
              <span className={ICON_LABEL}>
                <Sparkles size={16} /> Generate creative strategy
              </span>
            </button>
          }
        />
      )}
      {strategy && (
        <>
          {project.aplus?.avatar && (
            <div className={CARD}>
              <div className={STAT_TILES_GRID}>
                <div className={`${STAT_TILE} ${STAT_TILE_VARIANTS.violet.tile}`}>
                  <strong className={`${STAT_TILE_VALUE} ${STAT_TILE_VARIANTS.violet.text}`}>{project.aplus.avatar.confidence}%</strong>
                  <span className={STAT_TILE_LABEL}>Persona Confidence</span>
                </div>
                <div className={`${STAT_TILE} ${STAT_TILE_VARIANTS.blue.tile}`}>
                  <strong className={`${STAT_TILE_VALUE} ${STAT_TILE_VARIANTS.blue.text}`}>{strategy.angles.length}</strong>
                  <span className={STAT_TILE_LABEL}>Marketing Angles</span>
                </div>
                <div className={`${STAT_TILE} ${STAT_TILE_VARIANTS.red.tile}`}>
                  <strong className={`${STAT_TILE_VALUE} ${STAT_TILE_VARIANTS.red.text}`}>{(project.aplus.avatar.painPoints || []).length}</strong>
                  <span className={STAT_TILE_LABEL}>Pain Points Found</span>
                </div>
                <div className={`${STAT_TILE} ${STAT_TILE_VARIANTS.green.tile}`}>
                  <strong className={`${STAT_TILE_VALUE} ${STAT_TILE_VARIANTS.green.text}`}>{(project.aplus.avatar.keyMotivations || []).length}</strong>
                  <span className={STAT_TILE_LABEL}>Key Motivations</span>
                </div>
              </div>
            </div>
          )}

          {project.aplus?.avatar && (
            <div className={AVATAR_CARD}>
              <div className={AVATAR_HEAD}>
                <h2 className={CARD_TITLE}>{project.aplus.avatar.name}</h2>
                <span className={confidenceBadge}>{project.aplus.avatar.confidence}% confidence</span>
              </div>

              <div className={AVATAR_TRAITS}>
                <div className={`${AVATAR_TRAIT} ${AVATAR_TRAIT_BLUE}`}>
                  <div className={`${ICON_LABEL} font-semibold text-base mb-1`}>
                    <Users size={16} /> Demographics
                  </div>
                  <p className="text-base leading-relaxed text-slate-700">{project.aplus.avatar.demographics}</p>
                </div>
                <div className={`${AVATAR_TRAIT} ${AVATAR_TRAIT_VIOLET}`}>
                  <div className={`${ICON_LABEL} font-semibold text-base mb-1`}>
                    <Brain size={16} /> Psychographics
                  </div>
                  <p className="text-base leading-relaxed text-slate-700">{project.aplus.avatar.psychographics}</p>
                </div>
                <div className={`${AVATAR_TRAIT} ${AVATAR_TRAIT_WARN}`}>
                  <div className={`${ICON_LABEL} font-semibold text-base mb-1`}>
                    <ShoppingCart size={16} /> Buying behavior
                  </div>
                  <p className="text-base leading-relaxed text-slate-700">{project.aplus.avatar.buyingBehavior}</p>
                </div>
              </div>

              <div className={AVATAR_LISTS}>
                <div>
                  <h3 className={`${ICON_LABEL} font-semibold text-base mb-2`}>
                    <AlertTriangle size={16} className="text-red-600" /> Pain points
                  </h3>
                  {(project.aplus.avatar.painPoints || []).map((p) => (
                    <div key={p} className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-2 text-base text-red-700">
                      {p}
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className={`${ICON_LABEL} font-semibold text-base mb-2`}>
                    <Heart size={16} className="text-emerald-600" /> Key motivations
                  </h3>
                  {(project.aplus.avatar.keyMotivations || []).map((m) => (
                    <div key={m} className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 mb-2 text-base text-emerald-700">
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <AnglePicker
            angles={strategy.angles}
            heading="Marketing angles"
            description={`${strategy.angles.length} distinct angles discovered from product data, reviews, and competitive analysis — click a card for the full breakdown. Check the angles you want, then generate Standard or Premium A+ content from that selection.`}
            actions={[
              {
                key: 'standard',
                label: (n) => `Generate A+ content for ${n} angle${n === 1 ? '' : 's'}`,
                onGenerate: generateMore,
                busy: jobRunning && job?.kind === 'aplus',
                costNote: {
                  type: 'deferred',
                  imageCost: creditRates?.imageCost ?? null,
                  freeRemaining: creditRates?.freeImagesRemaining ?? 0,
                  text: 'Free to start — charged later, per banner, when you click Generate on each one.',
                },
              },
              {
                key: 'premium',
                label: (n) => `Generate 1 Premium A+ design covering ${n} angle${n === 1 ? '' : 's'}`,
                onGenerate: generatePremiumAplus,
                busy: premiumStarting,
                // Premium A+ charges 2 separate images (desktop + mobile) — free-image allowance
                // is spent per image, so this can be fully free, fully paid, or split across both.
                costNote: {
                  type: 'pill',
                  imageCost: creditRates?.imageCost ?? null,
                  freeRemaining: creditRates?.freeImagesRemaining ?? 0,
                  count: 2,
                },
              },
            ]}
          />

          {strategy.filteredOutAngles.length > 0 && (
            <div className={`${CARD} mt-4`}>
              <h2 className={`${CARD_TITLE} mb-1`}>Filtered out angles</h2>
              <p className={`${MUTED} mb-3`}>
                Common angles discovered from competitor products and their reviews, removed because your product data
                doesn't support these claims
              </p>
              {strategy.filteredOutAngles.map((f) => (
                <div key={f.name} className={`${IMPACT_NEUTRAL} rounded-xl px-4 py-3 mb-2.5 text-base border`}>
                  <strong className="block text-slate-900 mb-0.5">{f.name}</strong>
                  <p className="text-base text-slate-600">{f.reason}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
