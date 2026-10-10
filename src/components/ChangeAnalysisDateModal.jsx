import React, { useState } from 'react';
import { X, Calendar, ChevronRight, AlertTriangle, CheckCircle, Loader2, ArrowLeft, Info } from 'lucide-react';
import api from '../api';
import MonthYearPicker from './MonthYearPicker';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function formatMonth(dateOrString) {
    const d = dateOrString instanceof Date ? dateOrString : new Date(dateOrString);
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatMonthKey(yyyyMM) {
    const [y, m] = yyyyMM.split('-');
    return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function formatCredits(amount) {
    return amount.toFixed(2);
}

// Step 1: Pick new date
function StepPickDate({ marketplaceName, currentAnalysisStartDate, selectedDate, onDateChange, onPreview, previewLoading, previewError }) {
    const currentDate = new Date(currentAnalysisStartDate);
    const maxYear = currentDate.getUTCFullYear();
    const minYear = maxYear - 5;

    // Validate: selected must be strictly before currentAnalysisStartDate
    const isValidDate = (() => {
        if (!selectedDate) return false;
        const [sy, sm] = selectedDate.split('-').map(Number);
        const cy = currentDate.getUTCFullYear();
        const cm = currentDate.getUTCMonth() + 1;
        return sy < cy || (sy === cy && sm < cm);
    })();

    return (
        <div className="space-y-5">
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1">Account</p>
                <p className="text-sm font-bold text-slate-800">{marketplaceName}</p>
            </div>

            <div className="flex items-center gap-3 text-sm">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Start</p>
                    <p className="font-bold text-slate-700">{formatMonth(currentAnalysisStartDate)}</p>
                </div>
                <ChevronRight size={18} className="text-slate-300 shrink-0" />
                <div className="flex-1 bg-white border-2 border-brand-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider mb-1">New Start</p>
                    <p className="font-bold text-brand-700">{selectedDate ? formatMonth(new Date(selectedDate + '-01')) : '—'}</p>
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Select New Start Month
                </label>
                <MonthYearPicker
                    value={selectedDate}
                    onChange={onDateChange}
                    minYear={minYear}
                    maxYear={maxYear}
                />
                {selectedDate && !isValidDate && (
                    <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Must be earlier than {formatMonth(currentAnalysisStartDate)}
                    </p>
                )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
                <Info size={15} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                    Credits will be charged for any uploaded orders in the gap months. Only orders already in the system are included.
                </p>
            </div>

            {previewError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {previewError}
                </p>
            )}

            <button
                onClick={onPreview}
                disabled={!isValidDate || previewLoading}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
            >
                {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                {previewLoading ? 'Calculating...' : 'Preview Credit Impact'}
            </button>
        </div>
    );
}

// Step 2: Show preview & confirm
function StepPreview({ preview, onConfirm, onBack, confirmLoading, confirmError }) {
    const willGoNegative = preview.currentBalance - preview.totalNetCost < 0;
    const hasChargeableMonths = preview.months.some(m => !m.alreadyCharged && m.newUniqueOrders > 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
                <Calendar size={14} className="text-brand-500" />
                <span>
                    Changing from <span className="font-bold text-slate-800">{formatMonth(preview.currentAnalysisStartDate)}</span>
                    {' '}to <span className="font-bold text-brand-700">{formatMonth(preview.newAnalysisStartDate)}</span>
                </span>
            </div>

            {preview.months.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <CheckCircle size={20} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-emerald-700">No uploaded data found in the gap months</p>
                    <p className="text-xs text-emerald-600 mt-1">The analysis start date will be updated at no credit cost.</p>
                </div>
            ) : (
                <>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Monthly Breakdown</p>
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Orders</th>
                                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Charge</th>
                                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Refund</th>
                                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Net</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {preview.months.map((m) => (
                                        <tr key={m.month} className={m.alreadyCharged ? 'opacity-50' : ''}>
                                            <td className="px-3 py-2.5 text-slate-700 font-medium">{formatMonthKey(m.month)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-600">{m.totalOrders.toLocaleString()}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-600">
                                                {m.alreadyCharged
                                                    ? <span className="text-xs text-slate-400 italic">—</span>
                                                    : `₹${formatCredits(m.grossCharge || m.creditCost || 0)}`
                                                }
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-slate-600">
                                                {m.alreadyCharged || !m.refundAmount
                                                    ? <span className="text-xs text-slate-400">—</span>
                                                    : <span className="text-emerald-600 font-medium">-₹{formatCredits(m.refundAmount)}</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                                                {m.alreadyCharged ? '—' : `₹${formatCredits(m.netCharge || m.creditCost || 0)}`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 border-t border-slate-200">
                                        <td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">Total</td>
                                        <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-600">₹{formatCredits(preview.totalGrossCost || 0)}</td>
                                        <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600">-₹{formatCredits(preview.totalRefunds || 0)}</td>
                                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">₹{formatCredits(preview.totalNetCost || preview.totalCreditCost || 0)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className={`rounded-xl p-3 border flex items-center justify-between ${willGoNegative ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-xs text-slate-600">Current Balance</span>
                        <span className={`text-sm font-bold ${preview.currentBalance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                            ₹{formatCredits(preview.currentBalance)}
                        </span>
                    </div>

                    {willGoNegative && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2.5">
                            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">
                                Your balance will go negative after this change. You can still proceed — purchase credits to restore your balance.
                            </p>
                        </div>
                    )}
                </>
            )}

            {confirmError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {confirmError}
                </p>
            )}

            <div className="flex gap-3">
                <button
                    onClick={onBack}
                    disabled={confirmLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl font-medium text-sm transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                    <ArrowLeft size={14} />
                    Back
                </button>
                <button
                    onClick={onConfirm}
                    disabled={confirmLoading}
                    className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                >
                    {confirmLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {confirmLoading
                        ? 'Updating...'
                        : hasChargeableMonths
                            ? `Confirm & Deduct ₹${formatCredits(preview.totalNetCost || preview.totalCreditCost || 0)}`
                            : 'Confirm Change'
                    }
                </button>
            </div>
        </div>
    );
}

// Step 3: Success
function StepSuccess({ result, newDate, onClose, onSuccess }) {
    return (
        <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <div>
                <p className="text-lg font-bold text-slate-800">Analysis Date Updated</p>
                <p className="text-sm text-slate-500 mt-1">
                    New start month: <span className="font-semibold text-brand-600">{formatMonth(new Date(newDate + '-01'))}</span>
                </p>
            </div>
            {(result.totalNetCost || result.totalCreditCost) > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    {(result.totalGrossCost || 0) > 0 && (
                        <div className="flex justify-between text-xs text-slate-600">
                            <span>Gross Charge:</span>
                            <span>₹{formatCredits(result.totalGrossCost || 0)}</span>
                        </div>
                    )}
                    {(result.totalRefunds || 0) > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600 font-medium">
                            <span>Tier Adjustment:</span>
                            <span>-₹{formatCredits(result.totalRefunds || 0)}</span>
                        </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between">
                        <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Net Charged</p>
                        <p className="text-lg font-bold text-slate-800">₹{formatCredits(result.totalNetCost || result.totalCreditCost || 0)}</p>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-2">
                        Across {result.months.length} month{result.months.length !== 1 ? 's' : ''}
                    </p>
                </div>
            )}
            {(result.totalNetCost || result.totalCreditCost) === 0 && (
                <p className="text-sm text-slate-500">No credits were charged — no new order data found in the gap months.</p>
            )}
            <button
                onClick={() => { onSuccess && onSuccess(); onClose(); }}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
            >
                Done
            </button>
        </div>
    );
}

const ChangeAnalysisDateModal = ({ marketplaceId, marketplaceName, currentAnalysisStartDate, onClose, onSuccess }) => {
    const [step, setStep] = useState('pick'); // 'pick' | 'preview' | 'success'
    const [selectedDate, setSelectedDate] = useState('');
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [confirmError, setConfirmError] = useState(null);

    const handlePreview = async () => {
        setPreviewError(null);
        setPreviewLoading(true);
        try {
            const { data } = await api.post(`/marketplaces/${marketplaceId}/analysis-date/preview`, {
                newAnalysisStartDate: selectedDate + '-01'
            });
            setPreview(data);
            setStep('preview');
        } catch (err) {
            setPreviewError(err.response?.data?.message || 'Failed to calculate preview. Please try again.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleConfirm = async () => {
        setConfirmError(null);
        setConfirmLoading(true);
        try {
            const { data } = await api.put(`/marketplaces/${marketplaceId}/analysis-date`, {
                newAnalysisStartDate: selectedDate + '-01'
            });
            setResult(data);
            setStep('success');
        } catch (err) {
            setConfirmError(err.response?.data?.message || 'Failed to update analysis start date. Please try again.');
        } finally {
            setConfirmLoading(false);
        }
    };

    const stepTitle = {
        pick: 'Change Analysis Start Date',
        preview: 'Credit Impact Preview',
        success: 'Update Complete'
    }[step];

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={step !== 'success' ? onClose : undefined}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-base font-bold text-slate-800">{stepTitle}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto custom-scrollbar max-h-[75vh]">
                    {step === 'pick' && (
                        <StepPickDate
                            marketplaceName={marketplaceName}
                            currentAnalysisStartDate={currentAnalysisStartDate}
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                            onPreview={handlePreview}
                            previewLoading={previewLoading}
                            previewError={previewError}
                        />
                    )}
                    {step === 'preview' && preview && (
                        <StepPreview
                            preview={preview}
                            onConfirm={handleConfirm}
                            onBack={() => setStep('pick')}
                            confirmLoading={confirmLoading}
                            confirmError={confirmError}
                        />
                    )}
                    {step === 'success' && result && (
                        <StepSuccess
                            result={result}
                            newDate={selectedDate}
                            onClose={onClose}
                            onSuccess={onSuccess}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChangeAnalysisDateModal;
