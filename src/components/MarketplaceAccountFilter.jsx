import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, X, Calendar, Check, Search, Store } from 'lucide-react';
import { toast } from 'sonner';
import { TOUR } from '../tour/targets';
import api from '../api';
import { useMarketplace } from '../contexts/MarketplaceContext';
import AdvancedDateRangePicker from './AdvancedDateRangePicker';
import { getMarketplaceLogo } from '../utils/marketplaceLogos';

const EMPTY_DISABLED_MARKETPLACES = [];

const MarketplaceAccountFilter = ({
    onChange,
    dateLabel = 'Filter by Date',
    maxMonths = 3,
    defaultRangeType = '90days',
    storagePrefix = 'dashboard',
    showDateFilter = true,
    buttonLabel = 'Select Account',
    disabledMarketplaces = EMPTY_DISABLED_MARKETPLACES,
    accountSelection = 'single', // 'single' or 'multiple' accounts per marketplace
    autoSelectDefault = true, // false = tab starts empty, never auto-picks or inherits a default
    hideInactiveAccounts = false // true = deactivated accounts are dropped entirely, not just badged
}) => {
    // Get marketplace context to update global filter state
    const { updateFilters: updateMarketplaceContext, refreshTrigger } = useMarketplace();
    const isMultiAccount = accountSelection === 'multiple';

    const isMarketplaceDisabled = useCallback((mpKey) => {
        if (!disabledMarketplaces || disabledMarketplaces.length === 0) return false;
        const lowerKey = String(mpKey || '').toLowerCase();
        return disabledMarketplaces.some(d => {
            const lowerD = String(d).toLowerCase();
            return lowerKey === lowerD || lowerKey.includes(lowerD);
        });
    }, [disabledMarketplaces]);

    // marketplaces: [{ key: "Amazon India (Seller)", accounts: [{ _id, name }] }]
    const [marketplaces, setMarketplaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMarketplaceKeys, setSelectedMarketplaceKeys] = useState([]); // applied marketplace keys
    const [accountSelections, setAccountSelections] = useState({}); // applied { marketplaceKey: [accountId, ...] }
    // Draft state while the dropdown is open — only committed to applied state on "Apply"
    const [draftMarketplaceKeys, setDraftMarketplaceKeys] = useState([]);
    const [draftAccountSelections, setDraftAccountSelections] = useState({});
    const [isMarketplaceDropdownOpen, setIsMarketplaceDropdownOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [accountSearchStr, setAccountSearchStr] = useState('');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const [dateError, setDateError] = useState('');
    const [defaultStartDate, setDefaultStartDate] = useState('');
    const [defaultEndDate, setDefaultEndDate] = useState('');
    const dropdownRef = useRef(null);
    const isInitialMount = useRef(true);
    const isDateValidationReady = useRef(false);
    const isFallbackForDisabledRef = useRef(false);

    // Helper function to get default date range
    const getDefaultDates = () => {
        const today = new Date();
        const formatDateLocal = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (defaultRangeType === 'lastMonth') {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return {
                startDate: formatDateLocal(start),
                endDate: formatDateLocal(end)
            };
        }

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(today.getDate() - 90);

        return {
            startDate: formatDateLocal(ninetyDaysAgo),
            endDate: formatDateLocal(today)
        };
    };

    const fetchFilterOptions = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/marketplaces/filter-options?includeInactive=true');
            // data: [{ key, accounts: [{ _id, name, status }] }]
            let allMarketplaces = Array.isArray(data) ? [...data] : [];

            if (hideInactiveAccounts) {
                allMarketplaces = allMarketplaces
                    .map(m => ({ ...m, accounts: (m.accounts || []).filter(a => a.status !== 'inactive') }))
                    .filter(m => (m.accounts || []).length > 0);
            }

            if (disabledMarketplaces && disabledMarketplaces.length > 0) {
                disabledMarketplaces.forEach(d => {
                    const exists = allMarketplaces.some(m => String(m.key || '').toLowerCase().includes(String(d).toLowerCase()));
                    if (!exists) {
                        const capitalizedName = String(d).charAt(0).toUpperCase() + String(d).slice(1);
                        allMarketplaces.push({ key: capitalizedName, accounts: [] });
                    }
                });
            }
            setMarketplaces(allMarketplaces);

            if (allMarketplaces && allMarketplaces.length > 0) {
                if (!autoSelectDefault) {
                    // Stay empty until the user manually picks and hits Apply
                    setSelectedMarketplaceKeys([]);
                    setAccountSelections({});
                    return;
                }

                // Try to restore from localStorage first
                let savedMarketplaceIds = [];
                try {
                    const keyToRead = storagePrefix ? `${storagePrefix}SelectedMarketplaces` : 'dashboardSelectedMarketplaces';
                    const saved = localStorage.getItem(keyToRead);
                    if (saved) savedMarketplaceIds = JSON.parse(saved);
                } catch (e) { }

                if (savedMarketplaceIds && Array.isArray(savedMarketplaceIds) && savedMarketplaceIds.length > 0) {
                    const restoredKeys = [];
                    const restoredSelections = {};
                    const savedIdsSet = new Set(savedMarketplaceIds);
                    let hadDisabledSaved = false;

                    allMarketplaces.forEach(m => {
                        const hasSaved = (m.accounts || []).some(a => savedIdsSet.has(a._id));
                        if (hasSaved && isMarketplaceDisabled(m.key)) {
                            hadDisabledSaved = true;
                        }
                        if (isMarketplaceDisabled(m.key)) return;
                        const selectedForM = (m.accounts || []).filter(a => savedIdsSet.has(a._id)).map(a => a._id);
                        if (selectedForM.length > 0) {
                            restoredKeys.push(m.key);
                            restoredSelections[m.key] = isMultiAccount ? selectedForM : [selectedForM[0]];
                        }
                    });

                    if (restoredKeys.length > 0) {
                        isFallbackForDisabledRef.current = false;
                        if (!isMultiAccount) {
                            const targetKey = restoredKeys[0];
                            const targetAccId = restoredSelections[targetKey]?.[0];
                            if (targetKey && targetAccId) {
                                setSelectedMarketplaceKeys([targetKey]);
                                setAccountSelections({ [targetKey]: [targetAccId] });
                                return; // Found saved selection, skip default auto-select
                            }
                        } else {
                            setSelectedMarketplaceKeys(restoredKeys);
                            setAccountSelections(restoredSelections);
                            return; // Found saved selection, skip default auto-select
                        }
                    }

                    // Saved selection pointed only at a disabled marketplace (e.g. Ads tab) —
                    // fall through to auto-select, but don't let that overwrite shared storage
                    if (hadDisabledSaved) {
                        isFallbackForDisabledRef.current = true;
                    }
                }

                // Fallback: auto-select first account (alphabetically) of first marketplace
                const pickAccount = (accounts) => {
                    const sorted = (accounts || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                    return sorted.find(a => a.status !== 'inactive') || sorted[0];
                };

                const firstWithActive = allMarketplaces.find(m => !isMarketplaceDisabled(m.key) && m.accounts?.some(a => a.status !== 'inactive'));
                const targetMarketplace = firstWithActive || allMarketplaces.find(m => !isMarketplaceDisabled(m.key)) || allMarketplaces[0];
                const targetAccount = pickAccount(targetMarketplace?.accounts);

                if (targetMarketplace && targetAccount) {
                    setSelectedMarketplaceKeys([targetMarketplace.key]);
                    setAccountSelections({
                        [targetMarketplace.key]: [targetAccount._id]
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching marketplace filter options', error);
        } finally {
            setLoading(false);
        }
    }, [autoSelectDefault, isMarketplaceDisabled, hideInactiveAccounts]);

    useEffect(() => {
        fetchFilterOptions();
        // Set default date range using the helper function
        const defaultDates = getDefaultDates();

        let initialStartDate = defaultDates.startDate;
        let initialEndDate = defaultDates.endDate;

        try {
            const savedStart = localStorage.getItem(`${storagePrefix}StartDate`);
            const savedEnd = localStorage.getItem(`${storagePrefix}EndDate`);
            if (savedStart && savedEnd) {
                initialStartDate = savedStart;
                initialEndDate = savedEnd;
            }
        } catch (e) { }

        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
        setAppliedStartDate(initialStartDate);
        setAppliedEndDate(initialEndDate);
        setDefaultStartDate(defaultDates.startDate);
        setDefaultEndDate(defaultDates.endDate);

        // Enable date validation only after initial state settles
        setTimeout(() => {
            isDateValidationReady.current = true;
        }, 100);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsMarketplaceDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Re-seed the draft from applied state every time the dropdown opens,
    // so unapplied changes from a prior open get discarded
    useEffect(() => {
        if (isMarketplaceDropdownOpen) {
            const activeKey = selectedMarketplaceKeys.find(k => !isMarketplaceDisabled(k)) || (marketplaces.find(m => !isMarketplaceDisabled(m.key))?.key || '');
            const currentAccs = activeKey && accountSelections[activeKey] ? [...accountSelections[activeKey]] : [];
            const safeAccs = (!isMultiAccount && currentAccs.length > 1) ? [currentAccs[0]] : currentAccs;
            setDraftMarketplaceKeys(activeKey ? [activeKey] : []);
            setDraftAccountSelections(activeKey && safeAccs.length > 0 ? { [activeKey]: safeAccs } : {});
            setAccountSearchStr('');
        }
    }, [isMarketplaceDropdownOpen, isMultiAccount]);

    // Emit onChange when marketplace selection changes (and once on mount)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (onChange && appliedStartDate && appliedEndDate) {
                emitFilters();
            }
            return;
        }

        if (!onChange) return;
        emitFilters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMarketplaceKeys, accountSelections]);

    // Safety net: if either date gets cleared, reset both to the default range
    useEffect(() => {
        if (!isDateValidationReady.current) return;

        if (!startDate || !endDate) {
            const defaultDates = getDefaultDates();
            setStartDate(defaultDates.startDate);
            setEndDate(defaultDates.endDate);
            setDateError('');
        }
    }, [startDate, endDate]);

    // Refresh options on external triggers (e.g. after a recalculation).
    // Deliberately depends only on refreshTrigger's value, not fetchFilterOptions' identity —
    // fetchFilterOptions is recreated whenever a caller passes a non-memoized disabledMarketplaces
    // array, and depending on it here would re-run this effect (and re-fetch) on every render
    // once refreshTrigger is non-zero, an infinite fetch loop that flickers "Loading marketplaces...".
    const fetchFilterOptionsRef = useRef(fetchFilterOptions);
    useEffect(() => {
        fetchFilterOptionsRef.current = fetchFilterOptions;
    });
    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchFilterOptionsRef.current();
        }
    }, [refreshTrigger]);

    const emitFilters = () => {
        const allSelectedIds = [];
        const allSelectedNames = [];
        let hasInactiveAccountSelected = false;
        let requiresRecalculation = false;
        const targetKeys = (!isMultiAccount && selectedMarketplaceKeys.length > 1) ? [selectedMarketplaceKeys[0]] : selectedMarketplaceKeys;
        for (const key of targetKeys) {
            const rawIds = accountSelections[key] || [];
            const ids = (!isMultiAccount && rawIds.length > 1) ? [rawIds[0]] : rawIds;
            allSelectedIds.push(...ids);
            const marketplace = marketplaces.find(m => m.key === key);
            if (marketplace) {
                ids.forEach(id => {
                    const acc = marketplace.accounts.find(a => a._id === id);
                    if (acc) {
                        allSelectedNames.push(acc.name);
                        if (acc.status === 'inactive') hasInactiveAccountSelected = true;
                        if (acc.requiresRecalculation) requiresRecalculation = true;
                    }
                });
            }
        }

        const effectiveStartDate = appliedStartDate || startDate || defaultStartDate;
        const effectiveEndDate = appliedEndDate || endDate || defaultEndDate;
        const formattedStartDate = effectiveStartDate ? formatDate(effectiveStartDate) : '';
        const formattedEndDate = effectiveEndDate ? formatDate(effectiveEndDate) : '';

        if (allSelectedIds.length === 0) {
            if (!autoSelectDefault) {
                // Nothing picked yet on purpose — let the consumer show its own
                // "select an account" prompt instead of us inventing a default
                onChange && onChange({
                    marketplaceIds: [],
                    marketplaceNames: [],
                    marketplaceKeys: [],
                    startDate: formattedStartDate,
                    endDate: formattedEndDate,
                    hasInactiveAccountSelected: false,
                    requiresRecalculation: false
                });
                return;
            }
            resetToDefaultSelection();
            return; // emitFilters fires again via the useEffect above
        }

        const marketplaceIds = allSelectedIds;

        const filterData = {
            marketplaceIds,
            marketplaceNames: allSelectedNames,
            marketplaceKeys: selectedMarketplaceKeys,
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            hasInactiveAccountSelected,
            requiresRecalculation
        };

        // Persist selection across tabs under an isolated storage key
        const isAdsTab = storagePrefix === 'ads' || (disabledMarketplaces && disabledMarketplaces.length > 0);
        const storageKey = storagePrefix ? `${storagePrefix}SelectedMarketplaces` : 'dashboardSelectedMarketplaces';
        if (!isFallbackForDisabledRef.current) {
            try {
                if (marketplaceIds.length > 0) {
                    localStorage.setItem(storageKey, JSON.stringify(isMultiAccount ? marketplaceIds : [marketplaceIds[0]]));
                    if (storagePrefix === 'dashboard' || storagePrefix === 'calculations') {
                        const firstId = marketplaceIds[0];
                        const firstKey = selectedMarketplaceKeys[0];
                        if (firstId) {
                            localStorage.setItem('uploads_marketplaceId', firstId);
                            localStorage.setItem('uploadHist_account', firstId);
                        }
                        if (firstKey) {
                            localStorage.setItem('uploads_marketplaceKey', firstKey);
                            localStorage.setItem('uploadHist_marketplace', firstKey);
                        }
                    }
                }
            } catch (e) {
                console.error('Error saving storage', e);
            }
        }
        try {
            if (formattedStartDate) localStorage.setItem(`${storagePrefix}StartDate`, formattedStartDate);
            if (formattedEndDate) localStorage.setItem(`${storagePrefix}EndDate`, formattedEndDate);
        } catch (e) {
            console.error('Error saving storage', e);
        }

        // Update global marketplace context for Speedy Agent (skip for Ads-like tabs)
        if (!isAdsTab) {
            updateMarketplaceContext(filterData);
        }

        onChange(filterData);
    };

    const handleApplyDateFilter = (startOverride, endOverride) => {
        setDateError('');

        const finalStart = startOverride !== undefined ? startOverride : startDate;
        const finalEnd = endOverride !== undefined ? endOverride : endDate;

        if (!finalStart || !finalEnd) {
            setDateError('Both start and end dates are required');
            toast.error('Invalid Dates', {
                description: 'Please select both start and end dates',
                duration: 3000,
            });
            return;
        }

        // Max range check (converted to days for accuracy)
        if (maxMonths) {
            const start = new Date(finalStart);
            const end = new Date(finalEnd);
            const diffInDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const maxDays = maxMonths * 30;

            if (diffInDays > maxDays) {
                setDateError(`Date range cannot exceed ${maxMonths} months (${maxDays} days)`);
                toast.error('Date Range Too Large', {
                    description: `Selected range is ${diffInDays} days. Please select a date range within ${maxDays} days.`,
                    duration: 4000,
                });
                return;
            }
        }

        if (new Date(finalStart) > new Date(finalEnd)) {
            setDateError('Start date cannot be after end date');
            toast.error('Invalid Date Range', {
                description: 'Start date must be before or equal to end date',
                duration: 3000,
            });
            return;
        }

        setAppliedStartDate(finalStart);
        setAppliedEndDate(finalEnd);

        if (onChange) {
            const allSelectedIds = [];
            const allSelectedNames = [];
            let hasInactiveAccountSelected = false;
            let requiresRecalculation = false;
            for (const key of selectedMarketplaceKeys) {
                const ids = accountSelections[key] || [];
                allSelectedIds.push(...ids);
                const marketplace = marketplaces.find(m => m.key === key);
                if (marketplace) {
                    ids.forEach(id => {
                        const acc = marketplace.accounts.find(a => a._id === id);
                        if (acc) {
                            allSelectedNames.push(acc.name);
                            if (acc.status === 'inactive') hasInactiveAccountSelected = true;
                            if (acc.requiresRecalculation) requiresRecalculation = true;
                        }
                    });
                }
            }

            if (allSelectedIds.length === 0) {
                console.warn('No accounts selected during date apply, resetting to default');
                resetToDefaultSelection();
                return;
            }

            const marketplaceIds = allSelectedIds;
            const formattedStartDate = finalStart ? formatDate(finalStart) : '';
            const formattedEndDate = finalEnd ? formatDate(finalEnd) : '';

            onChange({ marketplaceIds, marketplaceNames: allSelectedNames, marketplaceKeys: selectedMarketplaceKeys, startDate: formattedStartDate, endDate: formattedEndDate, hasInactiveAccountSelected, requiresRecalculation });
        }
    };

    // Ensure date is in YYYY-MM-DD format
    const formatDate = (dateInput) => {
        if (!dateInput) return '';
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
        }
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            console.error('Date formatting error:', e);
            return '';
        }
    };

    const toggleMarketplace = (newMpKey) => {
        if (!newMpKey || isMarketplaceDisabled(newMpKey)) return;
        const oldMpKey = draftMarketplaceKeys[0];
        if (oldMpKey === newMpKey) return;

        const remembered = draftAccountSelections[newMpKey];
        let nextAccIds = [];

        if (remembered !== undefined && Array.isArray(remembered) && remembered.length > 0) {
            nextAccIds = isMultiAccount ? remembered : [remembered[0]];
        } else {
            const targetMp = marketplaces.find(m => m.key === newMpKey);
            const sortedAccs = (targetMp?.accounts || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
            const firstAcc = sortedAccs[0];
            nextAccIds = firstAcc ? [firstAcc._id] : [];
        }

        setDraftMarketplaceKeys([newMpKey]);
        setDraftAccountSelections(prev => ({ ...prev, [newMpKey]: nextAccIds }));
        setAccountSearchStr('');
    };

    const resetToDefaultSelection = () => {
        // Reset to first account of first available non-disabled marketplace
        if (marketplaces && marketplaces.length > 0) {
            const targetMarketplace = marketplaces.find(m => !isMarketplaceDisabled(m.key)) || marketplaces[0];
            const sortedAccs = (targetMarketplace?.accounts || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
            const targetAccount = sortedAccs[0];

            if (targetMarketplace && targetAccount) {
                setSelectedMarketplaceKeys([targetMarketplace.key]);
                setAccountSelections({ [targetMarketplace.key]: [targetAccount._id] });
            }
        }
    };

    const clearMarketplaces = () => {
        resetToDefaultSelection();
        toast.info('Reset to Default', {
            description: 'Selection reset to first account of first marketplace',
            duration: 2000,
        });
    };

    const clearDates = () => {
        const defaultDates = getDefaultDates();

        setStartDate(defaultDates.startDate);
        setEndDate(defaultDates.endDate);
        setAppliedStartDate(defaultDates.startDate);
        setAppliedEndDate(defaultDates.endDate);
        setDateError('');

        if (onChange) {
            const allSelectedIds = [];
            const allSelectedNames = [];
            let hasInactiveAccountSelected = false;
            let requiresRecalculation = false;
            for (const key of selectedMarketplaceKeys) {
                const ids = accountSelections[key] || [];
                allSelectedIds.push(...ids);
                const marketplace = marketplaces.find(m => m.key === key);
                if (marketplace) {
                    ids.forEach(id => {
                        const acc = marketplace.accounts.find(a => a._id === id);
                        if (acc) {
                            allSelectedNames.push(acc.name);
                            if (acc.status === 'inactive') hasInactiveAccountSelected = true;
                            if (acc.requiresRecalculation) requiresRecalculation = true;
                        }
                    });
                }
            }

            if (allSelectedIds.length === 0) {
                console.warn('No accounts selected during date clear, resetting to default');
                resetToDefaultSelection();
                return;
            }

            const marketplaceIds = allSelectedIds;
            onChange({ marketplaceIds, marketplaceNames: allSelectedNames, marketplaceKeys: selectedMarketplaceKeys, startDate: defaultDates.startDate, endDate: defaultDates.endDate, hasInactiveAccountSelected, requiresRecalculation });
        }
    };

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-xl shadow-sm border border-slate-200/80 p-6 mb-6 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-sm text-slate-600 font-medium">Loading marketplaces...</div>
                </div>
            </div>
        );
    }

    if (marketplaces.length === 0) {
        return (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm border border-amber-200/80 p-6 mb-6 animate-in fade-in duration-300">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-600 text-xl">⚠️</span>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-amber-900 mb-1">No Marketplaces Connected</h4>
                        <p className="text-sm text-amber-700">
                            Please connect a marketplace in Settings.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div data-tour={TOUR.filter.root} className="bg-gradient-to-br from-white to-slate-50/50 rounded-xl shadow-sm border border-slate-200/80 mb-4 animate-in fade-in duration-300 backdrop-blur-sm overflow-visible relative z-50">
            <div className="p-5 overflow-visible">
                <div className={`grid grid-cols-1 ${showDateFilter ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-6 overflow-visible`}>
                    {/* Left Side: Marketplace Selector */}
                    <div className="overflow-visible">
                        <div className="flex items-center justify-between mb-4 min-h-[32px]">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-8 rounded-full bg-brand-600"></div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">
                                            Marketplace & Accounts
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Select a marketplace and account to view data.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {/* Only show Clear when selection differs from the default single account */}
                            {(selectedMarketplaceKeys.length > 1 ||
                                (selectedMarketplaceKeys.length === 1 && accountSelections[selectedMarketplaceKeys[0]]?.length > 1) ||
                                (selectedMarketplaceKeys.length === 1 && accountSelections[selectedMarketplaceKeys[0]]?.length === 1 &&
                                    marketplaces.length > 0 && marketplaces[0].accounts.length > 0 &&
                                    (selectedMarketplaceKeys[0] !== marketplaces[0].key ||
                                        accountSelections[selectedMarketplaceKeys[0]][0] !== marketplaces[0].accounts[0]._id))) && (
                                    <button
                                        onClick={clearMarketplaces}
                                        className="group flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-semibold transition-all duration-200 hover:scale-105 active:scale-95 px-2 py-1 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200"
                                    >
                                        <X size={12} className="group-hover:rotate-90 transition-transform duration-200" />
                                        <span>Reset to Default</span>
                                    </button>
                                )}
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap overflow-visible">
                            {/* Add Marketplace Button with Dropdown */}
                            <div data-tour={TOUR.filter.marketplace} className="relative z-50" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsMarketplaceDropdownOpen(!isMarketplaceDropdownOpen)}
                                    className="group flex min-w-[150px] sm:min-w-[170px] h-10 items-center justify-between px-4 sm:px-5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-sm sm:text-base font-bold cursor-pointer"
                                >
                                    <span>{buttonLabel}</span>
                                    <ChevronDown size={18} className={`transition-transform duration-300 ml-2 ${isMarketplaceDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isMarketplaceDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-2.5 w-80 sm:w-[335px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="bg-brand-600 px-4 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-white text-xs font-black uppercase tracking-wider">
                                                    SELECT ACCOUNTS
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="p-3 space-y-3">
                                            {/* Marketplace logo grid */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                        MARKETPLACES
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {marketplaces.map((marketplace) => {
                                                        const isMpSelected = draftMarketplaceKeys.includes(marketplace.key);
                                                        const isMpDisabled = isMarketplaceDisabled(marketplace.key);
                                                        const logo = getMarketplaceLogo(marketplace.key);
                                                        return (
                                                            <button
                                                                key={marketplace.key}
                                                                type="button"
                                                                disabled={isMpDisabled}
                                                                onClick={() => {
                                                                    if (!isMpDisabled) toggleMarketplace(marketplace.key);
                                                                }}
                                                                className={`relative flex flex-col items-center justify-center p-1 rounded-xl border-2 transition-all duration-200 ${isMpDisabled
                                                                    ? 'opacity-40 grayscale cursor-not-allowed bg-slate-100 border-slate-200 pointer-events-none'
                                                                    : isMpSelected
                                                                        ? 'border-brand-500 bg-brand-100 shadow-sm scale-95 cursor-pointer'
                                                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                                                                    }`}
                                                                title={isMpDisabled ? `${marketplace.key} (Unavailable for Ads)` : marketplace.key}
                                                            >
                                                                <div className="w-9 h-9 flex items-center justify-center p-1">
                                                                    {logo ? (
                                                                        <img
                                                                            src={logo}
                                                                            alt={marketplace.key}
                                                                            className="w-full h-full object-contain"
                                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                                        />
                                                                    ) : (
                                                                        <Store size={18} className={isMpSelected && !isMpDisabled ? 'text-brand-600' : 'text-slate-400'} />
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Search */}
                                            <div className="relative">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search accounts..."
                                                    value={accountSearchStr}
                                                    onChange={(e) => setAccountSearchStr(e.target.value)}
                                                    className="w-full text-xs pl-8 pr-8 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-slate-50/50 font-medium"
                                                />
                                                {accountSearchStr && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setAccountSearchStr('')}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Account list for the active (draft) marketplace */}
                                            <div className="max-h-[170px] overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                                                {(() => {
                                                    const activeKey = draftMarketplaceKeys[0] || marketplaces.find(m => !isMarketplaceDisabled(m.key))?.key || marketplaces[0]?.key;
                                                    const activeMarketplace = marketplaces.find(m => m.key === activeKey);
                                                    const accounts = (activeMarketplace?.accounts || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                                                    const filtered = accounts.filter(a => (a.name || '').toLowerCase().includes(accountSearchStr.toLowerCase()));

                                                    if (filtered.length === 0) {
                                                        return <div className="py-6 text-center text-xs text-slate-400 font-medium">{accountSearchStr ? `No accounts found matching "${accountSearchStr}"` : 'No accounts found'}</div>;
                                                    }

                                                    const logo = getMarketplaceLogo(activeKey);
                                                    const allAccIds = accounts.map(a => a._id);
                                                    const isAllSelected = allAccIds.length > 0 && allAccIds.every(id => (draftAccountSelections[activeKey] || []).includes(id));

                                                    return (
                                                        <>
                                                            {isMultiAccount && !accountSearchStr && (
                                                                <div
                                                                    onClick={() => {
                                                                        setDraftAccountSelections(prev => ({
                                                                            ...prev,
                                                                            [activeKey]: isAllSelected ? [] : allAccIds
                                                                        }));
                                                                    }}
                                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all select-none ${isAllSelected ? 'bg-brand-50/70 border border-brand-200' : 'bg-slate-50/50 border border-slate-100 hover:bg-slate-100/60'
                                                                        }`}
                                                                >
                                                                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors flex-shrink-0 ${isAllSelected ? 'bg-brand-600 text-white shadow-xs' : 'border-2 border-slate-300 bg-white'
                                                                        }`}>
                                                                        {isAllSelected && <Check size={12} strokeWidth={3} />}
                                                                    </div>
                                                                    <span className="text-xs font-bold text-brand-950">All Accounts</span>
                                                                </div>
                                                            )}
                                                            {filtered.map((account) => {
                                                                const isSelected = Boolean(draftAccountSelections[activeKey]?.includes(account._id));
                                                                return (
                                                                    <div
                                                                        key={account._id}
                                                                        onClick={() => {
                                                                            if (isMultiAccount) {
                                                                                setDraftAccountSelections(prev => {
                                                                                    const current = prev[activeKey] || [];
                                                                                    const next = current.includes(account._id)
                                                                                        ? current.filter(id => id !== account._id)
                                                                                        : [...current, account._id];
                                                                                    return { ...prev, [activeKey]: next };
                                                                                });
                                                                            } else {
                                                                                setDraftAccountSelections({ [activeKey]: [account._id] });
                                                                            }
                                                                        }}
                                                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all select-none ${isSelected ? 'bg-brand-50 border border-brand-200' : 'border border-transparent hover:bg-slate-50'
                                                                            }`}
                                                                    >
                                                                        {isMultiAccount ? (
                                                                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-brand-600 text-white shadow-xs border border-brand-700' : 'border-2 border-slate-300 bg-white hover:border-brand-400'
                                                                                }`}>
                                                                                {isSelected && <Check size={11} strokeWidth={3} />}
                                                                            </div>
                                                                        ) : (
                                                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-slate-300 bg-white'
                                                                                }`}>
                                                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                                            </div>
                                                                        )}
                                                                        {/* Marketplace Logo */}
                                                                        <div className="w-5 h-5 rounded border border-slate-200 bg-white p-0.5 shadow-2xs flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                                            {logo ? (
                                                                                <img
                                                                                    src={logo}
                                                                                    alt="logo"
                                                                                    className="w-full h-full object-contain"
                                                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                                                />
                                                                            ) : (
                                                                                <Store size={12} className="text-slate-400" />
                                                                            )}
                                                                        </div>
                                                                        <span className={`text-xs truncate flex-1 min-w-0 ${isSelected ? 'font-bold text-slate-900' : 'text-slate-700 font-medium'}`}>
                                                                            {account.name}
                                                                        </span>
                                                                        {account.status === 'inactive' && (
                                                                            <span className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wide flex-shrink-0">
                                                                                Deactivated
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Apply Button */}
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                                            {(!draftMarketplaceKeys.some(k => (draftAccountSelections[k] || []).length > 0)) && (
                                                <p className="text-[11px] text-amber-600 font-semibold text-center mb-1.5 animate-in fade-in">
                                                    Must select at least 1 account to apply
                                                </p>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    isFallbackForDisabledRef.current = false;
                                                    const activeKey = draftMarketplaceKeys[0];
                                                    const currentAccIds = draftAccountSelections[activeKey] || [];
                                                    if (!activeKey || currentAccIds.length === 0) return;

                                                    const finalAccIds = isMultiAccount ? [...currentAccIds] : [currentAccIds[0]];
                                                    const cleanSelections = { [activeKey]: finalAccIds };

                                                    setSelectedMarketplaceKeys([activeKey]);
                                                    setAccountSelections(cleanSelections);
                                                    setDraftAccountSelections(cleanSelections);
                                                    setIsMarketplaceDropdownOpen(false);
                                                }}
                                                disabled={draftMarketplaceKeys.length === 0 || !draftMarketplaceKeys.some(k => (draftAccountSelections[k] || []).length > 0)}
                                                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-600 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer text-center"
                                            >
                                                {buttonLabel || "Select Account"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected marketplace/account badge */}
                            {(() => {
                                const selectedKey = selectedMarketplaceKeys[0];
                                const selectedMp = marketplaces.find(m => m.key === selectedKey);
                                const selectedAccIds = accountSelections[selectedKey] || [];
                                const selectedAccNames = selectedAccIds
                                    .map(id => selectedMp?.accounts?.find(a => a._id === id)?.name)
                                    .filter(Boolean);

                                if (!selectedMp || selectedAccNames.length === 0) return null;
                                const logo = getMarketplaceLogo(selectedKey);

                                return (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-sm animate-in fade-in duration-200 max-w-full">
                                        {logo && (
                                            <img src={logo} alt={selectedKey} className="w-5 h-5 object-contain rounded flex-shrink-0" />
                                        )}
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate">
                                            {!isMultiAccount || selectedAccNames.length === 1 ? (
                                                <span className="text-brand-700 font-extrabold truncate">{selectedAccNames[0]}</span>
                                            ) : (
                                                <span className="text-brand-700 font-extrabold">{selectedAccNames.length} accounts selected</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Right Side: Date Filter */}
                    {showDateFilter && (
                        <div data-tour={TOUR.filter.date} className="overflow-visible mt-4 lg:mt-0">
                            <div className="flex items-center justify-between xl:justify-start xl:gap-8 mb-4 min-h-[32px]">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 bg-brand-600 rounded-full"></div>
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-500" />
                                        {dateLabel ? (
                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{dateLabel}</h4>
                                        ) : (
                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter by Date</h4>
                                        )}
                                        {maxMonths && (
                                            <span className="text-xs text-slate-400">(Max {maxMonths} months)</span>
                                        )}
                                    </div>
                                </div>
                                {(startDate !== defaultStartDate || endDate !== defaultEndDate) && (
                                    <button
                                        onClick={clearDates}
                                        className="group flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-semibold transition-all duration-200 hover:scale-105 active:scale-95 px-2 py-1 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200"
                                    >
                                        <X size={12} className="group-hover:rotate-90 transition-transform duration-200" />
                                        <span>Clear</span>
                                    </button>
                                )}
                            </div>

                            <div className="relative select-none z-40">
                                <AdvancedDateRangePicker
                                    startDate={startDate}
                                    endDate={endDate}
                                    onChange={(start, end) => {
                                        setStartDate(start);
                                        setEndDate(end);
                                    }}
                                    onApply={(start, end) => {
                                        setStartDate(start);
                                        setEndDate(end);
                                        handleApplyDateFilter(start, end);
                                    }}
                                    maxDays={maxMonths ? maxMonths * 30 : 92}
                                    colorTheme="brand"
                                />
                            </div>

                            {dateError && (
                                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-xs text-red-600 font-medium">{dateError}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MarketplaceAccountFilter;