/* eslint-disable no-unused-vars -- see ListingStudioPlansManager.jsx for why (JSX-only usage
   false-positives as unused under this client's eslint config). */
import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';
import { loadRazorpay } from '../utils/loadRazorpay';
import {
    Loader2, AlertCircle, Zap, CreditCard, Check, X, CheckCircle, Clock,
    Image as ImageIcon, Video, Sparkles, Package, Download, Eye, FileText,
} from 'lucide-react';

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

    useEffect(() => {
        fetchCatalog();
        fetchHistory();
        api.get('/config/features').then(({ data }) => { if (data) setFeatures(data); }).catch(() => {});
    }, []);

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

    const runPurchase = async ({ kind, title, price, orderPath, verifyPath, bodyKey }) => {
        if (buying) return;
        setBuying({ kind, title });
        try {
            const loaded = await loadRazorpay();
            if (!loaded) {
                toast.error('Payment gateway failed to load. Check your internet connection.');
                setBuying(null);
                return;
            }
            const { data } = await api.post(orderPath, { [bodyKey]: title });
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
                            buyerBusinessName: user?.fullName || '',
                            buyerGstin: '', // Listing Studio purchases don't gate on GST like Reconciliation's flow
                        });
                        toast.success(`${title} added to your Speedy Listing wallet!`);
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

    const buyPlan = (plan) => runPurchase({
        kind: 'plan', title: plan.title, price: plan.price,
        orderPath: '/listing-studio/wallet/razorpay/create-order',
        verifyPath: '/listing-studio/wallet/razorpay/verify-payment',
        bodyKey: 'planTitle',
    });

    const buyAddon = (pack) => runPurchase({
        kind: 'addon', title: pack.title, price: pack.price,
        orderPath: '/listing-studio/wallet/addons/razorpay/create-order',
        verifyPath: '/listing-studio/wallet/addons/razorpay/verify-payment',
        bodyKey: 'packTitle',
    });

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
