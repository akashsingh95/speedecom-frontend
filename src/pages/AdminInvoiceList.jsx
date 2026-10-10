import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import { useAuth } from '../AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import Tooltip from '../components/Tooltip';
import ConfirmModal from '../components/ConfirmModal';
import GstAutoFill from '../components/GstAutoFill';
import DateRangePicker from '../components/DateRangePicker';
import { parseGstin, STATE_CODES } from '../utils/gstinUtils';
import {
    Search, Plus, Trash2, Pencil, FileText, Loader2, X, CheckCircle,
    Building2, User, Gift, Award,
    Download, ChevronLeft, ChevronRight, ArrowUpDown,
    MoreVertical, Mail, Printer, FileSpreadsheet, CalendarDays, ChevronDown, RotateCw, Package
} from 'lucide-react';

const GST_RATE = Number(import.meta.env.VITE_GST_RATE || 18);

const formatDateDDMMYYYY = (date) => {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
};

// Local (browser-timezone) YYYY-MM-DD / HH:mm — avoids the UTC-shift bug from toISOString()
const getLocalDateInputValue = (date = new Date()) => {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

const getLocalTimeInputValue = (date = new Date()) => {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Combines a date-only + time-only input into an absolute timestamp anchored to IST,
// so the stored value matches the wall-clock date/time regardless of server timezone.
const combineDateTimeAsIST = (dateStr, timeStr) => `${dateStr}T${timeStr}:00+05:30`;

const amountInWords = (amount) => {
    const n = Math.round(Number(amount) || 0);
    if (n === 0) return 'Zero Rupees';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const conv = (v) => {
        if (v === 0) return '';
        if (v < 20) return ones[v];
        if (v < 100) return tens[Math.floor(v / 10)] + (v % 10 ? ' ' + ones[v % 10] : '');
        if (v < 1000) return ones[Math.floor(v / 100)] + ' Hundred' + (v % 100 ? ' ' + conv(v % 100) : '');
        if (v < 100000) return conv(Math.floor(v / 1000)) + ' Thousand' + (v % 1000 ? ' ' + conv(v % 1000) : '');
        if (v < 10000000) return conv(Math.floor(v / 100000)) + ' Lakh' + (v % 100000 ? ' ' + conv(v % 100000) : '');
        return conv(Math.floor(v / 10000000)) + ' Crore' + (v % 10000000 ? ' ' + conv(v % 10000000) : '');
    };
    return `${conv(n)} Rupees`;
};

const getPageNumbers = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
};

const AdminInvoiceList = () => {
    const { user } = useAuth();
    const canExport = user?.role === 'SuperAdmin' || !!user?.permissions?.exportInvoices;
    const canDeleteInvoice = user?.role === 'SuperAdmin';
    const canCancelInvoice = user?.role === 'SuperAdmin';
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        if (!drawerOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [drawerOpen]);

    const [buyerQuery, setBuyerQuery] = useState('');
    const [buyers, setBuyers] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
    const [selectedBuyer, setSelectedBuyer] = useState(null);
    const [companyStateCode, setCompanyStateCode] = useState('');

    const [lineItems, setLineItems] = useState([
        { description: '', sacCode: '998314', quantity: 1, rate: 0, amount: 0 },
    ]);
    const [savedItems, setSavedItems] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentMethodError, setPaymentMethodError] = useState(false);
    const [utrNumber, setUtrNumber] = useState('');
    const [invoiceDescription, setInvoiceDescription] = useState('');
    const [transactionDate, setTransactionDate] = useState(() => getLocalDateInputValue());
    const [createdDateDisplay, setCreatedDateDisplay] = useState(() => getLocalDateInputValue());
    const [giveFreeCredits, setGiveFreeCredits] = useState(false);
    const [isB2C, setIsB2C] = useState(false);
    const [addCreditsOnCreate, setAddCreditsOnCreate] = useState(true);
    const [creditsToAdd, setCreditsToAdd] = useState('');
    const [remarks, setRemarks] = useState('Free trial credits');
    const [roundOff, setRoundOff] = useState(false);
    const [roundOffAmount, setRoundOffAmount] = useState(0);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        api.get('/admin/saved-items').then(({ data }) => {
            if (data) setSavedItems(data);
        }).catch(() => {});
    }, []);

    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [billingTypeFilter, setBillingTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('invoices');
    const creditTypeFilter = activeTab === 'adminGift' ? 'ADMIN_GIFT' : 'FREE_TRIAL_CREDIT';
    const [creditHistory, setCreditHistory] = useState([]);
    const [creditLoading, setCreditLoading] = useState(false);
    const [creditSearchTerm, setCreditSearchTerm] = useState('');
    const [debouncedCreditSearch, setDebouncedCreditSearch] = useState('');
    const [viewPdf, setViewPdf] = useState(null);
    const [viewingInvoice, setViewingInvoice] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [editInvoiceSeq, setEditInvoiceSeq] = useState('');
    const originalSnapshot = useRef(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPosition, setMenuPosition] = useState(null);
    const pdfBlobCache = useRef({});
    const [sendingEmailId, setSendingEmailId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [confirmCancel, setConfirmCancel] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [verifyingId, setVerifyingId] = useState(null);
    const menuRef = useRef(null);
    const gstButtonRef = useRef(null);

    useEffect(() => {
        const cache = pdfBlobCache.current;
        return () => { Object.values(cache).forEach(url => { try { window.URL.revokeObjectURL(url); } catch {} }); };
    }, []);

    const [sortBy, setSortBy] = useState('invoiceNumber');
    const [sortOrder, setSortOrder] = useState('desc');
    const [invoicePagination, setInvoicePagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [creditPagination, setCreditPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

    const today = new Date();
    const getDefaultStartDate = () => {
        const d = new Date(today);
        d.setDate(d.getDate() - 30);
        return getLocalDateInputValue(d);
    };
    const getDefaultEndDate = () => getLocalDateInputValue(today);
    const [startDate, setStartDate] = useState(getDefaultStartDate());
    const [endDate, setEndDate] = useState(getDefaultEndDate());
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingZip, setExportingZip] = useState(false);
    const [exportingCreditExcel, setExportingCreditExcel] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const exportMenuRef = useRef(null);
    const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
    const dateDropdownRef = useRef(null);
    const [showFilters, setShowFilters] = useState(false);
    const filterRef = useRef(null);
    const [creditStartDate, setCreditStartDate] = useState('');
    const [creditEndDate, setCreditEndDate] = useState('');
    const [creditDateDropdownOpen, setCreditDateDropdownOpen] = useState(false);
    const creditDateDropdownRef = useRef(null);
    const [fyFilter, setFyFilter] = useState('');
    const [availableFYs, setAvailableFYs] = useState([]);

    const fyLabel = (code) => code ? `20${code.slice(0, 2)}-20${code.slice(2, 4)}` : '';

    useEffect(() => {
        api.get('/admin/invoices/company-info').then(({ data }) => {
            if (data?.stateCode) setCompanyStateCode(data.stateCode);
            if (data?.availableFYs) setAvailableFYs(data.availableFYs);
            if (data?.currentFY) setFyFilter(data.currentFY);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
                setMenuPosition(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!openMenuId) return;
        const closeMenu = () => {
            setOpenMenuId(null);
            setMenuPosition(null);
        };
        window.addEventListener('scroll', closeMenu, true);
        window.addEventListener('resize', closeMenu);
        return () => {
            window.removeEventListener('scroll', closeMenu, true);
            window.removeEventListener('resize', closeMenu);
        };
    }, [openMenuId]);

    useEffect(() => {
        const handler = (e) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
                setExportMenuOpen(false);
            }
        };
        if (exportMenuOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [exportMenuOpen]);

    useEffect(() => {
        const handler = (e) => {
            if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
                setDateDropdownOpen(false);
            }
        };
        if (dateDropdownOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [dateDropdownOpen]);

    useEffect(() => {
        const handler = (e) => {
            if (creditDateDropdownRef.current && !creditDateDropdownRef.current.contains(e.target)) {
                setCreditDateDropdownOpen(false);
            }
        };
        if (creditDateDropdownOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [creditDateDropdownOpen]);

    useEffect(() => {
        const handler = (e) => {
            if (filterRef.current && !filterRef.current.contains(e.target)) {
                setShowFilters(false);
            }
        };
        if (showFilters) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showFilters]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape' && viewPdf) {
                setViewPdf(null);
                setViewingInvoice(null);
            }
        };
        if (viewPdf) document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [viewPdf]);

    const fetchInvoices = useCallback(async (pageNum = 1, search = '', source = 'all', status = 'all', sDate = startDate, eDate = endDate, fy = fyFilter, billingType = billingTypeFilter) => {
        setLoading(true);
        try {
            const params = { page: pageNum, limit: 10 };
            const tidMatch = search.trim().match(/^\d+$/);
            const processedSearch = tidMatch ? tidMatch[0] : search;
            if (processedSearch) params.q = processedSearch;
            if (source !== 'all') params.source = source;
            if (status !== 'all') params.status = status;
            if (sDate) params.startDate = sDate;
            if (eDate) params.endDate = eDate;
            if (fy && fy !== 'all') params.fy = fy;
            if (billingType !== 'all') params.billingType = billingType;
            params.sortBy = sortBy;
            params.sortOrder = sortOrder;
            const { data } = await api.get('/admin/invoices/list', { params });
            setInvoices(data?.invoices || []);
            setInvoicePagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
            setSelectedIds([]);
        } catch {
            toast.error('Failed to load invoices');
        } finally {
            setLoading(false);
        }
    }, [sortBy, sortOrder]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (activeTab === 'invoices') {
            fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter);
        }
    }, [activeTab, fetchInvoices, debouncedSearchTerm, sourceFilter, billingTypeFilter, statusFilter, startDate, endDate, fyFilter, sortBy, sortOrder]);

    const fetchCreditHistory = useCallback(async (pageNum = 1, search = '', type = 'all', sDate = '', eDate = '') => {
        setCreditLoading(true);
        try {
            const params = { page: pageNum, limit: 10 };
            if (search) params.q = search;
            if (type !== 'all') params.type = type;
            if (sDate) params.startDate = sDate;
            if (eDate) params.endDate = eDate;
            const { data } = await api.get('/admin/invoices/credits-history', { params });
            setCreditHistory(data?.transactions || []);
            setCreditPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        } catch {
            toast.error('Failed to load credit history');
        } finally {
            setCreditLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedCreditSearch(creditSearchTerm), 400);
        return () => clearTimeout(timer);
    }, [creditSearchTerm]);

    useEffect(() => {
        if (activeTab === 'freeTrialCredits' || activeTab === 'adminGift') {
            fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate);
        }
    }, [activeTab, fetchCreditHistory, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate]);

    const fetchBuyers = useCallback(async (q) => {
        setSearching(true);
        try {
            const url = q ? `/admin/invoices/buyers?q=${encodeURIComponent(q)}` : '/admin/invoices/buyers';
            const { data } = await api.get(url);
            setBuyers(data || []);
        } catch {} finally { setSearching(false); }
    }, []);

    const debounceTimer = React.useRef(null);
    const handleBuyerInput = (value) => {
        setBuyerQuery(value);
        if (value && value.length >= 2) {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            const tidMatch = value.trim().match(/^\d+$/);
            const searchQ = tidMatch ? tidMatch[0] : value;
            debounceTimer.current = setTimeout(() => fetchBuyers(searchQ), 300);
        } else if (!value) {
            setSelectedBuyer(null);
            fetchBuyers('');
        }
    };

    const openBuyerDropdown = () => {
        setShowBuyerDropdown(true);
        if (!buyerQuery) fetchBuyers('');
    };

    const closeBuyerDropdown = () => {
        setTimeout(() => setShowBuyerDropdown(false), 200);
    };

    const selectBuyer = (b) => {
        const buyerCopy = { ...b };
        const parsed = parseGstin(buyerCopy.gstin);
        if (parsed.valid) {
            buyerCopy.stateCode = parsed.stateCode;
            buyerCopy.state = parsed.stateName || buyerCopy.state;
            buyerCopy.pan = parsed.pan || buyerCopy.pan;
        }
        setSelectedBuyer(buyerCopy);
        setBuyerQuery('');
        setBuyers([]);
        setShowBuyerDropdown(false);
    };

    const clearBuyer = () => {
        setSelectedBuyer(null);
        setBuyerQuery('');
    };

    const updateBuyerField = (field, value) => {
        const buyer = selectedBuyer || { name: buyerQuery.trim() };
        const updated = { ...buyer, [field]: value };
        if (field === 'gstin') {
            const parsed = parseGstin(value);
            if (parsed.valid) {
                updated.stateCode = parsed.stateCode;
                updated.state = parsed.stateName || updated.state;
                updated.pan = parsed.pan;
            } else {
                const firstTwo = value.trim().slice(0, 2);
                if (/^[0-9]{2}$/.test(firstTwo)) {
                    updated.stateCode = firstTwo;
                    updated.state = STATE_CODES[firstTwo] || '';
                } else {
                    updated.stateCode = '';
                    updated.state = '';
                }
            }
        } else if (field === 'stateCode') {
            const cleanVal = value.trim();
            if (STATE_CODES[cleanVal]) {
                updated.state = STATE_CODES[cleanVal];
            }
        }
        setSelectedBuyer(updated);
    };

    const updateLineItem = (i, field, value) => {
        const items = [...lineItems];
        items[i][field] = value;
        if (field === 'quantity' || field === 'rate') {
            items[i].amount = Number(items[i].quantity) * Number(items[i].rate);
        }
        setLineItems(items);
    };

    const addLineItem = () => {
        setLineItems([...lineItems, { description: '', sacCode: '998314', quantity: 1, rate: 0, amount: 0 }]);
    };

    const removeLineItem = (i) => {
        if (lineItems.length === 1) return;
        setLineItems(lineItems.filter((_, idx) => idx !== i));
    };

    const baseAmount = lineItems.reduce((s, item) => s + Number(item.amount), 0);
    const activeBuyer = selectedBuyer || (buyerQuery.trim() ? { name: buyerQuery.trim() } : null);
    const parsedGstin = activeBuyer?.gstin ? parseGstin(activeBuyer.gstin) : null;
    const buyerStateCode = parsedGstin?.valid ? parsedGstin.stateCode : (activeBuyer?.stateCode || '');
    const isInterState = !!(companyStateCode && buyerStateCode && companyStateCode !== buyerStateCode);
    const halfGstRate = GST_RATE / 2;
    const igstAmount = isInterState ? parseFloat((baseAmount * GST_RATE / 100).toFixed(2)) : 0;
    const cgstAmount = !isInterState ? parseFloat((baseAmount * halfGstRate / 100).toFixed(2)) : 0;
    const sgstAmount = !isInterState ? parseFloat((baseAmount * halfGstRate / 100).toFixed(2)) : 0;
    const totalAmount = isB2C ? baseAmount.toFixed(2) : (baseAmount + (isInterState ? igstAmount : cgstAmount + sgstAmount)).toFixed(2);

    const normalizeItem = (item) => ({
        description: String(item.description || ''),
        sacCode: String(item.sacCode || ''),
        quantity: Number(item.quantity) || 0,
        rate: Number(item.rate) || 0,
        amount: Number(item.amount) || 0,
    });

    const lineItemsEqual = (a, b) => {
        if (a.length !== b.length) return false;
        return a.every((item, i) => {
            const na = normalizeItem(item);
            const nb = normalizeItem(b[i]);
            return na.description === nb.description &&
                   na.sacCode === nb.sacCode &&
                   na.quantity === nb.quantity &&
                   na.rate === nb.rate &&
                   na.amount === nb.amount;
        });
    };

    const calculateRoundOff = useCallback(() => {
        try {
            const baseAmount = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            if (baseAmount <= 0) {
                setRoundOffAmount(0);
                return;
            }

            const gstRate = GST_RATE / 100;
            const sellerStateCode = companyStateCode || '24';
            const buyerStateCode = selectedBuyer?.stateCode || '24';
            const isInterState = sellerStateCode !== buyerStateCode;

            let totalAmount;
            if (isB2C) {
                totalAmount = baseAmount;
            } else if (isInterState) {
                const igst = baseAmount * gstRate;
                totalAmount = baseAmount + igst;
            } else {
                const halfRate = gstRate / 2;
                const cgst = baseAmount * halfRate;
                const sgst = baseAmount * halfRate;
                totalAmount = baseAmount + cgst + sgst;
            }

            const roundedTotal = Math.round(totalAmount);
            const difference = roundedTotal - totalAmount;
            setRoundOffAmount(parseFloat(difference.toFixed(2)));
        } catch (error) {
            console.error('Error calculating round off:', error);
            setRoundOffAmount(0);
        }
    }, [lineItems, isB2C, selectedBuyer, companyStateCode]);

    useEffect(() => {
        if (lineItems.length > 0) {
            calculateRoundOff();
        }
    }, [calculateRoundOff, lineItems]);

    const snap = editingInvoice ? originalSnapshot.current : null;
    const hasUnsavedChanges = snap && (
        buyerQuery !== snap.buyerName ||
        selectedBuyer?._id !== snap.tenantId ||
        (selectedBuyer?.gstin || '') !== (snap.gstin || '') ||
        (selectedBuyer?.pan || '') !== (snap.pan || '') ||
        (selectedBuyer?.address || '') !== (snap.address || '') ||
        (selectedBuyer?.state || '') !== (snap.state || '') ||
        (selectedBuyer?.stateCode || '') !== (snap.stateCode || '') ||
        (selectedBuyer?.phone || '') !== (snap.phone || '') ||
        paymentMethod !== snap.paymentMethod ||
        (utrNumber || '') !== (snap.utrNumber || '') ||
        (invoiceDescription || '') !== (snap.description || '') ||
        transactionDate !== snap.transactionDate ||
        !lineItemsEqual(lineItems, snap.lineItems) ||
        addCreditsOnCreate !== snap.addCreditsOnCreate ||
        (user?.role === 'SuperAdmin' && editInvoiceSeq !== snap.invoiceSeq)
    );

    const handleCreate = async () => {
        if (giveFreeCredits) {
            if (!selectedBuyer?._id) { toast.error('Please select an existing buyer from the search results'); return; }
            const creditsVal = Math.round(Number(creditsToAdd) * 100) / 100;
            if (!creditsVal || creditsVal <= 0) { toast.error('Enter a valid credit amount'); return; }

            setCreating(true);
            try {
                const { data } = await api.post('/admin/invoices/create', {
                    tenantId: selectedBuyer._id,
                    buyer: {
                        name: selectedBuyer.name,
                        gstin: selectedBuyer?.gstin || '',
                        pan: parsedGstin?.pan || selectedBuyer?.pan || '',
                        address: selectedBuyer?.address || '',
                        state: parsedGstin?.stateName || selectedBuyer?.state || '',
                        stateCode: parsedGstin?.stateCode || selectedBuyer?.stateCode || '',
                        phone: selectedBuyer?.phone || '',
                    },
                    lineItems: [],
                    description: invoiceDescription || '',
                    creditsToAdd: creditsVal,
                    invoiceDate: combineDateTimeAsIST(transactionDate, getLocalTimeInputValue()),
                });

                const msg = data.creditsGiven
                    ? `${data.creditsGiven} credits added to ${selectedBuyer.name}`
                    : 'Credits added successfully';
                toast.success(msg);
                handleCloseDrawer();
                fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter);
                if (activeTab === 'freeTrialCredits' || activeTab === 'adminGift') fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate);
            } catch { toast.error('Failed to add credits'); } finally { setCreating(false); }
            return;
        }

        const buyerName = selectedBuyer?.name || buyerQuery.trim();
        if (!buyerName) { toast.error('Enter a buyer name'); return; }

        if (!isB2C) {
            const buyerGstin = selectedBuyer?.gstin?.trim() || '';
            if (!buyerGstin) { toast.error('GSTIN is required'); return; }
            const buyerAddress = selectedBuyer?.address?.trim() || '';
            const buyerState = selectedBuyer?.state?.trim() || '';
            if (!buyerAddress || !buyerState) { toast.error('Please provide buyer address and state'); return; }
        }
        if (!lineItems.some(item => Number(item.amount) > 0)) { toast.error('Add at least one line item with amount'); return; }
        if (!paymentMethod) { toast.error('Please select a payment mode'); setPaymentMethodError(true); return; }

        const isEdit = !!editingInvoice;
        setCreating(true);
        try {
            const payload = {
                billingType: isB2C ? 'B2C' : 'B2B',
                tenantId: selectedBuyer?._id || null,
                buyer: {
                    name: buyerName,
                    organizationName: isB2C ? (selectedBuyer?.orgName || buyerQuery.trim() || buyerName) : (selectedBuyer?.gstBusinessName || selectedBuyer?.orgName || buyerName),
                    gstin: selectedBuyer?.gstin || '',
                    pan: parsedGstin?.pan || selectedBuyer?.pan || '',
                    address: selectedBuyer?.address || '',
                    state: parsedGstin?.stateName || selectedBuyer?.state || '',
                    stateCode: parsedGstin?.stateCode || selectedBuyer?.stateCode || '',
                    phone: selectedBuyer?.phone || '',
                },
                lineItems: lineItems.map(item => ({
                    description: item.description || 'Service',
                    sacCode: item.sacCode || '998314',
                    quantity: Number(item.quantity) || 1,
                    rate: Number(item.rate) || 0,
                    amount: Number(item.amount) || 0,
                })),
                paymentMethod,
                description: invoiceDescription || '',
                invoiceDate: combineDateTimeAsIST(transactionDate, getLocalTimeInputValue()),
                ...(utrNumber && { utrNumber }),
                roundOff: true,
                ...(roundOffAmount > 0 && { roundOffAmount }),
            };

            if (isEdit) {
                const invParts = (editingInvoice.invoiceNumber || '').split('/');
                const newFullNumber = invParts.length === 3 ? `${invParts[0]}/${invParts[1]}/${String(parseInt(editInvoiceSeq, 10)).padStart(3, '0')}` : editingInvoice.invoiceNumber;
                const creditsValue = addCreditsOnCreate ? (isB2C ? baseAmount / (1 + GST_RATE / 100) : baseAmount) : 0;
                await api.put(`/admin/invoices/update/${editingInvoice._id}`, { ...payload, invoiceNumber: editInvoiceSeq, creditsValue });
                toast.success(`Invoice ${newFullNumber} updated`);
            } else {
                const creditsValue = addCreditsOnCreate ? (isB2C ? baseAmount / (1 + GST_RATE / 100) : baseAmount) : 0;
                const { data } = await api.post('/admin/invoices/create', { ...payload, creditsToAdd: creditsValue });
                const msg = data.creditsGiven
                    ? `Invoice ${data.invoiceNumber} created + ₹${data.creditsGiven} credits added`
                    : `Invoice ${data.invoiceNumber} created successfully`;
                toast.success(msg);
            }

            handleCloseDrawer();
            fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter);
            if (activeTab === 'freeTrialCredits' || activeTab === 'adminGift') fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate);

            if (!isEdit) {
                const itemsToSave = lineItems.filter(i => i.description).map(i => ({
                    description: i.description, sacCode: i.sacCode || '998314', rate: i.rate || 0,
                }));
                if (itemsToSave.length > 0) {
                    api.post('/admin/saved-items', { items: itemsToSave }).then(({ data: savedData }) => {
                        if (savedData) setSavedItems(prev => {
                            const merged = [...prev];
                            savedData.forEach(s => {
                                const idx = merged.findIndex(x => x.description === s.description);
                                if (idx !== -1) merged[idx] = s;
                                else merged.push(s);
                            });
                            return merged;
                        });
                    }).catch(() => {});
                }
            }
        } catch { toast.error(isEdit ? 'Failed to update invoice' : 'Failed to create invoice'); } finally { setCreating(false); }
    };

    const handleOpenDrawer = (invoice = null, openAsCredit = false) => {
        if (invoice) {
            setEditingInvoice(invoice);
            const invoiceSeq = (invoice.invoiceNumber || '').split('/');
            const seqVal = invoiceSeq.length === 3 ? String(parseInt(invoiceSeq[2], 10)) : '';
            const mappedItems = (invoice.lineItems || []).map(item => ({
                description: item.description || '',
                sacCode: item.sacCode || '998314',
                quantity: item.quantity || 1,
                rate: item.rate || 0,
                amount: item.amount || 0,
            }));
            const hadCredits = (invoice.creditsAdded || 0) > 0;
            setAddCreditsOnCreate(hadCredits);
            originalSnapshot.current = {
                buyerName: invoice.buyer?.name || '',
                orgName: invoice.buyer?.name || '',
                gstin: invoice.buyer?.gstin || '',
                pan: invoice.buyer?.pan || '',
                address: invoice.buyer?.address || '',
                state: invoice.buyer?.state || '',
                stateCode: invoice.buyer?.stateCode || '',
                phone: invoice.buyer?.phone || '',
                tenantId: invoice.tenantId || '',
                lineItems: JSON.parse(JSON.stringify(mappedItems)),
                paymentMethod: invoice.paymentMethod || '',
                utrNumber: invoice.razorpayOrderId || '',
                description: invoice.planName && invoice.planName !== 'Manual Invoice' ? invoice.planName : '',
                transactionDate: (invoice.invoiceDate || invoice.createdAt) ? getLocalDateInputValue(invoice.invoiceDate || invoice.createdAt) : getLocalDateInputValue(),
                invoiceSeq: seqVal,
                addCreditsOnCreate: hadCredits,
            };
            setSelectedBuyer({
                _id: invoice.tenantId || '',
                tenantId: invoice._tenantId || '',
                name: invoice.buyer?.name || '',
                orgName: invoice.buyer?.name || '',
                gstin: invoice.buyer?.gstin || '',
                pan: invoice.buyer?.pan || '',
                address: invoice.buyer?.address || '',
                state: invoice.buyer?.state || '',
                stateCode: invoice.buyer?.stateCode || '',
                phone: invoice.buyer?.phone || '',
            });
            setBuyerQuery(invoice.buyer?.name || '');
            setLineItems(mappedItems);
            setPaymentMethod(invoice.paymentMethod || '');
            setPaymentMethodError(false);
            setInvoiceDescription(invoice.planName && invoice.planName !== 'Manual Invoice' ? invoice.planName : '');
            setUtrNumber(invoice.razorpayOrderId || '');
            setGiveFreeCredits(false);
            setIsB2C(invoice.billingType === 'B2C');
            setEditInvoiceSeq(seqVal);
            const sourceDate = invoice.invoiceDate || invoice.createdAt;
            setTransactionDate(sourceDate ? getLocalDateInputValue(sourceDate) : getLocalDateInputValue());
            setCreatedDateDisplay(invoice.createdAt ? getLocalDateInputValue(invoice.createdAt) : getLocalDateInputValue());
        } else {
            setEditingInvoice(null);
            originalSnapshot.current = null;
            clearBuyer();
            setIsB2C(false);
            setAddCreditsOnCreate(true);
            setLineItems([{ description: '', sacCode: '998314', quantity: 1, rate: 0, amount: 0 }]);
            setInvoiceDescription('');
            setPaymentMethod('');
            setPaymentMethodError(false);
            setUtrNumber('');
            setRoundOff(false);
            setRoundOffAmount(0);
            setGiveFreeCredits(openAsCredit);
            setCreditsToAdd('');
            setRemarks('Free trial credits');
            setTransactionDate(getLocalDateInputValue());
            setCreatedDateDisplay(getLocalDateInputValue());
        }
        setDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setDrawerOpen(false);
        setEditingInvoice(null);
        setEditInvoiceSeq('');
        originalSnapshot.current = null;
        clearBuyer();
        setAddCreditsOnCreate(true);
        setLineItems([{ description: '', sacCode: '998314', quantity: 1, rate: 0, amount: 0 }]);
        setInvoiceDescription('');
        setPaymentMethod('');
        setPaymentMethodError(false);
        setUtrNumber('');
        setRoundOff(false);
        setRoundOffAmount(0);
        setGiveFreeCredits(false);
        setIsB2C(false);
        setCreditsToAdd('');
        setRemarks('Free trial credits');
        setTransactionDate(getLocalDateInputValue());
        setCreatedDateDisplay(getLocalDateInputValue());
    };

    const handleSendEmail = async (id) => {
        setOpenMenuId(null);
        setSendingEmailId(id);
        try {
            await api.post(`/admin/invoices/send-email/${id}`);
            toast.success('Invoice emailed successfully');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to send email');
        } finally {
            setSendingEmailId(null);
        }
    };

    const handleCancelInvoice = async (inv) => {
        setOpenMenuId(null);
        setMenuPosition(null);
        const creditNote = inv.creditsAdded > 0 ? ` and ₹${inv.creditsAdded} credits will be deducted from the buyer's account` : '';
        setConfirmCancel({
            inv,
            title: 'Cancel Invoice',
            message: `Cancel invoice ${inv.invoiceNumber}? This cannot be undone${creditNote}.`,
        });
    };

    const confirmCancelInvoice = async () => {
        if (!confirmCancel) return;
        const inv = confirmCancel.inv;
        setConfirmCancel(null);
        setOpenMenuId(null);
        setCancellingId(inv._id);
        try {
            const { data } = await api.post(`/admin/invoices/cancel/${inv._id}`);
            toast.success(data?.message || 'Invoice cancelled');
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to cancel invoice');
        } finally {
            setCancellingId(null);
        }
    };

    const handleVerifyInvoice = async (inv) => {
        setOpenMenuId(null);
        setMenuPosition(null);
        setVerifyingId(inv._id);
        try {
            const { data } = await api.post(`/admin/invoices/verify/${inv._id}`);
            toast.success(data?.message || 'Invoice updated');
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to update invoice');
        } finally {
            setVerifyingId(null);
        }
    };

    const handleDeleteInvoice = (inv) => {
        if (!inv) return;
        setOpenMenuId(null);
        setMenuPosition(null);
        const creditNote = inv.status !== 'cancelled' && inv.creditsAdded > 0
            ? ` Rs.${inv.creditsAdded} credits will also be deducted from the buyer's account.`
            : '';
        setConfirmDelete({
            inv,
            title: 'Delete Invoice',
            message: `Delete invoice ${inv.invoiceNumber}? This permanently removes the invoice and related credit history.${creditNote}`,
        });
    };

    const confirmDeleteInvoice = async () => {
        if (!confirmDelete) return;
        const inv = confirmDelete.inv;
        setConfirmDelete(null);
        setOpenMenuId(null);
        setDeletingId(inv._id);
        try {
            const { data } = await api.delete(`/admin/invoices/${inv._id}`);
            toast.success(data?.message || 'Invoice deleted');
            setSelectedIds(prev => prev.filter(id => id !== inv._id));
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to delete invoice');
        } finally {
            setDeletingId(null);
        }
    };

    const handleDownload = async (id, invoiceNumber) => {
        try {
            const response = await api.get(`/admin/invoices/download/${id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice-${invoiceNumber.replace(/\//g, '-')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to download invoice');
        }
    };

    const handleView = async (inv) => {
        setViewingInvoice(inv);
        const cacheKey = `${inv._id}_${inv.updatedAt || ''}`;
        if (pdfBlobCache.current[cacheKey]) {
            setViewPdf(pdfBlobCache.current[cacheKey]);
            return;
        }
        setViewLoading(true);
        try {
            const response = await api.get(`/admin/invoices/download/${inv._id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            pdfBlobCache.current[cacheKey] = url;
            setViewPdf(url);
        } catch {
            toast.error('Failed to load invoice');
            setViewingInvoice(null);
        } finally {
            setViewLoading(false);
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        const pageIds = invoices.map(inv => inv._id);
        const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
        setSelectedIds(allSelected ? [] : pageIds);
    };

    const SortBtn = ({ label, columnKey }) => (
        <button
            onClick={() => {
                setSortBy(columnKey);
                setSortOrder(prev => sortBy === columnKey ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
            }}
            className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${sortBy === columnKey ? 'text-[#1a2c5e]' : 'text-black hover:text-slate-600'}`}
        >
            {label}
            <ArrowUpDown size={11} className={sortBy === columnKey ? 'text-[#1a2c5e]' : 'text-slate-300'} />
        </button>
    );

    return (
        <DashboardLayout>
            {/* ── Main scrollable content ── */}
            <div className="p-6 lg:p-8 overflow-y-auto h-full custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* ── Header Banner ── */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-blue-800 rounded-2xl p-7 text-white shadow-lg">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                    {activeTab === 'adminGift' ? (
                                        <Award size={20} className="text-white" />
                                    ) : activeTab === 'freeTrialCredits' ? (
                                        <Gift size={20} className="text-white" />
                                    ) : (
                                        <FileText size={20} className="text-white" />
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight">
                                        {activeTab === 'adminGift' ? 'Admin Gift' : activeTab === 'freeTrialCredits' ? 'Free Trial Credits' : 'Invoices'}
                                    </h1>
                                    <p className="mt-1 text-sm text-blue-100">
                                        {activeTab === 'adminGift'
                                            ? 'View admin gift credits given to buyers'
                                            : activeTab === 'freeTrialCredits'
                                                ? 'Give and track free trial credits for buyers'
                                                : 'Create and manage GST invoices'}
                                    </p>
                                </div>
                            </div>
                            {activeTab === 'invoices' && (
                                <button
                                    onClick={() => handleOpenDrawer()}
                                    className="px-4 py-2 text-sm font-bold rounded-xl bg-white text-[#0f1a3d] hover:bg-white/90 shadow-sm transition-all duration-200 flex items-center gap-2 active:scale-[0.97] whitespace-nowrap"
                                >
                                    <Plus size={16} /> Invoice
                                </button>
                            )}
                            {activeTab === 'freeTrialCredits' && (
                                <button
                                    onClick={() => handleOpenDrawer(null, true)}
                                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-white text-orange-700 hover:bg-white/90 shadow-sm transition-all duration-200 flex items-center gap-2 active:scale-[0.97]"
                                >
                                    <Plus size={16} /> Free Trial Credit
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Tabs ── */}
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                        <button
                            onClick={() => setActiveTab('invoices')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === 'invoices' ? 'bg-white text-[#1a2c5e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileText size={15} className="inline mr-1.5" />Invoices
                        </button>
                        <button
                            onClick={() => setActiveTab('freeTrialCredits')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === 'freeTrialCredits' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Gift size={15} className="inline mr-1.5" />Free Trial Credits
                        </button>
                        <button
                            onClick={() => setActiveTab('adminGift')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === 'adminGift' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Award size={15} className="inline mr-1.5" />Admin Gift
                        </button>
                    </div>

                    {/* ── Invoices Tab ── */}
                    {activeTab === 'invoices' ? (
                        <>
                            <div className="space-y-3">
                                <h3 className="text-lg font-heading font-bold text-slate-800 flex items-center gap-2">
                                    <FileText size={18} className="text-[#1a2c5e]" />
                                    Invoices
                                    <span className="text-sm font-normal text-slate-400">({invoicePagination.total})</span>
                                </h3>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="relative flex-1 max-w-xs">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="Search by invoice no., buyer or GSTIN..."
                                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            <RotateCw size={12} />
                                            Refresh
                                        </button>
                                        <button
                                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                                                sortOrder === 'desc'
                                                    ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    : 'bg-[#1a2c5e]/10 border-[#1a2c5e]/20 text-[#1a2c5e]'
                                            }`}
                                        >
                                            <ArrowUpDown size={12} className={sortOrder === 'asc' ? 'rotate-180' : ''} />
                                            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                                        </button>
                                        {canExport && (
                                        <div className="relative" ref={exportMenuRef}>
                                            <button
                                                onClick={() => setExportMenuOpen(prev => !prev)}
                                                disabled={exportingPdf || exportingExcel || exportingZip}
                                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {(exportingPdf || exportingExcel || exportingZip) ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                                                Export{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                                            </button>
                                            {exportMenuOpen && (
                                                <div className="absolute top-full right-0 mt-1 z-30 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                                                    <button
                                                        onClick={async () => {
                                                            setExportMenuOpen(false);
                                                            if (selectedIds.length === 0) {
                                                                toast.error('Select at least one invoice to export');
                                                                return;
                                                            }
                                                            setExportingPdf(true);
                                                            try {
                                                                const response = await api.post('/admin/invoices/export-pdf-selected', { ids: selectedIds }, { responseType: 'blob' });
                                                                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = `Invoices-${new Date().toISOString().slice(0, 10)}.pdf`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                window.URL.revokeObjectURL(url);
                                                            } catch {
                                                                toast.error('Failed to export invoices');
                                                            } finally {
                                                                setExportingPdf(false);
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                                    >
                                                        <Printer size={13} /> Export as PDF
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            setExportMenuOpen(false);
                                                            setExportingExcel(true);
                                                            try {
                                                                let response;
                                                                if (selectedIds.length > 0) {
                                                                    response = await api.post('/admin/invoices/export-excel', { ids: selectedIds }, { responseType: 'blob' });
                                                                } else {
                                                                    const params = {};
                                                                    const tidMatch = debouncedSearchTerm.trim().match(/^\d+$/);
                                                                    const processedSearch = tidMatch ? tidMatch[0] : debouncedSearchTerm;
                                                                    if (processedSearch) params.q = processedSearch;
                                                                    if (sourceFilter !== 'all') params.source = sourceFilter;
                                                                    if (statusFilter !== 'all') params.status = statusFilter;
                                                                    if (startDate) params.startDate = startDate;
                                                                    if (endDate) params.endDate = endDate;
                                                                    if (fyFilter && fyFilter !== 'all') params.fy = fyFilter;
                                                                    response = await api.post('/admin/invoices/export-excel', {}, { params, responseType: 'blob' });
                                                                }
                                                                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = `Invoices-${new Date().toISOString().slice(0, 10)}.xlsx`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                window.URL.revokeObjectURL(url);
                                                            } catch {
                                                                toast.error('Failed to export Excel');
                                                            } finally {
                                                                setExportingExcel(false);
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                                    >
                                                        <FileSpreadsheet size={13} /> Export as Excel
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            setExportMenuOpen(false);
                                                            setExportingZip(true);
                                                            try {
                                                                let response;
                                                                if (selectedIds.length > 0) {
                                                                    response = await api.post('/admin/invoices/export-zip', { ids: selectedIds }, { responseType: 'blob' });
                                                                } else {
                                                                    const params = {};
                                                                    const tidMatch = debouncedSearchTerm.trim().match(/^\d+$/);
                                                                    const processedSearch = tidMatch ? tidMatch[0] : debouncedSearchTerm;
                                                                    if (processedSearch) params.q = processedSearch;
                                                                    if (sourceFilter !== 'all') params.source = sourceFilter;
                                                                    if (statusFilter !== 'all') params.status = statusFilter;
                                                                    if (startDate) params.startDate = startDate;
                                                                    if (endDate) params.endDate = endDate;
                                                                    if (fyFilter && fyFilter !== 'all') params.fy = fyFilter;
                                                                    response = await api.post('/admin/invoices/export-zip', {}, { params, responseType: 'blob' });
                                                                }
                                                                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = `Invoices-${new Date().toISOString().slice(0, 10)}.zip`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                window.URL.revokeObjectURL(url);
                                                                toast.success('Invoices exported as ZIP');
                                                            } catch {
                                                                toast.error('Failed to export ZIP');
                                                            } finally {
                                                                setExportingZip(false);
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                                    >
                                                        <Package size={13} /> Export as ZIP
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        )}
                                        <div className="relative" ref={filterRef}>
                                        <button
                                            onClick={() => setShowFilters(!showFilters)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                                                showFilters
                                                    ? 'bg-[#1a2c5e] border-[#1a2c5e] text-white'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                            Filters
                                            {(() => {
                                                const activeCount = [sourceFilter !== 'all' ? 1 : 0, billingTypeFilter !== 'all' ? 1 : 0, statusFilter !== 'all' ? 1 : 0, fyFilter !== 'all' ? 1 : 0, startDate ? 1 : 0].reduce((a, b) => a + b, 0);
                                                return activeCount > 0 ? <span className="ml-0.5 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span> : null;
                                            })()}
                                        </button>
                                        <AnimatePresence>
                                        {showFilters && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -4, scale: 0.96 }}
                                            transition={{ duration: 0.15, ease: 'easeOut' }}
                                            className="absolute top-full right-0 mt-1.5 z-30 w-[22rem] bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 space-y-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Filters</span>
                                                <button
                                                    onClick={() => setShowFilters(false)}
                                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">Date & Financial Year</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative flex-1">
                                                            <CalendarDays size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                            <select
                                                                value={fyFilter}
                                                                onChange={e => setFyFilter(e.target.value)}
                                                                title="Filter by financial year"
                                                                className="appearance-none w-full bg-white border border-slate-200 rounded-lg pl-7 pr-7 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors"
                                                            >
                                                                {availableFYs.map(code => (
                                                                    <option key={code} value={code}>F.Y. {fyLabel(code)}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="relative flex-1" ref={dateDropdownRef}>
                                                            <div className="flex items-center gap-0.5">
                                                                <button
                                                                    onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                                                                    className="flex items-center gap-1.5 w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <CalendarDays size={13} className="text-slate-400 shrink-0" />
                                                                    <span className="truncate">{startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Start'} – {endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'End'}</span>
                                                                </button>
                                                                {startDate ? (
                                                                    <button
                                                                        onClick={() => { setStartDate(''); setEndDate(''); }}
                                                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                                    >
                                                                        <X size={13} />
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                            {dateDropdownOpen && (
                                                                <div className="absolute top-full right-0 mt-1.5 z-40 flex flex-col items-stretch min-w-[280px] shadow-lg">
                                                                    <DateRangePicker
                                                                        startDate={startDate}
                                                                        endDate={endDate}
                                                                        onChange={({ min, max }) => {
                                                                            setStartDate(min || startDate);
                                                                            if (max) { setEndDate(max); setDateDropdownOpen(false); }
                                                                        }}
                                                                        hideDisplayChip
                                                                        maxDays={365}
                                                                    />
                                                                    {startDate ? (
                                                                        <button
                                                                            onClick={() => { setStartDate(''); setEndDate(''); setDateDropdownOpen(false); }}
                                                                            className="w-full px-3 py-2 text-xs font-semibold text-slate-500 bg-white border border-t-0 border-slate-200 rounded-b-xl hover:bg-slate-50 hover:text-slate-700 transition-colors"
                                                                        >
                                                                            Clear filter
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="h-px bg-slate-100" />
                                                <div>
                                                    <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">Source</span>
                                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                                        {['all', 'manual', 'auto'].map(s => (
                                                            <button
                                                                key={s}
                                                                onClick={() => setSourceFilter(s)}
                                                                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all capitalize ${
                                                                    sourceFilter === s
                                                                        ? 'bg-white text-[#1a2c5e] shadow-sm'
                                                                        : 'text-slate-500 hover:text-slate-700'
                                                                }`}
                                                            >
                                                                {s === 'all' ? 'All' : s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="h-px bg-slate-100" />
                                                <div>
                                                    <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">Billing Type</span>
                                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                                        {['all', 'B2B', 'B2C'].map(t => (
                                                            <button
                                                                key={t}
                                                                onClick={() => setBillingTypeFilter(t)}
                                                                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                                    billingTypeFilter === t
                                                                        ? 'bg-white text-[#1a2c5e] shadow-sm'
                                                                        : 'text-slate-500 hover:text-slate-700'
                                                                }`}
                                                            >
                                                                {t === 'all' ? 'All' : t}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="h-px bg-slate-100" />
                                                <div>
                                                    <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">Status</span>
                                                    <select
                                                        value={statusFilter}
                                                        onChange={e => setStatusFilter(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-400 appearance-none"
                                                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%2F%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
                                                    >
                                                        <option value="all">All</option>
                                                        <option value="edited">Edited</option>
                                                        <option value="cancelled">Cancelled</option>
                                                    </select>
                                                </div>
                                            </div>
                                            {(sourceFilter !== 'all' || billingTypeFilter !== 'all' || statusFilter !== 'all' || fyFilter !== 'all' || startDate) && (
                                                <>
                                                    <div className="h-px bg-slate-100" />
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={() => { setSourceFilter('all'); setBillingTypeFilter('all'); setStatusFilter('all'); setFyFilter('all'); setStartDate(''); setEndDate(''); setShowFilters(false); }}
                                                            className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            <X size={12} />
                                                            Clear all filters
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </motion.div>
                                        )}
                                        </AnimatePresence>
                                        </div>
                                    </div>
                                </div>

                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full table-fixed">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-[#1a2c5e]/10">
                                                <th className="py-3.5 px-4 text-center" style={{ width: 40 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={invoices.length > 0 && invoices.every(inv => selectedIds.includes(inv._id))}
                                                        onChange={toggleSelectAll}
                                                        className="w-4 h-4 rounded accent-[#1a2c5e] cursor-pointer"
                                                    />
                                                </th>
                                                <th className="py-3.5 px-6 text-left" style={{ width: 220 }}><SortBtn label="Invoice #" columnKey="invoiceNumber" /></th>
                                                <th className="py-3.5 px-6 text-left" style={{ width: 260 }}><SortBtn label="Buyer" columnKey="buyerName" /></th>
                                                <th className="py-3.5 px-6 text-left" style={{ width: 140 }}><SortBtn label="Date" columnKey="createdAt" /></th>
                                                <th className="py-3.5 px-6 text-left" style={{ width: 140 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">GSTIN</span>
                                                </th>
                                                <th className="py-3.5 px-6 text-right" style={{ width: 100 }}><SortBtn label="Amount" columnKey="totalAmount" /></th>
                                                <th className="py-3.5 px-6 text-center" style={{ width: 80 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">Source</span>
                                                </th>
                                                <th className="py-3.5 px-6 text-center" style={{ width: 60 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">Type</span>
                                                </th>
                                                <th className="py-3.5 px-6 text-center" style={{ width: 80 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">Payment</span>
                                                </th>
                                                <th className="py-3.5 px-6 text-right" style={{ width: 100 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">Actions</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                Array.from({ length: 5 }).map((_, i) => (
                                                    <tr key={i} className="animate-pulse">
                                                        {[20, 50, 60, 100, 70, 60, 50, 50, 30].map((w, j) => (
                                                            <td key={j} className="py-4 px-6">
                                                                <div className="h-4 bg-slate-200 rounded" style={{ width: w + '%' }}></div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))
                                            ) : invoices.length === 0 ? (
                                                <tr>
                                                    <td colSpan={10} className="py-16 text-center">
                                                        <div className="p-4 bg-slate-100 rounded-2xl inline-flex mb-4">
                                                            <FileText className="w-10 h-10 text-slate-400" />
                                                        </div>
                                                        <p className="font-semibold text-slate-700">No invoices found</p>
                                                        <p className="text-sm text-slate-500 mt-1">{searchTerm ? 'Try adjusting your search' : 'No invoices have been created yet'}</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                invoices.map((inv, idx) => (
                                                    <tr
                                                        key={inv._id}
                                                        onClick={() => handleView(inv)}
                                                        className={`cursor-pointer transition-colors${inv.status === 'cancelled' ? ' bg-slate-100/50' : ' hover:bg-slate-50/50'}`}
                                                    >
                                                        <td className="py-4 px-4 text-center" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.includes(inv._id)}
                                                                onChange={() => toggleSelectOne(inv._id)}
                                                                className="w-4 h-4 rounded accent-[#1a2c5e] cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <div>
                                                                <span className={`text-sm font-bold font-mono ${inv.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-[#1a2c5e]'}`}>{inv.invoiceNumber}</span>
                                                                <div className="flex gap-1.5 mt-0.5">
                                                                {inv.verified && inv.status !== 'cancelled' && (
                                                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">Verified</span>
                                                                )}
                                                                {inv.isEdited && inv.status !== 'cancelled' && (
                                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Edited</span>
                                                                )}
                                                                {inv.status === 'cancelled' && (
                                                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Cancelled</span>
                                                                )}
                                                                </div>
                                                                {inv.source === 'auto' && inv.paymentId && (
                                                                    <div className="mt-1 text-[10px] text-slate-400 font-mono leading-tight">
                                                                        <span title={inv.paymentId}>Pay: {inv.paymentId}</span>
                                                                        {inv.razorpayOrderId && <><br /><span title={inv.razorpayOrderId}>Ord: {inv.razorpayOrderId}</span></>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-slate-800 truncate">{inv.buyerLabel || inv.buyer?.name || '-'}</p>
                                                                <p className="text-xs text-slate-400 truncate">{inv.buyer?.state || '-'}</p>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-600">
                                                                {formatDateDDMMYYYY(inv.invoiceDate || inv.createdAt)}
                                                                    <br />
                                                                    <span className="text-[11px] text-slate-400">{new Date(inv.invoiceDate || inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-xs font-mono text-slate-500">{inv.buyer?.gstin || '-'}</span>
                                                        </td>
                                                        <td className="py-4 px-6 text-right">
                                                            <span className="text-sm font-semibold text-slate-600">
                                                                &#8377;{Number(inv.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                                inv.source === 'manual'
                                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            }`}>
                                                                {inv.source === 'manual' ? 'Manual' : 'Auto'}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            {inv.billingType === 'B2C' ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                                                    B2C
                                                                </span>
                                                            ) : inv.billingType === 'B2B' ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                                                    B2B
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-slate-300">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            <span className="text-xs text-slate-500">{inv.paymentMethod || '—'}</span>
                                                        </td>
                                                        <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end">
                                                                {(inv.status !== 'cancelled' || canDeleteInvoice) && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                            const menuH = 200;
                                                                            const spaceBelow = window.innerHeight - rect.bottom;
                                                                            const top = spaceBelow > menuH ? rect.bottom + 4 : Math.max(4, rect.top - menuH);
                                                                            setMenuPosition({ top, right: window.innerWidth - rect.right });
                                                                            setOpenMenuId(openMenuId === inv._id ? null : inv._id);
                                                                        }}
                                                                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                                    >
                                                                        {(sendingEmailId === inv._id || deletingId === inv._id)
                                                                            ? <Loader2 size={16} className="animate-spin" />
                                                                            : <MoreVertical size={16} />
                                                                        }
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {!loading && invoicePagination.totalPages > 1 && (
                                    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
                                        <span className="text-sm text-slate-500">
                                            {invoicePagination.total} invoice{invoicePagination.total !== 1 ? 's' : ''}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter)}
                                                disabled={invoicePagination.page === 1}
                                                className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                First
                                            </button>
                                            <button
                                                onClick={() => fetchInvoices(invoicePagination.page - 1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter)}
                                                disabled={invoicePagination.page === 1}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            {getPageNumbers(invoicePagination.page, invoicePagination.totalPages).map((p, i) =>
                                                p === '...' ? (
                                                    <span key={`e${i}`} className="text-xs text-slate-400 px-1">...</span>
                                                ) : (
                                                    <button
                                                        key={p}
                                                        onClick={() => fetchInvoices(p, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter)}
                                                        className={`min-w-[32px] h-8 text-xs font-semibold rounded-lg border transition-colors ${
                                                            p === invoicePagination.page
                                                                ? 'bg-[#1a2c5e] text-white border-[#1a2c5e] shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                )
                                            )}
                                            <button
                                                onClick={() => fetchInvoices(invoicePagination.page + 1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter)}
                                                disabled={invoicePagination.page === invoicePagination.totalPages}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                            <button
                                                onClick={() => fetchInvoices(invoicePagination.totalPages, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter)}
                                                disabled={invoicePagination.page === invoicePagination.totalPages}
                                                className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Last
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            </div>
                        </>
                    ) : (
                        /* ── Free Trial Credits / Admin Gift Tab ── */
                        <>
                            <div className="space-y-3">
                                <h3 className="text-lg font-heading font-bold text-slate-800 flex items-center gap-2">
                                    {activeTab === 'adminGift'
                                        ? <Award size={18} className="text-purple-600" />
                                        : <Gift size={18} className="text-orange-600" />}
                                    {activeTab === 'adminGift' ? 'Admin Gift' : 'Free Trial Credits'}
                                    <span className="text-sm font-normal text-slate-400">({creditPagination.total})</span>
                                </h3>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="relative flex-1 max-w-xs">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={creditSearchTerm}
                                            onChange={e => setCreditSearchTerm(e.target.value)}
                                            placeholder="Search credits..."
                                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="relative" ref={creditDateDropdownRef}>
                                            <div className="flex items-center gap-0.5">
                                                <button
                                                    onClick={() => setCreditDateDropdownOpen(!creditDateDropdownOpen)}
                                                    className="flex items-center gap-1.5 min-w-[150px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                                >
                                                    <CalendarDays size={13} className="text-slate-400 shrink-0" />
                                                    {creditStartDate ? new Date(creditStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Start'} – {creditEndDate ? new Date(creditEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'End'}
                                                </button>
                                                {creditStartDate ? (
                                                    <button
                                                        onClick={() => { setCreditStartDate(''); setCreditEndDate(''); }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                ) : null}
                                            </div>
                                            {creditDateDropdownOpen && (
                                                <div className="absolute top-full right-0 mt-1 z-30 flex flex-col items-stretch min-w-[320px]">
                                                    <DateRangePicker
                                                        startDate={creditStartDate}
                                                        endDate={creditEndDate}
                                                        onChange={({ min, max }) => {
                                                            setCreditStartDate(min || creditStartDate);
                                                            if (max) { setCreditEndDate(max); setCreditDateDropdownOpen(false); }
                                                        }}
                                                        hideDisplayChip
                                                        maxDays={365}
                                                    />

                                                </div>
                                            )}
                                        </div>
                                        {canExport && (
                                        <button
                                            onClick={async () => {
                                                setExportingCreditExcel(true);
                                                try {
                                                    const params = { type: creditTypeFilter };
                                                    if (debouncedCreditSearch) params.q = debouncedCreditSearch;
                                                    if (creditStartDate) params.startDate = creditStartDate;
                                                    if (creditEndDate) params.endDate = creditEndDate;
                                                    const response = await api.get('/admin/invoices/credits-history/export-excel', { params, responseType: 'blob' });
                                                    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.download = `${activeTab === 'adminGift' ? 'Admin-Gift' : 'Free-Trial-Credits'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                    window.URL.revokeObjectURL(url);
                                                } catch {
                                                    toast.error('Failed to export Excel');
                                                } finally {
                                                    setExportingCreditExcel(false);
                                                }
                                            }}
                                            disabled={exportingCreditExcel}
                                            title="Export current filter as Excel"
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {exportingCreditExcel ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                                            Excel
                                        </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {creditLoading ? (
                                <div className="flex flex-col items-center justify-center min-h-[300px]">
                                    <Loader2 className="animate-spin text-orange-600 mb-4" size={40} />
                                    <p className="text-slate-500">Loading credit history...</p>
                                </div>
                            ) : creditHistory.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                                    <div className="p-4 bg-slate-100 rounded-2xl">
                                        {activeTab === 'adminGift'
                                            ? <Award className="w-10 h-10 text-slate-400" />
                                            : <Gift className="w-10 h-10 text-slate-400" />}
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-slate-700">No {activeTab === 'adminGift' ? 'admin gifts' : 'free trial credits'} found</p>
                                        <p className="text-sm text-slate-500 mt-1">{activeTab === 'adminGift' ? 'Admin gifts given to buyers will appear here' : 'Free credits given to buyers will appear here'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className={`border-b border-slate-200 ${activeTab === 'adminGift' ? 'bg-purple-500/10' : 'bg-orange-500/10'}`}>
                                                    <th className="py-3.5 px-6 text-left">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Buyer</span>
                                                    </th>
                                                    <th className="py-3.5 px-6 text-left">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date & Time</span>
                                                    </th>
                                                    <th className="py-3.5 px-6 text-left">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Type</span>
                                                    </th>
                                                    <th className="py-3.5 px-6 text-right">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount</span>
                                                    </th>
                                                    <th className="py-3.5 px-6 text-left">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Remarks</span>
                                                    </th>
                                                    <th className="py-3.5 px-6 text-left">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Added By</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {creditHistory.map(tx => (
                                                    <tr key={tx._id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-6">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-slate-800 truncate">{tx.tenantCode ? `${tx.tenantCode} - ${tx.buyerName}` : tx.buyerName}</p>
                                                                <p className="text-xs text-slate-400 truncate">{tx.buyerState || '-'}</p>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-600">
                                                                {new Date(tx.transactionDate || tx.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            {(() => {
                                                                const badgeColors = {
                                                                    'INVOICE_CREDIT': 'bg-green-100 text-green-700',
                                                                    'INVOICE_ADJUSTMENT': 'bg-blue-100 text-blue-700',
                                                                    'INVOICE_CANCELLATION': 'bg-red-100 text-red-700',
                                                                    'INVOICE_DELETION': 'bg-red-100 text-red-700',
                                                                    'ADMIN_GIFT': 'bg-purple-100 text-purple-700',
                                                                    'FREE_TRIAL_CREDIT': 'bg-slate-100 text-slate-600',
                                                                };
                                                                const cls = badgeColors[tx.type] || 'bg-slate-100 text-slate-600';
                                                                return (
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
                                                                        {tx.typeLabel || tx.type || '-'}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="py-4 px-6 text-right">
                                                            <span className={`text-sm font-semibold ${tx.isDeduction ? 'text-red-500' : 'text-green-600'}`}>
                                                                {tx.isDeduction ? '-' : '+'}&#8377;{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-600">{tx.note || '-'}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm text-slate-600">{tx.adminName || tx.adminEmail || '-'}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {creditPagination.totalPages > 1 && (
                                        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
                                            <span className="text-sm text-slate-500">
                                                {creditPagination.total} credit{creditPagination.total !== 1 ? 's' : ''}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate)}
                                                    disabled={creditPagination.page === 1}
                                                    className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    First
                                                </button>
                                                <button
                                                    onClick={() => fetchCreditHistory(creditPagination.page - 1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate)}
                                                    disabled={creditPagination.page === 1}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                {getPageNumbers(creditPagination.page, creditPagination.totalPages).map((p, i) =>
                                                    p === '...' ? (
                                                        <span key={`e${i}`} className="text-xs text-slate-400 px-1">...</span>
                                                    ) : (
                                                        <button
                                                            key={p}
                                                            onClick={() => fetchCreditHistory(p, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate)}
                                                            className={`min-w-[32px] h-8 text-xs font-semibold rounded-lg border transition-colors ${
                                                                p === creditPagination.page
                                                                    ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            {p}
                                                        </button>
                                                    )
                                                )}
                                                <button
                                                    onClick={() => fetchCreditHistory(creditPagination.page + 1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate)}
                                                    disabled={creditPagination.page === creditPagination.totalPages}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                                <button
                                                    onClick={() => fetchCreditHistory(creditPagination.totalPages, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate)}
                                                    disabled={creditPagination.page === creditPagination.totalPages}
                                                    className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Last
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div>
            {/* ── Invoice / Credit Creation Modal ── (outside scrollable div, inside DashboardLayout) */}
            <AnimatePresence>
                {drawerOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4"
                        onClick={handleCloseDrawer}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 12 }}
                            transition={{ duration: 0.18 }}
                            onClick={e => e.stopPropagation()}
                            className={`relative w-full sm:max-w-6xl lg:max-w-7xl h-full sm:h-auto sm:max-h-[94vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors duration-300 ${giveFreeCredits ? 'bg-orange-50' : 'bg-[#eef1f8]'}`}
                        >
                            {/* ── Modal Header ── */}
                            <div className={`flex items-center justify-between gap-3 px-5 sm:px-7 py-3 sm:py-4 border-b shrink-0 transition-colors duration-300 ${giveFreeCredits ? 'bg-orange-600 border-orange-700' : 'bg-gradient-to-r from-[#1a2c5e] to-[#0f1a3d] border-[#0f1a3d]'}`}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <h3 className="font-bold text-white text-lg sm:text-xl shrink-0">
                                        {giveFreeCredits ? 'Free Trial Credits' : editingInvoice ? 'Edit Invoice' : 'Create Invoice'}
                                    </h3>
                                    {!giveFreeCredits && !editingInvoice && !isB2C && (
                                        <span className="text-sm sm:text-base text-white font-bold">– GST Bills</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {!giveFreeCredits && !editingInvoice && (
                                        <div className="flex bg-white/20 rounded-lg p-0.5">
                                            <button
                                                onClick={() => setIsB2C(false)}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!isB2C ? 'bg-white text-[#1a2c5e] shadow-sm' : 'text-white/80 hover:text-white'}`}
                                            >
                                                B2B
                                            </button>
                                            <button
                                                onClick={() => setIsB2C(true)}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isB2C ? 'bg-purple-500 text-white shadow-sm' : 'text-white/80 hover:text-white'}`}
                                            >
                                                B2C
                                            </button>
                                        </div>
                                    )}
                                    <button
                                    onClick={handleCloseDrawer}
                                    className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors shrink-0"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            </div>

                            {/* ── Modal Body ── */}
                            <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 transition-colors duration-300 ${giveFreeCredits ? 'bg-orange-50/40' : 'bg-[#eef1f8]/60'}`}>

                                {editingInvoice && (() => {
                                    const invParts = (editingInvoice.invoiceNumber || '').split('/');
                                    const prefix = invParts.length === 3 ? `${invParts[0]}/${invParts[1]}/` : '';
                                    return (
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white rounded-xl border border-slate-200 px-5 py-3 shadow-sm">
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="w-7 h-7 rounded-lg bg-[#1a2c5e]/10 flex items-center justify-center">
                                                    <FileText size={14} className="text-[#1a2c5e]" />
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Invoice</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 font-mono">
                                                <span className="text-sm text-slate-400 select-none">{prefix}</span>
                                                {user?.role === 'SuperAdmin' ? (
                                                    <input
                                                        type="number"
                                                        value={editInvoiceSeq}
                                                        onChange={e => setEditInvoiceSeq(e.target.value)}
                                                        className="w-20 px-2 py-1.5 text-sm font-bold text-[#1a2c5e] bg-white border border-[#1a2c5e]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2c5e]/20 focus:border-[#1a2c5e]/40 transition-all text-center"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-bold text-[#1a2c5e] px-1">{invParts.length === 3 ? invParts[2] : editingInvoice.invoiceNumber}</span>
                                                )}
                                            </div>
                                            <div className="hidden sm:flex items-center gap-3 ml-auto text-[11px] text-slate-400">
                                                {editingInvoice.createdBy && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                        Created by <strong className="text-slate-600 font-semibold">{editingInvoice.createdBy.name}</strong>
                                                        <span className="text-slate-300">({editingInvoice.createdBy.role})</span>
                                                    </span>
                                                )}
                                                {editingInvoice.updatedBy && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                        Updated by <strong className="text-slate-600 font-semibold">{editingInvoice.updatedBy.name}</strong>
                                                        <span className="text-slate-300">({editingInvoice.updatedBy.role})</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className={`grid grid-cols-1 items-start ${giveFreeCredits ? 'max-w-2xl mx-auto w-full' : 'lg:grid-cols-2'} gap-4`}>
                                {/* Customer Information Card */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                                    <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
                                        <Building2 size={18} className="text-brand-500" /> Customer Information
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Buyer Name</label>
                                            <div className="relative">
                                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={buyerQuery}
                                                    onChange={e => handleBuyerInput(e.target.value)}
                                                    onFocus={openBuyerDropdown}
                                                    onClick={openBuyerDropdown}
                                                    onBlur={closeBuyerDropdown}
                                                    onKeyDown={async (e) => {
                                                        if (e.key !== 'Enter') return;
                                                        if (buyers.length > 0) {
                                                            selectBuyer(buyers[0]);
                                                        } else if (buyerQuery.trim()) {
                                                            try {
                                                                const { data } = await api.get(`/admin/invoices/buyers?q=${encodeURIComponent(buyerQuery.trim())}`);
                                                                if (data && data.length > 0) selectBuyer(data[0]);
                                                            } catch {}
                                                        }
                                                    }}
                                                    placeholder="Type buyer name or search existing..."
                                                    className="w-full pl-9 pr-3 py-2.5 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
                                                />
                                                {searching && (
                                                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-400" />
                                                )}
                                            </div>
                                            {showBuyerDropdown && (
                                                <>
                                                    {buyers.length > 0 ? (
                                                        <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-56 overflow-y-auto">
                                                            {buyers.map(b => (
                                                                <button
                                                                    key={b._id}
                                                                    onMouseDown={(e) => { e.preventDefault(); selectBuyer(b); }}
                                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0 transition-colors"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                                                                            {(b.orgName || b.name || '?').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="font-semibold text-slate-800 truncate">{b.tenantId} - {b.orgName || b.name}</p>
                                                                            <div className="flex flex-wrap gap-x-3 mt-0.5">
                                                                                {b.gstin && <span className="text-[11px] text-slate-400 font-mono">{b.gstin}</span>}
                                                                                {b.state && <span className="text-[11px] text-slate-400">{b.state}</span>}
                                                                            </div>
                                                                        </div>
                                                                        {b.gstin && (
                                                                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded shrink-0">GST</span>
                                                                        )}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : buyerQuery.length >= 2 && !searching ? (
                                                        <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg p-4 text-center">
                                                            <User size={20} className="mx-auto text-slate-300 mb-1" />
                                                            <p className="text-sm font-medium text-slate-500">No existing buyer found</p>
                                                            {!giveFreeCredits && <p className="text-xs text-slate-400 mt-1">Proceed with manual entry below</p>}
                                                        </div>
                                                    ) : null}
                                                </>
                                            )}
                                        </div>

                                        {(giveFreeCredits ? selectedBuyer : (isB2C || selectedBuyer || (buyerQuery.trim() && !showBuyerDropdown && !searching))) && (
                                            <div className="pt-2 border-t border-slate-100">
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                                    {selectedBuyer?.tenantId || isB2C ? (
                                                        <div className="col-span-2">
                                                            {selectedBuyer?.tenantId ? (
                                                                <BuyerField label="Organization Name" value={`${selectedBuyer.tenantId} - ${selectedBuyer.gstBusinessName || selectedBuyer.orgName || selectedBuyer.name}`} disabled />
                                                            ) : (
                                                                <BuyerField label="Organization Name *" value={activeBuyer?.orgName || buyerQuery.trim()} onChange={e => updateBuyerField('orgName', e.target.value)} />
                                                            )}
                                                        </div>
                                                    ) : null}
                                                    <div className="col-span-2">
                                                        <BuyerField label="Bill To Name *" value={activeBuyer?.name || ''} onChange={e => updateBuyerField('name', e.target.value)} />
                                                    </div>
                                                    {!giveFreeCredits && !isB2C && (
                                                        <div className="col-span-2 relative">
                                                            <label className="block text-xs font-semibold text-slate-500 mb-0.5">GSTIN *</label>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={selectedBuyer?.gstin || ''}
                                                                    onChange={e => updateBuyerField('gstin', e.target.value.toUpperCase())}
                                                                    onKeyDown={e => { if (e.key === 'Enter') gstButtonRef.current?.click(); }}
                                                                    className="flex-1 min-w-0 px-3 py-2 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
                                                                />
                                                                <GstAutoFill
                                                                    gstin={selectedBuyer?.gstin || ''}
                                                                    disabled={!selectedBuyer?.gstin || selectedBuyer.gstin.length < 15}
                                                                    buttonLabel={null}
                                                                    buttonRef={gstButtonRef}
                                                                    buttonClassName="shrink-0 px-3.5 py-3 text-base rounded-lg bg-[#1a2c5e] text-white hover:bg-[#0f1a3d] whitespace-nowrap"
                                                                    onGstFetched={(data) => {
                                                                        if (!data) return;
                                                                        setSelectedBuyer(prev => ({
                                                                            ...prev,
                                                                            gstin: data.gstin || prev?.gstin,
                                                                            name: data.businessName || prev?.name,
                                                                            address: data.address || prev?.address,
                                                                            state: data.state || prev?.state,
                                                                            stateCode: data.stateCode || prev?.stateCode,
                                                                            phone: data.phone || prev?.phone,
                                                                        }));
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!giveFreeCredits && (
                                                        <div className="col-span-2">
                                                            <BuyerField label="Address" value={selectedBuyer?.address || ''} onChange={e => updateBuyerField('address', e.target.value)} />
                                                        </div>
                                                    )}
                                                    {!giveFreeCredits && (
                                                        <BuyerField label="Phone" value={selectedBuyer?.phone || ''} onChange={e => updateBuyerField('phone', e.target.value)} />
                                                    )}
                                                    {!giveFreeCredits && (
                                                        <BuyerField label="State Code" value={selectedBuyer?.stateCode || ''} onChange={e => updateBuyerField('stateCode', e.target.value)} />
                                                    )}
                                                    {!giveFreeCredits && (
                                                        <div className="col-span-2">
                                                            <BuyerField label="State" value={selectedBuyer?.state || ''} onChange={e => updateBuyerField('state', e.target.value)} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {giveFreeCredits ? (
                                /* Credit Details Card */
                                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                            <CalendarDays size={18} className="text-brand-500" /> Credit Details
                                        </h4>
                                        <span className="text-xs text-slate-400">Created {formatDateDDMMYYYY(createdDateDisplay)}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Credit Date</label>
                                            <input
                                                type="date"
                                                value={transactionDate}
                                                onChange={e => setTransactionDate(e.target.value)}
                                                className="w-full px-3 py-2.5 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Remarks</label>
                                            <input
                                                type="text"
                                                value={remarks}
                                                disabled
                                                className="w-full px-3 py-2.5 text-base rounded-lg border border-slate-200 bg-orange-100 text-orange-800 cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                                                Description <span className="text-slate-400 font-normal">(optional)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={invoiceDescription}
                                                onChange={e => setInvoiceDescription(e.target.value)}
                                                placeholder="What is this for?"
                                                className="w-full px-3 py-2.5 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Credit (Coins) *</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={creditsToAdd}
                                                    onChange={e => setCreditsToAdd(e.target.value)}
                                                    placeholder="Enter credit amount"
                                                    className="w-full px-3 py-2.5 pr-16 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-orange-600">Coins</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ) : (
                                /* Line Items + Payment Card */
                                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col">
                                        <div className="flex flex-wrap items-center justify-between mb-3 gap-3">
                                            <h4 className="text-base font-bold text-slate-700 flex items-center gap-2 shrink-0">
                                                <FileText size={17} className="text-[#1a2c5e]" /> Line Items
                                            </h4>
                                            <input
                                                type="date"
                                                value={transactionDate}
                                                onChange={e => setTransactionDate(e.target.value)}
                                                title="Invoice Date"
                                                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a2c5e]"
                                            />
                                            <button
                                                onClick={addLineItem}
                                                className="shrink-0 px-3.5 py-2 text-sm font-semibold rounded-lg bg-[#1a2c5e] text-white hover:bg-[#0f1a3d] transition-colors flex items-center gap-1.5"
                                            >
                                                <Plus size={14} /> Add Item
                                            </button>
                                        </div>

                                        {savedItems.length > 0 && (
                                            <div className="flex items-center gap-3 mb-3 p-2.5 bg-slate-50 rounded-lg">
                                                <span className="text-sm font-medium text-slate-500 shrink-0">Saved Items:</span>
                                                <select
                                                    value=""
                                                    onChange={e => {
                                                         const s = e.target.value;
                                                         if (!s) return;
                                                         const item = savedItems.find(x => x.description === s);
                                                         if (!item) return;
                                                         setLineItems(prev => {
                                                             const existing = prev.findIndex(i => i.description === item.description);
                                                             if (existing !== -1) {
                                                                 const updated = [...prev];
                                                                 updated[existing] = { ...updated[existing], rate: 10000, amount: 10000 * updated[existing].quantity };
                                                                 return updated;
                                                             }
                                                             const idx = prev.findIndex(i => !i.description);
                                                             if (idx !== -1) {
                                                                 const updated = [...prev];
                                                                 updated[idx] = { ...item, quantity: 1, rate: 10000, amount: 10000 };
                                                                 return updated;
                                                             }
                                                             return [...prev, { ...item, quantity: 1, rate: 10000, amount: 10000 }];
                                                         });
                                                     }}
                                                    className="flex-1 px-3 py-2.5 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a2c5e] bg-white"
                                                >
                                                    <option value="">Select a saved item...</option>
                                                    {savedItems.map((item, idx) => (
                                                        <option key={idx} value={item.description}>
                                                            {item.description}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            {lineItems.map((item, i) => (
                                                <div key={i} className="p-3 bg-slate-50 rounded-xl space-y-2">
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={e => updateLineItem(i, 'description', e.target.value)}
                                                        placeholder="Service description"
                                                        className="w-full px-3 py-2 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a2c5e]"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={item.sacCode}
                                                            disabled
                                                            title="HSN/SAC"
                                                            className="w-24 px-2.5 py-2 text-sm rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed shrink-0"
                                                        />
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={e => updateLineItem(i, 'quantity', e.target.value)}
                                                            min="1"
                                                            disabled={i === 0}
                                                            title="Qty"
                                                            className={`w-16 px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a2c5e] shrink-0 ${i === 0 ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                                        />
                                                        <input
                                                            type="number"
                                                            value={item.rate}
                                                            onChange={e => updateLineItem(i, 'rate', e.target.value)}
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="Rate"
                                                            title="Rate"
                                                            className="flex-1 min-w-0 px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a2c5e]"
                                                        />
                                                        <span className="text-sm font-bold text-slate-800 px-1 shrink-0 whitespace-nowrap">&#8377;{Number(item.amount).toFixed(2)}</span>
                                                        <button onClick={() => removeLineItem(i)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-colors shrink-0">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Mode *</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Cash', 'Cheque', 'Credit', 'Online'].map(method => (
                                                        <button
                                                            key={method}
                                                            type="button"
                                                            onClick={() => { setPaymentMethod(method); setPaymentMethodError(false); }}
                                                            className={`px-3.5 py-2 text-sm font-bold rounded-lg border transition-colors ${
                                                                paymentMethod === method
                                                                    ? 'bg-[#1a2c5e] border-[#1a2c5e] text-white'
                                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            {method}
                                                        </button>
                                                    ))}
                                                </div>
                                                {paymentMethodError && (
                                                    <p className="text-xs font-semibold text-red-500 mt-1.5">Please select a payment mode</p>
                                                )}
                                            </div>
                                            {['Cheque', 'Credit', 'Online'].includes(paymentMethod) && (
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">UTR Number</label>
                                                    <input
                                                        type="text"
                                                        value={utrNumber}
                                                        onChange={e => setUtrNumber(e.target.value)}
                                                        placeholder="e.g. UTR1234567890"
                                                        className="w-full px-3 py-2 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a2c5e]"
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Invoice Description</label>
                                                <input
                                                    type="text"
                                                    value={invoiceDescription}
                                                    onChange={e => setInvoiceDescription(e.target.value)}
                                                    placeholder="e.g. Service Fee - Jan 2026"
                                                    className="w-full px-3 py-2 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a2c5e]"
                                                />
                                            </div>
                                            {!giveFreeCredits && !isB2C && roundOffAmount !== 0 && (
                                                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                                                    <p className="text-xs font-semibold text-green-700">
                                                        Auto Round Off: +₹{roundOffAmount.toFixed(2)} to make total round amount
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                </div>
                                )}
                            </div>
                        </div>

                            {/* ── Modal Footer ── */}
                            <div className={`border-t px-5 sm:px-7 py-4 shrink-0 transition-colors duration-300 ${giveFreeCredits ? 'border-orange-200 bg-orange-50' : 'border-[#c7d2e8] bg-[#eef1f8]'}`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        {giveFreeCredits ? (
                                            <>
                                                <p className="text-xs text-slate-500">Credits to add</p>
                                                <p className="text-2xl font-extrabold text-orange-600">{Number(creditsToAdd || 0).toFixed(2)} Coins</p>
                                            </>
                                        ) : isB2C ? (
                                            <>
                                                <p className="text-xs text-slate-500">Total Amount (incl. GST)</p>
                                                <p className="text-2xl font-extrabold text-slate-800">&#8377;{totalAmount}</p>
                                                <p className="text-xs font-medium text-slate-500 mt-0.5">{amountInWords(totalAmount)}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-slate-500">Taxable: &#8377;{baseAmount.toFixed(2)}</p>
                                                {activeBuyer?.stateCode ? (
                                                    isInterState ? (
                                                        <p className="text-xs text-slate-500">IGST ({GST_RATE}%): &#8377;{igstAmount.toFixed(2)}</p>
                                                    ) : (
                                                        <p className="text-xs text-slate-500">CGST ({halfGstRate}%) + SGST ({halfGstRate}%): &#8377;{(cgstAmount + sgstAmount).toFixed(2)}</p>
                                                    )
                                                ) : (
                                                    <p className="text-xs text-slate-500">GST ({GST_RATE}%): &#8377;{(igstAmount || cgstAmount + sgstAmount).toFixed(2)}</p>
                                                )}
                                                <p className="text-2xl font-extrabold text-slate-800">
                                                    &#8377;{(parseFloat(totalAmount) + roundOffAmount).toFixed(2)}
                                                </p>
                                                {roundOffAmount !== 0 && (
                                                    <p className="text-xs text-green-600 font-medium mt-1">
                                                        Auto Round off: +₹{roundOffAmount.toFixed(2)}
                                                    </p>
                                                )}
                                                <p className="text-xs font-medium text-slate-500 mt-0.5">
                                                    {amountInWords(parseFloat(totalAmount) + roundOffAmount)}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:items-end gap-3">
                                        {!giveFreeCredits && !isB2C && (
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={addCreditsOnCreate}
                                                    onChange={e => setAddCreditsOnCreate(e.target.checked)}
                                                    className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
                                                />
                                                <span className="text-xs font-semibold text-slate-600">Add credits to buyer's account</span>
                                            </label>
                                        )}
                                        <div className="flex gap-3 w-full sm:w-auto">
                                            <button
                                                onClick={handleCloseDrawer}
                                                className="flex-1 sm:flex-none px-7 py-3.5 font-bold rounded-xl text-base text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCreate}
                                                disabled={creating || (editingInvoice ? !hasUnsavedChanges : false)}
                                                className={`flex-1 sm:flex-none px-10 py-3.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg active:scale-[0.97] text-base disabled:opacity-60 disabled:cursor-not-allowed ${
                                                    giveFreeCredits
                                                        ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/20'
                                                        : 'bg-[#1a2c5e] hover:bg-[#0f1a3d] text-white shadow-[#1a2c5e]/30'
                                                }`}
                                            >
                                                {creating ? (
                                                    <><Loader2 size={18} className="animate-spin" /> {giveFreeCredits ? 'Adding...' : 'Creating...'}</>
                                                ) : (
                                                    <><CheckCircle size={18} /> {giveFreeCredits ? 'Add Credits' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Loading skeleton for PDF preview ── */}
            {viewLoading && !viewPdf && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
                            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" />
                                <div className="h-8 w-8 bg-slate-200 rounded-lg animate-pulse" />
                            </div>
                        </div>
                        <div className="flex-1 p-8 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-3">
                                    <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                                </div>
                                <div className="h-20 w-20 bg-slate-200 rounded animate-pulse" />
                            </div>
                            <div className="h-px bg-slate-200" />
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                                </div>
                            </div>
                            <div className="h-px bg-slate-200" />
                            <div className="space-y-2">
                                <div className="flex gap-4">
                                    <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-8 flex-1 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-8 w-20 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
                                </div>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-4">
                                        <div className="h-6 w-8 bg-slate-100 rounded animate-pulse" />
                                        <div className="h-6 flex-1 bg-slate-100 rounded animate-pulse" />
                                        <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
                                        <div className="h-6 w-16 bg-slate-100 rounded animate-pulse" />
                                        <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PDF Preview Modal ── */}
            {viewPdf && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={16} /> {viewingInvoice?.invoiceNumber || 'Invoice Preview'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDownload(viewingInvoice._id, viewingInvoice.invoiceNumber)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                                >
                                    <Download size={14} /> Download
                                </button>
                                <button
                                    onClick={() => { setViewPdf(null); setViewingInvoice(null); }}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <iframe src={viewPdf + '#toolbar=0&navpanes=0'} className="flex-1 w-full" title="Invoice PDF" />
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={!!confirmCancel}
                onClose={() => setConfirmCancel(null)}
                onConfirm={confirmCancelInvoice}
                title={confirmCancel?.title || 'Confirm'}
                message={confirmCancel?.message || ''}
                confirmText="Yes, Cancel Invoice"
                danger
            />
            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={confirmDeleteInvoice}
                title={confirmDelete?.title || 'Confirm'}
                message={confirmDelete?.message || ''}
                confirmText="Yes, Delete Invoice"
                danger
            />
            {openMenuId && menuPosition && !confirmCancel && !confirmDelete && createPortal((() => {
                const menuInvoice = invoices.find(i => i._id === openMenuId);
                if (!menuInvoice) return null;
                const isCancelled = menuInvoice.status === 'cancelled';
                return (
                    <div ref={menuRef} style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right }} className="z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden">
                        {!isCancelled && menuInvoice?.billingType !== 'B2C' && (
                            <button
                                onClick={() => { setOpenMenuId(null); setMenuPosition(null); handleSendEmail(openMenuId); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <Mail size={14} className="text-blue-500" />
                                Send Email
                            </button>
                        )}
                        {!isCancelled && (
                            <>
                                <div className="mx-3 my-1 border-t border-slate-100" />
                                <button
                                    onClick={() => { setOpenMenuId(null); setMenuPosition(null); handleOpenDrawer(menuInvoice); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <Pencil size={14} className="text-amber-500" />
                                    Edit Invoice
                                </button>
                                {user?.role === 'SuperAdmin' && (
                                    <>
                                        <div className="mx-3 my-1 border-t border-slate-100" />
                                        <button
                                            onClick={() => handleVerifyInvoice(menuInvoice)}
                                            disabled={verifyingId === openMenuId}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                        >
                                            {verifyingId === openMenuId
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <CheckCircle size={14} className={menuInvoice.verified ? 'text-green-600' : 'text-slate-400'} />
                                            }
                                            {menuInvoice.verified ? 'Mark Unverified' : 'Mark Verified'}
                                        </button>
                                    </>
                                )}
                                {canCancelInvoice && (
                                    <>
                                        <div className="mx-3 my-1 border-t border-slate-100" />
                                        <button
                                            onClick={() => handleCancelInvoice(menuInvoice)}
                                            disabled={cancellingId === openMenuId}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                        >
                                            {cancellingId === openMenuId
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <X size={14} />
                                            }
                                            Cancel Invoice
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                        {canDeleteInvoice && (
                            <>
                                {!isCancelled && <div className="mx-3 my-1 border-t border-slate-100" />}
                                <button
                                    onClick={() => handleDeleteInvoice(menuInvoice)}
                                    disabled={deletingId === openMenuId}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                    {deletingId === openMenuId
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : <Trash2 size={14} />
                                    }
                                    Delete Invoice
                                </button>
                            </>
                        )}
                    </div>
                );
            })(), document.body)}
        </DashboardLayout>
    );
};

const BuyerField = ({ label, value, onChange, disabled }) => (
    <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
        <input
            type="text"
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`w-full px-3 py-2 text-base rounded-lg border transition-colors ${disabled ? 'bg-slate-50 text-slate-700 border-slate-200 cursor-not-allowed' : 'border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400'}`}
        />
    </div>
);

export default AdminInvoiceList;