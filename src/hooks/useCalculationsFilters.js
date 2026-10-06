import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useDateRangeFilter } from './useDateRangeFilter';

/**
 * Shared hook that owns ALL filter and marketplace state for both
 * PaymentsCalculations and MasterSkuCalculations pages.
 *
 * @param {object} opts
 * @param {string}   opts.storageKey      - Unique localStorage prefix (e.g. 'paymentCalculations' | 'masterSkuCalculations')
 * @param {object}   [opts.locationState] - React Router location.state from the calling page
 * @param {Function} [opts.onReset]       - Called whenever filter changes require clearing page-level drill-down caches
 */
const useCalculationsFilters = ({ storageKey, locationState, onReset }) => {
    const routerLocation = useLocation();
    const navigate = useNavigate();
    const location = locationState || {};

    // Parse query params (used when opening in a new tab)
    const searchParams = new URLSearchParams(window.location.search);
    let qsMktIds = null;
    let qsStartDate = null;
    let qsEndDate = null;
    try {
        if (searchParams.get('marketplaceIds')) qsMktIds = JSON.parse(searchParams.get('marketplaceIds'));
        if (searchParams.get('startDate')) qsStartDate = searchParams.get('startDate');
        if (searchParams.get('endDate')) qsEndDate = searchParams.get('endDate');
    } catch(e) {}

    // ── Date range ────────────────────────────────────────────────────────────
    const {
        filterData,
        tempStartDate,
        tempEndDate,
        dateError,
        setTempStartDate,
        setTempEndDate,
        setDateError,
        setFilterData,
        getDefaultDates,
    } = useDateRangeFilter(null, {
        startDate: qsStartDate || location.filters?.startDate,
        endDate: qsEndDate || location.filters?.endDate,
    }, 'lastMonth', 'calculations');

    // ── Marketplace ───────────────────────────────────────────────────────────
    const getSavedMarketplaceFilter = () => {
        try {
            const saved = localStorage.getItem(`${storageKey}MarketplaceFilter`);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    };

    const [marketplaceFilter, setMarketplaceFilter] = useState(
        qsMktIds || location.filters?.marketplaceIds || location.filters?.marketplaceId || getSavedMarketplaceFilter() || null
    );

    // Persist the applied marketplace filter so it survives a page refresh
    // (location.state-based navigation history can't be relied on across a hard reload).
    useEffect(() => {
        try {
            if (marketplaceFilter && (!Array.isArray(marketplaceFilter) || marketplaceFilter.length > 0)) {
                localStorage.setItem(`${storageKey}MarketplaceFilter`, JSON.stringify(marketplaceFilter));
            } else {
                localStorage.removeItem(`${storageKey}MarketplaceFilter`);
            }
        } catch (e) { }
    }, [marketplaceFilter, storageKey]);

    useEffect(() => {
        if (marketplaceFilter && typeof window !== 'undefined' && window.history && window.history.state) {
            try {
                // Update React Router's history state natively
                const currentState = window.history.state;
                const usrState = currentState?.usr || {};
                const currentFilters = usrState?.filters || {};
                
                const newState = {
                    ...currentState,
                    usr: {
                        ...usrState,
                        filters: {
                            ...currentFilters,
                            marketplaceIds: marketplaceFilter
                        }
                    }
                };

                // Remove marketplaceIds from URL so it doesn't override on refresh
                const searchParams = new URLSearchParams(window.location.search);
                searchParams.delete('marketplaceIds');
                const newSearch = searchParams.toString();
                const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');

                window.history.replaceState(newState, '', newUrl);
            } catch (e) {
                console.error("Failed to update history state", e);
            }
        }
    }, [marketplaceFilter]);

    const [nullDateFilter, setNullDateFilter] = useState(location.filters?.nullOrderDate || false);
    const [marketplaceIdToName, setMarketplaceIdToName] = useState({});
    const [marketplaceIdToPlatform, setMarketplaceIdToPlatform] = useState({});
    const [marketplaceIdToConfig, setMarketplaceIdToConfig] = useState({});
    const [availableMarketplaces, setAvailableMarketplaces] = useState([]);
    const [isPlatformLoaded, setIsPlatformLoaded] = useState(false);

    useEffect(() => {
        const fetchMarketplaceNames = async () => {
            try {
                const { data } = await api.get('/marketplaces/filter-options?includeInactive=true');
                const nameMap = {};
                const platformMap = {};
                const configMap = {};
                if (Array.isArray(data)) {
                    setAvailableMarketplaces(data);
                    data.forEach(group => {
                        if (group.accounts) {
                            group.accounts.forEach(acc => {
                                nameMap[acc._id.toString()] = acc.name;
                                platformMap[acc._id.toString()] = group.key;
                                configMap[acc._id.toString()] = acc.config;
                            });
                        }
                    });
                }
                setMarketplaceIdToName(nameMap);
                setMarketplaceIdToPlatform(platformMap);
                setMarketplaceIdToConfig(configMap);
                setIsPlatformLoaded(true);
            } catch (_e) {
                // silently fail
                setIsPlatformLoaded(true);
            }
        };
        fetchMarketplaceNames();
    }, []);

    // Derived marketplace booleans
    const resolvedMarketplaceNames = Array.isArray(marketplaceFilter)
        ? marketplaceFilter.map(id => marketplaceIdToName[id] || id).filter(Boolean)
        : marketplaceFilter
            ? [marketplaceIdToName[marketplaceFilter] || marketplaceFilter]
            : [];

    const isMeesho = marketplaceFilter
        ? (Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter])
            .every(id => marketplaceIdToPlatform[id] === 'Meesho')
        : false;
    const isFlipkart = marketplaceFilter
        ? (Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter])
            .every(id => marketplaceIdToPlatform[id] === 'Flipkart')
        : false;
    const isAmazon = marketplaceFilter
        ? (Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter])
            .every(id => (marketplaceIdToPlatform[id] || '').toLowerCase().includes('amazon'))
        : false;
    const isMyntra = marketplaceFilter
        ? (Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter])
            .every(id => marketplaceIdToPlatform[id] === 'Myntra')
        : false;

    const isMeeshoSizeDisabled = isMeesho && marketplaceFilter
        ? (Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter])
            .some(id => marketplaceIdToConfig[id]?.enableSizeWiseCalculation === false)
        : false;

    // Evaluate the type of the currently selected marketplace filters to branch localstorage configuration
    const platformType = isPlatformLoaded ? (isAmazon ? 'amazon' : isMeesho ? 'meesho' : isFlipkart ? 'flipkart' : isMyntra ? 'myntra' : 'all') : 'all';

    // ── Pagination / sorting ─────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(100);
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState(null);

    // ── Filter modes ─────────────────────────────────────────────────────────
    const [gstMode, setGstMode] = useState(location.filters?.gstMode || 'without_gst');
    const [adsMode, setAdsMode] = useState(location.filters?.adsType || 'sku_wise');
    const [dataTypeFilter, setDataTypeFilter] = useState(location.filters?.dataTypeFilter || 'all');
    const [shopsyFilter, setShopsyFilter] = useState(location.filters?.shopsyFilter || 'all');
    const [meeshoOrderSourceFilter, setMeeshoOrderSourceFilter] = useState(location.filters?.meeshoOrderSourceFilter || 'all');

    // ── Search ────────────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [searchType, setSearchType] = useState('order_id'); // 'sku', 'order_id', 'master_sku'
    const [orderSearchLoading, setOrderSearchLoading] = useState(false);
    const searchInputRef = useRef(null);

    // ── Return status ─────────────────────────────────────────────────────────
    const [returnStatusFilter, setReturnStatusFilter] = useState(location.filters?.returnStatuses || []);
    const [returnStatusOptions, setReturnStatusOptions] = useState([]);
    const [showReturnStatusDropdown, setShowReturnStatusDropdown] = useState(false);
    const returnStatusRef = useRef(null);

    // ── Warehouse ────────────────────────────────────────────────────────────
    const [warehouseFilter, setWarehouseFilter] = useState(location.filters?.warehouses || []);
    const [warehouseOptions, setWarehouseOptions] = useState([]);
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
    const warehouseRef = useRef(null);

    // ── Brand ────────────────────────────────────────────────────────────────
    const [brandFilter, setBrandFilter] = useState(location.filters?.brands || []);
    const [brandOptions, setBrandOptions] = useState([]);
    const [brandSearch, setBrandSearch] = useState('');
    const [showBrandDropdown, setShowBrandDropdown] = useState(false);
    const brandRef = useRef(null);

    // ── Meesho Compensation / Recovery Reason filters ─────────────────────────
    const [compensationReasonFilter, setCompensationReasonFilter] = useState(location.filters?.compensationReasons || []);
    const [compensationReasonOptions, setCompensationReasonOptions] = useState([]);
    const [compensationReasonSearch, setCompensationReasonSearch] = useState('');
    const [recoveryReasonFilter, setRecoveryReasonFilter] = useState(location.filters?.recoveryReasons || []);
    const [recoveryReasonOptions, setRecoveryReasonOptions] = useState([]);
    const [recoveryReasonSearch, setRecoveryReasonSearch] = useState('');
    const [sizeFilter, setSizeFilter] = useState(location.filters?.sizes || []);
    const [sizeOptions, setSizeOptions] = useState([]);
    const [sizeSearch, setSizeSearch] = useState('');

    // ── Month / Year quick filter ─────────────────────────────────────────────
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [availableYears, setAvailableYears] = useState([]);
    const [availableMonths, setAvailableMonths] = useState({});

    // ── Column state ──────────────────────────────────────────────────────────
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [showAddColumnSidebar, setShowAddColumnSidebar] = useState(false);
    const [showFiltersPanel, setShowFiltersPanel] = useState(true);
    const [selectorMode, setSelectorMode] = useState('reorder');
    const [columnOrder, setColumnOrder] = useState([]);
    const [dragOver, setDragOver] = useState(null);
    const dragItemRef = useRef(null);
    const columnSelectorRef = useRef(null);
    const getInitialSkuWidth = () => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 640 ? 110 : 150;
        }
        return 150;
    };

    // Track mobile vs desktop for responsive column sizing
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < 640 : false
    );
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [columnWidths, setColumnWidths] = useState({
        sku: getInitialSkuWidth(), master_sku: getInitialSkuWidth(), order_date: 150, total_cost: 150,
        profit_loss: 150, total_sales: 150, orders_settlement: 150,
        mp_fee_settlement: 150, claim_payment: 150, return_loss: 150,
        flipkart_gst_credit: 150, purchase_gst_credit: 150,
        selling_gst_debit: 150, meesho_gst_credit: 150, meesho_return_charges: 150,
        tcs_value: 150, tds_value: 150, total_quantity: 150,
        replacement_quantity: 150, delivered_quantity: 150,
        customer_return_quantity: 150, rto_quantity: 150, refund_loss_quantity: 150,
        cancel_quantity: 150, sku_wise_ads: 150, profit_loss_with_ads: 150,
        fulfilment_source: 150, return_pct: 150, rto_pct: 150, delivered_pct: 150,
        profit_pct_by_sales: 150, profit_pct_by_settlement: 150,
        avg_settlement_per_delivered: 150, profit_with_ads_per_delivered: 150,
        profit_without_ads_per_delivered: 150, sku_wise_ads_per_delivered: 150,
        return_charges_per_delivered: 150, sales_contribution: 150, profit_contribution: 150,
        amazon_charges_other: 150, gross_sales: 150, return_sales: 150,
        shipping_service: 150, amazon_gst_credit: 150, amazon_return_charges: 150,
        safety_reimbursement: 150, reimbursement: 150, seller_rewards: 150,
        payment_ads: 150, tds_reimbursement: 150, quantity: 150,
        avg_sales_per_delivered: 150, avg_purchase_per_qty: 150,
        selling_fees: 150, fba_fees: 150, other_transaction_fees: 150,
        other_fees: 150, available_gst_credit: 150,
        forward_qty: 150, reverse_qty: 150, forward_auto_spf_qty: 150,
        nod_qty: 150, nod_amount: 150, auto_spf_amount: 150, royalty_charges: 150,
        brand: 150, commission: 150, logistics_commission: 150,
    });
    const [resizing, setResizing] = useState(null);
    const tableRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const savedScrollPos = useRef({ top: 0, left: 0 });

    // ── Column visibility (per-page localStorage key) ─────────────────────────
    const initialVisibleColumns = {
        sku: true, orders_settlement: true, mp_fee_settlement: true,
        return_loss: true, total_sales: true, total_offer_amount: true, my_share: true, total_cost: true,
        profit_loss: true, profit_loss_with_ads: true, sku_wise_ads: true,
        total_quantity: true, replacement_quantity: true, delivered_quantity: true,
        customer_return_quantity: true, rto_quantity: true, refund_loss_quantity: true,
        cancel_quantity: true, fulfilment_source: true, order_date: true,
        return_pct: true, rto_pct: true, delivered_pct: true,
        profit_pct_by_sales: true, profit_pct_by_settlement: true,
        avg_settlement_per_delivered: true, profit_with_ads_per_delivered: true,
        profit_without_ads_per_delivered: true, sku_wise_ads_per_delivered: true,
        return_charges_per_delivered: true, sales_contribution: true,
        profit_contribution: true, flipkart_gst_credit: true,
        purchase_gst_credit: true, selling_gst_debit: true, meesho_gst_credit: true,
        meesho_return_charges: true, tcs_value: true, tds_value: true,
        amazon_charges_other: true, gross_sales: true, return_sales: true,
        shipping_service: true, amazon_gst_credit: true, amazon_return_charges: true,
        safety_reimbursement: true, reimbursement: true, seller_rewards: true,
        payment_ads: true, tds_reimbursement: true, quantity: true,
        avg_sales_per_delivered: true, avg_purchase_per_qty: true,
        selling_fees: true, fba_fees: true, other_transaction_fees: true,
        other_fees: true, available_gst_credit: true,
        forward_qty: true, forward_pct: true, reverse_qty: true, reverse_pct: true, forward_auto_spf_qty: true, forward_auto_spf_pct: true,
        nod_qty: true, nod_amount: true, auto_spf_amount: true, royalty_charges: true,
        brand: true, commission: true, logistics_commission: true,
    };
    const [visibleColumns, setVisibleColumns] = useState(initialVisibleColumns);

    // ── API data fetching helpers ─────────────────────────────────────────────
    const fetchAvailableMonths = useCallback(async () => {
        try {
            const params = {};
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            const { data } = await api.get('/payments/calculations/available-months', { params });
            if (data?.years?.length > 0) {
                setAvailableYears(data.years);
                setAvailableMonths(data.yearMonthData || {});
            } else {
                setAvailableYears([]);
                setAvailableMonths({});
            }
        } catch (_e) {
            // keep defaults on error
        }
    }, [marketplaceFilter]);

    const fetchReturnStatuses = useCallback(async () => {
        try {
            const params = {};
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            const { data } = await api.get('/payments/calculations/return-statuses', { params });
            if (Array.isArray(data)) {
                const generalized = data.map(s => {
                    if (!s) return s;
                    const l = s.toLowerCase();
                    if (isMyntra) {
                        if (l === 'forward') return 'Forward';
                        if (l === 'reverse') return 'Reverse';
                        if (l === 'forwardautospf') return 'Forward Auto SPF';
                        if (l === 'nod') return 'NOD';
                        return s;
                    }
                    if (l === 'customer return' || l === 'return') return 'Return';
                    if (l === 'logistics return' || l === 'logistic return' || l === 'rto') return 'RTO';
                    if (l === 'na' || l === 'delivered') return 'Delivered';
                    return s;
                });
                setReturnStatusOptions([...new Set(generalized)]);
            } else {
                setReturnStatusOptions([]);
            }
        } catch (_e) {
            // ignore
        }
    }, [marketplaceFilter]);

    const fetchWarehouses = useCallback(async () => {
        try {
            const params = {};
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
            if (nullDateFilter) params.nullOrderDate = true;
            if (returnStatusFilter?.length > 0) params.returnStatuses = JSON.stringify(returnStatusFilter);
            const { data } = await api.get('/payments/calculations/warehouses', { params });
            setWarehouseOptions(Array.isArray(data) ? data : []);
        } catch (_e) {
            // ignore
        }
    }, [marketplaceFilter, filterData.startDate, filterData.endDate, nullDateFilter, returnStatusFilter]);

    const fetchBrands = useCallback(async () => {
        try {
            const params = {};
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
            if (nullDateFilter) params.nullOrderDate = true;
            if (returnStatusFilter?.length > 0) params.returnStatuses = JSON.stringify(returnStatusFilter);
            const { data } = await api.get('/payments/calculations/brands', { params });
            setBrandOptions(Array.isArray(data) ? data : []);
        } catch (_e) {
            // ignore
        }
    }, [marketplaceFilter, filterData.startDate, filterData.endDate, nullDateFilter, returnStatusFilter]);

    const fetchCompensationReasons = useCallback(async () => {
        try {
            const params = {};
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
            const { data } = await api.get('/payments/calculations/meesho-compensation-reasons', { params });
            setCompensationReasonOptions(Array.isArray(data) ? data : []);
        } catch (_e) { /* ignore */ }
    }, [marketplaceFilter, filterData.startDate, filterData.endDate]);

    const fetchRecoveryReasons = useCallback(async () => {
        try {
            const params = {};
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
            const { data } = await api.get('/payments/calculations/meesho-recovery-reasons', { params });
            setRecoveryReasonOptions(Array.isArray(data) ? data : []);
        } catch (_e) { /* ignore */ }
    }, [marketplaceFilter, filterData.startDate, filterData.endDate]);

    const fetchSizes = useCallback(async () => {
        try {
            const params = {};
            if (marketplaceFilter) {
                params.marketplaceIds = JSON.stringify(
                    Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                );
            }
            if (filterData.startDate) params.startDate = filterData.startDate;
            if (filterData.endDate) params.endDate = filterData.endDate;
            const { data } = await api.get('/payments/calculations/meesho-sizes', { params });
            setSizeOptions(Array.isArray(data) ? data : []);
        } catch (_e) { /* ignore */ }
    }, [marketplaceFilter, filterData.startDate, filterData.endDate]);

    // ── Boot effects ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!filterData.startDate || !filterData.endDate) {
            const defaults = getDefaultDates();
            setFilterData(prev => ({
                ...prev,
                startDate: prev.startDate || defaults.startDate,
                endDate: prev.endDate || defaults.endDate,
            }));
            setTempStartDate(defaults.startDate);
            setTempEndDate(defaults.endDate);
        }
        fetchAvailableMonths();
        fetchReturnStatuses();
        fetchWarehouses();
        fetchBrands();
        fetchCompensationReasons();
        fetchRecoveryReasons();
        fetchSizes();

        // Load visible columns (scoped by platform) is now handled by the platformType useEffect below
         
    }, []);

    // Load column visibility from localStorage specific to marketplace type (run when platformType is resolved)
    useEffect(() => {
        if (!isPlatformLoaded) return;
        const vColKey = `${storageKey}VisibleColumns_${platformType}`;
        const savedColumns = localStorage.getItem(vColKey);
        if (savedColumns) {
            try {
                const parsed = JSON.parse(savedColumns);
                setVisibleColumns(prev => ({ ...initialVisibleColumns, ...parsed }));
            } catch (e) {
                console.error("Failed to parse visibleColumns", e);
            }
        }
    }, [isPlatformLoaded, platformType]);  

    useEffect(() => { fetchAvailableMonths(); }, [fetchAvailableMonths]);
    useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);
    useEffect(() => { fetchBrands(); }, [fetchBrands]);
    useEffect(() => { fetchCompensationReasons(); }, [fetchCompensationReasons]);
    useEffect(() => { fetchRecoveryReasons(); }, [fetchRecoveryReasons]);
    useEffect(() => { fetchSizes(); }, [fetchSizes]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handle = (e) => {
            if (columnSelectorRef.current && !columnSelectorRef.current.contains(e.target))
                setShowColumnSelector(false);
            if (returnStatusRef.current && !returnStatusRef.current.contains(e.target))
                setShowReturnStatusDropdown(false);
            if (warehouseRef.current && !warehouseRef.current.contains(e.target))
                setShowWarehouseDropdown(false);
            if (brandRef.current && !brandRef.current.contains(e.target))
                setShowBrandDropdown(false);
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // Column resize mouse handling
    useEffect(() => {
        if (!resizing) return;
        const onMove = (e) => {
            const newWidth = Math.max(100, resizing.startWidth + (e.clientX - resizing.startX));
            setColumnWidths(prev => ({ ...prev, [resizing.column]: newWidth }));
        };
        const onUp = () => setResizing(null);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [resizing]);

    // Debounced search
    useEffect(() => {
        const term = searchTerm.trim();
        if (!term) {
            setDebouncedSearchTerm('');
            onReset?.();
            return;
        }
        setOrderSearchLoading(true);
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(term);
            setOrderSearchLoading(false);
        }, 400);
        return () => clearTimeout(timer);
         
    }, [searchTerm]);

    // Reset page when debounced search changes
    useEffect(() => { setCurrentPage(1); }, [debouncedSearchTerm]);

    // Auto-clear N/A filter when switching away from Amazon
    useEffect(() => {
        if (!isAmazon && nullDateFilter) setNullDateFilter(false);
    }, [isAmazon]);  

    // Clear drill-down caches when return status filter changes
    useEffect(() => { onReset?.(); }, [returnStatusFilter]);  

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleApplyFilter = () => {
        setDateError('');
        setFilterData({ ...filterData, startDate: tempStartDate, endDate: tempEndDate });
        setCurrentPage(1);
        onReset?.();
    };

    const handleDateRangeChange = useCallback((start, end) => {
        setNullDateFilter(false);
        setTempStartDate(start);
        setTempEndDate(end);
        setDateError('');
        setFilterData(prev => ({ ...prev, startDate: start, endDate: end }));
    }, []);  

    const handleNullDateSelect = useCallback((active) => {
        setNullDateFilter(active);
        if (active) {
            setTempStartDate('');
            setTempEndDate('');
            setFilterData(prev => ({ ...prev, startDate: null, endDate: null }));
        }
        setCurrentPage(1);
    }, []);  

    const handleClearFilter = () => {
        const defaults = getDefaultDates();
        setTempStartDate(defaults.startDate);
        setTempEndDate(defaults.endDate);
        setFilterData({ ...filterData, startDate: defaults.startDate, endDate: defaults.endDate });
        setDateError('');
        setSelectedMonth(null);
        setSelectedYear(null);
        setReturnStatusFilter([]);
        setCurrentPage(1);
        onReset?.();
    };

    const handleReturnStatusToggle = (status) => {
        setReturnStatusFilter(prev => {
            const exists = prev.includes(status);
            const updated = exists ? prev.filter(s => s !== status) : [...prev, status];
            setCurrentPage(1);
            return updated;
        });
    };

    const handleClearReturnStatus = () => {
        setReturnStatusFilter([]);
        setCurrentPage(1);
    };

    const handleWarehouseToggle = (wh) => {
        setWarehouseFilter(prev => {
            const exists = prev.includes(wh);
            const updated = exists ? prev.filter(s => s !== wh) : [...prev, wh];
            setCurrentPage(1);
            return updated;
        });
    };

    const handleClearWarehouses = () => {
        setWarehouseFilter([]);
        setWarehouseSearch('');
        setCurrentPage(1);
    };

    const handleBrandToggle = (brand) => {
        setBrandFilter(prev => {
            const exists = prev.includes(brand);
            const updated = exists ? prev.filter(s => s !== brand) : [...prev, brand];
            setCurrentPage(1);
            return updated;
        });
    };

    const handleClearBrands = () => {
        setBrandFilter([]);
        setBrandSearch('');
        setCurrentPage(1);
    };

    const handleCompensationReasonToggle = (reason) => {
        setCompensationReasonFilter(prev => {
            const exists = prev.includes(reason);
            const updated = exists ? prev.filter(r => r !== reason) : [...prev, reason];
            setCurrentPage(1);
            return updated;
        });
    };

    const handleClearCompensationReasons = () => {
        setCompensationReasonFilter([]);
        setCompensationReasonSearch('');
        setCurrentPage(1);
    };

    const handleRecoveryReasonToggle = (reason) => {
        setRecoveryReasonFilter(prev => {
            const exists = prev.includes(reason);
            const updated = exists ? prev.filter(r => r !== reason) : [...prev, reason];
            setCurrentPage(1);
            return updated;
        });
    };

    const handleClearRecoveryReasons = () => {
        setRecoveryReasonFilter([]);
        setRecoveryReasonSearch('');
        setCurrentPage(1);
    };

    const handleSizeToggle = (size) => {
        setSizeFilter(prev => {
            const exists = prev.includes(size);
            const updated = exists ? prev.filter(r => r !== size) : [...prev, size];
            setCurrentPage(1);
            return updated;
        });
    };

    const handleClearSizes = () => {
        setSizeFilter([]);
        setSizeSearch('');
        setCurrentPage(1);
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            if (sortOrder === 'asc') setSortOrder('desc');
            else if (sortOrder === 'desc') { setSortColumn(null); setSortOrder(null); }
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    const handleQuickFilter = (month, year) => {
        const lastDay = new Date(year, month + 1, 0);
        const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        setTempStartDate(startDateStr);
        setTempEndDate(endDateStr);
        setFilterData({ ...filterData, startDate: startDateStr, endDate: endDateStr });
        setCurrentPage(1);
        onReset?.();
    };

    const handleYearClick = (year) => {
        setSelectedYear(year);
        if (selectedMonth !== null) handleQuickFilter(selectedMonth, year);
    };

    const handleMonthClick = (monthIndex) => {
        setSelectedMonth(monthIndex);
        if (selectedYear !== null) handleQuickFilter(monthIndex, selectedYear);
    };

    const handleResizeStart = (column, e) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing({ column, startX: e.clientX, startWidth: columnWidths[column] });
    };

    const handleSearchClear = () => {
        setSearchTerm('');
        onReset?.();
        setCurrentPage(1);
        searchInputRef.current?.focus();
    };

    // Column visibility / order
    const toggleColumnVisibility = (column, allColumns) => {
        if (column === 'sku' || column === 'master_sku') return;
        const currentVisible = visibleColumns[column] !== false;
        const newVisible = { ...visibleColumns, [column]: !currentVisible };
        setVisibleColumns(newVisible);
        localStorage.setItem(`${storageKey}VisibleColumns_${platformType}`, JSON.stringify(newVisible));
    };

    const selectAllColumns = (allColumns) => {
        const allVisible = {};
        allColumns.forEach(col => { allVisible[col] = true; });
        setVisibleColumns(allVisible);
        localStorage.setItem(`${storageKey}VisibleColumns_${platformType}`, JSON.stringify(allVisible));
    };

    const deselectAllColumns = (allColumns, pinnedCols = ['sku']) => {
        const onlyPinned = {};
        allColumns.forEach(col => { onlyPinned[col] = pinnedCols.includes(col); });
        setVisibleColumns(onlyPinned);
        localStorage.setItem(`${storageKey}VisibleColumns_${platformType}`, JSON.stringify(onlyPinned));
    };

    const handleColumnReorder = (draggedCols, targetCol, pinnedCols = ['sku']) => {
        const draggedArray = Array.isArray(draggedCols) ? draggedCols : [draggedCols];
        if (draggedArray.includes(targetCol) || draggedArray.some(col => pinnedCols.includes(col)) || pinnedCols.includes(targetCol)) return;

        let newOrder = [...columnOrder];
        const colsToMove = draggedArray.filter(col => newOrder.includes(col));
        if (colsToMove.length === 0) return;

        newOrder = newOrder.filter(col => !colsToMove.includes(col));

        const toIdx = newOrder.indexOf(targetCol);
        if (toIdx === -1) return;

        newOrder.splice(toIdx, 0, ...colsToMove);

        setColumnOrder(newOrder);
        localStorage.setItem(`${storageKey}ColumnOrder_v4_${platformType}`, JSON.stringify(newOrder));
        // Save the non-pinned portion to a shared key so both pages stay in sync
        const sharedOrder = newOrder.filter(col => !pinnedCols.includes(col));
        localStorage.setItem(`sharedCalculationsColumnOrder_v4_${platformType}`, JSON.stringify(sharedOrder));
    };

    const handleTableKeyDown = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const container = scrollContainerRef.current;
            if (!container) return;

            e.preventDefault();

            const ths = container.querySelectorAll('thead th');
            if (!ths || ths.length === 0) {
                container.scrollBy({ left: e.key === 'ArrowRight' ? 150 : -150, behavior: 'smooth' });
                return;
            }

            const currentScroll = container.scrollLeft;
            let nextPos = currentScroll;

            if (e.key === 'ArrowRight') {
                for (let i = 0; i < ths.length; i++) {
                    const th = ths[i];
                    if (th.offsetLeft > currentScroll + 10) {
                        nextPos = th.offsetLeft;
                        break;
                    }
                }
            } else if (e.key === 'ArrowLeft') {
                let prevPos = 0;
                for (let i = 0; i < ths.length; i++) {
                    const th = ths[i];
                    if (th.offsetLeft >= currentScroll - 10) {
                        nextPos = prevPos;
                        break;
                    }
                    prevPos = th.offsetLeft;
                }
            }

            container.scrollTo({ left: nextPos, behavior: 'smooth' });
        }
    };

    const resetColumnOrder = (allColumns) => {
        setColumnOrder(allColumns);
        localStorage.removeItem(`${storageKey}ColumnOrder_v4_${platformType}`);
        localStorage.removeItem(`sharedCalculationsColumnOrder_v4_${platformType}`);
    };
    return {
        // Filter values
        filterData, marketplaceFilter, setMarketplaceFilter,
        nullDateFilter, setNullDateFilter,
        returnStatusFilter, setReturnStatusFilter,
        warehouseFilter, setWarehouseFilter,
        dataTypeFilter, setDataTypeFilter,
        adsMode, setAdsMode,
        gstMode, setGstMode,
        shopsyFilter, setShopsyFilter,
        meeshoOrderSourceFilter, setMeeshoOrderSourceFilter,
        searchTerm, setSearchTerm,
        debouncedSearchTerm, orderSearchLoading,
        searchType, setSearchType,
        currentPage, setCurrentPage, pageSize,
        sortColumn, setSortColumn, sortOrder, setSortOrder,

        // Dates
        tempStartDate, tempEndDate, setTempStartDate, setTempEndDate,
        dateError, setDateError, getDefaultDates, setFilterData,

        // Derived booleans
        isMobile,
        isMeesho, isFlipkart, isAmazon, isMyntra, isPlatformLoaded, platformType,
        resolvedMarketplaceNames, marketplaceIdToName, marketplaceIdToPlatform,
        isMeeshoSizeDisabled,
        availableMarketplaces,

        // Filter options (fetched)
        returnStatusOptions, warehouseOptions,
        warehouseSearch, setWarehouseSearch,
        brandFilter, setBrandFilter,
        brandOptions, setBrandOptions,
        brandSearch, setBrandSearch,
        showBrandDropdown, setShowBrandDropdown,
        brandRef,
        handleBrandToggle, handleClearBrands,
        compensationReasonFilter, setCompensationReasonFilter,
        compensationReasonOptions, compensationReasonSearch, setCompensationReasonSearch,
        recoveryReasonFilter, setRecoveryReasonFilter,
        recoveryReasonOptions, recoveryReasonSearch, setRecoveryReasonSearch,
        handleRecoveryReasonToggle, handleClearRecoveryReasons,
        sizeFilter, setSizeFilter,
        sizeOptions, sizeSearch, setSizeSearch,
        handleSizeToggle, handleClearSizes,
        availableYears, availableMonths,
        selectedMonth, selectedYear,

        // Column state
        visibleColumns, setVisibleColumns,
        columnOrder, setColumnOrder,
        columnWidths, setColumnWidths,
        showColumnSelector, setShowColumnSelector,
        showAddColumnSidebar, setShowAddColumnSidebar,
        showFiltersPanel, setShowFiltersPanel,
        selectorMode, setSelectorMode,
        dragOver, setDragOver, dragItemRef,
        columnSelectorRef, returnStatusRef, warehouseRef,
        tableRef, scrollContainerRef, savedScrollPos,
        searchInputRef,
        resizing, setResizing,
        showReturnStatusDropdown, setShowReturnStatusDropdown,
        showWarehouseDropdown, setShowWarehouseDropdown,

        // Handlers
        handleApplyFilter, handleClearFilter,
        handleDateRangeChange, handleNullDateSelect,
        handleReturnStatusToggle, handleClearReturnStatus,
        handleWarehouseToggle, handleClearWarehouses,
        handleCompensationReasonToggle, handleClearCompensationReasons,
        handleRecoveryReasonToggle, handleClearRecoveryReasons,
        handleSort, handleQuickFilter, handleYearClick, handleMonthClick,
        handleResizeStart, handleSearchClear, handleTableKeyDown,
        toggleColumnVisibility, selectAllColumns, deselectAllColumns,
        handleColumnReorder, resetColumnOrder,

        // Fetch helpers (for re-use in page effects)
        fetchAvailableMonths, fetchReturnStatuses, fetchWarehouses,
    };
};

export default useCalculationsFilters;
