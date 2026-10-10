// ─────────────────────────────────────────────────────────
//  Tour step definitions.
//
//  A step is data, never a component: the runner (TourProvider)
//  owns navigation, waiting and persistence, so a step only says
//  *where* it points and *what* it says.
//
//  Fields:
//    id       — stable slug, emitted in analytics. Rename deliberately.
//    target   — a TOUR id, or null for a centred message with no anchor.
//    route    — pathname the step lives on; the runner navigates there
//               first. Omit to stay wherever the user already is.
//    search   — query string the page needs before the target exists
//               (e.g. the dashboard tab that renders it).
//    side     — preferred popover placement; the runner flips it when
//               there is no room.
//    required — the element is guaranteed to be in the DOM for every
//               tenant role. Everything else is treated as optional and
//               silently skipped when absent, which is what makes one
//               step list work across permissions, empty states and
//               tabs without a `when` predicate per step.
// ─────────────────────────────────────────────────────────

import { TOUR } from './targets';

export const TENANT_ONBOARDING = 'tenant-onboarding';
export const MARKETPLACE_SETTINGS = 'marketplace-settings';
export const PAYMENTS_TOUR = 'payments-calculations';
export const COST_SHEET_TOUR = 'cost-sheet';
export const DOWNLOADS_TOUR = 'downloads';
export const SCAN_RETURNS_TOUR = 'scan-returns';
export const SUPPORT_TOUR = 'support';
export const USER_MANAGEMENT_TOUR = 'user-management';
export const BILLING_TOUR = 'billing';

export const TENANT_ONBOARDING_STEPS = [
    {
        id: 'welcome',
        target: null,
        route: '/dashboard',
        required: true,
        side: 'center',
        title: 'Welcome to SpeedEcom \ud83d\udc4b',
        body: 'Four things stand between you and your first profit figure: connect a marketplace, upload your reports, fill in your costs, then calculate. This walks you through them in order. You can leave any time and pick it up again from the sidebar.',
    },
    {
        id: 'nav-dashboard',
        target: TOUR.nav.dashboard,
        route: '/dashboard',
        required: true,
        side: 'right',
        title: 'This is home',
        body: 'Everything lands back here — settlements, ads, returns, and the calculations that tie them together. Let us get some data into it.',
    },

    // ── 1. Connect a marketplace ─────────────────────────────
    {
        id: 'connect-nav',
        target: TOUR.nav.settings,
        route: '/dashboard',
        side: 'right',
        title: 'First: connect a marketplace',
        body: 'Nothing works until SpeedEcom can see one of your seller accounts. That lives under Settings → Marketplace.',
    },
    {
        id: 'connect-card',
        target: TOUR.marketplace.card,
        route: '/settings/marketplace',
        side: 'right',
        title: 'One card per marketplace',
        body: 'Each card shows whether that marketplace is connected and how many of your accounts are attached. You can connect several accounts to the same marketplace.',
    },
    {
        id: 'connect-button',
        target: TOUR.marketplace.connectBtn,
        route: '/settings/marketplace',
        side: 'right',
        title: 'Connect your seller account',
        body: 'This opens a form for that marketplace\'s credentials. Which fields you get depends on how the marketplace signs you in — email, phone, or a redirect.',
    },

    // ── 2. Upload the reports ────────────────────────────────
    {
        id: 'nav-uploads',
        target: TOUR.nav.uploads,
        route: '/settings/marketplace',
        side: 'right',
        title: 'Next: bring in your reports',
        body: 'A connected account tells us who you are; your marketplace reports are what we actually calculate from.',
    },
    {
        id: 'uploads-account',
        target: TOUR.uploads.accountSelect,
        route: '/uploads',
        side: 'right',
        title: 'Step 1 — the account',
        body: 'Pick the marketplace account the report came from. Getting this wrong is the most common cause of numbers that look off later.',
    },
    {
        id: 'uploads-type',
        target: TOUR.uploads.typeGrid,
        route: '/uploads',
        side: 'right',
        title: 'Step 2 — the report type',
        body: 'Orders, settlements, ads and returns are separate uploads. Each marketplace names its exports differently, so every card carries a tutorial link.',
    },
    {
        id: 'uploads-file',
        target: TOUR.uploads.fileSelector,
        route: '/uploads',
        side: 'top',
        title: 'Step 3 — the file',
        body: 'Drop the file in exactly as the marketplace exported it — no re-saving or column edits. Processing continues in the background, so you can leave the page.',
    },
    {
        id: 'uploads-history',
        target: TOUR.uploads.tabHistory,
        route: '/uploads',
        side: 'bottom',
        title: 'Checking an upload later',
        body: 'Every upload and its outcome lives here. If a calculation looks wrong, this is the first place to look — a rejected file is usually why.',
    },

    // ── 3. Choose what to work on ────────────────────────────
    {
        id: 'filter-root',
        target: TOUR.filter.root,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'bottom',
        title: 'Back here, start by narrowing the data',
        body: 'Everything below reacts to this panel, and nothing calculates until you have picked at least one account and a date range.',
    },
    {
        id: 'filter-marketplace',
        target: TOUR.filter.marketplace,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'bottom',
        title: 'Switching between accounts',
        body: 'Every connected account appears here — this is where you switch between them, or select several to compare in one calculation. Until you connect one, an example is shown in its place.',
    },
    {
        id: 'filter-date',
        target: TOUR.filter.date,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'bottom',
        title: 'Then the date range',
        body: 'Calculations run over a window rather than all history — keep it to the months you actually uploaded reports for.',
    },

    // ── 4. Cost sheet, then calculate ────────────────────────
    {
        id: 'calc-workflow',
        target: TOUR.calc.workflow,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'bottom',
        title: 'The workflow, in three stages',
        body: 'Upload reports, generate and fill the cost sheet, then calculate. This strip always tells you which stage you are waiting on.',
    },
    {
        id: 'calc-generate-cost-sheet',
        target: TOUR.calc.generateCostSheetBtn,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'top',
        title: 'Generate the cost sheet',
        body: 'This builds a sheet listing every SKU found in your uploads. It is empty of costs to begin with — that part only you know.',
    },
    {
        id: 'calc-open-cost-sheet',
        target: TOUR.calc.openCostSheetBtn,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'top',
        title: 'Open it and fill in your costs',
        body: 'Enter what each SKU costs you — product, packaging, shipping. It edits like a spreadsheet, and you can paste a column straight from Excel. Profit figures are only as honest as what you put here.',
    },
    {
        id: 'calc-calculate',
        target: TOUR.calc.calculateBtn,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'top',
        title: 'Now calculate',
        body: 'This matches orders against settlements, ads and returns for the window you chose, and applies your costs. It stays disabled until the reports it needs are in — the message above says which one is missing.',
    },
    {
        id: 'calc-show',
        target: TOUR.calc.showCalculationsBtn,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'top',
        title: 'Read the results',
        body: 'Opens the per-order breakdown in a new tab: what each order sold for, what the marketplace deducted, and what you actually kept.',
    },

    // ── 5. The rest of the product ───────────────────────────
    {
        id: 'dash-tabs',
        target: TOUR.dash.tabs,
        route: '/dashboard',
        search: '?tab=calculations',
        side: 'bottom',
        title: 'The other views',
        body: 'Action Required lists what needs a decision today. Payments, Ads and Returns break down each source behind the calculation you just ran.',
    },
    {
        id: 'nav-speedy-ai',
        target: TOUR.nav.speedyAi,
        route: '/dashboard',
        side: 'right',
        title: 'Ask instead of clicking',
        body: 'Speedy AI answers questions about your own data — "which SKUs lost money last month?" — without you building a single filter.',
    },
    {
        id: 'nav-profile',
        target: TOUR.nav.profile,
        route: '/dashboard',
        required: true,
        side: 'top',
        title: 'Your account',
        body: 'Profile, password and business details live here.',
    },
    {
        id: 'finish',
        target: null,
        required: true,
        side: 'center',
        title: 'That is the tour',
        body: 'Start at step one: connect a marketplace under Settings. Every page also has its own short tour behind the button in its header, and you can replay this one from the sidebar.',
    },
];

// ── Page tours ───────────────────────────────────────────────────────────
// Scoped to a single screen, unlike the onboarding tour that walks across
// several. Short enough to replay from the page's own launcher.

export const MARKETPLACE_SETTINGS_STEPS = [
    {
        id: 'mp-header',
        target: TOUR.marketplace.header,
        route: '/settings/marketplace',
        required: true,
        side: 'bottom',
        title: 'Marketplace management',
        body: 'This page is the prerequisite for everything else — no orders, settlements or calculations exist until at least one marketplace account is connected here.',
    },
    {
        id: 'mp-grid',
        target: TOUR.marketplace.grid,
        route: '/settings/marketplace',
        side: 'top',
        title: 'Every marketplace we support',
        body: 'One card per marketplace. Anything marked "Coming Soon" is not available yet — the rest you can connect right now.',
    },
    {
        id: 'mp-card',
        target: TOUR.marketplace.card,
        route: '/settings/marketplace',
        side: 'right',
        title: 'A card tells you its status',
        body: 'Each card shows whether that marketplace is connected and how many of your accounts are attached to it. You can connect several accounts per marketplace.',
    },
    {
        id: 'mp-connect',
        target: TOUR.marketplace.connectBtn,
        route: '/settings/marketplace',
        side: 'right',
        title: 'Connecting an account',
        body: 'This opens a form for that marketplace\'s seller credentials. Which fields you get depends on how the marketplace authenticates — email, phone, or a sign-in redirect.',
    },
    {
        id: 'mp-see-connected',
        target: TOUR.marketplace.seeConnectedBtn,
        route: '/settings/marketplace',
        side: 'right',
        title: 'Managing what you connected',
        body: 'Once a marketplace has accounts, this replaces Connect. Inside you can add another account, update credentials, change the analysis start date, or disconnect.',
    },
    {
        id: 'mp-connected-only',
        target: TOUR.marketplace.connectedOnlyToggle,
        route: '/settings/marketplace',
        side: 'bottom',
        title: 'Filtering the grid',
        body: 'Once you have several marketplaces live, this hides the ones you have not connected.',
    },
    {
        id: 'mp-launcher',
        target: TOUR.common.tourLauncher,
        route: '/settings/marketplace',
        required: true,
        side: 'bottom',
        title: 'Replay any time',
        body: 'Next: connect an account, then head to Uploads to bring in your first report. This button replays this page\'s tour whenever you need it.',
    },
];

export const PAYMENTS_STEPS = [
    {
        id: 'pay-header',
        target: TOUR.payments.header,
        route: '/payments/calculations',
        required: true,
        side: 'bottom',
        title: 'Calculations, order by order',
        body: 'This is the output of a dashboard calculation: every order matched against its settlement, ads spend and returns, so you can see what each one actually earned.',
    },
    {
        id: 'pay-view-switch',
        target: TOUR.payments.viewSwitch,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Two ways to read it',
        body: 'SKU-Wise lists every individual SKU. Master-SKU rolls variants of the same product into one line — the better view when sizes and colours are separate SKUs.',
    },
    {
        id: 'pay-panel-toggle',
        target: TOUR.payments.panelToggle,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Summary and filters',
        body: 'Opens the panel with the funnel summary and the full filter set — marketplace, warehouse, brand, return status, GST mode.',
    },
    {
        id: 'pay-funnel',
        target: TOUR.payments.funnel,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Where the money went',
        body: 'The funnel breaks gross sales down through each deduction to what actually landed. Start here when a number looks wrong — it shows which stage swallowed it.',
    },
    {
        id: 'pay-table',
        target: TOUR.payments.table,
        route: '/payments/calculations',
        side: 'top',
        title: 'The detail table',
        body: 'Sort any column, drag to reorder them, and pick which ones you care about. Expanding a row shows the individual orders behind that SKU.',
    },
    {
        id: 'pay-settlements',
        target: TOUR.payments.settlementsBtn,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Reconciling against the bank',
        body: 'Switches to the settlement view, grouped by payment date, so you can tie these figures to what the marketplace actually paid into your account.',
    },
    {
        id: 'pay-export',
        target: TOUR.payments.exportBtn,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Export it',
        body: 'Queues a spreadsheet of the current view with your filters applied. It builds in the background and appears on the Downloads page.',
    },
];

export const COST_SHEET_STEPS = [
    {
        id: 'cs-header',
        target: TOUR.costSheet.header,
        route: '/cost-sheet',
        required: true,
        side: 'bottom',
        title: 'The cost sheet',
        body: 'Your own costs, per SKU — what you paid for the product, packaging, shipping. Calculations use these to turn revenue into actual profit, so an empty cost sheet means profit figures you cannot trust.',
    },
    {
        id: 'cs-account-filter',
        target: TOUR.costSheet.accountFilter,
        route: '/cost-sheet',
        side: 'bottom',
        title: 'Scope it to an account',
        body: 'Costs are held per marketplace account, since the same SKU can cost you differently depending on where it ships from.',
    },
    {
        id: 'cs-table',
        target: TOUR.costSheet.table,
        route: '/cost-sheet',
        side: 'top',
        title: 'Edit it like a spreadsheet',
        body: 'Editable cells behave the way you expect: type into one, drag to fill a range, paste a column straight from Excel, and undo with the usual shortcut.',
    },
    {
        id: 'cs-add-sku',
        target: TOUR.costSheet.addSku,
        route: '/cost-sheet',
        side: 'bottom',
        title: 'Adding a SKU by hand',
        body: 'SKUs normally arrive from your uploaded reports. Use this when you need a row for something that has not sold yet.',
    },
    {
        id: 'cs-save',
        target: TOUR.costSheet.saveBtn,
        route: '/cost-sheet',
        side: 'left',
        title: 'Nothing saves on its own',
        body: 'Edits stay local until you press this — the header counts your unsaved changes. Re-run the calculation afterwards for the new costs to reach your numbers.',
    },
];

export const DOWNLOADS_STEPS = [
    {
        id: 'dl-header',
        target: TOUR.downloads.header,
        route: '/downloads',
        required: true,
        side: 'bottom',
        title: 'Your exports land here',
        body: 'Exports requested from the dashboard, cost sheet or payments pages are built in the background. This is where they show up when they are ready.',
    },
    {
        id: 'dl-filters',
        target: TOUR.downloads.filters,
        route: '/downloads',
        side: 'bottom',
        title: 'Finding one',
        body: 'Filter by export type, marketplace account, or status once the list gets long.',
    },
    {
        id: 'dl-table',
        target: TOUR.downloads.table,
        route: '/downloads',
        side: 'top',
        title: 'Status and expiry',
        body: 'A row moves from Pending to Processing to Ready. Note the Expires column — generated files are cleared after a while, so download anything you need to keep.',
    },
    {
        id: 'dl-download',
        target: TOUR.downloads.downloadBtn,
        route: '/downloads',
        side: 'left',
        title: 'Getting the file',
        body: 'Available once the export reports Ready. A failed export shows why instead.',
    },
];

export const SCAN_RETURNS_STEPS = [
    {
        id: 'sr-header',
        target: TOUR.scanReturns.header,
        route: '/returns/scan',
        required: true,
        side: 'bottom',
        title: 'Logging returns as they arrive',
        body: 'Scan returned parcels as they come back so the returns figures in your dashboard reflect what physically reached you, not just what the marketplace claims.',
    },
    {
        id: 'sr-input',
        target: TOUR.scanReturns.input,
        route: '/returns/scan',
        side: 'bottom',
        title: 'Scan or type',
        body: 'A barcode scanner types into this box and submits for you. You can also enter a tracking ID, AWB or order ID by hand.',
    },
    {
        id: 'sr-condition',
        target: TOUR.scanReturns.conditionToggle,
        route: '/returns/scan',
        side: 'bottom',
        title: 'Good or damaged',
        body: 'Set this before scanning. Damaged mode stays on for every scan until you switch it back, so a batch of damaged returns does not need toggling each time.',
    },
    {
        id: 'sr-scanned',
        target: TOUR.scanReturns.scannedItems,
        route: '/returns/scan',
        side: 'left',
        title: 'What you have scanned',
        body: 'Each scan lands here immediately, so you can catch a double-scan or a wrong parcel while it is still in your hand.',
    },
    {
        id: 'sr-tabs',
        target: TOUR.scanReturns.tabs,
        route: '/returns/scan',
        side: 'bottom',
        title: 'Today, and the unmatched ones',
        body: 'Today\'s Scan is the running log. Unverified holds scans that matched no known return — usually a parcel from a marketplace you have not uploaded reports for yet.',
    },
];

export const SUPPORT_STEPS = [
    {
        id: 'sup-header',
        target: TOUR.support.header,
        route: '/support',
        required: true,
        side: 'bottom',
        title: 'Getting help',
        body: 'Raise anything here rather than by email — tickets are tied to your account, so whoever picks it up can already see your data.',
    },
    {
        id: 'sup-create',
        target: TOUR.support.createBtn,
        route: '/support',
        side: 'bottom',
        title: 'Raising a ticket',
        body: 'Describe the problem and attach a screenshot if you have one. For a number that looks wrong, say which marketplace and date range — that is what gets it answered fastest.',
    },
    {
        id: 'sup-list',
        target: TOUR.support.ticketList,
        route: '/support',
        side: 'top',
        title: 'Your tickets',
        body: 'Every ticket you have raised, with its replies. Open one to continue the conversation; once it is resolved you can rate how it went.',
    },
    {
        id: 'sup-status',
        target: TOUR.support.statusFilter,
        route: '/support',
        side: 'bottom',
        title: 'Filtering by status',
        body: 'Narrow to Open or In Progress when you only care about what is still outstanding.',
    },
];

export const USER_MANAGEMENT_STEPS = [
    {
        id: 'um-header',
        target: TOUR.users.header,
        route: '/users',
        required: true,
        side: 'bottom',
        title: 'Your team',
        body: 'Everyone who can sign in to your account. Each person gets their own login rather than sharing yours.',
    },
    {
        id: 'um-add',
        target: TOUR.users.addUserBtn,
        route: '/users',
        side: 'bottom',
        title: 'Adding someone',
        body: 'Create the user and hand them the credentials shown. If you let the system generate a password, copy it there and then — it is not shown again.',
    },
    {
        id: 'um-permissions',
        target: TOUR.users.permissionsColumn,
        route: '/users',
        side: 'bottom',
        title: 'Permissions are per person',
        body: 'Every page and dashboard tab can be granted separately, so a warehouse hand can scan returns without seeing your margins or your billing.',
    },
    {
        id: 'um-table',
        target: TOUR.users.table,
        route: '/users',
        side: 'top',
        title: 'Editing later',
        body: 'Change permissions or remove access from the row itself. Changes apply the next time that user\'s session refreshes, within about a minute.',
    },
];

export const BILLING_STEPS = [
    {
        id: 'bill-header',
        target: TOUR.billing.header,
        route: '/subscription',
        required: true,
        side: 'bottom',
        title: 'Credits and billing',
        body: 'SpeedEcom runs on credits — processing uploads and running calculations draws them down. This page is where you top up and see what you have spent.',
    },
    {
        id: 'bill-plans',
        target: TOUR.billing.plans,
        route: '/subscription',
        side: 'top',
        title: 'The plans',
        body: 'Each plan buys a block of credits. Prices shown exclude 18% GST, which is added at checkout.',
    },
    {
        id: 'bill-buy',
        target: TOUR.billing.buyBtn,
        route: '/subscription',
        side: 'top',
        title: 'Buying credits',
        body: 'Card payments activate the credits immediately. If online payment is not enabled for your account, support can add them manually instead.',
    },
    {
        id: 'bill-history',
        target: TOUR.billing.history,
        route: '/subscription',
        side: 'top',
        title: 'Payments and invoices',
        body: 'Every payment with its GST invoice, ready to download for your accountant.',
    },
];

/**
 * Every tour the app knows about, keyed for the runner and the API.
 *
 * `autoStart` is the whole policy for a tour starting on its own — set it to
 * null for launcher-only tours. Keeping it as data means changing a tour from
 * "fires itself" to "button only" is a one-line edit here, not a change to the
 * runner.
 *
 *   roles    — who it may fire for.
 *   routes   — pathnames it may fire on. The user arrived at anything else
 *              deliberately, and hijacking that navigation is rude.
 *   requires — key of a tour that must already have a record (completed or
 *              skipped) before this one may fire. Stops a new tenant getting a
 *              page tour on top of the onboarding tour.
 */
export const TOURS = {
    [TENANT_ONBOARDING]: {
        key: TENANT_ONBOARDING,
        steps: TENANT_ONBOARDING_STEPS,
        // Admin sees all of it; a standard User sees whichever steps their
        // permissions actually render.
        autoStart: {
            roles: ['Admin', 'User'],
            routes: ['/dashboard', '/uploads'],
            requires: null,
        },
    },
    [MARKETPLACE_SETTINGS]: {
        key: MARKETPLACE_SETTINGS,
        steps: MARKETPLACE_SETTINGS_STEPS,
        // The one page tour that fires on its own: nothing in the product works
        // until an account is connected here. Every other page tour should be
        // launcher-only — set `autoStart: null` for those.
        autoStart: {
            roles: ['Admin', 'User'],
            routes: ['/settings/marketplace'],
            requires: TENANT_ONBOARDING,
        },
    },

    // Launcher-only from here down. A tenant who has just been walked through
    // onboarding should not meet a fresh overlay on every page they open next;
    // these wait to be asked for, via the button in each page header.
    [PAYMENTS_TOUR]: { key: PAYMENTS_TOUR, steps: PAYMENTS_STEPS, autoStart: null },
    [COST_SHEET_TOUR]: { key: COST_SHEET_TOUR, steps: COST_SHEET_STEPS, autoStart: null },
    [DOWNLOADS_TOUR]: { key: DOWNLOADS_TOUR, steps: DOWNLOADS_STEPS, autoStart: null },
    [SCAN_RETURNS_TOUR]: { key: SCAN_RETURNS_TOUR, steps: SCAN_RETURNS_STEPS, autoStart: null },
    [SUPPORT_TOUR]: { key: SUPPORT_TOUR, steps: SUPPORT_STEPS, autoStart: null },
    [USER_MANAGEMENT_TOUR]: { key: USER_MANAGEMENT_TOUR, steps: USER_MANAGEMENT_STEPS, autoStart: null },
    [BILLING_TOUR]: { key: BILLING_TOUR, steps: BILLING_STEPS, autoStart: null },
};