// ─────────────────────────────────────────────────────────
//  Speedy Agent — FAQ Data Layer
//  All 80 pre-defined questions, categories, and param defs
// ─────────────────────────────────────────────────────────

export const FAQ_CATEGORIES = [
    {
        id: 'sku_analysis',
        label: 'SKU Analysis',
        icon: 'Package',
        color: 'purple',
        description: 'Profit, loss, recommendations by SKU',
    },
    {
        id: 'warehouse',
        label: 'Warehouse',
        icon: 'Store',
        color: 'blue',
        description: 'Warehouse-wise sales, orders, returns and profit/loss',
    },
    {
        id: 'ads',
        label: 'Ads Management',
        icon: 'Megaphone',
        color: 'orange',
        description: 'Ad spend, ROAS, SKU-level ad decisions',
    },
    {
        id: 'returns',
        label: 'Returns & RTO',
        icon: 'RotateCcw',
        color: 'red',
        description: 'Return loss, overcharges, RTO analysis',
    },
    {
        id: 'order_lookup',
        label: 'OrderId Wise',
        icon: 'PackageSearch',
        color: 'blue',
        description: 'Order-ID level lookups — pending payments and more',
    },
    {
        id: 'payments',
        label: 'Payments',
        icon: 'CreditCard',
        color: 'green',
        description: 'Settlements, charges, TCS/TDS, GST',
    },
    {
        id: 'claims',
        label: 'Claims',
        icon: 'FileText',
        color: 'yellow',
        description: 'Claim status, recovery, Meesho claims',
    },
    // {
    //     id: 'business',
    //     label: 'Business Insights',
    //     icon: 'TrendingUp',
    //     color: 'indigo',
    //     description: 'Overall health, profitability trends',
    // },
];

// ─────────────────────────────────────────────────────────
//  Param type reference:
//   type: 'text'    → free text input
//   type: 'number'  → numeric input
//   type: 'marketplace' → fetched from /api/marketplaces/filter-options
//
//  required: true  → user must fill before running
//  required: false → optional; if empty, backend skips that filter
//
//  Per-question flags:
//   hidden: true    → withheld from every list, sidebar count and search
//   important: true → amber "IMP" badge + an animated rim around the card
//
//  Each question also gets an icon, mapped by id in QUESTION_ICONS
//  (SpeedyAgentPage.jsx). Add an entry there for a new question, or it falls
//  back to a generic box icon.
// ─────────────────────────────────────────────────────────

export const FAQ_QUESTIONS = [

    // ── SKU ANALYSIS ─────────────────────────────────────

    {
        id: 1,
        category: 'sku_analysis',
        question: {
            en: 'What is the total profit or loss for a Master SKU or parent SKU, across selected accounts?',
            hi: 'मास्टर SKU या Parent SKU का total profit या loss कितना है, selected accounts को मिलाकर?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'skuKeyword', label: 'SKU / Keyword', type: 'text', placeholder: 'e.g., LINE, XYZ, HOLDER', required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 2,
        category: 'sku_analysis',
        question: {
            en: 'Last 2–3 months performance analysis of a SKU — profit, sales, return %, avg profit, avg settlement',
            hi: 'किसी SKU का last 2–3 months का performance analysis — profit, sales, return %, average profit और average settlement।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'sku', label: 'SKU', type: 'text', placeholder: 'Enter exact SKU', required: true },
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', placeholder: 'End date', required: true },
        ],
        format: 'chart',
        chartType: 'line',
    },
    {
        id: 3,
        category: 'ads',
        question: {
            en: 'For this SKU, what is the total ad spend, total orders, and return ratio metrics?',
            hi: 'इस SKU के लिए lifetime ad spend, total orders और return ratio metrics क्या हैं?',
        },
        type: 'dynamic',
        excludedPlatforms: ['meesho', 'myntra'],
        requiresMarketplace: true,
        params: [
            { key: 'sku', label: 'SKU', type: 'text', placeholder: 'Enter exact SKU', required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 4,
        category: 'sku_analysis',
        question: {
            en: 'Identify SKUs with high profit margins and low return rates that are ideal for sales promotion.',
            hi: 'ऐसे SKUs identify करो जिनका profit margin high है और return rate low है, जो sales promotion के लिए ideal हैं।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'minOrders', label: 'Min Orders / month', type: 'number', placeholder: '10', required: false },
            { key: 'returnThreshold', label: 'Max Return Rate %', type: 'number', placeholder: '30', required: false },
            { key: 'topN', label: 'Top N Results', type: 'number', placeholder: '20', required: false },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 6,
        category: 'sku_analysis',
        important: 'true',
        question: {
            en: 'Identify SKUs with high losses or high return rates that should be considered for discontinuation.',
            hi: 'ऐसे SKUs identify करो जिनमें high losses या high return rates हैं और जिन्हें discontinue करने पर consider किया जा सकता है।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [],
        format: 'table',
        chartType: null,
    },
    {
        id: 14,
        category: 'sku_analysis',
        question: {
            en: 'Identify SKUs with profit margins higher than X% of the selling price.',
            hi: 'ऐसे SKUs identify करो जिनका profit margin selling price के X% से ज़्यादा है।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'marginPercent', label: 'Margin % threshold', type: 'number', placeholder: '10', required: true },
            { key: 'minOrders', label: 'Min Orders', type: 'number', placeholder: '10', required: false },
            { key: 'limit', label: 'Top N Results', type: 'number', placeholder: '20', required: false },
            { key: 'sortOrder', label: 'Sort Order', type: 'toggle', options: ['desc', 'asc'], defaultValue: 'desc', required: false },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 32,
        category: 'sku_analysis',
        important: 'true',
        question: {
            en: 'Analyze the top N profitable SKUs and identify areas for further improvement.',
            hi: 'Top N profitable SKUs का analysis करो और further improvement के areas identify करो।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'topN', label: 'Top N Results', type: 'number', placeholder: '3', required: false },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 33,
        category: 'sku_analysis',
        question: {
            en: 'Identify the top N profitable SKUs that continuously have high customer return rates.',
            hi: 'Top N profitable SKUs identify करो जिनके customer return rates continuously high हैं।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', placeholder: 'End date', required: true },
            { key: 'returnThreshold', label: 'Min return % threshold', type: 'number', placeholder: '20', required: true },
            { key: 'topN', label: 'Top N Results', type: 'number', placeholder: '50', required: false },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 34,
        category: 'sku_analysis',
        important: 'true',
        question: {
            en: 'Which of our top-performing SKUs are now showing rising return & RTO trends that may impact future profitability?',
            hi: 'हमारे top-performing SKUs में से कौनसे SKUs अब rising return और RTO trends दिखा रहे हैं जो future profitability को impact कर सकते हैं?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'minOrders', label: 'Min Orders', type: 'number', placeholder: '10', required: false },
            { key: 'minProfit', label: 'Min Profit (₹)', type: 'number', placeholder: '1000', required: false },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 11,
        category: 'sku_analysis',
        important: 'true',
        question: {
            en: 'Which SKUs are losing money even after successful delivery?',
            hi: 'कौनसे SKUs successful delivery के बाद भी loss में चल रहे हैं?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', placeholder: 'End date', required: true },
        ],
        format: 'table',
        chartType: null,
    },

    // ── SALES & ORDERS ────────────────────────────────────

    {
        id: 15,
        category: 'order_lookup',
        important: 'true',
        question: {
            en: 'List Order IDs for a SKU where settlement is less than / greater than ₹X.',
            hi: 'किसी SKU के Order IDs list करो जहाँ settlement ₹X से कम / ज़्यादा है।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'sku',        label: 'SKU',                   type: 'text',   placeholder: 'Enter exact SKU', required: true },
            { key: 'comparator', label: 'Comparison',            type: 'toggle', options: ['Less than', 'Greater than'], defaultValue: 'Less than', required: true },
            { key: 'threshold',  label: 'Settlement Value (₹)',  type: 'number', placeholder: '500',             required: true },
            { key: 'startDate',  label: 'Start Date',            type: 'date',   placeholder: 'Start date',      required: true },
            { key: 'endDate',    label: 'End Date',              type: 'date',   placeholder: 'End date',        required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 16,
        category: 'warehouse',
        question: {
            en: 'What % of sales is coming from each warehouse? (table or pie chart)',
            hi: 'हर warehouse से कितने % sales आ रहे हैं? (table या pie chart)',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['meesho'],
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', placeholder: 'End date', required: true },
        ],
        format: 'chart',
        chartType: 'pie',
    },
    {
        id: 17,
        category: 'warehouse',
        important: 'true',
        question: {
            en: 'Order and return comparison by warehouse?',
            hi: 'Warehouse-wise orders और returns का comparison?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['meesho'],
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', placeholder: 'End date', required: true },
        ],
        format: 'chart',
        chartType: 'bar',
    },
    {
        id: 19,
        category: 'warehouse',
        question: {
            en: 'List warehouse-wise profit/loss for a SKU.',
            hi: 'किसी SKU का warehouse-wise profit/loss list करो।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'sku',       label: 'SKU',        type: 'text', placeholder: 'Enter exact SKU', required: true },
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date',      required: true },
            { key: 'endDate',   label: 'End Date',   type: 'date', placeholder: 'End date',        required: true },
        ],
        format: 'chart',
        chartType: 'stacked-bar',
    },
    {
        id: 18,
        category: 'warehouse',
        important: 'true',
        question: {
            en: 'Warehouse-wise profit/loss, returns, and orders breakdown by fulfilment source?',
            hi: 'Fulfilment source के हिसाब से warehouse-wise profit/loss, returns और orders breakdown?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['meesho'],
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', placeholder: 'End date', required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 20,
        category: 'sku_analysis',
        question: {
            en: 'Multiple quantity-wise comparison chart (2, 4, 6, 8, 10, 20, 25, 50, 100)?',
            hi: 'किसी SKU का multiple quantity-wise comparison chart (2, 4, 6, 8, 10, 20, 25, 50, 100)?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'sku',       label: 'SKU',        type: 'text', placeholder: 'Enter exact SKU', required: true },
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date',      required: true },
            { key: 'endDate',   label: 'End Date',   type: 'date', placeholder: 'End date',        required: true },
        ],
        format: 'chart',
        chartType: 'line',
    },
    {
        id: 82,
        category: 'sku_analysis',
        question: {
            en: 'List out all loss making SKUs (with ads / without ads).',
            hi: 'सारे loss making SKUs list करो (with ads / without ads)।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['myntra'],
        params: [
            // "With Ads" = profit AFTER deducting ad spend (the platform's own
            // definition — see the P/L With Ads FAQ). Defaulted because that FAQ
            // also says to use it for judging overall business health.
            { key: 'adsMode',   label: 'Profit basis', type: 'toggle', options: ['With Ads', 'Without Ads'], defaultValue: 'With Ads', required: true },
            { key: 'startDate', label: 'Start Date',   type: 'date',   placeholder: 'Start date', required: true },
            { key: 'endDate',   label: 'End Date',     type: 'date',   placeholder: 'End date',   required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 84,
        category: 'sku_analysis',
        important: 'true',
        question: {
            en: 'Month-wise profit/loss fluctuation — with the reasons behind each swing.',
            hi: 'महीने-दर-महीने profit/loss का fluctuation — साथ में हर बदलाव की वजह।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['myntra'],
        // Bar chart of P/L per month; the response carries a deterministic
        // driver-breakdown note (see template 84's insight()).
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate',   label: 'End Date',   type: 'date', placeholder: 'End date',   required: true },
        ],
        format: 'chart',
        chartType: 'bar',
    },

    // ── ADS MANAGEMENT ────────────────────────────────────

    {
        id: 24,
        category: 'ads',
        important: 'true',
        question: {
            en: 'What % of sales is going towards ads spend?',
            hi: 'Total sales का कितना % ads spend में जा रहा है?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['myntra'],
        params: [
            { key: 'minAdsPct', label: 'Min Ads % Of Sale', type: 'number', placeholder: '10', required: true },
            { key: 'minOrders', label: 'Min Orders',        type: 'number', placeholder: '10', required: false },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 7,
        category: 'ads',
        question: {
            en: 'Which SKUs have ad spend but zero orders in the last month?',
            hi: 'किन SKUs में last month ad spend हुआ है but zero orders आए हैं?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['myntra'],
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', placeholder: 'End date', required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 9,
        category: 'ads',
        important: 'true',
        question: {
            en: 'Which SKUs are going into loss because of ads?',
            hi: 'किन SKUs ads की वजह से loss में जा रहे हैं?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['myntra'],
        params: [],
        format: 'table',
        chartType: null,
    },
    {
        id: 56,
        hidden: true,
        category: 'ads',
        question: {
            en: 'Why don\'t panel ads and report ads match?',
            hi: 'Panel ads और report ads match क्यों नहीं होते?',
        },
        type: 'static',
        answer: 'The panel shows real-time clicks and impressions, while the report shows billed invoices (actual settlement deductions). There is usually a 24–48 hour lag between the two.',
    },
    {
        id: 57,
        hidden: true,
        category: 'ads',
        question: {
            en: 'Is GST added to ads?',
            hi: 'क्या ads में GST add होता है?',
        },
        type: 'static',
        answer: 'Yes, some marketplaces generate a GST invoice for ads. The report shows the billed amount including GST.',
    },
    {
        id: 58,
        hidden: true,
        category: 'ads',
        question: {
            en: 'If ads are paid via credit card, is GST deducted from settlement?',
            hi: 'अगर ads credit card से pay किए हो, तो क्या GST settlement से deduct होता है?',
        },
        type: 'static',
        answer: 'No, GST is not deducted from settlement when ads are paid via credit card. However, it is counted as an expense in the P/L calculation.',
    },
    {
        id: 59,
        hidden: true,
        category: 'ads',
        question: {
            en: 'Is money added to the wallet deducted from settlement?',
            hi: 'Wallet में add किया हुआ पैसा settlement से deduct होता है क्या?',
        },
        type: 'static',
        answer: 'No, wallet top-ups are not deducted from settlement. However, the ad spend from that wallet is counted as an expense in the P/L calculation.',
    },
    {
        id: 60,
        hidden: true,
        category: 'ads',
        question: {
            en: 'Are Google Ads included in P/L?',
            hi: 'क्या Google Ads P/L में include है?',
        },
        type: 'static',
        answer: 'Yes, if Google Ads integration or manual upload has been configured, they are included in the P/L calculation.',
    },
    {
        id: 61,
        hidden: true,
        category: 'ads',
        question: {
            en: 'Is Google Ads tracking possible at SKU level?',
            hi: 'क्या Google Ads tracking SKU level पर possible है?',
        },
        type: 'static',
        answer: 'Only when proper UTM parameters and e-commerce tracking are configured in Google Analytics / Ads.',
    },
    {
        id: 74,
        hidden: true,
        category: 'ads',
        question: {
            en: 'Why don\'t ads show at the Order ID level?',
            hi: 'Ads Order ID level पर show क्यों नहीं होते?',
        },
        type: 'static',
        answer: 'Ads campaigns run at the SKU or account level. A 1:1 mapping between an ad click and a specific Order ID is not technically possible on most marketplaces.',
    },
    {
        id: 78,
        hidden: true,
        category: 'ads',
        question: {
            en: 'Which report is Flipkart ads data taken from?',
            hi: 'Flipkart ads data किस report से लिया जाता है?',
        },
        type: 'static',
        answer: 'Flipkart ads data comes from the Flipkart Ads Billing / Invoice report.',
    },
    {
        id: 79,
        hidden: true,
        category: 'ads',
        question: {
            en: 'Why don\'t ads appear in warehouse data?',
            hi: 'Warehouse data में ads show क्यों नहीं होते?',
        },
        type: 'static',
        answer: 'Ads run at the SKU/account level, not at the warehouse transaction level. There is no direct association between ad spend and a specific warehouse shipment.',
    },

    // ── RETURNS & RTO ─────────────────────────────────────

    {
        id: 12,
        category: 'returns',
        important: 'true',
        question: {
            en: 'Which returned orders have been overcharged compared to expected costs (by Order ID and SKU)?',
            hi: 'कौनसे returned orders में expected costs से ज़्यादा charge हुआ है (Order ID और SKU के साथ)?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            // Plain positive amount — "overcharged by ₹X or more". The backend
            // negates it (overcharge is stored as a negative settlement), so the
            // user never types a minus sign.
            { key: 'settlement', label: 'Min overcharge (₹)', type: 'number', placeholder: '200',        required: true },
            { key: 'startDate',  label: 'Start Date',         type: 'date',   placeholder: 'Start date', required: true },
            { key: 'endDate',    label: 'End Date',           type: 'date',   placeholder: 'End date',   required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 10,
        category: 'returns',
        question: {
            en: 'Which SKUs have more returns than delivered quantity?',
            hi: 'किन SKUs में delivered quantity से ज़्यादा returns आ रहे हैं?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate', label: 'End Date', type: 'date', placeholder: 'End date', required: true },
            { key: 'minOrders', label: 'Min monthly orders', type: 'number', placeholder: '10', required: false },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 81,
        category: 'returns',
        important: 'true',
        question: {
            en: 'List the refund loss order IDs whose reimbursement /safe T claim was not passed yet (Amazon only). ',
            hi: 'उन refund loss order IDs को list करो जिनका reimbursement/safe T claim अभी तक pass नहीं हुआ (सिर्फ Amazon)।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        supportedPlatforms: ['amazon'],
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate',   label: 'End Date',   type: 'date', placeholder: 'End date',   required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 85,
        category: 'returns',
        important: 'true',
        question: {
            en: 'List out overdue return orders (Meesho only).',
            hi: 'Overdue return orders list करो (सिर्फ Meesho)।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        supportedPlatforms: ['meesho'],
        // Same "overdue" rule as the Returns Analysis tab (RTO not arrived
        // 45+ days after dispatch, or other returns 25+ days after creation).
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate',   label: 'End Date',   type: 'date', placeholder: 'End date',   required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 87,
        category: 'order_lookup',
        question: {
            en: 'List all multi-quantity orders (2, 4, 6, 10, 20 … units per order).',
            hi: 'ऐसे सभी multi-quantity orders list करो (एक order में 2, 4, 6, 10, 20 … units)।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        // Order-level listing (one row per order) of orders carrying `minQty`
        // units or more. "Multi-quantity" is total_quantity — the same column
        // Q20's quantity-wise comparison groups on.
        //
        //  `status` is a MULTI-SELECT: each option maps to a quantity column and
        //  the row must have that quantity > 0. Selecting none means no filter
        //  (all statuses). Refund Loss is Amazon-only data — it stays selectable
        //  everywhere but simply matches nothing on Flipkart/Meesho. Myntra has
        //  no RTO or Replacement tracking at all (its calc engine never
        //  populates rto_quantity/replacement_quantity), so those two options
        //  are hidden for Myntra — otherwise picking either silently returns
        //  zero rows with no column to explain why.
        params: [
            { key: 'minQty', label: 'Min Qty (this or more)', type: 'number', placeholder: '2', defaultValue: 2, required: true },
            {
                key: 'status', label: 'Status', type: 'multiselect',
                options: ['Delivered', 'Return', 'RTO', 'Replacement', 'Refund Loss'],
                // Refund Loss only exists in Amazon data — hidden for other
                // marketplaces, where it could only ever match zero rows.
                // RTO/Replacement don't exist in Myntra data — hidden there too.
                optionPlatforms: {
                    'Refund Loss': ['amazon'],
                    'RTO': ['amazon', 'flipkart', 'meesho'],
                    'Replacement': ['amazon', 'flipkart', 'meesho'],
                },
                required: false,
            },
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate',   label: 'End Date',   type: 'date', placeholder: 'End date',   required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 83,
        category: 'order_lookup',
        important: 'true',
        question: {
            en: 'List all order IDs whose payment is still pending (action required).',
            hi: 'उन सभी order IDs को list करो जिनका payment अभी pending है (action required)।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['myntra'],
        // Pulls from the same per-platform order tables as the "Action Required"
        // screen (payment_status = 'pending'), NOT the calculations table.
        params: [
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate',   label: 'End Date',   type: 'date', placeholder: 'End date',   required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 86,
        category: 'returns',
        important: 'true',
        question: {
            en: 'List all order IDs whose RTO settlement is negative.',
            hi: 'उन सभी order IDs को list करो जिनका RTO settlement negative है।',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        excludedPlatforms: ['myntra'],
        // RTO rows (rto_quantity > 0) with a negative settlement. The optional
        // "Min loss" narrows to orders whose loss is at least ₹X.
        params: [
            { key: 'minLoss',   label: 'Min RTO Loss ₹', type: 'number', placeholder: '3', required: false },
            { key: 'startDate', label: 'Start Date', type: 'date', placeholder: 'Start date', required: true },
            { key: 'endDate',   label: 'End Date',   type: 'date', placeholder: 'End date',   required: true },
        ],
        format: 'table',
        chartType: null,
    },
    {
        id: 54,
        hidden: true,
        category: 'returns',
        question: {
            en: 'Is TCS/TDS deducted when a product is returned (RTO)?',
            hi: 'Product return (RTO) होने पर क्या TCS/TDS deduct होता है?',
        },
        type: 'static',
        answer: 'Normally no. TCS/TDS is reversed on RTO/return orders.',
    },
    {
        id: 55,
        hidden: true,
        category: 'returns',
        question: {
            en: 'Will TCS/TDS be deducted on RTO in the Amazon program?',
            hi: 'क्या Amazon program में RTO पर TCS/TDS deduct होगा?',
        },
        type: 'static',
        answer: 'TCS/TDS is reversed. However, forward shipping charges may still apply. If any extra fee is levied, raise a ticket on Seller Support.',
    },

    // ── PAYMENTS ─────────────────────────────────────────

    {
        id: 21,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Amazon charges comparison for the last 3 months?',
            hi: 'Last 3 months का Amazon charges comparison?',
        },
        type: 'dynamic',
        comingSoon: true,
        requiresMarketplace: true,
        supportedPlatforms: ['amazon'],
        params: [],
        format: 'chart',
        chartType: 'bar',
    },
    {
        id: 22,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Marketplace fee charges comparison for the last N months?',
            hi: 'Last N months का marketplace fee charges comparison?',
        },
        type: 'dynamic',
        comingSoon: true,
        requiresMarketplace: true,
        params: [],
        format: 'chart',
        chartType: 'bar',
    },
    {
        id: 23,
        hidden: true,
        category: 'payments',
        question: {
            en: 'What does the "Other" amount in Amazon represent?',
            hi: 'Amazon में "Other" amount किसको represent करता है?',
        },
        type: 'dynamic',
        comingSoon: true,
        requiresMarketplace: true,
        supportedPlatforms: ['amazon'],
        params: [],
        format: 'table',
        chartType: null,
    },
    {
        id: 28,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Total recovery payment deducted in Meesho (with types)?',
            hi: 'Meesho में total recovery payment कितना deduct हुआ (types के साथ)?',
        },
        type: 'dynamic',
        comingSoon: true,
        requiresMarketplace: true,
        supportedPlatforms: ['meesho'],
        params: [],
        format: 'table',
        chartType: null,
    },
    {
        id: 29,
        hidden: true,
        category: 'payments',
        question: {
            en: 'How many orders have been compensated vs recovery in Meesho?',
            hi: 'Meesho में कितने orders compensated हुए vs recovery में गए?',
        },
        type: 'dynamic',
        comingSoon: true,
        requiresMarketplace: true,
        supportedPlatforms: ['meesho'],
        params: [],
        format: 'table',
        chartType: null,
    },
    {
        id: 35,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Do all pending orders appear in payment report if parcel hasn\'t reached office?',
            hi: 'अगर parcel office तक नहीं पहुँचा है तो क्या सभी pending orders payment report में दिखेंगे?',
        },
        type: 'static',
        answer: 'No. The pending payment report only considers orders for which an official Return Approval date has been issued. If the parcel is in transit and hasn\'t reached the office, the claim/payment process doesn\'t start.',
    },
    {
        id: 36,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Should tickets be raised for all pending orders shown in sales?',
            hi: 'क्या sales में दिखने वाले सभी pending orders के लिए tickets raise करने चाहिए?',
        },
        type: 'static',
        answer: 'No. Only raise tickets for orders whose SLA (15–45 days depending on the marketplace) has already been crossed.',
    },
    {
        id: 37,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Report shows payment pending but panel shows payment received — why?',
            hi: 'Report में payment pending दिख रहा है but panel में payment received — ऐसा क्यों?',
        },
        type: 'static',
        answer: 'This is a timing mismatch. Marketplace API and reporting sync can take 24–48 hours. Refresh the settlement report and check again.',
    },
    {
        id: 38,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Do FBA orders appear in the pending payment report?',
            hi: 'क्या FBA orders pending payment report में दिखते हैं?',
        },
        type: 'static',
        answer: 'Yes. FBA orders appear in the report, but Amazon releases their payment in the next settlement cycle.',
    },
    {
        id: 39,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Full Order Item ID not showing (Flipkart) — can it be found?',
            hi: 'Full Order Item ID नहीं दिख रहा (Flipkart) — कहाँ से मिलेगा?',
        },
        type: 'static',
        answer: 'Yes. Download the detailed "Order Report" or "Tax Report" from Flipkart Seller Panel to get the full Order Item ID.',
    },
    {
        id: 40,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Are Amazon Bazaar orders included in the report?',
            hi: 'क्या Amazon Bazaar के orders report में include होते हैं?',
        },
        type: 'static',
        answer: 'Yes. Amazon Bazaar sales are part of the standard orders and settlement report.',
    },
    {
        id: 41,
        hidden: true,
        category: 'payments',
        question: {
            en: 'How is the bank received payment confirmed to be correct?',
            hi: 'Bank में received हुआ payment correct है, कैसे confirm करें?',
        },
        type: 'static',
        answer: 'The system reads the official Settlement Report (V2/Flat File). The amount shown as "Bank Transfer" in that report is what gets recorded.',
    },
    {
        id: 42,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Is the profit shown in payment correct?',
            hi: 'Payment में जो profit दिख रहा है क्या वो सही है?',
        },
        type: 'static',
        answer: 'Yes, this is calculated profit: Settlement − Total Cost − Ads. If the actual amount seems lower, the cost sheet may not be updated or hidden costs may not have been added.',
    },
    {
        id: 43,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Does selecting a payment month show only that month\'s orders\' payment?',
            hi: 'Payment month select करने पर क्या सिर्फ उसी month के orders का payment दिखेगा?',
        },
        type: 'static',
        answer: 'Not necessarily. Order Month and Payment Month are different. Orders placed in one month may have their payment credited the next month.',
    },
    {
        id: 44,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Why did an old payment arrive now?',
            hi: 'पुराना payment अभी क्यों आया?',
        },
        type: 'static',
        answer: 'Delayed claim approval, fee refund/reversal, or reserve release can cause older payments to arrive late.',
    },
    {
        id: 45,
        hidden: true,
        category: 'payments',
        question: {
            en: 'How was a previous payment identified?',
            hi: 'Previous payment कैसे identify किया जाता है?',
        },
        type: 'static',
        answer: 'It is identified using the settlement report date and transaction reference number.',
    },
    {
        id: 46,
        hidden: true,
        category: 'payments',
        question: {
            en: 'How to raise a ticket for a previous payment issue?',
            hi: 'Previous payment issue के लिए ticket कैसे raise करें?',
        },
        type: 'static',
        answer: 'Go to Seller Panel → Help Center → Payment/Settlements → "Investigate my payment" and raise a ticket with the Order ID.',
    },
    {
        id: 47,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Why are Order Month and Payment Month different?',
            hi: 'Order Month और Payment Month अलग क्यों होते हैं?',
        },
        type: 'static',
        answer: 'Order Month is the customer order date; Payment Month is the bank credit date. The two can be different.',
    },
    {
        id: 48,
        hidden: true,
        category: 'payments',
        question: {
            en: 'How to find out when payment for an Order Month was received?',
            hi: 'किसी Order Month का payment कब received हुआ — कैसे पता करें?',
        },
        type: 'static',
        answer: 'Match the settlement report\'s bank transfer date with the order month to identify when payment arrived.',
    },
    {
        id: 49,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Which should be considered — Order Month or Payment Month?',
            hi: 'Order Month consider करें या Payment Month?',
        },
        type: 'static',
        answer: 'For profitability analysis, Order Month is preferred.',
    },
    {
        id: 50,
        hidden: true,
        category: 'payments',
        question: {
            en: 'How is purchase amount determined and why does it appear low?',
            hi: 'Purchase amount कैसे determine होता है और कम क्यों दिखता है?',
        },
        type: 'static',
        answer: 'Purchase amount comes from the Cost Sheet. Verify that Product Cost and Packaging Cost are correctly entered.',
    },
    {
        id: 51,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Is GST included in the purchase amount?',
            hi: 'क्या purchase amount में GST included है?',
        },
        type: 'static',
        answer: 'It depends on the "is_product_cost_with_gst" setting in the Cost Sheet.',
    },
    {
        id: 52,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Why doesn\'t TCS/TDS count as profit?',
            hi: 'TCS/TDS profit में count क्यों नहीं होता?',
        },
        type: 'static',
        answer: 'TCS/TDS accumulates as a credit on the GST/Income Tax portal — it is not direct cash profit. Your CA adjusts or claims it at month/quarter end.',
    },
    {
        id: 53,
        hidden: true,
        category: 'payments',
        question: {
            en: 'When will TCS/TDS be returned?',
            hi: 'TCS/TDS कब वापस मिलेगा?',
        },
        type: 'static',
        answer: 'Your CA adjusts or claims it at month or quarter end via the GST/Income Tax portal.',
    },
    {
        id: 62,
        hidden: true,
        category: 'payments',
        question: {
            en: 'How is profit calculated?',
            hi: 'Profit कैसे calculate होता है?',
        },
        type: 'static',
        answer: 'Profit/Loss = (Settlement + Claims) − (Product Cost + Packaging + Ads + RTO/Return Loss).',
    },
    {
        id: 63,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Profit shows in report but less cash is available — why?',
            hi: 'Report में profit दिख रहा है but cash कम है — क्यों?',
        },
        type: 'static',
        answer: 'Hidden costs like rent, salary, or dead inventory may not have been added to the cost sheet.',
    },
    {
        id: 64,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Why does profit/loss appear mismatched?',
            hi: 'Profit/loss mismatched क्यों दिख रहा है?',
        },
        type: 'static',
        answer: 'The system does a mathematical calculation. Cash flow perception mismatches happen because of timing differences between order and payment.',
    },
    {
        id: 65,
        hidden: true,
        category: 'payments',
        question: {
            en: 'What does "dispatch" mean in Order Month-Profit?',
            hi: 'Order Month-Profit में "dispatch" का क्या मतलब है?',
        },
        type: 'static',
        answer: 'Dispatch status indicates whether the orders from that month were physically shipped or not.',
    },
    {
        id: 66,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Why are fewer SKUs showing in the report?',
            hi: 'Report में कम SKUs क्यों दिख रहे हैं?',
        },
        type: 'static',
        answer: 'Only SKUs that have had a transaction in the selected period are shown.',
    },
    {
        id: 67,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Why is total sale lower than shown in the panel?',
            hi: 'Total sale panel में दिखने से कम क्यों है?',
        },
        type: 'static',
        answer: 'The panel shows Gross Sales (including returns, cancellations). The report shows Net Delivered Sales only.',
    },
    {
        id: 68,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Difference between Order Month Settlement and total Settlement?',
            hi: 'Order Month Settlement और total Settlement में क्या difference है?',
        },
        type: 'static',
        answer: 'Order Month Settlement shows the amount for orders placed in that specific month. Settlement shows the total bank inflow for that month (which may include older orders).',
    },
    {
        id: 69,
        hidden: true,
        category: 'payments',
        question: {
            en: 'What is MP Fee Rebate?',
            hi: 'MP Fee Rebate क्या है?',
        },
        type: 'static',
        answer: 'MP Fee Rebate is a promotional discount or cashback from the marketplace, adjusted in the next billing cycle.',
    },
    {
        id: 70,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Why did claim payment appear higher in a selected month?',
            hi: 'Selected month में claim payment ज़्यादा क्यों दिखा?',
        },
        type: 'static',
        answer: 'Pending claims may have been bulk-approved in that month, causing a spike in claim payment.',
    },
    {
        id: 71,
        hidden: true,
        category: 'payments',
        question: {
            en: 'What is P/L Without Ads?',
            hi: 'P/L Without Ads क्या है?',
        },
        type: 'static',
        answer: 'P/L Without Ads shows the gross product margin before deducting ad spend.',
    },
    {
        id: 72,
        hidden: true,
        category: 'payments',
        question: {
            en: 'What is P/L With Ads?',
            hi: 'P/L With Ads क्या है?',
        },
        type: 'static',
        answer: 'P/L With Ads shows actual business profitability after deducting ad expenses.',
    },
    {
        id: 73,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Which P/L metric should be used for decisions?',
            hi: 'Decisions के लिए कौनसा P/L metric use करना चाहिए?',
        },
        type: 'static',
        answer: 'Use P/L With Ads to assess overall business health.',
    },
    {
        id: 75,
        hidden: true,
        category: 'payments',
        question: {
            en: 'What is "Profit % by Sale" vs "Profit % by Settlement"?',
            hi: '"Profit % by Sale" vs "Profit % by Settlement" क्या है?',
        },
        type: 'static',
        answer: 'Profit % by Sale = (Profit / Total Sales) × 100. Profit % by Settlement = (Profit / Bank Received) × 100. Use Profit % by Sale for pricing decisions.',
    },
    {
        id: 76,
        hidden: true,
        category: 'payments',
        question: {
            en: 'What is Amazon order count based on?',
            hi: 'Amazon order count किस पर based है?',
        },
        type: 'static',
        answer: 'Amazon order count is based on the Merchant Tax Report and Settlement Report.',
    },
    {
        id: 77,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Which reports is Amazon data taken from?',
            hi: 'Amazon data किन reports से लिया जाता है?',
        },
        type: 'static',
        answer: 'Amazon data comes from the Merchant Tax Report, Settlement Report V2, and Return/Claims reports.',
    },
    {
        id: 80,
        hidden: true,
        category: 'payments',
        question: {
            en: 'Why is Meesho changing the displayed price without a price reduction from my end?',
            hi: 'मेरे end से price reduction के बिना Meesho displayed price क्यों change कर रहा है?',
        },
        type: 'static',
        answer: 'Meesho sometimes shows a discount to customers via their own promotions or Smart Coin program. Your payout is still calculated based on your listing price.',
    },

    // ── CLAIMS ───────────────────────────────────────────

    {
        id: 30,
        hidden: true,
        category: 'claims',
        question: {
            en: 'How many claims were passed, rejected, and are open in the last N months?',
            hi: 'Last N months में कितने claims passed, rejected और open हैं?',
        },
        type: 'dynamic',
        comingSoon: true,
        requiresMarketplace: true,
        supportedPlatforms: ['meesho'],
        params: [],
        format: 'table',
        chartType: null,
    },
    {
        id: 31,
        hidden: true,
        category: 'claims',
        question: {
            en: 'Claim comparison chart/table for the last N months?',
            hi: 'Last N months का claim comparison chart/table?',
        },
        type: 'dynamic',
        comingSoon: true,
        requiresMarketplace: true,
        supportedPlatforms: ['meesho'],
        params: [],
        format: 'chart',
        chartType: 'bar',
    },

    // ── BUSINESS INSIGHTS ─────────────────────────────────

    {
        id: 26,
        category: 'business',
        question: {
            en: 'Based on data, should I continue the business?',
            hi: 'Data के basis पर, क्या business continue करूँ?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [],
        format: 'table',
        chartType: null,
    },
    {
        id: 27,
        category: 'business',
        question: {
            en: 'Business has been in losses for many months — how to improve profitability?',
            hi: 'Business कई months से losses में है — profitability कैसे improve करूँ?',
        },
        type: 'dynamic',
        requiresMarketplace: true,
        params: [],
        format: 'table',
        chartType: null,
    },
];

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
//  Marketplace support / exclusion check
//  A question is supported for a marketplace when BOTH of:
//    1. supportedPlatforms is missing/empty OR includes the marketplace
//       (allowlist — use for "only makes sense for X" questions like Q81)
//    2. excludedPlatforms is missing/empty OR does NOT include the marketplace
//       (blocklist — use for one-off "don't run this on X" exclusions)
//  Matching is fuzzy, case-insensitive (so 'amazon-india' matches 'amazon').
// ─────────────────────────────────────────────────────────
export const isQuestionSupportedForMarketplace = (question, mpKey) => {
    if (!mpKey) return false;
    const normalized = String(mpKey).toLowerCase();

    // Ads-category questions never support Meesho: its seller panel provides no
    // SKU-wise ads report, so ad metrics cannot be computed. Central rule so every
    // current AND future ads question excludes Meesho without a per-question tag.
    if (question?.category === 'ads' && normalized.includes('meesho')) {
        return false;
    }

    const supported = question?.supportedPlatforms;
    if (Array.isArray(supported) && supported.length > 0) {
        const allowed = supported.some(p => normalized.includes(String(p).toLowerCase()));
        if (!allowed) return false;
    }

    const excluded = question?.excludedPlatforms;
    if (Array.isArray(excluded) && excluded.length > 0) {
        const isExcluded = excluded.some(p => normalized.includes(String(p).toLowerCase()));
        if (isExcluded) return false;
    }

    return true;
};

// Questions flagged `hidden: true` are withheld from every browsing surface
// (sidebar, category panel, question list, search). Remove the flag on a
// question to bring it back — nothing else needs changing.
export const getQuestionsByCategory = (categoryId) =>
    FAQ_QUESTIONS.filter((q) => q.category === categoryId && !q.hidden);

// Lookup by id is deliberately unfiltered: an already-open question must keep
// resolving even if it is hidden from the lists.
export const getQuestionById = (id) =>
    FAQ_QUESTIONS.find((q) => q.id === id);

export const getCategoryById = (id) =>
    FAQ_CATEGORIES.find((c) => c.id === id);

export const getCategoryQuestionCount = (categoryId) =>
    getQuestionsByCategory(categoryId).length;

// Categories left with no visible questions are dropped so empty tabs never render.
export const VISIBLE_CATEGORIES = FAQ_CATEGORIES.filter(
    (c) => getQuestionsByCategory(c.id).length > 0
);
