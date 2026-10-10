import React, { useMemo, useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import AdvancedDateRangePicker from '../AdvancedDateRangePicker';
import CalculationsColumnSelector from './CalculationsColumnSelector';

/**
 * Shared filter panel for PaymentsCalculations and MasterSkuCalculations.
 * Renders when showFiltersPanel === true.
 * Contains: Financial Funnel SVG, Quantity Donut, Date Picker, and Action Filters.
 *
 * Props split into logical groups:
 *
 * Marketplace
 *  - isMeesho, isFlipkart, isAmazon
 *
 * Funnel data
 *  - funnelData : { totalRow, settlements }
 *  - adsMode, gstMode
 *
 * Return status filter (for donut legend clicks)
 *  - returnStatusFilter, setReturnStatusFilter, setCurrentPage
 *  - returnStatusOptions, loading
 *  - showReturnStatusDropdown, setShowReturnStatusDropdown, returnStatusRef
 *  - handleReturnStatusToggle
 *
 * Date range
 *  - tempStartDate, tempEndDate
 *  - handleDateRangeChange, handleClearFilter
 *  - nullDateFilter, handleNullDateSelect
 *  - availableMonths, availableYears
 *  - dateError
 *
 * Column selector
 *  - allColumns, columnOrder, visibleColumns, visibleCount
 *  - selectorMode, setSelectorMode
 *  - showColumnSelector, setShowColumnSelector, columnSelectorRef
 *  - onToggleColumn, onSelectAllColumns, onDeselectAllColumns, onReorderColumn
 *  - dragOver, setDragOver, dragItemRef
 *  - COLUMN_LABELS, pinnedCol
 *
 * Warehouse filter
 *  - showWarehouseForPlatforms (boolean)
 *  - warehouseFilter, warehouseOptions, warehouseSearch, setWarehouseSearch
 *  - handleWarehouseToggle, handleClearWarehouses
 *
 * Mode toggles
 *  - gstMode, setGstMode
 *  - adsMode, setAdsMode
 *  - dataTypeFilter, setDataTypeFilter
 *  - onDataTypeChange(val) — also resets page + drill-down caches
 */
const CalculationsFunnel = ({
    // Marketplace
    isMeesho, isFlipkart, isAmazon, isMyntra,
    // Funnel data
    funnelData, adsMode, gstMode,
    // Return status
    returnStatusFilter, setReturnStatusFilter, setCurrentPage,
    returnStatusOptions, loading,
    showReturnStatusDropdown, setShowReturnStatusDropdown, returnStatusRef,
    handleReturnStatusToggle,
    // Search (SKU / order ID)
    skuSearch,
    // Date range
    tempStartDate, tempEndDate,
    handleDateRangeChange, handleClearFilter,
    nullDateFilter, handleNullDateSelect,
    availableMonths, availableYears, dateError,
    // Column selector
    allColumns, columnOrder, visibleColumns, visibleCount,
    selectorMode, setSelectorMode,
    showColumnSelector, setShowColumnSelector, columnSelectorRef,
    onToggleColumn, onSelectAllColumns, onDeselectAllColumns, onReorderColumn, onResetColumnOrder,
    dragOver, setDragOver, dragItemRef,
    COLUMN_LABELS, pinnedCol,
    // Warehouse
    showWarehouseForPlatforms,
    warehouseFilter, warehouseOptions, warehouseSearch, setWarehouseSearch,
    handleWarehouseToggle, handleClearWarehouses,
    // Brand
    showBrandForPlatforms,
    brandFilter, brandOptions, brandSearch, setBrandSearch,
    handleBrandToggle, handleClearBrands,
    // Meesho Compensation / Recovery reasons
    compensationReasonFilter, compensationReasonOptions, compensationReasonSearch, setCompensationReasonSearch,
    handleCompensationReasonToggle, handleClearCompensationReasons,
    recoveryReasonFilter, recoveryReasonOptions, recoveryReasonSearch, setRecoveryReasonSearch,
    handleRecoveryReasonToggle, handleClearRecoveryReasons,
    sizeFilter, sizeOptions, sizeSearch, setSizeSearch,
    handleSizeToggle, handleClearSizes,
    isMeeshoSizeDisabled,
    // Mode toggles
    setGstMode, setAdsMode, dataTypeFilter, setDataTypeFilter,
    onDataTypeChange,
}) => {
    // ── Funnel calculation helpers ────────────────────────────────────────────
    const funnelTotalRow = funnelData?.totalRow || {};
    const funnelSettlements = funnelData?.settlements || [];

    const [tooltipState, setTooltipState] = useState({ show: false, x: 0, y: 0, content: null });

    const handleMouseMove = (e, content) => {
        setTooltipState({
            show: true,
            x: e.clientX,
            y: e.clientY,
            content
        });
    };

    const handleMouseLeave = () => {
        setTooltipState({ show: false, x: 0, y: 0, content: null });
    };

    const grossSales = parseFloat(funnelTotalRow?.gross_sales) || 0;
    const returnSales = parseFloat(funnelTotalRow?.return_sales) || 0;
    const customerReturnSales = parseFloat(funnelTotalRow?.customer_return_sales) || 0;
    const rtoSales = parseFloat(funnelTotalRow?.rto_sales) || 0;
    const refundLossSales = parseFloat(funnelTotalRow?.refund_loss_sales) || 0;
    const netSales = parseFloat(funnelTotalRow?.total_sales) || 0;

    const filteredWarehouses = useMemo(() => {
        if (!showWarehouseForPlatforms) return [];
        return Array.from(new Set([...warehouseOptions, ...warehouseFilter]))
            .filter(wh => !warehouseSearch || wh.toLowerCase().includes(warehouseSearch.toLowerCase()));
    }, [warehouseOptions, warehouseFilter, warehouseSearch, showWarehouseForPlatforms]);

    const filteredBrands = useMemo(() => {
        if (!showBrandForPlatforms) return [];
        return Array.from(new Set([...brandOptions, ...brandFilter]))
            .filter(b => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase()));
    }, [brandOptions, brandFilter, brandSearch, showBrandForPlatforms]);

    const filteredCompensationReasons = useMemo(() => {
        if (!isMeesho) return [];
        return Array.from(new Set([...compensationReasonOptions, ...compensationReasonFilter]))
            .filter(r => !compensationReasonSearch || r.toLowerCase().includes(compensationReasonSearch.toLowerCase()));
    }, [compensationReasonOptions, compensationReasonFilter, compensationReasonSearch, isMeesho]);

    const filteredRecoveryReasons = useMemo(() => {
        if (!isMeesho) return [];
        return Array.from(new Set([...recoveryReasonOptions, ...recoveryReasonFilter]))
            .filter(r => !recoveryReasonSearch || r.toLowerCase().includes(recoveryReasonSearch.toLowerCase()));
    }, [recoveryReasonOptions, recoveryReasonFilter, recoveryReasonSearch, isMeesho]);

    const filteredSizes = useMemo(() => {
        if (!isMeesho) return [];
        return Array.from(new Set([...(sizeOptions || []), ...(sizeFilter || [])]))
            .filter(r => r != null && (!sizeSearch || String(r).toLowerCase().includes(sizeSearch.toLowerCase())));
    }, [sizeOptions, sizeFilter, sizeSearch, isMeesho]);

    let derivedAds;
    if (isMeesho) {
        derivedAds = funnelSettlements.find(s => s.name.toLowerCase().includes('ads cost'))?.value || 0;
    } else if (adsMode === 'sku_wise') {
        derivedAds = parseFloat(funnelTotalRow?.sku_wise_ads) || 0;
    } else {
        derivedAds = funnelSettlements.find(s => s.name.toLowerCase().includes('payment ads'))?.value || 0;
    }

    const orderSettlementTotal = parseFloat(funnelTotalRow?.orders_settlement) || 0;
    const derivedMpFee = orderSettlementTotal - netSales;

    let otherSettlements;
    if (isAmazon) {
        const sfVal  = parseFloat(funnelTotalRow?.selling_fees) || 0;
        const fbaVal = parseFloat(funnelTotalRow?.fba_fees) || 0;
        const otfVal = parseFloat(funnelTotalRow?.other_transaction_fees) || 0;
        const ofVal  = parseFloat(funnelTotalRow?.other_fees) || 0;
        otherSettlements = [
            ...(sfVal  !== 0 ? [{ name: 'Selling Fees',           value: sfVal }]  : []),
            ...(fbaVal !== 0 ? [{ name: 'FBA Fees',               value: fbaVal }] : []),
            ...(otfVal !== 0 ? [{ name: 'Other Transaction Fees', value: otfVal }] : []),
            ...(ofVal  !== 0 ? [{ name: 'Other Fees',             value: ofVal }]  : []),
        ];
    } else if (isMyntra) {
        const nodVal     = parseFloat(funnelTotalRow?.nod_amount) || 0;
        const aspfVal    = parseFloat(funnelTotalRow?.auto_spf_amount) || 0;
        const royaltyVal = parseFloat(funnelTotalRow?.royalty_charges) || 0;
        otherSettlements = [
            ...(nodVal     !== 0 ? [{ name: 'NOD Amount',      value: nodVal }]     : []),
            ...(aspfVal    !== 0 ? [{ name: 'Auto SPF Amount', value: aspfVal, includeInSum: false, alreadyDeducted: true }]    : []),
            ...(royaltyVal !== 0 ? [{ name: 'Royalty Charges', value: royaltyVal, includeInSum: false, alreadyDeducted: true }] : []),
        ];
    } else {
        otherSettlements = funnelSettlements.filter(s => {
            const n = s.name.toLowerCase();
            if (n.includes('payment ads')) return false;
            if ((n.includes('ads') || n.includes('ads cost')) && !n.includes('google ads')) return false;
            if (n.includes('orders settlement') || n.includes('order settlement') || n.includes('marketplace fee') || n.includes('mp fee')) return false;
            return true;
        });
    }

    // forceZeroFees: any extra (non-date) filter means account-level charges can't be
    // scoped to the filtered subset — zero them out and always show Ads as ₹0 in the tooltip.
    const hasExtraFilter =
        (returnStatusFilter && returnStatusFilter.length > 0) ||
        (warehouseFilter && warehouseFilter.length > 0) ||
        !!(skuSearch && skuSearch.trim());
    const forceZeroFees = hasExtraFilter;

    if (forceZeroFees) {
        derivedAds = 0;
        const zeroOutKeywords = ['tds', 'tcs', 'storage', 'google ads', 'value added', 'non order spf'];
        otherSettlements = otherSettlements.map(s => {
            const n = s.name.toLowerCase();
            if (zeroOutKeywords.some(kw => n.includes(kw))) {
                return { ...s, value: 0 };
            }
            return s;
        });
    }

    const otherSettlementsSum = otherSettlements
        .filter(s => s.includeInSum !== false)
        .reduce((sum, s) => sum + s.value, 0);

    const tcsFunnel = isAmazon ? (parseFloat(funnelTotalRow?.tcs_value) || 0) : 0;
    const tdsFunnel = isAmazon ? (parseFloat(funnelTotalRow?.tds_value) || 0) : 0;

    const finalNetSettlement = netSales + (!isAmazon ? derivedMpFee : 0) + otherSettlementsSum + derivedAds + tcsFunnel + tdsFunnel;

    const pcAbs = parseFloat(funnelTotalRow?.total_cost) || 0;
    const rlAbs = parseFloat(funnelTotalRow?.return_loss) || 0;

    const gstItems = [];
    if (isFlipkart && gstMode === 'with_gst') {
        const rawAdsAbs = adsMode === 'sku_wise'
            ? parseFloat(funnelTotalRow?.sku_wise_ads) || 0
            : parseFloat(funnelSettlements.find(s => s.name.toLowerCase().includes('payment ads'))?.value || 0);
        const adsGST       = forceZeroFees ? 0 : (rawAdsAbs * (18 / 118) * -1);
        const storageVal   = parseFloat(otherSettlements.find(s => s.name.toLowerCase().includes('storage'))?.value || 0);
        const storageGST   = storageVal * (18 / 118);
        const vasVal       = parseFloat(otherSettlements.find(s => s.name.toLowerCase().includes('value added'))?.value || 0);
        const vasGST       = vasVal * (18 / 118);
        const googleAdsVal = parseFloat(otherSettlements.find(s => s.name.toLowerCase().includes('google ads'))?.value || 0);
        const googleAdsGST = googleAdsVal * (18 / 118);
        const fkGSTCredit  = parseFloat(funnelTotalRow?.flipkart_gst_credit) || 0;
        const pgc          = parseFloat(funnelTotalRow?.purchase_gst_credit) || 0;
        const sgd          = parseFloat(funnelTotalRow?.selling_gst_debit) || 0;
        const tcs          = parseFloat(funnelTotalRow?.tcs_value) || 0;
        const tds          = parseFloat(funnelTotalRow?.tds_value) || 0;
        gstItems.push({ name: 'Ads GST Credit', value: adsGST });
        gstItems.push({ name: 'Storage & Recall GST Credit', value: storageGST });
        gstItems.push({ name: 'Value Added Service GST Credit', value: vasGST });
        gstItems.push({ name: 'Google Ads GST Credit', value: googleAdsGST });
        gstItems.push({ name: 'Flipkart GST Credit', value: fkGSTCredit });
        gstItems.push({ name: 'Purchase GST Credit', value: pgc });
        gstItems.push({ name: 'Selling GST Debit', value: sgd });
        gstItems.push({ name: 'TCS', value: tcs * -1 });
        gstItems.push({ name: 'TDS', value: tds * -1 });
    }
    if (isMeesho && gstMode === 'with_gst') {
        const mgc = parseFloat(funnelTotalRow?.meesho_gst_credit) || 0;
        const pgc = parseFloat(funnelTotalRow?.purchase_gst_credit) || 0;
        const sgd = parseFloat(funnelTotalRow?.selling_gst_debit) || 0;
        const tcs = parseFloat(funnelTotalRow?.tcs_value) || 0;
        const tds = parseFloat(funnelTotalRow?.tds_value) || 0;
        const rawAdsAbs = parseFloat(funnelSettlements.find(s => s.name.toLowerCase().includes('ads cost'))?.value || 0);
        const adsGST = rawAdsAbs * (18 / 118) * -1;
        gstItems.push({ name: 'Meesho GST Credit', value: mgc });
        gstItems.push({ name: 'Purchase GST Credit', value: pgc });
        gstItems.push({ name: 'Selling GST Debit', value: sgd });
        gstItems.push({ name: 'TCS', value: tcs * -1 });
        gstItems.push({ name: 'TDS', value: tds * -1 });
        gstItems.push({ name: 'Ads GST Credit', value: adsGST });
    }
    if (isAmazon && gstMode === 'with_gst') {
        const rawAdsAbs = adsMode === 'sku_wise'
            ? parseFloat(funnelTotalRow?.sku_wise_ads) || 0
            : parseFloat(funnelSettlements.find(s => s.name.toLowerCase().includes('payment ads'))?.value || 0);
        const adsGST = rawAdsAbs * (18 / 118) * -1;
        const amzGST = parseFloat(funnelTotalRow?.amazon_gst_credit) || 0;
        const pgc    = parseFloat(funnelTotalRow?.purchase_gst_credit) || 0;
        const sgd    = parseFloat(funnelTotalRow?.selling_gst_debit) || 0;
        const tcs    = parseFloat(funnelTotalRow?.tcs_value) || 0;
        const tds    = parseFloat(funnelTotalRow?.tds_value) || 0;
        gstItems.push({ name: 'Ads GST Credit', value: adsGST });
        gstItems.push({ name: 'Amazon GST Credit', value: amzGST });
        gstItems.push({ name: 'Purchase GST Credit', value: pgc });
        gstItems.push({ name: 'Selling GST Debit', value: sgd });
        gstItems.push({ name: 'TCS', value: tcs * -1 });
        gstItems.push({ name: 'TDS', value: tds * -1 });
    }
    const gstSum = gstItems.reduce((sum, s) => sum + s.value, 0);
    const finalPL = finalNetSettlement - pcAbs - rlAbs + gstSum;

    const hoverSettlements = [
        ...otherSettlements,
        ...(!isAmazon && derivedMpFee !== 0 ? [{ name: isMeesho ? 'Shipping Charges and Other' : 'MP Fee', value: derivedMpFee }] : []),
        ...(derivedAds !== 0 || forceZeroFees ? [{ name: 'Ads', value: forceZeroFees ? 0 : derivedAds }] : []),
        ...(tcsFunnel !== 0 ? [{ name: 'TCS', value: tcsFunnel }] : []),
        ...(tdsFunnel !== 0 ? [{ name: 'TDS', value: tdsFunnel }] : []),
    ];

    const mpFeeChange = finalNetSettlement - netSales;
    const costChange = finalPL - finalNetSettlement;

    const formatVal = (v) => `₹${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const formatValWithSign = (v) => `${v < 0 ? '-' : ''}₹${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const formatDecimal = (v) => `${v < 0 ? '-₹' : '₹'}${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const totalQty    = parseInt(funnelTotalRow?.total_quantity) || 0;
    const deliveredQty = isMyntra ? (parseInt(funnelTotalRow?.forward_qty) || 0) : (parseInt(funnelTotalRow?.delivered_quantity) || 0);
    const avgPL = totalQty > 0 ? (finalPL / totalQty) : 0;
    const avgPLDelivered = deliveredQty > 0 ? (finalPL / deliveredQty) : 0;
    const adsAbs = Math.abs(derivedAds);
    const avgAds = totalQty > 0 ? (adsAbs / totalQty) : 0;
    const avgAdsDelivered = deliveredQty > 0 ? (adsAbs / deliveredQty) : 0;

    const calcPct = (part, whole) => {
        if (!whole || whole === 0) return '0.00';
        let p = (part / whole) * 100;
        if (p < 100 && p.toFixed(2) === '100.00') return '99.99';
        return p.toFixed(2);
    };
    const pctNS = calcPct(netSales, grossSales);
    const pctSettlementFromNS = calcPct(finalNetSettlement, netSales);
    const pctSettlementFromGS = calcPct(finalNetSettlement, grossSales);
    const pctPLFromSettlement = calcPct(finalPL, finalNetSettlement);
    const pctPLFromNS = calcPct(finalPL, netSales);
    const pctPLFromGS = calcPct(finalPL, grossSales);

    // ── Donut chart ───────────────────────────────────────────────────────────
    const rtoQty        = parseInt(funnelTotalRow?.rto_quantity) || 0;
    const returnQty     = parseInt(funnelTotalRow?.customer_return_quantity) || 0;
    const replacementQty = parseInt(funnelTotalRow?.replacement_quantity) || 0;
    const refundLossQty = parseInt(funnelTotalRow?.refund_loss_quantity) || 0;

    const segments = isMyntra ? [
        { label: 'Return Qty', filterKey: 'Reverse', qty: parseInt(funnelTotalRow?.reverse_qty) || 0, color: '#d97706', textColor: 'text-amber-700', bg: 'bg-amber-100', selectedBg: 'bg-amber-200' },
        { label: 'Delivered Qty', filterKey: 'Forward', qty: parseInt(funnelTotalRow?.forward_qty) || 0, color: '#16a34a', textColor: 'text-green-700', bg: 'bg-green-100', selectedBg: 'bg-green-200' },
        { label: 'NOD Qty', filterKey: 'NOD', qty: parseInt(funnelTotalRow?.nod_qty) || 0, color: '#ea580c', textColor: 'text-orange-700', bg: 'bg-orange-100', selectedBg: 'bg-orange-200' },
        { label: 'Fwd Auto SPF Qty', filterKey: 'Forward Auto SPF', qty: parseInt(funnelTotalRow?.forward_auto_spf_qty) || 0, color: '#6366f1', textColor: 'text-indigo-700', bg: 'bg-indigo-100', selectedBg: 'bg-indigo-200' },
    ] : [
        { label: isMeesho ? 'Exchange Qty' : 'Replacement Qty', filterKey: isMeesho ? 'Exchange' : 'Replacement', qty: replacementQty, color: '#6366f1', textColor: 'text-indigo-700', bg: 'bg-indigo-100', selectedBg: 'bg-indigo-200' },
        { label: 'Delivered Qty', filterKey: 'Delivered', qty: deliveredQty, color: '#16a34a', textColor: 'text-green-700', bg: 'bg-green-100', selectedBg: 'bg-green-200' },
        { label: 'RTO Qty', filterKey: 'RTO', qty: rtoQty, color: '#ea580c', textColor: 'text-orange-700', bg: 'bg-orange-100', selectedBg: 'bg-orange-200' },
        { label: 'Return Qty', filterKey: 'Return', qty: returnQty, color: '#d97706', textColor: 'text-amber-700', bg: 'bg-amber-100', selectedBg: 'bg-amber-200' },
    ];
    if (isAmazon) {
        segments.push({ label: 'Refund Loss Qty', filterKey: 'Refund-Loss', qty: refundLossQty, color: '#6b7280', textColor: 'text-gray-700', bg: 'bg-gray-100', selectedBg: 'bg-gray-200', hideLabel: true });
    }
    const cx = 100, cy = 100, r = 72, innerR = 46;
    const gap = 0.018;
    const arcPath = (startAngle, endAngle, outerR, inR) => {
        const sa = startAngle - Math.PI / 2;
        const ea = endAngle - Math.PI / 2;
        const x1 = cx + outerR * Math.cos(sa), y1 = cy + outerR * Math.sin(sa);
        const x2 = cx + outerR * Math.cos(ea), y2 = cy + outerR * Math.sin(ea);
        const x3 = cx + inR * Math.cos(ea), y3 = cy + inR * Math.sin(ea);
        const x4 = cx + inR * Math.cos(sa), y4 = cy + inR * Math.sin(sa);
        const lg = ea - sa > Math.PI ? 1 : 0;
        return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${lg} 1 ${x2} ${y2} L ${x3} ${y3} A ${inR} ${inR} 0 ${lg} 0 ${x4} ${y4} Z`;
    };
    const total2Pi = 2 * Math.PI;
    let currentAngle = 0;
    const paths = totalQty > 0
        ? segments.map(seg => {
            const fraction = seg.qty / totalQty;
            const sweep = fraction * total2Pi;
            const start = currentAngle + gap / 2;
            const end = currentAngle + sweep - gap / 2;
            currentAngle += sweep;
            return { ...seg, path: sweep > gap ? arcPath(start, end, r, innerR) : null, pct: (fraction * 100).toFixed(1) };
        })
        : segments.map(seg => ({ ...seg, path: null, pct: '0.0' }));

    const fmtQty = v => v.toLocaleString('en-IN');

    return (
        <div className="mb-8 flex flex-wrap lg:flex-nowrap gap-6 xl:gap-10 items-stretch justify-between w-full overflow-x-auto">
            {/* 1) Financial Funnel */}
            <div className="w-full lg:w-[35%] lg:flex-shrink flex-grow min-w-0 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center pt-4 pb-2 px-2 bg-white rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-base font-semibold text-slate-800 mb-2 self-start px-1">Financial Funnel</h2>
                    <div className="w-full overflow-hidden">
                        <svg viewBox="0 0 500 260" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto font-sans">
                            <g
                                onMouseMove={(e) => handleMouseMove(e, <div className="font-medium text-slate-800">Gross Sales</div>)}
                                onMouseLeave={handleMouseLeave}
                            >
                                <polygon points="50,20 450,20 400,85 100,85" className="stroke-brand-600 fill-brand-500 transition-colors hover:fill-brand-400" strokeWidth="1" />
                                <text x="250" y="47" textAnchor="middle" className="text-[11px] font-bold fill-slate-900 uppercase tracking-wide pointer-events-none">Gross Sales</text>
                                <text x="250" y="67" textAnchor="middle" className="text-[13px] font-extrabold fill-slate-900 pointer-events-none">{formatValWithSign(grossSales)}</text>
                            </g>
                            <line x1="0" y1="85" x2="500" y2="85" className="stroke-slate-200" strokeDasharray="5,5" strokeWidth="1" />

                            <g 
                                className="cursor-default"
                                onMouseMove={(e) => handleMouseMove(e, (
                                    <div className="flex flex-col gap-1 text-slate-800">
                                        <div className="font-semibold text-[13px]">Net Sales</div>
                                        <div className="text-[11px] text-slate-600">{pctNS}% of Gross Sales</div>
                                    </div>
                                ))}
                                onMouseLeave={handleMouseLeave}
                            >
                                <polygon points="100,85 400,85 350,150 150,150" className="stroke-brand-500 fill-brand-400 transition-colors hover:fill-brand-300" strokeWidth="1" />
                                <text x="250" y="112" textAnchor="middle" className="text-[11px] font-bold fill-slate-900 uppercase tracking-wide pointer-events-none">Net Sales</text>
                                <text x="250" y="132" textAnchor="middle" className="text-[13px] font-extrabold fill-slate-900 pointer-events-none">{formatValWithSign(netSales)}</text>
                            </g>
                            <text x="5" y="112" className="text-[10px] font-bold fill-slate-500 uppercase">RTO &amp;</text>
                            <text x="5" y="132" className="text-[10px] font-bold fill-slate-500 uppercase">Return</text>
                            <g 
                                className="cursor-default transition-opacity hover:opacity-80"
                                onMouseMove={(e) => handleMouseMove(e, (
                                    <div className="flex flex-col gap-1.5 min-w-[200px] text-[12px] text-slate-700">
                                        <div className="flex justify-between">
                                            <span>Customer Return (RTN):</span>
                                            <span className="font-medium">-{formatVal(customerReturnSales)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Logistics Return (RTO):</span>
                                            <span className="font-medium">-{formatVal(rtoSales)}</span>
                                        </div>
                                        {isAmazon && (
                                            <div className="flex justify-between">
                                                <span>Refund Loss:</span>
                                                <span className="font-medium">-{formatVal(refundLossSales)}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-slate-200 my-0.5"></div>
                                        <div className="flex justify-between font-bold text-slate-800">
                                            <span>Total Returns:</span>
                                            <span>-{formatVal(returnSales)}</span>
                                        </div>
                                    </div>
                                ))}
                                onMouseLeave={handleMouseLeave}
                            >
                                <text x="495" y="112" textAnchor="end" className="text-[13px] font-extrabold fill-orange-600">-{formatVal(returnSales)}</text>
                                <text x="495" y="132" textAnchor="end" className="text-[10px] font-semibold fill-slate-500">of RTO &amp; Returns</text>
                            </g>
                            <line x1="0" y1="150" x2="500" y2="150" className="stroke-slate-200" strokeDasharray="5,5" strokeWidth="1" />

                            <g 
                                className="cursor-default"
                                onMouseMove={(e) => handleMouseMove(e, (
                                    <div className="flex flex-col gap-1 text-slate-800">
                                        <div className="font-semibold text-[13px]">Net Settlement</div>
                                        <div className="text-[11px] text-slate-600">{pctSettlementFromNS}% of Net Sales</div>
                                        <div className="text-[11px] text-slate-600">{pctSettlementFromGS}% of Gross Sales</div>
                                    </div>
                                ))}
                                onMouseLeave={handleMouseLeave}
                            >
                                <polygon points="150,150 350,150 300,215 200,215" className="stroke-indigo-300 fill-indigo-200 transition-colors hover:fill-indigo-100" strokeWidth="1" />
                                <text x="250" y="177" textAnchor="middle" className="text-[11px] font-bold fill-slate-900 uppercase tracking-wide pointer-events-none">Net Settlement</text>
                                <text x="250" y="197" textAnchor="middle" className="text-[13px] font-extrabold fill-slate-900 pointer-events-none">{formatValWithSign(finalNetSettlement)}</text>
                            </g>
                            <text x="5" y="177" className="text-[10px] font-bold fill-slate-500 uppercase">MARKETPLACE</text>
                            <text x="5" y="197" className="text-[10px] font-bold fill-slate-500 uppercase">FEE CHARGES</text>
                            <g 
                                className="cursor-default transition-opacity hover:opacity-80"
                                onMouseMove={(e) => handleMouseMove(e, (
                                    <div className="flex flex-col gap-1.5 min-w-[220px] text-[12px] text-slate-700">
                                        {hoverSettlements.map((s, idx) => (
                                            <div key={idx} className={`flex justify-between gap-4 ${s.alreadyDeducted ? 'text-amber-600' : ''}`}>
                                                <span className="flex flex-col">
                                                    <span>{s.name}</span>
                                                    {s.alreadyDeducted && <span className="text-[10px] opacity-80 leading-none mt-0.5">(Already Deducted)</span>}
                                                </span>
                                                <span className="font-medium whitespace-nowrap">{formatValWithSign(s.value)}</span>
                                            </div>
                                        ))}
                                        <div className="border-t border-slate-200 my-0.5"></div>
                                        <div className="flex justify-between gap-4 font-bold text-slate-800">
                                            <span>Total Deducted</span>
                                            <span>{formatValWithSign(mpFeeChange)}</span>
                                        </div>
                                    </div>
                                ))}
                                onMouseLeave={handleMouseLeave}
                            >
                                <text x="495" y="177" textAnchor="end" className="text-[13px] font-extrabold fill-orange-600">{formatValWithSign(mpFeeChange)}</text>
                                <text x="495" y="197" textAnchor="end" className="text-[10px] font-semibold fill-slate-500">of MP Fee</text>
                            </g>
                            <line x1="0" y1="215" x2="500" y2="215" className="stroke-slate-200" strokeDasharray="5,5" strokeWidth="1" />

                            <g 
                                className="cursor-default"
                                onMouseMove={(e) => handleMouseMove(e, (
                                    <div className="flex flex-col gap-1 text-slate-800">
                                        <div className="font-semibold text-[13px]">Net P/L</div>
                                        <div className="text-[11px] text-slate-600">{pctPLFromSettlement}% of Net Settlement</div>
                                        <div className="text-[11px] text-slate-600">{pctPLFromNS}% of Net Sales</div>
                                        <div className="text-[11px] text-slate-600">{pctPLFromGS}% of Gross Sales</div>
                                    </div>
                                ))}
                                onMouseLeave={handleMouseLeave}
                            >
                                <polygon points="200,215 300,215 275,250 225,250" className={finalPL >= 0 ? 'stroke-green-600 fill-green-500 transition-colors hover:fill-green-400' : 'stroke-red-600 fill-red-500 transition-colors hover:fill-red-400'} strokeWidth="1" />
                                <text x="250" y="236" textAnchor="middle" className="text-[11px] font-bold fill-slate-900 uppercase tracking-wide pointer-events-none">Net P/L</text>
                            </g>
                            {((isFlipkart || isMeesho || isAmazon) && gstMode === 'with_gst') ? (
                                <>
                                    <text x="5" y="230" className="text-[9px] font-bold fill-slate-500 uppercase">PRODUCT COST,</text>
                                    <text x="5" y="248" className="text-[9px] font-bold fill-slate-500 uppercase">RETURN LOSS &amp; TAXES</text>
                                </>
                            ) : (
                                <>
                                    <text x="5" y="230" className="text-[10px] font-bold fill-slate-500 uppercase">PRODUCT COST &amp;</text>
                                    <text x="5" y="248" className="text-[10px] font-bold fill-slate-500 uppercase">RETURN LOSS</text>
                                </>
                            )}
                            <g 
                                className="cursor-default transition-opacity hover:opacity-80"
                                onMouseMove={(e) => handleMouseMove(e, (
                                    <div className="flex flex-col gap-1.5 min-w-[200px] text-[12px] text-slate-700">
                                        <div className="flex justify-between gap-4">
                                            <span>Product Cost:</span>
                                            <span className="font-medium">{formatValWithSign(-pcAbs)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span>Return Loss:</span>
                                            <span className="font-medium">{formatValWithSign(-rlAbs)}</span>
                                        </div>
                                        {gstItems.map((g, idx) => (
                                            <div key={idx} className="flex justify-between gap-4">
                                                <span>{g.name}:</span>
                                                <span className="font-medium">{formatValWithSign(g.value)}</span>
                                            </div>
                                        ))}
                                        <div className="border-t border-slate-200 my-0.5"></div>
                                        <div className="flex justify-between gap-4 font-bold text-slate-800">
                                            <span>Net Deducted:</span>
                                            <span>{formatValWithSign(costChange)}</span>
                                        </div>
                                    </div>
                                ))}
                                onMouseLeave={handleMouseLeave}
                            >
                                <text x="495" y="230" textAnchor="end" className="text-[13px] font-extrabold fill-orange-600">{formatValWithSign(costChange)}</text>
                                <text x="495" y="248" textAnchor="end" className="text-[10px] font-semibold fill-slate-500">{((isFlipkart || isMeesho || isAmazon) && gstMode === 'with_gst') ? 'of PC, RL & Taxes' : 'of PC & RL'}</text>
                            </g>
                        </svg>
                        
                        {/* Custom Tooltip Overlay */}
                        {tooltipState.show && tooltipState.content && (
                            <div 
                                className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-3 pointer-events-none"
                                style={{ 
                                    left: tooltipState.x + 15, 
                                    top: tooltipState.y + 15,
                                }}
                            >
                                {tooltipState.content}
                            </div>
                        )}
                        <div className="flex justify-center -mt-1 mb-3">
                            <div className={`px-6 py-2 rounded-lg border-2 bg-white shadow-sm ${finalPL >= 0 ? 'border-green-400' : 'border-red-400'}`}>
                                <span className={`text-[18px] font-extrabold ${finalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {finalPL < 0 ? '-' : ''}₹{Math.abs(finalPL).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                        <div className="pb-2 flex flex-wrap justify-center gap-4">
                            <span title={`Avg Ads: ${formatDecimal(avgAds)} / Dispatched`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded text-[12px] font-semibold text-slate-700 shadow-sm cursor-default">
                                Avg P/L: <span className={finalPL >= 0 ? 'text-green-700' : 'text-red-700'}>{formatDecimal(avgPL)}</span> / Dispatched
                            </span>
                            <span title={`Avg Ads: ${formatDecimal(avgAdsDelivered)} / Delivered`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded text-[12px] font-semibold text-slate-700 shadow-sm cursor-default">
                                Avg P/L: <span className={finalPL >= 0 ? 'text-green-700' : 'text-red-700'}>{formatDecimal(avgPLDelivered)}</span> / Delivered
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2) Quantity Donut Chart */}
            <div className="w-full lg:w-[25%] lg:flex-shrink flex-grow min-w-0 flex flex-col">
                <div className="w-full flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center p-4">
                    <div className="w-full flex items-center justify-between mb-3 relative" ref={returnStatusRef}>
                        <h2 className="text-base font-semibold text-slate-800">Quantity Breakdown</h2>
                        <button
                            onClick={() => setShowReturnStatusDropdown(!showReturnStatusDropdown)}
                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors ${returnStatusFilter.length > 0 ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-100'}`}
                            title="Filter by Return Status"
                        >
                            <Filter size={16} />
                            <ChevronDown size={14} className={`transition-transform duration-200 ml-1 ${showReturnStatusDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showReturnStatusDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-[260px] bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50 flex flex-col max-h-[350px] overflow-y-auto">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                                    <span className="text-sm font-semibold text-slate-800">Return Status</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setReturnStatusFilter([]); }}
                                        className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                    {loading ? (
                                        <div className="text-xs text-slate-400 py-2">Loading statuses...</div>
                                    ) : returnStatusOptions.length === 0 ? (
                                        <div className="text-xs text-slate-400 py-2">No statuses available</div>
                                    ) : (
                                        returnStatusOptions.map((status) => (
                                            <label key={status} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={returnStatusFilter.includes(status)}
                                                    onChange={() => handleReturnStatusToggle(status)}
                                                    className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                                                />
                                                <span className="text-sm font-medium text-slate-700 leading-tight">{status}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SVG Donut */}
                    <div className="relative w-full max-w-[220px]">
                        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-sm">
                            {totalQty === 0 && (
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={r - innerR} />
                            )}
                            {paths.map((seg, i) =>
                                seg.path ? (
                                    <path key={i} d={seg.path} fill={seg.color} opacity="0.92">
                                        <title>{seg.label}: {fmtQty(seg.qty)} ({seg.pct}%)</title>
                                    </path>
                                ) : null
                            )}
                            <text x={cx} y={cy - 10} textAnchor="middle" fontSize="9" fontWeight="700" fill="#64748b" letterSpacing="0.5" className="uppercase">TOTAL QTY</text>
                            <text x={cx} y={cy + 8} textAnchor="middle" fontSize="16" fontWeight="800" fill="#1e293b">{fmtQty(totalQty)}</text>
                        </svg>
                    </div>

                    {/* Donut Legend */}
                    <div className="w-full grid grid-cols-2 gap-2 mt-4">
                        {paths.filter(seg => !seg.hideLabel).map((seg, i) => {
                            let selectKeys = (isAmazon && seg.filterKey === 'Replacement')
                                ? ['Replacement', 'Free-Replacement']
                                : [seg.filterKey];

                            let displayQty = seg.qty;
                            let displayPct = seg.pct;
                            let hoverText = seg.label;

                            if (isAmazon && seg.filterKey === 'Return') {
                                selectKeys = ['Return', 'Refund-Loss']; // Also select both if clicked
                                displayQty = returnQty + refundLossQty;
                                displayPct = totalQty > 0 ? ((displayQty / totalQty) * 100).toFixed(1) : '0.0';
                                hoverText = `Returns: ${fmtQty(returnQty)}\nRefund Loss: ${fmtQty(refundLossQty)}`;
                            }

                            const isSelected = selectKeys.every(k => returnStatusFilter.includes(k));
                            const isDimmed = returnStatusFilter.length > 0 && !isSelected;
                            let wrapperClasses = 'flex flex-col items-start rounded-lg px-3 py-2 border cursor-pointer transition-all duration-200';
                            if (isSelected) {
                                wrapperClasses += ` ${seg.selectedBg} opacity-100 shadow-sm border-transparent`;
                            } else if (isDimmed) {
                                wrapperClasses += ' bg-slate-50/50 opacity-40 border-slate-100 hover:opacity-80 grayscale-[0.2]';
                            } else {
                                wrapperClasses += ` ${seg.bg} opacity-100 border-slate-100/50 hover:border-slate-300 hover:shadow-sm`;
                            }

                            const denominator = isMyntra ? (totalQty - (parseInt(funnelTotalRow?.reverse_qty) || 0)) : (totalQty - rtoQty);
                            const perDeliveredPct = denominator > 0 ? ((displayQty / denominator) * 100).toFixed(1) : '0.0';

                            return (
                                <div
                                    key={i}
                                    title={hoverText}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setReturnStatusFilter(prev => {
                                            const allSelected = selectKeys.every(k => prev.includes(k));
                                            let updated = [...prev];
                                            if (allSelected) {
                                                updated = updated.filter(s => !selectKeys.includes(s));
                                            } else {
                                                selectKeys.forEach(k => { if (!updated.includes(k)) updated.push(k); });
                                            }
                                            setCurrentPage(1);
                                            return updated;
                                        });
                                    }}
                                    className={wrapperClasses}
                                    style={{ borderColor: isSelected ? seg.color : '', boxShadow: isSelected ? `0 0 0 1px ${seg.color}` : '' }}
                                >
                                    <div className="flex items-center gap-1.5 mb-0.5 pointer-events-none">
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 leading-tight">{seg.label}</span>
                                    </div>
                                    <p className={`text-sm font-bold ${seg.textColor} leading-tight pointer-events-none`}>{fmtQty(displayQty)}</p>
                                    <p className="text-[10px] text-slate-400 font-medium pointer-events-none">
                                        <span title="% value of total quantities">{displayPct}% (All)</span>
                                        <span className="mx-1">•</span>
                                        <span className="text-slate-500 font-semibold" title="% value of delivered + rto + returned quantities">{perDeliveredPct}%</span>
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 3) Date Range Panel */}
            <div className="w-full lg:w-[25%] lg:flex-shrink flex-grow min-w-0 flex flex-col justify-center items-center gap-4 bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="w-full flex flex-col">
                    <h2 className="text-base font-semibold text-slate-800 mb-2">Date Range</h2>
                    <div className="w-full self-start">
                        <AdvancedDateRangePicker
                            startDate={tempStartDate}
                            endDate={tempEndDate}
                            onChange={handleDateRangeChange}
                            onClear={handleClearFilter}
                            maxDays={92}
                            alwaysOpen={true}
                            inlineMode={true}
                            nullDateActive={isAmazon ? nullDateFilter : false}
                            onNullDate={isAmazon ? handleNullDateSelect : null}
                            availableMonths={availableMonths}
                            availableYears={availableYears}
                            defaultMonthOpen={true}
                        />
                    </div>
                    {dateError && (
                        <div className="mt-2 w-full max-w-[300px] px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                            <p className="text-[10px] text-red-600 font-medium">{dateError}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 4) Action Filters (Column selector + Warehouse + Mode toggles) */}
            <div className="w-full lg:w-[15%] lg:flex-shrink flex-grow min-w-0 flex flex-col gap-4 bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
                {/* Column Selector */}
                <CalculationsColumnSelector
                    allColumns={allColumns}
                    columnOrder={columnOrder}
                    visibleColumns={visibleColumns}
                    visibleCount={visibleCount}
                    selectorMode={selectorMode}
                    setSelectorMode={setSelectorMode}
                    show={showColumnSelector}
                    setShow={setShowColumnSelector}
                    onToggle={onToggleColumn}
                    onSelectAll={onSelectAllColumns}
                    onDeselectAll={onDeselectAllColumns}
                    onReorder={onReorderColumn}
                    onResetColumnOrder={onResetColumnOrder}
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                    dragItemRef={dragItemRef}
                    containerRef={columnSelectorRef}
                    COLUMN_LABELS={COLUMN_LABELS}
                    isMyntra={isMyntra}
                    pinnedCol={pinnedCol}
                />

                {/* Warehouse Filter */}
                {showWarehouseForPlatforms && (
                    <div className="w-full flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-base font-semibold text-slate-800">Warehouse</h2>
                            {warehouseFilter.length > 0 && (
                                <button
                                    onClick={handleClearWarehouses}
                                    className="text-[10px] text-orange-600 hover:text-orange-700 font-medium"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="border border-slate-200 rounded-lg shadow-sm bg-white flex flex-col" style={{ maxHeight: '220px' }}>
                            <div className="sticky top-0 bg-white border-b border-slate-100 px-2 py-1.5 z-10">
                                <input
                                    type="text"
                                    placeholder="Search warehouse..."
                                    value={warehouseSearch}
                                    onChange={e => setWarehouseSearch(e.target.value)}
                                    className="w-full text-[11px] text-slate-700 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-slate-50"
                                />
                            </div>
                            {warehouseFilter.length > 0 && (
                                <div className="px-3 py-1 bg-slate-50 border-b border-slate-100">
                                    <span className="text-[10px] font-medium text-brand-600">{warehouseFilter.length} selected</span>
                                </div>
                            )}
                            <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                                {filteredWarehouses.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 px-3 py-2">No warehouses found</p>
                                ) : (
                                    filteredWarehouses.map(wh => (
                                            <label key={wh} className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={warehouseFilter.includes(wh)}
                                                    onChange={() => handleWarehouseToggle(wh)}
                                                    className="w-3.5 h-3.5 text-brand-500 border-slate-300 rounded focus:ring-brand-400 flex-shrink-0"
                                                />
                                                <span className="text-[11px] text-slate-700 leading-tight truncate" title={wh}>{wh}</span>
                                            </label>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Brand Filter */}
                {showBrandForPlatforms && (
                    <div className="w-full flex flex-col mt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-semibold text-slate-800">Brand</h2>
                            {brandFilter?.length > 0 && (
                                <button
                                    onClick={handleClearBrands}
                                    className="text-[10px] text-orange-600 hover:text-orange-700 font-medium"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="border border-slate-200 rounded-lg shadow-sm bg-white flex flex-col" style={{ maxHeight: '220px' }}>
                            <div className="sticky top-0 bg-white border-b border-slate-100 px-2 py-1.5 z-10">
                                <input
                                    type="text"
                                    placeholder="Search brand..."
                                    value={brandSearch || ''}
                                    onChange={e => setBrandSearch(e.target.value)}
                                    className="w-full text-[11px] text-slate-700 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-slate-50"
                                />
                            </div>
                            {brandFilter?.length > 0 && (
                                <div className="px-3 py-1 bg-slate-50 border-b border-slate-100">
                                    <span className="text-[10px] font-medium text-brand-600">{brandFilter.length} selected</span>
                                </div>
                            )}
                            <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                                {filteredBrands.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 px-3 py-2">No brands found</p>
                                ) : (
                                    filteredBrands.map(b => (
                                        <label key={b} className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={brandFilter?.includes(b) || false}
                                                onChange={() => handleBrandToggle(b)}
                                                className="w-3.5 h-3.5 text-brand-500 border-slate-300 rounded focus:ring-brand-400 flex-shrink-0"
                                            />
                                            <span className="text-[11px] text-slate-700 leading-tight truncate" title={b}>{b}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Meesho: Compensation Reason + Recovery Reason filters stacked vertically */}
                {isMeesho && (
                    <div className="w-full flex flex-col gap-4">
                        {/* Compensation Reason */}
                        <div className="w-full flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-base font-semibold text-slate-800">Compensation</h2>
                                {compensationReasonFilter.length > 0 && (
                                    <button onClick={handleClearCompensationReasons} className="text-[9px] text-orange-600 hover:text-orange-700 font-medium">Clear</button>
                                )}
                            </div>
                            <div className="border border-slate-200 rounded-lg shadow-sm bg-white flex flex-col" style={{ maxHeight: '150px' }}>
                                <div className="sticky top-0 bg-white border-b border-slate-100 px-1.5 py-1 z-10">
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={compensationReasonSearch}
                                        onChange={e => setCompensationReasonSearch(e.target.value)}
                                        className="w-full text-[10px] text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-slate-50"
                                    />
                                </div>
                                {compensationReasonFilter.length > 0 && (
                                    <div className="px-2 py-0.5 bg-slate-50 border-b border-slate-100">
                                        <span className="text-[9px] font-medium text-brand-600">{compensationReasonFilter.length} selected</span>
                                    </div>
                                )}
                                <div className="overflow-y-auto flex-1 p-0.5 custom-scrollbar">
                                    {filteredCompensationReasons.length === 0 ? (
                                        <p className="text-[10px] text-slate-400 px-2 py-1.5">{compensationReasonOptions.length === 0 && compensationReasonFilter.length === 0 ? 'No data' : 'No match'}</p>
                                    ) : (
                                        filteredCompensationReasons.map(r => (
                                                <label key={r} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={compensationReasonFilter.includes(r)}
                                                        onChange={() => handleCompensationReasonToggle(r)}
                                                        className="w-3 h-3 text-brand-500 border-slate-300 rounded focus:ring-brand-400 flex-shrink-0"
                                                    />
                                                    <span className="text-[10px] text-slate-700 leading-tight truncate" title={r}>{r}</span>
                                                </label>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recovery Reason */}
                        <div className="w-full flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-base font-semibold text-slate-800">Recovery</h2>
                                {recoveryReasonFilter.length > 0 && (
                                    <button onClick={handleClearRecoveryReasons} className="text-[9px] text-orange-600 hover:text-orange-700 font-medium">Clear</button>
                                )}
                            </div>
                            <div className="border border-slate-200 rounded-lg shadow-sm bg-white flex flex-col" style={{ maxHeight: '150px' }}>
                                <div className="sticky top-0 bg-white border-b border-slate-100 px-1.5 py-1 z-10">
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={recoveryReasonSearch}
                                        onChange={e => setRecoveryReasonSearch(e.target.value)}
                                        className="w-full text-[10px] text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-slate-50"
                                    />
                                </div>
                                {recoveryReasonFilter.length > 0 && (
                                    <div className="px-2 py-0.5 bg-slate-50 border-b border-slate-100">
                                        <span className="text-[9px] font-medium text-brand-600">{recoveryReasonFilter.length} selected</span>
                                    </div>
                                )}
                                <div className="overflow-y-auto flex-1 p-0.5 custom-scrollbar">
                                    {filteredRecoveryReasons.length === 0 ? (
                                        <p className="text-[10px] text-slate-400 px-2 py-1.5">{recoveryReasonOptions.length === 0 && recoveryReasonFilter.length === 0 ? 'No data' : 'No match'}</p>
                                    ) : (
                                        filteredRecoveryReasons.map(r => (
                                                <label key={r} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={recoveryReasonFilter.includes(r)}
                                                        onChange={() => handleRecoveryReasonToggle(r)}
                                                        className="w-3 h-3 text-brand-500 border-slate-300 rounded focus:ring-brand-400 flex-shrink-0"
                                                    />
                                                    <span className="text-[10px] text-slate-700 leading-tight truncate" title={r}>{r}</span>
                                                </label>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Size Filter */}
                        {!isMeeshoSizeDisabled && (
                            <div className="w-full flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-base font-semibold text-slate-800">Size</h2>
                                    {sizeFilter && sizeFilter.length > 0 && (
                                        <button onClick={handleClearSizes} className="text-[9px] text-orange-600 hover:text-orange-700 font-medium">Clear</button>
                                    )}
                                </div>
                                <div className="border border-slate-200 rounded-lg shadow-sm bg-white flex flex-col" style={{ maxHeight: '150px' }}>
                                    <div className="sticky top-0 bg-white border-b border-slate-100 px-1.5 py-1 z-10">
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={sizeSearch}
                                            onChange={e => setSizeSearch(e.target.value)}
                                            className="w-full text-[10px] text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-slate-50"
                                        />
                                    </div>
                                    {sizeFilter && sizeFilter.length > 0 && (
                                        <div className="px-2 py-0.5 bg-slate-50 border-b border-slate-100">
                                            <span className="text-[9px] font-medium text-brand-600">{sizeFilter.length} selected</span>
                                        </div>
                                    )}
                                    <div className="overflow-y-auto flex-1 p-0.5 custom-scrollbar">
                                        {filteredSizes.length === 0 ? (
                                            <p className="text-[10px] text-slate-400 px-2 py-1.5">{(!sizeOptions || sizeOptions.length === 0) && (!sizeFilter || sizeFilter.length === 0) ? 'No data' : 'No match'}</p>
                                        ) : (
                                            filteredSizes.map(r => (
                                                    <label key={r} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={sizeFilter && sizeFilter.includes(r)}
                                                            onChange={() => handleSizeToggle(r)}
                                                            className="w-3 h-3 text-brand-500 border-slate-300 rounded focus:ring-brand-400 flex-shrink-0"
                                                        />
                                                        <span className="text-[10px] text-slate-700 leading-tight truncate" title={r}>{r}</span>
                                                    </label>
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};

export default CalculationsFunnel;
