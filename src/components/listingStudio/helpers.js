import { MAX_UPLOAD_FILES, MAX_UPLOAD_FILE_SIZE_MB } from './constants';

const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

/** Checks a FileList/array against the server's real multer limits (mirrors
 *  server/listingStudio/routes/shared/upload.js) — returns null if it's fine, or a short
 *  user-facing reason otherwise. Checked here so a seller who picks too many/too-large files
 *  finds out before the round-trip, not from a raw Multer error string after the request fails. */
export function validateUploadFiles(files) {
  const list = Array.from(files ?? []);
  if (list.length > MAX_UPLOAD_FILES) {
    return `You selected ${list.length} images — up to ${MAX_UPLOAD_FILES} at a time. Remove ${list.length - MAX_UPLOAD_FILES} and try again.`;
  }
  const tooBig = list.find((f) => f.size > MAX_UPLOAD_FILE_SIZE_BYTES);
  if (tooBig) {
    return `"${tooBig.name}" is ${(tooBig.size / (1024 * 1024)).toFixed(1)}MB — the limit per image is ${MAX_UPLOAD_FILE_SIZE_MB}MB.`;
  }
  return null;
}

/** The real Amazon product page for an ASIN on a given marketplace domain (e.g.
 *  "www.amazon.in") — the standard `/dp/<ASIN>` URL scheme every Amazon marketplace uses. */
export function amazonUrl(asin, marketplace) {
  const domain = marketplace || 'www.amazon.com';
  return `https://${domain}/dp/${asin}`;
}

/** Short marketplace code from a domain like "www.amazon.in" -> "in", "www.amazon.co.uk" -> "co.uk". */
export function marketplaceCode(marketplace) {
  if (!marketplace) return '';
  return marketplace.replace(/^www\.amazon\./, '');
}

/** "5 days ago" / "yesterday" / "3 weeks ago" style relative time, for a campaign's createdAt —
 *  cards showing this instead of a raw date read closer to a real activity feed. */
export function formatRelativeTime(iso) {
  if (!iso) return '';
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  const diffWeek = Math.round(diffDay / 7);
  if (diffDay < 30) return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;
  const diffMonth = Math.round(diffDay / 30);
  if (diffDay < 365) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`;
  const diffYear = Math.round(diffDay / 365);
  return `${diffYear} year${diffYear === 1 ? '' : 's'} ago`;
}

/** The one campaign-status word shown on every campaign card (Home's recent list and the
 *  Campaigns page), furthest stage wins. Reads the `has*` booleans the list endpoint projects
 *  (server/listingStudio/store.js listProjects) — list items never carry the full
 *  research/listing/aplus payloads, so checking those fields here would always say "New". */
export function campaignStatus(p) {
  if (p.hasAplus) return { label: 'A+ content ready', className: 'text-emerald-600' };
  if (p.hasListing) return { label: 'Listing ready', className: 'text-brand-600' };
  if (p.hasResearch) return { label: 'Researched', className: 'text-amber-600' };
  return { label: 'New', className: 'text-slate-400' };
}
