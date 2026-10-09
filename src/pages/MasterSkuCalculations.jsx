/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../api";
import {
  ArrowLeft,
  Loader2,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronDown,
  X,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

import useCalculationsFilters from "../hooks/useCalculationsFilters";
import CalculationsHeader from "../components/calculations/CalculationsHeader";
import CalculationsFunnel from "../components/calculations/CalculationsFunnel";
import CalculationsColumnSelector from "../components/calculations/CalculationsColumnSelector";
import CalculationModal from "../components/calculations/Calculation";
import CalculationsSearchModal from "../components/calculations/CalculationsSearchModal";
import AddColumnSidebar from "../components/calculations/AddColumnSidebar";
import ConfirmModal from "../components/ConfirmModal";
import {
  COLUMN_LABELS,
  formatCellValue,
  applyGstAdjustment,
  computeGrandProfits,
  enrichRowWithContributions,
  getCellStyleClasses,
  isColVisible,
} from "../components/calculations/calculationsUtils";

const GST_DIVISOR = 1.18;

const MasterSkuCalculations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [calculations, setCalculations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalRow, setTotalRow] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [funnelData, setFunnelData] = useState(null);
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  // Applied search terms — set only when the user presses "Search & Apply"
  // in the modal, which is what makes the table refetch.
  const [appliedSearchItems, setAppliedSearchItems] = useState([]);
  const [appliedSearchType, setAppliedSearchType] = useState('sku');
  const hasAppliedSearch = appliedSearchItems.length > 0;

  /**
   * Attach the applied search to a request under the param its type maps to.
   * Each type targets its own column server-side, so an Order ID search can
   * never match a SKU that happens to share the same characters.
   */
  const applySearchParams = (params) => {
    if (!appliedSearchItems || appliedSearchItems.length === 0) return params;
    const value = JSON.stringify(appliedSearchItems);
    if (appliedSearchType === "order_id") params.searchOrderId = value;
    else if (appliedSearchType === "order_item_id") params.searchOrderItemId = value;
    else if (appliedSearchType === "master_sku") params.masterSkuSearch = value;
    else params.skuSearch = value;
    return params;
  };
  const viewDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target)) {
        setIsViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Drill-down caches for Master-SKU -> SKU -> Order hierarchy
  const [expandedMasterSkus, setExpandedMasterSkus] = useState({});
  const [expandedMasterSkuSkus, setExpandedMasterSkuSkus] = useState({});
  const [masterSkuChildSkus, setMasterSkuChildSkus] = useState({});
  const [masterSkuSkuOrders, setMasterSkuSkuOrders] = useState({});
  const [loadingMasterSkuSkus, setLoadingMasterSkuSkus] = useState({});
  const [loadingMasterSkuOrders, setLoadingMasterSkuOrders] = useState({});

  // Use the shared date range filter hook
  const filters = useCalculationsFilters({
    storageKey: "masterSkuCalculations",
    locationState: location.state,
    onReset: () => {
      setExpandedMasterSkus({});
      setExpandedMasterSkuSkus({});
      setMasterSkuChildSkus({});
      setMasterSkuSkuOrders({});
    },
  });
  const {
    marketplaceFilter,
    filterData,
    tempStartDate,
    tempEndDate,
    nullDateFilter,
    returnStatusFilter,
    warehouseFilter,
    dataTypeFilter,
    setDataTypeFilter,
    adsMode,
    setAdsMode,
    gstMode,
    setGstMode,
    shopsyFilter,
    setShopsyFilter,
    meeshoOrderSourceFilter,
    setMeeshoOrderSourceFilter,
    compensationReasonFilter,
    recoveryReasonFilter,
    searchType,
    setSearchType,
    currentPage,
    pageSize,
    setCurrentPage,
    sortColumn,
    setSortColumn,
    sortOrder,
    setSortOrder,
    isMobile,
    isMeesho,
    isFlipkart,
    isAmazon,
    isMyntra,
    isPlatformLoaded,
    platformType,
    resolvedMarketplaceNames,
    isMeeshoSizeDisabled,
    visibleColumns,
    columnOrder,
    setColumnOrder,
    columnWidths,
    showColumnSelector,
    showFiltersPanel,
    tableRef,
    scrollContainerRef,
    savedScrollPos,
    handleResizeStart,
    setDateError,
    handleTableKeyDown,
    dragOver,
    setDragOver,
    dragItemRef,
    handleColumnReorder,
    resetColumnOrder,
  } = filters;

  const [profitabilityFilter, setProfitabilityFilter] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedHeaderColumns, setSelectedHeaderColumns] = useState([]);
  const [lastClickedColIdx, setLastClickedColIdx] = useState(null);

  const memoizedGrandProfits = useMemo(() => {
    return computeGrandProfits(totalRow, { isAmazon, isMeesho });
  }, [totalRow, isAmazon, isMeesho]);


  const fetchCalculations = useCallback(async () => {
    // Save current scroll position before loading
    if (scrollContainerRef.current) {
      savedScrollPos.current = {
        top: scrollContainerRef.current.scrollTop,
        left: scrollContainerRef.current.scrollLeft,
      };
    }
    // Clear drill-down caches so expanded order rows always match the current filters
    setExpandedMasterSkus({});
    setExpandedMasterSkuSkus({});
    setMasterSkuChildSkus({});
    setMasterSkuSkuOrders({});
    setLoading(true);
    setError("");
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
      };
      if (marketplaceFilter) {
        params.marketplaceIds = JSON.stringify(
          Array.isArray(marketplaceFilter)
            ? marketplaceFilter
            : [marketplaceFilter],
        );
      }
      if (filterData.startDate) params.startDate = filterData.startDate;
      if (filterData.endDate) params.endDate = filterData.endDate;
      if (nullDateFilter) params.nullOrderDate = "true";
      if (sortColumn) params.sortBy = sortColumn;
      if (sortOrder) params.sortOrder = sortOrder;
      applySearchParams(params);
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
      if (dataTypeFilter && dataTypeFilter !== "all") {
        params.dataTypeFilter = dataTypeFilter;
      }
      if (profitabilityFilter) {
        params.profitabilityFilter = profitabilityFilter;
      }
      params.adsType = adsMode;
      console.log("Fetching master-sku calculations with params:", params);
      const { data } = await api.get("/payments/calculations/master-sku", {
        params,
      });
      console.log("API Response:", data);
      console.log("Calculations data:", data.data);
      console.log("Total row:", data.total);
      console.log("Settlements:", data.settlements);
      console.log("Total count:", data.totalCount);
      const fetchedData = data.data || [];
      setCalculations(fetchedData);
      setTotalRow(data.total || null);
      setSettlements(data.settlements || []);
      setTotalCount(data.totalCount || 0);
      setDateError(""); // Clear any previous date errors on success
    } catch (error) {
      console.error("Error fetching payment calculations", error);
      const errorMsg =
        error.response?.data?.message || "Failed to load payment calculations";
      if (errorMsg.includes("Date range") || errorMsg.includes("date")) {
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
            scrollContainerRef.current.scrollTop =
              savedScrollPos.current.top || 0;
            scrollContainerRef.current.scrollLeft =
              savedScrollPos.current.left || 0;
          }
        });
      }
    }
  }, [
    filterData.startDate,
    filterData.endDate,
    nullDateFilter,
    sortColumn,
    sortOrder,
    currentPage,
    pageSize,
    marketplaceFilter,
    returnStatusFilter,
    warehouseFilter,
    dataTypeFilter,
    appliedSearchItems,
    searchType,
    adsMode,
    shopsyFilter,
    meeshoOrderSourceFilter,
    compensationReasonFilter,
    recoveryReasonFilter,
    filters.sizeFilter,
    isFlipkart,
    isMeesho,
    filters.brandFilter,
    profitabilityFilter,
  ]);

  const fetchFunnelData = useCallback(async () => {
    setLoadingFunnel(true);
    try {
      const params = {};
      if (marketplaceFilter) {
        params.marketplaceIds = JSON.stringify(
          Array.isArray(marketplaceFilter)
            ? marketplaceFilter
            : [marketplaceFilter],
        );
      }
      if (filterData.startDate) params.startDate = filterData.startDate;
      if (filterData.endDate) params.endDate = filterData.endDate;
      if (nullDateFilter) params.nullOrderDate = "true";
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
      if (dataTypeFilter && dataTypeFilter !== "all")
        params.dataTypeFilter = dataTypeFilter;
      if (profitabilityFilter)
        params.profitabilityFilter = profitabilityFilter;
      params.adsType = adsMode;
      applySearchParams(params);
      const { data } = await api.get("/payments/calculations/funnel", {
        params,
      });
      setFunnelData(data.data || data || null);
    } catch (error) {
      console.error("Error fetching funnel data", error);
    } finally {
      setLoadingFunnel(false);
    }
  }, [
    filterData.startDate,
    filterData.endDate,
    nullDateFilter,
    marketplaceFilter,
    returnStatusFilter,
    warehouseFilter,
    dataTypeFilter,
    adsMode,
    shopsyFilter,
    meeshoOrderSourceFilter,
    compensationReasonFilter,
    recoveryReasonFilter,
    filters.sizeFilter,
    isFlipkart,
    isMeesho,
    appliedSearchItems,
    profitabilityFilter,
    searchType,
    filters.brandFilter,
  ]);

  // When debounced search term changes, reset page to 1

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearchItems]);

  // Fetch calculations when filters or pagination change
  useEffect(() => {
    fetchCalculations();
    fetchFunnelData();
  }, [fetchCalculations, fetchFunnelData]);

  useEffect(() => {
    if (!hasAppliedSearch || calculations.length !== 1) return;
    const masterSku = calculations[0].sku;
    if (expandedMasterSkus[0]) return; // safety guard should already be collapsed
    handleMasterSkuClick(masterSku, 0).then((childSkusData) => {
      if (childSkusData && childSkusData.length === 1) {
        const childSku = childSkusData[0].sku;
        const childSize = childSkusData[0].size;
        const skuKey = `${masterSku}__${childSku}${childSize ? `__${childSize}` : ''}`;
        handleMasterSkuSkuClick(masterSku, childSku, skuKey, childSize);
      }
    });
     
  }, [calculations]);

  // When return status filter changes, clear all expanded/cached drill-down data
  // so the next expansion fetches fresh, filtered data
  useEffect(() => {
    setExpandedMasterSkus({});
    setExpandedMasterSkuSkus({});
    setMasterSkuChildSkus({});
    setMasterSkuSkuOrders({});
  }, [returnStatusFilter]);


  // removed auto-fetch orders and auto-scroll routines as per user request

  const getOrderApiParams = (extraParams = {}, currentSku = null) => {
    const params = { ...extraParams };
    if (nullDateFilter) {
      params.nullOrderDate = "true";
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
    if (dataTypeFilter && dataTypeFilter !== "all") {
      params.dataTypeFilter = dataTypeFilter;
    }
    if (marketplaceFilter) {
      params.marketplaceIds = JSON.stringify(
        Array.isArray(marketplaceFilter)
          ? marketplaceFilter
          : [marketplaceFilter],
      );
    }
    if (sortColumn) params.sortBy = sortColumn;
    if (sortOrder) params.sortOrder = sortOrder;
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
    // Only an Order ID or Order Item ID search narrows the order list at this level — a SKU or
    // Master SKU selection is already expressed by the row being drilled into.
    if (appliedSearchItems && appliedSearchItems.length > 0) {
      if (searchType === 'order_id') params.searchOrderId = JSON.stringify(appliedSearchItems);
      else if (searchType === 'order_item_id') params.searchOrderItemId = JSON.stringify(appliedSearchItems);
    }
    return params;
  };

  /** Level 1 & Level 2: expand/collapse a master-SKU to show its child SKUs */
  const handleMasterSkuClick = async (masterSku, rowIdx) => {
    const isExpanded = expandedMasterSkus[rowIdx];
    if (isExpanded) {
      setExpandedMasterSkus((prev) => ({ ...prev, [rowIdx]: false }));
    } else {
      setExpandedMasterSkus((prev) => ({ ...prev, [rowIdx]: true }));
      if (!masterSkuChildSkus[masterSku]) {
        setLoadingMasterSkuSkus((prev) => ({ ...prev, [masterSku]: true }));
        try {
          const params = getOrderApiParams({ page: 1, limit: 100 }, masterSku);
          applySearchParams(params);
          const encodedMasterSku = encodeURIComponent(masterSku) || '__empty__';
          const { data } = await api.get(
            `/payments/calculations/master-sku/${encodedMasterSku}/skus`,
            { params },
          );
          setMasterSkuChildSkus((prev) => ({ ...prev, [masterSku]: data }));
          return data;
        } catch (err) {
          console.error("Error fetching SKUs for master-SKU:", masterSku, err);
          return null;
        } finally {
          setLoadingMasterSkuSkus((prev) => ({ ...prev, [masterSku]: false }));
        }
      } else {
        return masterSkuChildSkus[masterSku];
      }
    }
    return null;
  };

  /** Level 2 & Level 3: expand/collapse a child SKU to show its orders */
  const handleMasterSkuSkuClick = async (masterSku, sku, skuKey, size) => {
    const isExpanded = expandedMasterSkuSkus[skuKey];
    if (isExpanded) {
      setExpandedMasterSkuSkus((prev) => ({ ...prev, [skuKey]: false }));
    } else {
      setExpandedMasterSkuSkus((prev) => ({ ...prev, [skuKey]: true }));
      if (!masterSkuSkuOrders[skuKey]) {
        setLoadingMasterSkuOrders((prev) => ({ ...prev, [skuKey]: true }));
        try {
          const params = getOrderApiParams({ page: 1, limit: 50 }, sku);
          if (size && !(isMeesho && isMeeshoSizeDisabled)) {
            params.size = size;
          }
          const encodedMasterSku = encodeURIComponent(masterSku) || '__empty__';
          const encodedSku = encodeURIComponent(sku) || '__empty__';
          const { data } = await api.get(
            `/payments/calculations/master-sku/${encodedMasterSku}/skus/${encodedSku}/orders`,
            { params },
          );
          setMasterSkuSkuOrders((prev) => ({
            ...prev,
            [skuKey]: { pages: [{ page: 1, data }], hasMore: data.length === 50 }
          }));
          return data;
        } catch (err) {
          console.error(
            "Error fetching orders for master-SKU/SKU:",
            masterSku,
            sku,
            err,
          );
          return null;
        } finally {
          setLoadingMasterSkuOrders((prev) => ({ ...prev, [skuKey]: false }));
        }
      } else {
        return masterSkuSkuOrders[skuKey]?.pages?.[0]?.data || null;
      }
    }
    return null;
  };

  const handleLoadMoreMasterSkuOrders = async (masterSku, sku, skuKey) => {
    const currentData = masterSkuSkuOrders[skuKey];
    if (!currentData || !currentData.hasMore) return;
    const lastPage = currentData.pages[currentData.pages.length - 1].page;
    const nextPage = lastPage + 1;
    setLoadingMasterSkuOrders((prev) => ({ ...prev, [skuKey]: true }));
    try {
      const params = getOrderApiParams({ page: nextPage, limit: 50 }, sku);
      const encodedMasterSku = encodeURIComponent(masterSku) || '__empty__';
      const encodedSku = encodeURIComponent(sku) || '__empty__';
      const { data } = await api.get(
        `/payments/calculations/master-sku/${encodedMasterSku}/skus/${encodedSku}/orders`,
        { params },
      );
      setMasterSkuSkuOrders((prev) => {
        const prevData = prev[skuKey];
        let newPages = [...prevData.pages, { page: nextPage, data }];
        if (newPages.length > 2) {
          newPages = newPages.slice(newPages.length - 2);
        }
        return { ...prev, [skuKey]: { pages: newPages, hasMore: data.length === 50 } };
      });
    } catch (err) {
      console.error("Error fetching more orders for master-SKU/SKU:", masterSku, sku, err);
    } finally {
      setLoadingMasterSkuOrders((prev) => ({ ...prev, [skuKey]: false }));
    }
  };

  const handleLoadPreviousMasterSkuOrders = async (masterSku, sku, skuKey) => {
    const currentData = masterSkuSkuOrders[skuKey];
    if (!currentData || currentData.pages.length === 0) return;
    const firstPage = currentData.pages[0].page;
    if (firstPage <= 1) return;
    const prevPage = firstPage - 1;

    setLoadingMasterSkuOrders((prev) => ({ ...prev, [skuKey]: true }));
    try {
      const params = getOrderApiParams({ page: prevPage, limit: 50 }, sku);
      const encodedMasterSku = encodeURIComponent(masterSku) || '__empty__';
      const encodedSku = encodeURIComponent(sku) || '__empty__';
      const { data } = await api.get(
        `/payments/calculations/master-sku/${encodedMasterSku}/skus/${encodedSku}/orders`,
        { params },
      );
      setMasterSkuSkuOrders((prev) => {
        const prevData = prev[skuKey];
        let newPages = [{ page: prevPage, data }, ...prevData.pages];
        if (newPages.length > 2) {
          newPages = newPages.slice(0, 2);
        }
        return { ...prev, [skuKey]: { pages: newPages, hasMore: true } };
      });
    } catch (err) {
      console.error("Error fetching previous orders for master-SKU/SKU:", masterSku, sku, err);
    } finally {
      setLoadingMasterSkuOrders((prev) => ({ ...prev, [skuKey]: false }));
    }
  };

  const allColumns = (isAmazon ? [
    // Amazon column order
    'master_sku',
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
    'master_sku',
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
    'master_sku',
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
  const allColumnsKey = allColumns.join(",");
  useEffect(() => {
    if (!isPlatformLoaded) return;
    // Prefer the shared order (synced from either page), fall back to page-specific key
    const sharedRaw = localStorage.getItem(`sharedCalculationsColumnOrder_v4_${platformType}`);
    const pageRaw = localStorage.getItem(`masterSkuCalculationsColumnOrder_v4_${platformType}`);
    const raw = sharedRaw || pageRaw;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Strip pin col from saved order, then force it to position 0
        const withoutPin = parsed.filter((col) => allColumns.includes(col) && col !== 'master_sku');
        const newCols = allColumns.filter((col) => col !== 'master_sku' && !withoutPin.includes(col));

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

        setColumnOrder(['master_sku', ...finalOrder]);
      } catch {
        setColumnOrder(allColumns);
      }
    } else {
      setColumnOrder(allColumns);
    }
     
  }, [allColumnsKey, isAmazon, isMeesho, isFlipkart, isMyntra, platformType, isPlatformLoaded]);

  // Filter columns based on visibility, preserving drag order
  const columns = (columnOrder.length > 0 ? columnOrder : allColumns).filter(
    (col) => allColumns.includes(col) && visibleColumns[col] !== false,
  );
  console.log("Calculations array:", calculations);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* <div className="p-4 lg:p-8 w-full max-w-[100vw] overflow-x-hidden"> */}
      <div className="pb-1 px-4 lg:px-8 w-full">
        {/* Header */}
        <CalculationsHeader
          currentView="master-sku-wise"
          onOpenCalculator={() => setIsCalculatorOpen(true)}
          onViewSwitch={(val) => {
            if (val === "sku-wise") {
              navigate("/payments/calculations", {
                state: {
                  filters: {
                    marketplaceIds: marketplaceFilter,
                    startDate: filterData?.startDate,
                    endDate: filterData?.endDate,
                    nullOrderDate: nullDateFilter,
                    returnStatuses: returnStatusFilter,
                    warehouses: warehouseFilter,
                    dataTypeFilter: dataTypeFilter,
                    shopsyFilter: isFlipkart && shopsyFilter !== 'all' ? shopsyFilter : undefined,
                    meeshoOrderSourceFilter: isMeesho && meeshoOrderSourceFilter !== 'all' ? meeshoOrderSourceFilter : undefined,
                    compensationReasons: isMeesho ? compensationReasonFilter : [],
                    recoveryReasons: isMeesho ? recoveryReasonFilter : [],
                    sizes: isMeesho ? filters.sizeFilter : [],
                    adsType: adsMode,
                    gstMode: gstMode
                  }
                }
              });
            }
          }}
          onBackToDashboard={() => navigate("/dashboard")}
          onGoToSettlements={() =>
            navigate("/payments/settlements", {
              state: {
                marketplaceIds: marketplaceFilter,
                startDate: filterData.startDate,
                endDate: filterData.endDate,
                marketplaceIdToName: filters.marketplaceIdToName,
              },
            })
          }
          loading={loading}
          error={error}
          settlements={settlements}
          calculations={calculations}
          showFiltersPanel={showFiltersPanel}
          setShowFiltersPanel={filters.setShowFiltersPanel}
          setShowColumnSelector={filters.setShowColumnSelector}
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
          availableMarketplaces={filters.availableMarketplaces}
          onApplyMarketplaceFilters={(selectedIds) => {
            filters.setMarketplaceFilter(selectedIds);
            filters.setCurrentPage(1);
          }}
          exportProps={{
            exportType: "master_sku_calculations",
            marketplaceId:
              marketplaceFilter &&
                Array.isArray(marketplaceFilter) &&
                marketplaceFilter.length > 0
                ? marketplaceFilter
                : null,
            startDate: filterData.startDate,
            endDate: filterData.endDate,
            nullOrderDate: nullDateFilter || undefined,
            dataTypeFilter: dataTypeFilter !== "all" ? dataTypeFilter : undefined,
            shopsyFilter: isFlipkart && shopsyFilter !== 'all' ? shopsyFilter : undefined,
            meeshoOrderSource: isMeesho && meeshoOrderSourceFilter !== 'all' ? meeshoOrderSourceFilter : undefined,
            compensationReasons: isMeesho && compensationReasonFilter?.length > 0 ? compensationReasonFilter : undefined,
            recoveryReasons: isMeesho && recoveryReasonFilter?.length > 0 ? recoveryReasonFilter : undefined,
            sizes: isMeesho && filters.sizeFilter?.length > 0 ? filters.sizeFilter : undefined,
            warehouses: filters.warehouseFilter?.length > 0 ? filters.warehouseFilter : undefined,
            brands: filters.brandFilter?.length > 0 ? filters.brandFilter : undefined,
            adsType: adsMode,
            gstMode: gstMode,
            returnStatuses:
              filters.returnStatusFilter?.length > 0
                ? filters.returnStatusFilter
                : undefined,
            disabled: !marketplaceFilter || marketplaceFilter.length !== 1,
            title: !marketplaceFilter || marketplaceFilter.length !== 1 ? 'Export is only allowed for a single marketplace' : 'Export calculations',
          }}
        >
          <AddColumnSidebar
            allColumns={allColumns}
            columnOrder={columnOrder}
            visibleColumns={visibleColumns}
            visibleCount={allColumns.filter((col) => visibleColumns[col] !== false).length}
            show={filters.showAddColumnSidebar}
            setShow={filters.setShowAddColumnSidebar}
            onToggle={filters.toggleColumnVisibility}
            onSelectAll={() => filters.selectAllColumns(allColumns)}
            onDeselectAll={() => filters.deselectAllColumns(allColumns, ["master_sku"])}
            onReorder={filters.handleColumnReorder}
            onResetColumnOrder={() => filters.resetColumnOrder(allColumns)}
            dragOver={filters.dragOver}
            setDragOver={filters.setDragOver}
            dragItemRef={filters.dragItemRef}
            COLUMN_LABELS={COLUMN_LABELS}
            pinnedCols={["master_sku"]}
            isMyntra={isMyntra}
          />
        </CalculationsHeader>

        {funnelData && showFiltersPanel && (
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
            profitabilityFilter={profitabilityFilter}
            setProfitabilityFilter={setProfitabilityFilter}
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
            visibleCount={columns.length}
            selectorMode={filters.selectorMode}
            setSelectorMode={filters.setSelectorMode}
            showColumnSelector={showColumnSelector}
            setShowColumnSelector={filters.setShowColumnSelector}
            columnSelectorRef={filters.columnSelectorRef}
            onToggleColumn={filters.toggleColumnVisibility}
            onSelectAllColumns={() => filters.selectAllColumns(allColumns)}
            onDeselectAllColumns={() => filters.deselectAllColumns(allColumns, ["master_sku"])}
            onReorderColumn={(dragged, target) => filters.handleColumnReorder(dragged, target, ['master_sku'])}
            onResetColumnOrder={() => filters.resetColumnOrder(allColumns)}
            dragOver={filters.dragOver}
            setDragOver={filters.setDragOver}
            dragItemRef={filters.dragItemRef}
            COLUMN_LABELS={COLUMN_LABELS}
            pinnedCols={["master_sku"]}
            showWarehouseForPlatforms={isAmazon || isFlipkart || isMyntra}
            warehouseFilter={filters.warehouseFilter}
            skuSearch={hasAppliedSearch ? JSON.stringify(appliedSearchItems) : ""}
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
            setSortColumn={filters.setSortColumn}
            setSortOrder={filters.setSortOrder}
            onDataTypeChange={(val) => {
              filters.setDataTypeFilter(val);
              setCurrentPage(1);
              setExpandedMasterSkus({});
              setExpandedMasterSkuSkus({});
              setMasterSkuChildSkus({});
              setMasterSkuSkuOrders({});
            }}
          />
        )}

        {/* Column Selector Modal Overlay */}
        <CalculationsColumnSelector
          allColumns={allColumns}
          columnOrder={columnOrder}
          visibleColumns={visibleColumns}
          visibleCount={allColumns.filter((col) => visibleColumns[col] !== false).length}
          selectorMode={filters.selectorMode}
          setSelectorMode={filters.setSelectorMode}
          show={showColumnSelector}
          setShow={filters.setShowColumnSelector}
          containerRef={filters.columnSelectorRef}
          onToggle={filters.toggleColumnVisibility}
          onSelectAll={() => filters.selectAllColumns(allColumns)}
          onDeselectAll={() => filters.deselectAllColumns(allColumns, ["master_sku"])}
          onReorder={filters.handleColumnReorder}
          onResetColumnOrder={() => filters.resetColumnOrder(allColumns)}
          dragOver={filters.dragOver}
          setDragOver={filters.setDragOver}
          dragItemRef={filters.dragItemRef}
          COLUMN_LABELS={COLUMN_LABELS}
          pinnedCols={["master_sku"]}
          isMyntra={isMyntra}
        />

        {/* Search Modal */}
        <CalculationsSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          searchType={searchType}
          setSearchType={setSearchType}
          onApply={(items) => {
            setAppliedSearchItems(items);
            setAppliedSearchType(searchType);
          }}
          marketplaceFilter={marketplaceFilter}
          startDate={filterData.startDate}
          endDate={filterData.endDate}
          nullDateFilter={nullDateFilter}
          isFlipkart={isFlipkart}
          initialSelectedItems={searchType === appliedSearchType ? appliedSearchItems : []}
        />

        {showResetConfirm && (
          <ConfirmModal
            isOpen={true}
            onClose={() => setShowResetConfirm(false)}
            onConfirm={() => {
              resetColumnOrder(allColumns);
              setShowResetConfirm(false);
            }}
            title="Reset Column Order"
            message="Are you sure you want to reset the column order to default?"
            confirmText="OK"
            cancelText="Cancel"
          />
        )}

        {/* GST Mode Toggle & View Switcher */}
        {/* {!loading && (
          <div className="mb-4 flex items-center justify-between flex-wrap gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-6 flex-wrap">

            </div>
          </div>
        )} */}

        {/* Ads / Platform / Source / DataType toggles */}
        {!loading && (
          <div className="mb-2 flex items-center gap-4 flex-wrap">

            {/* SKU-Wise View Dropdown next to P/L View */}
            <div className="relative z-[35] inline-block w-full sm:w-auto" ref={viewDropdownRef}>
              <button
                type="button"
                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                className="flex items-center justify-between w-full sm:w-auto gap-2 bg-white border border-brand-500 text-slate-700 py-1.5 px-3 rounded-lg font-medium text-[13px] shadow-sm hover:border-brand-400 transition-colors cursor-pointer"
              >
                <span>Master-SKU Wise View</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isViewDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {isViewDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-full sm:w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-[70] overflow-hidden">
                  <div className="py-1">
                    {[
                      { id: "sku-wise", label: "SKU-Wise View" },
                      { id: "master-sku-wise", label: "Master-SKU Wise View" }
                    ].map((viewOption) => (
                      <div
                        key={viewOption.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (viewOption.id !== "master-sku-wise") {
                            navigate("/payments/calculations", {
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
                                }
                              }
                            });
                          }
                          setIsViewDropdownOpen(false);
                        }}
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-xs font-medium text-slate-700"
                      >
                        <span className={viewOption.id === "master-sku-wise" ? "text-brand-700 font-semibold" : "text-slate-700"}>
                          {viewOption.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* P/L View toggle */}
            {!isMyntra && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  P/L View:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                  <button
                    onClick={() => setGstMode("without_gst")}
                    className={`px-4 py-1.5 text-xs font-medium transition-colors ${gstMode === "without_gst"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    Without Tax
                  </button>
                  <button
                    onClick={() => setGstMode("with_gst")}
                    className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${gstMode === "with_gst"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    With Tax
                  </button>
                </div>
              </div>
            )}

            {/* Ads Type toggle & Amazon & Flipkart only */}
            {(!isMeesho && !isMyntra) && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Ads:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                  <button
                    onClick={() => setAdsMode("sku_wise")}
                    className={`px-4 py-1.5 text-xs font-medium transition-colors ${adsMode === "sku_wise"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    SKU-wise Ads
                  </button>
                  <button
                    onClick={() => setAdsMode("payment")}
                    className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${adsMode === "payment"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    Payment Ads
                  </button>
                </div>
              </div>
            )}

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
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Data Type:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                  <button
                    onClick={() => {
                      setDataTypeFilter("all");
                      setCurrentPage(1);
                      setExpandedMasterSkus({});
                      setExpandedMasterSkuSkus({});
                      setMasterSkuChildSkus({});
                      setMasterSkuSkuOrders({});
                    }}
                    className={`px-4 py-1.5 text-xs font-medium transition-colors ${dataTypeFilter === "all"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setDataTypeFilter("order-payment");
                      setCurrentPage(1);
                      setExpandedMasterSkus({});
                      setExpandedMasterSkuSkus({});
                      setMasterSkuChildSkus({});
                      setMasterSkuSkuOrders({});
                    }}
                    className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${dataTypeFilter === "order-payment"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    Order Payment
                  </button>
                  <button
                    onClick={() => {
                      setDataTypeFilter("amazon-charges-others");
                      setCurrentPage(1);
                      setExpandedMasterSkus({});
                      setExpandedMasterSkuSkus({});
                      setMasterSkuChildSkus({});
                      setMasterSkuSkuOrders({});
                    }}
                    className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${dataTypeFilter === "amazon-charges-others"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    Amazon Charges Others
                  </button>
                </div>
              </div>
            )}

            <div className="flex-shrink-0 ml-auto flex items-center gap-3">
              {/* <button
                onClick={() => setShowResetConfirm(true)}
                className="text-[12px] text-brand-600 hover:text-brand-700 font-semibold cursor-pointer underline decoration-transparent hover:decoration-brand-600 transition-colors"
              >
                Reset Column's Order
              </button> */}

              <button
                type="button"
                onClick={() => filters.setShowAddColumnSidebar && filters.setShowAddColumnSidebar(true)}
                className="flex items-center justify-center gap-2 px-4 h-9 rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-md transition-all cursor-pointer font-medium"
                title="Add Columns"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span className="text-sm">Add & Arrange Columns</span>
              </button>
            </div>
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

        {/* Table always mounted so scroll position is preserved during loading */}
        {!error && calculations.length >= 0 && (
          <>
            <div
              className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden transition-opacity duration-200"
              style={{
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
              }}
            >
              <div
                ref={scrollContainerRef}
                className="overflow-x-auto overflow-y-auto outline-none"
                style={{ maxHeight: "calc(100vh - 200px)" }}
                onKeyDown={handleTableKeyDown}
                tabIndex={0}
              >
                <table ref={tableRef} style={{ width: isMobile ? columns.reduce((acc, col) => acc + (parseInt(columnWidths[col]) || 150), 0) : 'max-content' }} className={`border-collapse bg-white ${isMobile ? 'table-fixed' : 'table-auto'}`}>
                  <thead className="bg-brand-600 border-b border-brand-700 sticky top-0 z-20 shadow-sm">
                    <tr>
                      {columns.map((col, idx) => (
                        <th
                          key={idx}
                          draggable={idx !== 0}
                          onClick={(e) => {
                            if (idx === 0) return;
                            if (e.shiftKey && lastClickedColIdx !== null) {
                              const start = Math.min(lastClickedColIdx, idx);
                              const end = Math.max(lastClickedColIdx, idx);
                              const rangeCols = columns.slice(start, end + 1).filter((c) => c !== "master_sku");
                              setSelectedHeaderColumns((prev) => {
                                const newSelection = new Set(prev);
                                rangeCols.forEach((c) => newSelection.add(c));
                                return Array.from(newSelection);
                              });
                            } else if (e.ctrlKey || e.metaKey) {
                              setSelectedHeaderColumns((prev) => {
                                if (prev.includes(col)) return prev.filter((c) => c !== col);
                                return [...prev, col];
                              });
                            } else {
                              setSelectedHeaderColumns([col]);
                            }
                            setLastClickedColIdx(idx);
                          }}
                          onDragStart={(e) => {
                            if (idx === 0) return;
                            if (selectedHeaderColumns.includes(col)) {
                              dragItemRef.current = selectedHeaderColumns;
                            } else {
                              dragItemRef.current = col;
                              setSelectedHeaderColumns([col]);
                            }
                          }}
                          onDragEnter={() => {
                            if (idx === 0) return;
                            setDragOver(col);
                          }}
                          onDragEnd={() => {
                            if (idx === 0) return;
                            if (dragOver && dragItemRef.current !== dragOver) {
                              handleColumnReorder(dragItemRef.current, dragOver, ["master_sku"]);
                            }
                            dragItemRef.current = null;
                            setDragOver(null);
                            setSelectedHeaderColumns([]);
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          style={isMobile ? {
                            width: columnWidths[col],
                            minWidth: columnWidths[col],
                            maxWidth: columnWidths[col],
                          } : { minWidth: 150 }}
                          className={`py-2 text-center text-[11px] font-bold text-white capitalize tracking-normal whitespace-normal leading-tight relative border-r border-brand-500 last:border-r-0 cursor-grab active:cursor-grabbing select-none ${idx === 0
                            ? "sticky left-0 z-30 border-r-2 border-brand-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-default bg-brand-600"
                            : selectedHeaderColumns.includes(col)
                              ? "bg-brand-500 shadow-inner"
                              : "bg-brand-600"
                            } ${dragOver === col ? "bg-brand-700 opacity-80 border-dashed border-2 border-brand-300" : ""
                            }`}
                        >
                          <div className="flex items-center justify-between w-full h-full relative group">
                            <div className="flex items-center justify-between gap-1 w-full px-1">
                              <span className="flex-1 min-w-0 break-words font-medium text-[13px] leading-tight text-center whitespace-normal">
                                {col === 'profit_loss' && isMyntra ? 'Profit / Loss' : (COLUMN_LABELS[col] || col)}
                              </span>

                              {col !== "fulfilment_source" && (
                                <div className="flex flex-col gap-0 shrink-0 ml-1">
                                  <button
                                    onClick={() => {
                                      if (
                                        sortColumn === col &&
                                        sortOrder === "desc"
                                      ) {
                                        setSortColumn(null);
                                        setSortOrder(null);
                                      } else {
                                        setSortColumn(col);
                                        setSortOrder("desc");
                                      }
                                    }}
                                    className={`p-0.5 rounded hover:bg-brand-700 transition-colors ${sortColumn === col && sortOrder === "desc" ? "bg-brand-700" : ""}`}
                                    title="Sort Descending (highest first)"
                                  >
                                    <ArrowUp
                                      size={12}
                                      className={
                                        sortColumn === col &&
                                          sortOrder === "desc"
                                          ? "text-white"
                                          : "text-brand-300 hover:text-white"
                                      }
                                    />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (
                                        sortColumn === col &&
                                        sortOrder === "asc"
                                      ) {
                                        setSortColumn(null);
                                        setSortOrder(null);
                                      } else {
                                        setSortColumn(col);
                                        setSortOrder("asc");
                                      }
                                    }}
                                    className={`p-0.5 rounded hover:bg-brand-700 transition-colors ${sortColumn === col && sortOrder === "asc" ? "bg-brand-700" : ""}`}
                                    title="Sort Ascending (lowest first)"
                                  >
                                    <ArrowDown
                                      size={12}
                                      className={
                                        sortColumn === col &&
                                          sortOrder === "asc"
                                          ? "text-white"
                                          : "text-brand-300 hover:text-white"
                                      }
                                    />
                                  </button>
                                </div>
                              )}

                              {idx === 0 && (
                                <div className="shrink-0 ml-2 flex items-center gap-1">
                                  {appliedSearchItems?.length > 0 && (
                                      <button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setIsSearchModalOpen(true);
                                          }}
                                          className="p-1.5 rounded-full transition-all shadow-sm backdrop-blur-sm bg-blue-500/40 text-white hover:bg-blue-500/60 border border-blue-400/50"
                                          title="Edit Search Filter"
                                      >
                                          <Search size={14} />
                                      </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (appliedSearchItems?.length > 0) {
                                        setAppliedSearchItems([]);
                                        setSelectedSearchItems([]);
                                        setLocalSearchQuery('');
                                      } else {
                                        setIsSearchModalOpen(true);
                                      }
                                    }}
                                    className={`p-1.5 rounded-full transition-all shadow-sm backdrop-blur-sm ${appliedSearchItems?.length > 0 ? 'bg-red-500/40 text-white hover:bg-red-500/60 border border-red-400/50' : 'bg-white/30 text-white hover:bg-white/40 border border-white/20'}`}
                                    title={appliedSearchItems?.length > 0 ? "Clear Search Filter" : "Search"}
                                  >
                                    {appliedSearchItems?.length > 0 ? <X size={14} /> : <Search size={14} />}
                                  </button>
                                </div>
                              )}
                            </div>
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-brand-500 active:bg-brand-400 transition-colors z-20"
                              onMouseDown={(e) => handleResizeStart(col, e)}
                              style={{ marginRight: "-4px" }}
                            />
                          </div>
                        </th>
                      ))}
                    </tr>

                    {/* Level 0 - Total Row */}
                    {totalRow &&
                      (() => {
                        const adjTotalRow = applyGstAdjustment(totalRow, {
                          gstMode,
                          isAmazon,
                          isMeesho,
                          grandProfits: memoizedGrandProfits,
                        });
                        return (
                          <tr className="bg-slate-200">
                            {columns.map((col, colIdx) => (
                              <th
                                key={colIdx}
                                scope="col"
                                style={isMobile ? {
                                  width: columnWidths[col],
                                  minWidth: columnWidths[col],
                                  maxWidth: columnWidths[col],
                                } : { minWidth: 150 }}
                                className={`px-3 py-3 text-center text-sm font-bold border-r border-slate-300 last:border-r-0 overflow-hidden text-ellipsis text-slate-800 bg-slate-200 ${colIdx === 0
                                  ? "sticky left-0 z-30 border-r-2 border-slate-400"
                                  : ""
                                  }`}
                              >
                                {colIdx === 0 ? (
                                  <span>TOTAL</span>
                                ) : col === "sales_contribution" ||
                                  col === "profit_contribution" ? (
                                  "100.00%"
                                ) : (
                                  formatCellValue(col, adjTotalRow[col])
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

                      if (displayRows.length === 0 && hasAppliedSearch) {
                        return (
                          <tr>
                            <td
                              colSpan={columns.length}
                              className="px-4 py-10 text-center text-sm text-slate-500"
                            >
                              No results found for{" "}
                              <strong>"{appliedSearchItems.join(", ")}"</strong>
                            </td>
                          </tr>
                        );
                      }

                      const rows = [];
                      displayRows.forEach((rawRow, rowIdx) => {
                        const row = applyGstAdjustment(
                          enrichRowWithContributions(rawRow, totalRow),
                          {
                            gstMode,
                            isAmazon,
                            isMeesho,
                            grandProfits: memoizedGrandProfits,
                          },
                        );
                        const masterSku = row.sku; // COALESCE(master_sku, sku) from API
                        const isLevel1Expanded = expandedMasterSkus[rowIdx];

                        // Level 1: Master-SKU row 
                        rows.push(
                          <tr
                            key={`msku-${rowIdx}`}
                            className={`hover:bg-slate-200 transition-colors duration-100 ${isLevel1Expanded ? "bg-emerald-50/40" : ""}`}
                          >
                            {columns.map((col, colIdx) => {
                              const cellValue = formatCellValue(col, row[col]);
                              const isSkuCol = colIdx === 0;
                              const extraClasses = getCellStyleClasses(
                                col,
                                row[col],
                              );
                              return (
                                <td
                                  key={col}
                                  style={isMobile ? { width: columnWidths[col], minWidth: columnWidths[col], maxWidth: columnWidths[col] } : { minWidth: 150 }}
                                  className={`px-3 py-2 text-center text-[13px] border-r border-slate-100 last:border-r-0 whitespace-nowrap overflow-hidden text-ellipsis ${isSkuCol ? "cursor-pointer text-white hover:text-brand-100 font-medium sticky left-0 z-10 bg-brand-600 border-r-2 border-brand-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-left" : extraClasses ? extraClasses : "text-slate-700"}`}
                                  onClick={() =>
                                    isSkuCol &&
                                    handleMasterSkuClick(masterSku, rowIdx)
                                  }
                                >
                                  {isSkuCol ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="shrink-0 flex items-center">
                                        {loadingMasterSkuSkus[masterSku] ? (
                                          <Loader2
                                            size={14}
                                            className="animate-spin"
                                          />
                                        ) : isLevel1Expanded ? (
                                          <ChevronDown size={14} />
                                        ) : (
                                          <ChevronRight size={14} />
                                        )}
                                      </span>
                                      <span
                                        className="font-medium truncate whitespace-pre max-w-[260px]"
                                        title={masterSku}
                                      >
                                        {masterSku !== null &&
                                          masterSku !== undefined
                                          ? masterSku
                                          : "—"}
                                      </span>
                                    </div>
                                  ) : (
                                    cellValue
                                  )}
                                </td>
                              );
                            })}
                          </tr>,
                        );

                        // Level 2: Child SKU rows
                        if (isLevel1Expanded) {
                          const childSkus = masterSkuChildSkus[masterSku] || [];
                          if (loadingMasterSkuSkus[masterSku]) {
                            rows.push(
                              <tr
                                key={`msku-loading-${rowIdx}`}
                                className="bg-slate-50/60"
                              >
                                <td
                                  colSpan={columns.length}
                                  className="px-10 py-3 text-sm text-slate-400"
                                >
                                  <span className="flex items-center gap-2">
                                    <Loader2
                                      size={14}
                                      className="animate-spin"
                                    />{" "}
                                    Loading SKUs
                                  </span>
                                </td>
                              </tr>,
                            );
                          } else {
                            childSkus.forEach((childRaw, childIdx) => {
                              const childRow = applyGstAdjustment(
                                enrichRowWithContributions(childRaw, totalRow),
                                {
                                  gstMode,
                                  isAmazon,
                                  isMeesho,
                                  grandProfits: memoizedGrandProfits,
                                },
                              );
                              const childSku = childRow.sku;
                              const skuKey = `${masterSku}__${childSku}${childRow.size ? `__${childRow.size}` : ''}`;
                              const isLevel2Expanded =
                                expandedMasterSkuSkus[skuKey];

                              rows.push(
                                <tr
                                  key={`msku-child-${rowIdx}-${childIdx}`}
                                  className={`bg-slate-50/60 hover:bg-slate-200 transition-colors ${isLevel2Expanded ? "bg-blue-50/40" : ""}`}
                                >
                                  {columns.map((col, colIdx) => {
                                    const cellValue = formatCellValue(
                                      col,
                                      childRow[col],
                                    );
                                    const isSkuCol = colIdx === 0;
                                    const extraClasses = getCellStyleClasses(
                                      col,
                                      childRow[col],
                                    );
                                    return (
                                      <td
                                        key={col}
                                        style={isMobile ? {
                                          width: columnWidths[col],
                                          minWidth: columnWidths[col],
                                          maxWidth: columnWidths[col],
                                        } : { minWidth: 150 }}
                                        className={`px-3 py-2 text-center text-[12px] border-r border-slate-100 last:border-r-0 whitespace-nowrap overflow-hidden text-ellipsis ${isSkuCol ? "cursor-pointer text-brand-900 bg-brand-100 hover:bg-brand-200 font-medium sticky left-0 z-10 border-r-2 border-brand-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-left" : extraClasses ? extraClasses : "text-slate-600"}`}
                                        onClick={() =>
                                          isSkuCol &&
                                          handleMasterSkuSkuClick(
                                            masterSku,
                                            childSku,
                                            skuKey,
                                            childRow.size
                                          )
                                        }
                                      >
                                        {isSkuCol ? (
                                          <div className="flex items-center gap-1.5 pl-5">
                                            <span className="shrink-0 flex items-center">
                                              {loadingMasterSkuOrders[
                                                skuKey
                                              ] ? (
                                                <Loader2
                                                  size={13}
                                                  className="animate-spin"
                                                />
                                              ) : isLevel2Expanded ? (
                                                <ChevronDown size={13} />
                                              ) : (
                                                <ChevronRight size={13} />
                                              )}
                                            </span>
                                            <span
                                              className="font-medium truncate whitespace-pre max-w-[240px]"
                                              title={childSku}
                                            >
                                              {childSku !== null &&
                                                childSku !== undefined
                                                ? childSku
                                                : "-"}
                                            </span>
                                          </div>
                                        ) : (
                                          cellValue
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>,
                              );

                              // Level 3: Order rows
                              if (isLevel2Expanded) {
                                const orderRowsState = masterSkuSkuOrders[skuKey] || {};
                                const orderRows = orderRowsState.pages
                                  ? orderRowsState.pages.flatMap((p) => p.data)
                                  : Array.isArray(orderRowsState)
                                    ? orderRowsState
                                    : [];
                                const hasPrevious = orderRowsState.pages?.length > 0 && orderRowsState.pages[0].page > 1;
                                const hasMore = orderRowsState.hasMore;

                                if (loadingMasterSkuOrders[skuKey] && orderRows.length === 0) {
                                  rows.push(
                                    <tr
                                      key={`msku-orders-loading-${skuKey}`}
                                      className="bg-white"
                                    >
                                      <td
                                        colSpan={columns.length}
                                        className="px-14 py-3 text-sm text-slate-400"
                                      >
                                        <span className="flex items-center gap-2">
                                          <Loader2
                                            size={13}
                                            className="animate-spin"
                                          />{" "}
                                          Loading orders
                                        </span>
                                      </td>
                                    </tr>,
                                  );
                                } else {
                                  if (hasPrevious) {
                                    rows.push(
                                      <tr key={`msku-orders-prev-${skuKey}`} className="bg-slate-50 border-b border-slate-100">
                                        <td colSpan={columns.length} className="px-4 py-2 text-left">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleLoadPreviousMasterSkuOrders(masterSku, childSku, skuKey); }}
                                            disabled={loadingMasterSkuOrders[skuKey]}
                                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 flex items-center gap-2 pl-8"
                                          >
                                            {loadingMasterSkuOrders[skuKey] && <Loader2 className="animate-spin" size={14} />}
                                           Load Previous 50
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  }

                                  orderRows.forEach((orderRaw, orderIdx) => {
                                    const orderRow = applyGstAdjustment(
                                      enrichRowWithContributions(
                                        orderRaw,
                                        totalRow,
                                      ),
                                      {
                                        gstMode,
                                        isAmazon,
                                        isMeesho,
                                        grandProfits: memoizedGrandProfits,
                                      },
                                    );
                                    rows.push(
                                      <tr
                                        key={`msku-order-${skuKey}-${orderIdx}`}
                                        className="bg-white hover:bg-slate-200 transition-colors"
                                      >
                                        {columns.map((col, colIdx) => {
                                          const cellValue = formatCellValue(
                                            col,
                                            orderRow[col],
                                          );
                                          const isSkuCol = colIdx === 0;
                                          const extraClasses =
                                            getCellStyleClasses(
                                              col,
                                              orderRow[col],
                                            );
                                          return (
                                            <td
                                              key={col}
                                              style={isMobile ? {
                                                width: columnWidths[col],
                                                minWidth: columnWidths[col],
                                                maxWidth: columnWidths[col],
                                              } : { minWidth: 150 }}
                                              className={`px-3 py-2 text-center text-[11px] border-r border-slate-100 last:border-r-0 whitespace-nowrap overflow-hidden text-ellipsis ${isSkuCol ? "text-slate-800 bg-slate-100 border-r-2 font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-left" : extraClasses ? extraClasses : "text-slate-500"}`}
                                            >
                                              {isSkuCol ? (
                                                <span
                                                  className="pl-10 block truncate max-w-[270px]"
                                                  title={orderRow.sku}
                                                >
                                                  {orderRow.sku !== null &&
                                                    orderRow.sku !== undefined
                                                    ? orderRow.sku
                                                    : "-"}
                                                </span>
                                              ) : (
                                                cellValue
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>,
                                    );
                                  });

                                  if (hasMore) {
                                    rows.push(
                                      <tr key={`msku-orders-next-${skuKey}`} className="bg-slate-50 border-t border-slate-100">
                                        <td colSpan={columns.length} className="px-4 py-2 text-left">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleLoadMoreMasterSkuOrders(masterSku, childSku, skuKey); }}
                                            disabled={loadingMasterSkuOrders[skuKey]}
                                            className="sticky left-8 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 flex items-center gap-2 w-max"
                                          >
                                            {loadingMasterSkuOrders[skuKey] && <Loader2 className="animate-spin" size={14} />}
                                            ↓ Load Next 50
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  }

                                  if (orderRows.length === 0) {
                                    rows.push(
                                      <tr
                                        key={`msku-orders-empty-${skuKey}`}
                                        className="bg-white"
                                      >
                                        <td
                                          colSpan={columns.length}
                                          className="px-14 py-2 text-xs text-slate-400 italic"
                                        >
                                          No orders found
                                        </td>
                                      </tr>,
                                    );
                                  }
                                }
                              }
                            });
                          }
                        }
                      });
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {calculations.length > 0 && (
                <div className="mt-2 flex items-center justify-between px-4 py-2 bg-white border-t border-slate-200 rounded-b-lg">
                  <div className="text-sm text-slate-600">
                    Showing {(currentPage - 1) * pageSize + 1} to{" "}
                    {Math.min(currentPage * pageSize, totalCount)} of{" "}
                    {totalCount} results
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
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-1.5 text-sm text-slate-700">
                      Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(Math.ceil(totalCount / pageSize), prev + 1),
                        )
                      }
                      disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                      className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage(Math.ceil(totalCount / pageSize))
                      }
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

export default MasterSkuCalculations;
