import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Filter, ChevronDown, ChevronUp, Search, X, Check, Store } from 'lucide-react';
import { getMarketplaceLogo } from '../utils/marketplaceLogos';
import api from '../api';

/**
 * MarketplaceAccountSelector - Universal configurable component for marketplace & account selection
 *
 * Supported Modes:
 * 1. Single Marketplace + Single Account (Upload, Upload History, Download, Calculation, Action, Ads)
 *    props: selectionMode="single", accountSelection="single", variant="selector", showBadge={true}
 * 2. Cost Sheet (Single Marketplace + Multi Account)
 *    props: selectionMode="single", accountSelection="multiple", variant="popover", showCheckbox={true}
 * 3. Return (Single Marketplace + Multi Account with initial default message)
 *    props: selectionMode="single", accountSelection="multiple", variant="popover", showDefaultMessage={true}
 * 4. Payment (Multi Marketplace + Multi Account with Clear All)
 *    props: selectionMode="multiple", accountSelection="multiple", variant="popover", showClearAll={true}
 */
const MarketplaceAccountSelector = ({
    // Mode Configuration
    selectionMode = "single", // "single" | "multiple"
    accountSelection = "single", // "single" | "multiple"
    variant = "selector", // "selector" (trigger + chip badge) | "popover" (filter button with count)
    showCheckbox, // boolean (defaults to accountSelection === "multiple")
    showClearAll, // boolean (defaults to selectionMode === "multiple")
    showDefaultMessage = false, // boolean (for Return tab empty prompt)
    showBadge, // boolean (defaults to variant === "selector")
    buttonLabel, // string (defaults depending on variant)
    align = "left", // "left" | "right"
    className = "",
    disabledMarketplaces = [], // string[] (e.g. ['meesho'])
    disableInactiveAccounts = false, // true = deactivated accounts show but can't be selected (e.g. Uploads)

    // Data Props
    marketplaces: propMarketplaces,
    availableMarketplaces: propAvailableMarketplaces,
    selectedMarketplaces: propSelectedMarketplaces,
    selectedMarketplaceKey: propSelectedMarketplaceKey,
    selectedAccounts: propSelectedAccounts,
    selectedAccountId: propSelectedAccountId,
    selectedAccountIds: propSelectedAccountIds,
    marketplaceFilters: propMarketplaceFilters,

    // Callbacks
    onMarketplaceChange,
    onAccountChange,
    onApply,
    onSelect,
    onChange,
    onApplyFilters,
}) => {
    // Determine effective boolean flags based on configuration
    const isMultiMarketplace = selectionMode === "multiple";
    const isMultiAccount = accountSelection === "multiple";
    const isCheckboxMode = showCheckbox !== undefined ? showCheckbox : isMultiAccount;
    const isClearAllEnabled = showClearAll !== undefined ? showClearAll : isMultiMarketplace;
    const isBadgeVisible = showBadge !== undefined ? showBadge : (variant === "selector" && !isMultiAccount);
    const defaultLabel = variant === "popover" ? "Filter Accounts" : "Select Account";
    const effectiveButtonLabel = buttonLabel || defaultLabel;

    const isMarketplaceDisabled = useCallback((mpKey) => {
        if (!disabledMarketplaces || disabledMarketplaces.length === 0) return false;
        const lowerKey = String(mpKey || '').toLowerCase();
        return disabledMarketplaces.some(d => {
            const lowerD = String(d).toLowerCase();
            return lowerKey === lowerD || lowerKey.includes(lowerD);
        });
    }, [disabledMarketplaces]);

    const [fetchedMarketplaces, setFetchedMarketplaces] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // Draft / Temporary state inside dropdown
    const [draftMarketplaces, setDraftMarketplaces] = useState([]); // array of marketplace keys
    const [draftAccountIds, setDraftAccountIds] = useState([]); // array of account IDs (strings)

    // Applied / Committed state (displayed on trigger / badges)
    const [appliedMarketplaces, setAppliedMarketplaces] = useState([]);
    const [appliedAccountIds, setAppliedAccountIds] = useState([]);

    // Merge marketplace lists and ensure all accounts are strictly sorted alphabetically
    const rawMarketplaces = propMarketplaces || propAvailableMarketplaces;
    const availableMarketplaces = useMemo(() => {
        const raw = (rawMarketplaces && Array.isArray(rawMarketplaces) && rawMarketplaces.length > 0)
            ? rawMarketplaces
            : fetchedMarketplaces;
        return (raw || []).map(mp => ({
            ...mp,
            accounts: (mp.accounts || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
        }));
    }, [rawMarketplaces, fetchedMarketplaces]);

    // Fetch marketplaces from API if none provided via props
    useEffect(() => {
        if (rawMarketplaces && rawMarketplaces.length > 0) return;
        let cancelled = false;

        const fetchMarketplaces = async () => {
            try {
                const { data } = await api.get('/marketplaces/filter-options?includeInactive=true');
                if (cancelled) return;
                const list = Array.isArray(data) ? data : [];
                setFetchedMarketplaces(list);
            } catch (err) {
                console.error('MarketplaceAccountSelector: Failed to load marketplaces', err);
            }
        };
        fetchMarketplaces();

        return () => { cancelled = true; };
    }, [rawMarketplaces]);

    // Per-marketplace account selection cache { [marketplaceKey]: string[] }
    const [accountSelectionsByMp, setAccountSelectionsByMp] = useState({});
    const isInitializedRef = useRef(false);

    // Normalize incoming props into arrays of keys and IDs
    const normalizedPropMps = useMemo(() => {
        if (propSelectedMarketplaces && Array.isArray(propSelectedMarketplaces)) {
            return propSelectedMarketplaces.map(k => String(k).trim()).filter(Boolean);
        }
        if (propSelectedMarketplaceKey) {
            return [String(propSelectedMarketplaceKey).trim()];
        }
        return [];
    }, [propSelectedMarketplaces, propSelectedMarketplaceKey]);

    const normalizedPropAccs = useMemo(() => {
        const raw = propSelectedAccounts || propSelectedAccountIds || propMarketplaceFilters;
        if (raw && Array.isArray(raw)) {
            return raw.map(id => String(id?._id || id?.id || id).trim()).filter(Boolean);
        }
        if (propSelectedAccountId) {
            return [String(propSelectedAccountId).trim()];
        }
        return [];
    }, [propSelectedAccounts, propSelectedAccountIds, propMarketplaceFilters, propSelectedAccountId]);

    // Sync external props with internal state on mount or when props actually change
    useEffect(() => {
        if (availableMarketplaces.length === 0) return;

        let initialMps = [...normalizedPropMps];
        let initialAccs = [...normalizedPropAccs];

        // Drop account ids that don't belong to any currently available marketplace (e.g. stale
        // selection from an account/marketplace that was removed or disabled) — otherwise they'd
        // get force-assigned to whatever marketplace is picked below, leaving the UI showing
        // "No accounts found" while the Apply button still thinks accounts are selected.
        const allRealAccountIds = new Set(
            availableMarketplaces.flatMap(mp => (mp.accounts || []).map(a => String(a._id || a.id).trim()))
        );
        initialAccs = initialAccs.filter(id => allRealAccountIds.has(id));

        // If no marketplace supplied, find one matching the supplied account, or fallback to first
        if (initialMps.length === 0) {
            if (initialAccs.length > 0) {
                const firstAccId = initialAccs[0];
                const matchingMp = availableMarketplaces.find(mp =>
                    mp.accounts?.some(acc => String(acc._id || acc.id).trim() === firstAccId)
                );
                if (matchingMp) {
                    initialMps = [matchingMp.key];
                }
            }
            if (initialMps.length === 0 && !showDefaultMessage) {
                const firstWithActive = availableMarketplaces.find(m => !isMarketplaceDisabled(m.key) && m.accounts?.some(a => a.status !== 'inactive'));
                const targetMp = firstWithActive || availableMarketplaces.find(m => !isMarketplaceDisabled(m.key)) || availableMarketplaces[0];
                if (targetMp) {
                    initialMps = isMultiMarketplace
                        ? availableMarketplaces.filter(m => !isMarketplaceDisabled(m.key)).map(m => m.key)
                        : [targetMp.key];
                }
            }
        }

        // Auto-select accounts on initial mount if none supplied
        if (initialAccs.length === 0 && initialMps.length > 0 && !showDefaultMessage && !isInitializedRef.current) {
            if (isMultiMarketplace && isMultiAccount) {
                initialAccs = availableMarketplaces.flatMap(m => (m.accounts || []).map(a => String(a._id || a.id).trim()));
            } else {
                const targetMp = availableMarketplaces.find(m => m.key === initialMps[0]) || availableMarketplaces[0];
                const sortedAccs = (targetMp?.accounts || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                const targetAcc = disableInactiveAccounts
                    ? (sortedAccs.find(a => a.status !== 'inactive') || sortedAccs[0])
                    : sortedAccs[0];
                if (targetAcc) {
                    initialAccs = [String(targetAcc._id || targetAcc.id)];
                }
            }
        }

        // Map initial accounts to their respective marketplaces in cache
        const initialMpAccMap = {};
        availableMarketplaces.forEach(mp => {
            const accIdsOfThisMp = (mp.accounts || []).map(a => String(a._id || a.id).trim());
            const matchedAccIds = initialAccs.filter(id => accIdsOfThisMp.includes(id));
            if (matchedAccIds.length > 0) {
                initialMpAccMap[mp.key] = matchedAccIds;
            }
        });
        if (initialMps[0] && !initialMpAccMap[initialMps[0]]) {
            initialMpAccMap[initialMps[0]] = initialAccs;
        }

        setAccountSelectionsByMp(prev => ({
            ...initialMpAccMap,
            ...prev
        }));

        setDraftMarketplaces(initialMps);
        setDraftAccountIds(initialAccs);
        setAppliedMarketplaces(initialMps);
        setAppliedAccountIds(initialAccs);
        isInitializedRef.current = true;
    }, [availableMarketplaces, normalizedPropMps, normalizedPropAccs, isMultiMarketplace, isMultiAccount, showDefaultMessage]);

    // When dropdown opens, reset draft state to applied state (or fallback to available marketplace)
    useEffect(() => {
        if (isOpen) {
            const mps = appliedMarketplaces.length > 0
                ? appliedMarketplaces
                : (availableMarketplaces[0] ? [availableMarketplaces[0].key] : []);
            setDraftMarketplaces([...mps]);
            setDraftAccountIds([...appliedAccountIds]);
            if (mps[0]) {
                setAccountSelectionsByMp(prev => ({
                    ...prev,
                    [mps[0]]: [...appliedAccountIds]
                }));
            }
            setSearchTerm('');
        }
    }, [isOpen, appliedMarketplaces, appliedAccountIds, availableMarketplaces]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // In multi-marketplace mode the logo grid is a bulk-select shortcut, not a visibility filter.
    const visibleMarketplaces = useMemo(() => {
        if (isMultiMarketplace) return availableMarketplaces;
        if (draftMarketplaces.length === 0) return [];
        return availableMarketplaces.filter(mp =>
            draftMarketplaces.some(k => String(k).toLowerCase() === String(mp.key).toLowerCase())
        );
    }, [draftMarketplaces, availableMarketplaces, isMultiMarketplace]);

    const visibleAccounts = useMemo(() => {
        return visibleMarketplaces
            .flatMap(mp =>
                (mp.accounts || []).map(acc => ({
                    ...acc,
                    marketplaceKey: mp.key
                }))
            )
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [visibleMarketplaces]);

    const filteredAccounts = useMemo(() => {
        if (!searchTerm) return visibleAccounts;
        return visibleAccounts.filter(acc =>
            (acc.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [visibleAccounts, searchTerm]);

    const visibleAccountIds = useMemo(() =>
        visibleAccounts.map(a => String(a._id || a.id).trim()),
        [visibleAccounts]
    );

    const isAllVisibleSelected = visibleAccountIds.length > 0 &&
        visibleAccountIds.every(id => draftAccountIds.includes(id));

    const allMarketplaceKeys = useMemo(() =>
        availableMarketplaces.map(mp => mp.key),
        [availableMarketplaces]
    );

    // Derived from actual checked accounts, not the draftMarketplaces bookkeeping array.
    const allAccountIdsAcrossMps = useMemo(() =>
        availableMarketplaces.flatMap(mp => (mp.accounts || []).map(a => String(a._id || a.id).trim())),
        [availableMarketplaces]
    );

    const isAllMarketplacesSelected = allAccountIdsAcrossMps.length > 0 &&
        allAccountIdsAcrossMps.every(id => draftAccountIds.includes(id));

    // Handle Marketplace Selection / Switch
    const handleMarketplaceClick = (mpKey) => {
        if (isMarketplaceDisabled(mpKey)) return;
        if (isMultiMarketplace) {
            // Payment tab: clicking the logo bulk selects/deselects its accounts based on whether all are already selected.
            const targetMp = availableMarketplaces.find(m => m.key === mpKey);
            const targetMpAccIds = (targetMp?.accounts || []).map(a => String(a._id || a.id).trim());
            const isFullySelected = targetMpAccIds.length > 0 &&
                targetMpAccIds.every(id => draftAccountIds.includes(id));

            const nextMps = isFullySelected
                ? draftMarketplaces.filter(k => k !== mpKey)
                : (draftMarketplaces.includes(mpKey) ? draftMarketplaces : [...draftMarketplaces, mpKey]);

            setDraftMarketplaces(nextMps);

            if (isFullySelected) {
                setDraftAccountIds(prev => prev.filter(id => !targetMpAccIds.includes(id)));
            } else {
                setDraftAccountIds(prev => {
                    const set = new Set(prev);
                    targetMpAccIds.forEach(id => set.add(id));
                    return Array.from(set);
                });
            }
        } else {
            // Single Marketplace Mode (Upload, Downloads, Cost Sheet, Return, etc.)
            const oldMpKey = draftMarketplaces[0];
            const isSame = oldMpKey === mpKey;

            if (!isSame) {
                // 1. Save current selection for oldMpKey
                if (oldMpKey) {
                    setAccountSelectionsByMp(prev => ({
                        ...prev,
                        [oldMpKey]: [...draftAccountIds]
                    }));
                }

                // 2. Restore remembered selection for mpKey or auto-select first account
                const remembered = accountSelectionsByMp[mpKey];
                let nextAccIds = [];

                if (remembered !== undefined && Array.isArray(remembered) && remembered.length > 0) {
                    nextAccIds = isMultiAccount ? remembered : [remembered[0]];
                } else {
                    const targetMp = availableMarketplaces.find(m => m.key === mpKey);
                    const sortedAccs = (targetMp?.accounts || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                    const firstAcc = disableInactiveAccounts
                        ? (sortedAccs.find(a => a.status !== 'inactive') || sortedAccs[0])
                        : sortedAccs[0];
                    nextAccIds = firstAcc ? [String(firstAcc._id || firstAcc.id)] : [];
                }

                setDraftMarketplaces([mpKey]);
                setDraftAccountIds(nextAccIds);
                setSearchTerm('');
            }
        }
    };

    // Handle Account Selection Toggle
    const handleAccountClick = (account) => {
        const accId = String(account._id || account.id).trim();
        // In multi-marketplace mode, draftMarketplaces[0] is just the first selected marketplace,
        // not necessarily the one this account belongs to — cache under the account's own
        // marketplace so the per-marketplace selection cache doesn't get corrupted.
        const currentMp = account.marketplaceKey || draftMarketplaces[0];

        if (!isMultiAccount) {
            // Single account mode: radio selection
            setDraftAccountIds([accId]);
            if (currentMp) {
                setAccountSelectionsByMp(prev => ({
                    ...prev,
                    [currentMp]: [accId]
                }));
            }
        } else {
            // Multi account mode: checkbox toggle
            setDraftAccountIds(prev => {
                const exists = prev.includes(accId);
                const next = exists ? prev.filter(id => id !== accId) : [...prev, accId];
                if (currentMp) {
                    const currentMpAccIds = new Set(
                        (availableMarketplaces.find(m => m.key === currentMp)?.accounts || [])
                            .map(a => String(a._id || a.id).trim())
                    );
                    setAccountSelectionsByMp(p => ({
                        ...p,
                        [currentMp]: next.filter(id => currentMpAccIds.has(id))
                    }));
                }
                return next;
            });
        }
    };

    // Toggle All Accounts for current visible marketplace(s)
    const handleToggleAllAccounts = () => {
        const currentMp = draftMarketplaces[0];
        if (isAllVisibleSelected) {
            const next = draftAccountIds.filter(id => !visibleAccountIds.includes(id));
            setDraftAccountIds(next);
            if (currentMp) {
                setAccountSelectionsByMp(prev => ({
                    ...prev,
                    [currentMp]: next
                }));
            }
        } else {
            const set = new Set(draftAccountIds);
            visibleAccountIds.forEach(id => set.add(id));
            const next = Array.from(set);
            setDraftAccountIds(next);
            if (currentMp) {
                setAccountSelectionsByMp(prev => ({
                    ...prev,
                    [currentMp]: next
                }));
            }
        }
    };

    // Toggle Clear All / Select All depending on mode
    const handleToggleClearAll = () => {
        if (isMultiMarketplace) {
            handleToggleAllMarketplaces();
        } else {
            if (draftAccountIds.length > 0) {
                setDraftAccountIds([]);
                if (draftMarketplaces[0]) {
                    setAccountSelectionsByMp(prev => ({
                        ...prev,
                        [draftMarketplaces[0]]: []
                    }));
                }
            } else {
                const targetMp = availableMarketplaces.find(m => m.key === draftMarketplaces[0]);
                const allAccs = (targetMp?.accounts || []).map(a => String(a._id || a.id).trim());
                setDraftAccountIds(allAccs);
                if (draftMarketplaces[0]) {
                    setAccountSelectionsByMp(prev => ({
                        ...prev,
                        [draftMarketplaces[0]]: allAccs
                    }));
                }
            }
        }
    };

    // Toggle All Marketplaces (Multi Marketplace Mode)
    const handleToggleAllMarketplaces = () => {
        if (isAllMarketplacesSelected) {
            setDraftMarketplaces([]);
            setDraftAccountIds([]);
        } else {
            const allAccIds = availableMarketplaces.flatMap(mp =>
                (mp.accounts || []).map(acc => String(acc._id || acc.id).trim())
            );
            setDraftMarketplaces([...allMarketplaceKeys]);
            setDraftAccountIds(allAccIds);
        }
    };


    // Apply Filters Callback
    const handleApply = () => {
        // Report marketplaces that actually have a selected account, not the bookkeeping array.
        const effectiveMps = isMultiMarketplace
            ? availableMarketplaces
                .filter(mp => (mp.accounts || []).some(a => draftAccountIds.includes(String(a._id || a.id).trim())))
                .map(mp => mp.key)
            : draftMarketplaces;
        const currentMp = effectiveMps[0];
        setAppliedMarketplaces([...effectiveMps]);
        setAppliedAccountIds([...draftAccountIds]);

        if (!isMultiMarketplace) {
            // Single Marketplace mode: Once new marketplace is applied,
            // clear old marketplace's default selection and keep only the newly applied marketplace!
            if (currentMp) {
                setAccountSelectionsByMp({
                    [currentMp]: [...draftAccountIds]
                });
            } else {
                setAccountSelectionsByMp({});
            }
        } else {
            if (currentMp) {
                setAccountSelectionsByMp(prev => ({
                    ...prev,
                    [currentMp]: [...draftAccountIds]
                }));
            }
        }
        setIsOpen(false);

        const selectedMpKey = effectiveMps[0] || '';
        const targetMp = availableMarketplaces.find(m => m.key === selectedMpKey);
        const selectedAccId = draftAccountIds[0] || '';
        const targetAcc = targetMp?.accounts?.find(a => String(a._id || a.id).trim() === selectedAccId) || targetMp?.accounts?.[0];

        const allSelectedAccountObjs = availableMarketplaces
            .flatMap(mp => mp.accounts || [])
            .filter(acc => draftAccountIds.includes(String(acc._id || acc.id).trim()));

        // Call any provided callback variant
        if (onApply) {
            onApply({
                selectedMarketplaces: effectiveMps,
                selectedAccountIds: draftAccountIds,
                selectedAccounts: allSelectedAccountObjs
            });
        }
        if (onApplyFilters) {
            onApplyFilters(draftAccountIds);
        }
        if (onSelect) {
            onSelect({
                marketplaceKey: selectedMpKey,
                accountId: selectedAccId,
                account: targetAcc,
                selectedAccountIds: draftAccountIds,
                selectedMarketplaces: effectiveMps
            });
        }
        if (onChange) {
            if (isMultiAccount) {
                onChange(draftAccountIds, effectiveMps, allSelectedAccountObjs);
            } else {
                onChange(selectedAccId, selectedMpKey, targetAcc);
            }
        }
        if (onMarketplaceChange) {
            onMarketplaceChange(effectiveMps);
        }
        if (onAccountChange) {
            onAccountChange(draftAccountIds, allSelectedAccountObjs);
        }
    };

    // Selected account object for single-badge display
    const appliedSingleAccountObj = useMemo(() => {
        if (appliedAccountIds.length === 0) return null;
        const targetId = appliedAccountIds[0];
        for (const mp of availableMarketplaces) {
            const found = mp.accounts?.find(a => String(a._id || a.id).trim() === targetId);
            if (found) return found;
        }
        return null;
    }, [availableMarketplaces, appliedAccountIds]);

    const appliedSingleLogo = useMemo(() => {
        const activeKey = appliedMarketplaces[0];
        return activeKey ? getMarketplaceLogo(activeKey) : null;
    }, [appliedMarketplaces]);

    // Active count on popover badge (always exact account count, never "Mkt")
    const activeBadgeCount = useMemo(() => {
        return appliedAccountIds.length;
    }, [appliedAccountIds]);

    return (
        <div className={`flex items-center gap-2.5 flex-wrap overflow-visible ${className}`}>
            <div className="relative inline-block text-left z-50" ref={dropdownRef}>
                {/* ─── Trigger Button ─── */}
                {variant === "popover" ? (
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-md cursor-pointer transition-colors"
                    >
                        <Filter size={15} />
                        <span>{effectiveButtonLabel}</span>
                        <span className="ml-0.5 px-2 py-0.5 bg-white text-brand-600 text-xs rounded-full font-black min-w-[22px] text-center shadow-xs">
                            {activeBadgeCount}
                        </span>
                        {isOpen ? <ChevronUp size={16} className="ml-1 opacity-80" /> : <ChevronDown size={16} className="ml-1 opacity-80" />}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="group flex min-w-[150px] sm:min-w-[170px] h-10 items-center justify-between px-4 sm:px-5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-sm sm:text-base font-bold cursor-pointer"
                    >
                        <span>{effectiveButtonLabel}</span>
                        <ChevronDown
                            size={18}
                            className={`transition-transform duration-300 ml-2 ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                )}

                {/* ─── Dropdown Modal ─── */}
                {isOpen && (
                    <div
                        className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2.5 w-80 sm:w-[335px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}
                    >
                        {/* Header */}
                        <div className="bg-brand-600 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-white text-xs font-black uppercase tracking-wider">
                                    SELECT ACCOUNTS
                                </h3>
                            </div>
                        </div>

                        <div className="p-3 space-y-3">
                            {/* Marketplaces Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        MARKETPLACES
                                    </span>
                                    {isClearAllEnabled && (
                                        <button
                                            type="button"
                                            onClick={handleToggleClearAll}
                                            className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
                                        >
                                            {isMultiMarketplace
                                                ? (isAllMarketplacesSelected ? "Clear All" : "Select All")
                                                : (draftAccountIds.length > 0 ? "Clear All" : "Select All")
                                            }
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-5 gap-2">
                                    {availableMarketplaces.map((mp) => {
                                        // Highlight the logo whenever at least one of its accounts is selected.
                                        const isSelected = isMultiMarketplace
                                            ? (mp.accounts || []).some(a => draftAccountIds.includes(String(a._id || a.id).trim()))
                                            : draftMarketplaces.includes(mp.key);
                                        const isMpDisabled = isMarketplaceDisabled(mp.key);
                                        const logoUrl = getMarketplaceLogo(mp.key);

                                        return (
                                            <button
                                                key={mp.key}
                                                type="button"
                                                title={isMpDisabled ? `${mp.key} (Unavailable for Ads)` : mp.key}
                                                disabled={isMpDisabled}
                                                onClick={() => !isMpDisabled && handleMarketplaceClick(mp.key)}
                                                className={`relative flex flex-col items-center justify-center p-1 rounded-xl border-2 transition-all duration-200 ${isMpDisabled
                                                        ? 'opacity-40 grayscale cursor-not-allowed bg-slate-100 border-slate-200 pointer-events-none'
                                                        : isSelected
                                                            ? 'border-brand-500 bg-brand-100 shadow-sm scale-95 cursor-pointer'
                                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
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
                                                        <Store size={18} className={isSelected && !isMpDisabled ? 'text-brand-600' : 'text-slate-400'} />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Search Accounts */}
                            {(draftMarketplaces.length > 0 || !showDefaultMessage) && (
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search accounts..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full text-xs pl-8 pr-8 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-slate-50/50 font-medium"
                                    />
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Accounts List Area */}
                            <div className="max-h-[170px] overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                                {showDefaultMessage && draftMarketplaces.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-slate-400 font-medium px-2">
                                        Please select a marketplace to view accounts
                                    </div>
                                ) : filteredAccounts.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-slate-400 font-medium">
                                        {searchTerm ? `No accounts found matching "${searchTerm}"` : 'No accounts found'}
                                    </div>
                                ) : (
                                    <>
                                        {/* All Accounts Toggle (Multi Account mode) */}
                                        {isMultiAccount && !searchTerm && (
                                            <div
                                                onClick={handleToggleAllAccounts}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all select-none ${isAllVisibleSelected
                                                    ? 'bg-brand-50/70 border border-brand-200'
                                                    : 'bg-slate-50/50 border border-slate-100 hover:bg-slate-100/60'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors flex-shrink-0 ${isAllVisibleSelected
                                                    ? 'bg-brand-600 text-white shadow-xs'
                                                    : 'border-2 border-slate-300 bg-white'
                                                    }`}>
                                                    {isAllVisibleSelected && <Check size={12} strokeWidth={3} />}
                                                </div>
                                                <span className="text-xs font-bold text-brand-950">
                                                    All Accounts
                                                </span>
                                            </div>
                                        )}

                                        {/* Account Items */}
                                        {filteredAccounts.map((account) => {
                                            const accId = String(account._id || account.id).trim();
                                            const isSelected = draftAccountIds.includes(accId);
                                            const accountLogo = getMarketplaceLogo(account.marketplaceKey || draftMarketplaces[0]);
                                            const isAccountDisabled = disableInactiveAccounts && account.status === 'inactive';

                                            return (
                                                <div
                                                    key={accId}
                                                    onClick={() => !isAccountDisabled && handleAccountClick(account)}
                                                    title={isAccountDisabled ? `${account.name} is deactivated` : undefined}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all select-none ${isAccountDisabled
                                                        ? 'opacity-50 cursor-not-allowed'
                                                        : `cursor-pointer ${isSelected ? 'bg-brand-50 border border-brand-200' : 'border border-transparent hover:bg-slate-50'}`
                                                        }`}
                                                >
                                                    {/* Selection Indicator: Radio vs Checkbox */}
                                                    {isCheckboxMode ? (
                                                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                                            ? 'bg-brand-600 text-white shadow-xs border border-brand-700'
                                                            : 'border-2 border-slate-300 bg-white hover:border-brand-400'
                                                            }`}>
                                                            {isSelected && <Check size={11} strokeWidth={3} />}
                                                        </div>
                                                    ) : (
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected
                                                            ? 'bg-brand-600 border-brand-600'
                                                            : 'border-slate-300 bg-white'
                                                            }`}>
                                                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                        </div>
                                                    )}

                                                    {/* Marketplace Logo */}
                                                    <div className="w-5 h-5 rounded border border-slate-200 bg-white p-0.5 shadow-2xs flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {accountLogo ? (
                                                            <img
                                                                src={accountLogo}
                                                                alt="logo"
                                                                className="w-full h-full object-contain"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <Store size={12} className="text-slate-400" />
                                                        )}
                                                    </div>

                                                    {/* Account Name */}
                                                    <span className={`text-xs truncate flex-1 min-w-0 ${isSelected ? 'font-bold text-slate-900' : 'text-slate-700 font-medium'}`}>
                                                        {account.name}
                                                    </span>

                                                    {/* Deactivated Badge */}
                                                    {account.status === 'inactive' && (
                                                        <span className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wide flex-shrink-0">
                                                            Deactivated
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                            {draftAccountIds.length === 0 && (
                                <p className="text-[11px] text-amber-600 font-semibold text-center mb-1.5 animate-in fade-in">
                                    Must select at least 1 account to apply
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleApply}
                                disabled={draftAccountIds.length === 0}
                                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-600 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer text-center"
                            >
                                {variant === "popover" ? "Apply Filters" : "Select Account"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Selected Badge beside selector (Requirement 1) ─── */}
            {isBadgeVisible && appliedSingleAccountObj && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl shadow-xs animate-in fade-in duration-200">
                    {appliedSingleLogo && (
                        <img
                            src={appliedSingleLogo}
                            alt={appliedMarketplaces[0]}
                            className="w-5 h-5 object-contain rounded"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <span className="text-brand-600 font-extrabold">{appliedSingleAccountObj.name}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(MarketplaceAccountSelector);
