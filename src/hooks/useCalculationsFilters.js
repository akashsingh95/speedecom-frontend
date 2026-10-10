import { useState, useEffect, useRef, useCallback } from 'react';
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
    const [marketplaceFilter, setMarketplaceFilter] = useState(
        qsMktIds || location.filters?.marketplaceIds || location.filters?.marketplaceId || null
    );
    const [nullDateFilter, setNullDateFilter] = useState(location.filters?.nullOrderDate || false);
    const [marketplaceIdToName, setMarketplaceIdToName] = useState({});
    const [marketplaceIdToPlatform, setMarketplaceIdToPlatform] = useState({});
    const [marketplaceIdToConfig, setMarketplaceIdToConfig] = useState({});
    const [isPlatformLoaded, setIsPlatformLoaded] = useState(false);

    useEffect(() => {
        const fetchMarketplaceNames = async () => {
            try {
                const { data } = await api.get('/marketplaces/filter-options?includeInactive=true');
                const nameMap = {};
                const platformMap = {};
                const configMap = {};
                if (Array.isArray(data)) {
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
    const [showFiltersPanel, setShowFiltersPanel] = useState(true);
    const [selectorMode, setSelectorMode] = useState('reorder');
    const [columnOrder, setColumnOrder] = useState([]);
    const [dragOver, setDragOver] = useState(null);
    const dragItemRef = useRef(null);
    const columnSelectorRef = useRef(null);
    const [columnWidths, setColumnWidths] = useState({
        sku: 320, master_sku: 280, order_date: 140, total_cost: 150,
        profit_loss: 160, total_sales: 130, total_offer_amount: 150, my_share: 130, orders_settlement: 180,
        mp_fee_settlement: 180, claim_payment: 160, return_loss: 140,
        flipkart_gst_credit: 200, purchase_gst_credit: 200,
        selling_gst_debit: 190, meesho_gst_credit: 200, meesho_return_charges: 200,
        tcs_value: 130, tds_value: 130, total_quantity: 130,
        replacement_quantity: 165, delivered_quantity: 155,
        customer_return_quantity: 140, rto_quantity: 125, refund_loss_quantity: 140,
        cancel_quantity: 140, sku_wise_ads: 160, profit_loss_with_ads: 190,
        fulfilment_source: 200, return_pct: 130, rto_pct: 125, delivered_pct: 160,
        profit_pct_by_sales: 160, profit_pct_by_settlement: 200,
        avg_settlement_per_delivered: 230, profit_with_ads_per_delivered: 200,
        profit_without_ads_per_delivered: 220, sku_wise_ads_per_delivered: 200,
        return_charges_per_delivered: 230, sales_contribution: 190, profit_contribution: 200,
        amazon_charges_other: 220, gross_sales: 160, return_sales: 160,
        shipping_service: 160, amazon_gst_credit: 180, amazon_return_charges: 180,
        safety_reimbursement: 200, reimbursement: 160, seller_rewards: 160,
        payment_ads: 160, tds_reimbursement: 180, quantity: 120,
        avg_sales_per_delivered: 230, avg_purchase_per_qty: 230,
        selling_fees: 160, fba_fees: 160, other_transaction_fees: 220,
        other_fees: 160, available_gst_credit: 200,
        forward_qty: 140, forward_pct: 160, reverse_qty: 150, reverse_pct: 150, forward_auto_spf_qty: 160, forward_auto_spf_pct: 160,
        nod_qty: 120, nod_amount: 150, auto_spf_amount: 160, royalty_charges: 160,
        brand: 160, commission: 160, logistics_commission: 180,
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    }, [isPlatformLoaded, platformType]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    // Reset page when debounced search changes
    useEffect(() => { setCurrentPage(1); }, [debouncedSearchTerm]);

    // Auto-clear N/A filter when switching away from Amazon
    useEffect(() => {
        if (!isAmazon && nullDateFilter) setNullDateFilter(false);
    }, [isAmazon]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear drill-down caches when return status filter changes
    useEffect(() => { onReset?.(); }, [returnStatusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleNullDateSelect = useCallback((active) => {
        setNullDateFilter(active);
        if (active) {
            setTempStartDate('');
            setTempEndDate('');
            setFilterData(prev => ({ ...prev, startDate: null, endDate: null }));
        }
        setCurrentPage(1);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const deselectAllColumns = (allColumns, pinnedCol = 'sku') => {
        const onlyPinned = {};
        allColumns.forEach(col => { onlyPinned[col] = col === pinnedCol; });
        setVisibleColumns(onlyPinned);
        localStorage.setItem(`${storageKey}VisibleColumns_${platformType}`, JSON.stringify(onlyPinned));
    };

    const handleColumnReorder = (draggedCol, targetCol, pinnedCol = 'sku') => {
        if (draggedCol === targetCol || draggedCol === pinnedCol || targetCol === pinnedCol) return;
        const newOrder = [...columnOrder];
        const fromIdx = newOrder.indexOf(draggedCol);
        const toIdx = newOrder.indexOf(targetCol);
        if (fromIdx === -1 || toIdx === -1) return;
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, draggedCol);
        setColumnOrder(newOrder);
        localStorage.setItem(`${storageKey}ColumnOrder_v4_${platformType}`, JSON.stringify(newOrder));
        // Save the non-pinned portion to a shared key so both pages stay in sync
        const sharedOrder = newOrder.filter(col => col !== pinnedCol);
        localStorage.setItem(`sharedCalculationsColumnOrder_v4_${platformType}`, JSON.stringify(sharedOrder));
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
        currentPage, setCurrentPage, pageSize,
        sortColumn, setSortColumn, sortOrder, setSortOrder,

        // Dates
        tempStartDate, tempEndDate, setTempStartDate, setTempEndDate,
        dateError, setDateError, getDefaultDates, setFilterData,

        // Derived booleans
        isMeesho, isFlipkart, isAmazon, isMyntra, isPlatformLoaded, platformType,
        resolvedMarketplaceNames, marketplaceIdToName, marketplaceIdToPlatform,
        isMeeshoSizeDisabled,

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
        handleResizeStart, handleSearchClear,
        toggleColumnVisibility, selectAllColumns, deselectAllColumns,
        handleColumnReorder, resetColumnOrder,

        // Fetch helpers (for re-use in page effects)
        fetchAvailableMonths, fetchReturnStatuses, fetchWarehouses,
    };
};

export default useCalculationsFilters;
