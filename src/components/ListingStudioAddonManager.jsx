/* eslint-disable no-unused-vars -- see ListingStudioPlansManager.jsx for why (JSX-only usage
   false-positives as unused under this client's eslint config). */
import React, { useState, useEffect } from 'react';
import api from '../api';
import { Save, RefreshCw, Trash2, Plus, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from './ConfirmModal';

const NEW_PACK = { title: 'New Add-on', price: 3000, credits: 30, imageCost: 0.22, isActive: true, displayOrder: 1 };

/** Much simpler sibling to ListingStudioPlansManager.jsx — add-on packs carry no campaign/video
 *  rate at all, they can never fund either (LISTING_STUDIO_PAYMENTS.md §1). One flat table
 *  rather than a per-plan card, saved as a whole array in one call. */
const ListingStudioAddonManager = ({ readOnly = false }) => {
    const [packs, setPacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
    const [validationError, setValidationError] = useState(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/listing-studio/wallet/admin/addons/config');
            setPacks(data.config?.packs || []);
        } catch (error) {
            console.error('Error fetching Speedy Listing add-on config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (index, field, value) => {
        setPacks((prev) => prev.map((pack, idx) => {
            if (idx !== index) return pack;
            const numeric = ['price', 'credits', 'imageCost', 'displayOrder'].includes(field);
            return { ...pack, [field]: field === 'isActive' ? value : (numeric ? Number(value) : value) };
        }));
    };

    const handleAdd = () => {
        setPacks((prev) => [...prev, { ...NEW_PACK, displayOrder: prev.length + 1 }]);
    };

    const handleRemove = (index) => setConfirmDeleteIndex(index);

    const handleConfirmDelete = () => {
        setPacks((prev) => prev.filter((_, idx) => idx !== confirmDeleteIndex).map((pack, idx) => ({ ...pack, displayOrder: idx + 1 })));
        setConfirmDeleteIndex(null);
    };

    const validate = () => {
        for (const pack of packs) {
            if (!pack.title?.trim()) return setValidationError('Every add-on pack needs a title'), false;
            if (!pack.price || pack.price <= 0) return setValidationError('Price must be greater than 0'), false;
            if (!pack.credits || pack.credits <= 0) return setValidationError('Credits must be greater than 0'), false;
            if (!pack.imageCost || pack.imageCost <= 0) return setValidationError('Cost per image must be greater than 0'), false;
        }
        return true;
    };

    const handleSaveAll = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await api.post('/listing-studio/wallet/admin/addons/config', { packs });
            toast.success('Add-on packs updated successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save add-on packs');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-brand-600" size={40} /></div>;
    }

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <PackagePlus size={20} className="text-brand-600" /> Speedy Listing Add-on Packs
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Image-only recharge packs — require an active plan, never fund a campaign or video.</p>
                    </div>
                    {!readOnly && (
                        <button onClick={handleAdd} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-700 shadow-md">
                            <Plus size={16} /> New Pack
                        </button>
                    )}
                </div>

                {packs.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-10 text-center text-slate-500 font-medium">No add-on packs found</div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600 text-left">
                                <tr>
                                    <th className="px-4 py-2 font-semibold">Title</th>
                                    <th className="px-4 py-2 font-semibold">Price (₹)</th>
                                    <th className="px-4 py-2 font-semibold">Credits</th>
                                    <th className="px-4 py-2 font-semibold">Cost / Image</th>
                                    <th className="px-4 py-2 font-semibold">Order</th>
                                    <th className="px-4 py-2 font-semibold">Active</th>
                                    {!readOnly && <th className="px-4 py-2"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {packs.map((pack, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-4 py-2">
                                            <input type="text" value={pack.title} disabled={readOnly} onChange={(e) => handleChange(idx, 'title', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" value={pack.price} disabled={readOnly} onChange={(e) => handleChange(idx, 'price', e.target.value)} className="w-24 rounded border border-slate-300 px-2 py-1" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" value={pack.credits} disabled={readOnly} onChange={(e) => handleChange(idx, 'credits', e.target.value)} className="w-20 rounded border border-slate-300 px-2 py-1" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" step="0.01" value={pack.imageCost} disabled={readOnly} onChange={(e) => handleChange(idx, 'imageCost', e.target.value)} className="w-20 rounded border border-slate-300 px-2 py-1" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" value={pack.displayOrder} disabled={readOnly} onChange={(e) => handleChange(idx, 'displayOrder', e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-1" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <button type="button" disabled={readOnly} onClick={() => handleChange(idx, 'isActive', !pack.isActive)} className={`relative h-6 w-10 rounded-full transition-all ${pack.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                                <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-all ${pack.isActive ? 'left-5' : ''}`} />
                                            </button>
                                        </td>
                                        {!readOnly && (
                                            <td className="px-4 py-2">
                                                <button onClick={() => handleRemove(idx)} className="p-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!readOnly && packs.length > 0 && (
                    <div className="flex justify-end">
                        <button onClick={handleSaveAll} disabled={saving} className="flex items-center gap-2 bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 disabled:bg-slate-400 shadow-lg">
                            {saving ? <><RefreshCw size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save All</>}
                        </button>
                    </div>
                )}
            </div>

            {confirmDeleteIndex !== null && (
                <ConfirmModal isOpen onClose={() => setConfirmDeleteIndex(null)} onConfirm={handleConfirmDelete}
                    title="Delete Add-on Pack" message={`Delete "${packs[confirmDeleteIndex]?.title}"? This only takes effect once you Save All.`}
                    confirmText="Delete" cancelText="Cancel" danger />
            )}

            {validationError && (
                <ConfirmModal isOpen onClose={() => setValidationError(null)} onConfirm={() => setValidationError(null)} title="Validation Error" message={validationError} confirmText="OK" />
            )}
        </>
    );
};

export default ListingStudioAddonManager;
