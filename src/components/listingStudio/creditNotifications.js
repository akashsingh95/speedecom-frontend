export function creditNotificationMessage(billing, action) {
  if (!billing || billing.alreadyCharged) return null;
  const subject = action || 'Image generation';
  if (billing.charged === 'FREE_ALLOWANCE') {
    return `${subject} completed — 1 free image used. ${billing.freeImagesRemaining ?? 0} free images left.`;
  }
  if (billing.charged === 'LOT') {
    return `${subject} completed — ${billing.amount} credits deducted. ${billing.balance ?? 0} credits remaining.`;
  }
  return null;
}

/** One toast for a Premium A+ generation that renders several images (desktop + mobile), each
 *  with its own billing — sums them instead of showing one toast per image. */
export function multiImageCreditNotificationMessage(billings, action) {
  const list = (billings || []).filter((b) => b && !b.alreadyCharged);
  if (list.length === 0) return null;
  const subject = action || 'Image generation';
  const free = list.filter((b) => b.charged === 'FREE_ALLOWANCE');
  const paid = list.filter((b) => b.charged === 'LOT');
  const last = list[list.length - 1];
  const parts = [];
  if (paid.length) parts.push(`${paid.reduce((sum, b) => sum + (b.amount || 0), 0)} credits deducted`);
  if (free.length) parts.push(`${free.length} free image${free.length > 1 ? 's' : ''} used`);
  if (parts.length === 0) return null;
  const remaining = paid.length
    ? `${paid[paid.length - 1].balance ?? 0} credits remaining.`
    : `${last.freeImagesRemaining ?? 0} free images left.`;
  return `${subject} completed — ${parts.join(', ')}. ${remaining}`;
}
