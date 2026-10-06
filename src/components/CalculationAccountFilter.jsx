import React, { useState, useEffect, useRef } from 'react';
import { Filter, Search, X, ChevronDown, ChevronUp, Check, Store } from 'lucide-react';
import { getMarketplaceLogo } from '../utils/marketplaceLogos';

/**
 * CalculationAccountFilter - Reusable standalone account filter popover component
 *
 * Props:
 * - availableMarketplaces: Array of marketplace objects with key and accounts [{ key: 'FLIPKART', accounts: [...] }]
 * - marketplaceFilters: Array of currently selected account IDs
 * - onApplyFilters: Function(selectedIds) callback when user applies filter
 * - buttonLabel: Custom label for trigger button (default: "Filter Accounts")
 * - className: Custom outer container wrapper styling
 */
const CalculationAccountFilter = React.memo(({
    availableMarketplaces = [],
    marketplaceFilters = [],
    onApplyFilters,
    buttonLabel = "Filter Accounts",
    activeLogos = [],
    align = "left",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [tempSelectedAccounts, setTempSelectedAccounts] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const dropdownRef = useRef(null);

    // Sync selected platform and account selection when dropdown opens or active filters load
    useEffect(() => {
        if (!isOpen || !availableMarketplaces || availableMarketplaces.length === 0) return;

        let initialPlatform = availableMarketplaces[0]?.key || '';
        if (marketplaceFilters && marketplaceFilters.length > 0) {
            const firstActiveId = String(marketplaceFilters[0]).trim();
            const matchingMp = availableMarketplaces.find(mp =>
                mp.accounts?.some(acc => String(acc._id || acc.id).trim() === firstActiveId)
            );
            if (matchingMp) {
                initialPlatform = matchingMp.key;
            }
        }

        setSelectedPlatform(initialPlatform);
        setTempSelectedAccounts(marketplaceFilters || []);
    }, [isOpen, marketplaceFilters, availableMarketplaces]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helpers for filter dropdown logic
    const currentMarketplaceObj = availableMarketplaces.find(mp => mp.key === selectedPlatform) || availableMarketplaces[0];
    const currentAccounts = currentMarketplaceObj?.accounts || [];
    const filteredAccounts = currentAccounts.filter(acc =>
        acc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAllCurrentSelected = currentAccounts.length > 0 && currentAccounts.every(acc =>
        tempSelectedAccounts.some(id => String(id).trim() === String(acc._id || acc.id).trim())
    );

    const handleToggleAllCurrent = () => {
        if (isAllCurrentSelected) {
            const currentIdsSet = new Set(currentAccounts.map(a => String(a._id || a.id).trim()));
            setTempSelectedAccounts(prev => prev.filter(id => !currentIdsSet.has(String(id).trim())));
            if (errorMsg) setErrorMsg('');
        } else {
            const currentIds = currentAccounts.map(a => a._id || a.id);
            const newSelection = Array.from(new Set([...tempSelectedAccounts, ...currentIds]));
            if (newSelection.length > 5) {
                setErrorMsg('You can select a maximum of 5 accounts.');
                setTempSelectedAccounts(newSelection.slice(0, 5));
            } else {
                setTempSelectedAccounts(newSelection);
                if (errorMsg) setErrorMsg('');
            }
        }
    };

    const handleToggleAccount = (accountId) => {
        const targetIdStr = String(accountId).trim();
        const exists = tempSelectedAccounts.some(id => String(id).trim() === targetIdStr);
        if (exists) {
            setTempSelectedAccounts(prev => prev.filter(id => String(id).trim() !== targetIdStr));
            if (errorMsg) setErrorMsg('');
        } else {
            if (tempSelectedAccounts.length >= 5) {
                setErrorMsg('You can select a maximum of 5 accounts.');
                return;
            }
            setTempSelectedAccounts(prev => [...prev, accountId]);
            if (errorMsg) setErrorMsg('');
        }
    };

    const handleSelectPlatform = (platformKey) => {
        setSelectedPlatform(platformKey);
        setSearchTerm('');
        const targetMp = availableMarketplaces.find(mp => mp.key === platformKey);

        const existingActiveForMp = marketplaceFilters.find(filterId =>
            targetMp?.accounts?.some(acc => String(acc._id || acc.id).trim() === String(filterId).trim())
        );

        if (existingActiveForMp) {
            setTempSelectedAccounts([existingActiveForMp]);
        } else {
            setTempSelectedAccounts([]);
        }
    };

    const handleSelectAllPlatform = () => {
        const currentIds = currentAccounts.map(a => a._id || a.id);
        const newSelection = Array.from(new Set([...tempSelectedAccounts, ...currentIds]));
        if (newSelection.length > 5) {
            setErrorMsg('You can select a maximum of 5 accounts.');
            setTempSelectedAccounts(newSelection.slice(0, 5));
        } else {
            setTempSelectedAccounts(newSelection);
            if (errorMsg) setErrorMsg('');
        }
    };

    return (
        <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
            {/* Filter Accounts Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-md cursor-pointer transition-colors"
            >
                <Filter size={16} />
                {activeLogos.length > 0 && (
                    <span className="flex items-center gap-1">
                        {activeLogos.map((logoUrl, idx) => (
                            <span
                                key={idx}
                                className="w-5 h-5 rounded-md bg-white border border-white/80 shadow-xs flex items-center justify-center overflow-hidden"
                            >
                                <img
                                    src={logoUrl}
                                    alt=""
                                    className="w-full h-full object-contain p-0.5"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            </span>
                        ))}
                    </span>
                )}
                <span>{buttonLabel}</span>
                <span className="ml-0.5 px-2 py-0.5 bg-white text-brand-600 text-xs rounded-full font-black min-w-[22px] text-center shadow-xs">
                    {marketplaceFilters.length}
                </span>
                {isOpen ? <ChevronUp size={16} className="ml-1 opacity-80" /> : <ChevronDown size={16} className="ml-1 opacity-80" />}
            </button>

            {/* Dropdown Modal Container */}
            {isOpen && (
                <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-brand-600">
                        <span className="text-xs font-black uppercase text-white tracking-wider">
                            SELECT ACCOUNTS
                        </span>
                        <button
                            type="button"
                            onClick={() => setTempSelectedAccounts([])}
                            className="text-xs font-bold text-red-300 hover:text-red-600 transition-colors cursor-pointer"
                        >
                            Clear All
                        </button>
                    </div>

                    <div className="p-3">

                        {/* Marketplaces Selection Section */}
                        <div className="pb-2">
                            <div className="flex items-center justify-between mb-2">
                                {/* text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 */}
                                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                                    MARKETPLACES
                                </span>
                                <button
                                    type="button"
                                    onClick={handleSelectAllPlatform}
                                    className="text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors cursor-pointer"
                                >
                                    Select All
                                </button>
                            </div>

                            {/* Marketplace Icons */}
                            <div className="grid grid-cols-5 gap-2">
                                {availableMarketplaces.map(mp => {
                                    const isSelected = selectedPlatform === mp.key;
                                    const logoUrl = mp.key.toLowerCase().includes('amazon')
                                        ? `${import.meta.env.BASE_URL}assets/amazonsmall.svg`
                                        : getMarketplaceLogo(mp.key);

                                    return (
                                        <button
                                            key={mp.key}
                                            type="button"
                                            title={mp.key}
                                            onClick={() => handleSelectPlatform(mp.key)}
                                            className={`relative flex flex-col items-center justify-center p-1 rounded-xl border-2 transition-all duration-200 ${isSelected
                                                ? 'border-brand-500 bg-brand-100 shadow-sm scale-95'
                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="w-9 h-9 flex items-center justify-center p-1">
                                                {logoUrl ? (
                                                    <img
                                                        src={logoUrl}
                                                        alt={mp.key}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <Store size={18} className={isSelected ? 'text-sky-600' : 'text-slate-400'} />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Search Accounts Bar */}
                        <div className="relative mb-2.5">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search accounts..."
                                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all font-medium"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        {errorMsg && (
                            <div className="text-red-500 text-xs font-semibold px-1 mb-2">
                                {errorMsg}
                            </div>
                        )}

                        {/* Accounts Checkbox List */}
                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {currentAccounts.length === 0 ? (
                                <div className="py-6 text-center text-xs text-slate-400 font-medium">
                                    No accounts found for this marketplace
                                </div>
                            ) : (
                                <>
                                    {/* All Accounts Checkbox */}
                                    {!searchTerm && (
                                        <div
                                            onClick={() => {
                                                handleToggleAllCurrent();
                                                if (errorMsg) setErrorMsg('');
                                            }}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${isAllCurrentSelected
                                                ? 'bg-brand-50/70 border-brand-200'
                                                : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100/60'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${isAllCurrentSelected
                                                ? 'bg-brand-600 text-white shadow-xs'
                                                : 'border-2 border-slate-300 bg-white'
                                                }`}>
                                                {isAllCurrentSelected && <Check size={13} strokeWidth={3} />}
                                            </div>
                                            <span className="text-sm font-bold text-sky-950">
                                                All Accounts
                                            </span>
                                        </div>
                                    )}

                                    {/* Individual Account Items */}
                                    {filteredAccounts.map(account => {
                                        const accIdStr = String(account._id || account.id).trim();
                                        const isSelected = tempSelectedAccounts.some(id => String(id).trim() === accIdStr);
                                        const accountLogoKey = account.key || account.platform || account.marketplace || currentMarketplaceObj?.key;
                                        const accountLogo = accountLogoKey?.toLowerCase().includes('amazon')
                                            ? `${import.meta.env.BASE_URL}assets/amazonsmall.svg`
                                            : getMarketplaceLogo(accountLogoKey);

                                        return (
                                            <div
                                                key={account._id || account.id}
                                                onClick={() => handleToggleAccount(account._id || account.id)}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer select-none ${isSelected
                                                    ? 'bg-brand-50/70 hover:bg-brand-50 border border-brand-100/80'
                                                    : 'hover:bg-slate-50 border border-transparent'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${isSelected
                                                    ? 'bg-brand-600 text-white shadow-xs border border-brand-700'
                                                    : 'border-2 border-slate-300 bg-white hover:border-brand-400'
                                                    }`}>
                                                    {isSelected && <Check size={13} strokeWidth={3} />}
                                                </div>

                                                <div className="w-5 h-5 rounded border border-slate-200/80 bg-white p-0.5 shadow-2xs flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                    {accountLogo ? (
                                                        <img
                                                            src={accountLogo}
                                                            alt="logo"
                                                            className="w-full h-full object-contain"
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <Store size={12} className="text-slate-400" />
                                                    )}
                                                </div>

                                                <span className={`text-xs truncate ${isSelected ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'
                                                    }`}>
                                                    {account.name}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {filteredAccounts.length === 0 && searchTerm && (
                                        <div className="py-4 text-center text-xs text-slate-400">
                                            No matching accounts
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer / Apply Button */}
                        <div className="pt-3 mt-1 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    if (tempSelectedAccounts.length === 0) {
                                        setErrorMsg('Please select at least one account....');
                                        return;
                                    }
                                    setErrorMsg('');
                                    onApplyFilters(tempSelectedAccounts);
                                    setIsOpen(false);
                                }}
                                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer text-center"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default CalculationAccountFilter;