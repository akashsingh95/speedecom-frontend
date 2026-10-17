/** Matching the research keywords back against the listing copy, so the Listing tab can show a
 *  seller which of their researched terms the generated title/bullets/description/backend terms
 *  actually contain, and what each one is worth in monthly searches.
 *
 *  Two keyword sources exist on a project and they overlap, so both are merged here:
 *    - `researchMeta.topKeywords` — the volume-ranked top 20 (DataForSEO), keywords already
 *      lower-cased by the pipeline's normalizeKeyword.
 *    - `research.keywordOpportunities` — every extracted candidate; carries a `searchVolume`
 *      only when a volume lookup answered for it.
 *
 *  Only keywords with a real volume are highlighted. A keyword no lookup could price says
 *  nothing about what the term is worth, so shading it would put a mark on the copy that
 *  answers nothing when the seller hovers it. Note this leaves www.amazon.in projects with
 *  nothing to highlight: DataForSEO has no Amazon volume data for that marketplace. */

// Letters/digits in any script: what counts as "inside a word" for a match's edges, so
// "bottle" does not light up inside "bottles" or "waterbottle".
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Every research keyword for a project that has a known monthly search volume, de-duplicated
 *  case-insensitively and sorted longest-phrase-first — match order matters: "steel water
 *  bottle" must claim its text before the shorter "water bottle" can, or the longer phrase
 *  never shows up as one highlight. */
export function collectKeywordVolumes(project) {
  const byKeyword = new Map();
  const add = (keyword, searchVolume) => {
    const phrase = String(keyword ?? '').trim();
    if (!phrase) return;
    const key = phrase.toLowerCase();
    const existing = byKeyword.get(key);
    if (!existing) {
      byKeyword.set(key, { keyword: phrase, searchVolume: typeof searchVolume === 'number' ? searchVolume : null });
      return;
    }
    // The first source to price a keyword wins; later ones only fill in a volume still missing.
    if (existing.searchVolume === null && typeof searchVolume === 'number') existing.searchVolume = searchVolume;
  };

  for (const k of project?.researchMeta?.topKeywords ?? []) add(k?.keyword, k?.searchVolume);
  for (const k of project?.research?.keywordOpportunities ?? []) add(k?.keyword, k?.searchVolume);

  return [...byKeyword.values()]
    .filter((entry) => entry.searchVolume !== null)
    .sort((a, b) => b.keyword.length - a.keyword.length);
}

/** Every whole-word, case-insensitive occurrence of `needle` in `haystack` as [start, end)
 *  pairs. Both arguments must already be lower-cased. Plain indexOf rather than a RegExp: a
 *  keyword is arbitrary seller/vendor text and may contain "(", "+", "." and the like. */
function occurrences(haystack, needle) {
  const found = [];
  if (!needle) return found;
  let from = 0;
  for (;;) {
    const start = haystack.indexOf(needle, from);
    if (start === -1) break;
    const end = start + needle.length;
    from = start + 1;
    if (WORD_CHAR.test(haystack[start - 1] ?? '') || WORD_CHAR.test(haystack[end] ?? '')) continue;
    found.push([start, end]);
  }
  return found;
}

/** Splits `text` into render segments: plain runs plus `{ entry }` runs for each keyword
 *  occurrence. Where two keywords would cover the same text only one can be painted, and the
 *  first to claim it wins — hence the longest-first ordering from collectKeywordVolumes, so
 *  "steel water bottle" shows as one highlight instead of being broken up by "water bottle".
 *  `keywords` must come from that function. */
export function highlightSegments(text, keywords) {
  const source = typeof text === 'string' ? text : '';
  if (!source || !keywords?.length) return [{ text: source }];

  const haystack = source.toLowerCase();
  const claimed = new Array(source.length).fill(false);
  const marks = [];

  for (const entry of keywords) {
    for (const [start, end] of occurrences(haystack, entry.keyword.toLowerCase())) {
      let free = true;
      for (let i = start; i < end; i += 1) {
        if (claimed[i]) {
          free = false;
          break;
        }
      }
      if (!free) continue;
      for (let i = start; i < end; i += 1) claimed[i] = true;
      marks.push({ start, end, entry });
    }
  }

  if (marks.length === 0) return [{ text: source }];
  marks.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) segments.push({ text: source.slice(cursor, mark.start) });
    segments.push({ text: source.slice(mark.start, mark.end), entry: mark.entry });
    cursor = mark.end;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor) });
  return segments;
}

/** How many times each keyword appears across `texts`, keyed by the lower-cased keyword;
 *  keywords that appear nowhere are simply absent, so the map's size is "how many of the
 *  research keywords made it into the copy".
 *
 *  Counted independently of which keyword won the paint: a listing whose title reads "steel
 *  water bottle" does contain — and does rank for — "water bottle", so counting that as unused
 *  because a longer phrase covered the same words would under-report the research every time a
 *  head term is part of a long-tail one. */
export function countKeywordUses(texts, keywords) {
  const counts = new Map();
  for (const text of texts) {
    const haystack = (typeof text === 'string' ? text : '').toLowerCase();
    if (!haystack) continue;
    for (const entry of keywords ?? []) {
      const hits = occurrences(haystack, entry.keyword.toLowerCase()).length;
      if (hits === 0) continue;
      const key = entry.keyword.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + hits);
    }
  }
  return counts;
}

/** Highlight strength for a keyword: three bands of monthly volume. Deliberately coarse — the
 *  exact number is one hover away; the shading only has to say "this one is the big one". */
export function volumeTier(searchVolume) {
  if (searchVolume >= 5000) return 'high';
  if (searchVolume >= 1000) return 'medium';
  return 'low';
}
