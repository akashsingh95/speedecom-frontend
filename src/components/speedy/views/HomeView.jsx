import React from 'react';
import { BookOpen, MessageCircle, Zap, TrendingUp, ShieldCheck } from 'lucide-react';
import TrialOfferPopup from '../TrialOfferPopup';

const HomeView = ({ onBrowseFAQ, onAskCustom, userName }) => {
    const firstName = userName?.split(' ')[0] || 'there';

    return (
        <div className="p-5 flex flex-col gap-5">
            {/* Trial Offer Popup */}
            <TrialOfferPopup />

            {/* Welcome */}
            <div className="text-center pt-4 pb-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-3">
                    <Zap size={32} className="text-purple-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Hi {firstName}!</h2>
                <p className="text-sm text-gray-500 mt-1">
                    I'm Speedy — your e-commerce data assistant.
                    <br />What would you like to know?
                </p>
            </div>

            {/* Main action cards */}
            <div className="flex flex-col gap-3">
                <button
                    onClick={onBrowseFAQ}
                    className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-purple-100 hover:border-purple-400 hover:bg-purple-50 transition-smooth hover-lift text-left group animate-slideUp stagger-1"
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 group-hover:bg-purple-200 transition-smooth-fast">
                        <BookOpen size={20} className="text-purple-600" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800 text-sm">Browse FAQ Questions</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            80 pre-built questions across SKU, Ads, Returns, Payments and more
                        </p>
                    </div>
                </button>

                <button
                    onClick={onAskCustom}
                    className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 transition-smooth hover-lift text-left group animate-slideUp stagger-2"
                >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-200 transition-smooth-fast">
                        <MessageCircle size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800 text-sm">Ask a Custom Question</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Type any question — Speedy generates the query and answers it with AI
                        </p>
                    </div>
                </button>
            </div>

            {/* Quick capabilities */}
            <div className="mt-2 p-4 rounded-2xl bg-gray-50 border border-gray-100 animate-slideUp stagger-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What I can help with</p>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { icon: TrendingUp, label: 'SKU Profitability' },
                        { icon: ShieldCheck, label: 'Return Analysis' },
                        { icon: Zap, label: 'Ads Efficiency' },
                        { icon: BookOpen, label: 'Payment Insights' },
                    ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-2 text-xs text-gray-600">
                            <Icon size={14} className="text-purple-500 shrink-0" />
                            {label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomeView;
