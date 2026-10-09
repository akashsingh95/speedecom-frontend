/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Gift, Loader2, X, Layers, Sparkles, Check } from 'lucide-react';
import api from '../api';
import { toast } from 'sonner';

const isValidAmount = (value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0;
const isValidCount = (value) => /^\d+$/.test(value) && Number(value) > 0;

const AdminGiftModal = ({ isOpen, onClose, onSuccess }) => {
    const [product, setProduct] = useState('reconciliation'); // 'reconciliation' | 'listing-studio'
    const [amount, setAmount] = useState('');
    const [freeImages, setFreeImages] = useState('');
    const [freeVideos, setFreeVideos] = useState('');
    const [note, setNote] = useState('');
    const [plans, setPlans] = useState([]);
    const [planTitle, setPlanTitle] = useState('');
    const [planTouched, setPlanTouched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [tenantQuery, setTenantQuery] = useState('');
    const [tenants, setTenants] = useState([]);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const [allTenants, setAllTenants] = useState([]);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isOpen || product !== 'listing-studio') return;
        const loadPlans = async () => {
            try {
                const { data } = await api.get('/listing-studio/wallet/admin/plans/config');
                const active = (data.config?.plans || []).filter((p) => p.isActive).sort((a, b) => a.price - b.price);
                setPlans(active);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to load Listing Studio plans');
            }
        };
        loadPlans();
    }, [isOpen, product]);

    // The CATEGORY (which plan the gift is tagged/filtered under) is always decided by price — an
    // exact plan price matches that plan; otherwise the highest active plan priced at or below the
    // amount; otherwise the cheapest plan. Mirrors the server's resolveListingStudioFreeTrialPlan and
    // is never overridable — this is what the amount field's preview text shows.
    const categoryPlan = (() => {
        if (!isValidAmount(amount) || plans.length === 0) return null;
        const amt = Number(amount);
        const exact = plans.find((p) => p.price === amt);
        if (exact) return { plan: exact, exact: true };
        const base = [...plans].reverse().find((p) => p.price <= amt);
        return { plan: base || plans[0], exact: false };
    })();

    // The "Charge credits at rates of" dropdown only ever picks which plan's usage RATES apply —
    // independent of category. It defaults to (and keeps following) the category plan's own rates
    // until the admin manually picks a different one, which then sticks.
    useEffect(() => {
        if (planTouched || !categoryPlan) return;
        setPlanTitle(categoryPlan.plan.title);
    }, [categoryPlan, planTouched]);

    const searchTenants = useCallback(async (q) => {
        setSearching(true);
        try {
            const url = q ? `/admin/invoices/buyers?q=${encodeURIComponent(q)}` : '/admin/invoices/buyers';
            const { data } = await api.get(url);
            const tenantList = data || [];
            setAllTenants(tenantList);
            
            if (!q.trim()) {
                setTenants(tenantList.slice(0, 6));
            } else {
                setTenants(tenantList);
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Failed to search tenants');
            setTenants([]);
        } finally {
            setSearching(false);
        }
    }, []);

    const updateDropdownPosition = () => {
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
    };

    const handleTenantInput = (value) => {
        setTenantQuery(value);
        setShowDropdown(true);
        updateDropdownPosition();
        searchTenants(value);
    };

    const handleInputFocus = () => {
        updateDropdownPosition();
        setShowDropdown(true);
        if (tenants.length === 0) {
            searchTenants('');
        }
    };

    const selectTenant = (tenant) => {
        setSelectedTenant(tenant);
        const displayName = tenant.tenantId ? `${tenant.tenantId} - ${tenant.name}` : tenant.name;
        setTenantQuery(displayName);
        setTenants([]);
        setShowDropdown(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedTenant?._id) {
            toast.error('Please select a tenant');
            return;
        }

        if (product === 'reconciliation') {
            if (!isValidAmount(amount)) {
                toast.error('Please enter a valid amount (up to 2 decimal places)');
                return;
            }
        } else {
            const hasAmount = amount !== '';
            const hasImages = freeImages !== '';
            const hasVideos = freeVideos !== '';
            if (!hasAmount && !hasImages && !hasVideos) {
                toast.error('Give at least one of amount, free images, or free videos');
                return;
            }
            if ((hasAmount && !isValidAmount(amount)) || (hasImages && !isValidCount(freeImages)) || (hasVideos && !isValidCount(freeVideos))) {
                toast.error('Amounts must be positive numbers (whole numbers for free images/videos)');
                return;
            }
        }

        setLoading(true);
        try {
            if (product === 'reconciliation') {
                await api.post('/superadmin/credits/gift', {
                    tenantId: selectedTenant._id,
                    amount: Number(amount),
                    note
                });
            } else {
                // Rupees always decide the credit quantity and CATEGORY (resolved server-side purely
                // from the amount, exactly like a real plan purchase — never overridable). planTitle
                // only picks which plan's usage rates apply, independent of category — it's ignored
                // when there's no amount. Free images/videos are a separate, independent grant.
                await api.post('/listing-studio/wallet/admin/gift', {
                    tenantId: selectedTenant._id,
                    ...(amount !== '' && { amount: Number(amount), ...(planTitle && { planTitle }) }),
                    ...(freeImages !== '' && { freeImages: Number(freeImages) }),
                    ...(freeVideos !== '' && { freeVideos: Number(freeVideos) }),
                    note,
                });
            }
            toast.success('Admin gift added successfully');

            setAmount('');
            setFreeImages('');
            setFreeVideos('');
            setNote('');
            setPlanTitle('');
            setPlanTouched(false);
            setSelectedTenant(null);
            setTenantQuery('');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Gift operation error:', error);
            toast.error(error.response?.data?.message || 'Failed to gift credits');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setProduct('reconciliation');
        setAmount('');
        setFreeImages('');
        setFreeVideos('');
        setNote('');
        setPlanTitle('');
        setPlanTouched(false);
        setSelectedTenant(null);
        setTenantQuery('');
        setTenants([]);
        setShowDropdown(false);
        onClose();
    };

    const getInitial = (name) => name?.charAt(0)?.toUpperCase() || '';

    const canSubmit = product === 'reconciliation'
        ? !!amount
        : !!(amount || freeImages || freeVideos);

    return (
        <Transition appear show={isOpen} as={React.Fragment}>
            <Dialog as="div" className="relative z-50" onClose={handleClose}>
                <Transition.Child
                    as={React.Fragment}
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
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-visible rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 rounded-t-2xl flex justify-between items-center">
                                    <Dialog.Title as="h3" className="text-xl font-bold text-white flex items-center gap-2">
                                        <Gift size={22} />
                                        Add Admin Gift
                                    </Dialog.Title>
                                    <button onClick={handleClose} className="text-white hover:opacity-80">
                                        <X size={24} />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-visible">
                                    {/* Tenant Selection */}
                                    <div className="overflow-visible">
                                        <label className="block text-sm font-bold text-purple-700 mb-2">
                                            Select Tenant <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={tenantQuery}
                                            onChange={(e) => handleTenantInput(e.target.value)}
                                            onFocus={handleInputFocus}
                                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                            placeholder="Type tenant name or search existing..."
                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-0 focus:border-blue-500 text-sm font-medium placeholder:text-slate-400"
                                        />
                                    </div>

                                    {/* Apply Credits To */}
                                    <div>
                                        <label className="block text-sm font-bold text-purple-700 mb-2">
                                            Apply Credits To <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setProduct('reconciliation')}
                                                className={`relative text-left p-3 rounded-xl border-2 transition-all ${product === 'reconciliation' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}
                                            >
                                                {product === 'reconciliation' && <Check size={16} className="absolute top-2 right-2 text-purple-600" />}
                                                <Layers size={18} className="text-slate-500 mb-1" />
                                                <p className="text-sm font-semibold text-slate-800">Reconciliation</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Credit applied toward account reconciliation balance</p>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setProduct('listing-studio')}
                                                className={`relative text-left p-3 rounded-xl border-2 transition-all ${product === 'listing-studio' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}
                                            >
                                                {product === 'listing-studio' && <Check size={16} className="absolute top-2 right-2 text-purple-600" />}
                                                <Sparkles size={18} className="text-slate-500 mb-1" />
                                                <p className="text-sm font-semibold text-slate-800">Listing Studio</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Credit applied toward Listing Studio usage/tools</p>
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">Choose which module this gifted balance is credited to.</p>
                                    </div>

                                    {/* Amount */}
                                    <div>
                                        <label className="block text-sm font-bold text-purple-700 mb-2">
                                            {product === 'reconciliation' ? <>Amount (₹) <span className="text-red-500">*</span></> : <>Amount (₹, optional)</>}
                                        </label>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="Enter amount"
                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-0 focus:border-blue-500 text-sm font-medium"
                                            min="0.01"
                                            step="0.01"
                                            inputMode="decimal"
                                        />
                                    </div>

                                    {product === 'listing-studio' && isValidAmount(amount) && (
                                        <div>
                                            <label className="block text-sm font-bold text-purple-700 mb-2">
                                                Charge credits at rates of <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={planTitle}
                                                onChange={(e) => { setPlanTitle(e.target.value); setPlanTouched(true); }}
                                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-0 focus:border-blue-500 text-sm font-medium"
                                            >
                                                {plans.map((p) => (
                                                    <option key={p.title} value={p.title}>
                                                        {p.title} (campaign {p.campaignCost}, image {p.imageCost}, video {p.videoCost})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Rates only — changing this does not change which plan the credits are categorized as above; it only changes what campaigns/images/videos cost against this gift.
                                            </p>
                                        </div>
                                    )}

                                    {product === 'listing-studio' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-bold text-purple-700 mb-2">Free Images (optional)</label>
                                                <input
                                                    type="number"
                                                    value={freeImages}
                                                    onChange={(e) => setFreeImages(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-0 focus:border-blue-500 text-sm font-medium"
                                                    min="1"
                                                    step="1"
                                                    inputMode="numeric"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-purple-700 mb-2">Free Videos (optional)</label>
                                                <input
                                                    type="number"
                                                    value={freeVideos}
                                                    onChange={(e) => setFreeVideos(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-0 focus:border-blue-500 text-sm font-medium"
                                                    min="1"
                                                    step="1"
                                                    inputMode="numeric"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Note */}
                                    <div>
                                        <label className="block text-sm font-bold text-purple-700 mb-2">
                                            Note (Optional)
                                        </label>
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Reason for admin gift..."
                                            rows="3"
                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-0 focus:border-blue-500 resize-none text-sm font-medium"
                                        />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !canSubmit || !selectedTenant?._id}
                                            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />
                                                    Adding...
                                                </>
                                            ) : (
                                                <>
                                                    <Gift size={18} />
                                                    Add Gift
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>

            {showDropdown && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: dropdownPos.top + 6,
                        left: dropdownPos.left,
                        width: dropdownPos.width,
                        maxHeight: '320px',
                        overflow: 'auto',
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        zIndex: 9999,
                        padding: '8px'
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {searching ? (
                        <div className="p-3 text-center text-slate-500">
                            <Loader2 size={16} className="animate-spin mx-auto" />
                        </div>
                    ) : tenants.length > 0 ? (
                        <div className="space-y-1">
                            {tenants.map((tenant) => (
                                <button
                                    key={tenant._id}
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); selectTenant(tenant); }}
                                    className="w-full text-left px-2.5 py-2.5 hover:bg-slate-50 transition-colors rounded-md flex items-center gap-3 active:bg-slate-100"
                                >
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded flex items-center justify-center font-semibold text-blue-700 text-sm">
                                        {getInitial(tenant.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-900 text-sm truncate">
                                            {tenant.tenantId && `${tenant.tenantId} - `}
                                            {tenant.name}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded whitespace-nowrap">
                                            GST
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : tenantQuery.trim() ? (
                        <div className="p-3 text-center text-slate-500 text-sm">
                            No tenants found
                        </div>
                    ) : (
                        <div className="p-3 text-center text-slate-500 text-sm">
                            Loading tenants...
                        </div>
                    )}
                </div>,
                document.body
            )}
        </Transition>
    );
};

export default AdminGiftModal;
