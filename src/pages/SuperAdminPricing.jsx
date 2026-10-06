/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect } from 'react';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';
import CreditPlansManager from '../components/CreditPlansManager';
import ListingStudioPlansManager from '../components/ListingStudioPlansManager';
import ListingStudioAddonManager from '../components/ListingStudioAddonManager';
import { Settings, Save, AlertCircle, Trash2, Plus, Info, DollarSign, Eye, Loader2, CreditCard, Layers, Sparkles, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';

const SuperAdminPricing = () => {
    const { user } = useAuth();
    const isReadOnly = user?.role === 'SBM';

    const [activeTab, setActiveTab] = useState('usage-pricing');
    const [pricing, setPricing] = useState({ tiers: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPricing();
    }, []);

    const fetchPricing = async () => {
        setLoading(true);
        try {
            const res = await api.get('/superadmin/pricing');
            // Ensure tiers exists
            setPricing(res.data?._id ? res.data : { tiers: [] });
        } catch (error) {
            console.error('Error fetching pricing:', error);
            // Global api.js handler shows the toast
        } finally {
            setLoading(false);
        }
    };

    const handleTierChange = (index, field, value) => {
        const newTiers = [...pricing.tiers];
        newTiers[index][field] = Number(value);
        setPricing({ ...pricing, tiers: newTiers });
    };

    const handleAddTier = () => {
        const newTiers = [...pricing.tiers];
        const lastTier = newTiers[newTiers.length - 1];
        const min = lastTier ? lastTier.max + 1 : 0;

        newTiers.push({
            min,
            max: min + 1000,
            price_1_acct: 0,
            price_2_acct: 0,
            price_3plus: 0
        });
        setPricing({ ...pricing, tiers: newTiers });
    };

    const handleRemoveTier = (index) => {
        const newTiers = [...pricing.tiers];
        newTiers.splice(index, 1);
        setPricing({ ...pricing, tiers: newTiers });
    };

    const handleSave = async () => {
        if (isReadOnly) return;
        setSaving(true);
        try {
            await api.put('/superadmin/pricing', {
                tiers: pricing.tiers,
                payPerOrderRate: pricing.payPerOrderRate,
                payPerOrderThreshold: pricing.payPerOrderThreshold
            });
            toast.success('Pricing matrix updated successfully');
        } catch (error) {
            console.error('Error saving pricing:', error);
            // Global api.js handler shows the toast
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 overflow-y-auto h-full custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* ═══════════════ HERO HEADER ═══════════════ */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-blue-800 rounded-2xl p-7 text-white shadow-lg">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                        <DollarSign size={20} className="text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold tracking-tight">Pricing Configuration</h1>
                                    {isReadOnly && (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/80 bg-white/15 border border-white/10 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                                            <Eye size={12} /> View Only
                                        </span>
                                    )}
                                </div>
                            </div>
                            {!isReadOnly && activeTab === 'usage-pricing' && !loading && pricing.tiers.length > 0 && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 text-sm font-semibold rounded-xl hover:bg-white/90 active:scale-95 transition-all duration-200 shadow-md shrink-0 disabled:opacity-60"
                                >
                                    <Save size={16} />
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ═══════════════ STATS ROW ═══════════════ */}
                    {!loading && activeTab === 'usage-pricing' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Total Slabs */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                                        <Layers size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">Volume slabs</span>
                                </div>
                                <p className="text-3xl font-bold text-slate-800">{pricing.tiers.length}</p>
                            </div>

                            {/* Pay-Per-Order Threshold */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                        <Settings size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">PPO threshold</span>
                                </div>
                                <p className="text-3xl font-bold text-slate-800">{(pricing.payPerOrderThreshold || 10000).toLocaleString()}</p>
                            </div>

                            {/* Pay-Per-Order Rate */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                        <CreditCard size={18} />
                                    </div>
                                    <span className="text-[13px] font-medium text-slate-500">PPO rate</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <p className="text-3xl font-bold text-slate-800">{pricing.payPerOrderRate || 0.10}</p>
                                    <span className="text-xs text-slate-400">credits/order</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════ MAIN CONTENT CARD ═══════════════ */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">

                        {/* Toolbar — tabs */}
                        <div className="px-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center">
                                <button
                                    onClick={() => setActiveTab('usage-pricing')}
                                    className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'usage-pricing'
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Settings size={16} />
                                    Usage Pricing Matrix
                                </button>
                                <button
                                    onClick={() => setActiveTab('credit-plans')}
                                    className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'credit-plans'
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <CreditCard size={16} />
                                    Credit Purchase Plans
                                </button>
                                <button
                                    onClick={() => setActiveTab('listing-studio-plans')}
                                    className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'listing-studio-plans'
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Sparkles size={16} />
                                    Speedy Listing Plans
                                </button>
                                <button
                                    onClick={() => setActiveTab('listing-studio-addons')}
                                    className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === 'listing-studio-addons'
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <PackagePlus size={16} />
                                    Speedy Listing Add-ons
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'usage-pricing' ? (
                            // Usage Pricing Matrix Content
                            loading ? (
                                <div className="flex flex-col items-center justify-center min-h-[400px]">
                                    <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
                                    <p className="text-slate-500">Loading pricing data...</p>
                                </div>
                            ) : pricing.tiers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                                    <div className="p-4 bg-slate-100 rounded-2xl">
                                        <Settings className="w-10 h-10 text-slate-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-slate-700">No pricing data found</p>
                                        <p className="text-sm text-slate-500 mt-1">Please seed the initial pricing matrix.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-0">
                                    {/* Volume Slabs Section */}
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                                                <Info size={15} className="text-slate-400" />
                                                Volume Slabs & Rates
                                            </h3>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={handleAddTier}
                                                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100 transition-colors"
                                                >
                                                    <Plus size={14} /> Add Slab
                                                </button>
                                            )}
                                        </div>

                                        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-slate-100 bg-slate-50/70">
                                                        <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Min Orders</th>
                                                        <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">Max Orders</th>
                                                        <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">1 Account</th>
                                                        <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">2 Accounts</th>
                                                        <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">3+ Accounts</th>
                                                        <th className="py-3.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {pricing.tiers.map((tier, idx) => (
                                                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="number"
                                                                    value={tier.min}
                                                                    onChange={(e) => handleTierChange(idx, 'min', e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default transition-all"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="number"
                                                                    value={tier.max}
                                                                    onChange={(e) => handleTierChange(idx, 'max', e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default transition-all"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="number"
                                                                    value={tier.price_1_acct}
                                                                    onChange={(e) => handleTierChange(idx, 'price_1_acct', e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default transition-all"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="number"
                                                                    value={tier.price_2_acct}
                                                                    onChange={(e) => handleTierChange(idx, 'price_2_acct', e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default transition-all"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="number"
                                                                    value={tier.price_3plus}
                                                                    onChange={(e) => handleTierChange(idx, 'price_3plus', e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default transition-all"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                {!isReadOnly && (
                                                                    <button
                                                                        onClick={() => handleRemoveTier(idx)}
                                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Pay-Per-Order Configuration */}
                                    <div className="border-t border-slate-100 p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                                <DollarSign size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-700 text-sm">High Volume Pricing (Pay-Per-Order)</h3>
                                                <p className="text-xs text-slate-500 mt-0.5">For accounts exceeding the threshold: <strong>total orders × rate</strong></p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                    Threshold (Orders)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={pricing.payPerOrderThreshold || 10000}
                                                    onChange={(e) => setPricing({ ...pricing, payPerOrderThreshold: Number(e.target.value) })}
                                                    disabled={isReadOnly}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default transition-all"
                                                    min="0"
                                                />
                                                <p className="text-xs text-slate-400 mt-2">Accounts above this threshold use pay-per-order pricing</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                    Rate (Credits per Order)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={pricing.payPerOrderRate || 0.10}
                                                    onChange={(e) => setPricing({ ...pricing, payPerOrderRate: Number(e.target.value) })}
                                                    disabled={isReadOnly}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-default transition-all"
                                                    min="0"
                                                />
                                                <p className="text-xs text-slate-400 mt-2">Cost per unique order for high-volume accounts</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pro Tip Footer */}
                                    <div className="border-t border-slate-100 px-6 py-4 bg-blue-50/50 flex gap-3 items-start">
                                        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                        <div className="text-xs text-blue-700">
                                            <span className="font-bold">Pro Tip:</span> Ensure slabs are continuous and non-overlapping. The system uses the first matching slab for billing.
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : activeTab === 'credit-plans' ? (
                            <div className="p-6">
                                <CreditPlansManager readOnly={isReadOnly} />
                            </div>
                        ) : activeTab === 'listing-studio-plans' ? (
                            <div className="p-6">
                                <ListingStudioPlansManager readOnly={isReadOnly} />
                            </div>
                        ) : (
                            <div className="p-6">
                                <ListingStudioAddonManager readOnly={isReadOnly} />
                            </div>
                        )}

                        {/* Footer */}
                        {activeTab === 'usage-pricing' && !loading && pricing.tiers.length > 0 && (
                            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <p className="text-xs text-slate-500">
                                    <span className="font-semibold text-slate-700">{pricing.tiers.length}</span> pricing slab{pricing.tiers.length !== 1 ? 's' : ''} configured
                                </p>
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-brand-600 font-semibold bg-brand-50 border border-brand-100 px-3 py-1 rounded-full">
                                    <Settings size={12} /> Usage Pricing
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default SuperAdminPricing;

