import React, { useState, useEffect } from 'react';
import api from '../api';
import { Save, RefreshCw, Trash2, Plus, DollarSign, CreditCard, Package, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X, Check, Sparkles, ListOrdered, GripVertical, Copy } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from './ConfirmModal';

const CreditPlansManager = ({ readOnly = false }) => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingIndex, setSavingIndex] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDirty, setIsDirty] = useState(false);
    const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
    const [validationError, setValidationError] = useState(null);
    const [unsavedChangesPlanIndex, setUnsavedChangesPlanIndex] = useState(null);
    const [pendingMove, setPendingMove] = useState(null);
    const [showReorder, setShowReorder] = useState(false);
    const [orderSequence, setOrderSequence] = useState([0, 1, 2]);
    const [confirmDeleteFeature, setConfirmDeleteFeature] = useState(null);

    const colorOptions = [
        { value: 'blue', label: 'Blue' },
        { value: 'purple', label: 'Purple' },
        { value: 'orange', label: 'Orange' },
        { value: 'green', label: 'Green' },
        { value: 'red', label: 'Red' },
        { value: 'indigo', label: 'Indigo' },
        { value: 'pink', label: 'Pink' }
    ];

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/credit-plans/config');
            setPlans(data.config?.plans || []);
        } catch (error) {
            console.error('Error fetching config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlanChange = (index, field, value) => {
        setIsDirty(true);
        setPlans(prevPlans => prevPlans.map((plan, idx) => {
            if (idx !== index) return plan;
            return {
                ...plan,
                [field]: field === 'isActive' ? value : (
                    field === 'displayOrder' || field === 'price' || field === 'credits' ? Number(value) : value
                )
            };
        }));
    };

    const handleAddPlan = () => {
        setPlans(prevPlans => {
            const updatedPlans = [
                {
                    title: 'New Plan',
                    price: 5000,
                    credits: 5000,
                    description: 'Plan description',
                    colorScheme: 'blue',
                    displayOrder: 1,
                    isActive: true,
                    features: []
                },
                ...prevPlans
            ];
            return updatedPlans.map((plan, idx) => ({
                ...plan,
                displayOrder: idx + 1
            }));
        });

        setCurrentIndex(0);
    };

    const handleAddFeature = (planIndex) => {
        setIsDirty(true);
        setPlans(prevPlans => prevPlans.map((plan, idx) => {
            if (idx !== planIndex) return plan;
            return {
                ...plan,
                features: [...(plan.features || []), '']
            };
        }));
    };

    const handleRemoveFeature = (planIndex, featureIndex) => {

        setIsDirty(true);

        // setPlans(prevPlans => prevPlans.map((plan, idx) => {
        //     if (idx !== planIndex) return plan;
        //     return {
        //         ...plan,
        //         features: (plan.features || []).filter((_, fIdx) => fIdx !== featureIndex)
        //     };
        // }));

        setConfirmDeleteFeature({
            planIndex,
            featureIndex
        });

    };

    const handleEditFeature = (planIndex, featureIndex, newText) => {
        setIsDirty(true);
        setPlans(prevPlans => prevPlans.map((plan, idx) => {
            if (idx !== planIndex) return plan;
            const newFeatures = [...(plan.features || [])];
            newFeatures[featureIndex] = newText;
            return {
                ...plan,
                features: newFeatures
            };
        }));
    };

    const handleFeatureDragStart = (e, featureIndex) => {
        e.dataTransfer.setData("dragFeatureIndex", featureIndex);
    };

    const handleFeatureDrop = (e, planIndex, dropIndex) => {
        e.preventDefault();
        const dragIndex = Number(e.dataTransfer.getData("dragFeatureIndex"));

        if (isNaN(dragIndex) || dragIndex === dropIndex) return;

        setIsDirty(true);
        setPlans(prevPlans => prevPlans.map((plan, idx) => {
            if (idx !== planIndex) return plan;
            const newFeatures = [...(plan.features || [])];
            const [movedFeature] = newFeatures.splice(dragIndex, 1);
            newFeatures.splice(dropIndex, 0, movedFeature);
            return {
                ...plan,
                features: newFeatures
            };
        }));
    };

    const handleDuplicatePlan = (index) => {
        setIsDirty(true);
        setPlans(prevPlans => {
            const planToCopy = prevPlans[index];
            const newPlan = {
                ...planToCopy,
                title: `${planToCopy.title} (Copy)`,
                features: [...(planToCopy.features || [])]
            };

            const updatedPlans = [...prevPlans];
            updatedPlans.splice(index + 1, 0, newPlan);

            return updatedPlans.map((plan, idx) => ({
                ...plan,
                displayOrder: idx + 1
            }));
        });

        setCurrentIndex(index + 1);
    };

    const handleRemovePlan = (index) => {
        // setPlans(prevPlans => {
        //     const newPlans = prevPlans.filter((_, idx) => idx !== index);
        //     return newPlans.map((plan, idx) => ({
        //         ...plan,
        //         displayOrder: idx + 1
        //     }));
        // });
        setConfirmDeleteIndex(index);
    };

    const handleConfirmFeature = async () => {

        // setPlans(prevPlans => prevPlans.map((plan, idx) => {
        //     if (idx !== planIndex) return plan;
        //     return {
        //         ...plan,
        //         features: (plan.features || []).filter((_, fIdx) => fIdx !== featureIndex)
        //     };
        // }));

        if (!confirmDeleteFeature) return;

        const { planIndex, featureIndex } = confirmDeleteFeature;

        const updatedPlans = plans.map((plan, idx) => {
            if (idx !== planIndex) return plan;

            return {
                ...plan,
                features: (plan.features || []).filter((_, fIdx) => fIdx !== featureIndex)
            };
        });

        setPlans(updatedPlans);
        setConfirmDeleteFeature(null);

        try {
            await api.post('/credit-plans/config', { plans: updatedPlans });
            toast.success('Benefit deleted successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete benefit');
        }
    };

    const handleConfirmDelete = async () => {
        // setPlans(prevPlans => {
        //     const newPlans = prevPlans.filter((_, idx) => idx !== index);
        //     return newPlans.map((plan, idx) => ({
        //         ...plan,
        //         displayOrder: idx + 1
        //     }));
        // });
        if (confirmDeleteIndex === null) return;
        const index = confirmDeleteIndex;
        const updatedPlans = plans
            .filter((_, idx) => idx !== index)
            .map((plan, idx) => ({
                ...plan,
                displayOrder: idx + 1
            }));
        setPlans(updatedPlans);
        setCurrentIndex(0);
        setConfirmDeleteIndex(null);
        try {
            await api.post('/credit-plans/config', { plans: updatedPlans });
            toast.success('Subscription plan deleted successfully!');
        } catch (error) {
            console.error('Error deleting plan:', error);
            toast.error(error.response?.data?.message || 'Failed to delete plan');
        }
    };

    const handleMoveUp = () => {
        if (isDirty) {
            setUnsavedChangesPlanIndex(currentIndex);
            setPendingMove('up');
            return;
        }
        setCurrentIndex(prev => Math.max(0, prev - 1));
    };

    const handleMoveDown = () => {
        if (isDirty) {
            setUnsavedChangesPlanIndex(currentIndex);
            setPendingMove('down');
            return;
        }
        setCurrentIndex(prev => Math.min(plans.length - 1, prev + 1));
    };

    const validatePlan = (plan) => {
        if (!plan.title?.trim()) {
            setValidationError('Plan title is required');
            return false;
        }
        if (!plan.description?.trim()) {
            setValidationError('Plan description is required');
            return false;
        }
        if (plan.price === '' || Number(plan.price) <= 0) {
            setValidationError('Price must be greater than 0');
            return false;
        }
        if (plan.credits === '' || Number(plan.credits) <= 0) {
            setValidationError('Credits must be greater than 0');
            return false;
        }
        if (plan.features && plan.features.some(feature => {
            if (typeof feature === 'string') return !feature.trim();
            if (typeof feature === 'object' && feature !== null) return !feature.text?.trim();
            return !feature;
        })) {
            setValidationError('Please enter feature details or remove empty feature fields');
            return false;
        }
        return true;
    };

    const handleSaveSinglePlan = async (index) => {
        const plan = plans[index];

        if (!validatePlan(plan)) {
            return;
        }

        setSavingIndex(index);
        try {
            // API expects full plans array replacement on every update
            await api.post('/credit-plans/config', { plans });
            toast.success(`${plan.title} updated successfully!`);
            setIsDirty(false);
        } catch (error) {
            console.error('Error saving plan:', error);
            toast.error(error.response?.data?.message || 'Failed to save plan');
        } finally {
            setSavingIndex(null);
        }
    };

    // const handleDragStart = (e, index) => {
    //     e.dataTransfer.setData("dragIndex", index);
    // };

    // const handleDrop = (e, dropIndex) => {
    //     e.preventDefault();
    //     const dragIndex = Number(e.dataTransfer.getData("dragIndex"));

    //     if (isNaN(dragIndex) || dragIndex === dropIndex) return;
    //     const newSeq = [...orderSequence];

    //     const [movedIndex] = newSeq.splice(dragIndex, 1);
    //     newSeq.splice(dropIndex, 0, movedIndex);

    //     setOrderSequence(newSeq);
    // };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="animate-spin text-brand-600" size={40} />
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Package size={20} className="text-brand-600" />
                            Subscription Plans
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Manage plans and features. Each plan has its own Save button.
                        </p>
                    </div>
                    {!readOnly && (
                        <button
                            onClick={handleAddPlan}
                            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors shadow-md"
                        >
                            <Plus size={18} /> New Plan
                        </button>
                    )}
                </div>

                {/* {showReorder && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-slate-800 text-sm">Drag to Reorder Plans</h3>
                                <button
                                    onClick={() => setShowReorder(false)}
                                    className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {plans.map((p, i) => (
                                    <div
                                        key={i}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, i)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => handleDrop(e, i)}
                                        className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 hover:border-brand-400 rounded-xl cursor-grab active:cursor-grabbing transition-all text-xs font-semibold text-slate-700"
                                    >
                                        <span className="text-slate-400 font-bold">⋮⋮</span>
                                        <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                            #{i + 1}
                                        </span>
                                        <span className="truncate">{p.title || `Plan ${i + 1}`}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowReorder(false)}
                                className="w-full mt-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2 rounded-xl transition-all"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )} */}

                {/* Plans */}
                {plans.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
                        <Package size={48} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No plans found</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* {!readOnly && plans.length > 1 && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowReorder(true)}
                                    className="text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                                >
                                    <ListOrdered size={14} /> Reorder Plans Sequence
                                </button>
                            </div>
                        )} */}

                        {(() => {
                            const idx = currentIndex;
                            const plan = plans[idx] || plans[0];
                            if (!plan) return null;

                            return (
                                <div key={idx} className="bg-white border-2 border-slate-200 rounded-xl px-6 py-3 shadow-sm hover:shadow-md transition-shadow">
                                    {/* Header Row with Controls */}
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                        <div className="flex items-center gap-4 flex-1">
                                            {!readOnly && (
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={handleMoveUp}
                                                        disabled={idx === 0}
                                                        className="p-1 bg-brand-50 hover:bg-brand-300 disabled:opacity-50 rounded text-brand-600 cursor-pointer disabled:cursor-not-allowed"
                                                    >
                                                        <ArrowLeft size={14} />
                                                    </button>
                                                </div>
                                            )}

                                            <span className="text-xs font-bold text-slate-400">
                                                {idx + 1} / {plans.length}
                                            </span>

                                            <input
                                                type="text"
                                                value={plan.title}
                                                onChange={(e) => handlePlanChange(idx, 'title', e.target.value)}
                                                disabled={readOnly}
                                                className="w-40 text-lg font-bold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-brand-300 focus:border-brand-600 outline-none disabled:cursor-default ml-2"
                                                placeholder="Plan name"
                                            />

                                            {!readOnly && (
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={handleMoveDown}
                                                        disabled={idx === plans.length - 1}
                                                        className="p-1 bg-brand-100 hover:bg-brand-300 disabled:opacity-50 rounded text-brand-800 cursor-pointer disabled:cursor-not-allowed"
                                                    >
                                                        <ArrowRight size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {!readOnly && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleDuplicatePlan(idx)}
                                                    title="Duplicate Plan"
                                                    className="px-1 py-1 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 transition-all duration-200 hover:bg-blue-100 hover:text-blue-600"
                                                >
                                                    <Copy size={18} className='mr-1' /> Copy plan
                                                </button>
                                                <button
                                                    onClick={() => handleRemovePlan(idx)}
                                                    title="Delete Plan"
                                                    className="px-1 py-1 flex items-center justify-center rounded-lg bg-red-50 text-red-500 transition-all duration-200 hover:bg-red-100 hover:text-red-600"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Grid */}
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                                        <div className="flex items-center gap-4">
                                            <label className="w-20 text-[15px] font-semibold text-slate-700">Price (₹)</label>
                                            <input
                                                type="number"
                                                value={plan.price === 0 ? '' : plan.price}
                                                onChange={(e) => handlePlanChange(idx, 'price', e.target.value === '' ? '' : Number(e.target.value))}
                                                disabled={readOnly}
                                                className="flex-1 rounded-lg border border-slate-300 px-3 py-1 text-[15px]"
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="w-20 text-[15px] font-semibold text-slate-700">Credits</label>
                                            <input
                                                type="number"
                                                value={plan.credits === 0 ? '' : plan.credits}
                                                onChange={(e) => handlePlanChange(idx, 'credits', e.target.value === '' ? '' : Number(e.target.value))}
                                                disabled={readOnly}
                                                className="flex-1 rounded-lg border border-slate-300 px-3 py-1 text-[15px]"
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="w-20 text-[15px] font-semibold text-slate-700">Color</label>
                                            <select
                                                value={plan.colorScheme}
                                                onChange={(e) => handlePlanChange(idx, 'colorScheme', e.target.value)}
                                                disabled={readOnly}
                                                className="flex-1 rounded-lg border border-slate-300 px-3 py-1 text-[15px]"
                                            >
                                                {colorOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="w-20 text-[15px] font-semibold text-slate-700">
                                                Active
                                            </label>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handlePlanChange(idx, "isActive", !plan.isActive)
                                                }
                                                className={`relative h-6 w-10 rounded-full transition-all ${plan.isActive ? "bg-blue-600" : "bg-slate-300"
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-all ${plan.isActive ? "left-5" : ""
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="mt-3 mb-3">
                                        <label className="w-20 text-[15px] font-semibold text-slate-700">Description</label>
                                        <textarea
                                            value={plan.description}
                                            onChange={(e) => handlePlanChange(idx, 'description', e.target.value)}
                                            disabled={readOnly}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-slate-50 mt-2"
                                            rows="2"
                                        />
                                    </div>

                                    {/* Features */}
                                    <div className="mb-2 pb-2 border-b border-slate-100">
                                        <label className="block text-900 font-semibold text-slate-600 mb-3 flex items-center gap-2">
                                            <Sparkles size={14} className="text-yellow-500" />
                                            {/* Features */}
                                            Benefits
                                        </label>

                                        <div className="space-y-2 mb-3">
                                            {(plan.features || []).map((feature, fIdx) => {
                                                const featureStr = typeof feature === 'string' ? feature : String(feature || '');
                                                const isExcluded = featureStr.startsWith('EXCLUDE:');
                                                const featureText = isExcluded ? featureStr.replace('EXCLUDE:', '') : featureStr;

                                                return (
                                                    <div
                                                        key={fIdx}
                                                        draggable={!readOnly}
                                                        onDragStart={(e) => handleFeatureDragStart(e, fIdx)}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => handleFeatureDrop(e, idx, fIdx)}
                                                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 transition-all duration-200 hover:border-blue-300 hover:shadow-sm"
                                                    >
                                                        {!readOnly && (
                                                            <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 flex items-center justify-center">
                                                                <GripVertical size={16} />
                                                            </div>
                                                        )}
                                                        <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${isExcluded ? "bg-red-100" : "bg-green-100"}`}>
                                                            {isExcluded ? <X size={14} className="text-red-600" /> : <Check size={14} className="text-green-600" />}
                                                        </div>
                                                        <select
                                                            value={isExcluded ? "exclude" : "include"}
                                                            onChange={(e) => {
                                                                const isInclude = e.target.value === "include";
                                                                const newFeatureText = isInclude ? featureText : `EXCLUDE:${featureText}`;
                                                                handleEditFeature(idx, fIdx, newFeatureText);
                                                            }}
                                                            disabled={readOnly}
                                                            className={`text-xs font-bold rounded px-2 py-1 pr-6 border outline-none cursor-pointer ${isExcluded ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}
                                                        >
                                                            <option value="include">Include Feature</option>
                                                            <option value="exclude">Not Include Feature</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            value={featureText}
                                                            onChange={(e) => {
                                                                const newText = isExcluded ? `EXCLUDE:${e.target.value}` : e.target.value;
                                                                handleEditFeature(idx, fIdx, newText);
                                                            }}
                                                            disabled={readOnly}
                                                            placeholder="Feature name..."
                                                            className={`flex-1 text-sm bg-transparent focus:outline-none disabled:text-slate-500 border-0 ${isExcluded ? "text-slate-400" : "text-slate-700 font-medium"}`}
                                                        />
                                                        {!readOnly && (
                                                            <button
                                                                onClick={() => handleRemoveFeature(idx, fIdx)}
                                                                className="px-1 py-1 flex items-center justify-center rounded-lg bg-red-50 text-red-500 transition-all duration-200 hover:bg-red-100 hover:text-red-600"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {!readOnly && (
                                            <button
                                                onClick={() => handleAddFeature(idx)}
                                                className="w-full text-sm font-semibold text-brand-600 py-2 px-3 rounded-lg border border-dashed border-brand-300 hover:bg-brand-50 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Plus size={14} /> Add Feature
                                            </button>
                                        )}
                                    </div>

                                    {/* SAVE BUTTON */}
                                    {!readOnly && (
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleSaveSinglePlan(idx)}
                                                disabled={savingIndex === idx}
                                                className="flex items-center gap-2 bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl text-base"
                                            >
                                                {savingIndex === idx ? (
                                                    <>
                                                        <RefreshCw size={18} className="animate-spin" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save size={18} />
                                                        Save Plan
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {confirmDeleteIndex !== null && (
                <ConfirmModal
                    isOpen={true}
                    onClose={() => setConfirmDeleteIndex(null)}
                    onConfirm={handleConfirmDelete}
                    title="Delete Subscription Plan"
                    message={`Are you sure you want to delete the plan "${plans[confirmDeleteIndex]?.title}"? This action cannot be undone.`}
                    confirmText="Delete"
                    cancelText="Cancel"
                    danger={true}
                />
            )}

            {/* Unsaved changes modal */}
            {unsavedChangesPlanIndex !== null && (
                <ConfirmModal
                    isOpen={true}
                    onClose={() => {
                        setUnsavedChangesPlanIndex(null);
                        setPendingMove(null);
                    }}
                    onConfirm={async () => {
                        await handleSaveSinglePlan(unsavedChangesPlanIndex);
                        // after save, perform pending move
                        if (pendingMove === 'up') {
                            setCurrentIndex(prev => Math.max(0, prev - 1));
                        } else if (pendingMove === 'down') {
                            setCurrentIndex(prev => Math.min(plans.length - 1, prev + 1));
                        }
                        setUnsavedChangesPlanIndex(null);
                        setPendingMove(null);
                    }}
                    onSecondary={() => {
                        // Discard changes and move to next plan
                        fetchConfig();
                        if (pendingMove === 'up') {
                            setCurrentIndex(prev => Math.max(0, prev - 1));
                        } else if (pendingMove === 'down') {
                            setCurrentIndex(prev => Math.min(plans.length - 1, prev + 1));
                        }
                        setUnsavedChangesPlanIndex(null);
                        setPendingMove(null);
                        setIsDirty(false);
                    }}
                    title="Unsaved Changes"
                    message="You have unsaved changes. Would you like to save the plan before moving?"
                    confirmText="Save Changes"
                    secondaryText="Discard Changes"
                    cancelText="Cancel"
                />
            )}

            {/* Validation error modal */}
            {validationError && (
                <ConfirmModal
                    isOpen={true}
                    onClose={() => setValidationError(null)}
                    onConfirm={() => setValidationError(null)}
                    title="Validation Error"
                    message={validationError}
                    confirmText="OK"
                />
            )}

            {confirmDeleteFeature !== null && (
                <ConfirmModal
                    isOpen={true}
                    onClose={() => setConfirmDeleteFeature(null)}
                    onConfirm={handleConfirmFeature}
                    title="Delete benefit"
                    message="Are you sure you want to delete the benefit?"
                    confirmText="OK"
                    cancelText="Cancel"
                    danger={true}
                />
            )}
        </>
    );
};

export default CreditPlansManager;
