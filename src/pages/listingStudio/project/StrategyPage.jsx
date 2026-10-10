import React, { useState } from 'react';
import { Sparkles, Target, Users, Brain, ShoppingCart, AlertTriangle, Heart, Lightbulb } from 'lucide-react';
import { listingStudioApi } from '../../../components/listingStudio/api';
import { useProjectCtx } from '../../../components/listingStudio/context';
import { Modal } from '../../../components/listingStudio/ui/Modal';
import { EmptyStateCard } from '../../../components/listingStudio/ui/EmptyStateCard';
import {
  PAGE_HEAD,
  PAGE_TITLE,
  MUTED,
  BTN_PRIMARY,
  ICON_LABEL,
  NOTICE_WARN,
  AVATAR_CARD,
  AVATAR_HEAD,
  AVATAR_TRAITS,
  AVATAR_TRAIT,
  AVATAR_TRAIT_BLUE,
  AVATAR_TRAIT_VIOLET,
  AVATAR_TRAIT_WARN,
  AVATAR_LISTS,
  AVATAR_IMPACT_CARD,
  AVATAR_IMPACT_GOOD,
  AVATAR_IMPACT_BAD,
  IMPACT_NEUTRAL,
  GRID_CARDS,
  ANGLE_CARD,
  ANGLE_PREVIEW,
  BADGE_GOOD,
  BADGE_WARN,
  BADGE_BAD,
  CARD,
  MODAL_SECTION,
  MODAL_SECTION_TITLE,
  BTN,
} from '../../../components/listingStudio/ui/classNames';

/** Ported from speed-listing's pages/project/StrategyPage.tsx. */
export default function StrategyPage() {
  const { project, jobRunning, watchJob } = useProjectCtx();
  const [selectedAngle, setSelectedAngle] = useState(null);
  // Older stored projects still have the previous {positioning, toneOfVoice, ...} shape.
  const strategy = project.aplus?.strategy?.angles ? project.aplus.strategy : undefined;

  const generate = async () => {
    try {
      await listingStudioApi.startStrategy(project.id);
      watchJob();
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
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
        <button className={BTN_PRIMARY} onClick={generate} disabled={jobRunning}>
          {jobRunning ? (
            'Generating…'
          ) : strategy ? (
            'Regenerate strategy'
          ) : (
            <span className={ICON_LABEL}>
              <Sparkles size={16} /> Generate creative strategy
            </span>
          )}
        </button>
      </div>
      {strategy && (
        <div className={NOTICE_WARN}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <p>
            Regenerating replaces the customer avatar and these angles, and clears any A+ concepts built from them —
            you'll need to regenerate A+ Content afterward.
          </p>
        </div>
      )}
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
            <button type="button" className={BTN_PRIMARY} onClick={generate}>
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
            <div className={AVATAR_CARD}>
              <div className={AVATAR_HEAD}>
                <h2 className="text-lg font-semibold text-slate-900">{project.aplus.avatar.name}</h2>
                <span className={confidenceBadge}>{project.aplus.avatar.confidence}% confidence</span>
              </div>

              <div className={AVATAR_TRAITS}>
                <div className={`${AVATAR_TRAIT} ${AVATAR_TRAIT_BLUE}`}>
                  <div className={`${ICON_LABEL} font-semibold text-sm mb-1`}>
                    <Users size={16} /> Demographics
                  </div>
                  <p className="text-sm text-slate-700">{project.aplus.avatar.demographics}</p>
                </div>
                <div className={`${AVATAR_TRAIT} ${AVATAR_TRAIT_VIOLET}`}>
                  <div className={`${ICON_LABEL} font-semibold text-sm mb-1`}>
                    <Brain size={16} /> Psychographics
                  </div>
                  <p className="text-sm text-slate-700">{project.aplus.avatar.psychographics}</p>
                </div>
                <div className={`${AVATAR_TRAIT} ${AVATAR_TRAIT_WARN}`}>
                  <div className={`${ICON_LABEL} font-semibold text-sm mb-1`}>
                    <ShoppingCart size={16} /> Buying behavior
                  </div>
                  <p className="text-sm text-slate-700">{project.aplus.avatar.buyingBehavior}</p>
                </div>
              </div>

              <div className={AVATAR_LISTS}>
                <div>
                  <h3 className={`${ICON_LABEL} font-semibold text-sm mb-2`}>
                    <AlertTriangle size={16} /> Pain points
                  </h3>
                  {project.aplus.avatar.painPoints.map((p) => (
                    <div key={p} className={`${AVATAR_IMPACT_CARD} ${AVATAR_IMPACT_BAD}`}>
                      {p}
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className={`${ICON_LABEL} font-semibold text-sm mb-2`}>
                    <Heart size={16} /> Key motivations
                  </h3>
                  {project.aplus.avatar.keyMotivations.map((m) => (
                    <div key={m} className={`${AVATAR_IMPACT_CARD} ${AVATAR_IMPACT_GOOD}`}>
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <h2 className="text-lg font-semibold text-slate-900 mb-1">Marketing angles</h2>
          <p className={`${MUTED} mb-3`}>
            {strategy.angles.length} distinct angles discovered from product data, reviews, and competitive analysis —
            click a card for the full breakdown.
          </p>
          <div className={GRID_CARDS}>
            {strategy.angles.map((a) => (
              <button type="button" className={ANGLE_CARD} key={a.name} onClick={() => setSelectedAngle(a)}>
                <h3 className="font-semibold text-slate-900">{a.name}</h3>
                <p className="text-slate-500 text-xs mt-0.5">{a.targetAvatar}</p>
                <p className={ANGLE_PREVIEW}>{a.conversionRationale}</p>
              </button>
            ))}
          </div>

          {strategy.filteredOutAngles.length > 0 && (
            <div className={`${CARD} mt-4`}>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Filtered out angles</h2>
              <p className={`${MUTED} mb-3`}>
                Common angles discovered from competitor products and their reviews, removed because your product data
                doesn't support these claims
              </p>
              {strategy.filteredOutAngles.map((f) => (
                <div key={f.name} className={`${AVATAR_IMPACT_CARD} ${IMPACT_NEUTRAL}`}>
                  <strong>{f.name}</strong>
                  <p>{f.reason}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectedAngle && (
        <Modal onClose={() => setSelectedAngle(null)}>
          <div className="mb-3.5">
            <h2 className="text-lg font-semibold text-slate-900">{selectedAngle.name}</h2>
            <p className="text-slate-500 text-sm">{selectedAngle.targetAvatar}</p>
          </div>

          <div className="text-slate-700 mb-3.5">{selectedAngle.conversionRationale}</div>

          <div className={MODAL_SECTION}>
            <h4 className={MODAL_SECTION_TITLE}>Feature / Benefit</h4>
            <p className="text-sm text-slate-700">{selectedAngle.featureBenefit}</p>
          </div>

          {selectedAngle.supportingData.verifiedFacts.length > 0 && (
            <div className={MODAL_SECTION}>
              <h4 className={MODAL_SECTION_TITLE}>Verified facts</h4>
              <ul className="list-disc pl-4 text-sm text-slate-700 space-y-0.5">
                {selectedAngle.supportingData.verifiedFacts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedAngle.supportingData.reviewData.length > 0 && (
            <div className={MODAL_SECTION}>
              <h4 className={MODAL_SECTION_TITLE}>Review data</h4>
              <ul className="list-disc pl-4 text-sm text-slate-700 space-y-0.5">
                {selectedAngle.supportingData.reviewData.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedAngle.supportingData.competitorGap.length > 0 && (
            <div className={MODAL_SECTION}>
              <h4 className={MODAL_SECTION_TITLE}>Competitor gap</h4>
              <ul className="list-disc pl-4 text-sm text-slate-700 space-y-0.5">
                {selectedAngle.supportingData.competitorGap.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedAngle.supportingData.avatarInsight.length > 0 && (
            <div className={MODAL_SECTION}>
              <h4 className={MODAL_SECTION_TITLE}>Avatar insight</h4>
              <ul className="list-disc pl-4 text-sm text-slate-700 space-y-0.5">
                {selectedAngle.supportingData.avatarInsight.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={MODAL_SECTION}>
            <h4 className={MODAL_SECTION_TITLE}>Visual concept</h4>
            <p className="text-sm text-slate-700">{selectedAngle.visualConcept}</p>
            <h4 className={`${MODAL_SECTION_TITLE} mt-2`}>Visual persuasion</h4>
            <p className="text-sm text-slate-700">{selectedAngle.visualPersuasion}</p>
          </div>

          <button type="button" className={BTN} onClick={() => setSelectedAngle(null)}>
            Close
          </button>
        </Modal>
      )}
    </div>
  );
}
