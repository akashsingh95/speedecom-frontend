/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { CreditCostPill } from './ui/CreditCostPill';
import { CARD_TITLE, MUTED, BTN_PRIMARY, GRID_CARDS, ANGLE_CARD, ANGLE_PREVIEW, MODAL_SECTION, MODAL_SECTION_TITLE, BTN } from './ui/classNames';

// Rotating accent per marketing-angle card — angles have no color of their own, so this
// just cycles a small palette by card index to give each one a distinct numbered badge.
const ANGLE_ACCENTS = [
  { border: 'border-l-brand-500', badgeBg: 'bg-brand-100', badgeText: 'text-brand-700' },
  { border: 'border-l-violet-500', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700' },
  { border: 'border-l-emerald-500', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  { border: 'border-l-amber-500', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700' },
  { border: 'border-l-red-500', badgeBg: 'bg-red-100', badgeText: 'text-red-700' },
];

/**
 * Shared marketing-angle multiselect: pick angles once, see one or more count-aware generate
 * buttons below the grid (one per action), view an angle's full breakdown in a modal. Used by
 * StrategyPage.jsx (Standard A+ and Premium A+ from one shared checked selection) and, wrapped
 * in a Modal, by AplusPage.jsx/PremiumAplusPage.jsx (their own "Generate new" entry point).
 *
 * An angle may be picked any number of times, for any number of concepts/designs — there is no
 * "already used" lock (removed by design; see ADR discussion). Every angle is always selectable.
 */
export function AnglePicker({
  angles,
  actions, // [{ key, label: (n) => string, onGenerate: (selectedAngleNames) => Promise, busy?,
  //  costNote?: { type: 'pill', imageCost: number|null, freeRemaining?: number, count?: number }
  //           | { type: 'deferred', imageCost: number|null, freeRemaining?: number, text: string }
  //           | { type: 'info', text: string } }]
  // costNote is optional — omit it entirely to keep this action's button rendering exactly as
  // before. 'pill' shows an always-visible CreditCostPill (for an action that charges the instant
  // it's clicked — `count` is how many images it charges, e.g. 2 for Premium A+'s desktop+mobile,
  // default 1). 'deferred' is for an action (A+ concept generation) that charges nothing at THIS
  // click but leads straight to a follow-up click that does — shows the same pill (what that next
  // click will cost) alongside `text` explaining it's deferred, so the number is still visible up
  // front instead of only a vague "free to start". 'info' shows just the muted note, no pill.
  heading,
  description,
}) {
  const [selectedAngle, setSelectedAngle] = useState(null);
  const [pickedAngleNames, setPickedAngleNames] = useState(() => new Set());

  const toggleAngle = (name) => {
    setPickedAngleNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const generate = async (action) => {
    if (pickedAngleNames.size === 0 || action.busy) return;
    try {
      await action.onGenerate(Array.from(pickedAngleNames));
      setPickedAngleNames(new Set());
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    }
  };

  const anyBusy = actions.some((a) => a.busy);

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className={CARD_TITLE}>{heading}</h2>
          <p className={MUTED}>{description}</p>
        </div>
        {/* Stays visible through a busy action too, not just while something's picked — generate()
         *  clears the selection the instant the job/task is started (well before it finishes), so
         *  without the anyBusy half of this check the buttons would vanish immediately instead of
         *  showing "Generating…" for the run's actual duration. Each action owns its own `busy`
         *  (the caller derives it from whatever backs that specific action — a project job, a
         *  task, a local flag) so starting one action's generation never disables the others; they
         *  can run concurrently. */}
        {(pickedAngleNames.size > 0 || anyBusy) && (
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {actions.map((action) => (
              <div key={action.key} className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  onClick={() => generate(action)}
                  disabled={action.busy}
                >
                  {action.busy ? 'Generating…' : action.label(pickedAngleNames.size)}
                </button>
                {!action.busy && action.costNote?.type === 'pill' && (
                  <CreditCostPill
                    imageCost={action.costNote.imageCost}
                    freeRemaining={action.costNote.freeRemaining ?? 0}
                    count={action.costNote.count ?? 1}
                  />
                )}
                {!action.busy && action.costNote?.type === 'deferred' && (
                  <>
                    <CreditCostPill imageCost={action.costNote.imageCost} freeRemaining={action.costNote.freeRemaining ?? 0} />
                    <p className={`${MUTED} text-[11px] text-right max-w-[230px] leading-snug`}>{action.costNote.text}</p>
                  </>
                )}
                {!action.busy && action.costNote?.type === 'info' && (
                  <p className={`${MUTED} text-[11px] text-right max-w-[230px] leading-snug`}>{action.costNote.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={GRID_CARDS}>
        {angles.map((a, i) => {
          const accent = ANGLE_ACCENTS[i % ANGLE_ACCENTS.length];
          return (
            <div key={a.name} className={`${ANGLE_CARD} border-l-4 ${accent.border} relative`}>
              <label className="absolute top-2.5 right-2.5 z-10" title="Select for generation">
                <input
                  type="checkbox"
                  checked={pickedAngleNames.has(a.name)}
                  onChange={() => toggleAngle(a.name)}
                  className="w-4 h-4 accent-violet-600"
                />
              </label>
              <button type="button" className="text-left w-full" onClick={() => setSelectedAngle(a)}>
                <div className="flex items-start gap-2.5">
                  <span className={`w-6 h-6 rounded-md ${accent.badgeBg} ${accent.badgeText} text-sm font-bold flex items-center justify-center flex-shrink-0`}>
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-slate-900 pr-6">{a.name}</h3>
                </div>
                <span className="inline-block ml-[34px] mt-1.5 mb-2 text-sm px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{a.targetAvatar}</span>
                <p className={`${ANGLE_PREVIEW} pl-[34px]`}>{a.conversionRationale}</p>
              </button>
            </div>
          );
        })}
      </div>

      {selectedAngle && (
        <Modal onClose={() => setSelectedAngle(null)}>
          <div className="mb-3.5">
            <h2 className={CARD_TITLE}>{selectedAngle.name}</h2>
            <p className="text-slate-500 text-base">{selectedAngle.targetAvatar}</p>
          </div>

          <div className="text-slate-700 mb-3.5">{selectedAngle.conversionRationale}</div>

          <div className={MODAL_SECTION}>
            <h4 className={MODAL_SECTION_TITLE}>Feature / Benefit</h4>
            <p className="text-base text-slate-700">{selectedAngle.featureBenefit}</p>
          </div>

          {selectedAngle.supportingData.verifiedFacts.length > 0 && (
            <div className={MODAL_SECTION}>
              <h4 className={MODAL_SECTION_TITLE}>Verified facts</h4>
              <ul className="list-disc pl-4 text-base text-slate-700 space-y-0.5">
                {selectedAngle.supportingData.verifiedFacts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedAngle.supportingData.reviewData.length > 0 && (
            <div className={MODAL_SECTION}>
              <h4 className={MODAL_SECTION_TITLE}>Review data</h4>
              <ul className="list-disc pl-4 text-base text-slate-700 space-y-0.5">
                {selectedAngle.supportingData.reviewData.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedAngle.supportingData.competitorGap.length > 0 && (
            <div className={MODAL_SECTION}>
              <h4 className={MODAL_SECTION_TITLE}>Competitor gap</h4>
              <ul className="list-disc pl-4 text-base text-slate-700 space-y-0.5">
                {selectedAngle.supportingData.competitorGap.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedAngle.supportingData.avatarInsight.length > 0 && (
            <div className={MODAL_SECTION}>
              <h4 className={MODAL_SECTION_TITLE}>Avatar insight</h4>
              <ul className="list-disc pl-4 text-base text-slate-700 space-y-0.5">
                {selectedAngle.supportingData.avatarInsight.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={MODAL_SECTION}>
            <h4 className={MODAL_SECTION_TITLE}>Visual concept</h4>
            <p className="text-base text-slate-700">{selectedAngle.visualConcept}</p>
            <h4 className={`${MODAL_SECTION_TITLE} mt-2`}>Visual persuasion</h4>
            <p className="text-base text-slate-700">{selectedAngle.visualPersuasion}</p>
          </div>

          <button type="button" className={BTN} onClick={() => setSelectedAngle(null)}>
            Close
          </button>
        </Modal>
      )}
    </>
  );
}
