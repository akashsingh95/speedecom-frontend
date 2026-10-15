/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import {
    CheckCircle, Clock, AlertCircle, Loader2, RotateCcw,
    X, ShieldCheck, Zap, CreditCard, BadgeCheck, Download, Building2, FileText, Eye, Check, Sparkles,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useTour } from '../tour/TourProvider';
import { TOUR } from '../tour/targets';
import TourLauncher from '../tour/TourLauncher';
import { BILLING_TOUR } from '../tour/steps';
import BillingOnboardingWidget from '../tour/BillingOnboardingWidget';
import { toast } from 'sonner';
import { loadRazorpay } from '../utils/loadRazorpay';
import { parseGstin } from '../utils/gstinUtils';
import GstAutoFill from '../components/GstAutoFill';
import ListingStudioSubscriptionTab from '../components/ListingStudioSubscriptionTab';

const GST_RATE = Number(import.meta.env.VITE_GST_RATE || 18) / 100;

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const FALLBACK_PLANS = [
    {
        _id: 'fallback-basic-boost',
        title: 'Basic Boost',
        price: 5000,
        credits: 5000,
        description: 'Recharge your account with ₹5,000 and get the essentials to keep you going. Perfect for light users who need a quick balance top-up.',
        colorScheme: 'blue',
        displayOrder: 1,
        isActive: true,
        features: [
            'Unlimited AI-powered queries',
            'Access to all marketplaces data',
            'Pre-built FAQ templates',
            'Standard support',
            '30 days of Speedy AI access'
        ]
    },
    {
        _id: 'fallback-value-plus',
        title: 'Value Plus',
        price: 10000,
        credits: 10000,
        description: 'Top up with ₹10,000 for added flexibility and value. Designed for regular users who want more balance for their growing needs.',
        colorScheme: 'purple',
        displayOrder: 2,
        isActive: true,
        features: [
            'Unlimited AI-powered queries',
            'Multi-marketplace analysis',
            'Advanced FAQ templates',
            'Priority support',
            'Unlimited Speedy AI access',
            'Export results to CSV'
        ]
    },
    {
        _id: 'fallback-premium-power',
        title: 'Premium Power',
        price: 20000,
        credits: 20000,
        description: 'Power up your account with ₹20,000 for maximum flexibility. Ideal for heavy users with top-tier features.',
        colorScheme: 'orange',
        displayOrder: 3,
        isActive: true,
        features: [
            'Unlimited AI-powered queries',
            'Deep multi-marketplace analysis',
            'All premium FAQ templates',
            '24/7 Priority support',
            'Unlimited Speedy AI access',
            'Advanced exports & reports'
        ]
    }
];

const Subscription = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const {
        completeTourAction,
        currentStep,
        isRunning,
        runKey,
        billingOnboardingActive,
        setBillingOnboardingActive,
        completeBillingOnboarding,
        startHighlightingPlans,
        hasSeenBillingOnboarding,
        localKey,
    } = useTour() || {};

    const isTourActiveOnBilling = Boolean(
        isRunning && (
            runKey === 'tenant-onboarding' ||
            runKey === 'billing' ||
            currentStep?.route === '/subscription' ||
            currentStep?.id?.startsWith('bill-')
        )
    );

    const getTourStorageKey = useCallback((k) => {
        return localKey ? localKey(k) : (user?._id ? `tour:${user._id}:${k}` : `tour:${k}`);
    }, [localKey, user?._id]);

    const [activeProduct, setActiveProduct] = useState('reconciliation'); // 'reconciliation' | 'listing-studio'
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [manualInvoices, setManualInvoices] = useState([]);
    const [manualInvoicesLoading, setManualInvoicesLoading] = useState(true);

    // Payment modal
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle' | 'checkout' | 'verifying' | 'cancelled' | 'failed'
    const [paymentSuccess, setPaymentSuccess] = useState(null);
    const [isWidgetDismissed, setIsWidgetDismissed] = useState(false);

    useEffect(() => {
        if (isTourActiveOnBilling && selectedPlan) {
            setSelectedPlan(null);
        }
    }, [isTourActiveOnBilling, selectedPlan]);

    // Persisted billing onboarding state check
    const isBillingOnboardingDone = useMemo(() => {
        // 1. Check verified payment history (approved subscriptions or active invoices)
        const hasApprovedSub = (history || []).some((sub) => sub.status === 'approved' || sub.status === 'active');
        const hasActiveInvoice = (manualInvoices || []).some((inv) => inv.status === 'active');
        if (hasApprovedSub || hasActiveInvoice) return true;

        // 2. Tour state from provider
        if (hasSeenBillingOnboarding) return true;

        // 3. LocalStorage persistence
        try {
            if (
                localStorage.getItem(getTourStorageKey('billing_done')) === 'true' ||
                localStorage.getItem(getTourStorageKey('billing_onboarding_completed')) === 'true' ||
                localStorage.getItem(getTourStorageKey('tenant-onboarding')) === 'completed'
            ) {
                return true;
            }
        } catch { /* ignore */ }

        return false;
    }, [history, manualInvoices, hasSeenBillingOnboarding, getTourStorageKey]);

    // Clean up payment success modal on unmount to avoid stale popups
    useEffect(() => {
        return () => {
            setPaymentSuccess(null);
        };
    }, []);

    useEffect(() => {
        if (selectedPlan) {
            setIsWidgetDismissed(false);
        }
    }, [selectedPlan]);

    // ── GST smart card state ─────────────────────────────────────────────────
    const [savedGst, setSavedGst] = useState(null);   // loaded from profile
    const [gstEditing, setGstEditing] = useState(false);  // inline edit mode
    const [gstForm, setGstForm] = useState({ businessName: '', gstin: '', pan: '', address: '', state: '', stateCode: '', phone: '' });
    const [gstinError, setGstinError] = useState('');
    const [gstLookupLoading, setGstLookupLoading] = useState(false);
    const gstinInputRef = useRef(null);
    const gstinCursorRef = useRef(null);

    // Invoice download per row
    const [downloadingId, setDownloadingId] = useState(null);
    const gstAutoFillRef = useRef(null);
    const [viewingInvoiceUrl, setViewingInvoiceUrl] = useState(null);

    // Razorpay access control
    const [features, setFeatures] = useState({ razorpayEnabled: false, razorpayAllowedEmail: '' });

    useEffect(() => {
        fetchPlans();
        fetchHistory();
        fetchManualInvoices();
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

    useEffect(() => {
        if (!selectedPlan) {
            setGstEditing(false);
            setGstinError('');
            setPaymentStatus((prev) => (prev === 'checkout' ? 'idle' : prev));
        } else {
            setPaymentStatus('checkout');
        }
    }, [selectedPlan]);


    // GSTIN change handler — auto-fill state/PAN instantly
    const handleGstinChange = (e) => {
        const input = e.target;
        gstinInputRef.current = input;
        gstinCursorRef.current = input.selectionStart;
        const g = input.value.toUpperCase();
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

    useLayoutEffect(() => {
        if (gstinCursorRef.current !== null && gstinInputRef.current) {
            gstinInputRef.current.setSelectionRange(gstinCursorRef.current, gstinCursorRef.current);
        }
    }, [gstForm.gstin]);


    const fetchPlans = async () => {
        setPlansLoading(true);
        try {
            const { data } = await api.get('/credit-plans');
            if (data?.plans && data.plans.length > 0) {
                setPlans(data.plans);
            } else {
                setPlans(FALLBACK_PLANS);
            }
        } catch {
            setPlans(FALLBACK_PLANS);
        } finally {
            setPlansLoading(false);
        }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const [{ data }, { data: invoices }] = await Promise.all([
                api.get('/subscriptions/my-history'),
                api.get('/invoices/my', { params: { type: 'auto' } }),
            ]);
            // Gateway payments moved here from Speedy Listing have an invoice but no subscription row.
            // Shaped like a subscription (its invoice-linked id) so the existing row and invoice
            // buttons work unchanged.
            const known = new Set(data.flatMap((sub) => [String(sub._id), sub.transactionId]));
            const transferredIn = (invoices || [])
                .filter((inv) => inv.paymentCategory === 'RECONCILIATION' && inv.status === 'active' && !inv.createdBy?.email
                    && !known.has(String(inv.subscriptionId)) && !known.has(inv.paymentId))
                .map((inv) => ({
                    _id: inv.subscriptionId, planName: inv.planName || 'Payment Reconciliation Credits',
                    amount: inv.baseAmount, transactionId: inv.paymentId, status: 'approved', createdAt: inv.createdAt,
                }));
            setHistory([...data, ...transferredIn].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch {
            // toast handled by interceptor
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchManualInvoices = async () => {
        setManualInvoicesLoading(true);
        try {
            // type=manual only matches MANUAL- ids, which would miss admin invoices carrying a UTR
            // number; fetch all and apply the same rule as the Speedy Listing tab. Speedy Listing
            // invoices are listed on that product's own billing tab, not here.
            const { data } = await api.get('/invoices/my');
            setManualInvoices((data || []).filter((inv) => inv.paymentCategory !== 'LISTING_STUDIO'
                && (!!inv.createdBy?.email || String(inv.paymentId || '').startsWith('MANUAL-'))));
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

    const combinedHistory = useMemo(() => {
        const autoRows = history.map((sub) => {
            const gst = parseFloat((Number(sub.amount) * GST_RATE).toFixed(2));
            return {
                id: sub._id,
                type: 'auto',
                label: sub.planName,
                base: Number(sub.amount),
                gst,
                total: Number(sub.amount) + gst,
                reference: sub.status === 'rejected' ? null : sub.transactionId,
                paymentMethod: 'Razorpay',
                date: sub.createdAt,
                status: sub.status,
                isRazorpay: sub.transactionId?.startsWith('pay_'),
                failureReason: sub.failureReason || null,
                refundedAmount: sub.metadata?.refundedAmount ?? null,
                paymentCategory: 'RECONCILIATION',
            };
        });
        const manualRows = manualInvoices.map((inv) => ({
            id: inv._id,
            type: 'manual',
            label: inv.lineItems?.[0]?.description || inv.planName || '—',
            base: Number(inv.baseAmount),
            gst: inv.taxType === 'IGST' ? inv.igst : (inv.cgst + inv.sgst),
            total: Number(inv.totalAmount),
            reference: inv.invoiceNumber,
            paymentMethod: inv.paymentMethod || '—',
            date: inv.createdAt,
            status: inv.status,
            paymentCategory: inv.paymentCategory,
        }));
        return [...autoRows, ...manualRows].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [history, manualInvoices]);

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
                    setPaymentStatus('verifying');
                    try {
                        const verifyBody = {
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
                        };
                        // The server marks a response `retryable` while the payment isn't settled yet
                        // (not yet authorized, or authorized but the capture isn't confirmed) — retry a
                        // few times silently before letting the last attempt's error toast through.
                        const MAX_VERIFY_ATTEMPTS = 4;
                        let verifyRes;
                        for (let attempt = 1; ; attempt++) {
                            const isLastAttempt = attempt === MAX_VERIFY_ATTEMPTS;
                            try {
                                verifyRes = await api.post('/subscriptions/razorpay/verify-payment', verifyBody, { skipErrorToast: !isLastAttempt });
                                break;
                            } catch (err) {
                                // 409 (not yet authorized) or 502 (authorized but capture not confirmed yet)
                                const retryable = !!err?.response?.data?.retryable;
                                if (!retryable || isLastAttempt) {
                                    // Non-retryable errors on earlier attempts were silenced above.
                                    if (!isLastAttempt) toast.error(err?.response?.data?.message || 'Payment verification failed');
                                    throw err;
                                }
                                await new Promise(resolve => setTimeout(resolve, 3000));
                            }
                        }
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
                        const isFirstPayment = verifyRes?.data?.isFirstPayment ?? !isBillingOnboardingDone;

                        setSelectedPlan(null);
                        setPaymentStatus('idle');
                        fetchHistory();

                        if (isFirstPayment) {
                            try {
                                document.querySelectorAll('.razorpay-container').forEach(el => el.remove());
                            } catch { /* ignore */ }
                            try {
                                localStorage.setItem(getTourStorageKey('billing_done'), 'true');
                                localStorage.setItem(getTourStorageKey('billing_onboarding_completed'), 'true');
                                localStorage.removeItem(getTourStorageKey('billing_onboarding_active'));
                            } catch { /* ignore */ }
                            setPaymentSuccess(successData);
                            completeTourAction?.('billing', successData);
                            window.dispatchEvent(new CustomEvent('tour:action-completed', { detail: { action: 'billing', meta: successData } }));
                        } else {
                            setPaymentSuccess(null);
                            toast.success(`Payment verified! ${selectedPlan.credits.toLocaleString()} credits added to your account.`);
                        }
                    } catch {
                        setPaymentStatus('failed');
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
                modal: {
                    ondismiss: () => {
                        setPaymentLoading(false);
                        setPaymentStatus('cancelled');
                    },
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', async (response) => {
                setPaymentLoading(false);
                setPaymentStatus('failed');
                try {
                    await api.post('/subscriptions/razorpay/record-failed', {
                        orderId,
                        planName: selectedPlan.title,
                        amount: selectedPlan.price,
                        errorCode: response.error.code,
                        errorDescription: response.error.description,
                        errorReason: response.error.reason,
                        errorSource: response.error.source,
                        errorStep: response.error.step,
                        paymentId: response.error.metadata?.payment_id,
                    });
                    fetchHistory();
                } catch { /* best-effort failure record */ }
                toast.error(`Payment failed: ${response.error.description}`);
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
                <header data-tour={TOUR.billing.header} className="bg-slate-50 sticky top-0 z-10 px-8 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-heading font-bold text-slate-800">Subscription & Billing</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {canUseRazorpay
                                ? 'Pay instantly via Razorpay'
                                : 'Contact support to purchase credits'}
                        </p>
                    </div>
                    <TourLauncher tourKey={BILLING_TOUR} />
                </header>

                {/* ── Product tabs ─────────────────────────────────────────── */}
                <div className="px-8 pt-4 flex justify-center">
                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setActiveProduct('reconciliation')}
                            className={`px-5 py-2 text-sm font-bold rounded-lg transition-colors ${activeProduct === 'reconciliation' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Reconciliation
                        </button>
                        <button
                            onClick={() => setActiveProduct('listing-studio')}
                            className={`px-5 py-2 text-sm font-bold rounded-lg transition-colors ${activeProduct === 'listing-studio' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Speedy Listing
                        </button>
                    </div>
                </div>

                {activeProduct === 'listing-studio' ? (
                    <main className="flex-1 p-8 w-full overflow-y-auto custom-scrollbar">
                        <ListingStudioSubscriptionTab />
                    </main>
                ) : (
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
                        <section data-tour={TOUR.billing.plans}>
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
                                {[...plans].reverse().map((plan, idx) => {
                                    const c = getColors(plan.colorScheme);
                                    const gstTotal = (plan.price + plan.price * GST_RATE).toFixed(2);
                                    const planTitleLower = (plan.title || '').toLowerCase();
                                    const planTourTarget =
                                        planTitleLower.includes('basic') ? TOUR.billing.planBasic :
                                        planTitleLower.includes('value') ? TOUR.billing.planValue :
                                        planTitleLower.includes('premium') ? TOUR.billing.planPremium :
                                        (idx === 0 ? TOUR.billing.planPremium : idx === 1 ? TOUR.billing.planValue : TOUR.billing.planBasic);
                                    return (
                                        <div
                                            key={plan._id}
                                            data-tour={planTourTarget}
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
                                                                data-tour={TOUR.billing.buyBtn}
                                                                disabled={isTourActiveOnBilling}
                                                                onClick={() => {
                                                                    if (isTourActiveOnBilling) return;
                                                                    setSelectedPlan(plan);
                                                                }}
                                                                className={`w-full py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 shadow-sm ${
                                                                    isTourActiveOnBilling
                                                                        ? 'opacity-40 cursor-not-allowed pointer-events-none'
                                                                        : `hover:shadow-md active:scale-95 ${c.btn}`
                                                                }`}
                                                                title={isTourActiveOnBilling ? 'Explore all plans in the tour first' : 'Buy Now'}
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
                    <section data-tour={TOUR.billing.history} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-card">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">Payment History</h3>
                            <button
                                onClick={() => { fetchHistory(); fetchManualInvoices(); }}
                                className="text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors"
                            >
                                Refresh
                            </button>
                        </div>

                        {(historyLoading || manualInvoicesLoading) ? (
                            <div className="flex items-center justify-center gap-2.5 py-14 text-slate-400">
                                <Loader2 className="animate-spin" size={20} />
                                Loading history…
                            </div>
                        ) : combinedHistory.length === 0 ? (
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
                                            <th className="px-6 py-3">Plan / Description</th>
                                            <th className="px-6 py-3">Payment Category</th>
                                            <th className="px-6 py-3">Base</th>
                                            <th className="px-6 py-3">GST</th>
                                            <th className="px-6 py-3">Total</th>
                                            <th className="px-6 py-3">Reference</th>
                                            <th className="px-6 py-3">Payment Method</th>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Invoice</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {combinedHistory.map((row) => {
                                            const isCompleted = row.type === 'auto' ? row.status === 'approved' : row.status === 'active';
                                            const isRefunded = row.status === 'refunded';
                                            const isFailedOrCancelled = row.type === 'auto' ? row.status === 'rejected' : row.status === 'cancelled';
                                            const statusLabel = row.type === 'auto'
                                                ? (row.status === 'rejected' ? 'Failed' : row.status.charAt(0).toUpperCase() + row.status.slice(1))
                                                : (row.status === 'active' ? 'Active' : row.status === 'refunded' ? 'Refunded' : 'Cancelled');
                                            const canOpenInvoice = row.type === 'auto' ? (row.isRazorpay && isCompleted) : isCompleted;
                                            return (
                                                <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-6 py-4 font-semibold text-slate-800">{row.label}</td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        <span className="text-xs font-medium">
                                                            {row.paymentCategory === 'LISTING_STUDIO' ? 'Speedy Listing' : 'Reconciliation'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">₹{row.base.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-slate-600">₹{row.gst.toFixed(2)}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-800">₹{row.total.toFixed(2)}</td>
                                                    <td className="px-6 py-4">
                                                        {row.reference ? (
                                                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                                                {row.reference}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-600">{row.paymentMethod}</td>
                                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
                                                        {new Date(row.date).toLocaleString('en-IN', {
                                                            day: 'numeric', month: 'short', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit',
                                                        })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isCompleted ? 'bg-emerald-100 text-emerald-700' :
                                                            isRefunded ? 'bg-blue-100 text-blue-700' :
                                                                isFailedOrCancelled ? 'bg-red-100 text-red-700' :
                                                                    'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {isCompleted && <CheckCircle size={11} />}
                                                            {isRefunded && <RotateCcw size={11} />}
                                                            {!isCompleted && !isRefunded && !isFailedOrCancelled && <Clock size={11} />}
                                                            {isFailedOrCancelled && <AlertCircle size={11} />}
                                                            {statusLabel}
                                                        </span>
                                                        {row.type === 'auto' && isRefunded && row.refundedAmount != null && (
                                                            <p className="mt-1 text-[10px] text-blue-600">₹{Number(row.refundedAmount).toFixed(2)} refunded</p>
                                                        )}
                                                        {row.type === 'auto' && row.status === 'rejected' && row.failureReason && (
                                                            <div className="relative group mt-1 max-w-[140px]">
                                                                <p className="text-[10px] text-red-500 truncate cursor-help">
                                                                    {row.failureReason}
                                                                </p>
                                                                <div className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 z-20 w-60 rounded-lg bg-slate-800 px-3 py-2 text-[11px] leading-snug text-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
                                                                    {row.failureReason}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {canOpenInvoice ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => row.type === 'auto' ? handleViewInvoice(row.id) : handleViewManualInvoice(row.id)}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                                                >
                                                                    <Eye size={15} />
                                                                </button>
                                                                <button
                                                                    onClick={() => row.type === 'auto' ? handleDownloadInvoice(row.id, row.reference) : handleDownloadManualInvoice(row.id, row.reference)}
                                                                    disabled={downloadingId === row.id}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-50"
                                                                >
                                                                    {downloadingId === row.id
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
                        )}
                    </section>
                </main>
                )}
            </div>

            {/* ── Payment Modal ────────────────────────────────────────────── */}
            {selectedPlan && !isTourActiveOnBilling && !paymentSuccess && (
                <div data-tour={TOUR.billing.modal} className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div
                        data-tour-modal="checkout"
                        className={`relative z-[9999] bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden transition-transform duration-300 ${
                            isRunning ? 'md:-translate-x-[180px] lg:-translate-x-[200px]' : ''
                        }`}
                    >

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
                                                    onChange={handleGstinChange}
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
                                        data-tour={TOUR.billing.modalPayBtn}
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
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
                                    <AlertCircle size={28} className="text-amber-500 mx-auto" />
                                    <p className="text-amber-800 font-semibold text-sm">Razorpay payments are currently restricted</p>
                                    <p className="text-amber-600 text-xs">Please contact support to purchase credits or use the manual UPI transfer method.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Polished Congratulations Modal (Step 1 Complete) ────────────── */}
            {paymentSuccess && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative z-[9999] bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-center border border-emerald-100 animate-in zoom-in-95 duration-200 font-sans">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => {
                                const meta = paymentSuccess;
                                setPaymentSuccess(null);
                                try {
                                    localStorage.setItem(getTourStorageKey('billing_done'), 'true');
                                    localStorage.setItem(getTourStorageKey('billing_onboarding_completed'), 'true');
                                    localStorage.removeItem(getTourStorageKey('billing_onboarding_active'));
                                } catch { /* ignore */ }
                                completeBillingOnboarding?.(meta);
                                completeTourAction?.('billing', meta);
                            }}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer z-10"
                            title="Close"
                            aria-label="Close confirmation"
                        >
                            <X size={18} />
                        </button>

                        {/* Celebratory Gradient Banner */}
                        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />

                        <div className="px-7 pt-8 pb-7 space-y-4">
                            {/* Confetti / Sparkles Icon with Aura */}
                            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                                <Sparkles size={32} />
                            </div>

                            <div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                                    <Check size={12} className="stroke-[3]" />
                                    Step 1 Complete: Congratulations!
                                </span>
                                <h3 className="text-xl font-heading font-extrabold text-slate-900 mt-2.5">
                                    Payment Confirmed &amp; Plan Activated!
                                </h3>
                                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                                    <span className="font-extrabold text-emerald-600">
                                        {paymentSuccess.credits.toLocaleString()} credits
                                    </span>{' '}
                                    are active in your account wallet with zero expiry.
                                </p>
                            </div>

                            {/* Plan Receipt Box */}
                            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 border border-slate-100">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Activated Plan</span>
                                    <span className="font-extrabold text-slate-800">{paymentSuccess.planName}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Wallet Added</span>
                                    <span className="font-extrabold text-emerald-600">+{paymentSuccess.credits.toLocaleString()} Credits</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Payment ID</span>
                                    <span className="font-mono text-[11px] text-slate-600 truncate max-w-[180px]">{paymentSuccess.paymentId}</span>
                                </div>
                                {paymentSuccess.invoiceNumber && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Tax Invoice</span>
                                        <span className="font-semibold text-brand-600 font-mono text-[11px]">{paymentSuccess.invoiceNumber}</span>
                                    </div>
                                )}
                            </div>

                            {/* Guided Next Step Note */}
                            <div className="p-3.5 bg-brand-50/80 border border-brand-200/80 rounded-xl text-left text-xs space-y-1">
                                <div className="font-extrabold text-brand-900 flex items-center gap-1.5 text-xs">
                                    <Sparkles size={12} className="text-amber-500" />
                                    Next Onboarding Step:
                                </div>
                                <p className="text-slate-600 text-[11px] leading-relaxed">
                                    Connect your seller marketplace accounts (Flipkart, Amazon, Meesho, etc.) so SpeedEcom can start synchronizing orders and settlements.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2 pt-1">
                                <button
                                    onClick={() => {
                                        const meta = paymentSuccess;
                                        setPaymentSuccess(null);
                                        try {
                                            document.querySelectorAll('.razorpay-container').forEach(el => el.remove());
                                        } catch { /* ignore */ }
                                        try {
                                            localStorage.setItem(getTourStorageKey('billing_done'), 'true');
                                            localStorage.setItem(getTourStorageKey('billing_onboarding_completed'), 'true');
                                            localStorage.removeItem(getTourStorageKey('billing_onboarding_active'));
                                        } catch { /* ignore */ }
                                        completeBillingOnboarding?.(meta);
                                        completeTourAction?.('billing', meta);
                                        navigate('/settings/marketplace');
                                    }}
                                    className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold py-3.5 px-4 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>Continue to Marketplace Setup ➔</span>
                                </button>

                                <button
                                    onClick={() => {
                                        const meta = paymentSuccess;
                                        setPaymentSuccess(null);
                                        try {
                                            localStorage.setItem(getTourStorageKey('billing_done'), 'true');
                                            localStorage.setItem(getTourStorageKey('billing_onboarding_completed'), 'true');
                                            localStorage.removeItem(getTourStorageKey('billing_onboarding_active'));
                                        } catch { /* ignore */ }
                                        completeBillingOnboarding?.(meta);
                                        completeTourAction?.('billing', meta);
                                    }}
                                    className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors font-medium"
                                >
                                    Stay on Subscription &amp; Billing
                                </button>
                            </div>
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
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="relative z-[9999] bg-white rounded-2xl shadow-xl px-8 py-6 flex items-center gap-4 border border-slate-100">
                        <Loader2 size={22} className="animate-spin text-brand-600" />
                        <div>
                            <div className="font-bold text-slate-800">Verifying Payment</div>
                            <div className="text-sm text-slate-400">Please wait…</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Billing Onboarding & Payment Progress Widget ── */}
            {(!isBillingOnboardingDone && (billingOnboardingActive || !!paymentSuccess) && !isRunning && !isWidgetDismissed) && (
                <BillingOnboardingWidget
                    selectedPlan={selectedPlan}
                    paymentLoading={paymentLoading}
                    paymentStatus={paymentStatus}
                    paymentSuccess={paymentSuccess}
                    onReplayTour={() => {
                        setIsWidgetDismissed(false);
                        startHighlightingPlans?.();
                    }}
                    onDismiss={() => {
                        setIsWidgetDismissed(true);
                        setBillingOnboardingActive?.(false);
                        try {
                            localStorage.removeItem(getTourStorageKey('billing_onboarding_active'));
                        } catch { /* ignore */ }
                    }}
                />
            )}
        </DashboardLayout>
    );
};

export default Subscription;