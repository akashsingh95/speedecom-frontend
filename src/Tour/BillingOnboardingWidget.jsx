/* eslint-disable no-unused-vars -- client eslint config lacks react/jsx-uses-vars */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Sparkles, CreditCard, Check, Clock, AlertCircle, RefreshCw, X, ArrowRight, ShieldCheck,
    ChevronDown, ChevronUp,
} from 'lucide-react';

/**
 * Onboarding Status & Payment Progress Widget.
 *
 * Appears in the foreground after plan exploration finishes and during the payment flow:
 *   1. Select Plan: User evaluating tiers freely (no checkout modal open)
 *   2. Checkout: Plan selected, modal open with GST & billing details / verifying payment
 *   3. Activation: Backend verification confirmed, credits active in wallet
 *
 * Layering:
 *   - Rendered via React Portal into document.body with z-[10002]
 *   - Positioned in foreground above the payment modal backdrop (z-[9998]) so it is never dimmed
 */
const BillingOnboardingWidget = ({
    selectedPlan = null,
    paymentLoading = false,
    paymentStatus = 'idle', // 'idle' | 'checkout' | 'verifying' | 'cancelled' | 'failed'
    paymentSuccess = null,
    onReplayTour,
    onDismiss,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);

    // Active stage (1 to 3)
    const currentStage = paymentSuccess
        ? 3
        : (selectedPlan || paymentLoading || paymentStatus === 'verifying')
            ? 2
            : 1;

    const stages = [
        { num: 1, label: 'Select Plan' },
        { num: 2, label: 'Checkout' },
        { num: 3, label: 'Activation' },
    ];

    if (typeof document === 'undefined') return null;

    const positionClasses = 'fixed bottom-6 right-6 z-[10002] max-sm:bottom-4 max-sm:right-4 max-sm:left-4';

    // Collapsed / Minimized View
    if (isMinimized) {
        return createPortal(
            <div className={`${positionClasses} pointer-events-auto font-sans`}>
                <button
                    type="button"
                    onClick={() => setIsMinimized(false)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-white/95 backdrop-blur-md rounded-full shadow-[0_12px_32px_-5px_rgba(15,23,42,0.3),0_0_0_1px_rgba(255,255,255,0.9)] border border-slate-200/90 text-xs font-bold text-slate-800 hover:bg-slate-50 hover:text-brand-600 transition-all hover:scale-105 cursor-pointer group"
                    title="Expand onboarding progress widget"
                    aria-label="Expand onboarding progress widget"
                >
                    <Sparkles size={12} className="text-amber-500 shrink-0" />
                    <span>Onboarding Step {currentStage}/3</span>
                    <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-500 transition-colors">
                        • {stages[currentStage - 1]?.label}
                    </span>
                    <ChevronUp size={14} className="text-slate-400 group-hover:text-brand-600 ml-0.5 shrink-0" />
                </button>
            </div>,
            document.body,
        );
    }

    return createPortal(
        <aside
            aria-label="Billing onboarding progress"
            className={`${positionClasses} pointer-events-auto w-80 max-w-[calc(100vw-32px)] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_22px_50px_-10px_rgba(15,23,42,0.32),0_0_0_1px_rgba(255,255,255,0.9)] border border-slate-200/90 font-sans animate-in fade-in zoom-in-95 duration-200 overflow-hidden`}
        >
            {/* Top Accent Gradient Line */}
            <div
                className={`h-1.5 w-full transition-colors duration-300 ${
                    currentStage === 3
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600'
                        : 'bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600'
                }`}
            />

            <div className="p-4 space-y-3">
                {/* Header: Badge & Controls */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-brand-50 text-brand-700 border border-brand-200/70 shadow-xs">
                            <Sparkles size={10} className="text-amber-500 shrink-0" />
                            Onboarding Step {currentStage}/3
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {onReplayTour && (
                            <button
                                type="button"
                                onClick={onReplayTour}
                                title="Replay plan exploration tour"
                                aria-label="Replay plan exploration tour"
                                className="w-6 h-6 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <RefreshCw size={12} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsMinimized(true)}
                            title="Minimize widget"
                            aria-label="Minimize widget"
                            className="w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
                        >
                            <ChevronDown size={14} />
                        </button>
                        {onDismiss && (
                            <button
                                type="button"
                                onClick={onDismiss}
                                title="Dismiss onboarding widget"
                                aria-label="Dismiss onboarding widget"
                                className="w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 3-Stage Progression Dots */}
                <div className="flex items-center justify-between px-2">
                    {stages.map((stage) => {
                        const isDone = stage.num < currentStage || (currentStage === 3 && stage.num === 3);
                        const isCurrent = stage.num === currentStage && currentStage !== 3;
                        return (
                            <div key={stage.num} className="flex flex-col items-center gap-1">
                                <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                        isDone
                                            ? 'bg-emerald-500 text-white shadow-xs'
                                            : isCurrent
                                                ? 'bg-brand-600 text-white ring-2 ring-brand-300 animate-pulse'
                                                : 'bg-slate-100 text-slate-400'
                                    }`}
                                >
                                    {isDone ? <Check size={11} className="stroke-[3]" /> : stage.num}
                                </div>
                                <span
                                    className={`text-[9px] font-semibold ${
                                        isDone ? 'text-emerald-700' : isCurrent ? 'text-brand-700' : 'text-slate-400'
                                    }`}
                                >
                                    {stage.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* State Card & Feedback */}
                <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5">
                    {/* Stage 1: Select Plan */}
                    {currentStage === 1 && (
                        <>
                            <div className="flex items-center justify-between gap-2.5">
                                <span className="text-[11px] font-extrabold text-slate-800 leading-tight min-w-0">
                                    Choose Any Plan Matching Capacity
                                </span>
                                <div className="flex items-center justify-center shrink-0">
                                    <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-[9px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200/80 shadow-2xs leading-none">
                                        Awaiting Choice
                                    </span>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                                Review the tiers on your screen and click <strong className="text-slate-700 font-bold">Buy Now</strong> on whichever plan best fits your budget.
                            </p>
                        </>
                    )}

                    {/* Stage 2: Checkout or Payment Verification */}
                    {currentStage === 2 && (
                        <>
                            {paymentLoading || paymentStatus === 'verifying' ? (
                                <>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-purple-900 min-w-0">
                                            <Clock size={12} className="animate-spin text-purple-600 shrink-0" />
                                            Verifying Payment...
                                        </span>
                                        <div className="flex items-center justify-center shrink-0">
                                            <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200/80 animate-pulse leading-none">
                                                Processing
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-snug">
                                        Confirming transaction with gateway and verifying credit activation with backend...
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-extrabold text-slate-800 truncate min-w-0">
                                            Checkout: {selectedPlan?.title || 'Selected Plan'}
                                        </span>
                                        <div className="flex items-center justify-center shrink-0">
                                            <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 border border-brand-200/80 leading-none">
                                                Modal Open
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-snug">
                                        Total: <strong className="text-slate-800">₹{(selectedPlan ? (selectedPlan.price * 1.18).toFixed(2) : '0')}</strong> (incl. 18% GST). Fill billing details in the modal and proceed to pay.
                                    </p>
                                </>
                            )}
                        </>
                    )}

                    {/* Stage 3: Plan Activation */}
                    {currentStage === 3 && (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-900 min-w-0">
                                    <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                                    Plan Verified &amp; Active!
                                </span>
                                <div className="flex items-center justify-center shrink-0">
                                    <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/80 leading-none">
                                        Activated ✓
                                    </span>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug">
                                {paymentSuccess?.credits?.toLocaleString()} credits added for <strong className="text-emerald-950">{paymentSuccess?.planName}</strong>.
                            </p>
                        </>
                    )}

                    {/* Cancellation / Failure Warning Feedback */}
                    {paymentStatus === 'cancelled' && currentStage === 1 && (
                        <div className="pt-1 border-t border-amber-200/80 flex items-start gap-1.5 text-[10px] text-amber-700">
                            <AlertCircle size={12} className="shrink-0 text-amber-600 mt-0.5" />
                            <span>Payment was dismissed. You can review your details and retry whenever ready.</span>
                        </div>
                    )}

                    {paymentStatus === 'failed' && currentStage === 1 && (
                        <div className="pt-1 border-t border-red-200/80 flex items-start gap-1.5 text-[10px] text-red-600">
                            <AlertCircle size={12} className="shrink-0 text-red-500 mt-0.5" />
                            <span>Previous payment attempt failed. You can retry or choose another payment method.</span>
                        </div>
                    )}
                </div>

                {/* Footer Freedom Note */}
                <div className="text-[10px] text-slate-400 flex items-center justify-between px-0.5">
                    <span>✨ Any plan can be chosen</span>
                    {onReplayTour && (
                        <button
                            type="button"
                            onClick={onReplayTour}
                            className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                            <span>Re-explore</span>
                            <ArrowRight size={10} />
                        </button>
                    )}
                </div>
            </div>
        </aside>,
        document.body,
    );
};

export default BillingOnboardingWidget;

