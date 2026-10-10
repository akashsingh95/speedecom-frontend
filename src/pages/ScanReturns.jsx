import React, { useState, useEffect, useRef, useCallback } from 'react';
import successSoundFile from '../assets/sounds/success.mp3';
import errorSoundFile from '../assets/sounds/error.mp3';
import ConfirmModal from '../components/ConfirmModal';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
    Scan, Camera, CameraOff, CheckCircle, Trash2, X,
    ShoppingBag, Settings, AlertOctagon, CalendarDays, Users, ChevronDown, Check, Store, Loader2,
    FileSpreadsheet, FileText, Upload, Download, RefreshCw, List, ChevronLeft, ChevronRight, BarChart2, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';

const MARKETPLACE = 'meesho';

const TodayPagination = ({ page, totalPages, total, onPageChange }) => {
    const [goTo, setGoTo] = useState('');
    const onPageChangeRef = useRef(onPageChange);
    useEffect(() => { onPageChangeRef.current = onPageChange; });

    // Reset the "Go to" input when the page changes externally (e.g. First/Prev/Next/Last).
    // Adjusted during render rather than in an effect to avoid an extra cascading render.
    const [lastPage, setLastPage] = useState(page);
    if (page !== lastPage) {
        setLastPage(page);
        if (goTo) setGoTo('');
    }

    // Auto-navigate 600ms after the user stops typing
    // onPageChange intentionally omitted from deps — using ref to avoid infinite loop
    // (inline arrow prop recreates on every parent render, which would retrigger this effect)
    useEffect(() => {
        if (!goTo) return;
        const p = parseInt(goTo, 10);
        if (p < 1 || p > totalPages) return;
        const timer = setTimeout(() => { onPageChangeRef.current(p); }, 600);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goTo, totalPages]);

    if (totalPages <= 1) return null;

    const maxVisible = 10;
    const startPage  = Math.floor((page - 1) / maxVisible) * maxVisible + 1;
    const endPage    = Math.min(startPage + maxVisible - 1, totalPages);
    const pages      = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

    const btnBase   = 'h-8 min-w-[2rem] px-2.5 rounded-lg text-xs font-medium transition-all border disabled:opacity-40 disabled:cursor-not-allowed';
    const btnInact  = `${btnBase} bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900`;
    const btnActive = `${btnBase} bg-brand-600 text-white border-brand-600 shadow-sm`;

    return (
        <div className="flex flex-col items-center gap-2.5 pt-3">
            <div className="flex items-center gap-1 flex-wrap justify-center">
                <button disabled={page === 1} onClick={() => onPageChange(1)} className={btnInact}>First</button>
                <button disabled={startPage === 1} onClick={() => onPageChange(startPage - 1)} className={btnInact}>
                    <ChevronLeft size={13} />
                </button>
                {pages.map(p => (
                    <button key={p} onClick={() => onPageChange(p)} className={p === page ? btnActive : btnInact}>{p}</button>
                ))}
                <button disabled={endPage >= totalPages} onClick={() => onPageChange(endPage + 1)} className={btnInact}>
                    <ChevronRight size={13} />
                </button>
                <button disabled={page === totalPages} onClick={() => onPageChange(totalPages)} className={btnInact}>Last</button>
                <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-xs text-slate-400">Go to</span>
                    <div className="relative">
                        <input
                            type="text" inputMode="numeric"
                            value={goTo}
                            onChange={e => setGoTo(e.target.value.replace(/\D/g, ''))}
                            placeholder="#"
                            className="w-14 h-8 px-2 text-xs text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        {goTo && (parseInt(goTo, 10) < 1 || parseInt(goTo, 10) > totalPages) && (
                            <p className="absolute top-full left-0 right-0 text-center text-[10px] text-red-500 mt-0.5 whitespace-nowrap">Enter valid page</p>
                        )}
                    </div>
                </div>
            </div>
            <p className="text-xs text-slate-400">
                Page <span className="font-semibold text-slate-600">{page}</span> of{' '}
                <span className="font-semibold text-slate-600">{totalPages}</span>
                {' '}| Total: <span className="font-semibold text-slate-600">{total.toLocaleString()}</span>
            </p>
        </div>
    );
};

const SCAN_CONDITIONS = [
    { value: 'ok',      label: 'Normal',  description: 'Item is in good condition', dot: 'bg-emerald-400', trigger: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { value: 'damaged', label: 'Damaged', description: 'Item has physical damage',  dot: 'bg-red-400',     trigger: 'bg-red-50 border-red-200 text-red-700', icon: AlertOctagon },
    // { value: 'wrong', label: 'Wrong Return', description: 'Item has replaced',  dot: 'bg-yellow-400',     trigger: 'bg-red-50 border-red-200 text-red-700', icon: AlertOctagon },
];

const ScanReturns = () => {
    const successAudioRef = useRef(null);
    const errorAudioRef   = useRef(null);
    const inputRef        = useRef(null);
    const html5QrCodeRef  = useRef(null);
    const lastScannedCodeRef = useRef('');
    const lastScannedTimeRef = useRef(0);

    const [meeshoAccounts, setMeeshoAccounts] = useState([]);
    const [scannedItems,   setScannedItems]   = useState([]);
    const [qrInput,        setQrInput]        = useState('');

    const [scanning,       setScanning]       = useState(false);
    const [feedbackState,  setFeedbackState]  = useState(null);   // 'success' | 'error' | null
    const [feedbackMessage,setFeedbackMessage]= useState('');

    const [cameraActive,   setCameraActive]   = useState(false);
    const [cameraError,    setCameraError]    = useState('');
    const scannerDivId = 'qr-reader';

    const [settingsOpen,   setSettingsOpen]   = useState(false);
    const [scanCondition,  setScanCondition]  = useState('ok');
    const [conditionOpen,  setConditionOpen]  = useState(false);
    const conditionRef = useRef(null);

    const [approveDate,       setApproveDate]       = useState('');
    const [approveDateField,  setApproveDateField]  = useState('return_created_date');
    const [approveFileTypes,  setApproveFileTypes]  = useState(['intransit', 'ofd', 'completed']);
    const [approveAccountIds, setApproveAccountIds] = useState([]);
    const [approveLoading,    setApproveLoading]    = useState(false);

    const [confirmModal, setConfirmModal] = useState(null);
    const showConfirm  = (opts) => setConfirmModal(opts);
    const closeConfirm = ()     => setConfirmModal(null);

    // Bulk upload via Excel
    const [bulkFile,       setBulkFile]       = useState(null);
    const [bulkUploading,  setBulkUploading]  = useState(false);
    const bulkFileInputRef = useRef(null);

    // Unverified scans
    const [unverifiedItems,      setUnverifiedItems]      = useState([]);
    const [unverifiedPage,       setUnverifiedPage]       = useState(1);
    const [unverifiedTotalPages, setUnverifiedTotalPages] = useState(1);
    const [unverifiedTotal,      setUnverifiedTotal]      = useState(0);
    const [unverifiedSearch,     setUnverifiedSearch]     = useState('');
    const [unverifiedLoading,    setUnverifiedLoading]    = useState(false);

    // Today's Scan tab
    const [activeTab,           setActiveTab]           = useState('scan');
    const [todayItems,          setTodayItems]          = useState([]);
    const [todaySummary,        setTodaySummary]        = useState({ total: 0, ok: 0, damaged: 0 });
    const [todayCouriers,       setTodayCouriers]       = useState([]);
    const [todayCourierFilter,  setTodayCourierFilter]  = useState('all');
    const [todayTypeFilter,     setTodayTypeFilter]     = useState('all');
    const [todayAccountFilter,  setTodayAccountFilter]  = useState('all');
    const [todayLoading,        setTodayLoading]        = useState(false);
    const [todayPage,           setTodayPage]           = useState(1);
    const [todayTotalPages,     setTodayTotalPages]     = useState(1);
    const [todayTotalItems,     setTodayTotalItems]     = useState(0);
    // Summary view
    const [todayView,           setTodayView]           = useState('summary');
    const [todaySelectedAccount,setTodaySelectedAccount]= useState(null);
    const [accountSummary,      setAccountSummary]      = useState([]);
    const [allCouriers,         setAllCouriers]         = useState([]);
    const [summaryLoading,      setSummaryLoading]      = useState(false);
    const [exportLoading,          setExportLoading]          = useState(false);
    const [unverifiedExportLoading,setUnverifiedExportLoading]= useState(false);

    // Account picker when same AWB found in multiple Meesho accounts
    const [accountPicker, setAccountPicker] = useState(null); // { matches: [], pendingCondition: '' }

    // ── Load Meesho accounts ────────────────────────────────────────────────
    useEffect(() => {
        api.get('/marketplaces/filter-options')
            .then(({ data }) => {
                const meeshoGroup = (data || []).find(g => g.key?.toLowerCase() === 'meesho');
                if (meeshoGroup?.accounts) setMeeshoAccounts(meeshoGroup.accounts);
            })
            .catch(err => console.error('Failed to load marketplace options', err));
    }, []);

    // ── Audio + focus ───────────────────────────────────────────────────────
    useEffect(() => {
        successAudioRef.current = new Audio(successSoundFile);
        errorAudioRef.current   = new Audio(errorSoundFile);
        if (inputRef.current) inputRef.current.focus();
        return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleGlobalClick = () => {
            if (!cameraActive && inputRef.current &&
                document.activeElement.tagName !== 'BUTTON' &&
                document.activeElement.tagName !== 'SELECT' &&
                document.activeElement.tagName !== 'INPUT') {
                inputRef.current.focus();
            }
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [cameraActive]);

    useEffect(() => {
        const handler = (e) => {
            if (conditionRef.current && !conditionRef.current.contains(e.target))
                setConditionOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Helpers ─────────────────────────────────────────────────────────────
    const playSound = (type) => {
        try {
            const ref = type === 'success' ? successAudioRef : errorAudioRef;
            if (ref.current) { ref.current.currentTime = 0; ref.current.play().catch(() => {}); }
        } catch {}
    };

    const triggerFeedback = (type, message) => {
        setFeedbackState(type);
        setFeedbackMessage(message);
        playSound(type);
        if (type === 'success') toast.success(message); else toast.error(message);
        setTimeout(() => { setFeedbackState(null); setFeedbackMessage(''); }, 1500);
    };

    // Unique scan key: marketplace_id + suborder_number (AWB alone is NOT unique)
    const isAlreadyScanned = (item) =>
        scannedItems.some(s =>
            String(s.marketplace_id) === String(item.marketplace_id) &&
            s.suborder_number === item.suborder_number
        );

    // ── Scan logic ──────────────────────────────────────────────────────────
    const handleScanCode = async (code) => {
        if (!code.trim() || scanning) return;
        const rawCode = code.trim();
        const now = Date.now();
        if (rawCode === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 3000) return;
        lastScannedCodeRef.current = rawCode;
        lastScannedTimeRef.current = now;

        setScanning(true);
        setQrInput('');
        try {
            const res = await api.get('/returns/validate', { params: { code: rawCode, marketplace: MARKETPLACE }, skipUnwrap: true });
            const responseData = res.data;
            if (responseData.multipleFound) {
                // Filter out combos already scanned in this session
                const remaining = responseData.matches.filter(m => !isAlreadyScanned(m));

                if (remaining.length === 0) {
                    triggerFeedback('error', 'All combinations for this AWB are already scanned!');
                    setScanning(false);
                    return;
                }
                if (remaining.length === 1) {
                    // Only one unscanned combo left — save it automatically
                    saveScannedItem(remaining[0], scanCondition);
                    setScanning(false);
                    return;
                }
                // Multiple unscanned combos — ask user
                setAccountPicker({ matches: remaining, pendingCondition: scanCondition });
                setScanning(false);
                return;
            }

            const newItem = responseData.data;
            if (!newItem) {
                triggerFeedback('error', 'Scan returned incomplete data. Please try again.');
                setScanning(false);
                return;
            }
            if (isAlreadyScanned(newItem)) {
                triggerFeedback('error', 'This item is already scanned in the current session!');
                setScanning(false);
                return;
            }
            saveScannedItem(newItem, scanCondition);
        } catch (err) {
            if (err.response?.status === 404) {
                // Only save to unverified if the code looks like a real AWB or suborder number.
                // Purely alphanumeric 8+ chars covers AWBs (e.g. SF3360093307FPL).
                // Digits with optional _N suffix covers suborder IDs (e.g. 295857052400513856_1).
                const looksLikeScanCode =
                    /^[A-Za-z0-9]{8,}$/.test(rawCode) ||   // AWB (e.g. SF3360093307FPL)
                    /^\d{10,}_\d+$/.test(rawCode) ||         // Suborder with suffix (e.g. 295857052400513856_1)
                    /^https?:\/\/.+/.test(rawCode);          // Tracking link URL

                if (looksLikeScanCode) {
                    try {
                        await api.post('/returns/scan/unverified', { scanCode: rawCode, condition: scanCondition });
                        setUnverifiedTotal(prev => prev + 1);
                        triggerFeedback('error', 'Not in system — saved as Unverified');
                    } catch {
                        triggerFeedback('error', 'Return not found. Please upload the latest return file.');
                    }
                } else {
                    triggerFeedback('error', 'Return not found. Please upload the latest return file.');
                }
            } else {
                triggerFeedback('error', err.response?.data?.message || 'Scan failed or item not found');
            }
        } finally {
            setScanning(false);
            if (inputRef.current) inputRef.current.focus();
        }
    };

    const saveScannedItem = (newItem, condition) => {
        setScannedItems(prev => [{ ...newItem, scanned_condition: condition }, ...prev]);
        api.post('/returns/scan/single', { marketplace: MARKETPLACE, item: newItem, condition })
            .then(() => {
                const label = condition === 'damaged' ? '⚠ Saved as DAMAGED' : 'Saved';
                triggerFeedback('success', `${label}: ${newItem.product_title || newItem.suborder_number}`);
                if (inputRef.current) inputRef.current.focus();
            })
            .catch(saveErr => {
                triggerFeedback('error', `Scanned but save failed: ${saveErr.response?.data?.message || saveErr.message}`);
                if (inputRef.current) inputRef.current.focus();
            });
    };

    const handleAccountPickerSelect = (chosenItem) => {
        const condition = accountPicker.pendingCondition;
        setAccountPicker(null);
        saveScannedItem(chosenItem, condition);
    };

    const handleKeyPress  = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanCode(qrInput); } };
    const handleRemoveItem = (compositeKey) => setScannedItems(prev => prev.filter(item => `${item.marketplace_id}:${item.suborder_number}` !== compositeKey));

    const handleClearList = () => {
        if (!scannedItems.length) return;
        showConfirm({
            title: 'Clear List',
            message: `Clear all ${scannedItems.length} scanned items? Items already saved to DB will not be affected.`,
            confirmText: 'Clear', danger: true,
            onConfirm: () => setScannedItems([]),
        });
    };

    const APPROVE_DATE_FIELD_LABELS = {
        return_created_date: 'Return Created Date',
        delivered_date: 'Return Delivered Date',
    };

    const FILE_TYPE_LABELS = { intransit: 'Intransit', ofd: 'OFD', completed: 'Completed' };

    const handleDateFieldChange = (field) => {
        setApproveDateField(field);
        if (field === 'delivered_date') {
            setApproveFileTypes(['completed']);
        } else {
            setApproveFileTypes(['intransit', 'ofd', 'completed']);
        }
    };

    const toggleApproveFileType = (ft) =>
        setApproveFileTypes(prev => prev.includes(ft) ? prev.filter(x => x !== ft) : [...prev, ft]);

    const handleBulkApproveByDate = async () => {
        if (!approveDate) { toast.error('Please select a date'); return; }
        if (approveFileTypes.length === 0) { toast.error('Please select at least one file type'); return; }
        setApproveLoading(true);
        try {
            const countParams = { date: approveDate, dateField: approveDateField };
            if (approveAccountIds.length > 0) countParams.marketplaceIds = JSON.stringify(approveAccountIds);
            if (approveFileTypes.length < 3) countParams.fileTypes = JSON.stringify(approveFileTypes);
            const { data: countData } = await api.get('/returns/scan/bulk-approve-by-date/count', { params: countParams });
            const count = countData.count ?? 0;
            setApproveLoading(false);
            const accountLabel = approveAccountIds.length === 0 ? 'ALL Meesho accounts' : `${approveAccountIds.length} account(s)`;
            const fileTypesLabel = approveFileTypes.length === 3 ? 'All Types' : approveFileTypes.map(ft => FILE_TYPE_LABELS[ft]).join(', ');
            showConfirm({
                title: 'Bulk Arrive Returns',
                message: `${count} return${count !== 1 ? 's' : ''} will be marked as arrived.`,
                details: [
                    { label: 'Date Type', value: APPROVE_DATE_FIELD_LABELS[approveDateField] },
                    { label: 'File Types', value: fileTypesLabel },
                    { label: 'Date', value: `on or before ${approveDate}` },
                    { label: 'Accounts', value: accountLabel },
                ],
                confirmText: 'Proceed',
                onConfirm: async () => {
                    setApproveLoading(true);
                    try {
                        const payload = { date: approveDate, dateField: approveDateField };
                        if (approveAccountIds.length > 0) payload.marketplaceIds = approveAccountIds;
                        if (approveFileTypes.length < 3) payload.fileTypes = approveFileTypes;
                        const { data } = await api.post('/returns/scan/bulk-approve-by-date', payload);
                        toast.success(`${data.affectedCount ?? count} returns marked as arrived`);
                        setApproveDate('');
                    } catch (err) {
                        toast.error(err.response?.data?.message || 'Bulk approve failed');
                    } finally {
                        setApproveLoading(false);
                    }
                },
            });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk approve failed');
            setApproveLoading(false);
        }
    };

    const toggleApproveAccount = (id) =>
        setApproveAccountIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const closeSettings = () => {
        setSettingsOpen(false);
        setBulkFile(null);
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    };

    // ── Bulk upload via CSV ──────────────────────────────────────────────────
    const handleDownloadTemplate = async () => {
        try {
            const res = await api.get('/returns/scan/bulk-upload/template', { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bulk_return_template.csv';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to download template');
        }
    };

    const handleBulkUpload = async () => {
        if (!bulkFile) { toast.error('Please select a file first'); return; }
        setBulkUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            const { data } = await api.post('/returns/scan/bulk-upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setBulkFile(null);
            if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
            const s = data.summary;
            toast.success(`${s.succeeded} arrived · ${s.alreadyArrived} already arrived · ${s.notFound} unverified`);
            fetchUnverified(1, unverifiedSearchRef.current);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Bulk upload failed');
        } finally {
            setBulkUploading(false);
        }
    };

    // ── Today's Scan ─────────────────────────────────────────────────────────
    const fetchAccountSummary = useCallback(async (typeFilter = 'all') => {
        setSummaryLoading(true);
        try {
            const params = {};
            if (typeFilter && typeFilter !== 'all') params.returnType = typeFilter;
            const { data } = await api.get('/returns/scan/today/account-summary', { params });
            const rows = data || [];

            // Collect all distinct couriers (preserving order by total count)
            const courierCountMap = {};
            rows.forEach(r => {
                courierCountMap[r.courier_partner] = (courierCountMap[r.courier_partner] || 0) + r.count;
            });
            const couriers = Object.entries(courierCountMap)
                .sort((a, b) => b[1] - a[1])
                .map(([name]) => name);
            setAllCouriers(couriers);

            // Pivot flat rows into per-account objects
            const accountMap = {};
            rows.forEach(r => {
                if (!accountMap[r.marketplace_id]) {
                    accountMap[r.marketplace_id] = {
                        account_id: r.marketplace_id,
                        total: 0, ok: 0, damaged: 0,
                        couriers: {},
                    };
                }
                const a = accountMap[r.marketplace_id];
                a.total   += r.count;
                a.ok      += r.ok;
                a.damaged += r.damaged;
                a.couriers[r.courier_partner] = r.count;
            });
            setAccountSummary(Object.values(accountMap));
        } catch {
            toast.error("Failed to load summary");
        } finally {
            setSummaryLoading(false);
        }
    }, []);

    const downloadCSV = (rows, filename) => {
        const escape = val => {
            const s = String(val ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const content = rows.map(r => r.map(escape).join(',')).join('\n');
        const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportSummary = () => {
        if (!accountSummary.length) return;
        const headers = ['Account Name', 'Total', ...allCouriers, 'OK', 'Damaged'];
        const rows = accountSummary.map(acc => {
            const name = meeshoAccounts.find(a => a._id === acc.account_id)?.name || acc.account_id;
            return [name, acc.total, ...allCouriers.map(c => acc.couriers[c] ?? 0), acc.ok, acc.damaged];
        });
        if (accountSummary.length > 1) {
            const gt = accountSummary.reduce((s, a) => ({ total: s.total + a.total, ok: s.ok + a.ok, damaged: s.damaged + a.damaged }), { total: 0, ok: 0, damaged: 0 });
            rows.push(['Grand Total', gt.total, ...allCouriers.map(c => accountSummary.reduce((s, a) => s + (a.couriers[c] ?? 0), 0)), gt.ok, gt.damaged]);
        }
        const date = new Date().toISOString().split('T')[0];
        downloadCSV([headers, ...rows], `today_scan_summary_${date}.csv`);
    };

    const handleExportDetail = async () => {
        setExportLoading(true);
        try {
            const params = {};
            if (todayCourierFilter !== 'all') params.courier = todayCourierFilter;
            if (todayTypeFilter    !== 'all') params.returnType = todayTypeFilter;
            if (todayAccountFilter !== 'all') params.marketplaceId = todayAccountFilter;
            const { data } = await api.get('/returns/scan/today/export', { params });
            const items = data || [];
            const headers = ['Suborder No', 'SKU', 'Product Name', 'AWB', 'Courier', 'Type', 'Condition', 'Scanned At'];
            const rows = items.map(item => [
                item.suborder_number || '',
                item.sku || '',
                item.product_name || '',
                item.awb_number || '',
                item.courier_partner || '',
                item.type_of_return ? (/rto/i.test(item.type_of_return) ? 'RTO' : 'Customer') : '',
                item.condition || '',
                item.updated_at ? new Date(item.updated_at).toLocaleString('en-IN') : '',
            ]);
            const date = new Date().toISOString().split('T')[0];
            const acctName = todaySelectedAccount?.name?.replace(/[^a-z0-9]/gi, '_') || 'account';
            downloadCSV([headers, ...rows], `today_scan_${acctName}_${date}.csv`);
        } catch {
            toast.error('Export failed — please try again');
        } finally {
            setExportLoading(false);
        }
    };

    const handleExportUnverified = async () => {
        setUnverifiedExportLoading(true);
        try {
            const params = {};
            if (unverifiedSearchRef.current) params.search = unverifiedSearchRef.current;
            const { data } = await api.get('/returns/scan/unverified/export', { params });
            const items = data || [];
            const headers = ['AWB / Order ID', 'Condition', 'Scanned At'];
            const rows = items.map(item => [
                item.scan_code || '',
                item.condition || '',
                item.scanned_at ? new Date(item.scanned_at).toLocaleString('en-IN') : '',
            ]);
            const date = new Date().toISOString().split('T')[0];
            downloadCSV([headers, ...rows], `unverified_scans_${date}.csv`);
        } catch {
            toast.error('Export failed — please try again');
        } finally {
            setUnverifiedExportLoading(false);
        }
    };

    const fetchTodayScan = useCallback(async (page = 1, courier = 'all', typeFilter = 'all', accountFilter = 'all') => {
        setTodayLoading(true);
        try {
            const params = { page };
            if (courier && courier !== 'all') params.courier = courier;
            if (typeFilter && typeFilter !== 'all') params.returnType = typeFilter;
            if (accountFilter && accountFilter !== 'all') params.marketplaceId = accountFilter;
            const { data } = await api.get('/returns/scan/today', { params });
            setTodayItems(data.items || []);
            setTodaySummary(data.summary || { total: 0, ok: 0, damaged: 0 });
            setTodayCouriers(data.couriers || []);
            setTodayPage(data.pagination?.page ?? 1);
            setTodayTotalPages(data.pagination?.totalPages ?? 1);
            setTodayTotalItems(data.pagination?.total ?? 0);
        } catch {
            toast.error("Failed to load today's scans");
        } finally {
            setTodayLoading(false);
        }
    }, []);

    const fetchUnverified = useCallback(async (page = 1, search = '') => {
        setUnverifiedLoading(true);
        try {
            const params = { page };
            if (search) params.search = search;
            const { data } = await api.get('/returns/scan/unverified', { params });
            setUnverifiedItems(data.items || []);
            setUnverifiedPage(data.pagination?.page ?? 1);
            setUnverifiedTotalPages(data.pagination?.totalPages ?? 1);
            setUnverifiedTotal(data.pagination?.total ?? 0);
        } catch {
            // silently ignore — non-critical
        } finally {
            setUnverifiedLoading(false);
        }
    }, []);

    const [rematchLoading, setRematchLoading] = useState(false);
    const handleRematchUnverified = useCallback(async () => {
        setRematchLoading(true);
        try {
            const res = await api.post('/returns/scan/unverified/rematch', {}, { skipUnwrap: true });
            await fetchUnverified(1, unverifiedSearchRef.current);
            // A match already in flight makes this a no-op — say so instead of claiming
            // success, otherwise the list looks unchanged for no visible reason.
            const { ran, matched, reason } = res.data ?? {};
            if (ran === false && reason === 'in_progress') {
                toast.info('A match is already running — try again in a moment');
            } else if (matched === 0) {
                toast.success('Re-matched — no unverified scans matched the uploaded files yet');
            } else {
                toast.success(`Re-matched — ${matched} scan${matched === 1 ? '' : 's'} cleared`);
            }
        } catch {
            toast.error('Re-match failed — please try again');
        } finally {
            setRematchLoading(false);
        }
    }, [fetchUnverified]);

    useEffect(() => { fetchUnverified(1); }, [fetchUnverified]);

    // Refs to avoid stale closures in event listeners / effects
    const activeTabRef          = useRef(activeTab);
    const todayCourierFilterRef = useRef(todayCourierFilter);
    const todayTypeFilterRef    = useRef(todayTypeFilter);
    const todayAccountFilterRef  = useRef(todayAccountFilter);
    const unverifiedSearchRef    = useRef(unverifiedSearch);
    const searchTimerRef         = useRef(null);
    useEffect(() => { activeTabRef.current = activeTab; },                     [activeTab]);
    useEffect(() => { todayCourierFilterRef.current = todayCourierFilter; },   [todayCourierFilter]);
    useEffect(() => { todayTypeFilterRef.current    = todayTypeFilter; },      [todayTypeFilter]);
    useEffect(() => { todayAccountFilterRef.current = todayAccountFilter; },   [todayAccountFilter]);
    useEffect(() => { unverifiedSearchRef.current   = unverifiedSearch; },     [unverifiedSearch]);

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            fetchUnverified(1, unverifiedSearchRef.current);
            if (activeTabRef.current === 'scan' && inputRef.current) inputRef.current.focus();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchUnverified]);

    useEffect(() => {
        if (activeTab === 'today') {
            setTodayView('summary');
            setTodaySelectedAccount(null);
            setTodayCourierFilter('all');
            fetchAccountSummary(todayTypeFilterRef.current);
        }
        if (activeTab === 'unverified') fetchUnverified(1, unverifiedSearchRef.current);
        if (activeTab === 'scan') requestAnimationFrame(() => { if (inputRef.current) inputRef.current.focus(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, fetchAccountSummary, fetchTodayScan, fetchUnverified]);

    // ── Camera ───────────────────────────────────────────────────────────────
    const handleScanCodeRef = useRef(handleScanCode);
    useEffect(() => { handleScanCodeRef.current = handleScanCode; });

    const startCamera = () => { setCameraError(''); setCameraActive(true); };

    useEffect(() => {
        if (!cameraActive) return;
        let cancelled = false;
        const initCamera = async () => {
            await new Promise(r => requestAnimationFrame(r));
            if (cancelled) return;
            try {
                if (!html5QrCodeRef.current) html5QrCodeRef.current = new Html5Qrcode(scannerDivId);
                await html5QrCodeRef.current.start(
                    { facingMode: 'environment' },
                    {
                        fps: 15,
                        qrbox: (w, h) => ({ width: Math.floor(w * 0.9), height: Math.floor(h * 0.4) }),
                        aspectRatio: 1.777778,
                        disableFlip: false,
                        formatsToSupport: [
                            Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128,
                            Html5QrcodeSupportedFormats.CODE_39,  Html5QrcodeSupportedFormats.EAN_13,
                            Html5QrcodeSupportedFormats.EAN_8,    Html5QrcodeSupportedFormats.ITF,
                            Html5QrcodeSupportedFormats.UPC_A,    Html5QrcodeSupportedFormats.UPC_E,
                            Html5QrcodeSupportedFormats.DATA_MATRIX,
                        ],
                    },
                    (text) => { handleScanCodeRef.current(text); },
                    () => {}
                );
            } catch (err) {
                if (cancelled) return;
                let msg = 'Could not access camera.';
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    msg = 'Camera permission denied. Please allow camera access in your browser settings and try again.';
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    msg = 'No camera found on this device.';
                } else if (
                    err.name === 'NotSupportedError' ||
                    (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost')
                ) {
                    msg = 'Camera requires a secure HTTPS connection. Please access this app over HTTPS.';
                } else if (err.message) {
                    msg = err.message;
                }
                setCameraError(msg);
                setCameraActive(false);
                if (html5QrCodeRef.current) { try { html5QrCodeRef.current.clear(); } catch {} html5QrCodeRef.current = null; }
            }
        };
        initCamera();
        return () => { cancelled = true; };
    }, [cameraActive]);

    const stopCamera = async () => {
        try {
            if (html5QrCodeRef.current) {
                await html5QrCodeRef.current.stop().catch(() => {});
                try { html5QrCodeRef.current.clear(); } catch {}
                html5QrCodeRef.current = null;
            }
        } finally { setCameraActive(false); }
    };

    // ── Derived ──────────────────────────────────────────────────────────────
    const isDamagedMode    = scanCondition === 'damaged';

    const handleRemoveUnverified = (item, idx) => {
        showConfirm({
            title: 'Remove Unverified Scan',
            message: `"${item.scan_code}" will be permanently removed.`,
            confirmText: 'Remove', danger: true,
            onConfirm: async () => {
                if (!item.id) {
                    setUnverifiedItems(prev => prev.filter((_, i) => i !== idx));
                    setUnverifiedTotal(prev => Math.max(0, prev - 1));
                    return;
                }
                try {
                    await api.delete(`/returns/scan/unverified/${item.id}`);
                    // If last item on this page, go back one page
                    const goToPage = unverifiedItems.length === 1 && unverifiedPage > 1
                        ? unverifiedPage - 1
                        : unverifiedPage;
                    fetchUnverified(goToPage, unverifiedSearchRef.current);
                } catch {
                    toast.error('Failed to remove');
                }
            },
        });
    };
    const handleDeleteAllUnverified = () => {
        if (unverifiedTotal === 0) return;
        showConfirm({
            title: 'Delete All Unverified Scans',
            message: `All ${unverifiedTotal.toLocaleString()} unverified scan${unverifiedTotal !== 1 ? 's' : ''} will be permanently deleted.`,
            confirmText: 'Delete All', danger: true,
            onConfirm: async () => {
                try {
                    await api.delete('/returns/scan/unverified/bulk', { data: { deleteAll: true } });
                    toast.success(`${unverifiedTotal.toLocaleString()} scans deleted`);
                    fetchUnverified(1, unverifiedSearchRef.current);
                } catch {
                    toast.error('Delete all failed');
                }
            },
        });
    };

    const activeCondition  = SCAN_CONDITIONS.find(c => c.value === scanCondition) ?? SCAN_CONDITIONS[0];

    const scanPanelCls = feedbackState === 'success'
        ? 'border-2 border-emerald-400 bg-emerald-50/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
        : feedbackState === 'error'
            ? 'border-2 border-red-400 bg-red-50/50 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
            : isDamagedMode
                ? 'border-2 border-red-300 bg-white'
                : 'border-2 border-slate-200 bg-white';

    return (
        <>
        <DashboardLayout>
            <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">

                {/* ── Header ─────────────────────────────────────────────── */}
                <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-xl font-heading font-bold text-slate-800">Scan Returns</h1>
                        <p className="text-xs text-slate-400 mt-0.5">Scan or type tracking IDs to mark returns as arrived</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/dashboard"
                            state={{ activeTab: 'returns' }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-violet-300 bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100 active:scale-95 transition-all"
                        >
                            <BarChart2 size={15}/> Returns Analysis
                        </Link>
                        {/* Meesho badge */}
                        <div className="flex items-center gap-2 px-4 py-2 bg-pink-50 border border-pink-200 rounded-xl">
                            <img src="/assets/meesho.png" alt="Meesho" className="w-5 h-5 object-contain" onError={e => { e.target.style.display='none'; }} />
                            <Store size={14} className="text-pink-500" />
                            <span className="text-sm font-bold text-pink-700">Meesho</span>
                        </div>
                    </div>
                </header>

                {/* ── Tab bar ────────────────────────────────────────────── */}
                <div className="bg-white border-b border-slate-200 px-8 flex items-center gap-1 shrink-0">
                    {[
                        { key: 'scan',       label: 'Scan',          icon: Scan },
                        { key: 'today',      label: "Today's Scan",  icon: List },
                        { key: 'unverified', label: 'Unverified',    icon: AlertOctagon, count: unverifiedTotal },
                    ].map(({ key, label, icon: Icon, count }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                                activeTab === key
                                    ? 'border-violet-600 text-violet-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}>
                            <Icon size={15}/>{label}
                            {count > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold leading-none">{count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Main ───────────────────────────────────────────────── */}
                <main className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'scan' ? (
                <div className="p-6">
                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${feedbackState === 'error' ? 'animate-shake' : ''}`}>

                        {/* ── Left: Scan Input ─────────────────────────────── */}
                        <div className={`rounded-2xl shadow-sm flex flex-col p-6 transition-all duration-300 ${scanPanelCls}`}>

                            {/* Panel header */}
                            <div className="flex items-center justify-between mb-5 gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${isDamagedMode ? 'bg-red-100 text-red-600' : feedbackState === 'success' ? 'bg-emerald-100 text-emerald-600' : feedbackState === 'error' ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-600'}`}>
                                        <Scan size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-base font-bold text-slate-800">Scan Input</h2>
                                            {isDamagedMode && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
                                                    <AlertOctagon size={11} /> DAMAGED MODE
                                                </span>
                                            )}
                                            {scanning && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                                                    <Loader2 size={11} className="animate-spin" /> Processing…
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">Awaiting input via scanner or manual entry</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSettingsOpen(true)}
                                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
                                    title="Scan Settings"
                                >
                                    <Settings size={18} />
                                </button>
                            </div>

                            {/* Camera section */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-slate-700">Camera Scanner</span>
                                    <button
                                        onClick={cameraActive ? stopCamera : startCamera}
                                        disabled={scanning}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors ${cameraActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'}`}
                                    >
                                        {cameraActive ? <><CameraOff size={14}/> Stop Camera</> : <><Camera size={14}/> Start Camera</>}
                                    </button>
                                </div>
                                <div className="relative rounded-xl overflow-hidden bg-slate-100" style={{ height: 280 }}>
                                    {!cameraActive && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <CameraOff size={36} className="opacity-40" />
                                            <span className="text-sm">Start Camera to Scan</span>
                                        </div>
                                    )}
                                    <div style={{
                                        width: '100%', height: '100%',
                                        visibility: cameraActive ? 'visible' : 'hidden',
                                        background: '#000',
                                    }}>
                                        <div id={scannerDivId} style={{ width: '100%', height: '100%' }} />
                                        <style>{`
                                            #${scannerDivId} video { width:100%!important; height:100%!important; object-fit:cover!important; }
                                            #${scannerDivId} > div:first-child { width:100%!important; padding:0!important; }
                                        `}</style>
                                    </div>
                                </div>
                                {cameraError && <p className="text-xs text-red-600 mt-1.5">{cameraError}</p>}
                            </div>

                            {/* Text input */}
                            <div className="flex-1 flex flex-col justify-end mt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        Tracking ID / AWB / Order ID
                                    </label>
                                    {/* Condition selector toggle */}
                                    <div className="relative flex bg-slate-100 p-1.5 rounded-xl items-center border border-slate-200/60 shadow-inner">
                                        <div
                                            className="absolute left-1.5 top-1.5 bottom-1.5 bg-white rounded-lg shadow-sm border border-slate-200 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
                                            style={{
                                                width: 'calc(50% - 6px)',
                                                transform: `translateX(${scanCondition === 'damaged' ? '100%' : '0'})`
                                            }}
                                        />
                                        {SCAN_CONDITIONS.map(({ value, label, trigger, dot }) => {
                                            const isSelected = scanCondition === value;
                                            return (
                                                <button
                                                    key={value}
                                                    onClick={() => { setScanCondition(value); requestAnimationFrame(() => { if (inputRef.current) inputRef.current.focus(); }); }}
                                                    className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors duration-300 ${
                                                        isSelected ? (value === 'damaged' ? 'text-red-600' : 'text-emerald-700') : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    {value === 'damaged' ? (
                                                        <AlertOctagon size={14} className={isSelected ? 'animate-pulse text-red-500' : ''} />
                                                    ) : (
                                                        <span className={`w-2 h-2 rounded-full transition-colors duration-300 ${isSelected ? dot : 'bg-slate-400'}`} />
                                                    )}
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={qrInput}
                                    onChange={e => setQrInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder={isDamagedMode ? 'Scan damaged item...' : 'Scan or type here…'}
                                    autoComplete="off"
                                    disabled={scanning}
                                    className={`w-full text-base px-4 py-3.5 border-2 rounded-xl focus:outline-none transition-colors ${
                                        isDamagedMode              ? 'border-red-400 focus:border-red-500 bg-red-50' :
                                        feedbackState === 'error'   ? 'border-red-400 focus:border-red-500 bg-red-50' :
                                        feedbackState === 'success' ? 'border-emerald-400 focus:border-emerald-500 bg-emerald-50' :
                                        'border-slate-200 focus:border-violet-400 bg-white'
                                    }`}
                                />
                                {feedbackMessage && (
                                    <p className={`mt-2 text-sm font-medium text-center ${feedbackState === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {feedbackMessage}
                                    </p>
                                )}
                                <p className="text-xs text-slate-400 mt-2 text-center">Press Enter or let scanner auto-submit</p>
                            </div>
                        </div>

                        {/* ── Right: Scanned Items ─────────────────────────── */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col" style={{ maxHeight: 640 }}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Scanned Items</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Auto-saved to DB ✓</p>
                                </div>
                                <div className={`min-w-[2.25rem] h-9 flex items-center justify-center px-3 rounded-xl font-bold text-base ${scannedItems.length > 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                                    {scannedItems.length}
                                </div>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
                                {scannedItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                                        <ShoppingBag size={48} className="mb-3 opacity-50" />
                                        <p className="text-sm font-medium text-slate-400">No items scanned yet</p>
                                        <p className="text-xs text-slate-300 mt-1">Scanned items will appear here</p>
                                    </div>
                                ) : (
                                    scannedItems.map((item, idx) => {
                                        if (!item) return null;
                                        const isDamaged = item.scanned_condition === 'damaged';
                                        return (
                                            <div
                                                key={idx}
                                                className={`flex items-start justify-between p-3.5 border rounded-xl group transition-colors animate-in fade-in slide-in-from-top-2 duration-300 ${isDamaged ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <div className="flex-1 min-w-0 pr-3">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        {isDamaged ? (
                                                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                                                <AlertOctagon size={11}/> Damaged
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                                <CheckCircle size={11}/> Arrived
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-slate-400 font-mono truncate">#{item.return_id}</span>
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-800 truncate" title={item.product_title}>
                                                        {item.product_title || 'Unknown Product'}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                                                        {item.sku         && <span><span className="font-medium text-slate-600">SKU:</span> {item.sku}</span>}
                                                        {item.tracking_id && <span><span className="font-medium text-slate-600">AWB:</span> {item.tracking_id}</span>}
                                                        {item.type_of_return && (
                                                            /rto/i.test(item.type_of_return)
                                                                ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">RTO</span>
                                                                : <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Customer</span>
                                                        )}
                                                    </div>
                                                    {item.reason && item.reason !== 'N/A' && (
                                                        <p className="mt-1.5 text-xs text-slate-500 bg-white border border-slate-100 rounded-lg px-2 py-1 truncate">
                                                            {item.reason}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveItem(`${item.marketplace_id}:${item.suborder_number}`)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                                                    title="Remove"
                                                >
                                                    <X size={15}/>
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 border-t border-slate-100 space-y-2 shrink-0">
                                <p className="text-xs text-center text-emerald-600 font-medium">✓ Each scan is saved to the database automatically</p>
                                <button
                                    onClick={handleClearList}
                                    disabled={scannedItems.length === 0}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-700 border border-slate-200 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                                >
                                    <Trash2 size={15}/> Clear List ({scannedItems.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                ) : activeTab === 'today' ? (
                    <div className="p-6 space-y-5">

                        {todayView === 'summary' ? (
                            <>
                                {/* Filter bar */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        {[
                                            { value: 'all',      label: 'All Types' },
                                            { value: 'rto',      label: 'RTO' },
                                            { value: 'customer', label: 'Customer' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => {
                                                    setTodayTypeFilter(opt.value);
                                                    fetchAccountSummary(opt.value);
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                    todayTypeFilter === opt.value
                                                        ? 'bg-violet-600 border-violet-600 text-white'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                }`}
                                            >{opt.label}</button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleExportSummary}
                                            disabled={summaryLoading || !accountSummary.length}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                        >
                                            <Download size={13}/> Export CSV
                                        </button>
                                        <button
                                            onClick={() => fetchAccountSummary(todayTypeFilter)}
                                            disabled={summaryLoading}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                        >
                                            <RefreshCw size={13} className={summaryLoading ? 'animate-spin' : ''}/> Refresh
                                        </button>
                                    </div>
                                </div>

                                {/* Summary table */}
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                    {summaryLoading ? (
                                        <div className="flex items-center justify-center py-16 text-slate-400">
                                            <Loader2 size={24} className="animate-spin mr-2"/>Loading…
                                        </div>
                                    ) : accountSummary.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                            <CalendarDays size={40} className="mb-3 opacity-40"/>
                                            <p className="text-sm font-medium text-slate-500">No scans today</p>
                                            <p className="text-xs mt-1">Items scanned today will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
                                                        <th className="text-left px-4 py-3 font-semibold whitespace-nowrap sticky left-0 bg-slate-50 z-10">Account</th>
                                                        <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Total</th>
                                                        {allCouriers.map(c => (
                                                            <th key={c} className="text-right px-4 py-3 font-semibold whitespace-nowrap">{c}</th>
                                                        ))}
                                                        <th className="text-right px-4 py-3 font-semibold whitespace-nowrap text-emerald-600">OK</th>
                                                        <th className="text-right px-4 py-3 font-semibold whitespace-nowrap text-red-500">Damaged</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {accountSummary.map((acc, idx) => {
                                                        const acctObj = meeshoAccounts.find(a => a._id === acc.account_id);
                                                        const name = acctObj?.name || acc.account_id;
                                                        return (
                                                            <tr
                                                                key={acc.account_id}
                                                                onClick={() => {
                                                                    setTodaySelectedAccount({ id: acc.account_id, name });
                                                                    setTodayAccountFilter(acc.account_id);
                                                                    setTodayCourierFilter('all');
                                                                    setTodayView('detail');
                                                                    fetchTodayScan(1, 'all', todayTypeFilter, acc.account_id);
                                                                }}
                                                                className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors hover:bg-violet-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                                                            >
                                                                <td className="px-4 py-3 font-semibold text-xs text-slate-800 whitespace-nowrap sticky left-0 bg-inherit z-10">
                                                                    <span className="flex items-center gap-1.5">
                                                                        {name}
                                                                        <ChevronRight size={12} className="text-slate-400"/>
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-bold text-xs text-slate-800">{acc.total}</td>
                                                                {allCouriers.map(c => (
                                                                    <td key={c} className="px-4 py-3 text-right text-xs text-slate-600">
                                                                        {acc.couriers[c] ?? <span className="text-slate-300">—</span>}
                                                                    </td>
                                                                ))}
                                                                <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-600">{acc.ok}</td>
                                                                <td className="px-4 py-3 text-right text-xs font-semibold">
                                                                    {acc.damaged > 0
                                                                        ? <span className="text-red-500">{acc.damaged}</span>
                                                                        : <span className="text-slate-300">—</span>}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                {/* Grand total footer */}
                                                {accountSummary.length > 1 && (() => {
                                                    const gt = accountSummary.reduce((s, a) => ({
                                                        total:   s.total   + a.total,
                                                        ok:      s.ok      + a.ok,
                                                        damaged: s.damaged + a.damaged,
                                                    }), { total: 0, ok: 0, damaged: 0 });
                                                    return (
                                                        <tfoot>
                                                            <tr className="bg-slate-100 border-t-2 border-slate-200">
                                                                <td className="px-4 py-3 text-xs font-bold text-slate-700 sticky left-0 bg-slate-100">Grand Total</td>
                                                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-800">{gt.total}</td>
                                                                {allCouriers.map(c => {
                                                                    const sum = accountSummary.reduce((s, a) => s + (a.couriers[c] ?? 0), 0);
                                                                    return <td key={c} className="px-4 py-3 text-right text-xs font-bold text-slate-700">{sum || <span className="text-slate-300">—</span>}</td>;
                                                                })}
                                                                <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">{gt.ok}</td>
                                                                <td className="px-4 py-3 text-right text-xs font-bold text-red-500">{gt.damaged || <span className="text-slate-300">—</span>}</td>
                                                            </tr>
                                                        </tfoot>
                                                    );
                                                })()}
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Detail view header */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                setTodayView('summary');
                                                setTodaySelectedAccount(null);
                                                setTodayCourierFilter('all');
                                                setTodayAccountFilter('all');
                                                fetchAccountSummary(todayTypeFilter);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            <ChevronLeft size={13}/> Back
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <Store size={14} className="text-violet-500"/>
                                            <span className="text-sm font-bold text-slate-800">{todaySelectedAccount?.name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {[
                                            { value: 'all',      label: 'All Types' },
                                            { value: 'rto',      label: 'RTO' },
                                            { value: 'customer', label: 'Customer' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => {
                                                    setTodayTypeFilter(opt.value);
                                                    setTodayCourierFilter('all');
                                                    fetchTodayScan(1, 'all', opt.value, todayAccountFilter);
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                    todayTypeFilter === opt.value
                                                        ? 'bg-violet-600 border-violet-600 text-white'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                }`}
                                            >{opt.label}</button>
                                        ))}
                                        <button
                                            onClick={handleExportDetail}
                                            disabled={exportLoading || todayLoading}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                        >
                                            {exportLoading ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>}
                                            {exportLoading ? 'Exporting…' : 'Export CSV'}
                                        </button>
                                        <button
                                            onClick={() => fetchTodayScan(todayPage, todayCourierFilter, todayTypeFilter, todayAccountFilter)}
                                            disabled={todayLoading}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                        >
                                            <RefreshCw size={13} className={todayLoading ? 'animate-spin' : ''}/> Refresh
                                        </button>
                                    </div>
                                </div>

                                {/* Courier stat cards */}
                                <div className="flex items-stretch gap-3 overflow-x-auto pb-0.5">
                                    {(() => {
                                        const grandTotal    = todayCouriers.reduce((s, c) => s + c.count, 0);
                                        const grandOk       = todayCouriers.reduce((s, c) => s + (c.ok ?? 0), 0);
                                        const grandDamaged  = todayCouriers.reduce((s, c) => s + (c.damaged ?? 0), 0);
                                        const grandRto      = todayCouriers.reduce((s, c) => s + (c.rto_count ?? 0), 0);
                                        const grandCustomer = todayCouriers.reduce((s, c) => s + (c.customer_count ?? 0), 0);
                                        const isAll = todayCourierFilter === 'all';
                                        const showTypeBreakdown = todayTypeFilter === 'all';
                                        return (
                                            <button
                                                onClick={() => { setTodayCourierFilter('all'); fetchTodayScan(1, 'all', todayTypeFilter, todayAccountFilter); }}
                                                className={`shrink-0 flex flex-col justify-between ${showTypeBreakdown ? 'w-[156px]' : 'w-[120px]'} p-3.5 rounded-2xl border-2 transition-all duration-200 text-left ${isAll ? 'bg-violet-600 border-violet-600 shadow-lg shadow-violet-200/60' : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-md'}`}>
                                                <div>
                                                    <p className={`text-2xl font-extrabold leading-none tracking-tight ${isAll ? 'text-white' : 'text-slate-800'}`}>{grandTotal}</p>
                                                    <p className={`text-xs font-semibold mt-1 ${isAll ? 'text-violet-200' : 'text-slate-500'}`}>All Couriers</p>
                                                </div>
                                                <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isAll ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        <CheckCircle size={9}/> {grandOk}
                                                    </span>
                                                    {grandDamaged > 0 && (
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isAll ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                                                            <AlertOctagon size={9}/> {grandDamaged}
                                                        </span>
                                                    )}
                                                </div>
                                                {showTypeBreakdown && (
                                                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                                        <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isAll ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                                            RTO {grandRto}
                                                        </span>
                                                        <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isAll ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                                            Cust {grandCustomer}
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })()}
                                    {todayCouriers.map(({ courier_partner, count, ok, damaged, rto_count, customer_count }) => {
                                        const isActive = todayCourierFilter === courier_partner;
                                        const showTypeBreakdown = todayTypeFilter === 'all';
                                        return (
                                            <button key={courier_partner}
                                                onClick={() => { setTodayCourierFilter(courier_partner); fetchTodayScan(1, courier_partner, todayTypeFilter, todayAccountFilter); }}
                                                className={`shrink-0 flex flex-col justify-between ${showTypeBreakdown ? 'w-[156px]' : 'w-[120px]'} p-3.5 rounded-2xl border-2 transition-all duration-200 text-left ${isActive ? 'bg-violet-600 border-violet-600 shadow-lg shadow-violet-200/60' : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-md'}`}>
                                                <div>
                                                    <p className={`text-2xl font-extrabold leading-none tracking-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>{count}</p>
                                                    <p className={`text-xs font-semibold mt-1 truncate max-w-[90px] ${isActive ? 'text-violet-200' : 'text-slate-500'}`}>{courier_partner}</p>
                                                </div>
                                                <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        <CheckCircle size={9}/> {ok ?? 0}
                                                    </span>
                                                    {damaged > 0 && (
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                                                            <AlertOctagon size={9}/> {damaged}
                                                        </span>
                                                    )}
                                                </div>
                                                {showTypeBreakdown && (
                                                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                                        <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                                            RTO {rto_count ?? 0}
                                                        </span>
                                                        <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                                            Cust {customer_count ?? 0}
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Detail table */}
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                    {todayLoading ? (
                                        <div className="flex items-center justify-center py-16 text-slate-400">
                                            <Loader2 size={24} className="animate-spin mr-2"/>Loading…
                                        </div>
                                    ) : todayItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                            <CalendarDays size={40} className="mb-3 opacity-40"/>
                                            <p className="text-sm font-medium text-slate-500">No scans today</p>
                                            <p className="text-xs mt-1">Items scanned today will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
                                                        <th className="text-left px-4 py-3 font-semibold">Suborder No</th>
                                                        <th className="text-left px-4 py-3 font-semibold">SKU</th>
                                                        <th className="text-left px-4 py-3 font-semibold">AWB</th>
                                                        <th className="text-left px-4 py-3 font-semibold">Courier</th>
                                                        <th className="text-left px-4 py-3 font-semibold">Type</th>
                                                        <th className="text-left px-4 py-3 font-semibold">Condition</th>
                                                        <th className="text-left px-4 py-3 font-semibold">Scanned At</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {todayItems.map((item, idx) => (
                                                        <tr key={item.suborder_number || idx}
                                                            className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                            <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{item.suborder_number || '—'}</td>
                                                            <td className="px-4 py-2.5 text-xs">{item.sku || '—'}</td>
                                                            <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{item.awb_number || '—'}</td>
                                                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">{item.courier_partner || '—'}</td>
                                                            <td className="px-4 py-2.5">
                                                                {item.type_of_return
                                                                    ? /rto/i.test(item.type_of_return)
                                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">RTO</span>
                                                                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">Customer</span>
                                                                    : <span className="text-slate-400 text-xs">—</span>}
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                {item.condition === 'damaged' ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                                                                        <AlertOctagon size={10}/> Damaged
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                                                        <CheckCircle size={10}/> OK
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                                                                {item.updated_at
                                                                    ? new Date(item.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                                                                    : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <TodayPagination
                                    page={todayPage}
                                    totalPages={todayTotalPages}
                                    total={todayTotalItems}
                                    onPageChange={p => fetchTodayScan(p, todayCourierFilter, todayTypeFilter, todayAccountFilter)}
                                />
                            </>
                        )}
                    </div>
                ) : (
                    <div className="p-6 space-y-5">
                        {/* Header info */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <AlertOctagon size={18} className="text-amber-600 shrink-0 mt-0.5"/>
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">Scanned before return file upload</p>
                                    <p className="text-xs text-amber-600 mt-0.5">These AWBs were scanned but not found in the system. Once you upload the matching return file, they will be auto-matched and removed from this list.</p>
                                </div>
                            </div>
                            <button onClick={handleRematchUnverified} disabled={rematchLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors shrink-0 disabled:opacity-60">
                                <RefreshCw size={12} className={rematchLoading ? 'animate-spin' : ''}/> {rematchLoading ? 'Matching...' : 'Refresh & Match'}
                            </button>
                        </div>

                        {/* Search + delete all */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 max-w-sm">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                <input
                                    type="text"
                                    value={unverifiedSearch}
                                    onChange={e => {
                                        const v = e.target.value;
                                        setUnverifiedSearch(v);
                                        unverifiedSearchRef.current = v;
                                        clearTimeout(searchTimerRef.current);
                                        searchTimerRef.current = setTimeout(() => fetchUnverified(1, v), 400);
                                    }}
                                    placeholder="Search by AWB / Order ID..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                                />
                            </div>
                            {unverifiedTotal > 0 && (
                                <>
                                    <button
                                        onClick={handleExportUnverified}
                                        disabled={unverifiedExportLoading}
                                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0"
                                    >
                                        {unverifiedExportLoading ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>}
                                        {unverifiedExportLoading ? 'Exporting…' : 'Export CSV'}
                                    </button>
                                    <button
                                        onClick={handleDeleteAllUnverified}
                                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors shrink-0"
                                    >
                                        <Trash2 size={13}/> Delete All ({unverifiedTotal.toLocaleString()})
                                    </button>
                                </>
                            )}
                        </div>

                        {/* List */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            {unverifiedLoading ? (
                                <div className="flex items-center justify-center py-16 text-slate-400">
                                    <Loader2 size={24} className="animate-spin mr-2"/>Loading…
                                </div>
                            ) : unverifiedItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <CheckCircle size={40} className="mb-3 opacity-40 text-emerald-400"/>
                                    <p className="text-sm font-medium text-slate-500">
                                        {unverifiedSearch ? 'No results found' : 'No unverified scans'}
                                    </p>
                                    <p className="text-xs mt-1">
                                        {unverifiedSearch ? 'Try a different search term' : 'All scanned items matched successfully'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
                                                <th className="text-left px-4 py-3 font-semibold">AWB / Order ID</th>
                                                <th className="text-left px-4 py-3 font-semibold">Condition</th>
                                                <th className="text-left px-4 py-3 font-semibold">Scanned At</th>
                                                <th className="px-4 py-3"/>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {unverifiedItems.map((item, idx) => (
                                                <tr key={item.id || idx} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{item.scan_code}</td>
                                                    <td className="px-4 py-3">
                                                        {item.condition === 'damaged' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                                                                <AlertOctagon size={10}/> Damaged
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                                                <CheckCircle size={10}/> OK
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                        {item.scanned_at
                                                            ? new Date(item.scanned_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => handleRemoveUnverified(item, idx)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Remove"
                                                        >
                                                            <X size={14}/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <TodayPagination
                            page={unverifiedPage}
                            totalPages={unverifiedTotalPages}
                            total={unverifiedTotal}
                            onPageChange={p => fetchUnverified(p, unverifiedSearchRef.current)}
                        />
                    </div>
                )}
                </main>
            </div>

            {/* ── Settings Modal ──────────────────────────────────────────── */}
            {settingsOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSettings} />
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <Settings size={17} className="text-slate-500" />
                                <h2 className="text-base font-bold text-slate-800">Scan Settings</h2>
                            </div>
                            <button onClick={closeSettings} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                <X size={17}/>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 space-y-6 max-h-[80vh]">
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Bulk Arrive by Date</h3>
                                <p className="text-xs text-slate-400 mb-4">Mark all un-arrived Meesho returns on or before a date as arrived.</p>

                                {/* Account Selector */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Users size={13} className="text-slate-500"/>
                                        <label className="text-sm font-semibold text-slate-700">Meesho Accounts</label>
                                    </div>
                                    {meeshoAccounts.length === 0 ? (
                                        <p className="text-xs text-slate-400 py-2">No Meesho accounts found</p>
                                    ) : (
                                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                                            <div className="max-h-44 overflow-y-auto">
                                                <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-100 transition-colors">
                                                    <input type="checkbox" checked={approveAccountIds.length === 0} onChange={() => setApproveAccountIds([])} className="w-4 h-4 rounded accent-violet-600"/>
                                                    <span className="text-sm font-semibold text-slate-700">All Accounts</span>
                                                </label>
                                                {meeshoAccounts.map(acc => (
                                                    <label key={acc._id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                                                        <input type="checkbox" checked={approveAccountIds.includes(acc._id)} onChange={() => toggleApproveAccount(acc._id)} className="w-4 h-4 rounded accent-violet-600"/>
                                                        <span className="text-sm text-slate-700 truncate">{acc.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Date Type */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <CalendarDays size={13} className="text-slate-500"/>
                                        <label className="text-sm font-semibold text-slate-700">Date Type</label>
                                    </div>
                                    <div className="flex gap-2">
                                        {[
                                            { value: 'return_created_date', label: 'Return Created' },
                                            { value: 'delivered_date',      label: 'Delivered Date' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => handleDateFieldChange(opt.value)}
                                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                                    approveDateField === opt.value
                                                        ? 'bg-violet-100 border-violet-300 text-violet-700'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* File Types */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <FileText size={13} className="text-slate-500"/>
                                        <label className="text-sm font-semibold text-slate-700">File Types</label>
                                    </div>
                                    <div className="flex gap-2">
                                        {[
                                            { value: 'intransit', label: 'Intransit' },
                                            { value: 'ofd',       label: 'OFD' },
                                            { value: 'completed', label: 'Completed' },
                                        ].map(({ value, label }) => {
                                            const forceDisabled = approveDateField === 'delivered_date' && value !== 'completed';
                                            const checked = approveFileTypes.includes(value);
                                            return (
                                                <label
                                                    key={value}
                                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                                                        forceDisabled
                                                            ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                                                            : checked
                                                                ? 'bg-violet-100 border-violet-300 text-violet-700 cursor-pointer'
                                                                : 'bg-white border-slate-200 text-slate-500 cursor-pointer hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={forceDisabled}
                                                        onChange={() => !forceDisabled && toggleApproveFileType(value)}
                                                        className="w-3.5 h-3.5 rounded accent-violet-600"
                                                    />
                                                    {label}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {approveDateField === 'delivered_date' && (
                                        <p className="text-xs text-amber-600 mt-1.5">Delivered date only exists in completed files</p>
                                    )}
                                </div>

                                {/* Date */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <CalendarDays size={13} className="text-slate-500"/>
                                        <label className="text-sm font-semibold text-slate-700">On or before date</label>
                                    </div>
                                    <input
                                        type="date"
                                        value={approveDate}
                                        onChange={e => setApproveDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                                    />
                                </div>

                                <button
                                    onClick={handleBulkApproveByDate}
                                    disabled={approveLoading || !approveDate}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {approveLoading ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle size={15}/>}
                                    {approveLoading ? 'Checking…' : 'Preview & Mark as Arrived'}
                                </button>
                            </div>

                            {/* ── Bulk Upload via CSV ── */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Bulk Upload via CSV</h3>
                                <p className="text-xs text-slate-400 mb-4">Download the CSV template, fill in AWB numbers (do not rename the column headers), then upload to mark returns as arrived. AWBs not found are saved as unverified and auto-matched when the return file arrives.</p>

                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-colors mb-3"
                                >
                                    <Download size={15}/> Download CSV Template
                                </button>

                                <div className="mb-3">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Upload Filled CSV</label>
                                    <input
                                        ref={bulkFileInputRef}
                                        type="file"
                                        accept=".csv"
                                        onChange={e => {
                                            const f = e.target.files[0] || null;
                                            if (f && f.size > 5 * 1024 * 1024) {
                                                toast.error(`File is too large (${(f.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is 5 MB.`);
                                                e.target.value = '';
                                                return;
                                            }
                                            setBulkFile(f);
                                        }}
                                        className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 border border-slate-200 focus:border-slate-200 rounded-lg px-2 py-1.5 cursor-pointer outline-none"
                                    />
                                    {bulkFile && (
                                        <p className="text-xs text-slate-500 mt-1 truncate">
                                            <FileSpreadsheet size={11} className="inline mr-1 text-emerald-500"/>
                                            {bulkFile.name}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleBulkUpload}
                                    disabled={bulkUploading || !bulkFile}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {bulkUploading ? <Loader2 size={15} className="animate-spin"/> : <Upload size={15}/>}
                                    {bulkUploading ? 'Processing…' : 'Upload & Mark as Arrived'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>

        <ConfirmModal
            isOpen={!!confirmModal}
            onClose={closeConfirm}
            onConfirm={confirmModal?.onConfirm}
            title={confirmModal?.title}
            message={confirmModal?.message}
            details={confirmModal?.details}
            confirmText={confirmModal?.confirmText}
            danger={confirmModal?.danger}
        />

        {/* ── Account Picker Modal (duplicate AWB in multiple accounts) ── */}
        {accountPicker && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setAccountPicker(null)} />
                <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Select Return to Mark Arrived</h2>
                            <p className="text-xs text-slate-500 mt-0.5">{accountPicker.matches.length} unscanned entr{accountPicker.matches.length === 1 ? 'y' : 'ies'} found for this AWB — pick the correct one.</p>
                        </div>
                        <button onClick={() => setAccountPicker(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                            <X size={15}/>
                        </button>
                    </div>
                    <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                        {accountPicker.matches.map((match, i) => {
                            const fileType = String(match.return_file_type || '').toLowerCase();
                            const ftColor = fileType === 'completed' ? 'bg-amber-100 text-amber-700'
                                : fileType === 'ofd' ? 'bg-cyan-100 text-cyan-700'
                                : 'bg-blue-100 text-blue-700';
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleAccountPickerSelect(match)}
                                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-colors group"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Store size={13} className="text-pink-500 shrink-0"/>
                                            <span className="text-xs font-bold text-slate-700 group-hover:text-violet-700 truncate">
                                                {match.marketplace_name || match.marketplace_id}
                                            </span>
                                        </div>
                                        {fileType && (
                                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${ftColor}`}>
                                                {fileType}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600 truncate pl-5" title={match.suborder_number}>
                                        {match.suborder_number || '—'}
                                    </p>
                                    <p className="text-[11px] text-slate-400 truncate pl-5 mt-0.5">{match.product_title || '—'}</p>
                                    <div className="pl-5 mt-1 flex gap-3 text-[11px] text-slate-400">
                                        {match.tracking_id && <span>AWB: {match.tracking_id}</span>}
                                        {match.sku && <span>SKU: {match.sku}</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default ScanReturns;
