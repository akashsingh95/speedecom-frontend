/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import api from '../../api';

/**
 * Search popup shared by the SKU-Wise and Master-SKU-Wise calculations pages.
 *
 * Owns the option list for the SKU / Master SKU checkboxes and fetches it from
 * /payments/calculations/search-options, scoped to the marketplace + date range
 * currently active on the page.
 *
 * The full list is loaded — never a capped page — because the user has to be able
 * to tick every option. What they type is also sent as `q` so a large catalogue
 * can be narrowed in SQL, with the in-memory filter kept on top for instant
 * feedback while the debounced request is still in flight.
 *
 * If the server ever does return a partial list (it sets `truncated`), the list
 * says so and "Select All" is relabelled — selecting "all" of a partial list
 * would otherwise silently filter the grid to a subset.
 *
 * Nothing here triggers a table refetch — the parent only learns about a search
 * when the user presses "Search & Apply", which calls onApply().
 */
const CalculationsSearchModal = ({
    isOpen,
    onClose,
    searchType,
    setSearchType,
    onApply,
    marketplaceFilter,
    startDate,
    endDate,
    nullDateFilter,
    isFlipkart = false,
    initialSelectedItems = [],
}) => {
    const [searchOptions, setSearchOptions] = useState([]);
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedSearchItems, setSelectedSearchItems] = useState([]);
    const [isSearchOptionsLoading, setIsSearchOptionsLoading] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    
    const prevIsOpenRef = useRef(false);

    // Debounce the typed query so a refetch happens once the user pauses, not on
    // Debounce the typed query so a refetch happens once the user pauses, not on
    // every keystroke. Order ID and Order Item ID modes never fetch, so they are left out.
    useEffect(() => {
        if (['order_id', 'order_item_id'].includes(searchType)) return;
        const timer = setTimeout(() => setDebouncedQuery(localSearchQuery.trim()), 350);
        return () => clearTimeout(timer);
    }, [localSearchQuery, searchType]);

    useEffect(() => {
        if (!isOpen) return;

        // Order IDs and Order Item IDs are far too numerous to list — that mode is a plain text box.
        if (['order_id', 'order_item_id'].includes(searchType)) {
            setSearchOptions([]);
            // Do not reset selected items here, it's handled in the other useEffect
            setIsTruncated(false);
            return;
        }

        let cancelled = false;

        const fetchOptions = async () => {
            setIsSearchOptionsLoading(true);
            try {
                const params = { searchType };
                if (marketplaceFilter) {
                    params.marketplaceIds = JSON.stringify(
                        Array.isArray(marketplaceFilter) ? marketplaceFilter : [marketplaceFilter]
                    );
                }
                if (startDate) params.startDate = startDate;
                if (endDate) params.endDate = endDate;
                if (nullDateFilter) params.nullOrderDate = true;
                if (debouncedQuery) params.q = debouncedQuery;

                const { data } = await api.get('/payments/calculations/search-options', { params });
                if (cancelled) return;

                // Current shape is { options, limit, truncated }; the array shapes are
                // tolerated so a stale bundle keeps working against a new server.
                const options = Array.isArray(data?.options)
                    ? data.options
                    : Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                setSearchOptions(options);
                setIsTruncated(!!data?.truncated);
            } catch (error) {
                if (cancelled) return;
                console.error('Failed to fetch search options', error);
                setSearchOptions([]);
                setIsTruncated(false);
            } finally {
                if (!cancelled) setIsSearchOptionsLoading(false);
            }
        };

        fetchOptions();
        return () => { cancelled = true; };
    }, [searchType, isOpen, marketplaceFilter, startDate, endDate, nullDateFilter, debouncedQuery]);

    // Clearing selections belongs to switching type/scope, not to typing — a
    // refetch triggered by `q` must not wipe what the user has already ticked.
    useEffect(() => {
        const justOpened = !prevIsOpenRef.current && isOpen;
        prevIsOpenRef.current = isOpen;

        if (justOpened) {
            if (['order_id', 'order_item_id'].includes(searchType)) {
                setLocalSearchQuery(initialSelectedItems.length > 0 ? initialSelectedItems[0] : '');
                setSelectedSearchItems([]);
            } else {
                setLocalSearchQuery('');
                setSelectedSearchItems(initialSelectedItems || []);
            }
            setDebouncedQuery('');
        } else if (isOpen) {
            setSelectedSearchItems([]);
            setLocalSearchQuery('');
            setDebouncedQuery('');
        }
    }, [searchType, isOpen, marketplaceFilter, startDate, endDate, nullDateFilter]);

    if (!isOpen) return null;

    const visibleOptions = searchOptions.filter(
        opt => opt && opt.toLowerCase().includes(localSearchQuery.toLowerCase())
    );

    const handleApply = () => {
        if (['order_id', 'order_item_id'].includes(searchType)) {
            onApply(localSearchQuery.trim() ? [localSearchQuery.trim()] : []);
        } else {
            onApply(selectedSearchItems);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                            <Search size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Search Calculations</h3>
                            <p className="text-xs text-slate-500">Find by Order ID, SKU, or Master SKU</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 flex-1 flex flex-col overflow-hidden min-h-[400px]">
                    <div className="mb-5 flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-slate-700">Search By:</span>
                            {[
                                { value: 'order_id', label: 'Order ID' },
                                ...(isFlipkart ? [{ value: 'order_item_id', label: 'Order Item ID' }] : []),
                                { value: 'sku', label: 'SKU' },
                                { value: 'master_sku', label: 'Master SKU' },
                            ].map(opt => (
                                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="searchType"
                                        value={opt.value}
                                        checked={searchType === opt.value}
                                        onChange={(e) => setSearchType(e.target.value)}
                                        className="text-brand-600 focus:ring-brand-500"
                                    />
                                    <span className="text-sm text-slate-700">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                        {!['order_id', 'order_item_id'].includes(searchType) && (
                            <div className="flex items-center gap-3 mt-3">
                                <button
                                    onClick={() => setSelectedSearchItems(visibleOptions)}
                                    disabled={visibleOptions.length === 0}
                                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold disabled:text-slate-300 disabled:cursor-not-allowed"
                                >
                                    {/* Only ever selects what is loaded — say so, because with a
                                        truncated list "Select All" would otherwise read as
                                        "everything in this account". */}
                                    {isTruncated ? `Select All (${visibleOptions.length} shown)` : 'Select All'}
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    onClick={() => setSelectedSearchItems([])}
                                    className="text-xs text-slate-600 hover:text-slate-800 font-semibold"
                                >
                                    Deselect All
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={
                                    searchType === 'order_id' ? 'Enter Order ID here...' :
                                    searchType === 'order_item_id' ? 'Enter Order Item ID here...' :
                                    'Search options...'
                                }
                                value={localSearchQuery}
                                onChange={(e) => setLocalSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 pl-9 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {['order_id', 'order_item_id'].includes(searchType) ? (
                                <div className="flex justify-center items-center h-full p-8 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-100">
                                    Please type the {searchType === 'order_id' ? 'Order ID' : 'Order Item ID'} in the search box above and click "Search & Apply" to filter. There are too many {searchType === 'order_id' ? 'Order IDs' : 'Order Item IDs'} to display in a list.
                                </div>
                            ) : isSearchOptionsLoading ? (
                                <div className="flex justify-center items-center h-32">
                                    <Loader2 className="animate-spin text-brand-500" size={24} />
                                </div>
                            ) : (
                                <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                    {visibleOptions.map(opt => (
                                        <label
                                            key={opt}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedSearchItems.includes(opt)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedSearchItems([...selectedSearchItems, opt]);
                                                    else setSelectedSearchItems(selectedSearchItems.filter(item => item !== opt));
                                                }}
                                                className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-medium text-slate-700 truncate flex-1" title={opt}>
                                                {opt}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            {!['order_id', 'order_item_id'].includes(searchType) && !isSearchOptionsLoading && isTruncated && (
                                <div className="mt-3 px-3 py-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                                    Showing the first {searchOptions.length} matches only. Type in the box above to narrow the list — searching runs on the server, so anything not listed here is still reachable.
                                </div>
                            )}
                            {!['order_id', 'order_item_id'].includes(searchType) && !isSearchOptionsLoading && searchOptions.length === 0 && (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    No options found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
                    <span className="text-sm font-medium text-brand-600">
                        {['order_id', 'order_item_id'].includes(searchType) ? (searchType === 'order_id' ? 'Order ID search' : 'Order Item ID search') : `${selectedSearchItems.length} selected`}
                    </span>
                    <button
                        onClick={handleApply}
                        className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                    >
                        Search &amp; Apply
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalculationsSearchModal;
