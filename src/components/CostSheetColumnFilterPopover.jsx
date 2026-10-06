import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Filter, X } from 'lucide-react';
import api from '../api';

/**
 * A generic popover for filtering Cost Sheet columns with multi-select support.
 */
const CostSheetColumnFilterPopover = ({
    columnKey,
    columnLabel,
    currentSelection = [],
    onApply,
    marketplaceFilters,
    alignRight = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);

    const popoverRef = useRef(null);

    // Sync external selection when popover opens
    useEffect(() => {
        if (isOpen) {
            setSelectedItems(currentSelection || []);
            setSearchQuery('');
            setDebouncedQuery('');
        }
    }, [isOpen, currentSelection]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch options
    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const params = {
                    column: columnKey,
                };
                if (marketplaceFilters && marketplaceFilters.length > 0) {
                    params.marketplaceIds = JSON.stringify(marketplaceFilters);
                }
                if (debouncedQuery) {
                    params.q = debouncedQuery;
                }

                const { data } = await api.get('/cost-sheet/search-options', { params });
                
                if (cancelled) return;
                
                setOptions(data.options || []);
                setIsTruncated(!!data.truncated);
            } catch (error) {
                if (!cancelled) {
                    console.error(`Failed to fetch filter options for ${columnKey}`, error);
                    setOptions([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchOptions();
        return () => { cancelled = true; };
    }, [isOpen, columnKey, marketplaceFilters, debouncedQuery]);

    const visibleOptions = options;

    const handleApply = () => {
        onApply(selectedItems);
        setIsOpen(false);
    };

    const handleClear = () => {
        onApply([]);
        setIsOpen(false);
    };

    const handleSelectAll = () => {
        const newSelection = Array.from(new Set([...selectedItems, ...visibleOptions]));
        setSelectedItems(newSelection);
    };

    const isActive = currentSelection && currentSelection.length > 0;

    return (
        <div className="relative inline-block" ref={popoverRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`p-1 rounded-md transition-colors cursor-pointer ${isActive ? 'bg-brand-400 text-white hover:bg-brand-300' : 'text-white/90 hover:text-white hover:bg-white/20'}`}
                title={`Filter ${columnLabel}`}
            >
                <Filter size={14} className={isActive ? 'fill-current' : ''} />
            </button>

            {isOpen && (
                <div className={`absolute top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-[60] text-slate-800 flex flex-col max-h-96 ${alignRight ? 'right-0' : 'left-0'}`}>
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-lg">
                        <span className="text-sm font-semibold text-slate-700">Filter: {columnLabel}</span>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder={`Search ${columnLabel}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-between items-center mt-2 px-1">
                            <button
                                onClick={handleSelectAll}
                                disabled={visibleOptions.length === 0}
                                className="text-[11px] text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50 cursor-pointer"
                            >
                                {isTruncated ? `Select All (${visibleOptions.length})` : 'Select All'}
                            </button>
                            <button
                                onClick={() => setSelectedItems([])}
                                className="text-[11px] text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-1 min-h-[100px]">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-20 text-brand-500">
                                <Loader2 size={18} className="animate-spin" />
                            </div>
                        ) : options.length === 0 ? (
                            <div className="flex items-center justify-center h-20 text-slate-400 text-xs">
                                No options found
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {options.map((opt) => (
                                    <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(opt)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedItems([...selectedItems, opt]);
                                                } else {
                                                    setSelectedItems(selectedItems.filter(item => item !== opt));
                                                }
                                            }}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                        />
                                        <span className="text-xs text-slate-600 truncate group-hover:text-slate-800 flex-1" title={opt || '(Blank)'}>
                                            {opt || '(Blank)'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {!isLoading && isTruncated && (
                            <div className="px-2 py-1.5 mt-1 text-[10px] text-amber-700 bg-amber-50 rounded border border-amber-100 text-center">
                                Showing top {options.length} matches
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-slate-100 bg-slate-50 rounded-b-lg flex justify-end gap-2 shrink-0">
                        <button
                            onClick={handleClear}
                            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded transition-colors font-medium cursor-pointer"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-3 py-1.5 text-xs bg-brand-600 text-white hover:bg-brand-700 rounded transition-colors font-medium shadow-sm cursor-pointer"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CostSheetColumnFilterPopover;
