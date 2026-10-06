// ─────────────────────────────────────────────────────────────────────────────
// Shared utility functions and constants for PaymentsCalculations and
// MasterSkuCalculations pages.  All exports are pure / side-effect free.
// ─────────────────────────────────────────────────────────────────────────────

export const GST_DIVISOR = 1.18;

// ─── Column label map (shown in table headers & column-selector) ──────────────
export const COLUMN_LABELS = {
    sku: 'Sku',
    size: 'Size',
    master_sku: 'Master Sku',
    orders_settlement: 'Orders Settlement',
    mp_fee_settlement: 'Mp Fee Settlement',
    claim_payment: 'Claim Payment',
    compensation: 'Compensation',
    recovery: 'Recovery',
    return_loss: 'Return Loss',
    total_sales: 'Net Sales',
    total_cost: 'Total Cost',
    profit_loss: 'P/L (Without Ads)',
    profit_loss_with_ads: 'P/L (With Ads)',
    sku_wise_ads: 'SKU Wise Ads',
    total_quantity: 'Total Qty',
    replacement_quantity: 'Replacement Qty',   // overridden per env below
    delivered_quantity: 'Delivered Qty',
    customer_return_quantity: 'Return Qty',
    rto_quantity: 'RTO Qty',
    refund_loss_quantity: 'Refund Loss Qty',
    cancel_quantity: 'Cancel Qty',
    fulfilment_source: 'Fulfilment Source',
    order_date: 'Order Date',
    return_pct: 'Return (%)',
    rto_pct: 'RTO (%)',
    replacement_pct: 'Replacement (%)',
    delivered_pct: 'Delivered (%)',
    profit_pct_by_sales: 'P/L % By Sales',
    profit_pct_by_settlement: 'P/L % By Settlement',
    avg_settlement_per_delivered: 'Avg Settlement / Delivered',
    profit_with_ads_per_delivered: 'Avg P/L (With Ads)',
    profit_without_ads_per_delivered: 'Avg P/L (Without Ads)',
    profit_without_ads_per_forward: 'Avg P/L / Forward',
    sku_wise_ads_per_delivered: 'Avg Ads / Delivered',
    return_charges_per_delivered: 'Return Charges / Delivered',
    sales_contribution: 'Sales Contribution',
    profit_contribution: 'Profit Contribution',
    total_offer_amount: 'Total Offer Amount',
    my_share: 'My Share',
    flipkart_gst_credit: 'Flipkart GST Credit',
    purchase_gst_credit: 'Purchase GST Credit',
    selling_gst_debit: 'Selling GST Debit',
    available_gst_credit: 'Available GST Credit',
    meesho_gst_credit: 'Meesho GST Credit',
    meesho_return_charges: 'Return Charges',
    tcs_value: 'TCS',
    tds_value: 'TDS',
    // Amazon
    amazon_charges_other: 'Amazon Charges Other',
    gross_sales: 'Gross Sales',
    return_sales: 'Return Sales',
    shipping_service: 'Shipping Service',
    amazon_gst_credit: 'Amazon GST Credit',
    amazon_return_charges: 'Return Charges',
    safety_reimbursement: 'SAFE-T Reimbursement',
    reimbursement: 'Reimbursement',
    seller_rewards: 'Seller Rewards',
    payment_ads: 'Payment Ads',
    tds_reimbursement: 'TDS Reimbursement',
    quantity: 'Amz Quantity',
    avg_sales_per_delivered: 'Avg Sales',
    avg_purchase_per_qty: 'Avg Purchase',
    selling_fees: 'Selling Fees',
    fba_fees: 'FBA Fees',
    other_transaction_fees: 'Other Transaction Fees',
    other_fees: 'Other Fees',
    // Myntra
    forward_qty: 'Delivered Qty',
    forward_pct: 'Delivered (%)',
    reverse_qty: 'Return Qty',
    reverse_pct: 'Return (%)',
    forward_auto_spf_qty: 'Fwd Auto SPF Qty',
    forward_auto_spf_pct: 'Auto SPF (%)',
    nod_qty: 'NOD Qty',
    nod_amount: 'NOD Amount',
    auto_spf_amount: 'Auto SPF Amount',
    royalty_charges: 'Royalty Charges',
    commission: 'Commission',
    logistics_commission: 'Logistics Commission',
    brand: 'Brand',
};

// Columns whose raw value is a ratio (0–1) → display as X.XX%
export const PCT_COLS = new Set([
    'return_pct', 'rto_pct', 'delivered_pct', 'replacement_pct',
    'forward_pct', 'reverse_pct', 'forward_auto_spf_pct',
    'profit_pct_by_sales', 'profit_pct_by_settlement',
    'sales_contribution', 'profit_contribution',
]);

// Amazon-specific numeric columns (null → '0' not '—')
export const AMAZON_NUMERIC_COLS = new Set([
    'order_payment', 'amazon_charges_other', 'gross_sales', 'return_sales',
    'shipping_service', 'amazon_gst_credit',
    'safety_reimbursement', 'reimbursement', 'seller_rewards',
    'payment_ads', 'tds_reimbursement', 'quantity',
]);

// ─── Columns hidden per marketplace platform ────────────────────────────────
export const MEESHO_HIDDEN_COLUMNS = new Set([
    'fulfilment_source', 'mp_fee_settlement', 'profit_loss_with_ads',
    'sku_wise_ads', 'sku_wise_ads_per_delivered', 'profit_with_ads_per_delivered',
    'flipkart_gst_credit',
    'order_payment', 'amazon_charges_other', 'shipping_service', 'amazon_gst_credit',
    'amazon_return_charges', 'safety_reimbursement', 'reimbursement', 'seller_rewards',
    'payment_ads', 'tds_reimbursement', 'quantity', 'refund_loss_quantity',
    'selling_fees', 'fba_fees', 'other_transaction_fees', 'other_fees',
    'forward_qty', 'forward_pct', 'reverse_qty', 'reverse_pct', 'forward_auto_spf_qty', 'forward_auto_spf_pct', 'nod_qty', 'nod_amount', 'auto_spf_amount', 'royalty_charges', 'commission', 'logistics_commission', 'brand', 'total_offer_amount', 'my_share'
]);

export const FLIPKART_HIDDEN_COLUMNS = new Set([
    'meesho_gst_credit', 'meesho_return_charges', 'size', 'compensation', 'recovery',
    'order_payment', 'amazon_charges_other', 'shipping_service', 'amazon_gst_credit',
    'amazon_return_charges', 'replacement_pct',
    'safety_reimbursement', 'reimbursement', 'seller_rewards',
    'payment_ads', 'tds_reimbursement', 'quantity', 'refund_loss_quantity',
    'selling_fees', 'fba_fees', 'other_transaction_fees', 'other_fees',
    'forward_qty', 'forward_pct', 'reverse_qty', 'reverse_pct', 'forward_auto_spf_qty', 'forward_auto_spf_pct', 'nod_qty', 'nod_amount', 'auto_spf_amount', 'royalty_charges', 'commission', 'logistics_commission', 'brand'
]);

export const AMAZON_HIDDEN_COLUMNS = new Set([
    'mp_fee_settlement', 'flipkart_gst_credit', 'meesho_gst_credit',
    'meesho_return_charges', 'size', 'quantity', 'claim_payment', 'compensation', 'recovery',
    'forward_qty', 'forward_pct', 'reverse_qty', 'reverse_pct', 'forward_auto_spf_qty', 'forward_auto_spf_pct', 'nod_qty', 'nod_amount', 'auto_spf_amount', 'royalty_charges', 'commission', 'logistics_commission', 'brand', 'total_offer_amount', 'my_share'
]);

export const MYNTRA_HIDDEN_COLUMNS = new Set([
    'flipkart_gst_credit', 'meesho_gst_credit', 'purchase_gst_credit', 'selling_gst_debit', 'available_gst_credit',
    'profit_loss_with_ads', 'profit_with_ads_per_delivered', 'sku_wise_ads', 'sku_wise_ads_per_delivered',
    'meesho_return_charges', 'amazon_return_charges', 'amazon_charges_other', 'shipping_service', 'amazon_gst_credit',
    'safety_reimbursement', 'reimbursement', 'seller_rewards', 'payment_ads', 'tds_reimbursement', 'quantity',
    'selling_fees', 'fba_fees', 'other_transaction_fees', 'other_fees', 'claim_payment', 'compensation', 'recovery',
    'delivered_quantity', 'rto_quantity', 'customer_return_quantity', 'replacement_quantity', 'cancel_quantity', 'refund_loss_quantity',
    'delivered_pct', 'rto_pct', 'return_pct', 'replacement_pct',
    'mp_fee_settlement', 'return_loss', 'total_offer_amount', 'my_share'
]);

/**
 * Whether a column is visible for: the current marketplace context.
 */
export const isColVisible = (col, { isAmazon, isMeesho, isMyntra, isMeeshoSizeDisabled }) => {
    if (isMyntra && MYNTRA_HIDDEN_COLUMNS.has(col)) return false;
    if (isAmazon && AMAZON_HIDDEN_COLUMNS.has(col)) return false;
    if (isMeesho) {
        if (MEESHO_HIDDEN_COLUMNS.has(col)) return false;
        if (col === 'size' && isMeeshoSizeDisabled) return false;
    }
    if (!isMeesho && !isAmazon && !isMyntra && FLIPKART_HIDDEN_COLUMNS.has(col)) return false;
    return true;
};

/**
 * The ordered base column list (shared between both pages).
 * `master_sku` is prepended by MasterSkuCalculations as its first column.
 */
export const BASE_COLUMNS = [
    'sku',
    'size',
    'gross_sales',
    'return_sales',
    'total_sales',
    'orders_settlement',
    'mp_fee_settlement',
    'claim_payment',
    'total_cost',
    'profit_loss',
    'profit_without_ads_per_delivered',
    'profit_loss_with_ads',
    'profit_with_ads_per_delivered',
    'sku_wise_ads',
    'sku_wise_ads_per_delivered',
    'return_charges_per_delivered',
    'meesho_return_charges',
    'total_quantity',
    'delivered_quantity',
    'delivered_pct',
    'rto_quantity',
    'rto_pct',
    'customer_return_quantity',
    'return_pct',
    'replacement_quantity',
    'replacement_pct',
    'cancel_quantity',
    'refund_loss_quantity',
    'profit_pct_by_sales',
    'profit_pct_by_settlement',
    'sales_contribution',
    'profit_contribution',
    'tcs_value',
    'tds_value',
    'flipkart_gst_credit',
    'meesho_gst_credit',
    'purchase_gst_credit',
    'selling_gst_debit',
    'available_gst_credit',
    'fulfilment_source',
    'order_date',
    'return_loss',
    'total_offer_amount',
    'my_share',
    'avg_sales_per_delivered',
    'avg_purchase_per_qty',
    // Amazon Columns Segment
    'amazon_charges_other',
    'shipping_service',
    'amazon_gst_credit',
    'amazon_return_charges',
    'safety_reimbursement',
    'reimbursement',
    'seller_rewards',
    'payment_ads',
    'tds_reimbursement',
    'quantity',
    'selling_fees',
    'fba_fees',
    'other_transaction_fees',
    'other_fees',
    // Myntra Columns Segment
    'forward_qty',
    'forward_pct',
    'reverse_qty',
    'reverse_pct',
    'forward_auto_spf_qty',
    'forward_auto_spf_pct',
    'nod_qty',
    'nod_amount',
    'auto_spf_amount',
    'royalty_charges',
    'commission',
    'logistics_commission',
    'brand',
];

// ─── Cell value formatting ───────────────────────────────────────────────────

/** Format a single cell value for table display */
export const formatCellValue = (col, val) => {
    if (val === null || val === undefined) return '—';

    if (PCT_COLS.has(col)) {
        const num = parseFloat(val);
        return isNaN(num) ? '—' : (num * 100).toFixed(2) + '%';
    }

    // Exclude string / identifier columns from numeric formatting
    if (['sku', 'size', 'master_sku', 'order_id', 'neft_id', 'fulfilment_source', 'brand'].includes(col)) {
        if (col === 'size' && (val === '' || val == null)) return 'NA';
        return val;
    }

    // order_date: pg driver serialises DATE as a full ISO timestamp (e.g. '2026-01-01T00:00:00.000Z').
    // Calling new Date() on that in IST would show '2025-12-31' due to UTC offset.
    // We just take the first 10 chars (YYYY-MM-DD) to display the correct calendar date.
    if (col === 'order_date') {
        if (!val) return '—';
        if (val instanceof Date) {
            return val.toISOString().slice(0, 10);
        }
        const s = String(val);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return s.slice(0, 10);
    }

    const num = parseFloat(val);
    if (!isNaN(num) && String(val).trim() !== '') {
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }
    return val;
};

// ─── Cell colour helpers ─────────────────────────────────────────────────────

export const getReturnPctStyle = (val) => {
    if (val === null || val === undefined || val === '—') return '';
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    const pct = num * 100;
    if (pct >= 1 && pct <= 7) return 'text-green-800 bg-green-50 font-semibold';
    if (pct > 24) return 'text-red-800 bg-red-50 font-semibold';
    return '';
};

export const getFinancialColorClass = (val) => {
    if (val === null || val === undefined || val === '—') return '';
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return '';
    if (num > 0) return 'text-green-800 bg-green-50 font-semibold';
    if (num < 0) return 'text-red-800 bg-red-50 font-semibold';
    return '';
};

export const getNegativeRedColorClass = (val) => {
    if (val === null || val === undefined || val === '—') return '';
    const num = parseFloat(val);
    if (isNaN(num) || num >= 0) return '';
    return 'text-red-800 bg-red-50 font-semibold';
};

export const getTextOnlyFinancialColorClass = (val) => {
    if (val === null || val === undefined || val === '—') return '';
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return '';
    if (num > 0) return 'text-green-700 font-semibold';
    if (num < 0) return 'text-red-700 font-semibold';
    return '';
};

/** Pick the right colour class for a given column + value combination */
export const getCellStyleClasses = (col, val) => {
    if (['return_pct', 'rto_pct'].includes(col)) return getReturnPctStyle(val);
    if (['profit_loss', 'profit_loss_with_ads', 'profit_without_ads_per_delivered', 'profit_with_ads_per_delivered'].includes(col))
        return getFinancialColorClass(val);
    if (['orders_settlement', 'avg_settlement_per_delivered'].includes(col))
        return getNegativeRedColorClass(val);
    if (['profit_pct_by_sales', 'profit_pct_by_settlement', 'sales_contribution', 'profit_contribution'].includes(col))
        return getTextOnlyFinancialColorClass(val);
    return '';
};

// ─── Row enrichment ──────────────────────────────────────────────────────────

/** Add sales_contribution and profit_contribution based on grand totals */
export const enrichRowWithContributions = (row, totalRow) => {
    const grandTotalSales = parseFloat(totalRow?.total_sales) || 0;
    const grandTotalProfit = parseFloat(totalRow?.profit_loss_with_ads) || 0;
    const rowProfit = parseFloat(row.profit_loss_with_ads) || 0;
    const netSales = parseFloat(row.total_sales) || 0;
    return {
        ...row,
        sales_contribution: grandTotalSales ? netSales / grandTotalSales : null,
        profit_contribution: grandTotalProfit ? rowProfit / grandTotalProfit : null,
    };
};

// ─── GST adjustment ──────────────────────────────────────────────────────────

/**
 * Compute memoised grand-total adjusted profits for the GST overlay.
 * Call this once (useMemo) in the page component.
 */
export const computeGrandProfits = (totalRow, { isAmazon, isMeesho }) => {
    if (!totalRow) return { grand_adj_pl_with_ads: 0, grand_adj_pl: 0 };

    let grand_adj_pl_with_ads = 0;
    let grand_adj_pl = 0;

    if (isAmazon) {
        const t_avail = parseFloat(totalRow.available_gst_credit) || 0;
        const t_tcs = parseFloat(totalRow.tcs_value) || 0;
        const t_tds = parseFloat(totalRow.tds_value) || 0;
        const t_agc = parseFloat(totalRow.amazon_gst_credit) || 0;
        const t_pgc = parseFloat(totalRow.purchase_gst_credit) || 0;
        const t_sgd = parseFloat(totalRow.selling_gst_debit) || 0;
        grand_adj_pl_with_ads = (parseFloat(totalRow.profit_loss_with_ads) || 0) + t_avail + t_tcs + t_tds;
        grand_adj_pl = (parseFloat(totalRow.profit_loss) || 0) + (t_agc + t_pgc + t_sgd + t_tcs + t_tds);
    } else if (isMeesho) {
        const t_tcs = parseFloat(totalRow.tcs_value) || 0;
        const t_tds = parseFloat(totalRow.tds_value) || 0;
        const t_delta = (parseFloat(totalRow.meesho_gst_credit) || 0)
            + (parseFloat(totalRow.purchase_gst_credit) || 0)
            + (parseFloat(totalRow.selling_gst_debit) || 0)
            - t_tcs - t_tds;
        grand_adj_pl = (parseFloat(totalRow.profit_loss) || 0) + t_delta;
        grand_adj_pl_with_ads = grand_adj_pl;
    } else {
        // Flipkart
        const t_fgc = parseFloat(totalRow.flipkart_gst_credit) || 0;
        const t_pgc = parseFloat(totalRow.purchase_gst_credit) || 0;
        const t_sgd = parseFloat(totalRow.selling_gst_debit) || 0;
        const t_tcs = parseFloat(totalRow.tcs_value) || 0;
        const t_tds = parseFloat(totalRow.tds_value) || 0;
        const t_avail = parseFloat(totalRow.available_gst_credit) || 0;
        grand_adj_pl_with_ads = (parseFloat(totalRow.profit_loss_with_ads) || 0) + t_avail - t_tcs - t_tds;
        grand_adj_pl = (parseFloat(totalRow.profit_loss) || 0) + (t_fgc + t_pgc + t_sgd - t_tcs - t_tds);
    }
    return { grand_adj_pl_with_ads, grand_adj_pl };
};

/**
 * Apply GST adjustment to a single row (in with_gst mode).
 * Requires grandProfits object from computeGrandProfits().
 */
export const applyGstAdjustment = (row, { gstMode, isAmazon, isMeesho, grandProfits } = {}) => {
    if (!row || gstMode !== 'with_gst') return row;
    const { grand_adj_pl_with_ads, grand_adj_pl } = grandProfits;

    const delivered_qty = parseFloat(row.delivered_quantity) || 0;
    const total_sales = parseFloat(row.total_sales) || 0;
    const orders_settlement = parseFloat(row.orders_settlement) || 0;

    if (isAmazon) {
        const agc = parseFloat(row.amazon_gst_credit) || 0;
        const pgc = parseFloat(row.purchase_gst_credit) || 0;
        const sgd = parseFloat(row.selling_gst_debit) || 0;
        const tcs = parseFloat(row.tcs_value) || 0;
        const tds = parseFloat(row.tds_value) || 0;
        const avail_gst = parseFloat(row.available_gst_credit) || 0;
        const adj_pl = (parseFloat(row.profit_loss) || 0) + agc + pgc + sgd - tcs - tds;
        const adj_pl_with_ads = (parseFloat(row.profit_loss_with_ads) || 0) + avail_gst - tcs - tds;
        return {
            ...row,
            profit_loss: adj_pl,
            profit_loss_with_ads: adj_pl_with_ads,
            profit_without_ads_per_delivered: delivered_qty > 0 ? adj_pl / delivered_qty : row.profit_without_ads_per_delivered,
            profit_with_ads_per_delivered: delivered_qty > 0 ? adj_pl_with_ads / delivered_qty : row.profit_with_ads_per_delivered,
            profit_pct_by_sales: total_sales !== 0 ? adj_pl_with_ads / total_sales : row.profit_pct_by_sales,
            profit_pct_by_settlement: orders_settlement !== 0 ? adj_pl_with_ads / orders_settlement : row.profit_pct_by_settlement,
            ...(row.profit_contribution != null && grand_adj_pl_with_ads !== 0
                ? { profit_contribution: adj_pl_with_ads / grand_adj_pl_with_ads }
                : {}),
        };
    }

    if (isMeesho) {
        const mgc = parseFloat(row.meesho_gst_credit) || 0;
        const pgc = parseFloat(row.purchase_gst_credit) || 0;
        const sgd = parseFloat(row.selling_gst_debit) || 0;
        const tcs = parseFloat(row.tcs_value) || 0;
        const tds = parseFloat(row.tds_value) || 0;
        const adj_pl = (parseFloat(row.profit_loss) || 0) + mgc + pgc + sgd - tcs - tds;
        return {
            ...row,
            profit_loss: adj_pl,
            profit_loss_with_ads: adj_pl,
            profit_without_ads_per_delivered: delivered_qty > 0 ? adj_pl / delivered_qty : row.profit_without_ads_per_delivered,
            profit_with_ads_per_delivered: delivered_qty > 0 ? adj_pl / delivered_qty : row.profit_with_ads_per_delivered,
            profit_pct_by_sales: total_sales !== 0 ? adj_pl / total_sales : row.profit_pct_by_sales,
            profit_pct_by_settlement: orders_settlement !== 0 ? adj_pl / orders_settlement : row.profit_pct_by_settlement,
            ...(row.profit_contribution != null && grand_adj_pl !== 0
                ? { profit_contribution: adj_pl / grand_adj_pl }
                : {}),
        };
    }

    // Flipkart
    const fgc = parseFloat(row.flipkart_gst_credit) || 0;
    const pgc = parseFloat(row.purchase_gst_credit) || 0;
    const sgd = parseFloat(row.selling_gst_debit) || 0;
    const tcs = parseFloat(row.tcs_value) || 0;
    const tds = parseFloat(row.tds_value) || 0;
    const avail_gst = parseFloat(row.available_gst_credit) || 0;
    const adj_pl = (parseFloat(row.profit_loss) || 0) + fgc + pgc + sgd - tcs - tds;
    const adj_pl_with_ads = (parseFloat(row.profit_loss_with_ads) || 0) + avail_gst - tcs - tds;
    return {
        ...row,
        profit_loss: adj_pl,
        profit_loss_with_ads: adj_pl_with_ads,
        profit_without_ads_per_delivered: delivered_qty > 0 ? adj_pl / delivered_qty : row.profit_without_ads_per_delivered,
        profit_with_ads_per_delivered: delivered_qty > 0 ? adj_pl_with_ads / delivered_qty : row.profit_with_ads_per_delivered,
        profit_pct_by_sales: total_sales !== 0 ? adj_pl_with_ads / total_sales : row.profit_pct_by_sales,
        profit_pct_by_settlement: orders_settlement !== 0 ? adj_pl_with_ads / orders_settlement : row.profit_pct_by_settlement,
        ...(row.profit_contribution != null && grand_adj_pl_with_ads !== 0
            ? { profit_contribution: adj_pl_with_ads / grand_adj_pl_with_ads }
            : {}),
    };
};

// ─── API param builder ────────────────────────────────────────────────────────

/**
 * Build common query params from filter state.
 * Pass `extra` for page-specific overrides (e.g. { page, limit, skuSearch }).
 */
export const buildApiParams = (filters, extra = {}) => {
    const {
        marketplaceFilter,
        filterData,
        nullDateFilter,
        sortColumn,
        sortOrder,
        returnStatusFilter,
        warehouseFilter,
        dataTypeFilter,
        adsMode,
    } = filters;

    const params = { ...extra };

    if (marketplaceFilter) {
        params.marketplaceIds = JSON.stringify(
            Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
        );
    }
    if (!nullDateFilter) {
        if (filterData?.startDate) params.startDate = filterData.startDate;
        if (filterData?.endDate) params.endDate = filterData.endDate;
    } else {
        params.nullOrderDate = 'true';
    }
    if (sortColumn) params.sortBy = sortColumn;
    if (sortOrder) params.sortOrder = sortOrder;
    if (returnStatusFilter?.length > 0) params.returnStatuses = JSON.stringify(returnStatusFilter);
    if (warehouseFilter?.length > 0) params.warehouses = JSON.stringify(warehouseFilter);
    if (dataTypeFilter && dataTypeFilter !== 'all') params.dataTypeFilter = dataTypeFilter;
    if (adsMode) params.adsType = adsMode;

    return params;
};
