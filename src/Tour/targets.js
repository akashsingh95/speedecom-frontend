// ─────────────────────────────────────────────────────────
//  Tour targets — the single source of truth for every
//  `data-tour` attribute rendered by the app.
//
//  Components import a constant instead of typing the string,
//  so renaming a target is one edit here, and a typo throws in
//  dev instead of silently producing a tour step that points at
//  nothing. `ALL_TOUR_TARGETS` gives the (future) CI validator
//  the canonical list to assert against.
//
//  Naming: "<domain>.<element>", lowerCamelCase segments.
//  Where a target is conceptually nested, the nesting is folded
//  into the leaf name (nav.settingsMarketplace) rather than
//  using a real object tree — a string cannot also be a
//  namespace, and the flat form stays greppable.
//
//  Two rules keep this file honest:
//    1. Only list targets that are actually in the JSX today.
//       An id here with no element is a validator false-negative
//       waiting to happen.
//    2. These ids are emitted in analytics events, so treat them
//       as a public contract. Rename deliberately.
// ─────────────────────────────────────────────────────────

/** Builds `{ key: 'prefix.key' }` so the id and the accessor can never drift. */
const group = (prefix, keys) =>
    Object.freeze(Object.fromEntries(keys.map((key) => [key, `${prefix}.${key}`])));

// Property probes that JS/React perform on plain objects. Reading these must
// not throw, or spreading/serialising a group would blow up in dev.
const PROBES = new Set(['then', 'toJSON', 'constructor', 'prototype', '$$typeof', 'nodeType']);

/** Dev-only: turn `TOUR.nav.dashbord` into a loud error instead of `undefined`. */
const guard = (name, table) => {
    if (!import.meta.env?.DEV) return table;
    return new Proxy(table, {
        get(target, key, receiver) {
            if (typeof key === 'string' && !PROBES.has(key) && !(key in target)) {
                throw new Error(
                    `[tour] Unknown target "${name}.${key}". Add it to ` +
                    `client/src/tour/targets.js and to the element in the JSX.`,
                );
            }
            return Reflect.get(target, key, receiver);
        },
    });
};

const groups = {
    // tour/TourLauncher.jsx — one component, rendered by every page that has a
    // tour, so the id is shared rather than namespaced per page. Only one page
    // is mounted at a time, so a step can always anchor to "the launcher".
    common: group('common', [
        'tourLauncher',
    ]),

    // components/Sidebar.jsx — the four role-dependent menus.
    // Tenant and admin menus never render together, so ids that
    // read as duplicates (support) are safe; the admin variants are
    // named separately because they point at different routes.
    nav: group('nav', [
        'dashboard',
        'uploads',
        'downloads',
        'scanReturns',
        'support',
        'speedyAi',
        'settings',            // the collapsible Settings header
        'settingsMarketplace',
        'settingsUsers',
        'settingsBilling',
        'profile',
        'adminApprovals',
        'adminTenants',
        'adminPricing',
        'adminRoles',
        'adminInvoices',
        'adminSupport',
        'rmTenants',
    ]),

    // components/DashboardLayout.jsx — the shell every authenticated page sits in.
    layout: group('layout', [
        'root',                 // outer column; watch this for impersonation-banner reflow
        'main',                 // content column to the right of the sidebar
        'impersonationBanner',
        'exitView',
    ]),

    // pages/Dashboard.jsx
    dash: group('dash', [
        'tabs',
        'tabActions',
        'tabCalculations',
        'tabPayments',
        'tabAds',
        'tabReturns',
        'actionsStatusFilter',
        'actionsStats',
        'actionsTable',
    ]),

    // components/MarketplaceAccountFilter.jsx — shared by several dashboard tabs,
    // so it is namespaced by the component rather than by the page.
    // `root` exists in all three render branches (loading / empty / ready), so a
    // step can always anchor to something even before the accounts have loaded.
    filter: group('filter', [
        'root',
        'marketplace',
        'date',
    ]),

    // components/dashboard/CalculationsTab.jsx — the product's core screen.
    // The button ids sit on the wrapper divs, not the buttons, because each one
    // swaps between two states (Calculate/Recalculate, enabled/disabled tooltip)
    // and the wrapper is the element that survives both.
    calc: group('calc', [
        'workflow',
        'statusMessage',
        'calculateBtn',
        'progress',
        'showCalculationsBtn',
        'generateCostSheetBtn',
        'openCostSheetBtn',
    ]),

    // pages/MarketplaceSettings.jsx — the first screen a new tenant has to
    // finish, since nothing calculates until an account is connected.
    // `card` and `connectBtn` render once per marketplace; a step anchors to
    // whichever the browser returns first, which is the first in the grid.
    marketplace: group('marketplace', [
        'header',
        'connectedOnlyToggle',
        'grid',
        'card',
        'connectBtn',
        'seeConnectedBtn',
    ]),

    // pages/Downloads.jsx — `downloadBtn` renders once per completed export and
    // not at all while the list is empty.
    downloads: group('downloads', [
        'header',
        'filters',
        'table',
        'downloadBtn',
    ]),

    // pages/UserManagement.jsx — `addUserBtn` is hidden while impersonating.
    users: group('users', [
        'header',
        'addUserBtn',
        'search',
        'table',
        'permissionsColumn',
    ]),

    // pages/Subscription.jsx
    billing: group('billing', [
        'header',
        'plans',
        'buyBtn',
        'history',
    ]),

    // pages/CostSheet.jsx — a standalone page, opened in its own tab from the
    // dashboard rather than sitting inside DashboardLayout.
    costSheet: group('costSheet', [
        'header',
        'accountFilter',
        'saveBtn',
        'addSku',
        'table',
    ]),

    // components/calculations/CalculationsHeader.jsx (shared by the SKU-wise and
    // Master-SKU pages) plus pages/PaymentsCalculations.jsx for the two below it.
    // `exportBtn` only renders once a calculation has rows; `funnel` only when
    // the summary panel is open.
    payments: group('payments', [
        'header',
        'viewSwitch',
        'panelToggle',
        'settlementsBtn',
        'exportBtn',
        'funnel',
        'table',
    ]),

    // pages/ScanReturns.jsx
    scanReturns: group('scanReturns', [
        'header',
        'tabs',
        'conditionToggle',
        'input',
        'scannedItems',
    ]),

    // pages/SupportPortal.jsx
    support: group('support', [
        'header',
        'createBtn',
        'statusFilter',
        'ticketList',
    ]),

    // pages/Uploads.jsx
    uploads: group('uploads', [
        'tabNew',
        'tabHistory',
        'accountSelect',
        'typeGrid',
        'typeCardTutorial',     // renders once per card; a step anchors to the first
        'fileSelector',
        'queue',
    ]),
};

export const TOUR = Object.freeze(
    Object.fromEntries(Object.entries(groups).map(([name, table]) => [name, guard(name, table)])),
);

/** Every declared id, flat. Consumed by the CI target validator. */
export const ALL_TOUR_TARGETS = Object.freeze(
    Object.values(groups).flatMap((table) => Object.values(table)),
);

/** `tourSelector(TOUR.nav.dashboard)` → `[data-tour="nav.dashboard"]` */
export const tourSelector = (id) => `[data-tour="${id}"]`;