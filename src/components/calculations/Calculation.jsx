import React, { useState, useEffect } from 'react';
import { X, Calculator, ArrowRight, HelpCircle } from 'lucide-react';

const Calculation = ({ isOpen, onClose }) => {
    // Input states
    const [deliveredQty, setDeliveredQty] = useState('');
    const [returnQty, setReturnQty] = useState('');
    const [returnCharges, setReturnCharges] = useState('');
    const [productCost, setProductCost] = useState('');
    const [advertisementCost, setAdvertisementCost] = useState('');
    const [profitMargin, setProfitMargin] = useState('');

    // Calculation states
    const [isCalculating, setIsCalculating] = useState(false);
    const [results, setResults] = useState(null);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Automatic calculation logic when inputs change
    const runCalculation = (showLoader = false) => {
        const d = Number(deliveredQty) || 0;
        const r = Number(returnQty) || 0;
        const rc = Number(returnCharges) || 0;
        const pc = Number(productCost) || 0;
        const ac = Number(advertisementCost) || 0;
        const pm = Number(profitMargin) || 0;

        // Formula: ((txtReturnQty * txtReturnCharge) / txtDeliveredQty) + txtProductCost + txtAds + txtProfit
        const payment = d > 0 ? (((r * rc) / d) + pc + ac + pm) : 0;

        const data = {
            payment,
            breakdown: {
                deliveredQty: d,
                returnQty: r,
                productCostPerUnit: pc,
                returnChargesPerUnit: rc,
                adCost: ac,
                profitPerUnit: pm,
            }
        };

        if (showLoader) {
            setIsCalculating(true);
            setTimeout(() => {
                setResults(data);
                setIsCalculating(false);
            }, 300);
        } else {
            setResults(data);
        }
    };

    // Run calculation initially and on input changes
    useEffect(() => {
        runCalculation(false);
    }, [deliveredQty, returnQty, returnCharges, productCost, advertisementCost, profitMargin]);

    const handleCalculate = () => {
        runCalculation(true);
    };

    const handleReset = () => {
        setDeliveredQty('');
        setReturnQty('');
        setReturnCharges('');
        setProductCost('');
        setAdvertisementCost('');
        setProfitMargin('');
        setResults(null);
    };

    // Format currency
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(val);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modern Title Bar with Gradient */}
                <div className="bg-brand-700 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                            <Calculator size={18} className="text-brand-400" />
                        </div>
                        <div>
                            <h2 className="font-heading font-bold text-sm tracking-wide uppercase text-slate-200">
                                Price Calculator
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all focus:outline-none"
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Body Content */}
                <div
                    className="p-6 overflow-y-auto flex-1 m-0"
                >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                        {/* Left Column: Form Inputs (Col Span 7, 2-Column Grid) */}
                        <div className="md:col-span-7 flex flex-col gap-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h3 className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                                    Calculator Inputs
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold transition-colors"
                                >
                                    Clear Inputs
                                </button>
                            </div>

                            <div className="flex flex-col gap-y-3.5">
                                {/* Delivered Qty */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                        Delivered Qty
                                    </label>
                                    <div className="relative rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all bg-slate-50 focus-within:bg-white overflow-hidden shadow-sm">
                                        <input
                                            type="number"
                                            value={deliveredQty}
                                            onChange={(e) => setDeliveredQty(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-transparent border-0 text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-semibold"
                                            placeholder="e.g. 100"
                                        />
                                    </div>
                                </div>

                                {/* Customer Return */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                        Customer Return (Qty)
                                    </label>
                                    <div className="relative rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all bg-slate-50 focus-within:bg-white overflow-hidden shadow-sm">
                                        <input
                                            type="number"
                                            value={returnQty}
                                            onChange={(e) => setReturnQty(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-transparent border-0 text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-semibold"
                                            placeholder="e.g. 10"
                                        />
                                    </div>
                                </div>

                                {/* Return Charges */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                        Return Charges (₹)
                                    </label>
                                    <div className="relative rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all bg-slate-50 focus-within:bg-white overflow-hidden shadow-sm">
                                        <input
                                            type="number"
                                            value={returnCharges}
                                            onChange={(e) => setReturnCharges(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-transparent border-0 text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-semibold"
                                            placeholder="e.g. 180"
                                        />
                                    </div>
                                </div>

                                {/* Product Cost */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                        Product Cost (₹)
                                    </label>
                                    <div className="relative rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all bg-slate-50 focus-within:bg-white overflow-hidden shadow-sm">
                                        <input
                                            type="number"
                                            value={productCost}
                                            onChange={(e) => setProductCost(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-transparent border-0 text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-semibold"
                                            placeholder="e.g. 1"
                                        />
                                    </div>
                                </div>

                                {/* Advertisement Cost */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                        Ad Cost (₹)
                                    </label>
                                    <div className="relative rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all bg-slate-50 focus-within:bg-white overflow-hidden shadow-sm">
                                        <input
                                            type="number"
                                            value={advertisementCost}
                                            onChange={(e) => setAdvertisementCost(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-transparent border-0 text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-semibold"
                                            placeholder="e.g. 1"
                                        />
                                    </div>
                                </div>

                                {/* Profit Margin */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                        Profit Margin (₹)
                                    </label>
                                    <div className="relative rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all bg-slate-50 focus-within:bg-white overflow-hidden shadow-sm">
                                        <input
                                            type="number"
                                            value={profitMargin}
                                            onChange={(e) => setProfitMargin(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-transparent border-0 text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-semibold"
                                            placeholder="e.g. 50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Actions, Results & WhatsApp Support (Col Span 5) */}
                        <div className="md:col-span-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-4">
                                <div className="border-b border-slate-100 pb-2 justify-center flex">
                                    <h3 className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                                        Actions & Results
                                    </h3>
                                </div>

                                {/* Target Result Box */}
                                <div className="flex flex-col gap-3 items-center">
                                    <span className="text-xs font-bold tracking-wider uppercase text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1 rounded-md text-center">
                                        Payment Must Received In Bank
                                    </span>

                                    <div className="w-full relative rounded-2xl p-5 border-2 bg-brand-50/30 border-brand-200 shadow-inner min-h-[90px] flex flex-col items-center justify-center transition-all duration-300">
                                        {isCalculating ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-3 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
                                                <span className="text-[10px] text-brand-600 font-bold tracking-wide uppercase animate-pulse">
                                                    Calculating...
                                                </span>
                                            </div>
                                        ) : results ? (
                                            <div className="text-center animate-in fade-in duration-300">
                                                <span className="text-[11px] font-bold tracking-wider uppercase text-brand-600 block mb-1">
                                                    Payment Received
                                                </span>
                                                <span className="text-3xl font-extrabold text-brand-700 tracking-tight block">
                                                    {formatCurrency(results.payment)}
                                                </span>
                                                <span className="text-[10px] text-brand-600/80 font-bold block mt-1">
                                                    For {results.breakdown.deliveredQty} units
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="text-center text-slate-400">
                                                <span className="text-3xl font-extrabold text-slate-300 tracking-tight block">
                                                    {formatCurrency(0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Calculation;