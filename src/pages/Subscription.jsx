import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import {
    CheckCircle, Clock, AlertCircle, Loader2,
    X, ShieldCheck, Zap, CreditCard, BadgeCheck, Download, Building2, FileText, Eye, Check, Sparkles,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';
import { loadRazorpay } from '../utils/loadRazorpay';
import { parseGstin } from '../utils/gstinUtils';
import GstAutoFill from '../components/GstAutoFill';

const GST_RATE = Number(import.meta.env.VITE_GST_RATE || 18) / 100;

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const Subscription = () => {
    const { user } = useAuth();

    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [activeHistoryTab, setActiveHistoryTab] = useState('auto');
    const [manualInvoices, setManualInvoices] = useState([]);
    const [manualInvoicesLoading, setManualInvoicesLoading] = useState(false);

    // Payment modal
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(null);

    // ── GST smart card state ─────────────────────────────────────────────────
    const [savedGst, setSavedGst] = useState(null);   // loaded from profile
    const [gstEditing, setGstEditing] = useState(false);  // inline edit mode
    const [gstForm, setGstForm] = useState({ businessName: '', gstin: '', pan: '', address: '', state: '', stateCode: '', phone: '' });
    const [gstinError, setGstinError] = useState('');
    const [gstLookupLoading, setGstLookupLoading] = useState(false);

    // Invoice download per row
    const [downloadingId, setDownloadingId] = useState(null);
    const gstAutoFillRef = useRef(null);
    const [viewingInvoiceUrl, setViewingInvoiceUrl] = useState(null);

    // Razorpay access control
    const [features, setFeatures] = useState({ razorpayEnabled: false, razorpayAllowedEmail: '' });

    useEffect(() => {
        fetchPlans();
        fetchHistory();
        api.get('/config/features').then(({ data }) => {
            if (data) setFeatures(data);
        }).catch(() => { });
        api.get('/auth/gst-details')
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

    // Reset when modal closes
    useEffect(() => {
        if (!selectedPlan) {
            setGstEditing(false);
            setGstinError('');
        }
    }, [selectedPlan]);

    useEffect(() => { fetchPlans(); fetchHistory(); }, []);

    // GSTIN change handler — auto-fill state/PAN instantly
    const handleGstinChange = (value) => {
        const g = value.toUpperCase();
        setGstForm(f => ({ ...f, gstin: g }));
        setGstinError('');
        if (g.length < 15) return;
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g)) {
            setGstinError('Invalid GSTIN format');
            return;
        }
        const parsed = parseGstin(g);
        if (parsed.valid) {
            setGstForm(f => ({ ...f, gstin: g, pan: parsed.pan, state: parsed.stateName || f.state, stateCode: parsed.stateCode }));
            // Try API lookup for business name
            setGstLookupLoading(true);
            api.get(`/invoices/gstin-lookup/${g}`)
                .then(({ data }) => { if (data?.businessName) setGstForm(f => ({ ...f, businessName: data.businessName })); })
                .catch(() => { })
                .finally(() => setGstLookupLoading(false));
        }
    };

    const fetchPlans = async () => {
        setPlansLoading(true);
        try {
            const { data } = await api.get('/credit-plans');
            setPlans(data.plans || []);
        } catch {
            // toast handled by interceptor
        } finally {
            setPlansLoading(false);
        }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const { data } = await api.get('/subscriptions/my-history');
            setHistory(data);
        } catch {
            // toast handled by interceptor
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchManualInvoices = async () => {
        setManualInvoicesLoading(true);
        try {
            const { data } = await api.get('/invoices/my', { params: { type: 'manual' } });
            setManualInvoices(data || []);
        } catch {
            // toast handled by interceptor
        } finally {
            setManualInvoicesLoading(false);
        }
    };

    // ── Invoice download ─────────────────────────────────────────────────────
    const handleDownloadInvoice = async (subscriptionId, invoiceLabel) => {
        setDownloadingId(subscriptionId);
        try {
            const response = await api.get(`/invoices/${subscriptionId}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice-${invoiceLabel}.pdf`;
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

    const handleDownloadManualInvoice = async (invoiceId, invoiceNumber) => {
        setDownloadingId(invoiceId);
        try {
            const response = await api.get(`/invoices/download/${invoiceId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            const safeLabel = (invoiceNumber || 'unknown').replace(/\//g, '-');
            link.download = `Invoice-${safeLabel}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Invoice not found.');
        } finally {
            setDownloadingId(null);
        }
    };

    // ── Invoice view ────────────────────────────────────────────────────────
    const handleViewInvoice = async (subscriptionId) => {
        try {
            const response = await api.get(`/invoices/${subscriptionId}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            setViewingInvoiceUrl(prevUrl => {
                if (prevUrl) window.URL.revokeObjectURL(prevUrl);
                return url;
            });
        } catch {
            toast.error('Invoice not found. It may still be generating.');
        }
    };

    const handleViewManualInvoice = async (invoiceId) => {
        try {
            const response = await api.get(`/invoices/download/${invoiceId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            setViewingInvoiceUrl(prevUrl => {
                if (prevUrl) window.URL.revokeObjectURL(prevUrl);
                return url;
            });
        } catch {
            toast.error('Invoice not found.');
        }
    };

    const handleTabChange = (tab) => {
        setActiveHistoryTab(tab);
        if (tab === 'manual' && manualInvoices.length === 0 && !manualInvoicesLoading) {
            fetchManualInvoices();
        }
    };

    const canUseRazorpay = features.razorpayEnabled && (
        !features.razorpayAllowedEmail ||
        features.razorpayAllowedEmail.toLowerCase() === 'all' ||
        user?.email?.toLowerCase() === features.razorpayAllowedEmail.toLowerCase()
    );


    const closeInvoiceView = () => {
        if (viewingInvoiceUrl) {
            window.URL.revokeObjectURL(viewingInvoiceUrl);
            setViewingInvoiceUrl(null);
        }
    };

    // ── Razorpay payment ─────────────────────────────────────────────────────
    const handleRazorpayPayment = async () => {
        if (!selectedPlan || paymentLoading) return;
        setPaymentLoading(true);

        try {
            const loaded = await loadRazorpay();
            if (!loaded) {
                toast.error('Payment gateway failed to load. Check your internet connection.');
                setPaymentLoading(false);
                return;
            }

            const { data } = await api.post('/subscriptions/razorpay/create-order', {
                planName: selectedPlan.title,
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
                key: keyId,
                amount,
                currency,
                name: 'Speedecom',
                description: `${selectedPlan.title} – ${selectedPlan.credits.toLocaleString()} Credits`,
                order_id: orderId,
                handler: async (response) => {
                    setPaymentLoading(true);
                    try {
                        const verifyRes = await api.post('/subscriptions/razorpay/verify-payment', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            planName: selectedPlan.title,
                            buyerGstin: gstForm.gstin,
                            buyerBusinessName: gstForm.businessName,
                            buyerState: gstForm.state,
                            buyerAddress: gstForm.address,
                            buyerPan: gstForm.pan,
                            buyerStateCode: gstForm.stateCode,
                            buyerPhone: gstForm.phone,
                        });
                        // Auto-save GST details to profile (silent)
                        if (gstForm.gstin) {
                            api.put('/auth/gst-details', gstForm).catch(() => { });
                            setSavedGst({ ...gstForm });
                        }
                        const successData = {
                            paymentId: response.razorpay_payment_id,
                            planName: selectedPlan.title,
                            credits: selectedPlan.credits,
                            invoiceNumber: verifyRes?.data?.invoiceNumber || null,
                        };
                        setSelectedPlan(null);
                        setPaymentSuccess(successData);
                        fetchHistory();
                    } catch {
                        // toast handled by interceptor
                    } finally {
                        setPaymentLoading(false);
                    }
                },
                prefill: {
                    name: user?.fullName || '',
                    email: user?.email || '',
                },
                theme: { color: '#0284c7' },
                modal: { ondismiss: () => setPaymentLoading(false) },
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', async (response) => {
                try {
                    await api.post('/subscriptions/razorpay/record-failed', {
                        orderId,
                        planName: selectedPlan.title,
                        amount: selectedPlan.price,
                        errorCode: response.error.code,
                        errorDescription: response.error.description,
                    });
                    fetchHistory();
                } catch { }
                toast.error(`Payment failed: ${response.error.description}`);
                setPaymentLoading(false);
            });

            setPaymentLoading(false);
            rzp.open();
        } catch {
            setPaymentLoading(false);
        }
    };

    // ── Color helpers ────────────────────────────────────────────────────────
    const colorMap = {
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'bg-blue-600', badge: 'bg-blue-100 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-200', accent: 'bg-purple-600', badge: 'bg-purple-100 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', btn: 'bg-orange-500 hover:bg-orange-600' },
        green: { bg: 'bg-green-50', border: 'border-green-200', accent: 'bg-green-600', badge: 'bg-green-100 text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
        red: { bg: 'bg-red-50', border: 'border-red-200', accent: 'bg-red-600', badge: 'bg-red-100 text-red-700', btn: 'bg-red-600 hover:bg-red-700' },
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', accent: 'bg-indigo-600', badge: 'bg-indigo-100 text-indigo-700', btn: 'bg-indigo-600 hover:bg-indigo-700' },
        pink: { bg: 'bg-pink-50', border: 'border-pink-200', accent: 'bg-pink-600', badge: 'bg-pink-100 text-pink-700', btn: 'bg-pink-600 hover:bg-pink-700' },
    };
    const getColors = (scheme) => colorMap[scheme] || colorMap.blue;

    const taxAmount = selectedPlan ? parseFloat((selectedPlan.price * GST_RATE).toFixed(2)) : 0;
    const totalAmount = selectedPlan ? (selectedPlan.price + taxAmount).toFixed(2) : '0.00';

    return (
        <DashboardLayout>
            <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">

                {/* ── Header ───────────────────────────────────────────────── */}
                <header className="bg-slate-50 sticky top-0 z-10 px-8 py-4 border-b border-slate-100">
                    <h2 className="text-2xl font-heading font-bold text-slate-800">Subscription & Billing</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {canUseRazorpay
                            ? 'Pay instantly via Razorpay'
                            : 'Contact support to purchase credits'}
                    </p>
                </header>

                <main className="flex-1 p-8 w-full overflow-y-auto custom-scrollbar space-y-10">

                    {/* ── Plans Grid ───────────────────────────────────────── */}
                    {plansLoading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="animate-spin text-brand-500" size={36} />
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center">
                            <AlertCircle className="text-amber-500 mx-auto mb-3" size={40} />
                            <p className="text-amber-800 font-semibold">No credit plans available right now.</p>
                            <p className="text-amber-600 text-sm mt-1">Please contact support for assistance.</p>
                        </div>
                    ) : (
                        <section>
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-slate-800">Available Plans</h3>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    All prices exclude 18% GST. {canUseRazorpay ? 'Razorpay payments activate instantly.' : 'Contact support to purchase credits.'}
                                </p>
                            </div>

                            {/* <div className={`grid grid-cols-1 gap-10 ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}> */}
                            {/* <div className={`max-w-6xl mx-auto grid grid-cols-1 gap-10 px-10 ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}> */}
                            <div className="flex flex-wrap justify-center gap-3"
                                style={{
                                    gridTemplateColumns: "repeat(auto-fit, 350px)",
                                }}>
                                {/* {plans.map((plan) => { */}
                                {[...plans].reverse().map((plan) => {
                                    const c = getColors(plan.colorScheme);
                                    const gstTotal = (plan.price + plan.price * GST_RATE).toFixed(2);
                                    return (
                                        <div
                                            key={plan._id}
                                            // className={`text-center relative flex flex-col rounded-2xl border-2 p-6 overflow-hidden transition-all duration-200 hover:shadow-card-hover ${c.bg} ${c.border}`}
                                            className={`flex-1 min-w-[320px] max-w-[320px] text-center relative flex flex-col rounded-2xl border-2 p-6 overflow-hidden transition-all duration-200 hover:shadow-card-hover ${c.bg} ${c.border}`}
                                        >
                                            <div className={`absolute top-0 inset-x-0 h-1 ${c.accent}`} />

                                            {/* <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mb-4 w-fit ${c.badge}`}>
                                                <Zap size={11} fill="currentColor" />
                                                {plan.credits.toLocaleString()} Credits
                                            </span> */}

                                            <h3 className="text-xl font-bold text-slate-800 mb-1">{plan.title}</h3>
                                            {/* <p className="text-sm text-slate-500 mb-5 leading-relaxed"> */}
                                            <p className="text-sm text-slate-500 leading-relaxed min-h-[100px] flex items-start justify-center text-center mb-5">
                                                {plan.description}
                                            </p>

                                            {/* Features List */}
                                            {/* {plan.features && plan.features.filter(f => f && f.trim()).length > 0 && (
                                                <div className="mb-6 pt-5 border-t border-slate-100 leading-relaxed">
                                                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                                        Included Features
                                                    </h4>
                                                    <div className="space-y-2.5">
                                                        {plan.features.filter(f => f && f.trim()).map((feature, idx) => (
                                                            <div key={idx} className="flex items-start gap-3 group">
                                                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                                                                    <Check size={12} className="text-green-600 font-bold" />
                                                                </div>
                                                                <span className="text-sm text-slate-700 leading-relaxed group-hover:text-slate-900 transition-colors">{feature}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )} */}

                                            {(() => {
                                                const parseFeature = (f) => {
                                                    const fStr = typeof f === 'string' ? f : String(f || '');
                                                    return {
                                                        isExcluded: fStr.startsWith('EXCLUDE:'),
                                                        text: fStr.replace(/^EXCLUDE:/, '').trim()
                                                    };
                                                };
                                                
                                                const allFeatures = (plan.features || []).map(parseFeature).filter(f => f.text.length > 0);
                                                const includedFeatures = allFeatures.filter(f => !f.isExcluded);
                                                const excludedFeatures = allFeatures.filter(f => f.isExcluded);
                                                return (
                                                    <>
                                                        <div className="pt-0">
                                                            <div className="mb-5">
                                                                <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
                                                                    ₹{plan.price.toLocaleString()}
                                                                </div>
                                                                <div className="text-xs text-slate-400 mt-1">
                                                                    + 18% GST = <span className="font-semibold text-slate-500">₹{gstTotal} total</span>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => setSelectedPlan(plan)}
                                                                className={`w-full py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 ${c.btn}`}
                                                            >
                                                                Buy Now
                                                            </button>
                                                        </div>
                                                        {includedFeatures.length > 0 && (
                                                            <div className="mb-3 pt-5 border-t border-slate-100 leading-relaxed text-left">
                                                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                                                    {/* Features */}
                                                                    Benefits
                                                                </h4>
                                                                <div className="space-y-2.5">
                                                                    {includedFeatures.map((feature, idx) => (
                                                                        <div key={idx} className="flex items-start gap-3 group">
                                                                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                                                                                <Check size={12} className="text-green-600 font-bold" />
                                                                            </div>
                                                                            <span className="text-sm text-slate-700 leading-relaxed group-hover:text-slate-900 transition-colors">{feature.text}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {excludedFeatures.length > 0 && (
                                                            <div className="mb-6 border-t border-slate-100 leading-relaxed text-left">
                                                                {/* <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                                                    Not Included Features
                                                                </h4> */}
                                                                <div className="space-y-2.5">
                                                                    {excludedFeatures.map((feature, idx) => (
                                                                        <div key={idx} className="flex items-start gap-3 group">
                                                                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                                                                                <X size={12} className="text-red-500 font-bold" />
                                                                            </div>
                                                                            <span className="text-sm text-slate-400  leading-relaxed">{feature.text}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}

                                            {/* <div className="mt-auto pt-0">
                                                <div className="mb-5">
                                                    <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
                                                        ₹{plan.price.toLocaleString()}
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-1">
                                                        + 18% GST = <span className="font-semibold text-slate-500">₹{gstTotal} total</span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setSelectedPlan(plan)}
                                                    className={`w-full py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 ${c.btn}`}
                                                >
                                                    Buy Now
                                                </button>
                                            </div> */}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* ── Payment History ──────────────────────────────────── */}
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-card">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-slate-800">Payment History</h3>
                                <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                                    <button
                                        onClick={() => handleTabChange('auto')}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeHistoryTab === 'auto'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Auto
                                    </button>
                                    <button
                                        onClick={() => handleTabChange('manual')}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeHistoryTab === 'manual'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Manual
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (activeHistoryTab === 'auto') fetchHistory();
                                    else fetchManualInvoices();
                                }}
                                className="text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors"
                            >
                                Refresh
                            </button>
                        </div>

                        {activeHistoryTab === 'auto' ? (
                            historyLoading ? (
                                <div className="flex items-center justify-center gap-2.5 py-14 text-slate-400">
                                    <Loader2 className="animate-spin" size={20} />
                                    Loading history…
                                </div>
                            ) : history.length === 0 ? (
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
                                            {history.map((sub) => {
                                                const gst = parseFloat((Number(sub.amount) * GST_RATE).toFixed(2));
                                                const total = (Number(sub.amount) + gst).toFixed(2);
                                                const isRazorpay = sub.transactionId?.startsWith('pay_');
                                                return (
                                                    <tr key={sub._id} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="px-6 py-4 font-semibold text-slate-800">{sub.planName}</td>
                                                        <td className="px-6 py-4 text-slate-600">₹{Number(sub.amount).toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-slate-600">₹{gst.toFixed(2)}</td>
                                                        <td className="px-6 py-4 font-bold text-slate-800">₹{total}</td>
                                                        <td className="px-6 py-4">
                                                            {sub.status === 'rejected' ? (
                                                                <span className="text-slate-300 text-xs">—</span>
                                                            ) : (
                                                                <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                                                    {sub.transactionId}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
                                                            {new Date(sub.createdAt).toLocaleString('en-IN', {
                                                                day: 'numeric', month: 'short', year: 'numeric',
                                                                hour: '2-digit', minute: '2-digit',
                                                            })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${sub.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                                sub.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                    'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {sub.status === 'approved' && <CheckCircle size={11} />}
                                                                {sub.status === 'pending' && <Clock size={11} />}
                                                                {sub.status === 'rejected' && <AlertCircle size={11} />}
                                                                {sub.status === 'rejected' ? 'Failed' : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {isRazorpay && sub.status === 'approved' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleViewInvoice(sub._id)}
                                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                                                    >
                                                                        <Eye size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDownloadInvoice(sub._id, sub.transactionId)}
                                                                        disabled={downloadingId === sub._id}
                                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-50"
                                                                    >
                                                                        {downloadingId === sub._id
                                                                            ? <Loader2 size={15} className="animate-spin" />
                                                                            : <Download size={15} />
                                                                        }
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 text-xs">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        ) : (
                            manualInvoicesLoading ? (
                                <div className="flex items-center justify-center gap-2.5 py-14 text-slate-400">
                                    <Loader2 className="animate-spin" size={20} />
                                    Loading invoices…
                                </div>
                            ) : manualInvoices.length === 0 ? (
                                <div className="py-16 text-center">
                                    <FileText className="text-slate-200 mx-auto mb-3" size={40} />
                                    <p className="text-slate-400 font-medium">No manual invoices</p>
                                    <p className="text-slate-300 text-sm mt-1">Invoices created by admin will appear here.</p>
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
                                                return (
                                                    <tr key={inv._id} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <span className="font-mono text-xs font-semibold text-slate-800">{inv.invoiceNumber}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            {inv.planName || inv.lineItems?.[0]?.description || '—'}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">₹{Number(inv.baseAmount).toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-slate-600">₹{gst.toFixed(2)}</td>
                                                        <td className="px-6 py-4 font-bold text-slate-800">₹{Number(inv.totalAmount).toFixed(2)}</td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs text-slate-600">{inv.paymentMethod || '—'}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
                                                            {new Date(inv.createdAt).toLocaleString('en-IN', {
                                                                day: 'numeric', month: 'short', year: 'numeric',
                                                                hour: '2-digit', minute: '2-digit',
                                                            })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${inv.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                {inv.status === 'active' ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                                                                {inv.status === 'active' ? 'Active' : 'Cancelled'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {inv.status === 'active' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleViewManualInvoice(inv._id)}
                                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                                                        title="View Invoice"
                                                                    >
                                                                        <Eye size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDownloadManualInvoice(inv._id, inv.invoiceNumber)}
                                                                        disabled={downloadingId === inv._id}
                                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-50"
                                                                        title="Download Invoice"
                                                                    >
                                                                        {downloadingId === inv._id
                                                                            ? <Loader2 size={15} className="animate-spin" />
                                                                            : <Download size={15} />
                                                                        }
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 text-xs">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}
                    </section>
                </main>
            </div>

            {/* ── Payment Modal ────────────────────────────────────────────── */}
            {selectedPlan && !paymentSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">

                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Complete Payment</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{canUseRazorpay ? 'Secured by Razorpay' : 'Payment'}</p>
                            </div>
                            <button
                                onClick={() => { if (!paymentLoading) setSelectedPlan(null); }}
                                disabled={paymentLoading}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-40"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">

                            {/* Plan chip */}
                            {(() => {
                                const c = getColors(selectedPlan.colorScheme);
                                return (
                                    <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${c.bg} ${c.border}`}>
                                        <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${c.accent}`}>
                                            <Zap size={18} className="text-white" fill="white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 truncate">{selectedPlan.title}</div>
                                            <div className={`text-sm font-semibold ${c.badge.split(' ')[1]}`}>
                                                {selectedPlan.credits.toLocaleString()} Credits
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-lg font-extrabold text-slate-800">₹{totalAmount}</div>
                                            <div className="text-xs text-slate-400">incl. GST</div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Price breakdown */}
                            <div className="bg-slate-50 rounded-xl px-4 py-3 grid grid-cols-3 text-sm text-center divide-x divide-slate-200">
                                <div><div className="text-slate-400 text-xs mb-0.5">Base Price</div><div className="font-semibold text-slate-700">₹{selectedPlan.price.toFixed(2)}</div></div>
                                <div><div className="text-slate-400 text-xs mb-0.5">GST (18%)</div><div className="font-semibold text-slate-700">₹{taxAmount.toFixed(2)}</div></div>
                                <div><div className="text-slate-400 text-xs mb-0.5">Total</div><div className="font-bold text-slate-900">₹{totalAmount}</div></div>
                            </div>

                            {/* ── GST Details (Required) ──────────────────── */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">

                                {/* Saved — read-only */}
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

                                {/* No GST yet — required */}
                                {!savedGst?.gstin && !gstEditing && (
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                            <FileText size={12} /> GST details are required before payment
                                        </span>
                                    </div>
                                )}

                                {/* Edit/Add form */}
                                {(gstEditing || !savedGst?.gstin) && (
                                    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-slate-100 bg-slate-50/50">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">GSTIN <span className="font-normal text-slate-400">— state &amp; PAN auto-fill</span></label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={gstForm.gstin}
                                                    onChange={e => handleGstinChange(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter' && gstForm.gstin.length === 15 && !gstinError) gstAutoFillRef.current?.click(); }}
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
                                                        setGstForm(f => ({
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
                                            <input type="text" value={gstForm.businessName} onChange={e => setGstForm(f => ({ ...f, businessName: e.target.value }))} placeholder="e.g. Hmsquare Solutions LLP"
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                                            <input type="text" value={gstForm.address} onChange={e => setGstForm(f => ({ ...f, address: e.target.value }))} placeholder="Billing address"
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400" />
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <p className="text-xs text-slate-400">Auto-saved to your profile after payment.</p>
                                            {gstEditing && (
                                                <button type="button" onClick={() => { setGstEditing(false); setGstinError(''); setGstForm({ businessName: savedGst?.businessName || '', gstin: savedGst?.gstin || '', pan: savedGst?.pan || '', address: savedGst?.address || '', state: savedGst?.state || '', stateCode: savedGst?.stateCode || '', phone: savedGst?.phone || '' }); }}
                                                    className="text-xs text-slate-500 hover:text-slate-700 font-medium">✕ Cancel</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pay button / restricted notice */}
                            {canUseRazorpay ? (
                                <>
                                    <button
                                        onClick={handleRazorpayPayment}
                                        disabled={paymentLoading || !!gstinError || gstLookupLoading || !gstForm.gstin || gstForm.gstin.length !== 15 || !gstForm.businessName}
                                        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md active:scale-[0.98] text-base"
                                    >
                                        {paymentLoading ? (
                                            <><Loader2 size={18} className="animate-spin" /> Processing…</>
                                        ) : (
                                            <><CreditCard size={18} /> Pay ₹{totalAmount}</>
                                        )}
                                    </button>

                                    {/* Trust row */}
                                    <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                                        <span className="flex items-center gap-1.5"><ShieldCheck size={12} /> 256-bit SSL</span>
                                        <span className="w-px h-3 bg-slate-200" />
                                        <span className="flex items-center gap-1.5"><BadgeCheck size={12} /> PCI DSS</span>
                                        <span className="w-px h-3 bg-slate-200" />
                                        <span className="flex items-center gap-1.5"><FileText size={12} /> GST Invoice</span>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-2">
                                    <AlertCircle size={28} className="text-amber-500 mx-auto" />
                                    <p className="text-amber-800 font-semibold text-sm">Razorpay payments are currently restricted</p>
                                    <p className="text-amber-600 text-xs">Please contact support to purchase credits or use the manual UPI transfer method.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Success Modal ────────────────────────────────────────────── */}
            {paymentSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center">
                        <div className="px-6 pt-10 pb-8 space-y-5">

                            <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                                <CheckCircle size={40} className="text-emerald-500" />
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Payment Successful!</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    <span className="font-bold text-emerald-600">
                                        {paymentSuccess.credits.toLocaleString()} credits
                                    </span>{' '}
                                    have been instantly added to your account.
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Receipt</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Plan</span>
                                    <span className="font-semibold text-slate-700">{paymentSuccess.planName}</span>
                                </div>
                                <div className="flex justify-between items-start text-sm gap-3">
                                    <span className="text-slate-500 flex-shrink-0">Payment ID</span>
                                    <span className="font-mono text-xs text-slate-600 text-right break-all">{paymentSuccess.paymentId}</span>
                                </div>
                                {paymentSuccess.invoiceNumber && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Invoice No.</span>
                                        <span className="font-semibold text-brand-600">{paymentSuccess.invoiceNumber}</span>
                                    </div>
                                )}
                            </div>

                            {paymentSuccess.invoiceNumber && (
                                <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                                    <FileText size={11} />
                                    Download your GST invoice from Payment History
                                </p>
                            )}

                            <button
                                onClick={() => setPaymentSuccess(null)}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Invoice View Modal ────────────────────────────────────────── */}
            {viewingInvoiceUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[96vh] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                            <h3 className="font-bold text-slate-800">Invoice</h3>
                            <button
                                onClick={closeInvoiceView}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 p-4 bg-slate-50">
                            <iframe
                                src={viewingInvoiceUrl + '#toolbar=0&navpanes=0'}
                                className="w-full h-full rounded-lg border border-slate-200"
                                title="Invoice PDF"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Verification overlay ─────────────────────────────────────── */}
            {paymentLoading && !selectedPlan && !paymentSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex items-center gap-4">
                        <Loader2 size={22} className="animate-spin text-brand-600" />
                        <div>
                            <div className="font-bold text-slate-800">Verifying Payment</div>
                            <div className="text-sm text-slate-400">Please wait…</div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default Subscription;
