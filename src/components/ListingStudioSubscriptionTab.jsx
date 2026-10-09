/* eslint-disable no-unused-vars -- see ListingStudioPlansManager.jsx for why (JSX-only usage
   false-positives as unused under this client's eslint config). */
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';
import { loadRazorpay } from '../utils/loadRazorpay';
import { parseGstin } from '../utils/gstinUtils';
import GstAutoFill from './GstAutoFill';
import {
    Loader2, AlertCircle, Zap, CreditCard, Check, X, CheckCircle, Clock,
    Image as ImageIcon, Video, Sparkles, Package, Download, Eye, FileText,
} from 'lucide-react';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const colorMap = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'bg-blue-600', badge: 'bg-blue-100 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', accent: 'bg-purple-600', badge: 'bg-purple-100 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', btn: 'bg-orange-500 hover:bg-orange-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', accent: 'bg-green-600', badge: 'bg-green-100 text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
};
const getColors = (scheme) => colorMap[scheme] || colorMap.blue;
const GST_RATE = Number(import.meta.env.VITE_GST_RATE || 18) / 100;
const getPriceBreakdown = (price) => {
    const base = Number(price) || 0;
    const gst = Number((base * GST_RATE).toFixed(2));
    return { base, gst, total: Number((base + gst).toFixed(2)) };
};

/**
 * Listing Studio's own product tab on the tenant billing page. A separate wallet/ledger from
 * SpeedEcom's Tenant.balance economy, but reusing this same screen rather than a new page
 * (LISTING_STUDIO_PAYMENTS.md §4). Like Reconciliation, catalog prices are pre-tax and GST is
 * added at checkout; the server remains authoritative for the charged total.
 */
const ListingStudioSubscriptionTab = () => {
    const { user } = useAuth();
    const [catalog, setCatalog] = useState({ plans: [], addonPacks: [], addonsUnlocked: false, wallet: null });
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [activeHistoryTab, setActiveHistoryTab] = useState('auto'); // 'auto' | 'manual'
    const [lsInvoices, setLsInvoices] = useState([]);
    const [downloadingId, setDownloadingId] = useState(null);
    const [viewingInvoiceUrl, setViewingInvoiceUrl] = useState(null);
    const [buying, setBuying] = useState(null); // { kind: 'plan'|'addon', title }
    const [features, setFeatures] = useState({ razorpayEnabled: false, razorpayAllowedEmail: '' });

    // ── GST details (required before every purchase — every Listing Studio invoice must carry
    //    a buyer GSTIN, same as Reconciliation's flow in client/src/pages/Subscription.jsx) ──
    const [pendingPurchase, setPendingPurchase] = useState(null); // { kind, title, price, orderPath, verifyPath, bodyKey }
    const [savedGst, setSavedGst] = useState(null);   // loaded from profile
    const [gstEditing, setGstEditing] = useState(false);
    const [gstForm, setGstForm] = useState({ businessName: '', gstin: '', pan: '', address: '', state: '', stateCode: '', phone: '' });
    const [gstinError, setGstinError] = useState('');
    const [gstLookupLoading, setGstLookupLoading] = useState(false);
    const gstinInputRef = useRef(null);
    const gstinCursorRef = useRef(null);
    const gstAutoFillRef = useRef(null);

    useEffect(() => {
        fetchCatalog();
        fetchHistory();
        api.get('/config/features').then(({ data }) => { if (data) setFeatures(data); }).catch(() => {});
        // /auth/gst-details is Admin-only (server/routes/authRoutes.js) — a non-Admin tenant
        // user (e.g. a User-role teammate) gets a 403 here. skipErrorToast avoids surfacing
        // that as a permission-denied toast on page load; the .catch below just leaves the
        // GST form blank so they can type it in manually at checkout.
        api.get('/auth/gst-details', { skipErrorToast: true })
            .then(({ data }) => {
                setSavedGst(data || {});
                setGstForm({
                    businessName: data?.businessName || '',
                    gstin: data?.gstin || '',
                    pan: data?.pan || '',
                    address: data?.address || '',
                    state: data?.state || '',
                    stateCode: data?.stateCode || '',
                    phone: data?.phone || '',
                });
            })
            .catch(() => setSavedGst({}));
    }, []);

    // Reset edit mode when the purchase modal closes
    useEffect(() => {
        if (!pendingPurchase) {
            setGstEditing(false);
            setGstinError('');
        }
    }, [pendingPurchase]);

    // GSTIN change handler — auto-fill state/PAN instantly (mirrors Subscription.jsx)
    const handleGstinChange = (e) => {
        const input = e.target;
        gstinInputRef.current = input;
        gstinCursorRef.current = input.selectionStart;
        const g = input.value.toUpperCase();
        setGstForm((f) => ({ ...f, gstin: g }));
        setGstinError('');
        if (g.length < 15) return;
        if (!GSTIN_RE.test(g)) {
            setGstinError('Invalid GSTIN format');
            return;
        }
        const parsed = parseGstin(g);
        if (parsed.valid) {
            setGstForm((f) => ({ ...f, gstin: g, pan: parsed.pan, state: parsed.stateName || f.state, stateCode: parsed.stateCode }));
            setGstLookupLoading(true);
            api.get(`/invoices/gstin-lookup/${g}`)
                .then(({ data }) => { if (data?.businessName) setGstForm((f) => ({ ...f, businessName: data.businessName })); })
                .catch(() => {})
                .finally(() => setGstLookupLoading(false));
        }
    };

    useLayoutEffect(() => {
        if (gstinCursorRef.current !== null && gstinInputRef.current) {
            gstinInputRef.current.setSelectionRange(gstinCursorRef.current, gstinCursorRef.current);
        }
    }, [gstForm.gstin]);

    const fetchCatalog = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/listing-studio/wallet/catalog');
            setCatalog(data);
        } catch {
            // toast handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    // Purchases come from the wallet ledger; invoices come from the invoice book. Both are needed:
    // an invoice moved here from Reconciliation (category transfer) has credits but no purchase row.
    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const [{ data }, { data: invoices }] = await Promise.all([
                api.get('/listing-studio/wallet/history'),
                api.get('/invoices/my'),
            ]);
            setHistory(data.transactions || []);
            setLsInvoices((invoices || []).filter((inv) => inv.paymentCategory === 'LISTING_STUDIO'));
        } catch {
            // toast handled by interceptor
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchInvoiceBlob = async (invoiceId) => {
        const response = await api.get(`/invoices/download/${invoiceId}`, { responseType: 'blob' });
        return window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    };

    const handleViewInvoice = async (invoiceId) => {
        try {
            const url = await fetchInvoiceBlob(invoiceId);
            setViewingInvoiceUrl((prevUrl) => {
                if (prevUrl) window.URL.revokeObjectURL(prevUrl);
                return url;
            });
        } catch {
            toast.error('Invoice not found. It may still be generating.');
        }
    };

    const handleDownloadInvoice = async (invoiceId, invoiceNumber) => {
        setDownloadingId(invoiceId);
        try {
            const url = await fetchInvoiceBlob(invoiceId);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice-${(invoiceNumber || 'unknown').replace(/\//g, '-')}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Invoice not found. It may still be generating.');
        } finally {
            setDownloadingId(null);
        }
    };

    const closeInvoiceView = () => {
        if (viewingInvoiceUrl) window.URL.revokeObjectURL(viewingInvoiceUrl);
        setViewingInvoiceUrl(null);
    };

    // Manual = created by an admin (MANUAL- id, or an admin-entered UTR). Everything else was paid
    // through the gateway, including invoices transferred in from Reconciliation.
    const isManualInvoice = (inv) => !!inv.createdBy?.email || String(inv.paymentId || '').startsWith('MANUAL-');
    const manualInvoices = lsInvoices.filter(isManualInvoice);
    const purchasePaymentIds = new Set(history.map((tx) => tx.razorpayPaymentId).filter(Boolean));
    const invoiceGst = (inv) => Number((inv.taxType === 'IGST' ? inv.igst : (inv.cgst || 0) + (inv.sgst || 0)) || 0);
    const autoRows = [
        ...history.map((tx) => {
            const { base, gst, total } = getPriceBreakdown(tx.metadata?.planPrice ?? tx.metadata?.packPrice);
            return {
                key: tx._id, plan: tx.metadata?.planTitle || tx.metadata?.packTitle || '—', base,
                gst: Number(tx.metadata?.gstAmount ?? gst), total: Number(tx.metadata?.totalPaid ?? total),
                paymentId: tx.razorpayPaymentId, date: tx.createdAt, cancelled: false,
                invoiceId: tx.invoiceId, invoiceNumber: tx.invoiceNumber,
            };
        }),
        // Gateway invoices with no purchase row here, e.g. transferred from Reconciliation.
        ...lsInvoices.filter((inv) => !isManualInvoice(inv) && !purchasePaymentIds.has(inv.paymentId)).map((inv) => ({
            key: inv._id, plan: inv.planName || inv.lineItems?.[0]?.description || '—', base: Number(inv.baseAmount),
            gst: invoiceGst(inv), total: Number(inv.totalAmount), paymentId: inv.paymentId, date: inv.createdAt,
            cancelled: inv.status !== 'active', invoiceId: inv.status === 'active' ? inv._id : null, invoiceNumber: inv.invoiceNumber,
        })),
    ].sort((x, y) => new Date(y.date) - new Date(x.date));

    const canUseRazorpay = features.razorpayEnabled && (
        !features.razorpayAllowedEmail ||
        features.razorpayAllowedEmail.toLowerCase() === 'all' ||
        user?.email?.toLowerCase() === features.razorpayAllowedEmail.toLowerCase()
    );

    // Opens the purchase-confirmation modal (GST details required there) instead of launching
    // Razorpay immediately — every Listing Studio invoice must carry a buyer GSTIN.
    const buyPlan = (plan) => setPendingPurchase({
        kind: 'plan', title: plan.title, price: plan.price,
        orderPath: '/listing-studio/wallet/razorpay/create-order',
        verifyPath: '/listing-studio/wallet/razorpay/verify-payment',
        bodyKey: 'planTitle',
    });

    const buyAddon = (pack) => setPendingPurchase({
        kind: 'addon', title: pack.title, price: pack.price,
        orderPath: '/listing-studio/wallet/addons/razorpay/create-order',
        verifyPath: '/listing-studio/wallet/addons/razorpay/verify-payment',
        bodyKey: 'packTitle',
    });

    const confirmPurchase = async () => {
        if (!pendingPurchase || buying) return;
        const { kind, title, orderPath, verifyPath, bodyKey } = pendingPurchase;
        setBuying({ kind, title });
        try {
            const loaded = await loadRazorpay();
            if (!loaded) {
                toast.error('Payment gateway failed to load. Check your internet connection.');
                setBuying(null);
                return;
            }
            const { data } = await api.post(orderPath, {
                [bodyKey]: title,
                buyerGstin: gstForm.gstin,
                buyerBusinessName: gstForm.businessName,
                buyerState: gstForm.state,
                buyerAddress: gstForm.address,
                buyerPan: gstForm.pan,
                buyerStateCode: gstForm.stateCode,
                buyerPhone: gstForm.phone,
            });
            const { orderId, amount, currency, keyId } = data;

            const options = {
                key: keyId, amount, currency, name: 'Speedecom — Speedy Listing',
                description: `${title} — ₹${(amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                order_id: orderId,
                handler: async (response) => {
                    try {
                        await api.post(verifyPath, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            [bodyKey]: title,
                            buyerGstin: gstForm.gstin,
                            buyerBusinessName: gstForm.businessName,
                            buyerState: gstForm.state,
                            buyerAddress: gstForm.address,
                            buyerPan: gstForm.pan,
                            buyerStateCode: gstForm.stateCode,
                            buyerPhone: gstForm.phone,
                        });
                        // Auto-save GST details to profile (silent) — Admin-only route, so a
                        // non-Admin buyer's 403 here is expected and shouldn't toast (see the
                        // matching GET above).
                        api.put('/auth/gst-details', gstForm, { skipErrorToast: true }).catch(() => {});
                        setSavedGst({ ...gstForm });
                        toast.success(`${title} added to your Speedy Listing wallet!`);
                        setPendingPurchase(null);
                        fetchCatalog();
                        fetchHistory();
                    } catch {
                        // toast handled by interceptor
                    } finally {
                        setBuying(null);
                    }
                },
                prefill: { name: user?.fullName || '', email: user?.email || '' },
                theme: { color: '#7c3aed' },
                modal: { ondismiss: () => setBuying(null) },
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (response) => {
                toast.error(`Payment failed: ${response.error.description}`);
                setBuying(null);
            });
            rzp.open();
        } catch {
            setBuying(null);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-brand-500" size={36} /></div>;
    }

    const wallet = catalog.wallet || { balance: 0, freeImagesRemaining: 0, freeVideosRemaining: 0 };

    return (
        <div className="space-y-8">
            {/* Wallet snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                    <div className="flex items-center gap-2.5 mb-2 text-slate-500 text-sm font-medium"><Sparkles size={16} className="text-purple-500" /> Credit balance</div>
                    <p className="text-3xl font-bold text-slate-800">{wallet.balance?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                    <div className="flex items-center gap-2.5 mb-2 text-slate-500 text-sm font-medium"><ImageIcon size={16} className="text-blue-500" /> Free images left</div>
                    <p className="text-3xl font-bold text-slate-800">{wallet.freeImagesRemaining || 0}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                    <div className="flex items-center gap-2.5 mb-2 text-slate-500 text-sm font-medium"><Video size={16} className="text-emerald-500" /> Free videos left</div>
                    <p className="text-3xl font-bold text-slate-800">{wallet.freeVideosRemaining || 0}</p>
                </div>
            </div>

            {/* Plans */}
            {catalog.plans.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center">
                    <AlertCircle className="text-amber-500 mx-auto mb-3" size={40} />
                    <p className="text-amber-800 font-semibold">No Speedy Listing plans available right now.</p>
                </div>
            ) : (
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">Speedy Listing Plans</h3>
                    <p className="text-sm text-slate-500 mb-6">All prices exclude 18% GST. Credits, free allowance, and rates stack with any plan you already hold.</p>
                    <div className="flex flex-wrap justify-center gap-4">
                        {catalog.plans.map((plan) => {
                            const c = getColors(plan.colorScheme);
                            const pricing = getPriceBreakdown(plan.price);
                            return (
                                <div key={plan.title} className={`flex-1 min-w-[280px] max-w-[300px] text-center relative flex flex-col rounded-2xl border-2 p-6 ${c.bg} ${c.border}`}>
                                    <div className={`absolute top-0 inset-x-0 h-1 ${c.accent}`} />
                                    <h4 className="text-xl font-bold text-slate-800 mb-1">{plan.title}</h4>
                                    <p className="text-sm text-slate-500 mb-4 min-h-[60px]">{plan.description}</p>
                                    <div className="mb-4">
                                        <div className="text-3xl font-extrabold text-slate-800">₹{pricing.base.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-xs text-slate-500 mt-1">+ 18% GST = <span className="font-semibold">₹{pricing.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total</span></p>
                                    </div>
                                    <button
                                        onClick={() => canUseRazorpay && buyPlan(plan)}
                                        disabled={!canUseRazorpay || (buying?.kind === 'plan' && buying?.title === plan.title)}
                                        className={`w-full py-2.5 rounded-xl text-white text-sm font-bold shadow-sm hover:shadow-md active:scale-95 disabled:opacity-60 mb-5 ${c.btn}`}
                                    >
                                        {buying?.kind === 'plan' && buying?.title === plan.title ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Processing…</span> : 'Buy Now'}
                                    </button>
                                    <div className="text-left text-sm space-y-1.5 border-t border-slate-100 pt-4">
                                        <Row label={`${plan.credits} credits included`} />
                                        <Row label={`${plan.freeImagesIncluded || 0} free listing images`} />
                                        {plan.freeVideosIncluded > 0 && <Row label={`${plan.freeVideosIncluded} free product video${plan.freeVideosIncluded === 1 ? '' : 's'}`} />}
                                        <Row label={`Full campaign at ${plan.campaignCost} credits`} />
                                        <Row label={`Extra images at ${plan.imageCost} credit each`} />
                                        <Row label={`Extra videos at ${plan.videoCost} credits each`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add-ons */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Package size={16} /> Need more credits? Add-on packs
                </h3>
                {!catalog.addonsUnlocked ? (
                    <p className="text-sm text-slate-400">Buy a plan above first — add-on packs only extend an existing plan's runway.</p>
                ) : catalog.addonPacks.length === 0 ? (
                    <p className="text-sm text-slate-400">No add-on packs available right now.</p>
                ) : (
                    <div className="flex flex-wrap gap-4">
                        {catalog.addonPacks.map((pack) => {
                            const pricing = getPriceBreakdown(pack.price);
                            return <div key={pack.title} className="flex items-center gap-4 border border-slate-200 rounded-xl px-4 py-3">
                                <div>
                                    <p className="font-bold text-slate-800">{pack.credits} credits add-on pack</p>
                                    <p className="text-xs text-slate-500">Base ₹{pricing.base.toLocaleString('en-IN')} + GST ₹{pricing.gst.toLocaleString('en-IN')} = <span className="font-semibold text-slate-700">₹{pricing.total.toLocaleString('en-IN')} total</span></p>
                                    <p className="text-xs text-slate-500 mt-0.5">{pack.imageCost} credit per image</p>
                                </div>
                                <button
                                    onClick={() => canUseRazorpay && buyAddon(pack)}
                                    disabled={!canUseRazorpay || (buying?.kind === 'addon' && buying?.title === pack.title)}
                                    className="ml-auto px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-60"
                                >
                                    {buying?.kind === 'addon' && buying?.title === pack.title ? <Loader2 size={14} className="animate-spin" /> : 'Buy'}
                                </button>
                            </div>;
                        })}
                    </div>
                )}
            </div>

            {!canUseRazorpay && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-sm text-amber-700">
                    Razorpay payments are currently restricted — contact support to purchase Speedy Listing credits.
                </div>
            )}

            {/* Payment history — same layout as the Reconciliation tab: Auto (gateway) / Manual (admin) */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-slate-800">Payment History</h3>
                        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                            {['auto', 'manual'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveHistoryTab(tab)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeHistoryTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {tab === 'auto' ? 'Auto' : 'Manual'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={fetchHistory}
                        className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
                    >
                        Refresh
                    </button>
                </div>

                {activeHistoryTab === 'auto' ? (
                    historyLoading ? (
                        <div className="flex items-center justify-center gap-2.5 py-14 text-slate-400"><Loader2 className="animate-spin" size={20} /> Loading history…</div>
                    ) : autoRows.length === 0 ? (
                        <div className="py-16 text-center">
                            <CreditCard className="text-slate-200 mx-auto mb-3" size={40} />
                            <p className="text-slate-400 font-medium">No payments yet</p>
                            <p className="text-slate-300 text-sm mt-1">Your purchases will appear here.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wide border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3">Plan</th>
                                        <th className="px-6 py-3">Base</th>
                                        <th className="px-6 py-3">GST (18%)</th>
                                        <th className="px-6 py-3">Total Paid</th>
                                        <th className="px-6 py-3">Payment ID</th>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {autoRows.map((row) => (
                                        <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-6 py-4 font-semibold text-slate-800">{row.plan}</td>
                                            <td className="px-6 py-4 text-slate-600">₹{row.base.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-slate-600">₹{row.gst.toFixed(2)}</td>
                                            <td className="px-6 py-4 font-bold text-slate-800">₹{row.total.toFixed(2)}</td>
                                            <td className="px-6 py-4">
                                                {row.paymentId
                                                    ? <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{row.paymentId}</span>
                                                    : <span className="text-slate-300 text-xs">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
                                                {new Date(row.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${row.cancelled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {row.cancelled ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
                                                    {row.cancelled ? 'Cancelled' : 'Approved'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <InvoiceActions
                                                    invoiceId={row.invoiceId}
                                                    invoiceNumber={row.invoiceNumber}
                                                    downloading={downloadingId === row.invoiceId}
                                                    onView={handleViewInvoice}
                                                    onDownload={handleDownloadInvoice}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : historyLoading ? (
                    <div className="flex items-center justify-center gap-2.5 py-14 text-slate-400"><Loader2 className="animate-spin" size={20} /> Loading invoices…</div>
                ) : manualInvoices.length === 0 ? (
                    <div className="py-16 text-center">
                        <FileText className="text-slate-200 mx-auto mb-3" size={40} />
                        <p className="text-slate-400 font-medium">No manual invoices</p>
                        <p className="text-slate-300 text-sm mt-1">Speedy Listing invoices created by admin will appear here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wide border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3">Invoice No.</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3">Base</th>
                                    <th className="px-6 py-3">GST</th>
                                    <th className="px-6 py-3">Total</th>
                                    <th className="px-6 py-3">Payment Method</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Invoice</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {manualInvoices.map((inv) => {
                                    const gst = inv.taxType === 'IGST' ? inv.igst : (inv.cgst + inv.sgst);
                                    const active = inv.status === 'active';
                                    return (
                                        <tr key={inv._id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-6 py-4"><span className="font-mono text-xs font-semibold text-slate-800">{inv.invoiceNumber}</span></td>
                                            <td className="px-6 py-4 text-slate-600">{inv.planName || inv.lineItems?.[0]?.description || '—'}</td>
                                            <td className="px-6 py-4 text-slate-600">₹{Number(inv.baseAmount).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-slate-600">₹{Number(gst || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 font-bold text-slate-800">₹{Number(inv.totalAmount).toFixed(2)}</td>
                                            <td className="px-6 py-4"><span className="text-xs text-slate-600">{inv.paymentMethod || '—'}</span></td>
                                            <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
                                                {new Date(inv.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {active ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                                                    {active ? 'Active' : 'Cancelled'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <InvoiceActions
                                                    invoiceId={active ? inv._id : null}
                                                    invoiceNumber={inv.invoiceNumber}
                                                    downloading={downloadingId === inv._id}
                                                    onView={handleViewInvoice}
                                                    onDownload={handleDownloadInvoice}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Purchase confirmation — GST details required before every payment ────── */}
            {pendingPurchase && (() => {
                const pricing = getPriceBreakdown(pendingPurchase.price);
                const gstValid = gstForm.gstin.length === 15 && !gstinError && gstForm.businessName;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Complete Payment</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Secured by Razorpay</p>
                                </div>
                                <button
                                    onClick={() => { if (!buying) setPendingPurchase(null); }}
                                    disabled={!!buying}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-40"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                                <div className="flex items-center gap-3 p-4 rounded-xl border-2 bg-purple-50 border-purple-200">
                                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-purple-600">
                                        <Zap size={18} className="text-white" fill="white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 truncate">{pendingPurchase.title}</div>
                                        <div className="text-sm font-semibold text-purple-700">{pendingPurchase.kind === 'plan' ? 'Speedy Listing Plan' : 'Add-on Pack'}</div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-lg font-extrabold text-slate-800">₹{pricing.total.toFixed(2)}</div>
                                        <div className="text-xs text-slate-400">incl. GST</div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl px-4 py-3 grid grid-cols-3 text-sm text-center divide-x divide-slate-200">
                                    <div><div className="text-slate-400 text-xs mb-0.5">Base Price</div><div className="font-semibold text-slate-700">₹{pricing.base.toFixed(2)}</div></div>
                                    <div><div className="text-slate-400 text-xs mb-0.5">GST (18%)</div><div className="font-semibold text-slate-700">₹{pricing.gst.toFixed(2)}</div></div>
                                    <div><div className="text-slate-400 text-xs mb-0.5">Total</div><div className="font-bold text-slate-900">₹{pricing.total.toFixed(2)}</div></div>
                                </div>

                                {/* ── GST Details (Required) ──────────────────── */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    {savedGst?.gstin && !gstEditing && (
                                        <>
                                            <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
                                                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                                    <CheckCircle size={12} /> Invoice will be issued to
                                                </span>
                                                <button onClick={() => setGstEditing(true)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                                                    ✏ Edit
                                                </button>
                                            </div>
                                            <div className="px-4 py-3 space-y-0.5">
                                                <p className="font-bold text-sm text-slate-800">{savedGst.businessName || user?.fullName}</p>
                                                <p className="text-xs text-slate-500 font-mono">GSTIN: {savedGst.gstin}</p>
                                                {savedGst.pan && <p className="text-xs text-slate-500">PAN: {savedGst.pan}</p>}
                                                <p className="text-xs text-slate-500">State: {savedGst.state}{savedGst.stateCode ? ` (${savedGst.stateCode})` : ''}</p>
                                            </div>
                                        </>
                                    )}

                                    {!savedGst?.gstin && !gstEditing && (
                                        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                                <FileText size={12} /> GST details are required before payment
                                            </span>
                                        </div>
                                    )}

                                    {(gstEditing || !savedGst?.gstin) && (
                                        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-slate-100 bg-slate-50/50">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">GSTIN <span className="font-normal text-slate-400">— state &amp; PAN auto-fill</span></label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={gstForm.gstin}
                                                        onChange={handleGstinChange}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' && gstForm.gstin.length === 15 && !gstinError) gstAutoFillRef.current?.click(); }}
                                                        placeholder="e.g. 24AARFH4419D1ZH"
                                                        maxLength={15}
                                                        className={`flex-1 px-3 py-2 text-sm font-mono rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-400 ${gstinError ? 'border-red-300' : 'border-slate-200'}`}
                                                    />
                                                    <GstAutoFill
                                                        gstin={gstForm.gstin}
                                                        disabled={!gstForm.gstin || gstForm.gstin.length < 15}
                                                        buttonLabel={null}
                                                        buttonRef={gstAutoFillRef}
                                                        buttonClassName="px-3 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                                                        onGstFetched={(data) => {
                                                            if (!data) return;
                                                            setGstForm((f) => ({
                                                                ...f,
                                                                gstin: data.gstin || f.gstin,
                                                                businessName: data.businessName || f.businessName,
                                                                pan: data.pan || f.pan,
                                                                address: data.address || f.address,
                                                                state: data.state || f.state,
                                                                stateCode: data.stateCode || f.stateCode,
                                                                phone: data.phone || f.phone,
                                                            }));
                                                        }}
                                                    />
                                                </div>
                                                {gstinError ? <p className="text-red-500 text-xs mt-1">{gstinError}</p>
                                                    : gstForm.state ? <p className="text-emerald-600 text-xs mt-1">✓ State: {gstForm.state} auto-filled</p> : null}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Business Name {gstLookupLoading && <span className="text-brand-400 font-normal">fetching…</span>}</label>
                                                <input type="text" value={gstForm.businessName} onChange={(e) => setGstForm((f) => ({ ...f, businessName: e.target.value }))} placeholder="e.g. Hmsquare Solutions LLP"
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                                                <input type="text" value={gstForm.address} onChange={(e) => setGstForm((f) => ({ ...f, address: e.target.value }))} placeholder="Billing address"
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400" />
                                            </div>
                                            <div className="flex items-center justify-between pt-1">
                                                <p className="text-xs text-slate-400">Auto-saved to your profile after payment.</p>
                                                {gstEditing && (
                                                    <button type="button" onClick={() => {
                                                        setGstEditing(false);
                                                        setGstinError('');
                                                        setGstForm({
                                                            businessName: savedGst?.businessName || '', gstin: savedGst?.gstin || '', pan: savedGst?.pan || '',
                                                            address: savedGst?.address || '', state: savedGst?.state || '', stateCode: savedGst?.stateCode || '', phone: savedGst?.phone || '',
                                                        });
                                                    }} className="text-xs text-slate-500 hover:text-slate-700 font-medium">✕ Cancel</button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={confirmPurchase}
                                    disabled={!!buying || !gstValid || gstLookupLoading}
                                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md active:scale-[0.98] text-base"
                                >
                                    {buying ? (<><Loader2 size={18} className="animate-spin" /> Processing…</>) : (<><CreditCard size={18} /> Pay ₹{pricing.total.toFixed(2)}</>)}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {viewingInvoiceUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[96vh] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                            <h3 className="font-bold text-slate-800">Invoice</h3>
                            <button onClick={closeInvoiceView} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 p-4 bg-slate-50">
                            <iframe src={viewingInvoiceUrl + '#toolbar=0&navpanes=0'} className="w-full h-full rounded-lg border border-slate-200" title="Invoice PDF" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const InvoiceActions = ({ invoiceId, invoiceNumber, downloading, onView, onDownload }) => {
    if (!invoiceId) return <span className="text-slate-300 text-xs">—</span>;
    return (
        <div className="flex items-center gap-2">
            <button onClick={() => onView(invoiceId)} title="View Invoice" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                <Eye size={15} />
            </button>
            <button onClick={() => onDownload(invoiceId, invoiceNumber)} disabled={downloading} title="Download Invoice" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-50">
                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            </button>
        </div>
    );
};

const Row = ({ label }) => (
    <div className="flex items-start gap-2">
        <Check size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
        <span className="text-slate-700">{label}</span>
    </div>
);

export default ListingStudioSubscriptionTab;
