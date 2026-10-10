import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { Save, ArrowLeft, Loader2, AlertCircle, CheckCircle, Search, X, Plus, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Filter, Info } from 'lucide-react';
import { toast } from 'sonner';

const CostSheet = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isImpersonating } = useAuth();
    const [costSheetData, setCostSheetData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtering, setFiltering] = useState(false); // Separate state for filter loading
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editedRows, setEditedRows] = useState(new Set());
    const [columnWidths, setColumnWidths] = useState({});
    const resizingColumn = useRef(null);
    const startX = useRef(0);
    const startWidth = useRef(0);

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

    // Filter state (from navigation or local)
    const [skuFilter, setSkuFilter] = useState('');
    const [productNameFilter, setProductNameFilter] = useState('');
    
    // Parse query params (used when opening in a new tab)
    const searchParams = new URLSearchParams(location.search);
    let qsMktIds = null;
    let qsMktNames = null;
    try {
        if (searchParams.get('marketplaceIds')) qsMktIds = JSON.parse(searchParams.get('marketplaceIds'));
        if (searchParams.get('marketplaceNames')) qsMktNames = JSON.parse(searchParams.get('marketplaceNames'));
    } catch(e) {}

    // Support both single marketplaceId and array of marketplaceIds passed from dashboard
    const passedMktIds   = qsMktIds || location.state?.filters?.marketplaceIds;
    const passedMktId    = location.state?.filters?.marketplaceId;
    const passedMktNames = qsMktNames || location.state?.filters?.marketplaceNames || [];

    // Resolve to an array of IDs and build an id→name lookup map
    const _resolvedMktIds = Array.isArray(passedMktIds) && passedMktIds.length > 0
        ? passedMktIds
        : (passedMktId ? [passedMktId] : []);
    const _resolvedNamesMap = {};
    _resolvedMktIds.forEach((id, i) => { _resolvedNamesMap[id] = passedMktNames[i] || id; });

    const [marketplaceFilters, setMarketplaceFilters] = useState(_resolvedMktIds);  // array of ids
    const [marketplaceNamesMap, setMarketplaceNamesMap] = useState(_resolvedNamesMap); // {id: name}
    const debounceTimer = useRef(null);
    const tableContainerRef = useRef(null);
    const autoScrollRaf = useRef(null);

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

    // Client-side account name filter (frontend-only — rows already filtered by marketplaceIds on backend)
    const [accountNameFilter, setAccountNameFilter] = useState('');
    const [sizeFilter, setSizeFilter] = useState('');

    // Marketplace dropdown filter state (new feature)
    const [availableMarketplaces, setAvailableMarketplaces] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [tempMarketplaceFilters, setTempMarketplaceFilters] = useState([]);
    const dropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchMarketplaces = async () => {
        try {
            const { data } = await api.get('/marketplaces/filter-options');
            
            // Only show accounts for the platform(s) of the initially passed IDs
            let platformsToShow = data;
            if (_resolvedMktIds && _resolvedMktIds.length > 0) {
                const matchingPlatforms = data.filter(mp => 
                    mp.accounts?.some(acc => _resolvedMktIds.includes(acc._id))
                );
                if (matchingPlatforms.length > 0) {
                    platformsToShow = matchingPlatforms; 
                }
            }
            setAvailableMarketplaces(platformsToShow);
            
            // Rebuild the names map with ALL available accounts so the table translates IDs correctly
            const fullNamesMap = { ...marketplaceNamesMap };
            data.forEach(mp => {
                mp.accounts?.forEach(acc => {
                    fullNamesMap[acc._id] = acc.name;
                });
            });
            setMarketplaceNamesMap(fullNamesMap);
        } catch (error) {
            console.error('Error fetching marketplaces for filter:', error);
        }
    };

    // Fetch required initialization data on mount
    useEffect(() => {
        fetchMarketplaces();
        fetchCostSheet(1, '', '', true); // isInitialLoad = true
        loadColumnWidths();
    }, []);

    // Also re-fetch cost sheet if marketplaceFilters change
    useEffect(() => {
        // Skip initial mount render since we fetch 1 in the mount hook
        if (loading) return; 
        fetchCostSheet(1, skuFilter, productNameFilter);
    }, [marketplaceFilters]); // Remove from other handlers manually triggering it

    const loadColumnWidths = () => {
        const savedWidths = localStorage.getItem('costSheetColumnWidths');
        if (savedWidths) {
            setColumnWidths(JSON.parse(savedWidths));
        } else {
            // Set default widths
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
        const newWidth = Math.max(80, startWidth.current + diff); // Min width 80px

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
        const col = editableColumns.find(c => c.key === columnKey);
        if (!col || !col.editable) return;
        const colIndex = editableColumns.findIndex(c => c.key === columnKey);

        setIsDragging(true);
        setDragStartCell({ rowIndex, colIndex, columnKey, value: costSheetData[rowIndex][columnKey] });
        setDragEndCell({ rowIndex, colIndex, columnKey });
        setDragPreview({ minRow: rowIndex, maxRow: rowIndex, minColIdx: colIndex, maxColIdx: colIndex });
    };

    // Clicking anywhere on the cell (not on its input/select/fill-handle) starts a drag-select,
    // like clicking a cell in Excel — the tiny corner handle is no longer the only way in.
    const handleCellMouseDown = (e, rowIndex, columnKey) => {
        if (e.target !== e.currentTarget) return;
        handleFillHandleMouseDown(e, rowIndex, columnKey);
    };

    const handleCellMouseEnter = (rowIndex, columnKey) => {
        if (!isDragging || !dragStartCell) return;

        const colIndex = editableColumns.findIndex(c => c.key === columnKey);
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

            // Only a real drag (more than just the anchor cell) counts as an undoable edit
            if (maxRow > minRow || maxColIdx > minColIdx) {
                pushUndoSnapshot();
                lastEditKeyRef.current = null;
            }

            const updatedData = [...costSheetData];
            const calculatedFields = ['product_cost', 'packaging_cost', 'gst_percent', 'packaging_gst_percent',
                'is_product_cost_with_gst', 'return_loss_percent', 'rto_packaging_loss'];

            const anchorRow = dragStartCell.rowIndex;
            for (let colIdx = minColIdx; colIdx <= maxColIdx; colIdx++) {
                const col = editableColumns[colIdx];
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

    const startAutoScroll = useRef(null); // 'up' | 'down' | null (vertical)
    const startAutoScrollX = useRef(null); // 'left' | 'right' | null (horizontal)
    // Always re-read via a ref so the recursive RAF loop never runs on a stale closure
    const doAutoScrollRef = useRef(null);

    doAutoScrollRef.current = () => {
        const dirY = startAutoScroll.current;
        const dirX = startAutoScrollX.current;
        const container = tableContainerRef.current;
        if ((!dirY && !dirX) || !container) {
            // Reset so handleDragMouseMove can restart the loop later without dragEndCell changing
            autoScrollRaf.current = null;
            return;
        }
        if (dirY) container.scrollTop += dirY === 'down' ? AUTO_SCROLL_SPEED : -AUTO_SCROLL_SPEED;
        if (dirX) container.scrollLeft += dirX === 'right' ? AUTO_SCROLL_SPEED : -AUTO_SCROLL_SPEED;
        // Re-evaluate which row/column the cursor is over after scroll
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

        // Auto-scroll near vertical edges
        if (mouseY < rect.top + EDGE_THRESHOLD) {
            startAutoScroll.current = 'up';
        } else if (mouseY > rect.bottom - EDGE_THRESHOLD) {
            startAutoScroll.current = 'down';
        } else {
            startAutoScroll.current = null;
        }

        // Auto-scroll near horizontal edges
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

        // Determine row and column from cursor position
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        const tr = el.closest('tr');
        if (!tr) return;
        const ri = parseInt(tr.dataset.rowIndex, 10);
        const td = el.closest('td[data-col-key]');
        const colKey = td?.dataset.colKey || dragStartCell.columnKey;
        if (!isNaN(ri)) handleCellMouseEnter(ri, colKey);
    };

    // Add mouse up + mouse move listeners when dragging
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('mousemove', handleDragMouseMove);
            return () => {
                document.removeEventListener('mouseup', handleMouseUp);
                document.removeEventListener('mousemove', handleDragMouseMove);
                // Clean up auto-scroll
                startAutoScroll.current = null;
                startAutoScrollX.current = null;
                if (autoScrollRaf.current) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null; }
            };
        }
    }, [isDragging, dragStartCell, dragEndCell, costSheetData]);

    const fetchCostSheet = async (page = 1, sku = '', productName = '', isInitialLoad = false, newSortColumn = sortColumn, newSortOrder = sortOrder) => {
        // Only show main loading indicator on initial page load
        // Use filtering state for subsequent filter/pagination changes
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

        setError('');
        try {
            // Build query string with filters
            let queryParams = `page=${page}&limit=${pageLimit}`;
            if (sku) queryParams += `&sku=${encodeURIComponent(sku)}`;
            if (productName) queryParams += `&product_name=${encodeURIComponent(productName)}`;
            if (marketplaceFilters.length > 0) {
                queryParams += `&marketplaceIds=${encodeURIComponent(JSON.stringify(marketplaceFilters))}`;
            }
            if (newSortColumn && newSortOrder) {
                queryParams += `&sortBy=${encodeURIComponent(newSortColumn)}&sortOrder=${encodeURIComponent(newSortOrder)}`;
            }

            const response = await api.get(`/cost-sheet?${queryParams}`);

            // Always recalculate total_tax and total_cost from current formula
            const rows = (response.data || []).map(row => {
                const hasCostData = row.product_cost || row.packaging_cost;
                if (hasCostData) {
                    const totals = calculateTotals(row);
                    return { ...row, total_tax: totals.total_tax, total_cost: totals.total_cost };
                }
                return row;
            });

            setCostSheetData(rows);

            // Update pagination metadata (stored on response by interceptor)
            if (response.pagination) {
                setCurrentPage(response.pagination.page);
                setTotalPages(response.pagination.total_pages);
                setTotalRows(response.pagination.total_rows);
            }

            // Clear edited rows and undo history when changing page or filters
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
        const isProductCostWithGst = row.is_product_cost_with_gst === 'y';
        const returnLossPercent = parseFloat(row.return_loss_percent) || 0;
        const rtoPackagingLoss = parseFloat(row.rto_packaging_loss) || 0;

        let totalTax = 0;
        let totalCost = 0;

        // Total-Tax = IF(I="Yes", (E-E/(1+G/100))+(F-F/(1+H/100)), E*G/100+F*(H/100))
        // Total-Cost = IF(I="Yes", E+F, E+F+Total-Tax)
        if (isProductCostWithGst) {
            // Both costs are GST-inclusive — extract embedded tax from each
            totalTax = (productCost - productCost / (1 + gstPercent / 100))
                + (packagingCost - packagingCost / (1 + packagingGstPercent / 100));
            totalCost = productCost + packagingCost;
        } else {
            // Both costs are ex-GST — tax is added on top
            totalTax = productCost * (gstPercent / 100) + packagingCost * (packagingGstPercent / 100);
            totalCost = productCost + packagingCost + totalTax;
        }

        return {
            total_tax: totalTax.toFixed(2),
            total_cost: totalCost.toFixed(2)
        };
    };

    // Snapshot current grid state onto the undo stack before applying an edit
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

    // Ctrl+Z / Cmd+Z undoes the last cell edit or fill-drag
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isUndoShortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
            if (!isUndoShortcut) return;

            // Let native undo run in inputs outside the table (search filters, add-SKU form, etc.)
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
        // Coalesce consecutive keystrokes on the same cell into a single undo step
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

        // Auto-calculate totals when relevant fields change
        const calculatedFields = ['product_cost', 'packaging_cost', 'gst_percent', 'packaging_gst_percent',
            'is_product_cost_with_gst', 'return_loss_percent', 'rto_packaging_loss'];

        if (calculatedFields.includes(field)) {
            const totals = calculateTotals(updatedData[rowIndex]);
            updatedData[rowIndex].total_tax = totals.total_tax;
            updatedData[rowIndex].total_cost = totals.total_cost;
        }

        setCostSheetData(updatedData);

        // Mark row as edited
        setEditedRows(prev => new Set([...prev, rowIndex]));
    };

    // Save updated cost sheet
    const handleSave = async () => {
        if (editedRows.size === 0) {
            setError('No changes to save');
            return;
        }

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
                setSuccess(`Successfully updated ${data.updated_count} rows`);
                setEditedRows(new Set());

                setTimeout(() => {
                    fetchCostSheet(currentPage, skuFilter, productNameFilter);
                    setSuccess('');
                }, 2000);
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to update cost sheet');
        } finally {
            setSaving(false);
        }
    };

    // Add new SKU handlers
    const handleNewSkuChange = (field, value) => {
        setNewSkuData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const resetNewSkuForm = () => {
        const allAccounts = availableMarketplaces.flatMap(mp => mp.accounts || []);
        const defaultAccount = allAccounts.find(acc => marketplaceFilters.includes(acc._id));
        setNewSkuData({
            sku: '',
            size: '',
            product_name: '',
            selling_gst: '',
            date: '2020-01-01',
            product_cost: '',
            packaging_cost: '',
            gst_percent: '',
            packaging_gst_percent: '',
            is_product_cost_with_gst: false,
            return_loss_percent: '',
            rto_packaging_loss: '',
            weight_slab: '',
            marketplace_id: defaultAccount?._id || marketplaceFilters[0] || ''
        });
    };

    const handleCancelAddSku = () => {
        resetNewSkuForm();
        setShowAddForm(false);
    };

    const handleAddNewSku = async () => {
        if (!newSkuData.sku || !newSkuData.sku.trim()) {
            toast.error('SKU is required');
            return;
        }

        if (!newSkuData.date) {
            toast.error('Date is required');
            return;
        }

        let isSizeRequired = false;
        if (newSkuData.marketplace_id) {
            const mp = availableMarketplaces.find(m => m.accounts?.some(a => a._id === newSkuData.marketplace_id));
            const acc = mp?.accounts?.find(a => a._id === newSkuData.marketplace_id);
            if (mp?.key === 'Myntra' || (mp?.key === 'Meesho' && acc?.config?.enableSizeWiseCalculation !== false)) {
                isSizeRequired = true;
            }
        }

        if (isSizeRequired && !newSkuData.size) {
            toast.error('Size is required');
            return;
        }

        setAddingNew(true);
        setError('');
        setSuccess('');

        try {
            const payload = { ...newSkuData };
            if (payload.size === '__NA__') {
                payload.size = '';
            }

            const response = await api.post('/cost-sheet', payload);

            if (response.data) {
                setSuccess(`SKU "${newSkuData.sku}" added successfully!`);
                resetNewSkuForm();

                setTimeout(() => {
                    fetchCostSheet(currentPage, skuFilter, productNameFilter);
                    setSuccess('');
                }, 2000);
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Failed to add new SKU';
            setError(errorMsg);
        } finally {
            setAddingNew(false);
        }
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

    // Filter handlers with debouncing
    // These only update local state - they DO NOT trigger re-renders that affect input focus
    const handleSkuFilterChange = (value) => {
        setSkuFilter(value); // Update input value immediately (keeps cursor position)

        // Clear existing timer
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // Debounce API call by 400ms - this updates table data only
        debounceTimer.current = setTimeout(() => {
            setCurrentPage(1); // Reset to page 1 when filter changes
            fetchCostSheet(1, value, productNameFilter, false); // isInitialLoad = false
        }, 400);
    };

    const handleProductNameFilterChange = (value) => {
        setProductNameFilter(value); // Update input value immediately (keeps cursor position)

        // Clear existing timer
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // Debounce API call by 400ms - this updates table data only
        debounceTimer.current = setTimeout(() => {
            setCurrentPage(1); // Reset to page 1 when filter changes
            fetchCostSheet(1, skuFilter, value, false); // isInitialLoad = false
        }, 400);
    };

    const handleClearFilters = () => {
        setSkuFilter('');
        setProductNameFilter('');
        setCurrentPage(1);
        fetchCostSheet(1, '', '', false); // isInitialLoad = false
    };

    // Pagination handlers
    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages) return;

        // Warn if there are unsaved changes
        if (editedRows.size > 0) {
            const confirmChange = window.confirm(
                `You have ${editedRows.size} unsaved changes. Changing page will discard them. Continue?`
            );
            if (!confirmChange) return;
        }

        setCurrentPage(newPage);
        fetchCostSheet(newPage, skuFilter, productNameFilter, false); // isInitialLoad = false
    };

    const handleSort = (column, newSortOrder) => {
        let finalSortColumn = column;
        let finalSortOrder = newSortOrder;

        if (sortColumn === column && sortOrder === newSortOrder) {
            finalSortColumn = null;
            finalSortOrder = null;
        }

        setSortColumn(finalSortColumn);
        setSortOrder(finalSortOrder);
        setCurrentPage(1);
        
        // Warn if there are unsaved changes
        if (editedRows.size > 0) {
            const confirmChange = window.confirm(
                `You have ${editedRows.size} unsaved changes. Changing sort order will discard them. Continue?`
            );
            if (!confirmChange) {
                // Revert sort state
                setSortColumn(sortColumn);
                setSortOrder(sortOrder);
                return;
            }
        }
        
        fetchCostSheet(1, skuFilter, productNameFilter, false, finalSortColumn, finalSortOrder);
    };

    const handlePreviousPage = () => {
        handlePageChange(currentPage - 1);
    };

    const handleNextPage = () => {
        handlePageChange(currentPage + 1);
    };

    // Generate page numbers for pagination UI
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 7;

        if (totalPages <= maxVisiblePages) {
            // Show all pages if total is less than max visible
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Show first page
            pages.push(1);

            // Calculate range around current page
            let startPage = Math.max(2, currentPage - 2);
            let endPage = Math.min(totalPages - 1, currentPage + 2);

            // Add ellipsis after first page if needed
            if (startPage > 2) {
                pages.push('...');
            }

            // Add pages around current page
            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }

            // Add ellipsis before last page if needed
            if (endPage < totalPages - 1) {
                pages.push('...');
            }

            // Show last page
            pages.push(totalPages);
        }

        return pages;
    };

    // Derive isMeeshoView: true only when every selected account belongs to the Meesho platform.
    // Used to conditionally show the Weight Slab field/column (Meesho-only feature).
    const meeshoAccountIds = new Set(
        availableMarketplaces
            .filter(mp => mp.key === 'Meesho')
            .flatMap(mp => mp.accounts?.map(a => a._id) || [])
    );
    const isMeeshoView = marketplaceFilters.length > 0 &&
        marketplaceFilters.every(id => meeshoAccountIds.has(id));

    // Check if ANY selected Meesho account has size-wise calculations disabled
    const hasSizeWiseDisabled = isMeeshoView && marketplaceFilters.some(id => {
        const mp = availableMarketplaces.find(m => m.key === 'Meesho');
        const account = mp?.accounts?.find(a => a._id === id);
        return account?.config?.enableSizeWiseCalculation === false;
    });
    const showMeeshoSize = isMeeshoView && !hasSizeWiseDisabled;

    // Derive isMyntraView: true only when every selected account belongs to Myntra.
    // Used to show style_id / size columns (Myntra-only).
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
            { key: 'size',     label: 'Size',     type: 'text', editable: false, readOnly: true },
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

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-brand-600" size={40} />
            </div>
        );
    }
    let isNewSkuFlipkart = false;
    let showNewSkuSizeField = false;
    if (newSkuData.marketplace_id) {
        const mp = availableMarketplaces.find(m => m.accounts?.some(a => a._id === newSkuData.marketplace_id));
        const acc = mp?.accounts?.find(a => a._id === newSkuData.marketplace_id);
        if (mp?.key === 'Myntra' || (mp?.key === 'Meesho' && acc?.config?.enableSizeWiseCalculation !== false)) {
            showNewSkuSizeField = true;
        }
        if (mp?.key === 'Flipkart') {
            isNewSkuFlipkart = true;
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6" style={{ userSelect: isDragging ? 'none' : 'auto' }}>
            {/* Header */}
            <div className="max-w-full mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard', { state: { activeTab: 'payments' } })}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft size={24} className="text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Cost Sheet</h1>
                            <p className="text-slate-500 text-sm">
                                Page {currentPage} of {totalPages} • {totalRows} total SKUs • {costSheetData.length} on this page • {editedRows.size} unsaved changes
                            </p>
                            {marketplaceFilters.length > 0 && (
                                <div className="mt-2 flex items-center gap-2 text-sm flex-wrap">
                                    <span className="text-slate-600 font-medium">Active Filters:</span>
                                    {marketplaceFilters.map(id => (
                                        <span key={id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                            {marketplaceNamesMap[id] || id}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 relative">
                        {/* Amazon Refund-Loss Toggle */}
                        {isAmazonView && (
                            <div className="flex items-center gap-2 mr-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1 group relative cursor-help">
                                    Refund-Loss Cost:
                                    <Info size={14} className="text-slate-400" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-tight shadow-lg">
                                        consider refund-loss quantity in total-cost
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800"></div>
                                    </div>
                                </span>
                                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => handleAmazonRefundLossToggle(false)}
                                        className={`px-4 py-1.5 text-xs font-medium transition-colors ${hasAmazonRefundLossDisabled
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Off
                                    </button>
                                    <button
                                        onClick={() => handleAmazonRefundLossToggle(true)}
                                        className={`px-4 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${!hasAmazonRefundLossDisabled
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
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => {
                                    if (!isDropdownOpen) setTempMarketplaceFilters([...marketplaceFilters]);
                                    setIsDropdownOpen(!isDropdownOpen);
                                }}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
                                    isDropdownOpen || marketplaceFilters.length > 0 
                                        ? 'border-green-600 bg-green-600 text-white shadow-sm' 
                                        : 'border-green-200 bg-white text-green-700 hover:bg-green-50 hover:border-green-400 shadow-sm'
                                }`}
                            >
                                <Filter size={15} />
                                <span>Filter Accounts</span>
                                {marketplaceFilters.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-white text-green-700 text-[10px] rounded-full font-bold">
                                        {marketplaceFilters.length}
                                    </span>
                                )}
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                                    {/* Dropdown Header - matches green theme */}
                                    <div className="px-4 py-3 bg-green-600 flex items-center justify-between">
                                        <h3 className="font-semibold text-white text-sm">Select Accounts</h3>
                                        <button 
                                            onClick={() => setTempMarketplaceFilters([])}
                                            className="text-xs font-semibold text-green-100 hover:text-white disabled:opacity-40 transition-colors"
                                            disabled={tempMarketplaceFilters.length === 0}
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto p-2">
                                        {availableMarketplaces.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-slate-500">
                                                No accounts connected
                                            </div>
                                        ) : (() => {
                                            const allAccounts = availableMarketplaces.flatMap(mp => mp.accounts || []);
                                            const allAccountIds = allAccounts.map(acc => acc._id);
                                            const isAllSelected = allAccountIds.length > 0 && allAccountIds.every(id => tempMarketplaceFilters.includes(id));
                                            
                                            const handleToggleAll = (e) => {
                                                if (e.target.checked) setTempMarketplaceFilters(allAccountIds);
                                                else setTempMarketplaceFilters([]);
                                            };

                                            return (
                                                <div className="space-y-0.5">
                                                    {/* Select All Toggle */}
                                                    {allAccounts.length > 0 && (
                                                        <label className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg cursor-pointer transition-colors bg-green-50 hover:bg-green-100 border border-green-100 group">
                                                            <input 
                                                                type="checkbox" 
                                                                className="hidden"
                                                                checked={isAllSelected}
                                                                onChange={handleToggleAll}
                                                            />
                                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                                isAllSelected 
                                                                    ? 'bg-green-600 border-green-600' 
                                                                    : 'border-green-300 bg-white group-hover:border-green-500'
                                                            }`}>
                                                                {isAllSelected && <CheckCircle size={10} className="text-white" />}
                                                            </div>
                                                            <span className="text-sm font-semibold text-green-800">
                                                                All Accounts
                                                            </span>
                                                        </label>
                                                    )}
                                                    
                                                    {/* Individual Accounts */}
                                                    {allAccounts.map(account => {
                                                        const isSelected = tempMarketplaceFilters.includes(account._id);
                                                        return (
                                                            <label 
                                                                key={account._id} 
                                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${
                                                                    isSelected ? 'bg-green-50 border border-green-200' : 'border border-transparent hover:bg-slate-50 hover:border-slate-100'
                                                                }`}
                                                            >
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="hidden"
                                                                    checked={isSelected}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setTempMarketplaceFilters(prev => [...prev, account._id]);
                                                                        } else {
                                                                            setTempMarketplaceFilters(prev => prev.filter(id => id !== account._id));
                                                                        }
                                                                    }}
                                                                />
                                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                                    isSelected 
                                                                        ? 'bg-green-600 border-green-600' 
                                                                        : 'border-slate-300 bg-white group-hover:border-green-400'
                                                                }`}>
                                                                    {isSelected && <CheckCircle size={10} className="text-white" />}
                                                                </div>
                                                                <span className={`text-sm ${isSelected ? 'font-semibold text-green-800' : 'text-slate-600'}`}>
                                                                    {account.name}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="p-3 border-t border-slate-100 bg-slate-50">
                                        <button
                                            onClick={() => {
                                                setMarketplaceFilters(tempMarketplaceFilters);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="w-full py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || editedRows.size === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                <span>Update Cost Sheet</span>
                            </>
                        )}
                    </button>
                </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                        <CheckCircle size={20} />
                        <span>{success}</span>
                    </div>
                )}

                {/* Add New SKU Section */}
                <div className="mb-4 bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
                    <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className={`w-full px-6 py-4 flex items-center justify-between transition-all duration-200 ${
                                    showAddForm
                                        ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white'
                                        : 'bg-white hover:bg-brand-50 text-slate-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg ${showAddForm ? 'bg-white/20' : 'bg-brand-100'}`}>
                                        <Plus size={16} className={showAddForm ? 'text-white' : 'text-brand-600'} />
                                    </div>
                                    <div className="text-left">
                                        <span className={`font-semibold text-sm ${showAddForm ? 'text-white' : 'text-slate-800'}`}>Add New SKU</span>
                                        {!showAddForm && (
                                            <p className="text-xs text-slate-400 mt-0.5">Click to expand and add a new cost sheet entry</p>
                                        )}
                                    </div>
                                </div>
                                <div className={`p-1 rounded-lg transition-transform duration-200 ${showAddForm ? 'bg-white/20 rotate-180' : ''}`}>
                                    <ChevronDown size={18} className={showAddForm ? 'text-white' : 'text-slate-400'} />
                                </div>
                            </button>

                            {showAddForm && (
                                <div className="border-t border-blue-100 animate-slideInFromBottom">
                                    <div className="p-6 space-y-6 bg-gradient-to-b from-blue-50/40 to-white">

                                        {/* ── Section 1: Product Information ── */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="h-4 w-1 rounded-full bg-brand-500" />
                                                <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">Product Information</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {availableMarketplaces.flatMap(mp => mp.accounts || []).length > 1 && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                            Marketplace Account <span className="text-red-400 normal-case font-medium">*</span>
                                                        </label>
                                                        <select
                                                            value={newSkuData.marketplace_id}
                                                            onChange={(e) => handleNewSkuChange('marketplace_id', e.target.value)}
                                                            className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                        >
                                                            <option value="">Select Account</option>
                                                            {availableMarketplaces.flatMap(mp => mp.accounts || []).map(acc => (
                                                                <option key={acc._id} value={acc._id}>{acc.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                        SKU <span className="text-red-400 normal-case font-medium">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newSkuData.sku}
                                                        onChange={(e) => handleNewSkuChange('sku', e.target.value)}
                                                        placeholder="Enter SKU"
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    />
                                                </div>
                                                {showNewSkuSizeField && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                            Size <span className="text-red-400 normal-case font-medium">*</span>
                                                        </label>
                                                        <select
                                                            value={newSkuData.size || ''}
                                                            onChange={(e) => handleNewSkuChange('size', e.target.value)}
                                                            className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                        >
                                                            <option value="">Select size</option>
                                                            <option value="__NA__">NA</option>
                                                            {availableSizes.map(sz => (
                                                                <option key={sz} value={sz}>{sz}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Name</label>
                                                    <input
                                                        type="text"
                                                        value={newSkuData.product_name}
                                                        onChange={(e) => handleNewSkuChange('product_name', e.target.value)}
                                                        placeholder="Enter product name"
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100" />

                                        {/* ── Section 2: Costing & GST ── */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="h-4 w-1 rounded-full bg-brand-500" />
                                                <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">Costing &amp; GST</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                        Date <span className="text-red-400 normal-case font-medium">*</span>
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={newSkuData.date}
                                                        onChange={(e) => handleNewSkuChange('date', e.target.value)}
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Cost</label>
                                                    <input
                                                        type="number"
                                                        value={newSkuData.product_cost}
                                                        onChange={(e) => handleNewSkuChange('product_cost', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Packaging Cost</label>
                                                    <input
                                                        type="number"
                                                        value={newSkuData.packaging_cost}
                                                        onChange={(e) => handleNewSkuChange('packaging_cost', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    />
                                                </div>
                                                {isNewSkuFlipkart && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selling GST %</label>
                                                        <select
                                                            value={newSkuData.selling_gst}
                                                            onChange={(e) => handleNewSkuChange('selling_gst', e.target.value)}
                                                            className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                        >
                                                            <option value="">Select Selling GST %</option>
                                                            <option value="0">0%</option>
                                                            <option value="0.25">0.25%</option>
                                                            <option value="1.5">1.5%</option>
                                                            <option value="2.5">2.5%</option>
                                                            <option value="3">3%</option>
                                                            <option value="5">5%</option>
                                                            <option value="6">6%</option>
                                                            <option value="9">9%</option>
                                                            <option value="12">12%</option>
                                                            <option value="14">14%</option>
                                                            <option value="18">18%</option>
                                                            <option value="28">28%</option>
                                                            <option value="40">40%</option>
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">GST %</label>
                                                    <select
                                                        value={newSkuData.gst_percent}
                                                        onChange={(e) => handleNewSkuChange('gst_percent', e.target.value)}
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    >
                                                        <option value="">Select GST %</option>
                                                        <option value="0">0%</option>
                                                        <option value="0.25">0.25%</option>
                                                        <option value="1.5">1.5%</option>
                                                        <option value="2.5">2.5%</option>
                                                        <option value="3">3%</option>
                                                        <option value="5">5%</option>
                                                        <option value="6">6%</option>
                                                        <option value="9">9%</option>
                                                        <option value="12">12%</option>
                                                        <option value="14">14%</option>
                                                        <option value="18">18%</option>
                                                        <option value="28">28%</option>
                                                        <option value="40">40%</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Packaging GST %</label>
                                                    <select
                                                        value={newSkuData.packaging_gst_percent}
                                                        onChange={(e) => handleNewSkuChange('packaging_gst_percent', e.target.value)}
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    >
                                                        <option value="">Select Packaging GST %</option>
                                                        <option value="0">0%</option>
                                                        <option value="0.25">0.25%</option>
                                                        <option value="1.5">1.5%</option>
                                                        <option value="2.5">2.5%</option>
                                                        <option value="3">3%</option>
                                                        <option value="5">5%</option>
                                                        <option value="6">6%</option>
                                                        <option value="9">9%</option>
                                                        <option value="12">12%</option>
                                                        <option value="14">14%</option>
                                                        <option value="18">18%</option>
                                                        <option value="28">28%</option>
                                                        <option value="40">40%</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Cost Includes GST?</label>
                                                    <select
                                                        value={newSkuData.is_product_cost_with_gst ? 'true' : 'false'}
                                                        onChange={(e) => handleNewSkuChange('is_product_cost_with_gst', e.target.value === 'true')}
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    >
                                                        <option value="false">No</option>
                                                        <option value="true">Yes</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100" />

                                        {/* ── Section 3: Loss Parameters ── */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="h-4 w-1 rounded-full bg-brand-500" />
                                                <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">
                                                    Loss Parameters{isMeeshoView ? ' & Weight' : ''}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Return Loss %</label>
                                                    <input
                                                        type="number"
                                                        value={newSkuData.return_loss_percent}
                                                        onChange={(e) => handleNewSkuChange('return_loss_percent', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">RTO Packaging Loss</label>
                                                    <input
                                                        type="number"
                                                        value={newSkuData.rto_packaging_loss}
                                                        onChange={(e) => handleNewSkuChange('rto_packaging_loss', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                    />
                                                </div>
                                                {/* Weight Slab — Meesho only */}
                                                {isMeeshoView && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                                            Weight Slab (g)
                                                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded normal-case tracking-normal">Meesho</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={newSkuData.weight_slab}
                                                            onChange={(e) => handleNewSkuChange('weight_slab', e.target.value)}
                                                            placeholder="e.g. 250"
                                                            className="w-full px-3.5 py-2.5 bg-brand-50 border border-brand-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 transition-all duration-150 shadow-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Action Bar ── */}
                                    <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
                                        <p className="text-xs text-slate-400">
                                            Fields marked <span className="text-red-400 font-semibold">*</span> are required
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleCancelAddSku}
                                                disabled={addingNew}
                                                className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleAddNewSku}
                                                disabled={addingNew}
                                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-lg hover:from-brand-700 hover:to-brand-600 shadow-sm hover:shadow-brand-200 hover:shadow-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                            >
                                                {addingNew ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={15} />
                                                        <span>Adding...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus size={15} />
                                                        <span>Add SKU</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                </div>

            </div>

            {/* Table Container */}
            {/* Thin shimmer progress bar shown during filtering — same as calculations page */}
            {filtering && (
                <div className="w-full h-0.5 bg-slate-200 rounded overflow-hidden mb-2">
                    <div className="h-full progress-bar-shimmer" />
                </div>
            )}
            <div
                className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden transition-opacity duration-200"
                style={{ cursor: isDragging ? 'crosshair' : 'default', opacity: filtering ? 0.5 : 1, pointerEvents: filtering ? 'none' : 'auto' }}
            >
                <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                    <table className="border-collapse" style={{ minWidth: '100%' }}>
                        <thead className="bg-slate-100 sticky top-0 z-20">
                            {/* Column Names Row */}
                            <tr>
                                <th
                                    className="px-4 py-3 text-left text-xs font-semibold text-slate-100 uppercase border-b border-r border-green-200 sticky left-0 bg-green-500 z-30 group"
                                    style={{
                                        width: columnWidths['sku'] || 250,
                                        minWidth: columnWidths['sku'] || 250,
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    onClick={() => handleSort('sku', 'desc')}
                                                    className={`p-0.5 rounded hover:bg-white/20 transition-colors ${sortColumn === 'sku' && sortOrder === 'desc' ? 'bg-white/30' : ''}`}
                                                    title="Sort Descending (highest first)"
                                                >
                                                    <ArrowUp size={12} className={sortColumn === 'sku' && sortOrder === 'desc' ? 'text-white' : 'text-green-200'} />
                                                </button>
                                                <button
                                                    onClick={() => handleSort('sku', 'asc')}
                                                    className={`p-0.5 rounded hover:bg-white/20 transition-colors ${sortColumn === 'sku' && sortOrder === 'asc' ? 'bg-white/30' : ''}`}
                                                    title="Sort Ascending (lowest first)"
                                                >
                                                    <ArrowDown size={12} className={sortColumn === 'sku' && sortOrder === 'asc' ? 'text-white' : 'text-green-200'} />
                                                </button>
                                            </div>
                                            <span>SKU</span>
                                        </div>
                                        <div
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => handleResizeStart(e, 'sku')}
                                        />
                                    </div>
                                </th>
                                {editableColumns.map(col => (
                                    <th
                                        key={col.key}
                                        className="px-4 py-3 text-left text-xs font-semibold text-slate-100 uppercase border-b border-r border-green-200 whitespace-nowrap bg-green-500 relative group"
                                        style={{ width: columnWidths[col.key] || 150, minWidth: columnWidths[col.key] || 150 }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <button
                                                        onClick={() => handleSort(col.key, 'desc')}
                                                        className={`p-0.5 rounded hover:bg-white/20 transition-colors ${sortColumn === col.key && sortOrder === 'desc' ? 'bg-white/30' : ''}`}
                                                        title="Sort Descending (highest first)"
                                                    >
                                                        <ArrowUp size={12} className={sortColumn === col.key && sortOrder === 'desc' ? 'text-white' : 'text-green-200'} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSort(col.key, 'asc')}
                                                        className={`p-0.5 rounded hover:bg-white/20 transition-colors ${sortColumn === col.key && sortOrder === 'asc' ? 'bg-white/30' : ''}`}
                                                        title="Sort Ascending (lowest first)"
                                                    >
                                                        <ArrowDown size={12} className={sortColumn === col.key && sortOrder === 'asc' ? 'text-white' : 'text-green-200'} />
                                                    </button>
                                                </div>
                                                <span>{col.label}</span>
                                            </div>
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                onMouseDown={(e) => handleResizeStart(e, col.key)}
                                            />
                                        </div>
                                    </th>
                                ))}
                            </tr>

                            {/* Search/Filter Row */}
                            <tr>
                                {/* SKU Search */}
                                <th
                                    className="px-2 py-2 border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-30"
                                    style={{
                                        width: columnWidths['sku'] || 250,
                                        minWidth: columnWidths['sku'] || 250,
                                    }}
                                >
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            value={skuFilter}
                                            onChange={(e) => handleSkuFilterChange(e.target.value)}
                                            placeholder="Search SKU..."
                                            className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                        />
                                        {skuFilter && (
                                            <button
                                                onClick={() => handleSkuFilterChange('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </th>


                                {editableColumns.map(col => {
                                    if (col.key === 'account_name') {
                                        return (
                                            <th
                                                key="filter-account_name"
                                                className="px-2 py-2 border-b border-r border-slate-200 bg-slate-50"
                                                style={{ width: columnWidths['account_name'] || 200, minWidth: columnWidths['account_name'] || 200 }}
                                            >
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                    <input
                                                        type="text"
                                                        value={accountNameFilter}
                                                        onChange={(e) => setAccountNameFilter(e.target.value)}
                                                        placeholder="Search account..."
                                                        className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                                    />
                                                    {accountNameFilter && (
                                                        <button
                                                            onClick={() => setAccountNameFilter('')}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    }
                                    if (col.key === 'size') {
                                        return (
                                            <th
                                                key="filter-size"
                                                className="px-2 py-2 border-b border-r border-slate-200 bg-slate-50"
                                                style={{ width: columnWidths['size'] || 100, minWidth: columnWidths['size'] || 100 }}
                                            >
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                    <input
                                                        type="text"
                                                        value={sizeFilter}
                                                        onChange={(e) => setSizeFilter(e.target.value)}
                                                        placeholder="Search size..."
                                                        className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                                    />
                                                    {sizeFilter && (
                                                        <button
                                                            onClick={() => setSizeFilter('')}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    }
                                    if (col.key === 'product_name') {
                                        return (
                                            <th
                                                key="filter-product_name"
                                                className="px-2 py-2 border-b border-r border-slate-200 bg-slate-50"
                                                style={{ width: columnWidths['product_name'] || 150, minWidth: columnWidths['product_name'] || 150 }}
                                            >
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                    <input
                                                        type="text"
                                                        value={productNameFilter}
                                                        onChange={(e) => handleProductNameFilterChange(e.target.value)}
                                                        placeholder="Search product..."
                                                        className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                                    />
                                                    {productNameFilter && (
                                                        <button
                                                            onClick={() => handleProductNameFilterChange('')}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    }
                                    return (
                                        <th
                                            key={`filter-${col.key}`}
                                            className="px-2 py-2 border-b border-r border-slate-200 bg-slate-50"
                                            style={{ width: columnWidths[col.key] || 150, minWidth: columnWidths[col.key] || 150 }}
                                        >
                                            {/* Empty cell */}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {costSheetData
                                .filter(row => {
                                    let matches = true;
                                    if (accountNameFilter) {
                                        const name = marketplaceNamesMap[row.marketplace_id] || row.marketplace_id || '';
                                        if (!name.toLowerCase().includes(accountNameFilter.toLowerCase())) matches = false;
                                    }
                                    if (sizeFilter) {
                                        const displaySize = (!row.size && isMeeshoView) ? 'NA' : (row.size || '');
                                        if (displaySize.toLowerCase() !== sizeFilter.toLowerCase()) matches = false;
                                    }
                                    return matches;
                                })
                                .map((row, rowIndex) => (
                                <tr
                                    key={row.id}
                                    data-row-index={rowIndex}
                                    className={`hover:bg-slate-50 ${editedRows.has(rowIndex) ? 'bg-yellow-50' : ''}`}
                                >

                                    {/* Read-only: SKU */}
                                    <td
                                        className="px-4 py-3 text-sm text-slate-700 border-b border-slate-100 bg-slate-50 sticky left-0 z-10"
                                        style={{
                                            width: columnWidths['sku'] || 250,
                                            // left: columnWidths['tenant_id'] || 200
                                        }}
                                    >
                                        <input
                                            type="text"
                                            value={row.sku || ''}
                                            disabled
                                            className="w-full bg-transparent border-none outline-none cursor-not-allowed text-slate-500 font-medium"
                                        />
                                    </td>

                                    {/* Editable columns */}
                                    {editableColumns.map((col, colIndex) => (
                                        <td
                                            key={col.key}
                                            data-col-key={col.key}
                                            className={`px-4 py-3 text-sm border-b border-slate-100 ${!col.editable ? 'bg-slate-50' : ''} ${
                                                dragPreview &&
                                                rowIndex >= dragPreview.minRow && rowIndex <= dragPreview.maxRow &&
                                                colIndex >= dragPreview.minColIdx && colIndex <= dragPreview.maxColIdx
                                                    ? 'bg-blue-100 border-2 border-blue-400' : ''
                                            } relative group`}
                                            style={{ width: columnWidths[col.key] || 150 }}
                                            onMouseDown={(e) => col.editable && handleCellMouseDown(e, rowIndex, col.key)}
                                            onMouseEnter={() => handleCellMouseEnter(rowIndex, col.key)}
                                        >
                                            {col.type === 'select' && col.editable ? (() => {
                                                const isYN = col.options[0] === 'y' || col.options[0] === 'n';
                                                // Normalize the raw value to a string for matching
                                                const rawVal = row[col.key];
                                                // Strip trailing % if present (handles legacy "1.5%" format)
                                                const currentVal = rawVal != null && rawVal !== ''
                                                    ? String(rawVal).replace(/%$/, '').trim()
                                                    : '';
                                                // Check if current value matches a standard option
                                                const isStandardVal = currentVal === '' || col.options.includes(currentVal);
                                                return (
                                                    <select
                                                        value={currentVal}
                                                        onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                                                        className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                                                    >
                                                        <option value="">Select...</option>
                                                        {/* Show current non-standard value as an option so it never shows "Select..." */}
                                                        {currentVal !== '' && !isStandardVal && (
                                                            <option value={currentVal}>
                                                                {currentVal}{!isYN ? '% (current)' : ''}
                                                            </option>
                                                        )}
                                                        {col.options.map(option => (
                                                            <option key={option} value={option}>
                                                                {option}{!isYN ? '%' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                );
                                            })() : col.readOnly ? (
                                                /* Read-only resolved display (e.g. account_name from marketplace_id) */
                                                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">
                                                    {col.key === 'account_name'
                                                        ? (marketplaceNamesMap[row.marketplace_id] || row.marketplace_id || '—')
                                                        : (col.key === 'size' && !row.size && isMeeshoView ? 'NA' : (row[col.key] ?? '—'))}
                                                </span>
                                            ) : (
                                                <input
                                                    type={col.type}
                                                    value={row[col.key] ?? ''}
                                                    onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                                                    disabled={!col.editable}
                                                    className={`w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 ${!col.editable ? 'bg-blue-50 cursor-not-allowed text-blue-700 font-semibold' : ''
                                                        }`}
                                                />
                                            )}

                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="mt-6 bg-white rounded-lg shadow-md border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                            Showing {((currentPage - 1) * pageLimit) + 1} to {Math.min(currentPage * pageLimit, totalRows)} of {totalRows} SKUs
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Previous Button */}
                            <button
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>

                            {/* Page Numbers */}
                            <div className="flex items-center gap-1">
                                {getPageNumbers().map((page, index) => (
                                    page === '...' ? (
                                        <span key={`ellipsis-${index}`} className="px-3 py-2 text-slate-400">
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`min-w-[40px] px-3 py-2 rounded-lg transition-colors ${currentPage === page
                                                ? 'bg-brand-600 text-white font-semibold'
                                                : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
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
                                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {costSheetData.length === 0 && !loading && (
                <div className="text-center py-12 bg-white rounded-lg shadow-md border border-slate-200">
                    <div className="text-slate-500">
                        {skuFilter || productNameFilter ? (
                            <>
                                <Search className="inline-block mb-4 text-slate-400" size={48} />
                                <p className="text-lg font-medium">No results found</p>
                                <p className="text-sm mt-2">Try adjusting your search filters</p>
                                <button
                                    onClick={handleClearFilters}
                                    className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                                >
                                    Clear Filters
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-medium">No cost sheet data found</p>
                                <p className="text-sm mt-2">Please generate a cost sheet first</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CostSheet;
