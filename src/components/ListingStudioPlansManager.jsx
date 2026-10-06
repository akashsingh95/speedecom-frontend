/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports (icons, ConfirmModal, the Field helper) false-positives as
   unused; same pre-existing pattern as CreditPlansManager.jsx, this component's template. */
import React, { useState, useEffect } from 'react';
import api from '../api';
import { Save, RefreshCw, Trash2, Plus, Package, ArrowLeft, ArrowRight, Sparkles, GripVertical, Copy } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from './ConfirmModal';

const colorOptions = [
    { value: 'blue', label: 'Blue' },
    { value: 'purple', label: 'Purple' },
    { value: 'orange', label: 'Orange' },
    { value: 'green', label: 'Green' },
    { value: 'red', label: 'Red' },
    { value: 'indigo', label: 'Indigo' },
    { value: 'pink', label: 'Pink' },
];

const NEW_PLAN = {
    title: 'New Plan', price: 5000, credits: 50, description: 'Plan description',
    colorScheme: 'blue', displayOrder: 1, isActive: true, features: [],
    campaignCost: 10, imageCost: 0.2, videoCost: 4, freeImagesIncluded: 0, freeVideosIncluded: 0,
};

/** Structural copy of CreditPlansManager.jsx, pointed at Speedy Listing's own catalog and
 *  carrying the three consumption rates + two free-allowance fields that plan has no use for
 *  (LISTING_STUDIO_PAYMENTS.md §1/§4). */
const ListingStudioPlansManager = ({ readOnly = false }) => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingIndex, setSavingIndex] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDirty, setIsDirty] = useState(false);
    const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
    const [validationError, setValidationError] = useState(null);
    const [unsavedChangesPlanIndex, setUnsavedChangesPlanIndex] = useState(null);
    const [pendingMove, setPendingMove] = useState(null);
    const [confirmDeleteFeature, setConfirmDeleteFeature] = useState(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/listing-studio/wallet/admin/plans/config');
            setPlans(data.config?.plans || []);
        } catch (error) {
            console.error('Error fetching Speedy Listing plan config:', error);
        } finally {
            setLoading(false);
        }
    };

    const NUMERIC_FIELDS = ['displayOrder', 'price', 'credits', 'campaignCost', 'imageCost', 'videoCost', 'freeImagesIncluded', 'freeVideosIncluded'];

    const handlePlanChange = (index, field, value) => {
        setIsDirty(true);
        setPlans((prev) => prev.map((plan, idx) => {
            if (idx !== index) return plan;
            return { ...plan, [field]: field === 'isActive' ? value : (NUMERIC_FIELDS.includes(field) ? Number(value) : value) };
        }));
    };

    const handleAddPlan = () => {
        setPlans((prev) => {
            const updated = [{ ...NEW_PLAN }, ...prev];
            return updated.map((plan, idx) => ({ ...plan, displayOrder: idx + 1 }));
        });
        setCurrentIndex(0);
    };

    const handleAddFeature = (planIndex) => {
        setIsDirty(true);
        setPlans((prev) => prev.map((plan, idx) => idx !== planIndex ? plan : { ...plan, features: [...(plan.features || []), ''] }));
    };

    const handleRemoveFeature = (planIndex, featureIndex) => {
        setConfirmDeleteFeature({ planIndex, featureIndex });
    };

    const handleEditFeature = (planIndex, featureIndex, newText) => {
        setIsDirty(true);
        setPlans((prev) => prev.map((plan, idx) => {
            if (idx !== planIndex) return plan;
            const newFeatures = [...(plan.features || [])];
            newFeatures[featureIndex] = newText;
            return { ...plan, features: newFeatures };
        }));
    };

    const handleDuplicatePlan = (index) => {
        setIsDirty(true);
        setPlans((prev) => {
            const copy = { ...prev[index], title: `${prev[index].title} (Copy)`, features: [...(prev[index].features || [])] };
            const updated = [...prev];
            updated.splice(index + 1, 0, copy);
            return updated.map((plan, idx) => ({ ...plan, displayOrder: idx + 1 }));
        });
        setCurrentIndex(index + 1);
    };

    const handleRemovePlan = (index) => setConfirmDeleteIndex(index);

    const handleConfirmFeature = async () => {
        if (!confirmDeleteFeature) return;
        const { planIndex, featureIndex } = confirmDeleteFeature;
        const updated = plans.map((plan, idx) => idx !== planIndex ? plan : { ...plan, features: (plan.features || []).filter((_, fIdx) => fIdx !== featureIndex) });
        setPlans(updated);
        setConfirmDeleteFeature(null);
        try {
            await api.post('/listing-studio/wallet/admin/plans/config', { plans: updated });
            toast.success('Benefit deleted successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete benefit');
        }
    };

    const handleConfirmDelete = async () => {
        if (confirmDeleteIndex === null) return;
        const updated = plans.filter((_, idx) => idx !== confirmDeleteIndex).map((plan, idx) => ({ ...plan, displayOrder: idx + 1 }));
        setPlans(updated);
        setCurrentIndex(0);
        setConfirmDeleteIndex(null);
        try {
            await api.post('/listing-studio/wallet/admin/plans/config', { plans: updated });
            toast.success('Plan deleted successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete plan');
        }
    };

    const handleMoveUp = () => {
        if (isDirty) { setUnsavedChangesPlanIndex(currentIndex); setPendingMove('up'); return; }
        setCurrentIndex((prev) => Math.max(0, prev - 1));
    };

    const handleMoveDown = () => {
        if (isDirty) { setUnsavedChangesPlanIndex(currentIndex); setPendingMove('down'); return; }
        setCurrentIndex((prev) => Math.min(plans.length - 1, prev + 1));
    };

    const validatePlan = (plan) => {
        if (!plan.title?.trim()) return setValidationError('Plan title is required'), false;
        if (!plan.description?.trim()) return setValidationError('Plan description is required'), false;
        if (plan.price === '' || Number(plan.price) <= 0) return setValidationError('Price must be greater than 0'), false;
        if (plan.credits === '' || Number(plan.credits) <= 0) return setValidationError('Credits must be greater than 0'), false;
        if (plan.campaignCost === '' || Number(plan.campaignCost) <= 0) return setValidationError('Cost per campaign must be greater than 0'), false;
        if (plan.imageCost === '' || Number(plan.imageCost) <= 0) return setValidationError('Cost per image must be greater than 0'), false;
        if (plan.videoCost === '' || Number(plan.videoCost) <= 0) return setValidationError('Cost per video must be greater than 0'), false;
        if (plan.features?.some((f) => (typeof f === 'string' ? !f.trim() : !f))) return setValidationError('Please enter feature details or remove empty feature fields'), false;
        return true;
    };

    const handleSaveSinglePlan = async (index) => {
        const plan = plans[index];
        if (!validatePlan(plan)) return;
        setSavingIndex(index);
        try {
            await api.post('/listing-studio/wallet/admin/plans/config', { plans });
            toast.success(`${plan.title} updated successfully!`);
            setIsDirty(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save plan');
        } finally {
            setSavingIndex(null);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-brand-600" size={40} /></div>;
    }

    const idx = currentIndex;
    const plan = plans[idx] || plans[0];

    return (
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Package size={20} className="text-brand-600" /> Speedy Listing Plans
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Manage plans, per-unit rates, and free allowances. Each plan has its own Save button.</p>
                    </div>
                    {!readOnly && (
                        <button onClick={handleAddPlan} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors shadow-md">
                            <Plus size={18} /> New Plan
                        </button>
                    )}
                </div>

                {plans.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
                        <Package size={48} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No plans found</p>
                    </div>
                ) : !plan ? null : (
                    <div className="bg-white border-2 border-slate-200 rounded-xl px-6 py-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-4 flex-1">
                                {!readOnly && (
                                    <button onClick={handleMoveUp} disabled={idx === 0} className="p-1 bg-brand-50 hover:bg-brand-300 disabled:opacity-50 rounded text-brand-600">
                                        <ArrowLeft size={14} />
                                    </button>
                                )}
                                <span className="text-xs font-bold text-slate-400">{idx + 1} / {plans.length}</span>
                                <input
                                    type="text" value={plan.title} disabled={readOnly}
                                    onChange={(e) => handlePlanChange(idx, 'title', e.target.value)}
                                    className="w-40 text-lg font-bold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-brand-300 focus:border-brand-600 outline-none disabled:cursor-default ml-2"
                                    placeholder="Plan name"
                                />
                                {!readOnly && (
                                    <button onClick={handleMoveDown} disabled={idx === plans.length - 1} className="p-1 bg-brand-100 hover:bg-brand-300 disabled:opacity-50 rounded text-brand-800">
                                        <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                            {!readOnly && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleDuplicatePlan(idx)} title="Duplicate Plan" className="px-1 py-1 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600">
                                        <Copy size={18} className="mr-1" /> Copy plan
                                    </button>
                                    <button onClick={() => handleRemovePlan(idx)} title="Delete Plan" className="px-1 py-1 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                            <Field label="Price (₹)" value={plan.price} disabled={readOnly} onChange={(v) => handlePlanChange(idx, 'price', v)} />
                            <Field label="Credits" value={plan.credits} disabled={readOnly} onChange={(v) => handlePlanChange(idx, 'credits', v)} />
                            <Field label="Cost / Campaign" value={plan.campaignCost} step="0.1" disabled={readOnly} onChange={(v) => handlePlanChange(idx, 'campaignCost', v)} />
                            <Field label="Cost / Image" value={plan.imageCost} step="0.01" disabled={readOnly} onChange={(v) => handlePlanChange(idx, 'imageCost', v)} />
                            <Field label="Cost / Video" value={plan.videoCost} step="0.1" disabled={readOnly} onChange={(v) => handlePlanChange(idx, 'videoCost', v)} />
                            <Field label="Free Images" value={plan.freeImagesIncluded} disabled={readOnly} onChange={(v) => handlePlanChange(idx, 'freeImagesIncluded', v)} />
                            <Field label="Free Videos" value={plan.freeVideosIncluded} disabled={readOnly} onChange={(v) => handlePlanChange(idx, 'freeVideosIncluded', v)} />
                            <div className="flex items-center gap-4">
                                <label className="w-28 text-[15px] font-semibold text-slate-700">Color</label>
                                <select value={plan.colorScheme} disabled={readOnly} onChange={(e) => handlePlanChange(idx, 'colorScheme', e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-1 text-[15px]">
                                    {colorOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="w-28 text-[15px] font-semibold text-slate-700">Active</label>
                                <button type="button" onClick={() => handlePlanChange(idx, 'isActive', !plan.isActive)} className={`relative h-6 w-10 rounded-full transition-all ${plan.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                    <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-all ${plan.isActive ? 'left-5' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 mb-3">
                            <label className="text-[15px] font-semibold text-slate-700">Description</label>
                            <textarea value={plan.description} disabled={readOnly} onChange={(e) => handlePlanChange(idx, 'description', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 mt-2" rows="2" />
                        </div>

                        <div className="mb-2 pb-2 border-b border-slate-100">
                            <label className="block font-semibold text-slate-600 mb-3 flex items-center gap-2">
                                <Sparkles size={14} className="text-yellow-500" /> Benefits
                            </label>
                            <div className="space-y-2 mb-3">
                                {(plan.features || []).map((feature, fIdx) => (
                                    <div key={fIdx} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 hover:border-blue-300 hover:shadow-sm">
                                        {!readOnly && <GripVertical size={16} className="text-slate-400" />}
                                        <input
                                            type="text" value={feature} disabled={readOnly}
                                            onChange={(e) => handleEditFeature(idx, fIdx, e.target.value)}
                                            placeholder="Feature name..."
                                            className="flex-1 text-sm bg-transparent focus:outline-none disabled:text-slate-500 border-0 text-slate-700 font-medium"
                                        />
                                        {!readOnly && (
                                            <button onClick={() => handleRemoveFeature(idx, fIdx)} className="px-1 py-1 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {!readOnly && (
                                <button onClick={() => handleAddFeature(idx)} className="w-full text-sm font-semibold text-brand-600 py-2 px-3 rounded-lg border border-dashed border-brand-300 hover:bg-brand-50 flex items-center justify-center gap-2">
                                    <Plus size={14} /> Add Feature
                                </button>
                            )}
                        </div>

                        {!readOnly && (
                            <div className="flex justify-end">
                                <button onClick={() => handleSaveSinglePlan(idx)} disabled={savingIndex === idx} className="flex items-center gap-2 bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 disabled:bg-slate-400 shadow-lg text-base">
                                    {savingIndex === idx ? <><RefreshCw size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save Plan</>}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {confirmDeleteIndex !== null && (
                <ConfirmModal isOpen onClose={() => setConfirmDeleteIndex(null)} onConfirm={handleConfirmDelete}
                    title="Delete Plan" message={`Are you sure you want to delete the plan "${plans[confirmDeleteIndex]?.title}"? This action cannot be undone.`}
                    confirmText="Delete" cancelText="Cancel" danger />
            )}

            {unsavedChangesPlanIndex !== null && (
                <ConfirmModal isOpen
                    onClose={() => { setUnsavedChangesPlanIndex(null); setPendingMove(null); }}
                    onConfirm={async () => {
                        await handleSaveSinglePlan(unsavedChangesPlanIndex);
                        if (pendingMove === 'up') setCurrentIndex((prev) => Math.max(0, prev - 1));
                        else if (pendingMove === 'down') setCurrentIndex((prev) => Math.min(plans.length - 1, prev + 1));
                        setUnsavedChangesPlanIndex(null); setPendingMove(null);
                    }}
                    onSecondary={() => {
                        fetchConfig();
                        if (pendingMove === 'up') setCurrentIndex((prev) => Math.max(0, prev - 1));
                        else if (pendingMove === 'down') setCurrentIndex((prev) => Math.min(plans.length - 1, prev + 1));
                        setUnsavedChangesPlanIndex(null); setPendingMove(null); setIsDirty(false);
                    }}
                    title="Unsaved Changes" message="You have unsaved changes. Would you like to save the plan before moving?"
                    confirmText="Save Changes" secondaryText="Discard Changes" cancelText="Cancel" />
            )}

            {validationError && (
                <ConfirmModal isOpen onClose={() => setValidationError(null)} onConfirm={() => setValidationError(null)} title="Validation Error" message={validationError} confirmText="OK" />
            )}

            {confirmDeleteFeature !== null && (
                <ConfirmModal isOpen onClose={() => setConfirmDeleteFeature(null)} onConfirm={handleConfirmFeature} title="Delete benefit" message="Are you sure you want to delete the benefit?" confirmText="OK" cancelText="Cancel" danger />
            )}
        </>
    );
};

const Field = ({ label, value, onChange, disabled, step }) => (
    <div className="flex items-center gap-4">
        <label className="w-28 text-[15px] font-semibold text-slate-700">{label}</label>
        <input
            type="number" step={step} value={value === 0 ? '' : value} disabled={disabled}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1 text-[15px]"
        />
    </div>
);

export default ListingStudioPlansManager;
