import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CostSheetNotGeneratedModal from '../components/CostSheetNotGeneratedModal';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

import { Save, ArrowLeft, Loader2, AlertCircle, AlertTriangle, CheckCircle, Search, X, Plus, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Filter, Info, Calculator, Download, Check, Store } from 'lucide-react';
import { toast } from 'sonner';
import { TOUR } from '../tour/targets';
import ExportButton from '../components/ExportButton';
import MarketplaceAccountSelector from '../components/MarketplaceAccountSelector';
import Tooltip from '../components/Tooltip';
import AddColumnSidebar from '../components/calculations/AddColumnSidebar';
import CostSheetColumnFilterPopover from '../components/CostSheetColumnFilterPopover';
import { getDownloadUrl } from '../utils/exportUtils';

// Helper for custom column highlighting with harmonized color palette
const getColumnHighlightStyle = (colKey) => {
    switch (colKey) {
        case 'product_cost':
        case 'packaging_cost':
        case 'gst_percent':
        case 'return_loss_percent':
        case 'rto_packaging_loss':
        case 'claim':
        case 'claim_amount':
        case 'total_tax':
        case 'total_cost':
        case 'costing_gst':
            return {
                headerBg: 'bg-brand-600 border-brand-500 text-white font-bold',
                filterBg: 'bg-slate-200 border-slate-300',
                cellBg: 'bg-slate-200 hover:bg-slate-300/80',
                textClass: 'text-slate-900 font-bold',
                inputBorder: 'border-slate-300 focus:ring-slate-500 bg-white/90 font-bold text-slate-900'
            };
        default:
            return null;
    }
};

// Format cell values to show a single clean '0' instead of multi-digit decimals like '0.0000'
const formatCellValue = (val, colType) => {
    if (val === null || val === undefined || String(val).trim() === '') return '';
    const strVal = String(val).trim();
    if (colType === 'number' || (!isNaN(strVal) && strVal !== '')) {
        const num = Number(strVal);
        if (!isNaN(num)) {
            if (num === 0) return '0';
            return String(num);
        }
    }
    return val;
};

const CostSheet = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [costSheetData, setCostSheetData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtering, setFiltering] = useState(false); // Separate state for filter loading
    const [saving, setSaving] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [calcProgress, setCalcProgress] = useState(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editedRows, setEditedRows] = useState(new Set());
    const [columnWidths, setColumnWidths] = useState({});
    const resizingColumn = useRef(null);
    const startX = useRef(0);
    const startWidth = useRef(0);
    const [canCalculate, setCanCalculate] = useState(true);
    const [canCalculateReason, setCanCalculateReason] = useState('');

    const [missingModal, setMissingModal] = useState({ open: false, count: 0, skus: [] });
    const [notGeneratedModal, setNotGeneratedModal] = useState(false);
    const [isGeneratingCostSheet, setIsGeneratingCostSheet] = useState(false);
    const [staleModal, setStaleModal] = useState({
        open: false,
        lastUploadDate: null,
        lastCostsheetDate: null,
    });
    const [unsavedModal, setUnsavedModal] = useState({
        open: false,
        targetType: null, // 'page' | 'sort' | 'back' | 'action'
        targetPage: null,
        targetSortColumn: null,
        targetSortOrder: null,
        actionCallback: null
    });

    const withUnsavedWarning = (action) => {
        if (editedRows.size > 0) {
            setUnsavedModal({
                open: true,
                targetType: 'action',
                targetPage: null,
                targetSortColumn: null,
                targetSortOrder: null,
                actionCallback: action
            });
        } else {
            action();
        }
    };
    // Tracks whether saved cost sheet changes have not yet been run through Calculate
    const [pendingCalculation, setPendingCalculation] = useState(false);
    const [calculatePromptModal, setCalculatePromptModal] = useState({ open: false });
    const navigateAfterCalculateRef = useRef(false);
    // Whether the calculation currently in progress is a full recalculate (triggered
    // because saved changes were pending) vs a plain calculate — drives the button label.
    const [isRecalculateRun, setIsRecalculateRun] = useState(false);
    const calculationIntervalRef = useRef(null);

    // Undo (Ctrl+Z) history — snapshots of costSheetData/editedRows taken before each edit
    const undoStackRef = useRef([]);
    const lastEditKeyRef = useRef(null);
    const UNDO_STACK_LIMIT = 50;

    // Drag-to-fill state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartCell, setDragStartCell] = useState(null); // { rowIndex, columnKey, value }
    const [dragEndCell, setDragEndCell] = useState(null);
    const [dragPreview, setDragPreview] = useState(null); // { minRow, maxRow, minColIdx, maxColIdx } | null

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [pageLimit] = useState(100); // Fixed page size

    // Columns Manager State
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [selectorMode, setSelectorMode] = useState('reorder');
    const [visibleColumns, setVisibleColumns] = useState({});
    const [columnOrder, setColumnOrder] = useState([]);
    const [dragOver, setDragOver] = useState(null);
    const dragItemRef = useRef(null);
    const columnSelectorRef = useRef(null);

    // Hide column selector on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
                setShowColumnSelector(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setIsLargeScreen(window.innerWidth >= 1200);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Poll (not just check once) so that once Credit Calculate finishes on the backend,
    // the Calculate button here flips to enabled on its own — no page refresh needed.
    useEffect(() => {
        let intervalId = null;

        const checkCanCalculate = async () => {
            try {
                const response = await api.get('/credits/can-calculate');
                const data = response.data?.data !== undefined ? response.data.data : response.data;
                if (data) {
                    const nowCanCalculate = data.canCalculate !== false;
                    setCanCalculate(nowCanCalculate);
                    setCanCalculateReason(data.reason || '');
                    setCreditBalance(data.balance !== undefined ? data.balance : null);
                    if (nowCanCalculate && intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                }
            } catch (err) {
                console.error('Error checking can-calculate status in CostSheet:', err);
            }
        };

        checkCanCalculate();
        intervalId = setInterval(checkCanCalculate, 30000);

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    // Extract unique sizes from current cost sheet data to populate the dropdown
    const availableSizes = React.useMemo(() => {
        const sizes = new Set();
        costSheetData.forEach(row => {
            if (row.size && row.size.trim() !== '') {
                sizes.add(row.size.trim());
            }
        });
        return Array.from(sizes).sort();
    }, [costSheetData]);

    // Filter state (unified for all columns)
    const [columnFilters, setColumnFilters] = useState({});

    // Parse query params (used when opening in a new tab)
    const searchParams = new URLSearchParams(location.search);
    let qsMktIds = null;
    let qsMktNames = null;
    try {
        if (searchParams.get('marketplaceIds')) qsMktIds = JSON.parse(searchParams.get('marketplaceIds'));
        if (searchParams.get('marketplaceNames')) qsMktNames = JSON.parse(searchParams.get('marketplaceNames'));
    } catch (e) { }

    // Support both single marketplaceId and array of marketplaceIds passed from dashboard
    const passedMktIds = qsMktIds || location.state?.filters?.marketplaceIds;
    const passedMktId = location.state?.filters?.marketplaceId;
    const passedMktNames = qsMktNames || location.state?.filters?.marketplaceNames || [];

    // Resolve to an array of IDs and build an id→name lookup map
    const _savedMktFilters = (() => {
        try {
            const raw = localStorage.getItem('cost_sheet_marketplace_filters');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    })();

    // Stale navigation state check: If we have saved filters and no explicit qs query params, prefer saved filters
    const _resolvedMktIds = (Array.isArray(passedMktIds) && passedMktIds.length > 0)
        ? passedMktIds
        : (passedMktId ? [passedMktId] : (Array.isArray(_savedMktFilters) && _savedMktFilters.length > 0 ? _savedMktFilters : []));
    const _resolvedNamesMap = {};
    _resolvedMktIds.forEach((id, i) => { _resolvedNamesMap[id] = passedMktNames[i] || id; });

    const [marketplaceFilters, setMarketplaceFilters] = useState(_resolvedMktIds);  // array of ids
    const [marketplaceNamesMap, setMarketplaceNamesMap] = useState(_resolvedNamesMap); // {id: name}

    // Save marketplaceFilters to localStorage whenever it changes
    useEffect(() => {
        if (Array.isArray(marketplaceFilters) && marketplaceFilters.length > 0) {
            localStorage.setItem('cost_sheet_marketplace_filters', JSON.stringify(marketplaceFilters));
        }
    }, [marketplaceFilters]);

    // Clear stale location.state history so page reload doesn't revert to old navigation state
    useEffect(() => {
        if (location.state?.filters) {
            try {
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            } catch (e) {}
        }
    }, []);
    const [showActiveAccountsPopover, setShowActiveAccountsPopover] = useState(false);
    const [accountSearchQuery, setAccountSearchQuery] = useState('');
    const accountsPopoverRef = useRef(null);
    const debounceTimer = useRef(null);
    const tableContainerRef = useRef(null);
    const autoScrollRaf = useRef(null);

    // Close accounts popover on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (accountsPopoverRef.current && !accountsPopoverRef.current.contains(e.target)) {
                setShowActiveAccountsPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Utility: first marketplace id (for backward-compat with add-new form)
    const primaryMarketplaceId = marketplaceFilters[0] || null;

    // Sorting state
    const [sortColumn, setSortColumn] = useState(null);
    const [sortOrder, setSortOrder] = useState(null);

    // Add new SKU state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSkuData, setNewSkuData] = useState({
        sku: '',
        size: '',
        product_name: '',
        selling_gst: '',
        date: '2020-01-01',
        product_cost: '',
        packaging_cost: '',
        gst_percent: '0',
        packaging_gst_percent: '',
        is_product_cost_with_gst: false,
        return_loss_percent: '',
        rto_packaging_loss: '',
        weight_slab: '',
        marketplace_id: primaryMarketplaceId || ''
    });
    const [addingNew, setAddingNew] = useState(false);

    // Marketplace dropdown filter state
    const [availableMarketplaces, setAvailableMarketplaces] = useState([]);

    const fetchMarketplaces = async () => {
        try {
            const { data } = await api.get('/marketplaces/filter-options');
            setAvailableMarketplaces(data);

            const fullNamesMap = { ...marketplaceNamesMap };
            const allAccountIds = [];
            data.forEach(mp => {
                mp.accounts?.forEach(acc => {
                    fullNamesMap[acc._id] = acc.name;
                    allAccountIds.push(acc._id);
                });
            });
            setMarketplaceNamesMap(fullNamesMap);

            const validCurrentFilters = (marketplaceFilters || []).filter(id => allAccountIds.includes(id));
            if (validCurrentFilters.length > 0) {
                if (validCurrentFilters.length !== (marketplaceFilters || []).length) {
                    setMarketplaceFilters(validCurrentFilters);
                }
            } else if (allAccountIds.length > 0) {
                const raw = localStorage.getItem('cost_sheet_marketplace_filters');
                let saved = [];
                try {
                    saved = raw ? JSON.parse(raw) : [];
                } catch (e) {}
                const validSaved = saved.filter(id => allAccountIds.includes(id));
                if (validSaved.length > 0) {
                    setMarketplaceFilters(validSaved);
                } else {
                    const firstActiveAcc = (data[0]?.accounts || []).find(a => a.status !== 'inactive') || data[0]?.accounts?.[0];
                    setMarketplaceFilters(firstActiveAcc ? [firstActiveAcc._id] : (allAccountIds.length > 0 ? [allAccountIds[0]] : []));
                }
            }
        } catch (error) {
            console.error('Error fetching marketplaces for filter:', error);
        }
    };

    const checkCostSheetStatus = async (mktIds) => {
        const ids = mktIds || marketplaceFilters;
        if (!ids || ids.length === 0) return;
        try {
            const res = await api.get(`/cost-sheet/status?marketplaceIds=${encodeURIComponent(JSON.stringify(ids))}`);
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            if (data?.isStale) {
                setStaleModal({
                    open: true,
                    lastUploadDate: data.lastUploadDate || null,
                    lastCostsheetDate: data.lastCostsheetDate || null,
                });
            }
        } catch (err) {
            console.warn('[CostSheet] stale-check failed:', err.message);
        }
    };

    useEffect(() => {
        fetchMarketplaces();
        fetchCostSheet(1, true);
        loadColumnWidths();
        
        if (marketplaceFilters && marketplaceFilters.length > 0) {
            checkCostSheetStatus(marketplaceFilters);
        }
        return () => {
            if (calculationIntervalRef.current) {
                clearInterval(calculationIntervalRef.current);
            }
        };
    }, []);

    // A calculation started from Payments/Calculations (or another tab) may already be
    // running for this tenant — reflect that on the Calculate button instead of letting
    // the user think they're free to start another one. Guarded by calculationIntervalRef
    // so it never stomps a poll this page is already driving.
    const checkActiveCalculation = async () => {
        if (calculationIntervalRef.current) return;
        try {
            const res = await api.get('/payments/calculate/active');
            const activeCalc = res.data?.data !== undefined ? res.data.data : res.data;
            if (activeCalc?.calculationId && ['pending', 'processing'].includes(activeCalc.status)) {
                setCalculating(true);
                setCalcProgress(activeCalc.progress || 0);
                startCalculationPolling(activeCalc.calculationId, { navigateOnComplete: false });
            }
        } catch (err) {
            // No active calculation to resume, or the check failed transiently — nothing to do.
        }
    };

    useEffect(() => {
        checkActiveCalculation();
    }, []);

    // Step 3 / Payments run in the same tab or a different one — either way, a calculation
    // started or completed there can't push a live update into this page's cached state.
    // Re-check on focus (covers a different tab/window) and re-check anytime this browser
    // fires the 'active_calculation_event' storage signal (another tab just started one —
    // instant, not waiting for the user to refocus), so the Calculate button's disabled
    // state + tooltip reflect the real cross-entry-point status without a manual refresh.
    // (Both calls go through refs so they always run the latest closures, not the ones
    // captured when this effect first mounted — both are recreated every render and read
    // current marketplaceFilters/marketplaceNamesMap/calculating state.)
    const fetchMarketplacesRef = useRef(fetchMarketplaces);
    const checkActiveCalculationRef = useRef(checkActiveCalculation);
    useEffect(() => {
        fetchMarketplacesRef.current = fetchMarketplaces;
        checkActiveCalculationRef.current = checkActiveCalculation;
    });
    useEffect(() => {
        const handleFocus = () => {
            if (document.visibilityState === 'visible') {
                fetchMarketplacesRef.current();
                checkActiveCalculationRef.current();
            }
        };
        const handleStorageChange = (e) => {
            if (e.key === 'active_calculation_event' && e.newValue) {
                checkActiveCalculationRef.current();
            }
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleFocus);
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleFocus);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        if (loading) return;
        fetchCostSheet(1, false);
        checkCostSheetStatus(marketplaceFilters);
    }, [marketplaceFilters, columnFilters]);

    // Live "does this account still need a recalculation" flag, sourced from the same
    // Marketplace.requiresRecalculation field Step 3 and Payments read. This is a one-time
    // trigger owned by the admin "flag for recalculation" action, so it — not the local
    // pendingCalculation flag (which just tracks "saved but not yet Calculated" for the
    // leave-page reminder) — is what decides the Calculate/Recalculate button label and
    // whether a run uses mode: 'full'. Otherwise every routine cost sheet save would flip
    // the button to Recalculate.
    const selectedAccountRequiresRecalc = marketplaceFilters.length === 1
        ? !!availableMarketplaces.flatMap(mp => mp.accounts || []).find(a => a._id === marketplaceFilters[0])?.requiresRecalculation
        : false;
    const needsRecalculate = selectedAccountRequiresRecalc;

    const loadColumnWidths = () => {
        const savedWidths = localStorage.getItem('costSheetColumnWidths');
        if (savedWidths) {
            setColumnWidths(JSON.parse(savedWidths));
        } else {
            setColumnWidths({
                'account_name': 200,
                'style_id': 160,
                'sku': 250,
                'size': 120,
                'product_name': 250,
                'selling_gst': 120,
                'date': 140,
                'product_cost': 130,
                'packaging_cost': 140,
                'gst_percent': 120,
                'packaging_gst_percent': 160,
                'claim': 120,
                'is_product_cost_with_gst': 150,
                'return_loss_percent': 150,
                'rto_packaging_loss': 160,
                'weight_slab': 130,
                'total_tax': 110,
                'total_cost': 110
            });
        }
    };

    const saveColumnWidths = (widths) => {
        localStorage.setItem('costSheetColumnWidths', JSON.stringify(widths));
    };

    // Column resize handlers
    const handleResizeStart = (e, columnKey) => {
        resizingColumn.current = columnKey;
        startX.current = e.clientX;
        startWidth.current = columnWidths[columnKey] || 150;

        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
        e.preventDefault();
    };

    const handleResizeMove = (e) => {
        if (!resizingColumn.current) return;

        const diff = e.clientX - startX.current;
        const newWidth = Math.max(80, startWidth.current + diff);

        setColumnWidths(prev => {
            const updated = { ...prev, [resizingColumn.current]: newWidth };
            return updated;
        });
    };

    const handleResizeEnd = () => {
        if (resizingColumn.current) {
            saveColumnWidths(columnWidths);
            resizingColumn.current = null;
        }
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
    };

    // Drag-to-fill handlers
    const handleFillHandleMouseDown = (e, rowIndex, columnKey) => {
        e.preventDefault();
        e.stopPropagation();
        const col = orderedVisibleColumns.find(c => c.key === columnKey);
        if (!col || !col.editable) return;
        const colIndex = orderedVisibleColumns.findIndex(c => c.key === columnKey);

        setIsDragging(true);
        setDragStartCell({ rowIndex, colIndex, columnKey, value: costSheetData[rowIndex][columnKey] });
        setDragEndCell({ rowIndex, colIndex, columnKey });
        setDragPreview({ minRow: rowIndex, maxRow: rowIndex, minColIdx: colIndex, maxColIdx: colIndex });
    };

    const handleCellMouseDown = (e, rowIndex, columnKey) => {
        if (e.target !== e.currentTarget) return;
        handleFillHandleMouseDown(e, rowIndex, columnKey);
    };

    const handleCellMouseEnter = (rowIndex, columnKey) => {
        if (!isDragging || !dragStartCell) return;

        const colIndex = orderedVisibleColumns.findIndex(c => c.key === columnKey);
        if (colIndex === -1) return;

        setDragEndCell({ rowIndex, colIndex, columnKey });
        setDragPreview({
            minRow: Math.min(dragStartCell.rowIndex, rowIndex),
            maxRow: Math.max(dragStartCell.rowIndex, rowIndex),
            minColIdx: Math.min(dragStartCell.colIndex, colIndex),
            maxColIdx: Math.max(dragStartCell.colIndex, colIndex),
        });
    };

    const handleMouseUp = () => {
        if (isDragging && dragStartCell && dragPreview) {
            const { minRow, maxRow, minColIdx, maxColIdx } = dragPreview;

            if (maxRow > minRow || maxColIdx > minColIdx) {
                pushUndoSnapshot();
                lastEditKeyRef.current = null;
            }

            const updatedData = [...costSheetData];
            const calculatedFields = ['product_cost', 'packaging_cost', 'gst_percent', 'packaging_gst_percent',
                'is_product_cost_with_gst', 'return_loss_percent', 'rto_packaging_loss'];

            const anchorRow = dragStartCell.rowIndex;
            for (let colIdx = minColIdx; colIdx <= maxColIdx; colIdx++) {
                const col = orderedVisibleColumns[colIdx];
                if (!col || !col.editable) continue;
                const sourceValue = costSheetData[anchorRow][col.key];

                for (let i = minRow; i <= maxRow; i++) {
                    if (i === anchorRow) continue;
                    updatedData[i] = { ...updatedData[i], [col.key]: sourceValue };
                    if (calculatedFields.includes(col.key)) {
                        const totals = calculateTotals(updatedData[i]);
                        updatedData[i].total_tax = totals.total_tax;
                        updatedData[i].total_cost = totals.total_cost;
                    }
                    setEditedRows(prev => new Set([...prev, i]));
                }
            }

            setCostSheetData(updatedData);
        }

        setIsDragging(false);
        setDragStartCell(null);
        setDragEndCell(null);
        setDragPreview(null);
    };

    // Auto-scroll while dragging near container edges
    const EDGE_THRESHOLD = 40;
    const AUTO_SCROLL_SPEED = 15;

    const startAutoScroll = useRef(null);
    const startAutoScrollX = useRef(null);
    const doAutoScrollRef = useRef(null);

    doAutoScrollRef.current = () => {
        const dirY = startAutoScroll.current;
        const dirX = startAutoScrollX.current;
        const container = tableContainerRef.current;
        if ((!dirY && !dirX) || !container) {
            autoScrollRaf.current = null;
            return;
        }
        if (dirY) container.scrollTop += dirY === 'down' ? AUTO_SCROLL_SPEED : -AUTO_SCROLL_SPEED;
        if (dirX) container.scrollLeft += dirX === 'right' ? AUTO_SCROLL_SPEED : -AUTO_SCROLL_SPEED;
        updateDragRowFromMouse();
        autoScrollRaf.current = requestAnimationFrame(doAutoScrollRef.current);
    };

    const doAutoScroll = () => doAutoScrollRef.current();

    const updateDragRowFromMouse = () => {
        if (!dragStartCell) return;
        const mx = lastMousePos.current?.x;
        const my = lastMousePos.current?.y;
        if (mx == null || my == null) return;
        const el = document.elementFromPoint(mx, my);
        if (!el) return;
        const tr = el.closest('tr');
        if (!tr) return;
        const ri = parseInt(tr.dataset.rowIndex, 10);
        const td = el.closest('td[data-col-key]');
        const colKey = td?.dataset.colKey || dragStartCell.columnKey;
        if (!isNaN(ri)) handleCellMouseEnter(ri, colKey);
    };

    const lastMousePos = useRef({ x: 0, y: 0 });

    const handleDragMouseMove = (e) => {
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        if (!dragStartCell || !tableContainerRef.current) return;

        const container = tableContainerRef.current;
        const rect = container.getBoundingClientRect();
        const mouseY = e.clientY;
        const mouseX = e.clientX;

        if (mouseY < rect.top + EDGE_THRESHOLD) {
            startAutoScroll.current = 'up';
        } else if (mouseY > rect.bottom - EDGE_THRESHOLD) {
            startAutoScroll.current = 'down';
        } else {
            startAutoScroll.current = null;
        }

        if (mouseX < rect.left + EDGE_THRESHOLD) {
            startAutoScrollX.current = 'left';
        } else if (mouseX > rect.right - EDGE_THRESHOLD) {
            startAutoScrollX.current = 'right';
        } else {
            startAutoScrollX.current = null;
        }

        if ((startAutoScroll.current || startAutoScrollX.current) && !autoScrollRaf.current) {
            doAutoScroll();
        }

        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        const tr = el.closest('tr');
        if (!tr) return;
        const ri = parseInt(tr.dataset.rowIndex, 10);
        const td = el.closest('td[data-col-key]');
        const colKey = td?.dataset.colKey || dragStartCell.columnKey;
        if (!isNaN(ri)) handleCellMouseEnter(ri, colKey);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('mousemove', handleDragMouseMove);
            return () => {
                document.removeEventListener('mouseup', handleMouseUp);
                document.removeEventListener('mousemove', handleDragMouseMove);
                startAutoScroll.current = null;
                startAutoScrollX.current = null;
                if (autoScrollRaf.current) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null; }
            };
        }
    }, [isDragging, dragStartCell, dragEndCell, costSheetData]);

    const fetchCostSheet = async (page = 1, isInitialLoad = false, newSortColumn = sortColumn, newSortOrder = sortOrder) => {
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setFiltering(true);
        }

        if (!marketplaceFilters || marketplaceFilters.length === 0) {
            setCostSheetData([]);
            setTotalRows(0);
            setTotalPages(1);
            undoStackRef.current = [];
            lastEditKeyRef.current = null;
            if (isInitialLoad) setLoading(false);
            setFiltering(false);
            return;
        }

        let effectiveMarketplaceIds = marketplaceFilters;
        if (columnFilters.account_name && columnFilters.account_name.length > 0) {
            // Since account_name isn't a column in cost_sheet table, we filter marketplaceIds
            effectiveMarketplaceIds = marketplaceFilters.filter(id => {
                const name = marketplaceNamesMap[id] || id;
                return columnFilters.account_name.includes(name) || columnFilters.account_name.includes(id);
            });
        }

        if (effectiveMarketplaceIds.length === 0) {
            setCostSheetData([]);
            setTotalRows(0);
            setTotalPages(1);
            setCurrentPage(1);
            setEditedRows(new Set());
            undoStackRef.current = [];
            lastEditKeyRef.current = null;
            if (isInitialLoad) setLoading(false);
            setFiltering(false);
            return;
        }

        setError('');
        try {
            const payload = {
                page: page,
                limit: pageLimit,
            };
            
            // Build filters payload, excluding account_name as it's handled above
            const backendFilters = {};
            for (const [key, values] of Object.entries(columnFilters)) {
                if (key !== 'account_name' && values && values.length > 0) {
                    backendFilters[key] = values;
                }
            }
            if (Object.keys(backendFilters).length > 0) {
                payload.filters = backendFilters;
            }

            if (effectiveMarketplaceIds.length > 0) {
                payload.marketplaceIds = effectiveMarketplaceIds;
            }
            if (newSortColumn && newSortOrder) {
                payload.sortBy = newSortColumn;
                payload.sortOrder = newSortOrder;
            }

            const response = await api.post('/cost-sheet/query', payload);

            const rows = (response.data || []).map(row => {
                const hasCostData = row.product_cost || row.packaging_cost;
                if (hasCostData) {
                    const totals = calculateTotals(row);
                    return { ...row, total_tax: totals.total_tax, total_cost: totals.total_cost };
                }
                return row;
            });

            // Default sort: place blank, null, or 0 product_cost SKUs at the top
            if (!newSortColumn) {
                rows.sort((a, b) => {
                    const aMissing = a.product_cost === null || a.product_cost === undefined || String(a.product_cost).trim() === '' || Number(a.product_cost) === 0;
                    const bMissing = b.product_cost === null || b.product_cost === undefined || String(b.product_cost).trim() === '' || Number(b.product_cost) === 0;
                    if (aMissing && !bMissing) return -1;
                    if (!aMissing && bMissing) return 1;
                    return 0;
                });
            }

            setCostSheetData(rows);

            if (response.pagination) {
                setCurrentPage(response.pagination.page);
                setTotalPages(response.pagination.total_pages);
                setTotalRows(response.pagination.total_rows);
            }

            setEditedRows(new Set());
            undoStackRef.current = [];
            lastEditKeyRef.current = null;
        } catch (error) {
            setError('Failed to load cost sheet data');
        } finally {
            if (isInitialLoad) {
                setLoading(false);
            } else {
                setFiltering(false);
            }
        }
    };

    // Calculate total tax and total cost
    const calculateTotals = (row) => {
        const productCost = parseFloat(row.product_cost) || 0;
        const packagingCost = parseFloat(row.packaging_cost) || 0;
        const gstPercent = parseFloat(String(row.gst_percent ?? '').replace('%', '')) || 0;
        const packagingGstPercent = parseFloat(String(row.packaging_gst_percent ?? '').replace('%', '')) || 0;
        const isProductCostWithGst = row.is_product_cost_with_gst === 'y' || row.is_product_cost_with_gst === 'Yes' || String(row.is_product_cost_with_gst || '').toLowerCase() === 'y';
        const returnLossPercent = parseFloat(row.return_loss_percent) || 0;
        const rtoPackagingLoss = parseFloat(row.rto_packaging_loss) || 0;

        let totalTax = 0;
        let totalCost = 0;

        if (isProductCostWithGst) {
            totalTax = (productCost - productCost / (1 + gstPercent / 100))
                + (packagingCost - packagingCost / (1 + packagingGstPercent / 100));
            totalCost = productCost + packagingCost;
        } else {
            totalTax = productCost * (gstPercent / 100) + packagingCost * (packagingGstPercent / 100);
            totalCost = productCost + packagingCost + totalTax;
        }

        return {
            total_tax: totalTax.toFixed(2),
            total_cost: totalCost.toFixed(2)
        };
    };

    // Undo snapshot
    const pushUndoSnapshot = () => {
        undoStackRef.current.push({
            data: costSheetData.map(row => ({ ...row })),
            editedRows: new Set(editedRows),
        });
        if (undoStackRef.current.length > UNDO_STACK_LIMIT) {
            undoStackRef.current.shift();
        }
    };

    const handleUndo = () => {
        if (undoStackRef.current.length === 0) return;
        const prev = undoStackRef.current.pop();
        setCostSheetData(prev.data);
        setEditedRows(prev.editedRows);
        lastEditKeyRef.current = null;
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            const isUndoShortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
            if (!isUndoShortcut) return;

            const tag = e.target.tagName;
            const isTypingField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
            const isTableCell = e.target.closest('td[data-col-key]');
            if (isTypingField && !isTableCell) return;

            e.preventDefault();
            handleUndo();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle cell value change
    const handleCellChange = (rowIndex, field, value) => {
        const editKey = `${rowIndex}:${field}`;
        if (lastEditKeyRef.current !== editKey) {
            pushUndoSnapshot();
            lastEditKeyRef.current = editKey;
        }

        const updatedData = [...costSheetData];
        updatedData[rowIndex] = {
            ...updatedData[rowIndex],
            [field]: value
        };

        const calculatedFields = ['product_cost', 'packaging_cost', 'gst_percent', 'packaging_gst_percent',
            'is_product_cost_with_gst', 'return_loss_percent', 'rto_packaging_loss'];

        if (calculatedFields.includes(field)) {
            const totals = calculateTotals(updatedData[rowIndex]);
            updatedData[rowIndex].total_tax = totals.total_tax;
            updatedData[rowIndex].total_cost = totals.total_cost;
        }

        setCostSheetData(updatedData);
        setEditedRows(prev => new Set([...prev, rowIndex]));
    };

    // Helper to perform save API call and return success boolean
    const saveEditedRows = async () => {
        if (editedRows.size === 0) return true;
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const rowsToUpdate = Array.from(editedRows).map(index => {
                const row = costSheetData[index];
                const totals = calculateTotals(row);
                return {
                    ...row,
                    total_tax: totals.total_tax,
                    total_cost: totals.total_cost
                };
            });

            const { data } = await api.put('/cost-sheet', {
                rows: rowsToUpdate
            });

            if (data && data.updated_count !== undefined) {
                toast.success(`Successfully updated ${data.updated_count} rows`);
                setEditedRows(new Set());
                setPendingCalculation(true);
                return true;
            }
            return false;
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to update cost sheet');
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Save updated cost sheet
    const handleSave = async () => {
        if (editedRows.size === 0) {
            setError('No changes to save');
            return;
        }
        const ok = await saveEditedRows();
        if (ok) {
            setTimeout(() => {
                fetchCostSheet(currentPage, false);
                setSuccess('');
            }, 2000);
        }
    };

    // Unsaved Modal Action Handlers
    const handleModalSave = async () => {
        const ok = await saveEditedRows();
        if (ok) {
            const { targetType, targetPage, targetSortColumn, targetSortOrder, actionCallback } = unsavedModal;
            setUnsavedModal({ open: false, targetType: null, targetPage: null, targetSortColumn: null, targetSortOrder: null, actionCallback: null });
            if (targetType === 'page') {
                setCurrentPage(targetPage);
                fetchCostSheet(targetPage, false);
            } else if (targetType === 'sort') {
                setSortColumn(targetSortColumn);
                setSortOrder(targetSortOrder);
                setCurrentPage(1);
                fetchCostSheet(1, false, targetSortColumn, targetSortOrder);
            } else if (targetType === 'back') {
                // Changes were just saved — remind the user to run Calculate before leaving.
                // Never prompt when credits won't allow a calculation anyway (insufficient
                // balance, or credits/uploads still processing) — there'd be nothing the
                // user could actually do from that modal.
                if (canCalculate) {
                    setCalculatePromptModal({ open: true });
                } else {
                    navigate('/dashboard', { state: { activeTab: 'payments' } });
                }
            } else if (targetType === 'action' && actionCallback) {
                actionCallback();
            }
        }
    };

    const handleModalDontSave = () => {
        const { targetType, targetPage, targetSortColumn, targetSortOrder, actionCallback } = unsavedModal;
        setEditedRows(new Set());
        setUnsavedModal({ open: false, targetType: null, targetPage: null, targetSortColumn: null, targetSortOrder: null, actionCallback: null });

        if (targetType === 'page') {
            setCurrentPage(targetPage);
            fetchCostSheet(targetPage, false);
        } else if (targetType === 'sort') {
            setSortColumn(targetSortColumn);
            setSortOrder(targetSortOrder);
            setCurrentPage(1);
            fetchCostSheet(1, false, targetSortColumn, targetSortOrder);
        } else if (targetType === 'back') {
            // Discarding these edits doesn't clear an earlier save that's still uncalculated.
            if (pendingCalculation && canCalculate) {
                setCalculatePromptModal({ open: true });
            } else {
                navigate('/dashboard', { state: { activeTab: 'payments' } });
            }
        } else if (targetType === 'action' && actionCallback) {
            actionCallback();
        }
    };

    const handleBack = () => {
        if (editedRows.size > 0) {
            setUnsavedModal({
                open: true,
                targetType: 'back',
                targetPage: null,
                targetSortColumn: null,
                targetSortOrder: null
            });
            return;
        }
        if (pendingCalculation && canCalculate) {
            setCalculatePromptModal({ open: true });
            return;
        }
        navigate('/dashboard', { state: { activeTab: 'payments' } });
    };

    const handleCalculatePromptCancel = () => {
        setCalculatePromptModal({ open: false });
        navigate('/dashboard', { state: { activeTab: 'payments' } });
    };

    const handleCalculatePromptCalculate = () => {
        setCalculatePromptModal({ open: false });
        navigateAfterCalculateRef.current = true;
        handleCalculate();
    };

    const handleCalculate = async () => {
        setError('');
        setSuccess('');

        try {
            const mpParam = marketplaceFilters.length > 0 ? JSON.stringify(marketplaceFilters) : '';
            const checkRes = await api.get(`/cost-sheet/check-missing?marketplaceIds=${encodeURIComponent(mpParam)}`);
            const missingCount = checkRes.data?.missingCount || 0;
            const missingSkus = checkRes.data?.missingSkus || [];

            if (checkRes.data?.isCostSheetGenerated === false) {
                setNotGeneratedModal(true);
                return;
            }

            if (missingCount > 0) {
                setMissingModal({ open: true, count: missingCount, skus: missingSkus });
                return;
            }

            await doActualCalculate();
        } catch (err) {
            console.error('Error checking missing costs before calculation:', err);
            await doActualCalculate();
        }
    };

    // Clears the locally-cached requiresRecalculation flag for the selected account so
    // the "Recalculate" -> "Calculate" button label flips back immediately, without
    // waiting for a full refetch of /marketplaces/filter-options.
    const clearLocalRecalcFlag = () => {
        setAvailableMarketplaces(prev => prev.map(mp => ({
            ...mp,
            accounts: (mp.accounts || []).map(acc =>
                marketplaceFilters.includes(acc._id)
                    ? { ...acc, requiresRecalculation: false }
                    : acc
            )
        })));
    };

    const doActualCalculate = async () => {
        setMissingModal({ open: false, count: 0, skus: [] });
        setCalculating(true);
        setIsRecalculateRun(needsRecalculate);
        setError('');
        setSuccess('');

        try {
            // A save just flagged this account as needing recalculation, or it was
            // already flagged from another entry point — run a full recalculation so
            // edited costs are fully reflected and the pending flag clears.
            const res = await api.post('/payments/calculate', {
                marketplaceIds: marketplaceFilters,
                ...(needsRecalculate ? { mode: 'full' } : {})
            });
            const calcObj = res.data?.data !== undefined ? res.data.data : res.data;
            const calcId = calcObj?.calculationId || calcObj?._id || res.data?.calculationId;

            if (calcObj?.alreadyUpToDate) {
                // Another entry point (Step 3 / Payments) already completed the
                // recalculation in the meantime — don't run it again.
                setCalculating(false);
                setPendingCalculation(false);
                setIsRecalculateRun(false);
                clearLocalRecalcFlag();
                toast.success('Calculations are already up to date!');
                if (navigateAfterCalculateRef.current) {
                    navigateAfterCalculateRef.current = false;
                    const qs = marketplaceFilters.length > 0
                        ? `?tab=payments&highlightAccounts=${encodeURIComponent(JSON.stringify(marketplaceFilters))}`
                        : `?tab=payments`;
                    navigate(`/dashboard${qs}`, { state: { activeTab: 'payments', highlightAccounts: marketplaceFilters } });
                }
                return;
            }

            if (calcId) {
                setPendingCalculation(false);
                try {
                    localStorage.setItem('active_calculation_event', JSON.stringify({
                        calculationId: calcId,
                        timestamp: Date.now()
                    }));
                } catch (_) { }
                // Don't navigate yet — the calculation just started, it hasn't finished.
                // startCalculationPolling's own completion handler (navigateOnComplete
                // defaults to true) is what takes the user to Payments, and only once the
                // job actually reaches 'completed' (plus its 2s settle delay). Navigating
                // here too would leave the calculation still running in the background
                // while the user is already looking at a report that isn't ready yet.
                navigateAfterCalculateRef.current = false;
                startCalculationPolling(calcId);
            } else {
                setError('Failed to start calculations');
                setCalculating(false);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to calculate');
            setCalculating(false);
        }
    };

    // navigateOnComplete=false is used when we merely detected an already-running
    // calculation (started from another tab/page) on mount — we still want the button
    // to reflect progress and flip back to "Calculate" when done, but without yanking
    // the user away from the page for a calculation they didn't just trigger here.
    const startCalculationPolling = (calculationId, { navigateOnComplete = true } = {}) => {
        if (calculationIntervalRef.current) clearInterval(calculationIntervalRef.current);
        calculationIntervalRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/payments/calculate/${calculationId}`);
                const calcData = res.data?.data !== undefined ? res.data.data : res.data;
                if (calcData?.progress !== undefined) setCalcProgress(calcData.progress);
                if (calcData?.status === 'completed') {
                    clearInterval(calculationIntervalRef.current);
                    calculationIntervalRef.current = null;
                    setCalculating(false);
                    setPendingCalculation(false);
                    setIsRecalculateRun(false);
                    // Mirrors the backend: requiresRecalculation is only cleared for a full recalc.
                    if (calcData?.mode === 'full') clearLocalRecalcFlag();
                    toast.success('Calculations completed successfully!');

                    if (navigateOnComplete) {
                        setTimeout(() => {
                            const qs = marketplaceFilters.length > 0
                                ? `?tab=payments&highlightAccounts=${encodeURIComponent(JSON.stringify(marketplaceFilters))}`
                                : `?tab=payments`;
                            navigate(`/dashboard${qs}`, { state: { activeTab: 'payments', highlightAccounts: marketplaceFilters } });
                        }, 2000);
                    }
                } else if (calcData?.status === 'failed') {
                    clearInterval(calculationIntervalRef.current);
                    calculationIntervalRef.current = null;
                    setCalculating(false);
                    setIsRecalculateRun(false);
                    if (navigateOnComplete) setError(calcData.errorMessage || 'Calculation failed');
                }
            } catch (err) {
                clearInterval(calculationIntervalRef.current);
                calculationIntervalRef.current = null;
                setCalculating(false);
                setIsRecalculateRun(false);
            }
        }, 5000);
    };


    const handleAmazonRefundLossToggle = async (newValue) => {
        if (newValue === true && !hasAmazonRefundLossDisabled) return;
        const confirmChange = window.confirm(
            `This will update the "Consider Refund-Loss in Total Cost" setting for the selected Amazon accounts.\nYou will need to recalculate payments to see the effect on profit/loss. Continue?`
        );
        if (!confirmChange) return;

        setFiltering(true);
        try {
            const updatePromises = marketplaceFilters.map(id =>
                api.put(`/marketplaces/${id}/config`, {
                    config: { amazonConsiderRefundLoss: newValue }
                })
            );
            await Promise.all(updatePromises);
            toast.success(`Setting updated for ${marketplaceFilters.length} Amazon account(s)`);
            await fetchMarketplaces();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update setting');
        } finally {
            setFiltering(false);
        }
    };

    const handleClearFilters = () => {
        withUnsavedWarning(() => {
            setColumnFilters({});
            setCurrentPage(1);
        });
    };

    // Generic handler for every other Cost Sheet column's header search box
    // (style_id, selling_gst, date, product_cost, packaging_cost, gst_percent,
    // packaging_gst_percent, claim, is_product_cost_with_gst, return_loss_percent,
    // rto_packaging_loss, weight_slab, total_tax, total_cost). These filter the
    // already-loaded page of costSheetData client-side (no refetch), combining
    // via AND with each other and with sku/product_name/account_name/size, so
    // no unsaved-edit warning is needed — the loaded rows/edits never change.
    const handleColumnFilterChange = (key, value) => {
        withUnsavedWarning(() => {
            setColumnFilters(prev => ({ ...prev, [key]: value }));
            setCurrentPage(1);
        });
    };

    // Pagination handlers
    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages) return;

        if (editedRows.size > 0) {
            setUnsavedModal({
                open: true,
                targetType: 'page',
                targetPage: newPage,
                targetSortColumn: null,
                targetSortOrder: null
            });
            return;
        }

        setCurrentPage(newPage);
        fetchCostSheet(newPage, false);
    };

    const handleSort = (column, newSortOrder) => {
        let finalSortColumn = column;
        let finalSortOrder = newSortOrder;

        if (sortColumn === column && sortOrder === newSortOrder) {
            finalSortColumn = null;
            finalSortOrder = null;
        }

        if (editedRows.size > 0) {
            setUnsavedModal({
                open: true,
                targetType: 'sort',
                targetPage: 1,
                targetSortColumn: finalSortColumn,
                targetSortOrder: finalSortOrder
            });
            return;
        }

        setSortColumn(finalSortColumn);
        setSortOrder(finalSortOrder);
        setCurrentPage(1);
        fetchCostSheet(1, false, finalSortColumn, finalSortOrder);
    };

    const handlePreviousPage = () => {
        handlePageChange(currentPage - 1);
    };

    const handleNextPage = () => {
        handlePageChange(currentPage + 1);
    };

    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 7;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            let startPage = Math.max(2, currentPage - 2);
            let endPage = Math.min(totalPages - 1, currentPage + 2);

            if (startPage > 2) {
                pages.push('...');
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }

            if (endPage < totalPages - 1) {
                pages.push('...');
            }

            pages.push(totalPages);
        }

        return pages;
    };

    const meeshoAccountIds = new Set(
        availableMarketplaces
            .filter(mp => mp.key === 'Meesho')
            .flatMap(mp => mp.accounts?.map(a => a._id) || [])
    );
    const isMeeshoView = marketplaceFilters.length > 0 &&
        marketplaceFilters.every(id => meeshoAccountIds.has(id));

    const hasSizeWiseDisabled = isMeeshoView && marketplaceFilters.some(id => {
        const mp = availableMarketplaces.find(m => m.key === 'Meesho');
        const account = mp?.accounts?.find(a => a._id === id);
        return account?.config?.enableSizeWiseCalculation === false;
    });
    const showMeeshoSize = isMeeshoView && !hasSizeWiseDisabled;

    const myntraAccountIds = new Set(
        availableMarketplaces
            .filter(mp => mp.key === 'Myntra')
            .flatMap(mp => mp.accounts?.map(a => a._id) || [])
    );
    const isMyntraView = marketplaceFilters.length > 0 &&
        marketplaceFilters.every(id => myntraAccountIds.has(id));

    const flipkartAccountIds = new Set(
        availableMarketplaces
            .filter(mp => mp.key === 'Flipkart')
            .flatMap(mp => mp.accounts?.map(a => a._id) || [])
    );
    const isFlipkartView = marketplaceFilters.length > 0 &&
        marketplaceFilters.every(id => flipkartAccountIds.has(id));

    // Derive isAmazonView: true only when every selected account belongs to Amazon India (Seller).
    const amazonAccounts = availableMarketplaces
        .filter(mp => mp.key === 'Amazon India (Seller)')
        .flatMap(mp => mp.accounts || []);
    const amazonAccountIds = new Set(amazonAccounts.map(a => a._id));
    const isAmazonView = marketplaceFilters.length > 0 &&
        marketplaceFilters.every(id => amazonAccountIds.has(id));

    // Check if ANY selected Amazon account has amazonConsiderRefundLoss disabled
    const hasAmazonRefundLossDisabled = isAmazonView && marketplaceFilters.some(id => {
        const account = amazonAccounts.find(a => a._id === id);
        return account?.config?.amazonConsiderRefundLoss === false;
    });

    // Editable columns configuration
    const editableColumns = [
        { key: 'account_name', label: 'Account Name', type: 'text', editable: false, readOnly: true },
        ...(isMyntraView ? [
            { key: 'style_id', label: 'Style ID', type: 'text', editable: false, readOnly: true },
            { key: 'size', label: 'Size', type: 'text', editable: false, readOnly: true },
        ] : []),
        ...(showMeeshoSize ? [
            { key: 'size', label: 'Size', type: 'text', editable: false, readOnly: true }
        ] : []),
        { key: 'product_name', label: 'Product Name', type: 'text', editable: true },
        ...(isFlipkartView ? [
            { key: 'selling_gst', label: 'Selling GST %', type: 'select', options: ['0', '0.25', '1.5', '2.5', '3', '5', '6', '9', '12', '14', '18', '28', '40'], editable: true }
        ] : []),
        { key: 'date', label: 'Date', type: 'date', editable: true },
        { key: 'product_cost', label: 'Product Cost', type: 'number', editable: true },
        { key: 'packaging_cost', label: 'Packaging Cost', type: 'number', editable: true },
        { key: 'gst_percent', label: 'GST %', type: 'select', options: ['0', '0.25', '1.5', '2.5', '3', '5', '6', '9', '12', '14', '18', '28', '40'], editable: true },
        { key: 'packaging_gst_percent', label: 'Packaging GST %', type: 'select', options: ['0', '0.25', '1.5', '2.5', '3', '5', '6', '9', '12', '14', '18', '28', '40'], editable: true },
        { key: 'claim', label: 'Claim Amount', type: 'number', editable: true },
        { key: 'is_product_cost_with_gst', label: 'Is Cost with GST?', type: 'select', options: ['y', 'n'], editable: true },
        { key: 'return_loss_percent', label: 'Return Loss %', type: 'number', editable: true },
        { key: 'rto_packaging_loss', label: 'RTO Packaging Loss', type: 'number', editable: true },
        ...(isMeeshoView ? [{ key: 'weight_slab', label: 'Weight Slab (g)', type: 'number', editable: true }] : []),
        { key: 'total_tax', label: 'Total Tax', type: 'number', editable: false, calculated: true },
        { key: 'total_cost', label: 'Total Cost', type: 'number', editable: false, calculated: true }
    ];

    const allColumns = ['sku', ...editableColumns.map(c => c.key)];
    const COLUMN_LABELS = {
        sku: 'SKU',
        ...editableColumns.reduce((acc, col) => ({ ...acc, [col.key]: col.label }), {})
    };

    useEffect(() => {
        const savedOrder = localStorage.getItem('costsheet_columnOrder');
        let order = savedOrder ? JSON.parse(savedOrder) : [];
        
        const currentOrder = order.filter(k => allColumns.includes(k));
        allColumns.forEach(k => {
            if (!currentOrder.includes(k)) currentOrder.push(k);
        });
        
        if (JSON.stringify(columnOrder) !== JSON.stringify(currentOrder)) {
            setColumnOrder(currentOrder);
        }
    }, [allColumns.join(',')]);

    useEffect(() => {
        const savedVisibility = localStorage.getItem('costsheet_visibleColumns');
        if (savedVisibility) {
            setVisibleColumns(JSON.parse(savedVisibility));
        }
    }, []);

    const handleToggleColumn = (col) => {
        setVisibleColumns(prev => {
            const next = { ...prev, [col]: prev[col] === false ? true : false };
            localStorage.setItem('costsheet_visibleColumns', JSON.stringify(next));
            return next;
        });
    };

    const handleSelectAllColumns = () => {
        const next = {};
        allColumns.forEach(c => next[c] = true);
        setVisibleColumns(next);
        localStorage.setItem('costsheet_visibleColumns', JSON.stringify(next));
    };

    const pinnedCols = ['sku', 'total_tax', 'total_cost'];

    const handleDeselectAllColumns = () => {
        const next = {};
        allColumns.forEach(c => next[c] = pinnedCols.includes(c));
        setVisibleColumns(next);
        localStorage.setItem('costsheet_visibleColumns', JSON.stringify(next));
    };

    const handleReorderColumn = (draggedCols, targetCol) => {
        const draggedArray = Array.isArray(draggedCols) ? draggedCols : [draggedCols];
        if (draggedArray.includes(targetCol) || draggedArray.some(col => pinnedCols.includes(col)) || pinnedCols.includes(targetCol)) return;
        setColumnOrder(prev => {
            let next = [...prev];
            next = next.filter(c => !draggedArray.includes(c)); // remove all dragged
            const targetIdx = next.indexOf(targetCol);
            if (targetIdx !== -1) {
                next.splice(targetIdx, 0, ...draggedArray);
                localStorage.setItem('costsheet_columnOrder', JSON.stringify(next));
                return next;
            }
            return prev;
        });
    };

    const handleResetColumnOrder = () => {
        setColumnOrder(allColumns);
        localStorage.setItem('costsheet_columnOrder', JSON.stringify(allColumns));
    };

    const visibleCount = allColumns.filter(c => visibleColumns[c] !== false).length;

    const orderedVisibleColumnsKeys = (columnOrder.length > 0 ? columnOrder : allColumns)
        .filter(k => k !== 'sku' && visibleColumns[k] !== false);
        
    const orderedVisibleColumns = orderedVisibleColumnsKeys
        .map(k => editableColumns.find(c => c.key === k))
        .filter(Boolean);

    const getStickyRightStyle = (colKey) => {
        const totalCostWidth = columnWidths['total_cost'] || 150;
        if (colKey === 'total_cost') {
            return {
                position: 'sticky',
                right: 0,
            };
        }
        if (colKey === 'total_tax') {
            return {
                position: 'sticky',
                right: totalCostWidth,
            };
        }
        return {};
    };

    const visibleRowCount = costSheetData.length;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-brand-600" size={40} />
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-50 p-2.5 sm:p-4 md:px-6 md:py-4 flex flex-col overflow-hidden" style={{ userSelect: isDragging ? 'none' : 'auto' }}>
            {/* Header */}
            <div data-tour={TOUR.costSheet.header} className="max-w-full mb-3 shrink-0">
                <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 flex-wrap">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Tooltip text="Go Back">
                            <button
                                onClick={handleBack}
                                className="p-1.5 sm:p-2 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-slate-200 shadow-2xs shrink-0 cursor-pointer"
                            >
                                <ArrowLeft size={18} className="text-slate-700 sm:w-[22px] sm:h-[22px]" />
                            </button>
                        </Tooltip>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">Cost Sheet</h1>
                            <p className="text-slate-500 text-[11px] sm:text-xs font-medium">
                                Page {currentPage} of {totalPages} • {totalRows} total SKUs • {visibleRowCount} on this page{visibleRowCount !== costSheetData.length ? ` (of ${costSheetData.length})` : ''} • {editedRows.size} unsaved changes
                            </p>
                            {marketplaceFilters.length > 0 && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs flex-wrap">
                                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Active Accounts:</span>
                                    {marketplaceFilters.length <= 5 ? (
                                        marketplaceFilters.map(id => (
                                            <span key={id} className="px-1.5 sm:px-2 py-0.5 bg-brand-50 text-brand-700 font-bold border border-brand-200/80 rounded-md text-[10px] sm:text-[11px] truncate max-w-[110px] sm:max-w-[160px]" title={marketplaceNamesMap[id] || id}>
                                                {marketplaceNamesMap[id] || id}
                                            </span>
                                        ))
                                    ) : (
                                        <>
                                            {marketplaceFilters.slice(0, 3).map(id => (
                                                <span key={id} className="px-1.5 sm:px-2 py-0.5 bg-brand-50 text-brand-700 font-bold border border-brand-200/80 rounded-md text-[10px] sm:text-[11px] truncate max-w-[110px] sm:max-w-[160px]" title={marketplaceNamesMap[id] || id}>
                                                    {marketplaceNamesMap[id] || id}
                                                </span>
                                            ))}
                                            <div className="relative inline-block" ref={accountsPopoverRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowActiveAccountsPopover(p => !p)}
                                                    className="px-2.5 py-0.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-md transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer text-[11px]"
                                                    title="Click to view all selected accounts"
                                                >
                                                    <span>+{marketplaceFilters.length - 3} View More</span>
                                                    <ChevronDown size={11} className={`transition-transform duration-200 ${showActiveAccountsPopover ? 'rotate-180' : ''}`} />
                                                </button>

                                                {showActiveAccountsPopover && (
                                                    <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                                            <span className="font-black text-slate-800 text-xs uppercase tracking-wider">
                                                                More Accounts ({marketplaceFilters.length - 3})
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowActiveAccountsPopover(false)}
                                                                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                        <div className="relative mb-2">
                                                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                            <input
                                                                type="text"
                                                                value={accountSearchQuery}
                                                                onChange={(e) => setAccountSearchQuery(e.target.value)}
                                                                placeholder="Search more accounts..."
                                                                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                                                            />
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                                                            {marketplaceFilters
                                                                .slice(5)
                                                                .filter(id => (marketplaceNamesMap[id] || id).toLowerCase().includes(accountSearchQuery.toLowerCase()))
                                                                .map(id => (
                                                                    <div key={id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-800">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                                                                        <span className="truncate">{marketplaceNamesMap[id] || id}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 relative flex-wrap justify-end w-full sm:w-auto">
                        {/* Amazon Refund-Loss Toggle */}
                        {isAmazonView && (
                            <div className="flex items-center gap-1.5 mr-1 sm:mr-2">
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 group relative cursor-help">
                                    Refund Loss:
                                    <Info size={13} className="text-slate-400" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-slate-800 text-white text-[10px] px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-tight shadow-lg normal-case">
                                        consider refund-loss quantity in total-cost
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800"></div>
                                    </div>
                                </span>
                                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm h-7 sm:h-8">
                                    <button
                                        onClick={() => handleAmazonRefundLossToggle(false)}
                                        className={`px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-bold transition-colors flex items-center ${hasAmazonRefundLossDisabled
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Off
                                    </button>
                                    <button
                                        onClick={() => handleAmazonRefundLossToggle(true)}
                                        className={`px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-bold border-l border-slate-200 transition-colors flex items-center ${!hasAmazonRefundLossDisabled
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        On
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Filter Dropdown */}
                        <div data-tour={TOUR.costSheet.accountFilter}>
                            <MarketplaceAccountSelector
                                variant="popover"
                                selectionMode="single"
                                accountSelection="multiple"
                                showCheckbox={true}
                                showClearAll={true}
                            availableMarketplaces={availableMarketplaces}
                            marketplaceFilters={marketplaceFilters}
                            onApplyFilters={(selectedIds) => {
                                withUnsavedWarning(() => {
                                    setMarketplaceFilters(selectedIds);
                                    localStorage.setItem('cost_sheet_marketplace_filters', JSON.stringify(selectedIds));
                                    try {
                                        window.history.replaceState({}, document.title, window.location.pathname);
                                    } catch (e) {}
                                });
                            }}
                            buttonLabel="Filter Accounts"
                            align="left"
                        />
                        </div>

                        <div className="relative z-40 flex items-center h-full" ref={columnSelectorRef}>
                            <button
                                type="button"
                                onClick={() => setShowColumnSelector(true)}
                                className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 lg:px-4 h-9 sm:h-10 rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-md transition-all cursor-pointer font-medium text-[11px] sm:text-xs lg:text-sm whitespace-nowrap"
                                title="Add & Arrange Columns"
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
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                <span className="hidden lg:inline">Add & Arrange Columns</span>
                            </button>
                            <AddColumnSidebar
                                allColumns={allColumns}
                                columnOrder={columnOrder}
                                visibleColumns={visibleColumns}
                                visibleCount={visibleCount}
                                show={showColumnSelector}
                                setShow={setShowColumnSelector}
                                onToggle={handleToggleColumn}
                                onSelectAll={handleSelectAllColumns}
                                onDeselectAll={handleDeselectAllColumns}
                                onReorder={handleReorderColumn}
                                onResetColumnOrder={handleResetColumnOrder}
                                dragOver={dragOver}
                                setDragOver={setDragOver}
                                dragItemRef={dragItemRef}
                                containerRef={columnSelectorRef}
                                COLUMN_LABELS={COLUMN_LABELS}
                                pinnedCols={pinnedCols}
                            />
                        </div>

                        <ExportButton
                            exportType="cost_sheet"
                            marketplaceId={
                                marketplaceFilters.length === 1
                                    ? marketplaceFilters[0]
                                    : (marketplaceFilters[0] || availableMarketplaces.flatMap(mp => mp.accounts || [])[0]?._id || null)
                            }
                            buttonText="Export"
                            buttonClassName="!flex !items-center !gap-1.5 sm:!gap-2 !px-2.5 sm:!px-4 !py-2 sm:!py-2.5 !bg-brand-600 !text-white !rounded-xl hover:!bg-brand-700 !transition-colors !font-bold !text-[11px] sm:!text-xs !shadow-sm !whitespace-nowrap"
                            onExportComplete={async (finalStatus) => {
                                if (finalStatus?.export_id || finalStatus?._id) {
                                    try {
                                        const downloadUrl = await getDownloadUrl(finalStatus.export_id || finalStatus._id);
                                        if (downloadUrl) {
                                            const link = document.createElement('a');
                                            link.href = downloadUrl;
                                            link.setAttribute('download', '');
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        }
                                    } catch (err) {
                                        console.error('Error fetching download URL for export:', err);
                                    }
                                }
                            }}
                        />

                        <Tooltip text={saving ? "Saving..." : editedRows.size === 0 ? "No unsaved changes" : `Save ${editedRows.size} unsaved change${editedRows.size !== 1 ? 's' : ''}`}>
                            <button
                                data-tour={TOUR.costSheet.saveBtn}
                                onClick={handleSave}
                                disabled={saving || editedRows.size === 0}
                                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-[11px] sm:text-xs shadow-sm cursor-pointer whitespace-nowrap"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="animate-spin" size={14} />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} className="sm:w-4 sm:h-4" />
                                        <span>Save ({editedRows.size})</span>
                                    </>
                                )}
                            </button>
                        </Tooltip>

                        {(() => {
                            const isCostSheetEmpty = !loading && (totalRows === 0 || costSheetData.length === 0);
                            const isCalculateDisabled = calculating || marketplaceFilters.length === 0 || marketplaceFilters.length > 1 || !canCalculate || isCostSheetEmpty;

                            const calculateTooltipText = calculating
                                ? (isRecalculateRun ? 'Recalculation is currently in progress...' : 'Calculation is currently in progress...')
                                : marketplaceFilters.length === 0
                                    ? 'Please select at least one account to calculate'
                                    : marketplaceFilters.length > 1
                                        ? 'Please select only one account to calculate'
                                        : canCalculateReason === 'calculating_credits' || canCalculateReason === 'processing_uploads'
                                            ? 'Credits are currently being calculated for recent uploads. Please wait...'
                                            : !canCalculate
                                                ? 'Insufficient credit balance to run calculation. Please recharge credits.'
                                                : isCostSheetEmpty
                                                    ? 'Cost sheet is blank or not generated yet. Please enter SKU costs before calculating.'
                                                    : (needsRecalculate ? 'Run Recalculation' : 'Run Calculation');

                            return (
                                <Tooltip text={calculateTooltipText}>
                                    <button
                                        onClick={handleCalculate}
                                        disabled={isCalculateDisabled}
                                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-[11px] sm:text-xs shadow-sm cursor-pointer whitespace-nowrap"
                                    >
                                        {calculating ? (
                                            <>
                                                <Loader2 className="animate-spin" size={14} />
                                                <span>{isRecalculateRun ? 'Recalculating' : 'Calculating'} ({calcProgress}%)</span>
                                            </>
                                        ) : (
                                            <>
                                                <Calculator size={14} className="sm:w-4 sm:h-4" />
                                                <span>{(needsRecalculate && canCalculate) ? 'Recalculate' : 'Calculate'}</span>
                                            </>
                                        )}
                                    </button>
                                </Tooltip>
                            );
                        })()}
                    </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="mt-2 p-2.5 sm:p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-[11px] sm:text-xs font-semibold">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

            </div>

            {/* Table Container */}
            {filtering && (
                <div className="w-full h-0.5 bg-slate-200 rounded overflow-hidden mb-1 shrink-0">
                    <div className="h-full progress-bar-shimmer" />
                </div>
            )}
            <div
                data-tour={TOUR.costSheet.table}
                className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden transition-opacity duration-200"
                style={{ cursor: isDragging ? 'crosshair' : 'default', opacity: filtering ? 0.5 : 1, pointerEvents: filtering ? 'none' : 'auto' }}
            >
                <div ref={tableContainerRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0 relative">
                    <table className="border-collapse" style={{ minWidth: '100%' }}>
                        <thead className="bg-slate-100 sticky top-0 z-20">
                            <tr>
                                {/* SKU Header Column */}
                                <th
                                    className="px-2.5 sm:px-3 py-2 text-left text-xs font-semibold text-white uppercase border-b border-r border-brand-500/40 sticky left-0 bg-brand-600 z-30 group"
                                    style={{
                                        width: columnWidths['sku'] || 250,
                                        minWidth: columnWidths['sku'] || 250,
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    onClick={() => handleSort('sku', 'desc')}
                                                    className={`p-0.5 rounded hover:bg-white/20 transition-colors ${sortColumn === 'sku' && sortOrder === 'desc' ? 'bg-white/30' : ''}`}
                                                    title="Sort Descending (highest first)"
                                                >
                                                    <ArrowUp size={12} className={sortColumn === 'sku' && sortOrder === 'desc' ? 'text-white' : 'text-brand-200'} />
                                                </button>
                                                <button
                                                    onClick={() => handleSort('sku', 'asc')}
                                                    className={`p-0.5 rounded hover:bg-white/20 transition-colors ${sortColumn === 'sku' && sortOrder === 'asc' ? 'bg-white/30' : ''}`}
                                                    title="Sort Ascending (lowest first)"
                                                >
                                                    <ArrowDown size={12} className={sortColumn === 'sku' && sortOrder === 'asc' ? 'text-white' : 'text-brand-200'} />
                                                </button>
                                            </div>
                                            <span>SKU</span>
                                        </div>
                                        
                                        <CostSheetColumnFilterPopover
                                            columnKey="sku"
                                            columnLabel="SKU"
                                            currentSelection={columnFilters['sku'] || []}
                                            onApply={(val) => handleColumnFilterChange('sku', val)}
                                            marketplaceFilters={marketplaceFilters}
                                        />
                                        <div
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => handleResizeStart(e, 'sku')}
                                        />
                                    </div>
                                </th>

                                    {/* Editable columns header */}
                                    {orderedVisibleColumns.map(col => {
                                    const isStickyRight = col.key === 'total_tax' || col.key === 'total_cost';
                                    const stickyStyle = getStickyRightStyle(col.key);
                                    const highlight = getColumnHighlightStyle(col.key);
                                    // Every column gets the popover component except account_name (handled globally)
                                    const isSearchable = col.key !== 'account_name';

                                    return (
                                        <th
                                            key={col.key}
                                            className={`px-2.5 sm:px-3 py-2 text-left text-xs font-semibold text-white uppercase border-b border-r border-brand-500/40 whitespace-nowrap bg-brand-600 relative group ${isStickyRight ? 'z-40' : ''} ${col.key === 'total_tax' ? 'border-l border-l-brand-400 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.15)]' : ''}`}
                                            style={{ width: columnWidths[col.key] || 150, minWidth: columnWidths[col.key] || 150, ...stickyStyle }}
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col gap-0.5">
                                                        <button
                                                            onClick={() => handleSort(col.key, 'desc')}
                                                            className={`p-0.5 rounded hover:bg-white/20 transition-colors ${sortColumn === col.key && sortOrder === 'desc' ? 'bg-white/30' : ''}`}
                                                            title="Sort Descending (highest first)"
                                                        >
                                                            <ArrowUp size={12} className={sortColumn === col.key && sortOrder === 'desc' ? 'text-white' : (highlight ? 'text-white/80' : 'text-green-200')} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleSort(col.key, 'asc')}
                                                            className={`p-0.5 rounded hover:bg-white/20 transition-colors ${sortColumn === col.key && sortOrder === 'asc' ? 'bg-white/30' : ''}`}
                                                            title="Sort Ascending (lowest first)"
                                                        >
                                                            <ArrowDown size={12} className={sortColumn === col.key && sortOrder === 'asc' ? 'text-white' : (highlight ? 'text-white/80' : 'text-green-200')} />
                                                        </button>
                                                    </div>
                                                    <span>{col.label}</span>
                                                </div>

                                                {isSearchable && (
                                                    <CostSheetColumnFilterPopover
                                                        columnKey={col.key}
                                                        columnLabel={col.label}
                                                        currentSelection={columnFilters[col.key] || []}
                                                        onApply={(val) => handleColumnFilterChange(col.key, val)}
                                                        marketplaceFilters={marketplaceFilters}
                                                        alignRight={isStickyRight}
                                                    />
                                                )}

                                                <div
                                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onMouseDown={(e) => handleResizeStart(e, col.key)}
                                                />
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {costSheetData.map((row, rowIndex) => {
                                return (
                                <tr
                                    key={row.id}
                                    data-row-index={rowIndex}
                                    className={`hover:bg-slate-50 ${editedRows.has(rowIndex) ? 'bg-yellow-50' : ''}`}
                                >

                                    {/* Read-only: SKU */}
                                    <td
                                        className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-red-700 border-b border-slate-100 bg-slate-50 sticky left-0 z-10"
                                        style={{
                                            width: columnWidths['sku'] || 250,
                                        }}
                                    >
                                        <input
                                            type="text"
                                            value={row.sku || ''}
                                            disabled
                                            className="w-full bg-transparent border-none outline-none cursor-not-allowed text-blue-700 font-semibold py-1 text-xs sm:text-sm"
                                        />
                                    </td>

                                    {/* Editable columns */}
                                    {orderedVisibleColumns.map((col, colIndex) => {
                                        const isStickyRight = col.key === 'total_tax' || col.key === 'total_cost';
                                        const stickyStyle = getStickyRightStyle(col.key);
                                        const highlight = getColumnHighlightStyle(col.key);
                                        const cellBgClass = highlight
                                            ? highlight.cellBg
                                            : (!col.editable ? 'bg-slate-50' : 'bg-white');

                                        return (
                                            <td
                                                key={col.key}
                                                data-col-key={col.key}
                                                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border-b border-slate-100 ${cellBgClass} ${isStickyRight ? 'z-10' : ''} ${col.key === 'total_tax' ? 'border-l border-l-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]' : ''} ${dragPreview &&
                                                    rowIndex >= dragPreview.minRow && rowIndex <= dragPreview.maxRow &&
                                                    colIndex >= dragPreview.minColIdx && colIndex <= dragPreview.maxColIdx
                                                    ? 'bg-slate-300 border-2 border-slate-400' : ''
                                                    } relative group`}
                                                style={{ width: columnWidths[col.key] || 150, ...stickyStyle }}
                                                onMouseDown={(e) => col.editable && handleCellMouseDown(e, rowIndex, col.key)}
                                                onMouseEnter={() => handleCellMouseEnter(rowIndex, col.key)}
                                            >
                                                {col.type === 'select' && col.editable ? (() => {
                                                    const isYN = col.key === 'is_product_cost_with_gst' || col.options[0] === 'Yes' || col.options[0] === 'y' || col.options[0] === 'n';
                                                    const rawVal = row[col.key];
                                                    let currentVal = rawVal != null && rawVal !== ''
                                                        ? String(rawVal).replace(/%$/, '').trim()
                                                        : '';
                                                    if (isYN) {
                                                        // Normalize to the raw option value ('y'/'n'), not the display
                                                        // label — col.options is ['y', 'n'], so comparing a 'Yes'/'No'
                                                        // string against it below would never match, injecting a
                                                        // duplicate extra <option> alongside the real one.
                                                        if (currentVal.toLowerCase() === 'y' || currentVal.toLowerCase() === 'yes') currentVal = 'y';
                                                        else if (currentVal.toLowerCase() === 'n' || currentVal.toLowerCase() === 'no') currentVal = 'n';
                                                    }
                                                    const isStandardVal = currentVal === '' || col.options.includes(currentVal);

                                                    const formatLabel = (val) => {
                                                        if (isYN) {
                                                            if (val === 'y' || String(val).toLowerCase() === 'yes') return 'Yes';
                                                            if (val === 'n' || String(val).toLowerCase() === 'no') return 'No';
                                                        }
                                                        return val + (!isYN ? '%' : '');
                                                    };

                                                    return (
                                                        <select
                                                            value={currentVal}
                                                            onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                                                            className={`w-full px-2 py-1 text-xs sm:text-sm border rounded focus:outline-none focus:ring-2 ${highlight ? highlight.inputBorder : 'border-slate-200 focus:ring-brand-500 bg-white font-medium text-slate-800'}`}
                                                        >
                                                            <option value="">Select...</option>
                                                            {currentVal !== '' && !isStandardVal && (
                                                                <option value={currentVal}>
                                                                    {formatLabel(currentVal)}
                                                                </option>
                                                            )}
                                                            {col.options.map(option => (
                                                                <option key={option} value={option}>
                                                                    {formatLabel(option)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    );
                                                })() : col.readOnly ? (
                                                    <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap inline-block ${highlight ? `${highlight.cellBg} ${highlight.textClass}` : 'text-blue-700 bg-blue-50'}`}>
                                                        {col.key === 'account_name'
                                                            ? (marketplaceNamesMap[row.marketplace_id] || row.marketplace_id || '—')
                                                            : (col.key === 'size' && !row.size && isMeeshoView ? 'NA' : formatCellValue(row[col.key], col.type))}
                                                    </span>
                                                ) : (
                                                    <input
                                                        type={col.type}
                                                        value={formatCellValue(row[col.key], col.type)}
                                                        onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                                                        disabled={!col.editable}
                                                        className={`w-full px-2 py-1 text-xs sm:text-sm border rounded focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!col.editable
                                                            ? (highlight ? `${highlight.cellBg} ${highlight.textClass} cursor-not-allowed border-transparent` : 'bg-blue-50 cursor-not-allowed text-blue-700 font-semibold border-slate-200')
                                                            : (highlight ? highlight.inputBorder : 'border-slate-200 focus:ring-brand-500 text-slate-900 font-medium bg-white')
                                                            }`}
                                                    />
                                                )}

                                            </td>
                                        );
                                    })}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="shrink-0 border-t border-slate-200 px-2.5 sm:px-4 py-2 bg-slate-50 flex flex-col sm:flex-row items-center justify-between flex-wrap gap-2">
                        <div className="text-[10px] sm:text-xs text-slate-500 font-medium text-center sm:text-left">
                            Showing {((currentPage - 1) * pageLimit) + 1} to {Math.min(currentPage * pageLimit, totalRows)} of {totalRows} SKUs
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* Previous Button */}
                            <button
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1}
                                className="px-2 sm:px-3 py-1 border border-slate-300 rounded-md text-[10px] sm:text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>

                            {/* Page Numbers */}
                            <div className="flex items-center gap-1">
                                {getPageNumbers().map((page, index) => (
                                    page === '...' ? (
                                        <span key={`ellipsis-${index}`} className="px-2 py-1 text-[10px] sm:text-xs text-slate-400">
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`min-w-[26px] sm:min-w-[32px] px-1.5 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-colors ${currentPage === page
                                                ? 'bg-brand-600 text-white font-semibold shadow-xs'
                                                : 'border border-slate-300 text-slate-700 hover:bg-white'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    )
                                ))}
                            </div>

                            {/* Next Button */}
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                className="px-2 sm:px-3 py-1 border border-slate-300 rounded-md text-[10px] sm:text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {visibleRowCount === 0 && !loading && (
                <div className="text-center py-12 bg-white rounded-lg shadow-md border border-slate-200">
                    <div className="text-slate-500">
                        {Object.values(columnFilters).some(v => Array.isArray(v) ? v.length > 0 : v) ? (
                            <>
                                <Search className="inline-block mb-4 text-slate-400" size={48} />
                                <p className="text-base sm:text-lg font-medium">No results found</p>
                                <p className="text-xs sm:text-sm mt-2">Try adjusting your search filters</p>
                                <button
                                    onClick={handleClearFilters}
                                    className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm"
                                >
                                    Clear Filters
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-base sm:text-lg font-medium">No cost sheet data found</p>
                                <p className="text-xs sm:text-sm mt-2">Please generate a cost sheet first</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            <CostSheetNotGeneratedModal
                isOpen={notGeneratedModal}
                onClose={() => setNotGeneratedModal(false)}
                mode="not_generated"
                marketplaceId={
                    marketplaceFilters && Array.isArray(marketplaceFilters) && marketplaceFilters.length > 0
                        ? marketplaceFilters
                        : null
                }
                onGenerateSuccess={() => fetchCostSheet()}
            />

            <CostSheetNotGeneratedModal
                isOpen={staleModal.open}
                onClose={() => setStaleModal(prev => ({ ...prev, open: false }))}
                mode="stale"
                lastUploadDate={staleModal.lastUploadDate}
                lastCostsheetDate={staleModal.lastCostsheetDate}
                marketplaceId={
                    marketplaceFilters && Array.isArray(marketplaceFilters) && marketplaceFilters.length > 0
                        ? marketplaceFilters
                        : null
                }
                onGenerateSuccess={() => {
                    setStaleModal(prev => ({ ...prev, open: false }));
                    fetchCostSheet();
                }}
            />

            {/* Missing Product Costs Warning Modal */}
            {missingModal.open && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 my-auto border border-slate-100">
                        {/* Header */}
                        <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 sm:gap-4">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="text-amber-600" size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-amber-900">Missing Product Costs</h3>
                                    <p className="text-xs sm:text-sm text-amber-700 mt-1">Action required before calculating</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMissingModal({ open: false, count: 0, skus: [] })}
                                className="p-2 -mr-2 -mt-2 text-amber-600 hover:text-amber-900 hover:bg-amber-100/50 rounded-lg transition-colors shrink-0"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6">
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                You have <span className="font-bold text-amber-700">{missingModal.count} SKU{missingModal.count !== 1 ? 's' : ''}</span> in the selected marketplace {missingModal.count !== 1 ? 'have' : 'has'} no product cost filled in the cost sheet.
                                Calculations will run with <span className="font-semibold">₹0 product cost</span> for these SKUs, which may affect profit/loss accuracy.
                            </p>

                            {missingModal.skus.length > 0 && (
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="text-[11px] sm:text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">SKU Preview</p>
                                    <ul className="space-y-1 max-h-28 overflow-y-auto">
                                        {missingModal.skus.map((sku, i) => (
                                            <li key={i} className="text-[11px] sm:text-xs font-mono text-slate-700 truncate">{sku}</li>
                                        ))}
                                    </ul>
                                    {missingModal.count > missingModal.skus.length && (
                                        <p className="text-[11px] sm:text-xs text-amber-600 mt-2">…and {missingModal.count - missingModal.skus.length} more</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6">
                            <button
                                onClick={() => {
                                    setMissingModal({ open: false, count: 0, skus: [] });
                                    // User wants to stay and fix costs — don't navigate away once they do calculate.
                                    navigateAfterCalculateRef.current = false;
                                }}
                                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                            >
                                Go to Cost Sheet
                            </button>
                            <button
                                onClick={doActualCalculate}
                                className="px-4 py-2 text-xs sm:text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-200 rounded-lg transition-all cursor-pointer font-semibold"
                            >
                                Continue Calculate
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Custom Unsaved Changes Warning Modal */}
            {unsavedModal.open && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 my-auto border border-slate-100">
                        {/* Header */}
                        <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex items-start gap-3 sm:gap-4">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <AlertCircle className="text-amber-600" size={22} />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-amber-900">Unsaved Changes</h3>
                                <p className="text-xs sm:text-sm text-amber-700 mt-0.5">
                                    You have <span className="font-bold text-amber-800">{editedRows.size}</span> unsaved change{editedRows.size !== 1 ? 's' : ''}.
                                </p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6">
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Do you want to save your changes before proceeding? If you click <span className="font-semibold text-rose-600">{"Don't Save"}</span>, your recent edits will be discarded.
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-6 pb-4 sm:pb-6 bg-slate-50/50 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={handleModalDontSave}
                                className="px-4 py-2 text-xs sm:text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
                            >
                                {"Don't Save"}
                            </button>
                            <button
                                type="button"
                                onClick={handleModalSave}
                                disabled={saving}
                                className="flex items-center justify-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                <span>Save</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Calculate Reminder Modal - shown when leaving with saved but uncalculated changes */}
            {calculatePromptModal.open && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 my-auto border border-slate-100">
                        {/* Header */}
                        <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex items-start gap-3 sm:gap-4">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Calculator className="text-amber-600" size={20} />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-amber-900">Calculation Pending</h3>
                                <p className="text-xs sm:text-sm text-amber-700 mt-0.5">
                                    Your cost sheet changes have been saved but not yet calculated.
                                </p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6">
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Run Calculate now so these changes are reflected in the payment reports, or leave and calculate later.
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-6 pb-4 sm:pb-6 bg-slate-50/50 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={handleCalculatePromptCancel}
                                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCalculatePromptCalculate}
                                className="flex items-center justify-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all cursor-pointer"
                            >
                                <Calculator size={16} />
                                <span>Calculate</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CostSheet;