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

import { TOUR, tourSelector } from './targets';

export const TENANT_ONBOARDING = 'tenant-onboarding';
export const MARKETPLACE_SETTINGS = 'marketplace-settings';
export const MARKETPLACE_ONBOARDING_MEESHO = 'mp-onboarding-meesho';
export const MARKETPLACE_ONBOARDING_AMAZON = 'mp-onboarding-amazon';
export const MARKETPLACE_ONBOARDING_FLIPKART = 'mp-onboarding-flipkart';
export const MARKETPLACE_ONBOARDING_MYNTRA = 'mp-onboarding-myntra';
export const PAYMENTS_TOUR = 'payments-calculations';
export const COST_SHEET_TOUR = 'cost-sheet';
export const DOWNLOADS_TOUR = 'downloads';
export const SCAN_RETURNS_TOUR = 'scan-returns';
export const SUPPORT_TOUR = 'support';
export const USER_MANAGEMENT_TOUR = 'user-management';
export const BILLING_TOUR = 'billing';
export const UPLOAD_ONBOARDING = 'upload-onboarding';

export const getMarketplaceTourKey = (name) => {
    if (!name) return null;
    const norm = name.toLowerCase();
    if (norm.includes('meesho')) return MARKETPLACE_ONBOARDING_MEESHO;
    if (norm.includes('amazon')) return MARKETPLACE_ONBOARDING_AMAZON;
    if (norm.includes('flipkart')) return MARKETPLACE_ONBOARDING_FLIPKART;
    if (norm.includes('myntra')) return MARKETPLACE_ONBOARDING_MYNTRA;
    return null;
};

// The one report a new tenant is walked through uploading, per marketplace key.
export const PRIMARY_UPLOAD_TYPES = {
    meesho: 'meesho_payments',
    amazon: 'amazon_payments',
    flipkart: 'payments',
    myntra: 'myntra_payments',
};

export const DEFAULT_UPLOAD_FILE_LIMIT = 5;
export const UPLOAD_FILE_LIMITS = { myntra_payments: 30 };
export const getUploadFileLimit = (type) => UPLOAD_FILE_LIMITS[type] ?? DEFAULT_UPLOAD_FILE_LIMIT;

export const getPrimaryUploadType = (name) => {
    const norm = (name || '').toLowerCase();
    const slug = Object.keys(PRIMARY_UPLOAD_TYPES).find((key) => norm.includes(key));
    return slug ? PRIMARY_UPLOAD_TYPES[slug] : null;
};

export const TENANT_ONBOARDING_STEPS = [
    // ── 1. Guide user to Billing from Dashboard ──────────────
    {
        id: 'nav-billing',
        target: TOUR.nav.settingsBilling,
        route: '/dashboard',
        side: 'right',
        title: 'Step 1: Head to Billing & Credits',
        body: 'SpeedEcom operates on processing credits for report parsing, marketplace reconciliations, and SKU profit intelligence. Let\'s begin by funding your credit wallet. Click "Billing" in the sidebar or "Go to Billing ➔" below to view available plans.',
        nextButtonText: 'Go to Billing ➔',
    },

    // ── 2. Billing Credits Introduction (Centered on /subscription) ──
    {
        id: 'bill-intro',
        target: null,
        route: '/subscription',
        side: 'center',
        isBillingIntro: true,
        title: 'Understanding SpeedEcom Processing Credits',
        body: 'SpeedEcom runs on flexible, pay-as-you-go processing credits instead of rigid recurring subscriptions. Here is how your credit wallet works:',
        nextButtonText: 'Explore Plans ➔',
    },

    // ── 3. Explore Basic Boost Plan ──
    {
        id: 'bill-plan-basic',
        target: TOUR.billing.planBasic,
        route: '/subscription',
        required: true,
        side: 'auto',
        title: '1. Basic Boost Plan (₹5,000)',
        body: 'Recharge with ₹5,000 to receive 5,000 processing credits. Ideal for light order volume, exploratory reconciliations, and testing with 30 days of Speedy AI access.',
        nextButtonText: 'Next Plan ➔',
    },

    // ── 4. Explore Value Plus Plan ──
    {
        id: 'bill-plan-value',
        target: TOUR.billing.planValue,
        route: '/subscription',
        required: true,
        side: 'auto',
        title: '2. Value Plus Plan (₹10,000)',
        body: 'Our most popular tier for growing merchants. 10,000 processing credits with 100% rollover, multi-marketplace analytics, advanced FAQ templates, and continuous AI assistance with zero expiry.',
        nextButtonText: 'Next Plan ➔',
    },

    // ── 5. Explore Premium Power Plan ──
    {
        id: 'bill-plan-premium',
        target: TOUR.billing.planPremium,
        route: '/subscription',
        required: true,
        side: 'auto',
        title: '3. Premium Power Plan (₹20,000)',
        body: 'Built for high-volume catalogs. 20,000 credits, unlimited AI queries, 24/7 priority support, deep marketplace intelligence, and advanced SKU exports. Click below to complete plan exploration and choose any tier.',
        lastButtonText: 'Proceed to Plan Selection ➔',
    },

    // ── 6. Marketplace Selection Step ──
    {
        id: 'mp-select',
        target: TOUR.marketplace.grid,
        route: '/settings/marketplace',
        side: 'center',
        isMarketplaceSelect: true,
        title: 'Step 2: Connect Your First Marketplace',
        body: 'SpeedEcom synchronizes with all major Indian ecommerce marketplaces. Which marketplace do you want to connect first? Choose any platform to begin guided setup:',
        nextButtonText: 'Select Marketplace ➔',
    },
];

// ─────────────────────────────────────────────────────────
//  Dedicated Onboarding Tours per Marketplace
// ─────────────────────────────────────────────────────────

export const MEESHO_ONBOARDING_STEPS = [
    {
        id: 'mp-meesho-account-name',
        target: TOUR.marketplace.modalAccountName,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'accountName',
        title: 'Enter Account Name',
        body: 'Enter a unique nickname or store name for this Meesho account (e.g. your store or brand name). This helps you identify and manage this connection across reports.',
        nextButtonText: 'Next: Analysis Date ➔',
    },
    {
        id: 'mp-meesho-analysis-date',
        target: TOUR.marketplace.modalAnalysisDate,
        route: '/settings/marketplace',
        required: true,
        side: 'top',
        title: 'Select Analysis Start Date',
        body: 'Reports and calculations will be available from the selected month onward, and processing credits will be deducted according to the selected analysis period. Choose this date carefully, as historical synchronization begins from this cutoff.',
        nextButtonText: 'Next: Size-wise Setting ➔',
    },
    {
        id: 'mp-meesho-sizewise',
        target: TOUR.marketplace.modalSizeWiseToggle,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        title: 'Size-wise Calculations Setting',
        body: 'Do your SKUs have different size variants (e.g. S, M, L, XL)? If enabled, SpeedEcom calculates P&L, returns, and courier weight charges separately per size. If you sell single-size items, you can keep this disabled.',
        nextButtonText: 'Next: Panel Email ➔',
    },
    {
        id: 'mp-meesho-email',
        target: TOUR.marketplace.modalEmail,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'email',
        title: 'Enter Meesho Panel Email',
        body: 'Enter your registered Meesho supplier panel email address. Important: Enter accurate credentials — incorrect credentials will prevent the account from connecting.',
        nextButtonText: 'Next: Auto-Sync ➔',
    },
    {
        id: 'mp-meesho-autosync',
        target: TOUR.marketplace.modalAutoSyncToggle,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        title: 'Automatic File Synchronization (Meesho Sync)',
        body: 'SpeedEcom can automatically log in to your Meesho supplier panel to download and reconcile daily orders, payments, returns, and claims without manual Excel uploads. Toggle Auto-Sync ON to enable automated sync, or keep it off for manual uploads.',
        nextButtonText: 'Next: Password ➔',
    },
    {
        id: 'mp-meesho-password',
        target: TOUR.marketplace.modalPassword,
        route: '/settings/marketplace',
        required: false,
        side: 'right',
        requiresAction: true,
        actionType: 'password',
        title: 'Enter Meesho Panel Password',
        body: 'Enter your Meesho supplier panel password. Security: Passwords are encrypted directly in your browser using RSA-OAEP 2048-bit encryption before transmission and are never stored or logged in plain text.',
        nextButtonText: 'Next: Connect ➔',
    },
    {
        id: 'mp-meesho-submit',
        target: TOUR.marketplace.modalSubmitBtn,
        route: '/settings/marketplace',
        required: true,
        side: 'top',
        requiresAction: true,
        actionType: 'connect',
        title: 'Connect & Verify Account',
        body: 'Click "Connect Securely" below to verify your credentials with Meesho and activate your connection. We will wait for backend confirmation before completing setup.',
    },
    {
        id: 'mp-meesho-congratulations',
        target: null,
        route: '/settings/marketplace',
        side: 'center',
        isCelebration: true,
        celebration: {
            nextTour: UPLOAD_ONBOARDING,
            primaryLabel: 'Upload Your First File ➔',
            secondaryLabel: 'Do This Later',
        },
        title: 'Congratulations!',
        body: "You've successfully connected Meesho to SpeedEcom!",
        lastButtonText: 'Finish Onboarding ➔',
    },
];

export const AMAZON_ONBOARDING_STEPS = [
    {
        id: 'mp-amazon-account-name',
        target: TOUR.marketplace.modalAccountName,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'accountName',
        title: 'Enter Account Name',
        body: 'Enter a unique nickname or storefront name for this Amazon account (e.g. your store or brand name). This helps you distinguish between multiple accounts.',
        nextButtonText: 'Next: Analysis Date ➔',
    },
    {
        id: 'mp-amazon-analysis-date',
        target: TOUR.marketplace.modalAnalysisDate,
        route: '/settings/marketplace',
        required: true,
        side: 'top',
        title: 'Select Analysis Start Date',
        body: 'The selected month determines how far back calculations, FBA audits, and reports will run, and which historical period will consume processing credits. Please review and confirm your chosen date carefully before proceeding.',
        nextButtonText: 'Next: Seller Email ➔',
    },
    {
        id: 'mp-amazon-email',
        target: TOUR.marketplace.modalEmail,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'email',
        title: 'Enter Amazon Seller Central Email',
        body: 'Enter your Amazon India Seller Central registered email address. Important: Enter accurate credentials to ensure authentication succeeds. Passwords and credentials are encrypted securely client-side using RSA-OAEP 2048-bit encryption before transmission.',
        nextButtonText: 'Next: Connect ➔',
    },
    {
        id: 'mp-amazon-submit',
        target: TOUR.marketplace.modalSubmitBtn,
        route: '/settings/marketplace',
        required: true,
        side: 'top',
        requiresAction: true,
        actionType: 'connect',
        title: 'Connect & Verify Account',
        body: 'Click "Connect Securely" below to verify your credentials with Amazon India and activate your connection. We will wait for backend confirmation before completing setup.',
    },
    {
        id: 'mp-amazon-congratulations',
        target: null,
        route: '/settings/marketplace',
        side: 'center',
        isCelebration: true,
        celebration: {
            nextTour: UPLOAD_ONBOARDING,
            primaryLabel: 'Upload Your First File ➔',
            secondaryLabel: 'Do This Later',
        },
        title: 'Congratulations!',
        body: "You've successfully connected Amazon to SpeedEcom!",
        lastButtonText: 'Finish Onboarding ➔',
    },
];

export const FLIPKART_ONBOARDING_STEPS = [
    {
        id: 'mp-flipkart-account-name',
        target: TOUR.marketplace.modalAccountName,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'accountName',
        title: 'Enter Account Name',
        body: 'Enter a unique nickname or seller name for this Flipkart account (e.g. your store or display name). This helps you distinguish between multiple accounts.',
        nextButtonText: 'Next: Analysis Date ➔',
    },
    {
        id: 'mp-flipkart-analysis-date',
        target: TOUR.marketplace.modalAnalysisDate,
        route: '/settings/marketplace',
        required: true,
        side: 'top',
        title: 'Select Analysis Start Date',
        body: 'The selected month determines how far back calculations and fee reconciliations will run, and which historical period will consume processing credits. Please review and confirm your chosen date carefully before proceeding.',
        nextButtonText: 'Next: Seller Email ➔',
    },
    {
        id: 'mp-flipkart-email',
        target: TOUR.marketplace.modalEmail,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'email',
        title: 'Enter Flipkart Seller Hub Email',
        body: 'Enter your Flipkart Seller Hub email address and account credentials. Important: Enter accurate credentials to ensure authentication succeeds. Passwords and credentials are encrypted securely client-side using RSA-OAEP 2048-bit encryption before transmission.',
        nextButtonText: 'Next: Connect ➔',
    },
    {
        id: 'mp-flipkart-submit',
        target: TOUR.marketplace.modalSubmitBtn,
        route: '/settings/marketplace',
        required: true,
        side: 'top',
        requiresAction: true,
        actionType: 'connect',
        title: 'Connect & Verify Account',
        body: 'Click "Connect Securely" below to verify your credentials with Flipkart and activate your connection. We will wait for backend confirmation before completing setup.',
    },
    {
        id: 'mp-flipkart-congratulations',
        target: null,
        route: '/settings/marketplace',
        side: 'center',
        isCelebration: true,
        celebration: {
            nextTour: UPLOAD_ONBOARDING,
            primaryLabel: 'Upload Your First File ➔',
            secondaryLabel: 'Do This Later',
        },
        title: 'Congratulations!',
        body: "You've successfully connected Flipkart to SpeedEcom!",
        lastButtonText: 'Finish Onboarding ➔',
    },
];

export const MYNTRA_ONBOARDING_STEPS = [
    {
        id: 'mp-myntra-account-name',
        target: TOUR.marketplace.modalAccountName,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'accountName',
        title: 'Enter Account Name',
        body: 'Enter a unique nickname or partner name for this Myntra account (e.g. your store or brand name). This helps you distinguish between multiple accounts.',
        nextButtonText: 'Next: Analysis Date ➔',
    },
    {
        id: 'mp-myntra-analysis-date',
        target: TOUR.marketplace.modalAnalysisDate,
        route: '/settings/marketplace',
        required: true,
        side: 'top',
        title: 'Select Analysis Start Date',
        body: 'The selected month determines how far back calculations and catalog reconciliations will run, and which historical period will consume processing credits. Please review and confirm your chosen date carefully before proceeding.',
        nextButtonText: 'Next: Partner Email ➔',
    },
    {
        id: 'mp-myntra-email',
        target: TOUR.marketplace.modalEmail,
        route: '/settings/marketplace',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'email',
        title: 'Enter Myntra Partner Email',
        body: 'Enter your Myntra partner portal email address and account credentials. Important: Enter accurate credentials to ensure authentication succeeds. Passwords and credentials are encrypted securely client-side using RSA-OAEP 2048-bit encryption before transmission.',
        nextButtonText: 'Next: Connect ➔',
    },
    {
        id: 'mp-myntra-submit',
        target: TOUR.marketplace.modalSubmitBtn,
        route: '/settings/marketplace',
        required: true,
        side: 'top',
        requiresAction: true,
        actionType: 'connect',
        title: 'Connect & Verify Account',
        body: 'Click "Connect Securely" below to verify your credentials with Myntra and activate your connection. We will wait for backend confirmation before completing setup.',
    },
    {
        id: 'mp-myntra-congratulations',
        target: null,
        route: '/settings/marketplace',
        side: 'center',
        isCelebration: true,
        celebration: {
            nextTour: UPLOAD_ONBOARDING,
            primaryLabel: 'Upload Your First File ➔',
            secondaryLabel: 'Do This Later',
        },
        title: 'Congratulations!',
        body: "You've successfully connected Myntra to SpeedEcom!",
        lastButtonText: 'Finish Onboarding ➔',
    },
];

// ── Upload onboarding ────────────────────────────────────────────────────
// Starts from the marketplace celebration step. Each requiresAction step waits
// for the Uploads page to dispatch the matching `tour:action-completed` event.

export const UPLOAD_ONBOARDING_STEPS = [
    {
        id: 'up-intro',
        target: null,
        route: '/uploads',
        side: 'center',
        title: 'Upload your first report',
        body: 'Calculations are built from the reports you download from your marketplace panel. Let\'s upload the first one together; it takes about two minutes.',
        nextButtonText: 'Let\'s start ➔',
    },
    {
        id: 'up-account',
        target: TOUR.uploads.accountSelect,
        route: '/uploads',
        required: true,
        side: 'bottom',
        selectsPrimaryType: true,
        title: 'Pick the account',
        body: 'Files are uploaded to one marketplace account at a time. The account you just connected is selected for you; with several accounts, always check this first.',
    },
    {
        id: 'up-types',
        target: TOUR.uploads.typeGrid,
        route: '/uploads',
        required: true,
        side: 'bottom',
        title: 'Report types for your marketplace',
        body: 'Each card is a report your marketplace provides. Payments is the best one to start with, so it is selected for you. You can upload the others any time.',
    },
    {
        id: 'up-tutorial',
        target: TOUR.uploads.typePrimaryTutorial,
        route: '/uploads',
        forMarketplaces: ['meesho', 'amazon', 'flipkart'],
        side: 'bottom',
        title: 'Not sure where to download it?',
        body: 'Click the play icon to watch how to download this report from your marketplace panel, then come back and continue.',
    },
    {
        id: 'up-file',
        target: TOUR.uploads.fileSelector,
        route: '/uploads',
        required: true,
        side: 'top',
        requiresAction: true,
        actionType: 'fileSelected',
        autoAdvance: true,
        autoAdvanceDelay: 300,
        actionPrompt: 'Choose the downloaded file to continue',
        title: 'Select your file',
        body: 'Drag the downloaded report here, or click to browse.',
        note: 'Upload limit: up to 5 files at a time.',
        byMarketplace: {
            myntra: { note: 'Upload limit: up to 30 files at a time for Myntra Payments, and 5 files at a time for the other Myntra reports.' },
        },
    },
    {
        id: 'up-confirm',
        target: TOUR.uploads.confirmModal,
        modalSelector: tourSelector(TOUR.uploads.confirmModal),
        route: '/uploads',
        required: true,
        side: 'right',
        requiresAction: true,
        actionType: 'uploadConfirmed',
        autoAdvance: true,
        actionPrompt: 'Confirm the upload to continue',
        title: 'Is this correct?',
        body: 'Check the account, report type and file names. If anything is wrong, press Cancel and select the correct file. Confirm becomes available after a few seconds.',
    },
    {
        id: 'up-processing',
        target: TOUR.uploads.queue,
        route: '/uploads',
        required: true,
        side: 'left',
        requiresAction: true,
        actionType: 'uploadCompleted',
        autoAdvance: true,
        actionPrompt: 'Waiting for your file to finish processing',
        backTo: 'up-file',
        failureHelp: 'This usually means the file is not the selected report type, or the wrong account is selected. Check both, then upload the correct file.',
        title: 'Processing your file',
        body: 'We upload, validate and process the file. If it shows a warning, review it and approve to continue.',
    },
    {
        id: 'up-congratulations',
        target: null,
        route: '/uploads',
        side: 'center',
        isCelebration: true,
        celebration: {
            badge: 'Upload Complete',
            heading: 'File uploaded successfully!',
            text: 'Congratulations on finishing this step. Your data is now flowing into SpeedEcom and will appear in your dashboard once processing completes.',
            points: ['Report Validated', 'Dashboard Updating'],
            secondaryLabel: 'Upload More Files',
            primaryLabel: 'Go to Dashboard ➔',
        },
        title: 'You\'re all set!',
        body: 'Your first report is in.',
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
        title: 'Toggle Summary Panel',
        body: 'Click this button to open or collapse the rich visual summary and advanced filters panel below.',
    },
    {
        id: 'pay-filter-pills',
        target: TOUR.payments.filterPills,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Quick Data Filters',
        body: 'Drill down your calculations by Warehouse, Brand, Compensation, and more. Selecting these instantly updates the funnels and grid below.',
    },
    {
        id: 'pay-financial-funnel',
        target: TOUR.payments.financialFunnel,
        route: '/payments/calculations',
        side: 'right',
        title: 'Financial Funnel',
        body: 'Breaks down your gross sales through every marketplace deduction (fees, penalties, shipping) to show what actually landed in the bank.',
    },
    {
        id: 'pay-qty-breakdown',
        target: TOUR.payments.qtyBreakdown,
        route: '/payments/calculations',
        side: 'top',
        title: 'Quantity Breakdown',
        body: 'A visual slice of what was delivered, returned, replaced, or lost, so you can instantly gauge your fulfillment health.',
    },
    {
        id: 'pay-pl-snapshot',
        target: TOUR.payments.plSnapshot,
        route: '/payments/calculations',
        side: 'left',
        title: 'P/L & Ads Snapshot',
        body: 'Your bottom-line profit, margin, and ad spend efficiency (ACOS) summarized in one place for the currently filtered orders.',
    },
    {
        id: 'pay-marketplace-filter',
        target: TOUR.payments.marketplaceFilter,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Platform Filtering',
        body: 'If applicable, toggle between different marketplace platforms (like Shopsy vs Flipkart) to see platform-specific profitability.',
    },
    {
        id: 'pay-pl-with-tax',
        target: TOUR.payments.plWithTaxToggle,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'P/L With Tax',
        body: 'Switch between With Tax or Without Tax views to see your profit margins with GST impacts accurately factored in.',
    },
    {
        id: 'pay-ads-toggle',
        target: TOUR.payments.adsToggle,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Ads Allocation',
        body: 'Choose how ad spend is deducted: SKU-wise (allocated by performance) or Payment-wise (allocated by deduction date).',
    },
    {
        id: 'pay-columns-btn',
        target: TOUR.payments.columnsBtn,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Customize Columns',
        body: 'Click here to add, hide, or arrange columns to build the perfect view for your specific workflow.',
    },
    {
        id: 'pay-table',
        target: TOUR.payments.table,
        route: '/payments/calculations',
        side: 'top',
        title: 'Calculations Grid',
        body: 'The detail table. Sort any column, and expand a row to see the individual orders and NEFT payment transactions behind that SKU.',
    },
    {
        id: 'pay-sku-search',
        target: TOUR.payments.skuSearch,
        route: '/payments/calculations',
        side: 'top',
        title: 'Search & Filter SKUs',
        body: 'Looking for a specific product? Click this search icon to instantly filter the grid by SKU, Item ID, or Order ID.',
    },
    {
        id: 'pay-calculator',
        target: TOUR.payments.calculateBtn,
        route: '/payments/calculations',
        side: 'bottom',
        title: 'Price Estimate Calculator',
        body: 'Use this built-in calculator to model hypothetical selling prices and see instantly what your projected profit margins would be.',
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
        id: 'cs-column-filter',
        target: TOUR.costSheet.columnFilter,
        route: '/cost-sheet',
        side: 'bottom',
        title: 'Filter specific columns',
        body: 'Click this filter icon on any column to drill down to specific SKUs, product names, or any other data points you need to focus on.',
    },
    {
        id: 'cs-columns',
        target: TOUR.costSheet.columnsBtn,
        route: '/cost-sheet',
        side: 'bottom',
        title: 'Customize your view',
        body: 'Add missing columns, hide ones you do not need, and drag them into whatever order makes data entry fastest for you.',
    },
    {
        id: 'cs-export',
        target: TOUR.costSheet.exportBtn,
        route: '/cost-sheet',
        side: 'bottom',
        title: 'Export to Excel',
        body: 'Prefer working in a spreadsheet? Export your current view, fill in the costs offline, and paste them straight back into the grid.',
    },
    {
        id: 'cs-save',
        target: TOUR.costSheet.saveBtn,
        route: '/cost-sheet',
        side: 'left',
        title: 'Nothing saves on its own',
        body: 'Edits stay local until you press this — the header counts your unsaved changes.',
    },
    {
        id: 'cs-calculate',
        target: TOUR.costSheet.calculateBtn,
        route: '/cost-sheet',
        side: 'bottom',
        title: 'Run the numbers',
        body: 'Once your costs are saved, hit calculate. This runs your updated figures against all your orders to produce your final profit and loss numbers.',
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
            routes: ['/subscription', '/dashboard', '/uploads', '/settings/marketplace'],
            requires: null,
        },
    },
    [UPLOAD_ONBOARDING]: { key: UPLOAD_ONBOARDING, steps: UPLOAD_ONBOARDING_STEPS, autoStart: null },
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
    [MARKETPLACE_ONBOARDING_MEESHO]: { key: MARKETPLACE_ONBOARDING_MEESHO, steps: MEESHO_ONBOARDING_STEPS, autoStart: null },
    [MARKETPLACE_ONBOARDING_AMAZON]: { key: MARKETPLACE_ONBOARDING_AMAZON, steps: AMAZON_ONBOARDING_STEPS, autoStart: null },
    [MARKETPLACE_ONBOARDING_FLIPKART]: { key: MARKETPLACE_ONBOARDING_FLIPKART, steps: FLIPKART_ONBOARDING_STEPS, autoStart: null },
    [MARKETPLACE_ONBOARDING_MYNTRA]: { key: MARKETPLACE_ONBOARDING_MYNTRA, steps: MYNTRA_ONBOARDING_STEPS, autoStart: null },
};