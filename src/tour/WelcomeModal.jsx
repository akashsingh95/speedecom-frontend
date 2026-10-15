import React from 'react';
import { Sparkles, ArrowRight, X, Layers, TrendingUp, ShieldAlert, Zap, CheckCircle2 } from 'lucide-react';

const WelcomeModal = ({ isOpen, onStartTour, onDismiss }) => {
    if (!isOpen) return null;

    const highlights = [
        {
            icon: Layers,
            color: 'from-blue-500 to-indigo-600',
            bg: 'bg-blue-50 border-blue-100 text-blue-700',
            title: 'Unified Marketplace Sync',
            desc: 'Connect Amazon, Flipkart, and Meesho in one unified portal to pull reports and settlements seamlessly.',
        },
        {
            icon: TrendingUp,
            color: 'from-emerald-500 to-teal-600',
            bg: 'bg-emerald-50 border-emerald-100 text-emerald-700',
            title: 'True SKU Profit Intelligence',
            desc: 'Calculate exact net margins per SKU factoring in commissions, courier weight charges, GST, and returns.',
        },
        {
            icon: ShieldAlert,
            color: 'from-amber-500 to-orange-600',
            bg: 'bg-amber-50 border-amber-100 text-amber-700',
            title: 'Returns & Leakage Shield',
            desc: 'Reconcile customer returns against courier handovers to detect missing units and file timely claims.',
        },
        {
            icon: Zap,
            color: 'from-purple-500 to-violet-600',
            bg: 'bg-purple-50 border-purple-100 text-purple-700',
            title: 'Flexible Credit Engine',
            desc: 'No heavy recurring subscriptions. SpeedEcom runs on flexible processing credits that you recharge on demand.',
        },
    ];

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-modal-title"
            onClick={onDismiss}
        >
            <div
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative background gradients */}
                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-700 opacity-95 pointer-events-none" />
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute top-8 left-1/4 w-32 h-32 bg-purple-400/20 rounded-full blur-xl pointer-events-none" />

                {/* Dismiss button */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss?.();
                    }}
                    className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-white/20 hover:bg-white/35 active:scale-90 text-white flex items-center justify-center transition-all backdrop-blur-md shadow-sm cursor-pointer pointer-events-auto"
                    aria-label="Close welcome introduction"
                    title="Close introduction"
                >
                    <X size={18} />
                </button>

                <div className="relative z-10 p-6 sm:p-8 pt-8 sm:pt-10">
                    {/* Header Badge & Title */}
                    <div className="flex items-center gap-2.5 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-white/20 text-white border border-white/30 backdrop-blur-md">
                            <Sparkles size={12} className="text-amber-300" />
                            Welcome to SpeedEcom Solutions
                        </span>
                    </div>

                    <h2
                        id="welcome-modal-title"
                        className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug drop-shadow-sm"
                    >
                        Your Ecommerce Profit & Reconciliation Engine
                    </h2>
                    <p className="text-white/80 text-sm mt-1.5 max-w-xl leading-relaxed">
                        Say goodbye to payment confusion and margin leakages. Let's take 2 minutes to fund your credits, connect your stores, and run your first profit report.
                    </p>

                    {/* Features Grid */}
                    <div className="mt-8 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                            Platform Highlights
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {highlights.map((item, idx) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={idx}
                                        className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-slate-50/50 flex items-start gap-3"
                                    >
                                        <div className={`w-9 h-9 rounded-lg ${item.bg} border flex items-center justify-center shrink-0 mt-0.5`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-bold text-slate-800 leading-snug">
                                                {item.title}
                                            </h4>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                {item.desc}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                            <span>Interactive step-by-step setup • Takes ~2 mins</span>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss?.();
                                }}
                                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            >
                                Explore on My Own
                            </button>

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStartTour?.();
                                }}
                                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-brand-600 via-brand-700 to-indigo-700 hover:from-brand-500 hover:to-indigo-600 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>Start Guided Onboarding</span>
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeModal;
