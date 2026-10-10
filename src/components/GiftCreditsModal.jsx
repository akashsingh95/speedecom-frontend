import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Gift, Loader2, X } from 'lucide-react';
import api from '../api';
import { toast } from 'sonner';

const GiftCreditsModal = ({ isOpen, onClose, tenant, onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    const isValidAmount = (value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const targetTenantId = tenant?.tenantId?._id;

        if (!targetTenantId) {
            toast.error('Tenant information is missing. Please reopen the modal and try again.');
            return;
        }

        if (!isValidAmount(amount)) {
            toast.error('Please enter a valid amount (up to 2 decimal places)');
            return;
        }

        setLoading(true);
        try {
            await api.post('/superadmin/credits/gift', {
                tenantId: targetTenantId,
                amount: Number(amount),
                note
            });
            toast.success('Credits added successfully');
            setAmount('');
            setNote('');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Gift credits error:', error);
            toast.error(error.response?.data?.message || 'Failed to gift credits');
        } finally {
            setLoading(false);
        }
    };

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
                                        <Gift className="text-brand-600" size={20} />
                                        Gift Credits
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-xl mb-4">
                                        <p className="text-sm text-slate-500 mb-1">To Tenant</p>
                                        <p className="font-semibold text-slate-800">{tenant?.tenantId?.name}</p>
                                        <p className="text-xs text-slate-400">{tenant?.email}</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Amount <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="Enter credit amount"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                                            min="0.01"
                                            step="0.01"
                                            inputMode="decimal"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Note (Optional)
                                        </label>
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Reason for adjustment..."
                                            rows="3"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
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
                                            disabled={loading || !amount || !tenant?.tenantId?._id}
                                            className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Add Credits'}
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

export default GiftCreditsModal;
