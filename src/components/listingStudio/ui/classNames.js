// Shared Tailwind utility strings for Listing Studio's ported UI kit — mirrors the
// button/card/badge classes speed-listing's styles.css used to define once and reuse
// everywhere (.btn, .btn-primary, .card, .badge, ...). Kept as plain string constants
// (rather than a component-only API) because several ported pages style plain <Link>
// elements as buttons/cards directly, not through the Button/Card components.

export const BTN =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 transition-all hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-default';
export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-transparent bg-gradient-to-r from-brand-600 to-brand-500 text-sm font-semibold text-white shadow-[0_2px_10px_-2px_rgba(2,132,199,0.45)] transition-all hover:shadow-[0_6px_18px_-2px_rgba(2,132,199,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-default disabled:translate-y-0 disabled:shadow-none';
export const BTN_GHOST =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-transparent bg-transparent text-sm text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 disabled:cursor-default';
export const BTN_DANGER =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-transparent bg-red-600 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-default';
export const BTN_SMALL = 'px-2.5 py-1 text-xs';

export const CARD = 'bg-white border border-slate-200 rounded-2xl p-4 shadow-card mb-4';
export const EMPTY_STATE = 'text-center p-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50 shadow-none';

export const BADGE = 'inline-block text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 mr-1';
export const BADGE_GOOD = 'inline-block text-[11px] px-2 py-0.5 rounded-full border border-emerald-600 bg-emerald-50 text-emerald-600 mr-1';
export const BADGE_WARN = 'inline-block text-[11px] px-2 py-0.5 rounded-full border border-amber-600 bg-amber-50 text-amber-600 mr-1';
export const BADGE_BAD = 'inline-block text-[11px] px-2 py-0.5 rounded-full border border-red-600 bg-red-50 text-red-600 mr-1';
// Small interactive "Generate" pill sat inside an empty image/content placeholder slot (e.g.
// an A+ concept card before any concepts exist) — a lighter-weight action than BTN_PRIMARY,
// meant to sit on top of a muted slate-100 placeholder background.
export const PILL_BTN_AMBER =
  'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-700 transition-colors hover:bg-amber-200 disabled:opacity-50 disabled:cursor-default';

export const PAGE_HEAD = 'flex justify-between items-start gap-3.5 mb-4 flex-wrap';
export const PAGE_TITLE = 'font-heading text-2xl font-semibold tracking-tight text-slate-900';
export const MUTED = 'text-slate-500';
export const SMALL = 'text-xs';

export const GRID_CARDS = 'grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]';
export const PROJECT_CARD =
  'hover-lift flex gap-3 items-center text-slate-900 bg-white border border-slate-200 rounded-2xl p-4 shadow-card transition-all hover:border-brand-400 hover:shadow-card-hover';
export const THUMB = 'w-16 h-16 rounded-lg object-cover bg-white border border-slate-200 flex-shrink-0';
export const THUMB_PLACEHOLDER = 'w-16 h-16 rounded-lg bg-white border border-slate-200 flex-shrink-0';
// Bigger variant for the Campaigns list, where the product photo should be the card's most
// visible element rather than one detail among several — see ProjectsPage.
export const THUMB_LG = 'w-20 h-20 rounded-xl object-cover bg-white border border-slate-200 flex-shrink-0';
export const THUMB_LG_PLACEHOLDER = 'w-20 h-20 rounded-xl bg-white border border-slate-200 flex-shrink-0';

export const SKELETON_BLOCK = 'h-[120px] rounded-lg bg-slate-100 animate-pulse';

export const PAGE_CENTER = 'grid place-items-center min-h-[60vh]';

// Project shell nav (ProjectLayout's TopNav) — mirrors .top-navbar/.nav-item/.section-pager.
export const TOP_NAVBAR =
  'flex flex-wrap items-center gap-3 gap-y-2 bg-white border-b border-slate-200 text-slate-900 px-4 py-2 sticky top-0 z-40';
export const NAV_ITEM_BASE =
  'flex items-center gap-2 text-slate-500 px-3.5 py-2 my-1.5 rounded-lg text-sm font-medium transition-all hover:text-brand-600 hover:bg-brand-50 whitespace-nowrap';
export const NAV_ITEM_ACTIVE = 'bg-brand-600 text-white shadow-[0_2px_8px_-1px_rgba(2,132,199,0.45)] hover:bg-brand-600 hover:text-white';
export const SECTION_PAGER = 'flex justify-between gap-3 mt-8 pt-4 border-t border-slate-200';

export const JOBBAR = 'bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 mb-4 text-[13px] text-slate-500 shadow-card';
export const JOBBAR_ERROR = 'bg-red-50 border border-red-200 text-red-600';
export const JOBBAR_TRACK = 'bg-slate-100 rounded-full h-2 overflow-hidden mb-1.5';
export const JOBBAR_FILL = 'h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-500';

// Comparison Shelf's sticky table.
export const SHELF_WRAP = 'bg-white border border-slate-200 rounded-2xl shadow-card overflow-x-auto mb-4';
export const SHELF_TABLE = 'w-full border-separate border-spacing-0 text-[13px]';
export const SHELF_CELL = 'px-3 py-2.5 border-b border-slate-200 align-top text-left';
export const SHELF_HEAD_STICKY = 'sticky top-0 bg-white z-[2] whitespace-nowrap';
export const SHELF_ROW_HEAD = 'sticky left-0 bg-white z-[1] whitespace-nowrap font-semibold text-[13px]';
export const SHELF_ROW_HEAD_TOPLEFT = 'sticky left-0 top-0 bg-white z-[3] whitespace-nowrap font-semibold text-[13px]';
export const SHELF_SUBLABEL = 'mt-0.5 max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap';
export const SHELF_IMAGE_CELL = 'relative w-[140px] h-[140px] border border-slate-200 rounded-lg overflow-hidden bg-slate-100';
export const SHELF_COUNT_BADGE = 'absolute top-1 right-1 bg-white/95 text-[11px] px-2 py-0.5 rounded-full border border-slate-200';

// Alexa Readiness.
export const STAT_TILES_GRID = 'grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] my-3.5';
export const READINESS_CATEGORIES = `${CARD} !py-1.5 !px-4.5`;
export const READINESS_ROW = 'border-b border-slate-200 py-3 last:border-b-0';
export const MINI_BAR_TRACK = 'w-[60px] h-1.5 rounded-full bg-slate-100 overflow-hidden';

// Shared across Research/New Campaign (and later A+/Strategy) pages.
export const ICON_LABEL = 'inline-flex items-center gap-1.5';
export const THUMBS = 'flex gap-2 flex-wrap my-2';
export const ERROR_TEXT = 'text-red-600';

export const STAT_TILE = 'rounded-[10px] p-3.5 px-4 flex flex-col gap-0.5';
export const STAT_TILE_VALUE = 'text-xl leading-tight';
export const STAT_TILE_LABEL = 'text-xs text-slate-500';
export const STAT_TILE_VARIANTS = {
  violet: { tile: 'bg-violet-50', text: 'text-violet-600' },
  blue: { tile: 'bg-brand-50', text: 'text-brand-600' },
  green: { tile: 'bg-emerald-50', text: 'text-emerald-600' },
  amber: { tile: 'bg-amber-50', text: 'text-amber-600' },
};

export const DASH_GRID = 'grid grid-cols-1 gap-5 items-start [@media(min-width:900px)]:grid-cols-2';

export const THEME_COLS = 'grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]';
export const THEME_COL = 'rounded-[10px] p-3 px-3.5';
export const THEME_COL_GOOD = `${THEME_COL} bg-emerald-50`;
export const THEME_COL_BAD = `${THEME_COL} bg-red-50`;
export const THEME_COL_BLUE = `${THEME_COL} bg-brand-50`;
export const THEME_ITEM = 'mb-2.5 text-[13px]';

export const TABLE_WRAP = 'overflow-x-auto';
export const TABLE = 'w-full border-collapse text-[13px]';
export const TH = 'text-left px-2.5 py-2 border-b border-slate-200 align-top text-slate-500 font-semibold';
export const TD = 'text-left px-2.5 py-2 border-b border-slate-200 align-top';

export const SERP_GRID = 'grid gap-3 mt-2.5 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]';
export const SERP_ITEM = 'border border-slate-200 rounded-[10px] p-2.5 text-slate-900 text-xs bg-white';
export const SERP_ITEM_SELECTABLE = `${SERP_ITEM} relative cursor-pointer flex flex-col gap-1.5 w-full text-left`;
export const SERP_ITEM_SELECTED = 'border-brand-600 shadow-[0_0_0_2px_rgba(2,132,199,0.15)]';
export const SERP_IMG = 'w-full aspect-square object-contain bg-white rounded-md';
export const SERP_THUMB_EMPTY = 'w-full aspect-square bg-slate-100 rounded-md grid place-items-center text-slate-500';
export const SERP_TITLE = 'overflow-hidden text-ellipsis my-1.5 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]';
export const SERP_YOU = 'border-2 border-brand-600 outline outline-[3px] outline-brand-100';
// Structural only — no color classes here. Tailwind utility classes have equal specificity,
// so when a color class lives in this base and a *different* value for the same CSS property
// lives in a variant applied alongside it, which one wins depends on generated stylesheet
// order, not JSX order — not "last one in the string wins" like inline styles. Concretely,
// this used to carry `bg-white`/`border-slate-200`/`text-transparent` as defaults meant to be
// overridden by SERP_CHECK_SELECTED's `bg-brand-600`/`border-brand-600`/`text-white`, and the
// override silently lost for background/text color, leaving the "selected" checkmark
// permanently invisible. Fix: SERP_CHECK_UNSELECTED and SERP_CHECK_SELECTED are now full,
// mutually-exclusive class sets — pick exactly one via a ternary, never both at once.
export const SERP_CHECK = 'absolute top-2 right-2 w-5 h-5 rounded-md grid place-items-center border-[1.5px] transition-colors';
export const SERP_CHECK_UNSELECTED = 'bg-white border-slate-200';
export const SERP_CHECK_SELECTED = 'bg-brand-600 border-brand-600 text-white';

export const IMPACT_CARD = 'border-l-[3px] rounded-lg py-2.5 px-3.5 mb-3 text-sm';
export const IMPACT_BAD = `${IMPACT_CARD} border-red-600 bg-red-50`;
export const IMPACT_GOOD = `${IMPACT_CARD} border-emerald-600 bg-emerald-50`;
export const QUOTE = 'text-slate-500 italic my-1';

export const ISSUE_WARN = 'flex items-start gap-2 border-l-[3px] border-amber-600 bg-amber-50 text-amber-700 rounded-lg py-2.5 px-3.5 my-2.5 text-[13px]';

export const ROW = 'flex gap-2.5 items-center';
export const GRID2 = 'grid grid-cols-1 sm:grid-cols-2 gap-x-4';
export const MARKETPLACE_SELECT = 'w-auto flex-shrink-0 px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-900';
export const CHECK_ROW = 'flex items-start gap-2.5 bg-transparent border-none p-0 mb-4 text-left cursor-pointer text-sm text-slate-900';
export const CHECK_BOX = 'w-[18px] h-[18px] flex-shrink-0 mt-0.5 rounded-[5px] border-[1.5px] border-slate-200 grid place-items-center text-transparent transition-colors';
export const CHECK_BOX_CHECKED = 'bg-brand-600 border-brand-600 text-white';
export const SETTINGS_CARD_TITLE = 'text-xs uppercase tracking-wide text-slate-500 mb-3';

// Strategy page — customer avatar card, marketing angle cards, filtered-out/impact lists.
// NOTE: ICON_LABEL, IMPACT_CARD, IMPACT_GOOD, IMPACT_BAD are already defined above
// (shared with Research/New Campaign) — reuse those rather than redeclaring; the
// avatar traits/pain-points/motivations lists here use their own AVATAR_IMPACT_*
// variants since their visual treatment (plain background+border, no left accent
// bar) differs from the shared IMPACT_CARD's border-l-3 style.
export const NOTICE_WARN = 'flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3.5 py-2.5 mb-4 text-sm';
export const AVATAR_CARD = CARD;
export const AVATAR_HEAD = 'flex items-center justify-between gap-3 mb-3 flex-wrap';
export const AVATAR_TRAITS = 'grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] mb-4';
export const AVATAR_TRAIT = 'rounded-xl p-3 border';
export const AVATAR_TRAIT_BLUE = 'bg-brand-50 border-brand-200';
export const AVATAR_TRAIT_VIOLET = 'bg-violet-50 border-violet-200';
export const AVATAR_TRAIT_WARN = 'bg-amber-50 border-amber-200';
export const AVATAR_LISTS = 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]';
export const AVATAR_IMPACT_CARD = 'rounded-lg px-3 py-2 mb-1.5 text-sm border';
export const AVATAR_IMPACT_GOOD = 'bg-emerald-50 border-emerald-200 text-emerald-700';
export const AVATAR_IMPACT_BAD = 'bg-red-50 border-red-200 text-red-700';
export const IMPACT_NEUTRAL = 'bg-slate-100 border-slate-200 text-slate-600';
export const ANGLE_CARD = `${CARD} text-left w-full transition-colors hover:border-brand-500 cursor-pointer`;
export const ANGLE_PREVIEW = 'text-slate-600 text-[13px] mt-1.5 line-clamp-3';
export const MODAL_SECTION = 'mb-3.5';
export const MODAL_SECTION_TITLE = 'text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1';

// Listing & Images page — concept picker cards, generated-image gallery.
export const CONCEPT_CARD = CARD;
export const GALLERY = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] mb-4';
export const GEN_CARD = 'hover-lift relative flex flex-col rounded-xl overflow-hidden border border-slate-200 bg-white shadow-card hover:shadow-card-hover group';
export const GEN_CARD_IMG = 'w-full aspect-square object-cover block';
export const GEN_CARD_REMOVE =
  'absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 text-slate-500 grid place-items-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600';
export const GEN_CARD_EDIT =
  'absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-white/90 text-slate-500 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-brand-600';
// Text overlaid on a photo (any photo — busy backgrounds, bright/dark areas) never reads
// cleanly regardless of pill shape or clamping, so the type tag + concept name live in a
// plain footer strip below the image instead of on top of it.
export const GEN_CARD_FOOTER = 'px-2 py-1.5 bg-white border-t border-slate-200 flex flex-col gap-1';
export const GEN_CARD_TYPE_BADGE =
  'self-start text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600';
export const GEN_CARD_CONCEPT_LABEL =
  'text-[11px] text-emerald-700 font-medium leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden';
export const GEN_CARD_BADGES = 'absolute bottom-1.5 left-1.5 flex gap-1 flex-wrap';

// Module Editor (A+ concept editor) — module list rail, canvas, compliance footer, image slots.
export const EDITOR_GRID = 'grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3.5 items-start';
export const EDITOR_LIST = `${CARD} !p-2.5 flex flex-col gap-1.5`;
export const MODULE_ITEM =
  'flex justify-between items-center gap-1.5 w-full text-left px-2.5 py-2.5 rounded-lg border border-transparent bg-transparent cursor-pointer text-[13px] transition-colors hover:bg-slate-100';
export const MODULE_ITEM_ACTIVE = 'border-brand-600 bg-brand-50';
export const EDITOR_CANVAS = `${CARD} min-h-[400px]`;
export const EDITOR_FOOTER = `${CARD} mt-3.5`;
export const EDITOR_ISSUE = 'block w-full text-left bg-transparent border-none cursor-pointer text-xs px-2 py-1.5 rounded-md mb-1';
export const EDITOR_ISSUE_ERROR = 'bg-red-50 text-red-600';
export const EDITOR_ISSUE_WARN = 'bg-amber-50 text-amber-600';

export const SLOT_ROW = 'flex flex-col gap-3 mb-3.5';
export const SLOT_ROW_MULTI = 'grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-3.5';
export const SLOT_BLOCK = 'flex flex-col gap-1.5';
export const SLOT_BLOCK_MULTI = 'flex flex-col gap-1.5 min-w-0';
export const SLOT = 'relative border border-dashed border-slate-200 rounded-lg overflow-hidden bg-slate-100 max-h-[340px]';
export const SLOT_IMG = 'w-full h-full object-cover block';
export const SLOT_EMPTY = 'absolute inset-0 grid place-items-center text-center text-slate-500 text-[13px] p-2';
export const SLOT_ACTIONS = 'absolute bottom-1.5 left-1.5 right-1.5 flex gap-1.5 flex-wrap';
export const SLOT_ACTION_BTN = `${BTN_SMALL} !bg-white/95`;
export const SLOT_UPSCALED_BADGE = `${BADGE_GOOD} absolute top-1.5 left-1.5`;
export const SLOT_PROMPT_PREVIEW = 'mt-1.5';
export const SLOT_PROMPT_PRE =
  'whitespace-pre-wrap break-words mt-1.5 p-2 bg-slate-100 border border-slate-200 rounded-md text-slate-500 text-xs';

export const CANDIDATE_ROW = 'my-2.5 mb-3.5';
export const CANDIDATES = 'flex gap-2.5 flex-wrap mt-1.5';
export const CANDIDATE = 'relative border-2 border-slate-200 rounded-lg p-0 bg-transparent cursor-pointer overflow-hidden w-[130px]';
export const CANDIDATE_SELECTED = 'border-brand-600';
export const CANDIDATE_BADGE = `${BADGE_GOOD} absolute bottom-1 left-1`;

export const FIELD_LABEL = 'flex flex-col gap-1 text-sm text-slate-900 mb-3.5';
export const FIELD_LABEL_INVALID = 'text-red-600';
export const FIELD_COUNTER = 'text-xs text-slate-500';
export const FIELD_COUNTER_OVER = 'text-red-600';
export const FIELD_INPUT =
  'px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 transition-shadow focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
export const FIELD_INPUT_INVALID = 'border-red-600';

export const WIZARD_STEPS = 'flex gap-2 flex-wrap mb-4';
export const WIZARD_STEP =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-500 text-xs cursor-pointer';
export const WIZARD_STEP_ACTIVE = 'border-brand-600 bg-brand-50 text-brand-600';
export const WIZARD_STEP_DONE = 'text-emerald-600';
export const STEP_NUM =
  'inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-[10px] font-semibold';

export const CONCEPT_SELECT_CARD = `${CARD} !mb-0 cursor-pointer flex flex-col gap-1`;
export const CONCEPT_SELECT_CARD_SELECTED = 'border-brand-600 shadow-[0_0_0_2px_rgba(2,132,199,0.15)]';

export const DOWNLOAD_ROW = 'flex gap-2.5 flex-wrap';
export const COPY_BOX = 'bg-white border border-slate-200 rounded-lg p-3 mb-2 text-sm text-slate-900';
export const COPY_BOX_SMALL = 'text-slate-600';
