import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { ArrowLeft, Loader2, FileSpreadsheet, ChevronDown, ChevronUp, ChevronRight, ArrowUp, ArrowDown, Columns, Filter, GripVertical, Search, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ExportButton from '../components/ExportButton';
import AdvancedDateRangePicker from '../components/AdvancedDateRangePicker';
import useCalculationsFilters from '../hooks/useCalculationsFilters';
import CalculationsHeader from '../components/calculations/CalculationsHeader';
import CalculationsFunnel from '../components/calculations/CalculationsFunnel';
import CalculationModal from '../components/calculations/Calculation';
import {
    COLUMN_LABELS,
    PCT_COLS,
    AMAZON_NUMERIC_COLS,
    isColVisible,
    formatCellValue,
    getCellStyleClasses,
    enrichRowWithContributions,
    applyGstAdjustment,
    computeGrandProfits,
} from '../components/calculations/calculationsUtils';

const PaymentsCalculations = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // ── Page-specific state (drill-down caches for SKU → Order → NEFT) ───────
    const [calculations, setCalculations] = useState([]);
    const [totalRow, setTotalRow] = useState(null);
    const [settlements, setSettlements] = useState([]);
    const [funnelData, setFunnelData] = useState(null);
    const [loadingFunnel, setLoadingFunnel] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
    const [expandedRows, setExpandedRows] = useState({});
    const [expandedOrders, setExpandedOrders] = useState({});
    const [ordersBysku, setOrdersBySku] = useState({});
    const [neftsByOrder, setNeftsByOrder] = useState({});
    const [loadingOrders, setLoadingOrders] = useState({});
    const [loadingNefts, setLoadingNefts] = useState({});
    const [totalCount, setTotalCount] = useState(0);

    // ── Shared filter hook ──────────────────────────────────────────────────
    const filters = useCalculationsFilters({
        storageKey: 'paymentCalculations',
        locationState: location.state,
        onReset: () => {
            setExpandedRows({});
            setExpandedOrders({});
            setOrdersBySku({});
            setNeftsByOrder({});
        },
    });

    const {
        marketplaceFilter,
        filterData, tempStartDate, tempEndDate, nullDateFilter,
        returnStatusFilter, warehouseFilter,
        dataTypeFilter, setDataTypeFilter,
        adsMode, setAdsMode,
        gstMode, setGstMode,
        shopsyFilter, setShopsyFilter,
        meeshoOrderSourceFilter, setMeeshoOrderSourceFilter,
        compensationReasonFilter, recoveryReasonFilter,
        searchTerm, setSearchTerm,
        debouncedSearchTerm, orderSearchLoading,
        currentPage, setCurrentPage, pageSize,
        sortColumn, setSortColumn, sortOrder, setSortOrder,
        isMeesho, isFlipkart, isAmazon, isMyntra, isPlatformLoaded, platformType,
        resolvedMarketplaceNames, isMeeshoSizeDisabled,
        visibleColumns, columnOrder, setColumnOrder, columnWidths,
        showColumnSelector,
        showFiltersPanel,
        tableRef, scrollContainerRef, savedScrollPos,
        searchInputRef, handleSearchClear, setDateError,
        handleResizeStart
    } = filters;
    // ── Page-specific state not in the hook ────────────────────────────────
    // eslint-disable-next-line react-hooks/exhaustive-deps

    const fetchCalculations = useCallback(async () => {
        // Save current scroll position before loading
        if (scrollContainerRef.current) {
            savedScrollPos.current = {
                top: scrollContainerRef.current.scrollTop,
                left: scrollContainerRef.current.scrollLeft
            };
        }
        // Clear drill-down caches so expanded order rows always match the current filters
        setExpandedRows({});
        setExpandedOrders({});
        setOrdersBySku({});
        setNeftsByOrder({});
        setLoading(true);
        setError('');
        try {
            const params = {
                page: currentPage,
                limit: pageSize
            };
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
            if (nullDateFilter) params.nullOrderDate = 'true';
            if (sortColumn) params.sortBy = sortColumn;
            if (sortOrder) params.sortOrder = sortOrder;
            if (debouncedSearchTerm) params.skuSearch = debouncedSearchTerm;
            if (returnStatusFilter && returnStatusFilter.length > 0) {
                params.returnStatuses = JSON.stringify(returnStatusFilter);
            }
            if (warehouseFilter && warehouseFilter.length > 0) {
                params.warehouses = JSON.stringify(warehouseFilter);
            }
            if (filters.brandFilter && filters.brandFilter.length > 0) {
                params.brands = JSON.stringify(filters.brandFilter);
            }
            if (isFlipkart && shopsyFilter !== 'all') {
                params.shopsyFilter = shopsyFilter;
            }
            if (meeshoOrderSourceFilter !== 'all') {
                params.meeshoOrderSource = meeshoOrderSourceFilter;
            }
            if (compensationReasonFilter && compensationReasonFilter.length > 0) {
                params.compensationReasons = JSON.stringify(compensationReasonFilter);
            }
            if (recoveryReasonFilter && recoveryReasonFilter.length > 0) {
                params.recoveryReasons = JSON.stringify(recoveryReasonFilter);
            }
            if (filters.sizeFilter && filters.sizeFilter.length > 0) {
                params.sizes = JSON.stringify(filters.sizeFilter);
            }
            if (dataTypeFilter && dataTypeFilter !== 'all') {
                params.dataTypeFilter = dataTypeFilter;
            }
            params.adsType = adsMode;
            console.log('Fetching calculations with params:', params);
            const { data } = await api.get('/payments/calculations', { params });
            console.log('API Response:', data);
            console.log('Calculations data:', data.data);
            console.log('Total row:', data.total);
            console.log('Settlements:', data.settlements);
            console.log('Total count:', data.totalCount);
            const fetchedData = data.data || [];
            setCalculations(fetchedData);
            setTotalRow(data.total || null);
            setSettlements(data.settlements || []);
            setTotalCount(data.totalCount || 0);
            setDateError(''); // Clear any previous date errors on success
        } catch (error) {
            console.error('Error fetching payment calculations', error);
            const errorMsg = error.response?.data?.message || 'Failed to load payment calculations';
            if (errorMsg.includes('Date range') || errorMsg.includes('date')) {
                setDateError(errorMsg);
            } else {
                setError(errorMsg);
            }
        } finally {
            setLoading(false);
            // Restore scroll position after data loads
            if (scrollContainerRef?.current && savedScrollPos?.current) {
                requestAnimationFrame(() => {
                    if (scrollContainerRef?.current && savedScrollPos?.current) {
                        scrollContainerRef.current.scrollTop = savedScrollPos.current.top || 0;
                        scrollContainerRef.current.scrollLeft = savedScrollPos.current.left || 0;
                    }
                });
            }
        }
    }, [filterData.startDate, filterData.endDate, nullDateFilter, sortColumn, sortOrder, currentPage, pageSize, marketplaceFilter, returnStatusFilter, warehouseFilter, filters.brandFilter, dataTypeFilter, debouncedSearchTerm, adsMode, shopsyFilter, meeshoOrderSourceFilter, compensationReasonFilter, recoveryReasonFilter, filters.sizeFilter, isFlipkart, isMeesho]);

    const fetchFunnelData = useCallback(async () => {
        setLoadingFunnel(true);
        try {
            const params = {};
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
            if (nullDateFilter) params.nullOrderDate = 'true';
            if (returnStatusFilter && returnStatusFilter.length > 0) {
                params.returnStatuses = JSON.stringify(returnStatusFilter);
            }
            if (warehouseFilter && warehouseFilter.length > 0) {
                params.warehouses = JSON.stringify(warehouseFilter);
            }
            if (filters.brandFilter && filters.brandFilter.length > 0) {
                params.brands = JSON.stringify(filters.brandFilter);
            }
            if (isFlipkart && shopsyFilter !== 'all') {
                params.shopsyFilter = shopsyFilter;
            }
            if (meeshoOrderSourceFilter !== 'all') {
                params.meeshoOrderSource = meeshoOrderSourceFilter;
            }
            if (compensationReasonFilter && compensationReasonFilter.length > 0) {
                params.compensationReasons = JSON.stringify(compensationReasonFilter);
            }
            if (recoveryReasonFilter && recoveryReasonFilter.length > 0) {
                params.recoveryReasons = JSON.stringify(recoveryReasonFilter);
            }
            if (filters.sizeFilter && filters.sizeFilter.length > 0) {
                params.sizes = JSON.stringify(filters.sizeFilter);
            }
            if (dataTypeFilter && dataTypeFilter !== 'all') params.dataTypeFilter = dataTypeFilter;
            params.adsType = adsMode;
            if (debouncedSearchTerm) params.skuSearch = debouncedSearchTerm;
            const { data } = await api.get('/payments/calculations/funnel', { params });
            setFunnelData(data.data || data || null);
        } catch (error) {
            console.error('Error fetching funnel data', error);
        } finally {
            setLoadingFunnel(false);
        }
    }, [filterData.startDate, filterData.endDate, nullDateFilter, marketplaceFilter, returnStatusFilter, warehouseFilter, filters.brandFilter, dataTypeFilter, adsMode, shopsyFilter, meeshoOrderSourceFilter, compensationReasonFilter, recoveryReasonFilter, filters.sizeFilter, isFlipkart, isMeesho, debouncedSearchTerm]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm]);

    // Fetch calculations when filters or pagination change
    useEffect(() => {
        fetchCalculations();
        fetchFunnelData();
    }, [fetchCalculations, fetchFunnelData]);

    useEffect(() => {
        if (!debouncedSearchTerm || calculations.length !== 1) return;
        const sku = calculations[0].sku;
        if (expandedRows[0]) return; // safety guard — should already be collapsed
        handleSkuClick(sku, calculations[0].size, 0).then((ordersData) => {
            if (ordersData && ordersData.length === 1) {
                const orderId = ordersData[0].order_id;
                const orderKey = `${sku}_${orderId}_0`;
                handleOrderClick(sku, orderId, orderKey);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calculations]);

    // When return status filter changes, clear all expanded/cached drill-down data
    // so the next expansion fetches fresh, filtered data
    useEffect(() => {
        setExpandedRows({});
        setExpandedOrders({});
        setOrdersBySku({});
        setNeftsByOrder({});
    }, [returnStatusFilter]);



    // removed auto-fetch orders and auto-scroll routines as per user request





    const getOrderApiParams = (extraParams = {}, currentSku = null) => {
        const params = { ...extraParams };
        if (nullDateFilter) {
            params.nullOrderDate = 'true';
        } else {
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
        }
        if (returnStatusFilter && returnStatusFilter.length > 0) {
            params.returnStatuses = JSON.stringify(returnStatusFilter);
        }
        if (warehouseFilter && warehouseFilter.length > 0) {
            params.warehouses = JSON.stringify(warehouseFilter);
        }
        if (isFlipkart && shopsyFilter !== 'all') {
            params.shopsyFilter = shopsyFilter;
        }
        if (meeshoOrderSourceFilter !== 'all') {
            params.meeshoOrderSource = meeshoOrderSourceFilter;
        }
        if (compensationReasonFilter && compensationReasonFilter.length > 0) {
            params.compensationReasons = JSON.stringify(compensationReasonFilter);
        }
        if (recoveryReasonFilter && recoveryReasonFilter.length > 0) {
            params.recoveryReasons = JSON.stringify(recoveryReasonFilter);
        }
        if (dataTypeFilter && dataTypeFilter !== 'all') {
            params.dataTypeFilter = dataTypeFilter;
        }
        if (marketplaceFilter) {
            params.marketplaceIds = JSON.stringify(
                Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
            );
        }
        if (sortColumn) params.sortBy = sortColumn;
        if (sortOrder) params.sortOrder = sortOrder;
        if (debouncedSearchTerm) {
            // Only filter orders by the search term if the user didn't explicitly search for the SKU itself
            if (!currentSku || !currentSku.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) {
                params.searchOrderId = debouncedSearchTerm;
            }
        }
        return params;
    };

    const handleSkuClick = async (sku, size, rowIdx) => {
        const isExpanded = expandedRows[rowIdx];
        const effectiveSize = size || 'NA';
        const cacheKey = `${sku}-${effectiveSize}`;

        if (isExpanded) {
            // Collapse the row
            setExpandedRows(prev => ({
                ...prev,
                [rowIdx]: false
            }));
        } else {
            // Expand and fetch orders if not already loaded
            setExpandedRows(prev => ({
                ...prev,
                [rowIdx]: true
            }));

            // Always re-fetch if return status filter is active to avoid stale cached data
            const needsFresh = returnStatusFilter.length > 0;
            if (!ordersBysku[cacheKey] || needsFresh) {
                setLoadingOrders(prev => ({ ...prev, [cacheKey]: true }));
                try {
                    const params = getOrderApiParams({ page: 1, limit: 50 }, sku);
                    if (!(isMeesho && isMeeshoSizeDisabled)) {
                        params.size = effectiveSize;
                    }
                    const { data } = await api.get(`/payments/calculations/${encodeURIComponent(sku)}/orders`, { params });
                    setOrdersBySku(prev => ({
                        ...prev,
                        [cacheKey]: { pages: [{ page: 1, data }], hasMore: data.length === 50 }
                    }));
                    return data;
                } catch (error) {
                    console.error('Error fetching orders for SKU:', sku, error);
                    return null;
                } finally {
                    setLoadingOrders(prev => ({ ...prev, [cacheKey]: false }));
                }
            } else {
                return ordersBysku[cacheKey]?.pages?.[0]?.data || null;
            }
        }
        return null;
    };

    const handleOrderClick = async (sku, orderId, orderKey) => {
        const isExpanded = expandedOrders[orderKey];

        if (isExpanded) {
            // Collapse the order
            setExpandedOrders(prev => ({
                ...prev,
                [orderKey]: false
            }));
        } else {
            // Expand and fetch NEFTs if not already loaded
            setExpandedOrders(prev => ({
                ...prev,
                [orderKey]: true
            }));

            const neftKey = `${sku}_${orderId}`;
            // Always re-fetch if return status filter is active to avoid stale cached data
            const needsFresh = returnStatusFilter.length > 0;
            if (!neftsByOrder[neftKey] || needsFresh) {
                setLoadingNefts(prev => ({ ...prev, [neftKey]: true }));
                try {
                    const params = getOrderApiParams({}, sku);

                    const { data } = await api.get(`/payments/calculations/${encodeURIComponent(sku)}/orders/${encodeURIComponent(orderId)}/nefts`, { params });
                    setNeftsByOrder(prev => ({
                        ...prev,
                        [neftKey]: data
                    }));
                    return data;
                } catch (error) {
                    console.error('Error fetching NEFTs for Order:', orderId, error);
                    return null;
                } finally {
                    setLoadingNefts(prev => ({ ...prev, [neftKey]: false }));
                }
            } else {
                return neftsByOrder[neftKey] || null;
            }
        }
        return null;
    };

    const handleLoadMoreOrders = async (sku, size) => {
        const cacheKey = `${sku}-${size || 'NA'}`;
        const currentData = ordersBysku[cacheKey];
        if (!currentData || !currentData.hasMore) return;
        const lastPage = currentData.pages[currentData.pages.length - 1].page;
        const nextPage = lastPage + 1;
        setLoadingOrders(prev => ({ ...prev, [cacheKey]: true }));
        try {
            const params = getOrderApiParams({ page: nextPage, limit: 50 }, sku);
            if (size) params.size = size;

            const { data } = await api.get(`/payments/calculations/${encodeURIComponent(sku)}/orders`, { params });

            setOrdersBySku(prev => {
                const prevData = prev[cacheKey];
                let newPages = [...prevData.pages, { page: nextPage, data }];
                if (newPages.length > 2) {
                    newPages = newPages.slice(newPages.length - 2);
                }
                return { ...prev, [cacheKey]: { pages: newPages, hasMore: data.length === 50 } };
            });
        } catch (error) {
            console.error('Error fetching more orders for SKU:', sku, error);
        } finally {
            setLoadingOrders(prev => ({ ...prev, [cacheKey]: false }));
        }
    };

    const handleLoadPreviousOrders = async (sku, size) => {
        const cacheKey = `${sku}-${size || 'NA'}`;
        const currentData = ordersBysku[cacheKey];
        if (!currentData || currentData.pages.length === 0) return;
        const firstPage = currentData.pages[0].page;
        if (firstPage <= 1) return;
        const prevPage = firstPage - 1;

        setLoadingOrders(prev => ({ ...prev, [cacheKey]: true }));
        try {
            const params = getOrderApiParams({ page: prevPage, limit: 50 }, sku);
            if (size) params.size = size;

            const { data } = await api.get(`/payments/calculations/${encodeURIComponent(sku)}/orders`, { params });

            setOrdersBySku(prev => {
                const prevData = prev[cacheKey];
                let newPages = [{ page: prevPage, data }, ...prevData.pages];
                if (newPages.length > 2) {
                    newPages = newPages.slice(0, 2);
                }
                return { ...prev, [cacheKey]: { pages: newPages, hasMore: true } };
            });
        } catch (error) {
            console.error('Error fetching previous orders for SKU:', sku, error);
        } finally {
            setLoadingOrders(prev => ({ ...prev, [cacheKey]: false }));
        }
    };

    // Column visibility helper is now imported from calculationsUtils — see isColVisible(col, { isAmazon, isMeesho })

    const allColumns = (isAmazon ? [
        // Amazon column order
        'sku',
        'gross_sales',
        'return_sales',
        'total_sales',
        'orders_settlement',
        'safety_reimbursement',
        'reimbursement',
        'total_cost',
        'profit_loss',
        'profit_without_ads_per_delivered',
        'profit_loss_with_ads',
        'profit_with_ads_per_delivered',
        'sku_wise_ads',
        'sku_wise_ads_per_delivered',
        'return_charges_per_delivered',
        'total_quantity',
        'delivered_quantity',
        'delivered_pct',
        'rto_quantity',
        'rto_pct',
        'customer_return_quantity',
        'return_pct',
        'replacement_quantity',
        'replacement_pct',
        'refund_loss_quantity',
        'cancel_quantity',
        'profit_pct_by_sales',
        'profit_pct_by_settlement',
        'sales_contribution',
        'profit_contribution',
        'amazon_gst_credit',
        'purchase_gst_credit',
        'selling_gst_debit',
        'available_gst_credit',
        'fulfilment_source',
        'shipping_service',
        'selling_fees',
        'fba_fees',
        'other_transaction_fees',
        'other_fees',
        'tcs_value',
        'tds_value',
        'order_date',
        'return_loss',
        'amazon_return_charges',
        'seller_rewards',
        'amazon_charges_other',
        'tds_reimbursement',
        'payment_ads',
        'avg_sales_per_delivered',
        'avg_purchase_per_qty',
        'avg_settlement_per_delivered',
    ] : isMyntra ? [
        // Myntra column order
        'sku',
        'gross_sales',
        'return_sales',
        'total_sales',
        'orders_settlement',
        'nod_amount',
        'auto_spf_amount',
        'total_cost',
        'profit_loss',
        'profit_without_ads_per_forward',
        'total_quantity',
        'forward_qty',
        'forward_pct',
        'reverse_qty',
        'reverse_pct',
        'forward_auto_spf_qty',
        'forward_auto_spf_pct',
        'nod_qty',
        'profit_pct_by_sales',
        'profit_pct_by_settlement',
        'sales_contribution',
        'profit_contribution',
        'tcs_value',
        'tds_value',
        'royalty_charges',
        'commission',
        'logistics_commission',
        'fulfilment_source',
        'brand',
        'avg_sales_per_delivered',
        'avg_purchase_per_qty',
        'avg_settlement_per_delivered',
        'order_date',
    ] : [
        // Flipkart / Meesho column order
        'sku',
        'size',
        'gross_sales',
        'return_sales',
        'total_sales',
        'total_offer_amount',
        'my_share',
        'orders_settlement',
        'mp_fee_settlement',
        'claim_payment',
        'compensation',
        'recovery',
        'total_cost',
        'profit_loss',
        'profit_without_ads_per_delivered',
        'profit_loss_with_ads',
        'profit_with_ads_per_delivered',
        'sku_wise_ads',
        'sku_wise_ads_per_delivered',
        'return_charges_per_delivered',
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
        'avg_sales_per_delivered',
        'avg_settlement_per_delivered',
        'avg_purchase_per_qty',
        'meesho_return_charges',
    ]).filter(col => isColVisible(col, { isAmazon, isMeesho, isMyntra, isMeeshoSizeDisabled }));

    // Sync columnOrder whenever allColumns changes (marketplace switch, initial load)
    // Merges the saved localStorage order with the current valid columns
    const allColumnsKey = allColumns.join(',');
    useEffect(() => {
        if (!isPlatformLoaded) return;
        // Prefer the shared order (synced from either page), fall back to page-specific key
        const sharedRaw = localStorage.getItem(`sharedCalculationsColumnOrder_v4_${platformType}`);
        const pageRaw = localStorage.getItem(`paymentCalculationsColumnOrder_v4_${platformType}`);
        const raw = sharedRaw || pageRaw;
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                // Exclude pin col from saved order then let it settle at position 0
                const withoutPin = parsed.filter(col => allColumns.includes(col) && col !== 'sku');
                const newCols = allColumns.filter(col => col !== 'sku' && !withoutPin.includes(col));
                
                let finalOrder = [...withoutPin];
                newCols.forEach(newCol => {
                    const originIdx = allColumns.indexOf(newCol);
                    let inserted = false;
                    for (let i = originIdx + 1; i < allColumns.length; i++) {
                        const targetIdx = finalOrder.indexOf(allColumns[i]);
                        if (targetIdx !== -1) {
                            finalOrder.splice(targetIdx, 0, newCol);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        for (let i = originIdx - 1; i > 0; i--) {
                            const targetIdx = finalOrder.indexOf(allColumns[i]);
                            if (targetIdx !== -1) {
                                finalOrder.splice(targetIdx + 1, 0, newCol);
                                inserted = true;
                                break;
                            }
                        }
                    }
                    if (!inserted) finalOrder.push(newCol);
                });
                
                setColumnOrder(['sku', ...finalOrder]);
            } catch {
                setColumnOrder(allColumns);
            }
        } else {
            setColumnOrder(allColumns);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allColumnsKey, isPlatformLoaded, platformType]);

    // COLUMN_LABELS, PCT_COLS, AMAZON_NUMERIC_COLS, formatCellValue, getCellStyleClasses, enrichRowWithContributions
    // are all imported from calculationsUtils. Remove duplicate local definitions below.


    // All utility functions (formatCellValue, getCellStyleClasses, enrichRowWithContributions,
    // applyGstAdjustment, computeGrandProfits) are now imported from calculationsUtils.js

    // useMemo wrapper for memoizedGrandProfits using the imported computeGrandProfits function
    const memoizedGrandProfits = useMemo(() => {
        return computeGrandProfits(totalRow, { isAmazon, isMeesho });
    }, [totalRow, isAmazon, isMeesho]);

    // Filter columns based on visibility, preserving drag order
    const columns = (columnOrder.length > 0 ? columnOrder : allColumns)
        .filter(col => allColumns.includes(col) && visibleColumns[col] !== false);
    console.log('Calculations array:', calculations);

    
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="p-4 lg:p-8 w-full max-w-[100vw] overflow-x-hidden">
                {/* Header */}
                <CalculationsHeader 
                    currentView="sku-wise"
                    onOpenCalculator={() => setIsCalculatorOpen(true)}
                    onViewSwitch={(val) => {
                        if (val === 'master-sku-wise') {
                            navigate('/payments/calculations/master-sku', {
                                state: {
                                    filters: {
                                        marketplaceIds: marketplaceFilter,
                                        startDate: filterData?.startDate,
                                        endDate: filterData?.endDate,
                                        nullOrderDate: nullDateFilter,
                                        returnStatuses: returnStatusFilter,
                                        warehouses: warehouseFilter,
                                        dataTypeFilter: dataTypeFilter,
                                        adsType: adsMode,
                                        gstMode: gstMode,
                                        shopsyFilter: isFlipkart && shopsyFilter !== 'all' ? shopsyFilter : undefined,
                                        meeshoOrderSourceFilter: isMeesho && meeshoOrderSourceFilter !== 'all' ? meeshoOrderSourceFilter : undefined,
                                        compensationReasons: isMeesho ? compensationReasonFilter : [],
                                        recoveryReasons: isMeesho ? recoveryReasonFilter : []
                                    }
                                }
                            });
                        }
                    }}
                    onBackToDashboard={() => navigate('/dashboard')}
                    onGoToSettlements={() => navigate('/payments/settlements', {
                        state: {
                            marketplaceIds: marketplaceFilter,
                            startDate: filterData.startDate,
                            endDate: filterData.endDate,
                            marketplaceIdToName: filters.marketplaceIdToName,
                        }
                    })}
                    loading={loading}
                    error={error}
                    settlements={settlements}
                    calculations={calculations}
                    showFiltersPanel={showFiltersPanel}
                    setShowFiltersPanel={filters.setShowFiltersPanel}
                    tempStartDate={tempStartDate}
                    tempEndDate={tempEndDate}
                    handleDateRangeChange={filters.handleDateRangeChange}
                    handleClearFilter={filters.handleClearFilter}
                    dateError={filters.dateError}
                    isAmazon={isAmazon}
                    nullDateFilter={nullDateFilter}
                    handleNullDateSelect={filters.handleNullDateSelect}
                    availableMonths={filters.availableMonths}
                    availableYears={filters.availableYears}
                    marketplaceFilter={marketplaceFilter}
                    resolvedMarketplaceNames={resolvedMarketplaceNames}
                    filterData={filterData}
                    returnStatusFilter={filters.returnStatusFilter}
                    marketplaceIdToName={filters.marketplaceIdToName}
                    exportProps={{
                        exportType: "payment_calculations",
                        marketplaceId: marketplaceFilter && Array.isArray(marketplaceFilter) && marketplaceFilter.length > 0 ? marketplaceFilter : null,
                        startDate: filterData.startDate,
                        endDate: filterData.endDate,
                        nullOrderDate: nullDateFilter || undefined,
                        shopsyFilter: isFlipkart && shopsyFilter !== 'all' ? shopsyFilter : undefined,
                        meeshoOrderSource: isMeesho && meeshoOrderSourceFilter !== 'all' ? meeshoOrderSourceFilter : undefined,
                        compensationReasons: isMeesho && compensationReasonFilter?.length > 0 ? compensationReasonFilter : undefined,
                        recoveryReasons: isMeesho && recoveryReasonFilter?.length > 0 ? recoveryReasonFilter : undefined,
                        sizes: isMeesho && filters.sizeFilter?.length > 0 ? filters.sizeFilter : undefined,
                        dataTypeFilter: dataTypeFilter !== 'all' ? dataTypeFilter : undefined,
                        warehouses: filters.warehouseFilter?.length > 0 ? filters.warehouseFilter : undefined,
                        brands: filters.brandFilter?.length > 0 ? filters.brandFilter : undefined,
                        adsType: adsMode,
                        gstMode: gstMode,
                        returnStatuses: filters.returnStatusFilter?.length > 0 ? filters.returnStatusFilter : undefined,
                        disabled: false,
                        title: !marketplaceFilter || marketplaceFilter.length === 0 ? 'Export all marketplaces' : `Export calculations (${marketplaceFilter.length} marketplace${marketplaceFilter.length > 1 ? 's' : ''})`
                    }}
                />

                {!loadingFunnel && funnelData && showFiltersPanel && (
                    <CalculationsFunnel
                        isMeesho={isMeesho}
                        isFlipkart={isFlipkart}
                        isAmazon={isAmazon}
                        isMyntra={isMyntra}
                        isMeeshoSizeDisabled={isMeeshoSizeDisabled}
                        funnelData={funnelData}
                        adsMode={adsMode}
                        gstMode={gstMode}
                        returnStatusFilter={filters.returnStatusFilter}
                        setReturnStatusFilter={filters.setReturnStatusFilter}
                        setCurrentPage={setCurrentPage}
                        returnStatusOptions={filters.returnStatusOptions}
                        loading={filters.loadingReturnStatuses}
                        showReturnStatusDropdown={filters.showReturnStatusDropdown}
                        setShowReturnStatusDropdown={filters.setShowReturnStatusDropdown}
                        returnStatusRef={filters.returnStatusRef}
                        handleReturnStatusToggle={filters.handleReturnStatusToggle}
                        tempStartDate={tempStartDate}
                        tempEndDate={tempEndDate}
                        handleDateRangeChange={filters.handleDateRangeChange}
                        handleClearFilter={filters.handleClearFilter}
                        nullDateFilter={nullDateFilter}
                        handleNullDateSelect={filters.handleNullDateSelect}
                        availableMonths={filters.availableMonths}
                        availableYears={filters.availableYears}
                        dateError={filters.dateError}
                        allColumns={allColumns}
                        columnOrder={columnOrder}
                        visibleColumns={visibleColumns}
                        visibleCount={allColumns.filter(col => visibleColumns[col] !== false).length}
                        selectorMode={filters.selectorMode}
                        setSelectorMode={filters.setSelectorMode}
                        showColumnSelector={showColumnSelector}
                        setShowColumnSelector={filters.setShowColumnSelector}
                        columnSelectorRef={filters.columnSelectorRef}
                        onToggleColumn={filters.toggleColumnVisibility}
                        onSelectAllColumns={() => filters.selectAllColumns(allColumns)}
                        onDeselectAllColumns={() => filters.deselectAllColumns(allColumns, "sku")}
                        onReorderColumn={filters.handleColumnReorder}
                        onResetColumnOrder={() => filters.resetColumnOrder(allColumns)}
                        dragOver={filters.dragOver}
                        setDragOver={filters.setDragOver}
                        dragItemRef={filters.dragItemRef}
                        COLUMN_LABELS={COLUMN_LABELS}
                        pinnedCol="sku"
                        showWarehouseForPlatforms={isAmazon || isFlipkart || isMyntra}
                        warehouseFilter={filters.warehouseFilter}
                        skuSearch={debouncedSearchTerm}
                        warehouseOptions={filters.warehouseOptions}
                        warehouseSearch={filters.warehouseSearch}
                        setWarehouseSearch={filters.setWarehouseSearch}
                        handleWarehouseToggle={filters.handleWarehouseToggle}
                        handleClearWarehouses={filters.handleClearWarehouses}
                        showBrandForPlatforms={isMyntra}
                        brandFilter={filters.brandFilter}
                        brandOptions={filters.brandOptions}
                        brandSearch={filters.brandSearch}
                        setBrandSearch={filters.setBrandSearch}
                        handleBrandToggle={filters.handleBrandToggle}
                        handleClearBrands={filters.handleClearBrands}
                        compensationReasonFilter={filters.compensationReasonFilter}
                        compensationReasonOptions={filters.compensationReasonOptions}
                        compensationReasonSearch={filters.compensationReasonSearch}
                        setCompensationReasonSearch={filters.setCompensationReasonSearch}
                        handleCompensationReasonToggle={filters.handleCompensationReasonToggle}
                        handleClearCompensationReasons={filters.handleClearCompensationReasons}
                        recoveryReasonFilter={filters.recoveryReasonFilter}
                        recoveryReasonOptions={filters.recoveryReasonOptions}
                        recoveryReasonSearch={filters.recoveryReasonSearch}
                        setRecoveryReasonSearch={filters.setRecoveryReasonSearch}
                        handleRecoveryReasonToggle={filters.handleRecoveryReasonToggle}
                        handleClearRecoveryReasons={filters.handleClearRecoveryReasons}
                        sizeFilter={filters.sizeFilter}
                        sizeOptions={filters.sizeOptions}
                        sizeSearch={filters.sizeSearch}
                        setSizeSearch={filters.setSizeSearch}
                        handleSizeToggle={filters.handleSizeToggle}
                        handleClearSizes={filters.handleClearSizes}
                        setGstMode={filters.setGstMode}
                        setAdsMode={filters.setAdsMode}
                        dataTypeFilter={dataTypeFilter}
                        setDataTypeFilter={filters.setDataTypeFilter}
                        onDataTypeChange={(val) => {
                            filters.setDataTypeFilter(val);
                            setCurrentPage(1);
                            if (typeof setExpandedRows === 'function') setExpandedRows({});
                            if (typeof setExpandedOrders === 'function') setExpandedOrders({});
                            if (typeof setOrdersBySku === 'function') setOrdersBySku({});
                            if (typeof setNeftsByOrder === 'function') setNeftsByOrder({});
                        }}
                    />
                )}
                {/* GST Mode Toggle */}
                {!loading && (
                    <div className="mb-4 flex items-center gap-4 flex-wrap">
                        {/* P/L View toggle */}
                        {!isMyntra && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">P/L View:</span>
                            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                <button
                                    onClick={() => setGstMode('without_gst')}
                                    className={`px-4 py-1.5 text-xs font-medium transition-colors ${gstMode === 'without_gst'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    Without Tax
                                </button>
                                <button
                                    onClick={() => setGstMode('with_gst')}
                                    className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${gstMode === 'with_gst'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    With Tax
                                </button>
                            </div>
                        </div>
                        )}
                        {/* Ads Type toggle — Amazon & Flipkart only */}
                        {(!isMeesho && !isMyntra) && <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ads:</span>
                            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                <button
                                    onClick={() => setAdsMode('sku_wise')}
                                    className={`px-4 py-1.5 text-xs font-medium transition-colors ${adsMode === 'sku_wise'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    SKU-wise Ads
                                </button>
                                <button
                                    onClick={() => setAdsMode('payment')}
                                    className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${adsMode === 'payment'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    Payment Ads
                                </button>
                            </div>
                        </div>}

                        {/* Shopsy Filter toggle */}
                        {isFlipkart && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Platform:</span>
                                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => setShopsyFilter('all')}
                                        className={`px-4 py-1.5 text-xs font-medium transition-colors ${shopsyFilter === 'all'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setShopsyFilter('flipkart_regular')}
                                        className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${shopsyFilter === 'flipkart_regular'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Flipkart
                                    </button>
                                    <button
                                        onClick={() => setShopsyFilter('shopsy')}
                                        className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${shopsyFilter === 'shopsy'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Shopsy
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Meesho Order Source toggle */}
                        {isMeesho && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Source:</span>
                                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => setMeeshoOrderSourceFilter('all')}
                                        className={`px-4 py-1.5 text-xs font-medium transition-colors ${meeshoOrderSourceFilter === 'all'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setMeeshoOrderSourceFilter('organic')}
                                        className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${meeshoOrderSourceFilter === 'organic'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Organic
                                    </button>
                                    <button
                                        onClick={() => setMeeshoOrderSourceFilter('inorganic')}
                                        className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${meeshoOrderSourceFilter === 'inorganic'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Inorganic
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Data Type toggle */}
                        {isAmazon && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Data Type:</span>
                                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => {
                                            setDataTypeFilter('all');
                                            setCurrentPage(1);
                                            setExpandedRows({});
                                            setExpandedOrders({});
                                            setOrdersBySku({});
                                            setNeftsByOrder({});
                                        }}
                                        className={`px-4 py-1.5 text-xs font-medium transition-colors ${dataTypeFilter === 'all'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDataTypeFilter('order-payment');
                                            setCurrentPage(1);
                                            setExpandedRows({});
                                            setExpandedOrders({});
                                            setOrdersBySku({});
                                            setNeftsByOrder({});
                                        }}
                                        className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${dataTypeFilter === 'order-payment'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Order Payment
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDataTypeFilter('amazon-charges-others');
                                            setCurrentPage(1);
                                            setExpandedRows({});
                                            setExpandedOrders({});
                                            setOrdersBySku({});
                                            setNeftsByOrder({});
                                        }}
                                        className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${dataTypeFilter === 'amazon-charges-others'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Amazon Charges Others
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                        <p className="text-red-600">{error}</p>
                    </div>
                )}

                {/* Thin progress bar - shows at top of table area during loading */}
                {loading && (
                    <div className="w-full h-0.5 bg-slate-200 rounded overflow-hidden mb-2">
                        <div className="h-full progress-bar-shimmer" />
                    </div>
                )}

                {/* Table — always mounted so scroll position is preserved during loading */}
                {!error && calculations.length >= 0 && (
                    <>
                        <div
                            className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden transition-opacity duration-200"
                            style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto' }}
                        >
                            <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                                <table ref={tableRef} className="w-full border-collapse">
                                    <thead className="bg-brand-600 border-b border-brand-700 sticky top-0 z-20 shadow-sm">
                                        <tr>
                                            {columns.map((col, idx) => (
                                                <th
                                                    key={idx}
                                                    style={{ width: columnWidths[col], minWidth: columnWidths[col], maxWidth: columnWidths[col] }}
                                                    className={`px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap relative border-r border-brand-500 last:border-r-0 bg-brand-600 ${idx === 0 ? 'sticky left-0 z-30 border-r-2 border-brand-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between w-full h-full relative group pr-2">
                                                        <div className="flex items-center gap-2 flex-grow min-w-0 pr-4">
                                                            {col !== 'fulfilment_source' && (
                                                                <div className="flex flex-col gap-0.5 shrink-0">
                                                                    <button
                                                                        onClick={() => {
                                                                            if (sortColumn === col && sortOrder === 'desc') {
                                                                                setSortColumn(null);
                                                                                setSortOrder(null);
                                                                            } else {
                                                                                setSortColumn(col);
                                                                                setSortOrder('desc');
                                                                            }
                                                                        }}
                                                                        className={`p-0.5 rounded hover:bg-brand-700 transition-colors ${sortColumn === col && sortOrder === 'desc' ? 'bg-brand-700' : ''}`}
                                                                        title="Sort Descending (highest first)"
                                                                    >
                                                                        <ArrowUp size={12} className={sortColumn === col && sortOrder === 'desc' ? 'text-white' : 'text-brand-300 hover:text-white'} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (sortColumn === col && sortOrder === 'asc') {
                                                                                setSortColumn(null);
                                                                                setSortOrder(null);
                                                                            } else {
                                                                                setSortColumn(col);
                                                                                setSortOrder('asc');
                                                                            }
                                                                        }}
                                                                        className={`p-0.5 rounded hover:bg-brand-700 transition-colors ${sortColumn === col && sortOrder === 'asc' ? 'bg-brand-700' : ''}`}
                                                                        title="Sort Ascending (lowest first)"
                                                                    >
                                                                        <ArrowDown size={12} className={sortColumn === col && sortOrder === 'asc' ? 'text-white' : 'text-brand-300 hover:text-white'} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <span className="shrink-0">{col === 'profit_loss' && isMyntra ? 'Profit / Loss' : (COLUMN_LABELS[col] || col)}</span>

                                                            {idx === 0 && (
                                                                <div className="relative ml-2 flex-grow min-w-[120px] max-w-[200px]">
                                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                                                    <input
                                                                        ref={searchInputRef}
                                                                        type="text"
                                                                        value={searchTerm}
                                                                        onChange={e => setSearchTerm(e.target.value)}
                                                                        placeholder="Search SKU or Order ID..."
                                                                        className="w-full pl-7 pr-6 py-1 text-xs border text-slate-900 border-transparent rounded focus:outline-none focus:ring-1 focus:ring-brand-500 font-normal normal-case bg-white"
                                                                    />
                                                                    {orderSearchLoading && (
                                                                        <Loader2 size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-brand-500" />
                                                                    )}
                                                                    {searchTerm && !orderSearchLoading && (
                                                                        <button onClick={handleSearchClear} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                                            <X size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div
                                                            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-brand-500 active:bg-brand-400 transition-colors z-20"
                                                            onMouseDown={(e) => handleResizeStart(col, e)}
                                                            style={{ marginRight: '-4px' }}
                                                        />
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>

                                        {/* Level 0 - Total Row */}
                                        {totalRow && (() => {
                                            const adjTotalRow = applyGstAdjustment(totalRow, { gstMode, isAmazon, isMeesho, grandProfits: memoizedGrandProfits });
                                            return (
                                                <tr className="bg-slate-200">
                                                    {columns.map((col, colIdx) => (
                                                        <th
                                                            key={colIdx}
                                                            scope="col"
                                                            style={{ width: columnWidths[col], minWidth: columnWidths[col], maxWidth: columnWidths[col] }}
                                                            className={`px-4 py-4 text-left text-sm font-bold border-r border-slate-300 last:border-r-0 overflow-hidden text-ellipsis text-slate-800 bg-slate-200 ${colIdx === 0 ? 'sticky left-0 z-30 border-r-2 border-slate-400' : ''
                                                                }`}
                                                        >
                                                            {colIdx === 0 ? (
                                                                <span>TOTAL</span>
                                                            ) : (
                                                                col === 'sales_contribution' || col === 'profit_contribution'
                                                                    ? '100.00%'
                                                                    : formatCellValue(col, adjTotalRow[col])
                                                            )}
                                                        </th>
                                                    ))}
                                                </tr>
                                            );
                                        })()}
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            // Backend now handles search/filtering across all pages
                                            const displayRows = calculations;

                                            if (displayRows.length === 0 && debouncedSearchTerm.trim()) {
                                                return (
                                                    <tr>
                                                        <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">
                                                            No results found for <strong>"{debouncedSearchTerm.trim()}"</strong>
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return displayRows.map((rawRow, rowIdx) => {
                                                const row = applyGstAdjustment(enrichRowWithContributions(rawRow, totalRow), { gstMode, isAmazon, isMeesho, grandProfits: memoizedGrandProfits });
                                                const sku = row.sku;
                                                const isExpanded = expandedRows[rowIdx];
                                                const cacheKey = `${sku}-${row.size || 'NA'}`;
                                                const skuOrdersState = ordersBysku[cacheKey] || { pages: [], hasMore: false };
                                                const orders = skuOrdersState.pages ? skuOrdersState.pages.flatMap(p => p.data) : (Array.isArray(skuOrdersState) ? skuOrdersState : []);
                                                const hasPrevious = skuOrdersState.pages?.length > 0 && skuOrdersState.pages[0].page > 1;
                                                const hasMore = skuOrdersState.hasMore;
                                                const isLoadingOrders = loadingOrders[cacheKey];

                                                return (
                                                    <React.Fragment key={rowIdx}>
                                                        {/* Main SKU Row */}
                                                        <tr className="hover:bg-slate-50 transition-colors">
                                                            {columns.map((col, colIdx) => {
                                                                const extraClasses = getCellStyleClasses(col, row[col]);
                                                                return (
                                                                    <td
                                                                        key={colIdx}
                                                                        style={{ width: columnWidths[col], minWidth: columnWidths[col], maxWidth: columnWidths[col] }}
                                                                        className={`px-4 py-3 text-sm border-r border-slate-100 last:border-r-0 overflow-hidden text-ellipsis ${colIdx === 0 ? 'cursor-pointer text-white hover:text-brand-100 font-medium sticky left-0 z-10 bg-brand-600 border-r-2 border-brand-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : (extraClasses ? extraClasses : 'text-slate-700')
                                                                            }`}
                                                                        onClick={() => colIdx === 0 && handleSkuClick(sku, row.size, rowIdx)}
                                                                    >
                                                                        {colIdx === 0 ? (
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <span className="flex-shrink-0">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                                                                                <span className="truncate whitespace-pre">{row[col] !== null && row[col] !== undefined ? row[col] : '—'}</span>
                                                                            </div>
                                                                        ) : (
                                                                            formatCellValue(col, row[col])
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>

                                                        {/* Drill-down Order Rows */}
                                                        {isExpanded && (
                                                            <>
                                                                {isLoadingOrders && orders.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={columns.length} className="px-4 py-6 text-center bg-slate-50">
                                                                            <Loader2 className="animate-spin text-brand-600 mx-auto" size={24} />
                                                                        </td>
                                                                    </tr>
                                                                ) : orders.length > 0 ? (
                                                                    <>
                                                                        {hasPrevious && (
                                                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                                                <td colSpan={columns.length} className="px-4 py-2 text-left">
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); handleLoadPreviousOrders(sku, row.size); }}
                                                                                        disabled={isLoadingOrders}
                                                                                        className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 flex items-center gap-2 pl-8"
                                                                                    >
                                                                                        {isLoadingOrders && <Loader2 className="animate-spin" size={14} />}
                                                                                        ↑ Load Previous 50
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                        {orders.map((rawOrderRow, orderIdx) => {
                                                                            const orderRow = applyGstAdjustment(enrichRowWithContributions(rawOrderRow, totalRow), { gstMode, isAmazon, isMeesho, grandProfits: memoizedGrandProfits });
                                                                            const orderId = orderRow.sku;
                                                                            const orderKey = `${sku}_${orderId}`;
                                                                            const isOrderExpanded = expandedOrders[orderKey];
                                                                            const nefts = neftsByOrder[`${sku}_${orderId}`] || [];
                                                                            const isLoadingNefts = loadingNefts[`${sku}_${orderId}`];
                                                                            // Highlight order rows that match the searched term
                                                                            const searchClean = searchTerm.trim().toLowerCase().replace(/\s+/g, '');
                                                                            const orderIdClean = orderId ? orderId.toLowerCase().replace(/\s+/g, '') : '';
                                                                            const isOrderMatch = searchClean && orderIdClean.includes(searchClean);

                                                                            return (
                                                                                <React.Fragment key={`${rowIdx}-${orderIdx}`}>
                                                                                    {/* Order Row */}
                                                                                    <tr
                                                                                        data-order-match={isOrderMatch ? "true" : "false"}
                                                                                        className={`transition-colors ${isOrderMatch ? 'bg-orange-100 hover:bg-orange-200' : 'bg-brand-50 hover:bg-brand-100'}`}
                                                                                    >
                                                                                        {columns.map((col, colIdx) => {
                                                                                            const extraClasses = getCellStyleClasses(col, orderRow[col]);
                                                                                            return (
                                                                                                <td
                                                                                                    key={colIdx}
                                                                                                    style={{ width: columnWidths[col], minWidth: columnWidths[col], maxWidth: columnWidths[col] }}
                                                                                                    className={`px-4 py-2 text-sm border-r last:border-r-0 overflow-hidden text-ellipsis ${isOrderMatch ? 'border-orange-200' : 'border-brand-200'} ${colIdx === 0 ? `pl-12 cursor-pointer ${isOrderMatch ? 'text-orange-900 bg-orange-200 border-orange-300 hover:bg-orange-300' : 'text-brand-900 bg-brand-100 border-brand-300 hover:bg-brand-200'} font-medium sticky left-0 z-10 border-r-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` : (extraClasses ? extraClasses : 'text-slate-600')
                                                                                                        }`}
                                                                                                    onClick={() => colIdx === 0 && handleOrderClick(sku, orderId, orderKey)}
                                                                                                >
                                                                                                    {colIdx === 0 ? (
                                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                                            <span className="flex-shrink-0">{isOrderExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                                                                                                            <span className="truncate">{orderRow[col] !== null && orderRow[col] !== undefined ? orderRow[col] : '—'}</span>
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        formatCellValue(col, orderRow[col])
                                                                                                    )}
                                                                                                </td>
                                                                                            );
                                                                                        })}
                                                                                    </tr>

                                                                                    {/* NEFT Rows */}
                                                                                    {isOrderExpanded && (
                                                                                        <>
                                                                                            {isLoadingNefts ? (
                                                                                                <tr>
                                                                                                    <td colSpan={columns.length} className="px-4 py-4 text-center bg-slate-50">
                                                                                                        <Loader2 className="animate-spin text-brand-600 mx-auto" size={20} />
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ) : nefts.length > 0 ? (
                                                                                                nefts.map((neftRow, neftIdx) => (
                                                                                                    <tr key={`${rowIdx}-${orderIdx}-${neftIdx}`} className="bg-slate-50 hover:bg-slate-100 transition-colors">
                                                                                                        {columns.map((col, colIdx) => (
                                                                                                            <td
                                                                                                                key={colIdx}
                                                                                                                style={{ width: columnWidths[col], minWidth: columnWidths[col], maxWidth: columnWidths[col] }}
                                                                                                                className={`px-4 py-1.5 text-xs text-slate-600 border-r border-slate-200 last:border-r-0 overflow-hidden text-ellipsis ${colIdx === 0 ? 'pl-20 sticky left-0 z-10 bg-slate-100 text-slate-800 font-medium border-r-2 border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''
                                                                                                                    }`}
                                                                                                            >
                                                                                                                {formatCellValue(col, neftRow[col])}
                                                                                                            </td>
                                                                                                        ))}
                                                                                                    </tr>
                                                                                                ))
                                                                                            ) : (
                                                                                                <tr>
                                                                                                    <td colSpan={columns.length} className="px-4 py-3 text-center text-sm text-slate-500 bg-slate-50">
                                                                                                        No payment transactions found for this order
                                                                                                    </td>
                                                                                                </tr>
                                                                                            )}
                                                                                        </>
                                                                                    )}
                                                                                </React.Fragment>
                                                                            );
                                                                        })}
                                                                        {hasMore && (
                                                                            <tr className="bg-slate-50 border-t border-slate-100">
                                                                                <td colSpan={columns.length} className="px-4 py-2 text-left">
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); handleLoadMoreOrders(sku, row.size); }}
                                                                                        disabled={isLoadingOrders}
                                                                                        className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 flex items-center gap-2 pl-8"
                                                                                    >
                                                                                        {isLoadingOrders && <Loader2 className="animate-spin" size={14} />}
                                                                                        ↓ Load Next 50
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <tr>
                                                                        <td colSpan={columns.length} className="px-4 py-4 text-center text-sm text-slate-500 bg-slate-50">
                                                                            No orders found for this SKU
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            });
                                        })()}
                                        {calculations.length === 0 && (
                                            <tr>
                                                <td colSpan={columns.length} className="px-4 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <FileSpreadsheet className="text-slate-300" size={48} />
                                                        <p className="text-slate-500">No calculation data available</p>
                                                        <p className="text-sm text-slate-400">Upload payment reports to see calculations</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {calculations.length > 0 && (
                                <div className="mt-4 flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 rounded-b-lg">
                                    <div className="text-sm text-slate-600">
                                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} results
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <span className="px-4 py-1.5 text-sm text-slate-700">
                                            Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                                            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                                            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
                                            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                                            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Last
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                <CalculationModal 
                    isOpen={isCalculatorOpen} 
                    onClose={() => setIsCalculatorOpen(false)} 
                />
            </div>
        </div>
    );
};

export default PaymentsCalculations;








