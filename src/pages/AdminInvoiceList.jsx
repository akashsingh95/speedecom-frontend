/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PillSelect from '../components/PillSelect';
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
import AdminGiftModal from '../components/AdminGiftModal';
import RefundedPaymentsTab from '../components/RefundedPaymentsTab';
import {
    Search, Plus, Trash2, Pencil, FileText, Loader2, X, CheckCircle,
    Building2, User, Gift, Award,
    Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Hash,
    MoreVertical, Mail, Printer, FileSpreadsheet, CalendarDays, ChevronDown, RotateCw, RotateCcw, Package, Clock, AlertTriangle
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
    const isSBM = user?.role === 'SBM';
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
    const [utrNumberError, setUtrNumberError] = useState(false);
    const [invoiceDescription, setInvoiceDescription] = useState('');
    const [transactionDate, setTransactionDate] = useState(() => getLocalDateInputValue());
    const [createdDateDisplay, setCreatedDateDisplay] = useState(() => getLocalDateInputValue());
    const [giveFreeCredits, setGiveFreeCredits] = useState(false);
    const [manualPaymentCategory, setManualPaymentCategory] = useState('RECONCILIATION');
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
    const [verifiedFilter, setVerifiedFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('invoices');
    const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
    const creditTypeFilter = activeTab === 'adminGift' ? 'ADMIN_GIFT' : 'FREE_TRIAL_CREDIT';
    const [creditCategoryFilter, setCreditCategoryFilter] = useState('all');
    const creditCategoryRef = useRef('all');
    creditCategoryRef.current = creditCategoryFilter;
    const creditRequestIdRef = useRef(0);
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
    const [refundingId, setRefundingId] = useState(null);
    const [confirmRefund, setConfirmRefund] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [confirmTransfer, setConfirmTransfer] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [verifyingId, setVerifyingId] = useState(null);
    const [bulkVerifying, setBulkVerifying] = useState(false);
    const [bulkUnverifying, setBulkUnverifying] = useState(false);
    const [transferringId, setTransferringId] = useState(null);
    const [paymentCategoryFilter, setPaymentCategoryFilter] = useState('all');
    const [settlementFilter, setSettlementFilter] = useState('all');
    const [syncingSettlements, setSyncingSettlements] = useState(false);
    const menuRef = useRef(null);
    const creditMenuRef = useRef(null);
    const gstButtonRef = useRef(null);

    useEffect(() => {
        const cache = pdfBlobCache.current;
        return () => { Object.values(cache).forEach(url => { try { window.URL.revokeObjectURL(url); } catch { /* already revoked */ } }); };
    }, []);

    const [sortBy, setSortBy] = useState('invoiceNumber');
    const [sortOrder, setSortOrder] = useState('desc');
    const [creditSortBy, setCreditSortBy] = useState('createdAt');
    const [creditSortOrder, setCreditSortOrder] = useState('desc');
    const [invoicePagination, setInvoicePagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [creditPagination, setCreditPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [editingCredit, setEditingCredit] = useState(null);
    const [editCreditNote, setEditCreditNote] = useState('');
    const [editCreditAmount, setEditCreditAmount] = useState('');
    const [editCreditType, setEditCreditType] = useState('FREE_TRIAL_CREDIT');
    const [editCreditDate, setEditCreditDate] = useState('');
    const [editCreditSelectedTenant, setEditCreditSelectedTenant] = useState(null);
    const [editCreditBuyerQuery, setEditCreditBuyerQuery] = useState('');
    const [editCreditBuyers, setEditCreditBuyers] = useState([]);
    const [editCreditBuyerSearching, setEditCreditBuyerSearching] = useState(false);
    const [showEditCreditBuyerDropdown, setShowEditCreditBuyerDropdown] = useState(false);
    const [updatingCredit, setUpdatingCredit] = useState(false);
    const [openCreditMenuId, setOpenCreditMenuId] = useState(null);
    const [creditMenuPosition, setCreditMenuPosition] = useState(null);
    const [confirmDeleteCredit, setConfirmDeleteCredit] = useState(null);
    const [deletingCreditId, setDeletingCreditId] = useState(null);
    const [confirmCancelCredit, setConfirmCancelCredit] = useState(null);
    const [cancellingCreditId, setCancellingCreditId] = useState(null);

    const today = new Date();
    const getDefaultStartDate = () => {
        if (!isSBM) return '';
        const d = new Date(today);
        d.setDate(d.getDate() - 6);
        return getLocalDateInputValue(d);
    };
    const getDefaultEndDate = () => isSBM ? getLocalDateInputValue(today) : '';
    // SBM can only see the last 7 days (the server enforces it), so their date pickers can't go
    // earlier than that, and "clear" returns to the full 7-day window instead of an empty range.
    const sbmMinDate = isSBM ? getDefaultStartDate() : null;
    const [startDate, setStartDate] = useState(getDefaultStartDate());
    const [endDate, setEndDate] = useState(getDefaultEndDate());
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingZip, setExportingZip] = useState(false);
    const [exportingCreditExcel, setExportingCreditExcel] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedCreditIds, setSelectedCreditIds] = useState([]);
    const [bulkCreditVerifying, setBulkCreditVerifying] = useState(false);
    const [bulkCreditUnverifying, setBulkCreditUnverifying] = useState(false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const exportMenuRef = useRef(null);
    const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
    const dateDropdownRef = useRef(null);
    const [showFilters, setShowFilters] = useState(false);
    const filterRef = useRef(null);
    const [creditStartDate, setCreditStartDate] = useState(isSBM ? getDefaultStartDate() : '');
    const [creditEndDate, setCreditEndDate] = useState(isSBM ? getDefaultEndDate() : '');
    const [creditStatusFilter, setCreditStatusFilter] = useState('all');
    const [creditVerifiedFilter, setCreditVerifiedFilter] = useState('all');
    const [creditAmountMin, setCreditAmountMin] = useState('');
    const [creditAmountMax, setCreditAmountMax] = useState('');
    const [creditDateDropdownOpen, setCreditDateDropdownOpen] = useState(false);
    const [creditAmountDropdownOpen, setCreditAmountDropdownOpen] = useState(false);
    const [showCreditFilters, setShowCreditFilters] = useState(false);
    const creditDateDropdownRef = useRef(null);
    const creditAmountDropdownRef = useRef(null);
    const creditFilterRef = useRef(null);
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

    // Same pattern as the invoice row menu above, kept as separate state/ref since the two
    // tables (Invoices vs Free Trial Credits/Admin Gift) are independent row-id namespaces.
    useEffect(() => {
        const handler = (e) => {
            if (creditMenuRef.current && !creditMenuRef.current.contains(e.target)) {
                setOpenCreditMenuId(null);
                setCreditMenuPosition(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!openCreditMenuId) return;
        const closeMenu = () => {
            setOpenCreditMenuId(null);
            setCreditMenuPosition(null);
        };
        window.addEventListener('scroll', closeMenu, true);
        window.addEventListener('resize', closeMenu);
        return () => {
            window.removeEventListener('scroll', closeMenu, true);
            window.removeEventListener('resize', closeMenu);
        };
    }, [openCreditMenuId]);

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

    const fetchInvoices = useCallback(async (pageNum = 1, search = '', source = 'all', status = 'all', sDate = startDate, eDate = endDate, fy = fyFilter, billingType = billingTypeFilter, verified = verifiedFilter) => {
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
            if (verified !== 'all') params.verified = verified;
            if (paymentCategoryFilter !== 'all') params.paymentCategory = paymentCategoryFilter;
            if (settlementFilter !== 'all') params.settlement = settlementFilter;
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
    }, [sortBy, sortOrder, paymentCategoryFilter, settlementFilter]);

    const handleSyncSettlements = async () => {
        setSyncingSettlements(true);
        try {
            const { data } = await api.post('/admin/invoices/sync-settlements', {}, { timeout: 5 * 60 * 1000 });
            toast.success(data.monthsScanned === 0
                ? 'Nothing to sync — no unsettled Razorpay invoices'
                : `Settlement sync done: ${data.matched} newly settled. Pending: ${data.stillPending}, overdue: ${data.overdue}`);
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        } catch {
            toast.error('Failed to sync settlements from Razorpay');
        } finally {
            setSyncingSettlements(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (activeTab === 'invoices') {
            fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        }
    }, [activeTab, fetchInvoices, debouncedSearchTerm, sourceFilter, billingTypeFilter, statusFilter, startDate, endDate, fyFilter, verifiedFilter, sortBy, sortOrder]);

    const fetchCreditHistory = useCallback(async (pageNum = 1, search = '', type = 'all', sDate = '', eDate = '', amountMin = '', amountMax = '', status = 'all', verified = 'all', fy = fyFilter, sortByValue = creditSortBy, sortOrderValue = creditSortOrder) => {
        // Only the latest request may update state — a slower earlier response (older filters or
        // the previous tab) must not overwrite newer results.
        const requestId = ++creditRequestIdRef.current;
        const isStale = () => requestId !== creditRequestIdRef.current;
        setCreditLoading(true);
        try {
            const params = { page: pageNum, limit: 10, sortBy: sortByValue, sortOrder: sortOrderValue };
            if (search) params.q = search;
            if (type !== 'all') params.type = type;
            if (creditCategoryRef.current !== 'all') params.category = creditCategoryRef.current;
            if (sDate) params.startDate = sDate;
            if (eDate) params.endDate = eDate;
            if (amountMin) params.amountMin = amountMin;
            if (amountMax) params.amountMax = amountMax;
            if (status !== 'all') params.status = status;
            if (verified !== 'all') params.verified = verified;
            if (fy && fy !== 'all') params.fy = fy;
            const { data } = await api.get('/admin/invoices/credits-history', { params });
            if (isStale()) return;
            setCreditHistory(data?.transactions || []);
            setCreditPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
            setSelectedCreditIds([]);
        } catch {
            if (!isStale()) toast.error('Failed to load credit history');
        } finally {
            if (!isStale()) setCreditLoading(false);
        }
    }, [fyFilter, creditSortBy, creditSortOrder]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedCreditSearch(creditSearchTerm), 400);
        return () => clearTimeout(timer);
    }, [creditSearchTerm]);

    useEffect(() => {
        if (activeTab === 'freeTrialCredits' || activeTab === 'adminGift') {
            fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter, fyFilter, creditSortBy, creditSortOrder);
        }
    }, [activeTab, fetchCreditHistory, debouncedCreditSearch, creditTypeFilter, creditCategoryFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter, fyFilter, creditSortBy, creditSortOrder]);

    useEffect(() => {
        const handler = (e) => {
            if (creditFilterRef.current && !creditFilterRef.current.contains(e.target)) {
                setShowCreditFilters(false);
            }
        };
        if (showCreditFilters) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCreditFilters]);

    const applyInvoiceFilters = useCallback(() => {
        fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        setShowFilters(false);
    }, [fetchInvoices, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter]);

    const applyCreditFilters = useCallback(() => {
        fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter, fyFilter, creditSortBy, creditSortOrder);
        setShowCreditFilters(false);
    }, [fetchCreditHistory, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter, fyFilter, creditSortBy, creditSortOrder]);

    const updateCreditTransaction = useCallback(async () => {
        if (!editingCredit) return;
        setUpdatingCredit(true);
        try {
            const base = editingCredit.category === 'LISTING_STUDIO' ? 'ls-credit-transactions' : 'credit-transactions';
            await api.put(`/admin/invoices/${base}/${editingCredit._id}`, {
                amount: Number(editCreditAmount),
                note: editCreditNote,
                type: editCreditType,
                ...(editCreditSelectedTenant?._id && { tenantId: editCreditSelectedTenant._id }),
                ...(editCreditDate && { transactionDate: editCreditDate }),
            });
            toast.success('Credit transaction updated successfully');
            setEditingCredit(null);
            fetchCreditHistory(creditPagination.page, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update credit transaction');
        } finally {
            setUpdatingCredit(false);
        }
    }, [editingCredit, editCreditAmount, editCreditNote, editCreditType, editCreditSelectedTenant, editCreditDate, creditPagination.page, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter]);

    // Reconciliation rows are always ₹; Listing Studio rows are credits, or a raw free-image/
    // free-video count for gift rows that never touch the credit lot at all.
    const describeCreditAmount = (tx) => {
        if (tx.category !== 'LISTING_STUDIO') return `₹${tx.amount}`;
        if (tx.giftKind === 'freeImages') return `${tx.editableAmount} free image${tx.editableAmount === 1 ? '' : 's'}`;
        if (tx.giftKind === 'freeVideos') return `${tx.editableAmount} free video${tx.editableAmount === 1 ? '' : 's'}`;
        return `${tx.editableAmount} credits`;
    };

    const handleDeleteCreditTransaction = (tx) => {
        if (!tx) return;
        setOpenCreditMenuId(null);
        setCreditMenuPosition(null);
        setConfirmDeleteCredit({
            tx,
            title: `Delete ${tx.type === 'ADMIN_GIFT' ? 'Admin Gift' : 'Free Trial Credit'}`,
            message: `Delete this ${tx.type === 'ADMIN_GIFT' ? 'admin gift' : 'free trial credit'} of ${describeCreditAmount(tx)}? This cannot be undone — the amount will be deducted from the buyer's balance.`,
        });
    };

    const confirmDeleteCreditTransaction = async () => {
        if (!confirmDeleteCredit) return;
        const tx = confirmDeleteCredit.tx;
        setConfirmDeleteCredit(null);
        setDeletingCreditId(tx._id);
        try {
            const base = tx.category === 'LISTING_STUDIO' ? 'ls-credit-transactions' : 'credit-transactions';
            const { data } = await api.delete(`/admin/invoices/${base}/${tx._id}`);
            toast.success(data?.message || 'Credit deleted');
            fetchCreditHistory(creditPagination.page, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete credit');
        } finally {
            setDeletingCreditId(null);
        }
    };

    const handleCancelCreditTransaction = (tx) => {
        if (!tx) return;
        setOpenCreditMenuId(null);
        setCreditMenuPosition(null);
        setConfirmCancelCredit({
            tx,
            title: `Cancel ${tx.type === 'ADMIN_GIFT' ? 'Admin Gift' : 'Free Trial Credit'}`,
            message: `Are you sure you want to cancel this ${tx.type === 'ADMIN_GIFT' ? 'admin gift' : 'free trial credit'}? ${describeCreditAmount(tx)} will be reversed from the buyer's balance. The record is kept for history.`,
        });
    };

    const confirmCancelCreditTransaction = async () => {
        if (!confirmCancelCredit) return;
        const tx = confirmCancelCredit.tx;
        setConfirmCancelCredit(null);
        setCancellingCreditId(tx._id);
        try {
            const base = tx.category === 'LISTING_STUDIO' ? 'ls-credit-transactions' : 'credit-transactions';
            const { data } = await api.post(`/admin/invoices/${base}/${tx._id}/cancel`);
            toast.success(data?.message || 'Credit cancelled');
            fetchCreditHistory(creditPagination.page, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel credit');
        } finally {
            setCancellingCreditId(null);
        }
    };


    const fetchBuyers = useCallback(async (q) => {
        setSearching(true);
        try {
            const url = q ? `/admin/invoices/buyers?q=${encodeURIComponent(q)}` : '/admin/invoices/buyers';
            const { data } = await api.get(url);
            setBuyers(data || []);
        } catch { /* buyer search best-effort */ } finally { setSearching(false); }
    }, []);

    // Small parallel buyer search for the credit Edit modal, reusing the same /buyers endpoint
    // as fetchBuyers above — kept separate (not sharing buyerQuery/buyers/selectedBuyer) because
    // those are wired into the Create/Edit Invoice drawer's own GST-parsing logic, which doesn't
    // apply here and shouldn't risk bleeding state between two independently-openable modals.
    const editCreditDebounceTimer = React.useRef(null);
    const fetchEditCreditBuyers = useCallback(async (q) => {
        setEditCreditBuyerSearching(true);
        try {
            const url = q ? `/admin/invoices/buyers?q=${encodeURIComponent(q)}` : '/admin/invoices/buyers';
            const { data } = await api.get(url);
            setEditCreditBuyers(data || []);
        } catch { setEditCreditBuyers([]); } finally { setEditCreditBuyerSearching(false); }
    }, []);

    const handleEditCreditBuyerInput = (value) => {
        setEditCreditBuyerQuery(value);
        if (value && value.length >= 2) {
            if (editCreditDebounceTimer.current) clearTimeout(editCreditDebounceTimer.current);
            const tidMatch = value.trim().match(/^\d+$/);
            const searchQ = tidMatch ? tidMatch[0] : value;
            editCreditDebounceTimer.current = setTimeout(() => fetchEditCreditBuyers(searchQ), 300);
        } else if (!value) {
            fetchEditCreditBuyers('');
        }
    };

    const selectEditCreditBuyer = (b) => {
        setEditCreditSelectedTenant(b);
        setEditCreditBuyerQuery('');
        setEditCreditBuyers([]);
        setShowEditCreditBuyerDropdown(false);
    };

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
        const displayName = buyerCopy.gstBusinessName || buyerCopy.orgName || buyerCopy.name || '';
        buyerCopy.name = displayName;
        buyerCopy.orgName = buyerCopy.orgName || buyerCopy.name || '';
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
                const igst = parseFloat((baseAmount * gstRate).toFixed(2));
                totalAmount = baseAmount + igst;
            } else {
                const halfRate = gstRate / 2;
                const cgst = parseFloat((baseAmount * halfRate).toFixed(2));
                const sgst = parseFloat((baseAmount * halfRate).toFixed(2));
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
    const originalCategory = editingInvoice?.paymentCategory || 'RECONCILIATION';
    const categoryChanged = !!editingInvoice && manualPaymentCategory !== originalCategory;
    const fieldsChanged = snap && (
        buyerQuery !== snap.buyerName ||
        (selectedBuyer?.name || '') !== (snap.buyerName || '') ||
        (selectedBuyer?.orgName || '') !== (snap.orgName || '') ||
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
        ((user?.role === 'SuperAdmin' || user?.role === 'SBM') && editInvoiceSeq !== snap.invoiceSeq)
    );
    const hasUnsavedChanges = !!fieldsChanged || categoryChanged;

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
                    paymentCategory: manualPaymentCategory,
                    invoiceDate: combineDateTimeAsIST(transactionDate, getLocalTimeInputValue()),
                });

                const msg = data.listingStudioGrant
                    ? `${data.listingStudioGrant.credits} credits added to ${selectedBuyer.name} (Speedy Listing)`
                    : data.creditsGiven
                        ? `${data.creditsGiven} credits added to ${selectedBuyer.name}`
                        : 'Credits added successfully';
                toast.success(msg);
                handleCloseDrawer();
                fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
                if (activeTab === 'freeTrialCredits' || activeTab === 'adminGift') fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter);
            } catch { toast.error('Failed to add credits'); } finally { setCreating(false); }
            return;
        }

        // "Bill To Name" and "Organization Name" are whatever the admin typed in the drawer —
        // they go on this invoice only; the tenant's profile is not changed.
        const buyerName = selectedBuyer?.name?.trim() || buyerQuery.trim();
        if (!buyerName) { toast.error('Enter a buyer name'); return; }
        const organizationName = selectedBuyer?.orgName?.trim() || (isB2C ? buyerQuery.trim() : '') || buyerName;

        if (!isB2C) {
            const buyerGstin = selectedBuyer?.gstin?.trim() || '';
            if (!buyerGstin) { toast.error('GSTIN is required'); return; }
            const buyerAddress = selectedBuyer?.address?.trim() || '';
            const buyerState = selectedBuyer?.state?.trim() || '';
            if (!buyerAddress || !buyerState) { toast.error('Please provide buyer address and state'); return; }
        }
        if (!lineItems.some(item => Number(item.amount) > 0)) { toast.error('Add at least one line item with amount'); return; }
        // Payment mode is only needed when saving invoice fields. A plan/category change alone goes
        // through the transfer endpoint and never sends it; a gateway-paid invoice (no createdBy, real
        // payment id) may also predate payment modes being recorded, so it is not forced either.
        const categoryOnlyChange = !!editingInvoice && !fieldsChanged;
        const isGatewayInvoice = !!editingInvoice && !editingInvoice.createdBy?.email
            && !!editingInvoice.paymentId && !String(editingInvoice.paymentId).startsWith('MANUAL-');
        if (!paymentMethod && !categoryOnlyChange && !isGatewayInvoice) { toast.error('Please select a payment mode'); setPaymentMethodError(true); return; }
        if (!categoryOnlyChange && ['Cheque', 'Credit', 'Online'].includes(paymentMethod) && !utrNumber.trim()) { toast.error('UTR number is required'); setUtrNumberError(true); return; }

        const isEdit = !!editingInvoice;
        setCreating(true);
        try {
            const payload = {
                billingType: isB2C ? 'B2C' : 'B2B',
                tenantId: selectedBuyer?._id || null,
                buyer: {
                    name: buyerName,
                    organizationName,
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
                paymentCategory: manualPaymentCategory,
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
                if (fieldsChanged) {
                    await api.put(`/admin/invoices/update/${editingInvoice._id}`, { ...payload, paymentCategory: originalCategory, invoiceNumber: editInvoiceSeq, creditsValue });
                    toast.success(`Invoice ${newFullNumber} updated`);
                }
                if (categoryChanged) {
                    try {
                        const { data } = await api.post(`/admin/invoices/${editingInvoice._id}/transfer-category`, { toCategory: manualPaymentCategory });
                        toast.success(data?.message || 'Invoice category changed and credits moved');
                    } catch (err) {
                        toast.error(err?.response?.data?.message || 'Failed to change invoice category');
                        return;
                    }
                }
            } else {
                const creditsValue = addCreditsOnCreate ? (isB2C ? baseAmount / (1 + GST_RATE / 100) : baseAmount) : 0;
                const { data } = await api.post('/admin/invoices/create', { ...payload, creditsToAdd: creditsValue });
                const msg = data.creditsGiven
                    ? `Invoice ${data.invoiceNumber} created + ₹${data.creditsGiven} credits added`
                    : `Invoice ${data.invoiceNumber} created successfully`;
                toast.success(msg);
            }

            handleCloseDrawer();
            fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
            if (activeTab === 'freeTrialCredits' || activeTab === 'adminGift') fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter);

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
                orgName: invoice.buyer?.organizationName || invoice.buyer?.name || '',
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
                orgName: invoice.buyer?.organizationName || invoice.buyer?.name || '',
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
            setManualPaymentCategory(invoice.paymentCategory || 'RECONCILIATION');
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
            setManualPaymentCategory('RECONCILIATION');
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
        setUtrNumberError(false);
        setRoundOff(false);
        setRoundOffAmount(0);
        setGiveFreeCredits(false);
        setManualPaymentCategory('RECONCILIATION');
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
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to cancel invoice');
        } finally {
            setCancellingId(null);
        }
    };

    const handleRefundInvoice = async (inv) => {
        setOpenMenuId(null);
        setMenuPosition(null);
        const creditNote = inv.creditsAdded > 0 ? ` and ₹${inv.creditsAdded} credits will be deducted from the buyer's account` : '';
        setConfirmRefund({
            inv,
            title: 'Mark Invoice Refunded',
            message: `Mark invoice ${inv.invoiceNumber} as refunded? This cannot be undone${creditNote}.`,
        });
    };

    const confirmRefundInvoice = async () => {
        if (!confirmRefund) return;
        const inv = confirmRefund.inv;
        setConfirmRefund(null);
        setOpenMenuId(null);
        setRefundingId(inv._id);
        try {
            const { data } = await api.post(`/admin/invoices/refund/${inv._id}`);
            toast.success(data?.message || 'Invoice refunded');
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to refund invoice');
        } finally {
            setRefundingId(null);
        }
    };

    const handleTransferCategory = (inv) => {
        setOpenMenuId(null);
        setMenuPosition(null);
        const toCategory = inv.paymentCategory === 'LISTING_STUDIO' ? 'RECONCILIATION' : 'LISTING_STUDIO';
        setConfirmTransfer({
            inv, toCategory,
            title: 'Transfer Invoice Category',
            message: `Move invoice ${inv.invoiceNumber}'s value from ${inv.paymentCategory === 'LISTING_STUDIO' ? 'Speedy Listing' : 'Reconciliation'} to ${toCategory === 'LISTING_STUDIO' ? 'Speedy Listing' : 'Reconciliation'}? This reverses the credit on one side and grants the equivalent plan bundle on the other — it cannot be undone from here.`,
        });
    };

    const confirmTransferCategory = async () => {
        if (!confirmTransfer) return;
        const { inv, toCategory } = confirmTransfer;
        setConfirmTransfer(null);
        setTransferringId(inv._id);
        try {
            const { data } = await api.post(`/admin/invoices/${inv._id}/transfer-category`, { toCategory });
            toast.success(data?.message || 'Invoice transferred');
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to transfer invoice category');
        } finally {
            setTransferringId(null);
        }
    };

    const handleVerifyInvoice = async (inv) => {
        setOpenMenuId(null);
        setMenuPosition(null);
        setVerifyingId(inv._id);
        try {
            const endpoint = inv.verified ? `/admin/invoices/unverify/${inv._id}` : `/admin/invoices/verify/${inv._id}`;
            const { data } = await api.post(endpoint);
            toast.success(data?.message || (inv.verified ? 'Invoice unverified' : 'Invoice verified'));
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to update invoice');
        } finally {
            setVerifyingId(null);
        }
    };

    const handleBulkVerify = async () => {
        if (selectedIds.length === 0) {
            toast.error('Select at least one invoice to verify');
            return;
        }
        setBulkVerifying(true);
        try {
            let successCount = 0;
            for (const id of selectedIds) {
                try {
                    await api.post(`/admin/invoices/verify/${id}`);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to verify invoice ${id}:`, err);
                }
            }
            toast.success(`${successCount}/${selectedIds.length} invoices verified`);
            setSelectedIds([]);
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        } catch (err) {
            toast.error('Failed to verify invoices');
        } finally {
            setBulkVerifying(false);
        }
    };

    const handleBulkUnverify = async () => {
        if (selectedIds.length === 0) {
            toast.error('Select at least one invoice to unverify');
            return;
        }
        setBulkUnverifying(true);
        try {
            let successCount = 0;
            for (const id of selectedIds) {
                try {
                    await api.post(`/admin/invoices/unverify/${id}`);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to unverify invoice ${id}:`, err);
                }
            }
            toast.success(`${successCount}/${selectedIds.length} invoices unverified`);
            setSelectedIds([]);
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
        } catch (err) {
            toast.error('Failed to unverify invoices');
        } finally {
            setBulkUnverifying(false);
        }
    };

    const handleBulkVerifyCredits = async () => {
        if (selectedCreditIds.length === 0) {
            toast.error('Select at least one credit to verify');
            return;
        }
        setBulkCreditVerifying(true);
        try {
            let successCount = 0;
            for (const id of selectedCreditIds) {
                try {
                    const tx = creditHistory.find(t => t._id === id);
                    const endpoint = tx?.category === 'LISTING_STUDIO'
                        ? `/admin/invoices/ls-credit-transactions/${id}/verify`
                        : `/superadmin/credits/${id}/verify`;
                    await api.post(endpoint);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to verify credit ${id}:`, err);
                }
            }
            toast.success(`${successCount}/${selectedCreditIds.length} credits verified`);
            setSelectedCreditIds([]);
            fetchCreditHistory(creditPagination.page, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter);
        } catch (err) {
            toast.error('Failed to verify credits');
        } finally {
            setBulkCreditVerifying(false);
        }
    };

    const handleBulkUnverifyCredits = async () => {
        if (selectedCreditIds.length === 0) {
            toast.error('Select at least one credit to unverify');
            return;
        }
        setBulkCreditUnverifying(true);
        try {
            let successCount = 0;
            for (const id of selectedCreditIds) {
                try {
                    const tx = creditHistory.find(t => t._id === id);
                    const endpoint = tx?.category === 'LISTING_STUDIO'
                        ? `/admin/invoices/ls-credit-transactions/${id}/unverify`
                        : `/superadmin/credits/${id}/unverify`;
                    await api.post(endpoint);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to unverify credit ${id}:`, err);
                }
            }
            toast.success(`${successCount}/${selectedCreditIds.length} credits unverified`);
            setSelectedCreditIds([]);
            fetchCreditHistory(creditPagination.page, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter);
        } catch (err) {
            toast.error('Failed to unverify credits');
        } finally {
            setBulkCreditUnverifying(false);
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
            fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter);
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

    const toggleSelectCreditOne = (id) => {
        setSelectedCreditIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectCreditAll = () => {
        const pageIds = creditHistory.map(tx => tx._id);
        const allSelected = pageIds.length > 0 && pageIds.every(id => selectedCreditIds.includes(id));
        setSelectedCreditIds(allSelected ? [] : pageIds);
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
                    {/* Same gradient family as the Edit modal header (line ~3356) — orange for Free
                        Trial Credits, purple for Admin Gift — so the banner matches each tab's theme. */}
                    <div className={`relative overflow-hidden rounded-2xl p-7 text-white shadow-lg bg-gradient-to-br ${
                        activeTab === 'adminGift'
                            ? 'from-purple-600 via-purple-700 to-indigo-800'
                            : activeTab === 'freeTrialCredits'
                                ? 'from-orange-500 via-orange-600 to-amber-700'
                                : 'from-brand-600 via-brand-700 to-blue-800'
                    }`}>
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className={`absolute bottom-0 left-0 w-48 h-48 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl ${
                            activeTab === 'adminGift'
                                ? 'bg-purple-300/10'
                                : activeTab === 'freeTrialCredits'
                                    ? 'bg-orange-300/10'
                                    : 'bg-blue-400/10'
                        }`}></div>
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
                                        {activeTab === 'adminGift' ? 'Admin Gift' : activeTab === 'freeTrialCredits' ? 'Free Trial Credits' : activeTab === 'refundedPayments' ? 'Refunded Payments' : 'Invoices'}
                                    </h1>
                                    <p className={`mt-1 text-sm ${
                                        activeTab === 'adminGift'
                                            ? 'text-purple-100'
                                            : activeTab === 'freeTrialCredits'
                                                ? 'text-orange-100'
                                                : 'text-blue-100'
                                    }`}>
                                        {activeTab === 'adminGift'
                                            ? 'View admin gift credits given to buyers'
                                            : activeTab === 'freeTrialCredits'
                                                ? 'Give and track free trial credits for buyers'
                                                : activeTab === 'refundedPayments'
                                                    ? 'Payments refunded by Razorpay (not part of the invoice series)'
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
                            {activeTab === 'adminGift' && (
                                <button
                                    onClick={() => setIsGiftModalOpen(true)}
                                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-white text-purple-700 hover:bg-white/90 shadow-sm transition-all duration-200 flex items-center gap-2 active:scale-[0.97]"
                                >
                                    <Plus size={16} /> Admin Gift
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
                        {!isSBM && (
                        <button
                            onClick={() => setActiveTab('refundedPayments')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${activeTab === 'refundedPayments' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <RotateCcw size={15} className="inline mr-1.5" />Refunded Payments
                        </button>
                        )}
                    </div>

                    {/* ── Invoices Tab ── */}
                    {activeTab === 'refundedPayments' ? (
                        <RefundedPaymentsTab canExport={canExport} />
                    ) : activeTab === 'invoices' ? (
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
                                            onClick={() => fetchInvoices(invoicePagination.page, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            <RotateCw size={12} />
                                            Refresh
                                        </button>
                                        {user?.role === 'SuperAdmin' && (
                                            <button
                                                onClick={handleSyncSettlements}
                                                disabled={syncingSettlements}
                                                title="Check Razorpay for settlements of all unsettled invoices"
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {syncingSettlements ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                                                {syncingSettlements ? 'Syncing…' : 'Sync settlements'}
                                            </button>
                                        )}
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
                                        {canExport && !isSBM && (
                                        <div className="relative" ref={exportMenuRef}>
                                            <button
                                                onClick={() => setExportMenuOpen(prev => !prev)}
                                                disabled={exportingPdf || exportingExcel || exportingZip}
                                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {(exportingPdf || exportingExcel) ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                                                Export{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                                            </button>
                                            {exportMenuOpen && (
                                                <div className="absolute top-full right-0 mt-1 z-30 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                                                    {user?.role === 'SuperAdmin' && (
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
                                                    )}
                                                    <button
                                                        onClick={async () => {
                                                            setExportMenuOpen(false);
                                                            setExportingExcel(true);
                                                            try {
                                                                let response;
                                                                // Excel is always in invoice-number order; follow the list's direction when
                                                                // the list is sorted by invoice number, so the file matches the screen.
                                                                const excelSort = sortBy === 'invoiceNumber' ? { sortOrder } : {};
                                                                if (selectedIds.length > 0) {
                                                                    response = await api.post('/admin/invoices/export-excel', { ids: selectedIds }, { params: excelSort, responseType: 'blob' });
                                                                } else {
                                                                    const params = { ...excelSort };
                                                                    const tidMatch = debouncedSearchTerm.trim().match(/^\d+$/);
                                                                    const processedSearch = tidMatch ? tidMatch[0] : debouncedSearchTerm;
                                                                    if (processedSearch) params.q = processedSearch;
                                                                    if (sourceFilter !== 'all') params.source = sourceFilter;
                                                                    if (statusFilter !== 'all') params.status = statusFilter;
                                                                    if (startDate) params.startDate = startDate;
                                                                    if (endDate) params.endDate = endDate;
                                                                    if (fyFilter && fyFilter !== 'all') params.fy = fyFilter;
                                                                    if (billingTypeFilter !== 'all') params.billingType = billingTypeFilter;
                                                                    if (verifiedFilter !== 'all') params.verified = verifiedFilter;
                                                                    if (settlementFilter !== 'all') params.settlement = settlementFilter;
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
                                                    {user?.role === 'SuperAdmin' && selectedIds.length === 0 && (
                                                    <button
                                                        disabled={exportingZip}
                                                        onClick={async () => {
                                                            setExportMenuOpen(false);
                                                            // Fire-and-forget: the API only enqueues the job and returns immediately.
                                                            // No polling, no progress, no in-app download link — the backend Redis
                                                            // lock (not this flag) is what actually stops a second export from
                                                            // starting; this is only a brief UX guard against a double-click while
                                                            // the enqueue request itself is in flight.
                                                            setExportingZip(true);
                                                            try {
                                                                // Async path: no invoice-count cap, generation happens on a dedicated
                                                                // worker (see server/workers/invoiceExportWorker.js), not this request.
                                                                // The old synchronous /export-zip (500-invoice cap) is untouched.
                                                                // Only reachable with no selection (see the condition above) — this
                                                                // always exports every invoice matching the current filter, never a
                                                                // manual selection, which is why the label below reads "Export All as ZIP".
                                                                const params = {};
                                                                const tidMatch = debouncedSearchTerm.trim().match(/^\d+$/);
                                                                const processedSearch = tidMatch ? tidMatch[0] : debouncedSearchTerm;
                                                                if (processedSearch) params.q = processedSearch;
                                                                if (sourceFilter !== 'all') params.source = sourceFilter;
                                                                if (statusFilter !== 'all') params.status = statusFilter;
                                                                if (startDate) params.startDate = startDate;
                                                                if (endDate) params.endDate = endDate;
                                                                if (fyFilter && fyFilter !== 'all') params.fy = fyFilter;
                                                                if (billingTypeFilter !== 'all') params.billingType = billingTypeFilter;
                                                                if (verifiedFilter !== 'all') params.verified = verifiedFilter;
                                                                await api.post('/admin/invoices/export-zip-async', {}, { params, skipErrorToast: true });
                                                                toast.success("Your ZIP export has started. It may take a few minutes to prepare. We'll send the download link to your registered email when it's ready.");
                                                            } catch (err) {
                                                                // Covers the 409 "already running" and 429 "rate limit" cases too —
                                                                // both come back with their own message from the backend.
                                                                toast.error(err?.response?.data?.message || 'Failed to export ZIP');
                                                            } finally {
                                                                setExportingZip(false);
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Package size={13} /> Export All as ZIP
                                                    </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        )}
                                        {user?.role === 'SuperAdmin' && selectedIds.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleBulkVerify}
                                                    disabled={bulkVerifying}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                >
                                                    {bulkVerifying ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                    Verify ({selectedIds.length})
                                                </button>
                                                <button
                                                    onClick={handleBulkUnverify}
                                                    disabled={bulkUnverifying}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                >
                                                    {bulkUnverifying ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                                    Unverify ({selectedIds.length})
                                                </button>
                                            </div>
                                        )}
                                        <PillSelect
                                            value={paymentCategoryFilter}
                                            onChange={setPaymentCategoryFilter}
                                            activeValue="all"
                                            activeClass="bg-violet-50 text-violet-700 border-violet-200"
                                            chevronActive="text-violet-600"
                                            options={[
                                                { value: 'all', label: 'All Categories' },
                                                { value: 'RECONCILIATION', label: 'Reconciliation' },
                                                { value: 'LISTING_STUDIO', label: 'Speedy Listing' },
                                            ]}
                                        />
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
                                                const activeCount = [sourceFilter !== 'all' ? 1 : 0, billingTypeFilter !== 'all' ? 1 : 0, statusFilter !== 'all' ? 1 : 0, fyFilter !== 'all' ? 1 : 0, (!isSBM && startDate) ? 1 : 0, verifiedFilter !== 'all' ? 1 : 0, settlementFilter !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0);
                                                return activeCount > 0 ? <span className="ml-0.5 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span> : null;
                                            })()}
                                        </button>
                                        <AnimatePresence>
                                        {showFilters && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                            transition={{ duration: 0.15, ease: 'easeOut' }}
                                            className="absolute top-full right-0 mt-2 z-30 w-80 bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200"
                                        >
                                            {/* Header */}
                                            <div className="bg-[#1a2c5e] px-4 py-3 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xs font-bold text-white uppercase tracking-wide">Filters</h3>
                                                    {(() => {
                                                        const activeCount = [sourceFilter !== 'all', billingTypeFilter !== 'all', statusFilter !== 'all', fyFilter !== 'all', (!isSBM && !!startDate), verifiedFilter !== 'all', settlementFilter !== 'all'].filter(Boolean).length;
                                                        return activeCount > 0 ? (
                                                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-[#1a2c5e] text-[10px] font-bold">{activeCount}</span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                                <button
                                                    onClick={() => setShowFilters(false)}
                                                    className="p-0.5 text-white/70 hover:text-white transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            {/* Active filter chips — each individually removable */}
                                            {(() => {
                                                const chips = [];
                                                if (fyFilter !== 'all') chips.push({ key: 'fy', label: `F.Y. ${fyLabel(fyFilter)}`, onRemove: () => setFyFilter('all') });
                                                if (!isSBM && startDate) chips.push({
                                                    key: 'date',
                                                    label: `${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'End'}`,
                                                    onRemove: () => { setStartDate(getDefaultStartDate()); setEndDate(getDefaultEndDate()); },
                                                });
                                                if (sourceFilter !== 'all') chips.push({ key: 'source', label: `Source: ${sourceFilter === 'manual' ? 'Manual' : 'Auto'}`, onRemove: () => setSourceFilter('all') });
                                                if (billingTypeFilter !== 'all') chips.push({ key: 'billing', label: `Billing: ${billingTypeFilter}`, onRemove: () => setBillingTypeFilter('all') });
                                                if (statusFilter !== 'all') chips.push({ key: 'status', label: `Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`, onRemove: () => setStatusFilter('all') });
                                                if (verifiedFilter !== 'all') chips.push({ key: 'verified', label: `Verified: ${verifiedFilter.charAt(0).toUpperCase() + verifiedFilter.slice(1)}`, onRemove: () => setVerifiedFilter('all') });
                                                if (settlementFilter !== 'all') chips.push({ key: 'settlement', label: `Settlement: ${settlementFilter.charAt(0).toUpperCase() + settlementFilter.slice(1)}`, onRemove: () => setSettlementFilter('all') });

                                                return chips.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                                                        {chips.map(chip => (
                                                            <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-[#1a2c5e]/10 text-[#1a2c5e] text-[11px] font-semibold">
                                                                {chip.label}
                                                                <button onClick={chip.onRemove} className="p-0.5 hover:bg-[#1a2c5e]/20 rounded-full transition-colors">
                                                                    <X size={10} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}

                                            {/* Content */}
                                            <div className="px-4 py-4 space-y-4 max-h-96 overflow-y-auto">
                                                {/* Period */}
                                                <div className="space-y-3">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Period</span>
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Financial year</label>
                                                        <div className="relative">
                                                            <select
                                                                value={fyFilter}
                                                                onChange={e => setFyFilter(e.target.value)}
                                                                className="appearance-none w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1a2c5e] transition-all"
                                                            >
                                                                {availableFYs.map(code => (
                                                                    <option key={code} value={code}>F.Y. {fyLabel(code)}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    <div className="relative" ref={dateDropdownRef}>
                                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date range</label>
                                                        <button
                                                            onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                                                            className="flex items-center justify-between w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1a2c5e] transition-all"
                                                        >
                                                            <span className="truncate">{startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Start'} – {endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'End'}</span>
                                                            {startDate ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setStartDate(getDefaultStartDate()); setEndDate(getDefaultEndDate()); }}
                                                                    className="ml-1 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors flex-shrink-0"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            ) : <ChevronDown size={12} className="text-slate-400" />}
                                                        </button>
                                                        {dateDropdownOpen && (
                                                            <div className="absolute top-full left-0 right-0 mt-1.5 z-40 flex flex-col items-stretch bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
                                                                <DateRangePicker
                                                                    startDate={startDate}
                                                                    endDate={endDate}
                                                                    onChange={({ min, max }) => {
                                                                        setStartDate(min || startDate);
                                                                        if (max) { setEndDate(max); setDateDropdownOpen(false); }
                                                                    }}
                                                                    hideDisplayChip
                                                                    maxDays={365}
                                                                    minDate={sbmMinDate}
                                                                />
                                                                {startDate ? (
                                                                    <button
                                                                        onClick={() => { setStartDate(getDefaultStartDate()); setEndDate(getDefaultEndDate()); setDateDropdownOpen(false); }}
                                                                        className="w-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border-t border-slate-200 hover:bg-slate-100 transition-colors"
                                                                    >
                                                                        Clear
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="h-px bg-slate-100" />

                                                {/* Invoice Type */}
                                                <div className="space-y-3">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoice Type</span>
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Source</label>
                                                        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                                                            {['all', 'manual', 'auto'].map(s => (
                                                                <button
                                                                    key={s}
                                                                    onClick={() => setSourceFilter(s)}
                                                                    className={`flex-1 px-2 py-1.5 text-xs font-bold rounded transition-all capitalize ${
                                                                        sourceFilter === s
                                                                            ? 'bg-[#1a2c5e] text-white shadow-sm'
                                                                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                                                    }`}
                                                                >
                                                                    {s === 'all' ? 'All' : s === 'manual' ? 'Manual' : 'Auto'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Billing</label>
                                                        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                                                            {['all', 'B2B', 'B2C'].map(t => (
                                                                <button
                                                                    key={t}
                                                                    onClick={() => setBillingTypeFilter(t)}
                                                                    className={`flex-1 px-2 py-1.5 text-xs font-bold rounded transition-all ${
                                                                        billingTypeFilter === t
                                                                            ? 'bg-[#1a2c5e] text-white shadow-sm'
                                                                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                                                    }`}
                                                                >
                                                                    {t}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-slate-100" />

                                                {/* Status */}
                                                <div className="space-y-3">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Status</label>
                                                        <div className="relative">
                                                            <select
                                                                value={statusFilter}
                                                                onChange={e => setStatusFilter(e.target.value)}
                                                                className="appearance-none w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1a2c5e] transition-all"
                                                            >
                                                                <option value="all">All</option>
                                                                <option value="edited">Edited</option>
                                                                <option value="cancelled">Cancelled</option>
                                                                <option value="refunded">Refunded</option>
                                                            </select>
                                                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Verified</label>
                                                        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                                                            {['all', 'verified', 'unverified'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => setVerifiedFilter(v)}
                                                                    className={`flex-1 px-2 py-1.5 text-xs font-bold rounded transition-all capitalize ${
                                                                        verifiedFilter === v
                                                                            ? 'bg-[#1a2c5e] text-white shadow-sm'
                                                                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                                                    }`}
                                                                >
                                                                    {v === 'all' ? 'All' : v}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Settlement</label>
                                                        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                                                            {['all', 'settled', 'pending', 'overdue'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => setSettlementFilter(v)}
                                                                    className={`flex-1 px-2 py-1.5 text-xs font-bold rounded transition-all capitalize ${
                                                                        settlementFilter === v
                                                                            ? 'bg-[#1a2c5e] text-white shadow-sm'
                                                                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                                                    }`}
                                                                >
                                                                    {v === 'all' ? 'All' : v}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sticky footer */}
                                            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                                                <button
                                                    onClick={() => { setSourceFilter('all'); setBillingTypeFilter('all'); setPaymentCategoryFilter('all'); setStatusFilter('all'); setFyFilter('all'); setStartDate(getDefaultStartDate()); setEndDate(getDefaultEndDate()); setVerifiedFilter('all'); setSettlementFilter('all'); setShowFilters(false); }}
                                                    className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                                                >
                                                    Clear all
                                                </button>
                                                <button
                                                    onClick={applyInvoiceFilters}
                                                    className="px-4 py-2 text-xs font-bold text-white bg-[#1a2c5e] hover:bg-[#0f1a3d] rounded-lg transition-all"
                                                >
                                                    Show {invoicePagination.total} invoice{invoicePagination.total !== 1 ? 's' : ''}
                                                </button>
                                            </div>
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
                                                {!isSBM && (
                                                <th className="py-3.5 px-4 text-center" style={{ width: 40 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={invoices.length > 0 && invoices.every(inv => selectedIds.includes(inv._id))}
                                                        onChange={toggleSelectAll}
                                                        className="w-4 h-4 rounded accent-[#1a2c5e] cursor-pointer"
                                                    />
                                                </th>
                                                )}
                                                <th className="py-3.5 px-3 text-left" style={{ width: 148 }}><SortBtn label="Invoice #" columnKey="invoiceNumber" /></th>
                                                <th className="py-3.5 px-3 text-left" style={{ width: 120 }}><SortBtn label="Payment Category" columnKey="paymentCategory" /></th>
                                                <th className="py-3.5 px-3 text-left" style={{ width: 178 }}>
                                                    <div className="flex items-center gap-1.5">
                                                        <SortBtn label="Buyer" columnKey="buyerName" />
                                                        <Tooltip text="Sort by Group No.">
                                                            <button
                                                                onClick={() => {
                                                                    setSortBy('groupNo');
                                                                    setSortOrder(prev => sortBy === 'groupNo' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                                                                }}
                                                                className={`p-0.5 rounded transition-colors ${sortBy === 'groupNo' ? 'text-[#1a2c5e]' : 'text-slate-300 hover:text-slate-500'}`}
                                                            >
                                                                <Hash size={12} />
                                                            </button>
                                                        </Tooltip>
                                                    </div>
                                                </th>
                                                <th className="py-3.5 px-3 text-left" style={{ width: 90 }}><SortBtn label="Date" columnKey="createdAt" /></th>
                                                <th className="py-3.5 px-3 text-left" style={{ width: 90 }}><SortBtn label="Created" columnKey="createdAt" /></th>
                                                <th className="py-3.5 px-3 text-left" style={{ width: 100 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">GSTIN</span>
                                                </th>
                                                <th className="py-3.5 px-3 text-right" style={{ width: 160 }}><SortBtn label="Amount" columnKey="totalAmount" /></th>
                                                <th className="py-3.5 px-3 text-center" style={{ width: 65 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">Source</span>
                                                </th>
                                                <th className="py-3.5 px-3 text-center" style={{ width: 85 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">Payment</span>
                                                </th>
                                                <th className="py-3.5 px-2 text-right" style={{ width: 50 }}>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-black">Actions</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                Array.from({ length: 5 }).map((_, i) => (
                                                    <tr key={i} className="animate-pulse">
                                                        {[20, 50, 45, 60, 60, 100, 70, 60, 50, 50, 50, 30].map((w, j) => (
                                                            <td key={j} className="py-4 px-6">
                                                                <div className="h-4 bg-slate-200 rounded" style={{ width: w + '%' }}></div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))
                                            ) : invoices.length === 0 ? (
                                                <tr>
                                                    <td colSpan={12} className="py-16 text-center">
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
                                                        className={`cursor-pointer transition-colors${inv.status !== 'active' ? ' bg-slate-100/50' : ' hover:bg-slate-50/50'}`}
                                                    >
                                                        {!isSBM && (
                                                        <td className="py-4 px-4 text-center" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.includes(inv._id)}
                                                                onChange={() => toggleSelectOne(inv._id)}
                                                                className="w-4 h-4 rounded accent-[#1a2c5e] cursor-pointer"
                                                            />
                                                        </td>
                                                        )}
                                                        <td className="py-4 px-3">
                                                            <div>
                                                                <span className={`text-sm font-bold font-mono ${inv.status !== 'active' ? 'text-slate-400 line-through' : 'text-[#1a2c5e]'}`}>{inv.invoiceNumber}</span>
                                                                <div className="flex gap-1.5 mt-0.5">
                                                                {user?.role === 'SuperAdmin' && inv.verified && inv.status === 'active' && (
                                                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">Verified</span>
                                                                )}
                                                                {inv.isEdited && inv.status === 'active' && (
                                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Edited</span>
                                                                )}
                                                                {inv.status === 'cancelled' && (
                                                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Cancelled</span>
                                                                )}
                                                                {inv.status === 'refunded' && (
                                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">Refunded</span>
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
                                                        <td className="py-4 px-3 text-left">
                                                            <span className="text-sm font-medium text-slate-700">
                                                                {inv.paymentCategory === 'LISTING_STUDIO' ? 'Speedy Listing' : 'Reconciliation'}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-3">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-slate-800 truncate">{inv.buyerLabel || inv.buyer?.name || '-'}</p>
                                                                <p className="text-xs text-slate-400 truncate">{inv.buyer?.state || '-'}</p>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-3">
                                                            <span className="text-sm text-slate-600">
                                                                {formatDateDDMMYYYY(inv.invoiceDate || inv.createdAt)}
                                                                    <br />
                                                                    <span className="text-[11px] text-slate-400">{new Date(inv.invoiceDate || inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-3">
                                                            <span className="text-sm text-slate-600">
                                                                {formatDateDDMMYYYY(inv.createdAt)}
                                                                    <br />
                                                                    <span className="text-[11px] text-slate-400">{new Date(inv.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-3">
                                                            <span className="text-xs font-mono text-slate-500 break-all">{inv.buyer?.gstin || '-'}</span>
                                                        </td>
                                                        <td className="py-4 px-3 text-right">
                                                            <div
                                                                title={inv.settlementState === 'settled'
                                                                    ? `Settled on ${formatDateDDMMYYYY(inv.settlement.settledAt)}\nSettlement ${inv.settlement.settlementId} · UTR ${inv.settlement.utr || '—'}\nGross ₹${inv.settlement.amount} · fee+tax ₹${((inv.settlement.fee || 0) + (inv.settlement.tax || 0)).toFixed(2)} · net ₹${inv.settlement.netAmount}`
                                                                    : inv.settlementState === 'overdue' ? 'Razorpay has not settled this payment yet — overdue'
                                                                        : inv.settlementState === 'pending' ? 'Waiting for Razorpay settlement' : undefined}
                                                            >
                                                                <span className={`text-sm font-semibold ${
                                                                    inv.settlementState === 'settled' ? 'text-emerald-600'
                                                                        : inv.settlementState === 'overdue' ? 'text-red-600'
                                                                            : inv.settlementState === 'pending' ? 'text-amber-600'
                                                                                : 'text-slate-600'
                                                                }`}>
                                                                    &#8377;{Number(inv.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </span>
                                                                {inv.settlementState && (
                                                                    <p className={`mt-0.5 flex items-center justify-end gap-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide ${
                                                                        inv.settlementState === 'settled' ? 'text-emerald-500'
                                                                            : inv.settlementState === 'overdue' ? 'text-red-500' : 'text-amber-500'
                                                                    }`}>
                                                                        {inv.settlementState === 'settled' ? <CheckCircle size={11} /> : inv.settlementState === 'overdue' ? <AlertTriangle size={11} /> : <Clock size={11} />}
                                                                        {inv.settlementState === 'settled'
                                                                            ? `Settled ${formatDateDDMMYYYY(inv.settlement.settledAt)}`
                                                                            : inv.settlementState === 'overdue' ? 'Overdue' : 'Pending'}
                                                                    </p>
                                                                )}
                                                                {inv.settlementState === 'settled' && inv.settlement.utr && (
                                                                    <p
                                                                        className="mt-0.5 text-[10px] font-mono text-slate-500 select-all"
                                                                        title="UTR — click to select, then copy"
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        UTR {inv.settlement.utr}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-3 text-center">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${
                                                                inv.source === 'manual'
                                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            }`}>
                                                                {inv.source === 'manual' ? 'Manual' : 'Auto'}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-3 text-center">
                                                            <span className="text-xs text-slate-500">{inv.paymentMethod || '—'}</span>
                                                        </td>
                                                        <td className="py-4 px-2 text-right" onClick={e => e.stopPropagation()}>
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
                                                onClick={() => fetchInvoices(1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter)}
                                                disabled={invoicePagination.page === 1}
                                                className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                First
                                            </button>
                                            <button
                                                onClick={() => fetchInvoices(invoicePagination.page - 1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter)}
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
                                                        onClick={() => fetchInvoices(p, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter)}
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
                                                onClick={() => fetchInvoices(invoicePagination.page + 1, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter)}
                                                disabled={invoicePagination.page === invoicePagination.totalPages}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                            <button
                                                onClick={() => fetchInvoices(invoicePagination.totalPages, debouncedSearchTerm, sourceFilter, statusFilter, startDate, endDate, fyFilter, billingTypeFilter, verifiedFilter)}
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
                                    <div className="flex items-center gap-2">
                                        <PillSelect
                                            value={creditCategoryFilter}
                                            onChange={setCreditCategoryFilter}
                                            activeValue="all"
                                            activeClass="bg-violet-50 text-violet-700 border-violet-200"
                                            chevronActive="text-violet-600"
                                            options={[
                                                { value: 'all', label: 'All Categories' },
                                                { value: 'RECONCILIATION', label: 'Reconciliation' },
                                                { value: 'LISTING_STUDIO', label: 'Speedy Listing' },
                                            ]}
                                        />
                                        {canExport && !isSBM && (
                                        <button
                                            onClick={async () => {
                                                setExportingCreditExcel(true);
                                                try {
                                                    const params = { type: creditTypeFilter };
                                                    if (creditCategoryFilter !== 'all') params.category = creditCategoryFilter;
                                                                    if (debouncedCreditSearch) params.q = debouncedCreditSearch;
                                                    if (creditStartDate) params.startDate = creditStartDate;
                                                    if (creditEndDate) params.endDate = creditEndDate;
                                                    if (creditAmountMin) params.amountMin = creditAmountMin;
                                                    if (creditAmountMax) params.amountMax = creditAmountMax;
                                                    if (creditStatusFilter !== 'all') params.status = creditStatusFilter;
                                                    if (creditVerifiedFilter !== 'all') params.verified = creditVerifiedFilter;
                                                    if (fyFilter && fyFilter !== 'all') params.fy = fyFilter;
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
                                        <div className="relative" ref={creditFilterRef}>
                                            <button
                                                onClick={() => setShowCreditFilters(!showCreditFilters)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                                                    showCreditFilters
                                                        ? 'bg-[#1a2c5e] border-[#1a2c5e] text-white'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <ChevronDown size={12} className={`transition-transform ${showCreditFilters ? 'rotate-180' : ''}`} />
                                                Filters
                                                {(() => {
                                                    const activeCount = [creditStatusFilter !== 'all' ? 1 : 0, creditVerifiedFilter !== 'all' ? 1 : 0, creditStartDate ? 1 : 0, creditEndDate ? 1 : 0, creditAmountMin || creditAmountMax ? 1 : 0].reduce((a, b) => a + b, 0);
                                                    return activeCount > 0 ? <span className="ml-0.5 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span> : null;
                                                })()}
                                            </button>
                                            {showCreditFilters && (
                                                <div className="absolute top-full right-0 mt-2 z-30 w-80 bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
                                                    <div className="bg-[#1a2c5e] px-4 py-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Filters</h3>
                                                            {(() => {
                                                                const activeCount = [fyFilter !== 'all', creditStatusFilter !== 'all', creditVerifiedFilter !== 'all', !!creditStartDate, !!creditEndDate, !!(creditAmountMin || creditAmountMax)].filter(Boolean).length;
                                                                return activeCount > 0 ? (
                                                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-[#1a2c5e] text-[10px] font-bold">{activeCount}</span>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                        <button onClick={() => setShowCreditFilters(false)} className="p-0.5 text-white/70 hover:text-white transition-colors">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                    {(() => {
                                                        const chips = [];
                                                        if (fyFilter && fyFilter !== 'all') chips.push({ key: 'fy', label: `F.Y. ${fyLabel(fyFilter)}`, onRemove: () => setFyFilter('all') });
                                                        if (creditStatusFilter !== 'all') chips.push({ key: 'status', label: `Entry: ${creditStatusFilter === 'cancelled' ? 'Cancelled' : 'Active'}`, onRemove: () => setCreditStatusFilter('all') });
                                                        if (creditVerifiedFilter !== 'all') chips.push({ key: 'verified', label: `Verified: ${creditVerifiedFilter === 'verified' ? 'Verified' : 'Unverified'}`, onRemove: () => setCreditVerifiedFilter('all') });
                                                        if (creditStartDate || creditEndDate) chips.push({
                                                            key: 'date',
                                                            label: `${creditStartDate ? new Date(creditStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Start'} – ${creditEndDate ? new Date(creditEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'End'}`,
                                                            onRemove: () => { setCreditStartDate(getDefaultStartDate()); setCreditEndDate(getDefaultEndDate()); },
                                                        });
                                                        if (creditAmountMin || creditAmountMax) chips.push({
                                                            key: 'amount',
                                                            label: `Amt: ${creditAmountMin || '0'} - ${creditAmountMax || '∞'}`,
                                                            onRemove: () => { setCreditAmountMin(''); setCreditAmountMax(''); },
                                                        });

                                                        return chips.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                                                                {chips.map(chip => (
                                                                    <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-[#1a2c5e]/10 text-[#1a2c5e] text-[11px] font-semibold">
                                                                        {chip.label}
                                                                        <button onClick={chip.onRemove} className="p-0.5 hover:bg-[#1a2c5e]/20 rounded-full transition-colors">
                                                                            <X size={10} />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                    <div className="px-4 py-4 space-y-4 max-h-[420px] overflow-y-auto">
                                                        <div className="space-y-3">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                                                            <div>
                                                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Financial year</label>
                                                                <div className="relative">
                                                                    <select
                                                                        value={fyFilter || 'all'}
                                                                        onChange={e => setFyFilter(e.target.value)}
                                                                        className="appearance-none w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1a2c5e] transition-all"
                                                                    >
                                                                        <option value="all">All</option>
                                                                        {availableFYs.map(code => (
                                                                            <option key={code} value={code}>F.Y. {fyLabel(code)}</option>
                                                                        ))}
                                                                    </select>
                                                                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Entry status</label>
                                                                <div className="relative">
                                                                    <select
                                                                        value={creditStatusFilter}
                                                                        onChange={e => setCreditStatusFilter(e.target.value)}
                                                                        className="appearance-none w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1a2c5e] transition-all"
                                                                    >
                                                                        <option value="all">All</option>
                                                                        <option value="active">Active</option>
                                                                        <option value="cancelled">Cancelled</option>
                                                                    </select>
                                                                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Verified</label>
                                                                <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                                                                    {['all', 'verified', 'unverified'].map(v => (
                                                                        <button
                                                                            key={v}
                                                                            onClick={() => setCreditVerifiedFilter(v)}
                                                                            className={`flex-1 px-2 py-1.5 text-xs font-bold rounded transition-all capitalize ${
                                                                                creditVerifiedFilter === v
                                                                                    ? 'bg-[#1a2c5e] text-white shadow-sm'
                                                                                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                                                            }`}
                                                                        >
                                                                            {v === 'all' ? 'All' : v}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="h-px bg-slate-100" />
                                                        <div className="space-y-3">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date & Amount</span>
                                                            <div className="relative" ref={creditDateDropdownRef}>
                                                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date range</label>
                                                                <button
                                                                    onClick={() => {
                                                                        setCreditAmountDropdownOpen(false);
                                                                        setCreditDateDropdownOpen(!creditDateDropdownOpen);
                                                                    }}
                                                                    className="flex items-center justify-between w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1a2c5e] transition-all"
                                                                >
                                                                    <span>{creditStartDate ? new Date(creditStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Start'} – {creditEndDate ? new Date(creditEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'End'}</span>
                                                                    <ChevronDown size={12} className="text-slate-400" />
                                                                </button>
                                                                {creditDateDropdownOpen && (
                                                                    <div className="absolute top-full left-0 right-0 mt-1.5 z-40 flex flex-col items-stretch bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
                                                                        <DateRangePicker
                                                                            startDate={creditStartDate}
                                                                            endDate={creditEndDate}
                                                                            onChange={({ min, max }) => {
                                                                                setCreditStartDate(min || creditStartDate);
                                                                                if (max) { setCreditEndDate(max); setCreditDateDropdownOpen(false); }
                                                                            }}
                                                                            hideDisplayChip
                                                                            maxDays={365}
                                                                            minDate={sbmMinDate}
                                                                        />
                                                                        {creditStartDate ? (
                                                                            <button
                                                                                onClick={() => { setCreditStartDate(getDefaultStartDate()); setCreditEndDate(getDefaultEndDate()); setCreditDateDropdownOpen(false); }}
                                                                                className="w-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border-t border-slate-200 hover:bg-slate-100 transition-colors"
                                                                            >
                                                                                Clear
                                                                            </button>
                                                                        ) : null}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="relative" ref={creditAmountDropdownRef}>
                                                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Amount range</label>
                                                                <button
                                                                    onClick={() => {
                                                                        setCreditDateDropdownOpen(false);
                                                                        setCreditAmountDropdownOpen(!creditAmountDropdownOpen);
                                                                    }}
                                                                    className={`flex items-center justify-between w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs font-semibold hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#1a2c5e] transition-all ${creditAmountMin || creditAmountMax ? 'border-blue-300 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-700'}`}
                                                                >
                                                                    <span>{creditAmountMin || creditAmountMax ? `${creditAmountMin || '0'} - ${creditAmountMax || '∞'}` : 'Any amount'}</span>
                                                                    <ChevronDown size={12} className="text-slate-400" />
                                                                </button>
                                                                {creditAmountDropdownOpen && (
                                                                    <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[260px]">
                                                                        <div className="flex gap-2 mb-3">
                                                                            <input
                                                                                type="number"
                                                                                placeholder="Min"
                                                                                value={creditAmountMin}
                                                                                onChange={e => setCreditAmountMin(e.target.value)}
                                                                                className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                            />
                                                                            <input
                                                                                type="number"
                                                                                placeholder="Max"
                                                                                value={creditAmountMax}
                                                                                onChange={e => setCreditAmountMax(e.target.value)}
                                                                                className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                            />
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setCreditAmountMin('');
                                                                                    setCreditAmountMax('');
                                                                                    setCreditAmountDropdownOpen(false);
                                                                                }}
                                                                                className="flex-1 text-xs font-semibold px-2 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                                                            >
                                                                                Clear
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter, fyFilter);
                                                                                    setCreditAmountDropdownOpen(false);
                                                                                    setShowCreditFilters(false);
                                                                                }}
                                                                                className="flex-1 text-xs font-semibold px-2 py-1.5 bg-[#1a2c5e] text-white hover:bg-[#14244d] rounded-lg transition-colors"
                                                                            >
                                                                                Apply
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 pt-1">
                                                            <button
                                                                onClick={() => {
                                                                    setFyFilter('all');
                                                                    setCreditStatusFilter('all');
                                                                    setCreditVerifiedFilter('all');
                                                                    setCreditStartDate(getDefaultStartDate());
                                                                    setCreditEndDate(getDefaultEndDate());
                                                                    setCreditAmountMin('');
                                                                    setCreditAmountMax('');
                                                                    fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, getDefaultStartDate(), getDefaultEndDate(), '', '', 'all', 'all', 'all');
                                                                }}
                                                                className="flex-1 text-xs font-semibold px-2 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                                                            >
                                                                Reset
                                                            </button>
                                                            <button
                                                                onClick={applyCreditFilters}
                                                                className="flex-1 text-xs font-semibold px-2 py-1.5 bg-[#1a2c5e] text-white hover:bg-[#14244d] rounded-lg transition-colors"
                                                            >
                                                                Apply
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {user?.role === 'SuperAdmin' && selectedCreditIds.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleBulkVerifyCredits}
                                                    disabled={bulkCreditVerifying}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                >
                                                    {bulkCreditVerifying ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                    Verify ({selectedCreditIds.length})
                                                </button>
                                                <button
                                                    onClick={handleBulkUnverifyCredits}
                                                    disabled={bulkCreditUnverifying}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                >
                                                    {bulkCreditUnverifying ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                                    Unverify ({selectedCreditIds.length})
                                                </button>
                                            </div>
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
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="overflow-x-auto overflow-y-visible">
                                        <table className="w-full table-fixed">
                                            <thead>
                                                <tr className={`border-b border-slate-200 ${activeTab === 'adminGift' ? 'bg-purple-500/10' : 'bg-orange-500/10'}`}>
                                                    {!isSBM && (
                                                    <th className="py-3.5 px-4 text-center" style={{ width: 40 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={creditHistory.length > 0 && creditHistory.every(tx => selectedCreditIds.includes(tx._id))}
                                                            onChange={toggleSelectCreditAll}
                                                            className="w-4 h-4 rounded accent-[#1a2c5e] cursor-pointer"
                                                        />
                                                    </th>
                                                    )}
                                                    <th className="py-3.5 px-3 text-left" style={{ width: 200 }}>
                                                        <button
                                                            onClick={() => {
                                                                setCreditSortBy('groupNo');
                                                                setCreditSortOrder(prev => creditSortBy === 'groupNo' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
                                                            }}
                                                            className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${creditSortBy === 'groupNo' ? 'text-[#1a2c5e]' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Buyer
                                                            {creditSortBy === 'groupNo'
                                                                ? (creditSortOrder === 'asc' ? <ArrowUp size={11} className="text-[#1a2c5e]" /> : <ArrowDown size={11} className="text-[#1a2c5e]" />)
                                                                : <ArrowUpDown size={11} className="text-slate-300" />}
                                                        </button>
                                                    </th>
                                                    <th className="py-3.5 px-3 text-left" style={{ width: 105 }}>
                                                        <button
                                                            onClick={() => {
                                                                setCreditSortBy('transactionDate');
                                                                setCreditSortOrder(prev => creditSortBy === 'transactionDate' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                                                            }}
                                                            className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${creditSortBy === 'transactionDate' ? 'text-[#1a2c5e]' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Date & Time
                                                            {creditSortBy === 'transactionDate'
                                                                ? (creditSortOrder === 'asc' ? <ArrowUp size={11} className="text-[#1a2c5e]" /> : <ArrowDown size={11} className="text-[#1a2c5e]" />)
                                                                : <ArrowUpDown size={11} className="text-slate-300" />}
                                                        </button>
                                                    </th>
                                                    <th className="py-3.5 px-3 text-left" style={{ width: 105 }}>
                                                        <button
                                                            onClick={() => {
                                                                setCreditSortBy('createdAt');
                                                                setCreditSortOrder(prev => creditSortBy === 'createdAt' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                                                            }}
                                                            className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${creditSortBy === 'createdAt' ? 'text-[#1a2c5e]' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Created At
                                                            {creditSortBy === 'createdAt'
                                                                ? (creditSortOrder === 'asc' ? <ArrowUp size={11} className="text-[#1a2c5e]" /> : <ArrowDown size={11} className="text-[#1a2c5e]" />)
                                                                : <ArrowUpDown size={11} className="text-slate-300" />}
                                                        </button>
                                                    </th>
                                                    <th className="py-3.5 px-3 text-left" style={{ width: 110 }}>
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category</span>
                                                    </th>
                                                    <th className="py-3.5 px-3 text-left" style={{ width: 90 }}>
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Type</span>
                                                    </th>
                                                    <th className="py-3.5 px-3 text-right" style={{ width: 90 }}>
                                                        <button
                                                            onClick={() => {
                                                                setCreditSortBy('amount');
                                                                setCreditSortOrder(prev => creditSortBy === 'amount' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                                                            }}
                                                            className={`inline-flex items-center gap-1 ml-auto text-[11px] font-bold uppercase tracking-wider transition-colors ${creditSortBy === 'amount' ? 'text-[#1a2c5e]' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Amount
                                                            {creditSortBy === 'amount'
                                                                ? (creditSortOrder === 'asc' ? <ArrowUp size={11} className="text-[#1a2c5e]" /> : <ArrowDown size={11} className="text-[#1a2c5e]" />)
                                                                : <ArrowUpDown size={11} className="text-slate-300" />}
                                                        </button>
                                                    </th>
                                                    <th className="py-3.5 px-3 text-left" style={{ width: 115 }}>
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Remarks</span>
                                                    </th>
                                                    <th className="py-3.5 px-3 text-left" style={{ width: 100 }}>
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Added By</span>
                                                    </th>
                                                    <th className="py-3.5 px-2 text-center" style={{ width: 50 }}>
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Actions</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {creditHistory.map(tx => (
                                                    <tr key={`${tx.category}-${tx._id}`} className={`transition-colors${tx.cancelled ? ' bg-slate-100/50' : ' hover:bg-slate-50/50'}`}>
                                                        {!isSBM && (
                                                        <td className="py-3 px-4 text-center align-middle" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedCreditIds.includes(tx._id)}
                                                                onChange={() => toggleSelectCreditOne(tx._id)}
                                                                className="w-4 h-4 rounded accent-[#1a2c5e] cursor-pointer"
                                                            />
                                                        </td>
                                                        )}
                                                        <td className="py-3 px-3 align-middle">
                                                            <div className="min-w-0 flex items-center gap-1.5">
                                                                <p className={`text-sm font-semibold truncate ${tx.cancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{tx.tenantCode ? `${tx.tenantCode} - ${tx.buyerName}` : tx.buyerName}</p>
                                                                {tx.cancelled ? (
                                                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded flex-shrink-0">Cancelled</span>
                                                                ) : tx.verified && (
                                                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded flex-shrink-0">Verified</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3 align-middle">
                                                            <span className="text-xs text-slate-600 whitespace-nowrap truncate block">
                                                                {new Date(tx.transactionDate || tx.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 align-middle">
                                                            <span className="text-xs text-slate-600 whitespace-nowrap truncate block">
                                                                {formatDateDDMMYYYY(tx.createdAt)}
                                                                <br />
                                                                <span className="text-[11px] text-slate-400">{new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 align-middle">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${tx.category === 'LISTING_STUDIO' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                {tx.categoryLabel || 'Reconciliation'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 align-middle">
                                                            {(() => {
                                                                const badgeColors = {
                                                                    'INVOICE_CREDIT': 'bg-green-100 text-green-700',
                                                                    'INVOICE_ADJUSTMENT': 'bg-blue-100 text-blue-700',
                                                                    'INVOICE_CANCELLATION': 'bg-red-100 text-red-700',
                                                                    'INVOICE_DELETION': 'bg-red-100 text-red-700',
                                                                    'INVOICE_REFUND': 'bg-red-100 text-red-700',
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
                                                        <td className="py-3 px-3 text-right align-middle">
                                                            {(tx.amount > 0 || !(tx.freeImages || tx.freeVideos)) && (
                                                                <span className={`text-sm font-semibold whitespace-nowrap ${tx.isDeduction ? 'text-red-500' : 'text-green-600'}`}>
                                                                    {tx.unit === 'CREDITS'
                                                                        ? `+${Number(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })} credits`
                                                                        : <>{tx.isDeduction ? '-' : '+'}&#8377;{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</>}
                                                                </span>
                                                            )}
                                                            {tx.unit === 'CREDITS' && tx.rupeeAmount > 0 && (
                                                                <div className="text-xs text-slate-500 mt-0.5">&#8377;{tx.rupeeAmount.toLocaleString('en-IN')} paid</div>
                                                            )}
                                                            {(tx.freeImages > 0 || tx.freeVideos > 0) && (
                                                                <div className="text-xs text-slate-500 mt-0.5">
                                                                    {[tx.freeImages > 0 && `+${tx.freeImages} free image${tx.freeImages !== 1 ? 's' : ''}`, tx.freeVideos > 0 && `+${tx.freeVideos} free video${tx.freeVideos !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 align-middle">
                                                            <span className="text-xs text-slate-600 truncate block max-w-[110px]">{tx.note || '-'}</span>
                                                        </td>
                                                        <td className="py-3 px-3 align-middle">
                                                            <span className="text-xs text-slate-600 truncate block max-w-[90px]">{tx.adminName || tx.adminEmail || '-'}</span>
                                                        </td>
                                                        <td className="py-3 px-2 text-center align-middle" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={(e) => {
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    const menuH = 180;
                                                                    const spaceBelow = window.innerHeight - rect.bottom;
                                                                    const top = spaceBelow > menuH ? rect.bottom + 4 : Math.max(4, rect.top - menuH);
                                                                    setCreditMenuPosition({ top, right: window.innerWidth - rect.right });
                                                                    setOpenCreditMenuId(openCreditMenuId === tx._id ? null : tx._id);
                                                                }}
                                                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                            >
                                                                {deletingCreditId === tx._id
                                                                    ? <Loader2 size={16} className="animate-spin" />
                                                                    : <MoreVertical size={16} />
                                                                }
                                                            </button>
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
                                                    onClick={() => fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter)}
                                                    disabled={creditPagination.page === 1}
                                                    className="px-3 h-8 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    First
                                                </button>
                                                <button
                                                    onClick={() => fetchCreditHistory(creditPagination.page - 1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter)}
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
                                                            onClick={() => fetchCreditHistory(p, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter)}
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
                                                    onClick={() => fetchCreditHistory(creditPagination.page + 1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter)}
                                                    disabled={creditPagination.page === creditPagination.totalPages}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                                <button
                                                    onClick={() => fetchCreditHistory(creditPagination.totalPages, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter)}
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
                                                {(user?.role === 'SuperAdmin' || user?.role === 'SBM') ? (
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
                                                            } catch { /* buyer lookup best-effort */ }
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
                                                                <BuyerField label="Organization Name" prefix={`${selectedBuyer.tenantId} -`} value={selectedBuyer.orgName ?? ''} onChange={e => updateBuyerField('orgName', e.target.value)} />
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
                                            <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                                                Category <span className="text-[9px] font-bold text-white bg-green-500 px-1.5 py-0.5 rounded-full uppercase">New</span>
                                            </label>
                                            <select
                                                value={manualPaymentCategory}
                                                onChange={e => setManualPaymentCategory(e.target.value)}
                                                className="w-full px-3 py-2.5 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            >
                                                <option value="RECONCILIATION">Reconciliation</option>
                                                <option value="LISTING_STUDIO">Speedy Listing</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                                                {manualPaymentCategory === 'LISTING_STUDIO' ? 'Amount (₹) — ₹100 = 1 credit *' : 'Credit (Coins) *'}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={creditsToAdd}
                                                    onChange={e => setCreditsToAdd(e.target.value)}
                                                    placeholder={manualPaymentCategory === 'LISTING_STUDIO' ? 'e.g. 20000' : 'Enter credit amount'}
                                                    className="w-full px-3 py-2.5 pr-16 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-orange-600">
                                                    {manualPaymentCategory === 'LISTING_STUDIO' ? '₹' : 'Coins'}
                                                </span>
                                            </div>
                                            {manualPaymentCategory === 'LISTING_STUDIO' && (
                                                <p className="text-xs text-slate-400 mt-1">Must exactly match a Speedy Listing plan's price — the tenant gets that plan's full bundle (credits + free images/videos).</p>
                                            )}
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
                                                         if (/listing/i.test(item.description)) setManualPaymentCategory('LISTING_STUDIO');
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
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Category *</label>
                                                <select
                                                    value={manualPaymentCategory}
                                                    onChange={e => setManualPaymentCategory(e.target.value)}
                                                    disabled={!!editingInvoice && user?.role !== 'SuperAdmin'}
                                                    className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a2c5e] ${editingInvoice && user?.role !== 'SuperAdmin' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-800'}`}
                                                >
                                                    <option value="RECONCILIATION">Reconciliation</option>
                                                    <option value="LISTING_STUDIO">Speedy Listing</option>
                                                </select>
                                                {editingInvoice && user?.role !== 'SuperAdmin' && (
                                                    <p className="text-[11px] text-slate-400 mt-1">Only a SuperAdmin can change an invoice's category.</p>
                                                )}
                                                {categoryChanged && (
                                                    <p className="text-[11px] text-amber-600 mt-1">
                                                        On save, the credits are removed from {originalCategory === 'LISTING_STUDIO' ? 'Speedy Listing' : 'Reconciliation'} and the matching plan bundle is granted in {manualPaymentCategory === 'LISTING_STUDIO' ? 'Speedy Listing' : 'Reconciliation'}. The invoice amount (before GST) must exactly match a plan price there.
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Mode *</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Cash', 'Cheque', 'Credit', 'Online'].map(method => (
                                                        <button
                                                            key={method}
                                                            type="button"
                                                            onClick={() => { setPaymentMethod(method); setPaymentMethodError(false); setUtrNumberError(false); }}
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
                                                        onChange={e => { setUtrNumber(e.target.value); setUtrNumberError(false); }}
                                                        placeholder="e.g. UTR1234567890"
                                                        className={`w-full px-3 py-2 text-base rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#1a2c5e] ${
                                                            utrNumberError ? 'border-red-500 bg-red-50' : 'border-slate-200'
                                                        }`}
                                                    />
                                                    {utrNumberError && (
                                                        <p className="text-xs font-semibold text-red-500 mt-1.5">UTR number is required</p>
                                                    )}
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
                                                <p className="text-sm text-slate-500">Taxable: &#8377;{baseAmount.toFixed(2)}</p>
                                                {activeBuyer?.stateCode ? (
                                                    isInterState ? (
                                                        <p className="text-xs text-slate-500">IGST ({GST_RATE}%): &#8377;{igstAmount.toFixed(2)}</p>
                                                    ) : (
                                                        <p className="text-xs text-slate-500">CGST ({halfGstRate}%) + SGST ({halfGstRate}%): &#8377;{(cgstAmount + sgstAmount).toFixed(2)}</p>
                                                    )
                                                ) : (
                                                    <p className="text-sm text-slate-500">GST ({GST_RATE}%): &#8377;{(igstAmount || cgstAmount + sgstAmount).toFixed(2)}</p>
                                                )}
                                                <p className="text-2xl font-extrabold text-slate-800">
                                                    &#8377;{(parseFloat(totalAmount) + roundOffAmount).toFixed(2)}
                                                </p>
                                                {roundOffAmount !== 0 && (
                                                    <p className="text-sm text-green-600 font-medium mt-1">
                                                        Auto Round off: +₹{roundOffAmount.toFixed(2)}
                                                    </p>
                                                )}
                                                <p className="text-sm font-medium text-slate-500 mt-0.5">
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

            {/* Edit Credit Transaction Modal — its own independent AnimatePresence, not nested
                inside the Create Invoice drawer's one above. Nesting them meant both the drawer's
                motion.div and this AnimatePresence were unkeyed siblings under the same parent,
                which is exactly what triggered React's "two children with the same key" warning
                on every re-render (framer-motion's PresenceChild wrapping needs each direct
                AnimatePresence child to be uniquely identifiable). */}
            <AnimatePresence>
                {editingCredit && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setEditingCredit(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 12 }}
                            transition={{ duration: 0.18 }}
                            onClick={e => e.stopPropagation()}
                            className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transition-colors ${
                                activeTab === 'adminGift' ? 'bg-purple-50' : 'bg-orange-50'
                            }`}
                        >
                            <div className={`px-6 py-4 flex items-center justify-between transition-colors ${
                                activeTab === 'adminGift'
                                    ? 'bg-gradient-to-r from-purple-600 to-purple-700'
                                    : 'bg-gradient-to-r from-orange-500 to-orange-600'
                            }`}>
                                <h3 className="font-bold text-white text-lg">Edit {activeTab === 'adminGift' ? 'Admin Gift' : 'Free Trial Credit'}</h3>
                                <button
                                    onClick={() => setEditingCredit(null)}
                                    className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="px-6 py-6 space-y-4">
                                <div className="relative">
                                    <label className={`block text-sm font-semibold mb-2 ${
                                        activeTab === 'adminGift' ? 'text-purple-900' : 'text-orange-900'
                                    }`}>Tenant / Buyer</label>
                                    <div className="relative">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={editCreditSelectedTenant
                                                ? `${editCreditSelectedTenant.tenantId || ''} - ${editCreditSelectedTenant.orgName || editCreditSelectedTenant.name || ''}`
                                                : editCreditBuyerQuery}
                                            onChange={e => { setEditCreditSelectedTenant(null); handleEditCreditBuyerInput(e.target.value); }}
                                            onFocus={() => { setShowEditCreditBuyerDropdown(true); if (!editCreditBuyerQuery) fetchEditCreditBuyers(''); }}
                                            onBlur={() => setTimeout(() => setShowEditCreditBuyerDropdown(false), 200)}
                                            placeholder="Search buyer/tenant..."
                                            className={`w-full pl-9 pr-8 py-2 text-sm rounded-lg border focus:outline-none transition-all ${
                                                activeTab === 'adminGift'
                                                    ? 'border-purple-200 focus:ring-2 focus:ring-purple-500'
                                                    : 'border-orange-200 focus:ring-2 focus:ring-orange-500'
                                            }`}
                                        />
                                        {editCreditBuyerSearching && (
                                            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                                        )}
                                    </div>
                                    {showEditCreditBuyerDropdown && editCreditBuyers.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                                            {editCreditBuyers.map(b => (
                                                <button
                                                    key={b._id}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); selectEditCreditBuyer(b); }}
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0 transition-colors"
                                                >
                                                    <p className="font-semibold text-slate-800 truncate">{b.tenantId} - {b.orgName || b.name}</p>
                                                    {b.gstin && <p className="text-[11px] text-slate-400 font-mono">{b.gstin}</p>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${
                                        activeTab === 'adminGift' ? 'text-purple-900' : 'text-orange-900'
                                    }`}>
                                        {editingCredit?.category === 'LISTING_STUDIO'
                                            ? (editingCredit?.giftKind === 'freeImages' ? 'Free Images (count)' : editingCredit?.giftKind === 'freeVideos' ? 'Free Videos (count)' : 'Credits')
                                            : 'Amount (₹)'}
                                    </label>
                                    <input
                                        type="number"
                                        value={editCreditAmount}
                                        onChange={e => setEditCreditAmount(e.target.value)}
                                        className={`w-full bg-white border rounded-lg px-3 py-2 text-sm focus:outline-none transition-all ${
                                            activeTab === 'adminGift'
                                                ? 'border-purple-200 focus:ring-2 focus:ring-purple-500'
                                                : 'border-orange-200 focus:ring-2 focus:ring-orange-500'
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${
                                        activeTab === 'adminGift' ? 'text-purple-900' : 'text-orange-900'
                                    }`}>Date</label>
                                    <input
                                        type="date"
                                        value={editCreditDate}
                                        max={getLocalDateInputValue()}
                                        onChange={e => setEditCreditDate(e.target.value)}
                                        className={`w-full bg-white border rounded-lg px-3 py-2 text-sm focus:outline-none transition-all ${
                                            activeTab === 'adminGift'
                                                ? 'border-purple-200 focus:ring-2 focus:ring-purple-500'
                                                : 'border-orange-200 focus:ring-2 focus:ring-orange-500'
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${
                                        activeTab === 'adminGift' ? 'text-purple-900' : 'text-orange-900'
                                    }`}>Note</label>
                                    <textarea
                                        value={editCreditNote}
                                        onChange={e => setEditCreditNote(e.target.value)}
                                        rows="3"
                                        className={`w-full bg-white border rounded-lg px-3 py-2 text-sm focus:outline-none transition-all ${
                                            activeTab === 'adminGift'
                                                ? 'border-purple-200 focus:ring-2 focus:ring-purple-500'
                                                : 'border-orange-200 focus:ring-2 focus:ring-orange-500'
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className={`block text-sm font-semibold mb-2 ${
                                        activeTab === 'adminGift' ? 'text-purple-900' : 'text-orange-900'
                                    }`}>Move to</label>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="creditType"
                                                value="FREE_TRIAL_CREDIT"
                                                checked={editCreditType === 'FREE_TRIAL_CREDIT'}
                                                onChange={e => setEditCreditType(e.target.value)}
                                                className="w-4 h-4 accent-orange-500"
                                            />
                                            <span className="text-sm font-medium text-orange-700">Free Trial Credit</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="creditType"
                                                value="ADMIN_GIFT"
                                                checked={editCreditType === 'ADMIN_GIFT'}
                                                onChange={e => setEditCreditType(e.target.value)}
                                                className="w-4 h-4 accent-purple-500"
                                            />
                                            <span className="text-sm font-medium text-purple-700">Admin Gift</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className={`px-6 py-4 flex items-center justify-end gap-3 border-t ${
                                activeTab === 'adminGift'
                                    ? 'bg-purple-100 border-purple-200'
                                    : 'bg-orange-100 border-orange-200'
                            }`}>
                                <button
                                    onClick={() => setEditingCredit(null)}
                                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                                        activeTab === 'adminGift'
                                            ? 'text-purple-700 bg-white border border-purple-200 hover:bg-purple-50'
                                            : 'text-orange-700 bg-white border border-orange-200 hover:bg-orange-50'
                                    }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={updateCreditTransaction}
                                    disabled={updatingCredit}
                                    className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
                                        activeTab === 'adminGift'
                                            ? 'bg-purple-600 hover:bg-purple-700'
                                            : 'bg-orange-600 hover:bg-orange-700'
                                    }`}
                                >
                                    {updatingCredit ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <Pencil size={14} />
                                            Update
                                        </>
                                    )}
                                </button>
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
                isOpen={!!confirmRefund}
                onClose={() => setConfirmRefund(null)}
                onConfirm={confirmRefundInvoice}
                title={confirmRefund?.title || 'Confirm'}
                message={confirmRefund?.message || ''}
                confirmText="Yes, Mark Refunded"
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
            <ConfirmModal
                isOpen={!!confirmTransfer}
                onClose={() => setConfirmTransfer(null)}
                onConfirm={confirmTransferCategory}
                title={confirmTransfer?.title || 'Confirm'}
                message={confirmTransfer?.message || ''}
                confirmText="Yes, Transfer"
                danger
            />
            {openMenuId && menuPosition && !confirmCancel && !confirmRefund && !confirmDelete && !confirmTransfer && createPortal((() => {
                const menuInvoice = invoices.find(i => i._id === openMenuId);
                if (!menuInvoice) return null;
                // Refunded behaves like cancelled everywhere in this menu — no further edits,
                // verification, emails, or a second cancel/refund on an already-settled invoice.
                const isCancelled = menuInvoice.status === 'cancelled' || menuInvoice.status === 'refunded';
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
                                {user?.role === 'SuperAdmin' && (
                                    <>
                                        <div className="mx-3 my-1 border-t border-slate-100" />
                                        <button
                                            onClick={() => handleTransferCategory(menuInvoice)}
                                            disabled={transferringId === openMenuId}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                        >
                                            {transferringId === openMenuId
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Package size={14} className="text-purple-500" />
                                            }
                                            Transfer to {menuInvoice.paymentCategory === 'LISTING_STUDIO' ? 'Reconciliation' : 'Speedy Listing'}
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
                                        <button
                                            onClick={() => handleRefundInvoice(menuInvoice)}
                                            disabled={refundingId === openMenuId}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                                        >
                                            {refundingId === openMenuId
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <RotateCcw size={14} />
                                            }
                                            Mark Refunded
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

            {openCreditMenuId && creditMenuPosition && !confirmDeleteCredit && !confirmCancelCredit && createPortal((() => {
                const menuTx = creditHistory.find(t => t._id === openCreditMenuId);
                if (!menuTx) return null;
                // Once cancelled, its balance effect is already reversed — editing/verifying it
                // further would be meaningless, so those actions drop out of the menu (backend
                // enforces this too, this isn't just a UI hide). Delete stays available either
                // way, same as Invoice keeps Delete available on a cancelled invoice.
                return (
                    <div ref={creditMenuRef} style={{ position: 'fixed', top: creditMenuPosition.top, right: creditMenuPosition.right }} className="z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden">
                        {!menuTx.cancelled && (
                            <button
                                onClick={() => {
                                    setOpenCreditMenuId(null);
                                    setCreditMenuPosition(null);
                                    setEditingCredit(menuTx);
                                    setEditCreditAmount(menuTx.category === 'LISTING_STUDIO' ? menuTx.editableAmount : menuTx.amount);
                                    setEditCreditNote(menuTx.note || '');
                                    setEditCreditType(menuTx.type);
                                    setEditCreditDate(getLocalDateInputValue(menuTx.transactionDate || menuTx.createdAt));
                                    setEditCreditSelectedTenant(menuTx.tenantId ? {
                                        _id: menuTx.tenantId,
                                        tenantId: menuTx.tenantCode,
                                        orgName: menuTx.buyerName,
                                        name: menuTx.buyerName,
                                    } : null);
                                    setEditCreditBuyerQuery('');
                                    setEditCreditBuyers([]);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <Pencil size={14} className="text-amber-500" />
                                Edit
                            </button>
                        )}
                        {user?.role === 'SuperAdmin' && !menuTx.cancelled && (
                            <>
                                <div className="mx-3 my-1 border-t border-slate-100" />
                                <button
                                    onClick={async () => {
                                        setOpenCreditMenuId(null);
                                        setCreditMenuPosition(null);
                                        try {
                                            const base = menuTx.category === 'LISTING_STUDIO'
                                                ? `/admin/invoices/ls-credit-transactions/${menuTx._id}`
                                                : `/superadmin/credits/${menuTx._id}`;
                                            const endpoint = menuTx.verified ? `${base}/unverify` : `${base}/verify`;
                                            await api.post(endpoint);
                                            toast.success(menuTx.verified ? 'Credit unverified' : 'Credit verified');
                                            await fetchCreditHistory(creditPagination.page, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter);
                                        } catch (err) {
                                            toast.error(err.response?.data?.message || 'Action failed');
                                        }
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${menuTx.verified ? 'text-slate-700 hover:bg-slate-50' : 'text-green-600 hover:bg-green-50'}`}
                                >
                                    <CheckCircle size={14} className={menuTx.verified ? 'text-slate-400' : 'text-green-600'} />
                                    {menuTx.verified ? 'Mark Unverified' : 'Mark Verified'}
                                </button>
                                <div className="mx-3 my-1 border-t border-slate-100" />
                                <button
                                    onClick={() => handleCancelCreditTransaction(menuTx)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
                                >
                                    <X size={14} />
                                    Cancel
                                </button>
                            </>
                        )}
                        {user?.role === 'SuperAdmin' && (
                            <>
                                <div className="mx-3 my-1 border-t border-slate-100" />
                                <button
                                    onClick={() => handleDeleteCreditTransaction(menuTx)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 size={14} />
                                    Delete
                                </button>
                            </>
                        )}
                    </div>
                );
            })(), document.body)}

            <ConfirmModal
                isOpen={!!confirmDeleteCredit}
                onClose={() => setConfirmDeleteCredit(null)}
                onConfirm={confirmDeleteCreditTransaction}
                title={confirmDeleteCredit?.title || 'Confirm'}
                message={confirmDeleteCredit?.message || ''}
                confirmText="Yes, Delete"
                danger
            />

            <ConfirmModal
                isOpen={!!confirmCancelCredit}
                onClose={() => setConfirmCancelCredit(null)}
                onConfirm={confirmCancelCreditTransaction}
                title={confirmCancelCredit?.title || 'Confirm'}
                message={confirmCancelCredit?.message || ''}
                confirmText="Yes, Cancel"
                danger
            />

            <AdminGiftModal
                isOpen={isGiftModalOpen}
                onClose={() => setIsGiftModalOpen(false)}
                onSuccess={() => fetchCreditHistory(1, debouncedCreditSearch, creditTypeFilter, creditStartDate, creditEndDate, creditAmountMin, creditAmountMax, creditStatusFilter, creditVerifiedFilter)}
            />
        </DashboardLayout>
    );
};

const BuyerField = ({ label, value, onChange, disabled, prefix }) => (
    <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
        <div className="flex">
            {prefix && (
                <span className="inline-flex items-center px-3 text-base text-slate-500 bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg shrink-0">{prefix}</span>
            )}
            <input
                type="text"
                value={value}
                onChange={onChange}
                disabled={disabled}
                className={`w-full min-w-0 px-3 py-2 text-base border transition-colors ${prefix ? 'rounded-r-lg' : 'rounded-lg'} ${disabled ? 'bg-slate-50 text-slate-700 border-slate-200 cursor-not-allowed' : 'border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400'}`}
            />
        </div>
    </div>
);

export default AdminInvoiceList;
