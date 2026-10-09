import React from 'react';
import { BADGE_WARN, BADGE_GOOD } from './classNames';

// The server already rounds every stored credit field to 2dp (creditRounding.js) — this just
// trims a trailing .0/.00 so a whole-number rate reads "1 credit" not "1.00 credits".
function formatCredits(n) {
  return String(Math.round(n * 100) / 100);
}

/**
 * Always-visible small pill stating exactly what a button will charge, meant to sit right next to
 * that button — shown BEFORE the click, never a hover tooltip. `count` is how many images this
 * one action charges (most actions charge 1; Premium A+ design generation charges 2 — desktop +
 * mobile, see pipeline/premiumAplus.js). Free-image allowance is spent before any paid credit,
 * per image (creditLedgerService.chargeForImage), so a `count`-image action can end up fully
 * free, fully paid, or split across both — this mirrors that order exactly rather than only
 * handling the single-image case. Renders nothing when a paid image remains and `imageCost` is
 * null (the rate isn't known yet, or no credit lot is currently eligible) — hidden, never guessed.
 */
export function CreditCostPill({ imageCost, freeRemaining = 0, count = 1, className = '' }) {
  const freeUsed = Math.min(freeRemaining, count);
  const paidCount = count - freeUsed;

  if (paidCount === 0) {
    return <span className={`${BADGE_GOOD} ${className}`}>⚡ Free ({freeRemaining} left)</span>;
  }
  if (imageCost == null) return null;
  const amount = Math.round(imageCost * paidCount * 100) / 100;
  return (
    <span className={`${BADGE_WARN} ${className}`}>
      ⚡ {formatCredits(amount)} credit{amount === 1 ? '' : 's'}
      {freeUsed > 0 ? ` (${freeUsed} image${freeUsed === 1 ? '' : 's'} free)` : ''}
    </span>
  );
}
