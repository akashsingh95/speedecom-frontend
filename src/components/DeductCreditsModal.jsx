/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2, X, MinusCircle, Layers, Sparkles, Check } from 'lucide-react';
import api from '../api';
import { toast } from 'sonner';

const isValidAmount = (value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0;
const isValidCount = (value) => /^\d+$/.test(value) && Number(value) > 0;

const DeductCreditsModal = ({ isOpen, onClose, tenant, onSuccess }) => {
    const [product, setProduct] = useState('reconciliation'); // 'reconciliation' | 'listing-studio'
    const [amount, setAmount] = useState('');
    const [freeImages, setFreeImages] = useState('');
    const [freeVideos, setFreeVideos] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    const resetFields = () => { setProduct('reconciliation'); setAmount(''); setFreeImages(''); setFreeVideos(''); setNote(''); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const targetTenantId = tenant?.tenantId?._id;

        if (!targetTenantId) {
            toast.error('Tenant information is missing. Please reopen the modal and try again.');
            return;
        }

        if (product === 'reconciliation') {
            if (!isValidAmount(amount)) {
                toast.error('Please enter a valid amount (up to 2 decimal places)');
                return;
            }
        } else {
            const hasCredits = amount !== '';
            const hasImages = freeImages !== '';
            const hasVideos = freeVideos !== '';
            if (!hasCredits && !hasImages && !hasVideos) {
                toast.error('Deduct at least one of credits, free images, or free videos');
                return;
            }
            if ((hasCredits && !isValidAmount(amount)) || (hasImages && !isValidCount(freeImages)) || (hasVideos && !isValidCount(freeVideos))) {
                toast.error('Amounts must be positive numbers (whole numbers for free images/videos)');
                return;
            }
        }

        setLoading(true);
        try {
            if (product === 'reconciliation') {
                await api.post('/superadmin/credits/deduct', {
                    tenantId: targetTenantId,
                    amount: Number(amount),
                    note
                });
            } else {
                await api.post('/listing-studio/wallet/admin/deduct', {
                    tenantId: targetTenantId,
                    ...(amount !== '' && { credits: Number(amount) }),
                    ...(freeImages !== '' && { freeImages: Number(freeImages) }),
                    ...(freeVideos !== '' && { freeVideos: Number(freeVideos) }),
                    note,
                });
            }
            toast.success('Credits deducted successfully');
            resetFields();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Deduct credits error:', error);
            toast.error(error.response?.data?.message || 'Failed to deduct credits');
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = product === 'reconciliation'
        ? !!amount
        : !!(amount || freeImages || freeVideos);

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                <div className="flex justify-between items-center mb-6">
                                    <Dialog.Title as="h3" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <MinusCircle className="text-red-600" size={20} />
                                        Deduct Credits
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-xl mb-4">
                                        <p className="text-sm text-slate-500 mb-1">From Tenant</p>
                                        <p className="font-semibold text-slate-800">{tenant?.tenantId?.name}</p>
                                        <p className="text-xs text-slate-400">{tenant?.email}</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Deduct From <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setProduct('reconciliation')}
                                                className={`relative text-left p-3 rounded-xl border-2 transition-all ${product === 'reconciliation' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
                                            >
                                                {product === 'reconciliation' && <Check size={16} className="absolute top-2 right-2 text-red-600" />}
                                                <Layers size={18} className="text-slate-500 mb-1" />
                                                <p className="text-sm font-semibold text-slate-800">Reconciliation</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Deduct from account reconciliation balance</p>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setProduct('listing-studio')}
                                                className={`relative text-left p-3 rounded-xl border-2 transition-all ${product === 'listing-studio' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
                                            >
                                                {product === 'listing-studio' && <Check size={16} className="absolute top-2 right-2 text-red-600" />}
                                                <Sparkles size={18} className="text-slate-500 mb-1" />
                                                <p className="text-sm font-semibold text-slate-800">Listing Studio</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Deduct from Listing Studio credits/usage</p>
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">Choose which module this deduction is taken from.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            {product === 'reconciliation' ? <>Amount <span className="text-red-500">*</span></> : <>Credits (optional)</>}
                                        </label>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder={product === 'reconciliation' ? 'Enter credit amount' : 'Enter credits'}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                            min="0.01"
                                            step="0.01"
                                            inputMode="decimal"
                                        />
                                    </div>

                                    {product === 'listing-studio' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Free Images (optional)</label>
                                                <input
                                                    type="number"
                                                    value={freeImages}
                                                    onChange={(e) => setFreeImages(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                                    min="1"
                                                    step="1"
                                                    inputMode="numeric"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Free Videos (optional)</label>
                                                <input
                                                    type="number"
                                                    value={freeVideos}
                                                    onChange={(e) => setFreeVideos(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                                    min="1"
                                                    step="1"
                                                    inputMode="numeric"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Note (Optional)
                                        </label>
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Reason for deduction..."
                                            rows="3"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                                        />
                                    </div>

                                    <div className="flex gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !canSubmit || !tenant?.tenantId?._id}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Deduct Credits'}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default DeductCreditsModal;
