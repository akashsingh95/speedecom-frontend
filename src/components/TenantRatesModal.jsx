/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see GiftCreditsModal.jsx). */
import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2, X, Tags } from 'lucide-react';
import api from '../api';
import { toast } from 'sonner';

/**
 * SuperAdmin re-rates the Speedy Listing plan credits a tenant currently holds, e.g. a tenant that
 * bought Basic gets charged at Premium's per-use rates. Only existing lots change — a later
 * purchase creates a lot at its own plan's rates and needs this applied again.
 */
const TenantRatesModal = ({ isOpen, onClose, tenant, onSuccess }) => {
    const [plans, setPlans] = useState([]);
    const [lots, setLots] = useState([]);
    const [planTitle, setPlanTitle] = useState('');
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const targetTenantId = tenant?.tenantId?._id;

    const fetchRates = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/listing-studio/wallet/admin/tenant-rates', { params: { tenantId: targetTenantId } });
            setPlans(data.plans || []);
            setLots(data.lots || []);
            setSelected((prev) => prev.filter((id) => (data.lots || []).some((lot) => lot.id === id)));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load Speedy Listing rates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && targetTenantId) {
            setPlanTitle('');
            setSelected([]);
            fetchRates();
        }
    }, [isOpen, targetTenantId]);

    const submit = async (path, body, fallbackError) => {
        setSaving(true);
        try {
            const { message } = await api.post(`/listing-studio/wallet/admin/tenant-rates/${path}`, { tenantId: targetTenantId, ...body });
            toast.success(message || 'Done');
            await fetchRates();
            onSuccess?.();
        } catch (error) {
            toast.error(error.response?.data?.message || fallbackError);
        } finally {
            setSaving(false);
        }
    };

    const toggleLot = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const selectedLots = lots.filter((lot) => selected.includes(lot.id));
    const canApply = selectedLots.some((lot) => lot.remainingCredits > 0);
    const canRestore = selectedLots.some((lot) => lot.rateOverride);
    const hasLiveLots = lots.some((lot) => lot.remainingCredits > 0);

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <Dialog.Title as="h3" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Tags className="text-brand-600" size={20} />
                                    Speedy Listing Usage Rates
                                </Dialog.Title>
                                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl mb-4">
                                <p className="font-semibold text-slate-800">{tenant?.tenantId?.name}</p>
                                <p className="text-xs text-slate-400">{tenant?.email}</p>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
                            ) : (
                                <>
                                    <p className="text-sm font-medium text-slate-700 mb-2">Select the credits to change</p>
                                    {lots.length === 0 ? (
                                        <p className="text-sm text-slate-500 mb-4">This tenant has no Speedy Listing plan credits left.</p>
                                    ) : (
                                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                                            {lots.map((lot) => (
                                                <label key={lot.id} className={`block border rounded-lg px-3 py-2 text-sm cursor-pointer ${selected.includes(lot.id) ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                                                            <input type="checkbox" checked={selected.includes(lot.id)} onChange={() => toggleLot(lot.id)} />
                                                            {lot.planTitle}
                                                            <span className="text-xs font-normal text-slate-400">bought {new Date(lot.purchasedAt).toLocaleDateString()}</span>
                                                        </span>
                                                        <span className="text-slate-500">{lot.remainingCredits} credits left</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Campaign {lot.campaignCost} · Image {lot.imageCost} · Video {lot.videoCost}
                                                        {lot.rateOverride && <span className="ml-2 text-brand-600 font-medium">at {lot.rateOverride.fromPlan} rates</span>}
                                                    </p>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {hasLiveLots && (
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Charge the selected credits at the rates of</label>
                                            <select value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500">
                                                <option value="">Select a plan…</option>
                                                {plans.map((p) => (
                                                    <option key={p.title} value={p.title}>{p.title} (campaign {p.campaignCost}, image {p.imageCost}, video {p.videoCost})</option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-slate-400 mt-2">Applies only to the credits you ticked. If the tenant buys a plan again, apply this again.</p>
                                        </div>
                                    )}

                                    <div className="flex gap-3 mt-6">
                                        {canRestore && (
                                            <button type="button" disabled={saving} onClick={() => submit('restore', { lotIds: selected }, 'Failed to restore rates')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50">
                                                Restore selected
                                            </button>
                                        )}
                                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">Close</button>
                                        {hasLiveLots && (
                                            <button type="button" disabled={saving || !planTitle || !canApply} onClick={() => submit('apply', { planTitle, lotIds: selected }, 'Failed to apply rates')} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                {saving ? <Loader2 className="animate-spin" size={18} /> : 'Apply rates'}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default TenantRatesModal;
