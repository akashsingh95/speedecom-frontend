import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, X, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api';
import { useMarketplace } from '../contexts/MarketplaceContext';
import AdvancedDateRangePicker from './AdvancedDateRangePicker';

const MarketplaceAccountFilter = ({ onChange, dateLabel = 'Filter by Date', maxMonths = 3, defaultRangeType = '90days', storagePrefix = 'dashboard' }) => {
    // Get marketplace context to update global filter state
    const { updateFilters: updateMarketplaceContext, refreshTrigger } = useMarketplace();
    
    // marketplaces: [{ key: "Amazon India (Seller)", accounts: [{ _id, name }] }]
    const [marketplaces, setMarketplaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMarketplaceKeys, setSelectedMarketplaceKeys] = useState([]); // marketplace type keys
    const [accountSelections, setAccountSelections] = useState({}); // { marketplaceKey: [accountId, ...] }
    const [isMarketplaceDropdownOpen, setIsMarketplaceDropdownOpen] = useState(false);
    const [expandedMarketplace, setExpandedMarketplace] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [accountSearchStr, setAccountSearchStr] = useState('');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const [dateError, setDateError] = useState('');
    const [defaultStartDate, setDefaultStartDate] = useState('');
    const [defaultEndDate, setDefaultEndDate] = useState('');
    const dropdownRef = useRef(null);
    const accountDropdownRef = useRef(null);
    const isInitialMount = useRef(true);
    const isDateValidationReady = useRef(false); // New ref to control validation

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
            setMarketplaces(data);
            
            if (data && data.length > 0) {
                // Try to restore from localStorage first
                let savedMarketplaceIds = [];
                try {
                    const saved = localStorage.getItem('dashboardSelectedMarketplaces');
                    if (saved) savedMarketplaceIds = JSON.parse(saved);
                } catch (e) {}

                if (savedMarketplaceIds && Array.isArray(savedMarketplaceIds) && savedMarketplaceIds.length > 0) {
                    const restoredKeys = [];
                    const restoredSelections = {};
                    const savedIdsSet = new Set(savedMarketplaceIds);
                    
                    data.forEach(m => {
                        const selectedForM = m.accounts.filter(a => savedIdsSet.has(a._id)).map(a => a._id);
                        if (selectedForM.length > 0) {
                            restoredKeys.push(m.key);
                            restoredSelections[m.key] = selectedForM;
                        }
                    });

                    if (restoredKeys.length > 0) {
                        setSelectedMarketplaceKeys(restoredKeys);
                        setAccountSelections(restoredSelections);
                        return; // Found saved selection, skip default auto-select
                    }
                }

                // Fallback: Auto-select first account of first marketplace
                const pickAccount = (accounts) =>
                    accounts?.find(a => a.status !== 'inactive') || accounts?.[0];

                const firstWithActive = data.find(m => m.accounts?.some(a => a.status !== 'inactive'));
                const targetMarketplace = firstWithActive || data[0];
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
    }, []);

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
        } catch (e) {}
        
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
        setAppliedStartDate(initialStartDate);
        setAppliedEndDate(initialEndDate);
        setDefaultStartDate(defaultDates.startDate);
        setDefaultEndDate(defaultDates.endDate);
        
        // Enable validation after initial setup is complete
        setTimeout(() => {
            isDateValidationReady.current = true;
        }, 100);
    }, []);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsMarketplaceDropdownOpen(false);
            }
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
                setExpandedMarketplace(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Only trigger onChange when marketplace selection changes or on initial mount
    useEffect(() => {
        // Skip the initial mount
        if (isInitialMount.current) {
            isInitialMount.current = false;
            // Emit default date range on initial mount
            if (onChange && appliedStartDate && appliedEndDate) {
                emitFilters();
            }
            return;
        }

        if (!onChange) return;

        // Only emit when marketplace selection changes
        emitFilters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMarketplaceKeys, accountSelections]);

    // Validate dates - prevent empty values by auto-resetting to default (Safety net)
    useEffect(() => {
        // Skip until validation is ready (prevents triggering on initial load)
        if (!isDateValidationReady.current) return;

        // Safety check: If either date is cleared/empty, reset both to default 90-day range
        // This catches any edge cases not handled by onChange handlers
        if (!startDate || !endDate) {
            const defaultDates = getDefaultDates();
            
            setStartDate(defaultDates.startDate);
            setEndDate(defaultDates.endDate);
            setDateError('');
        }
    }, [startDate, endDate]);

    // Listen for external refresh triggers (e.g. from CalculationsTab after full recalculation)
    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchFilterOptions();
        }
    }, [refreshTrigger, fetchFilterOptions]);

    const emitFilters = () => {
        // Collect all selected account _ids and their display names
        const allSelectedIds = [];
        const allSelectedNames = [];
        let hasInactiveAccountSelected = false;
        let requiresRecalculation = false;
        for (const key of selectedMarketplaceKeys) {
            const ids = accountSelections[key] || [];
            allSelectedIds.push(...ids);
            // Get display names and check status for these accounts
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

        // Safety check: if no accounts selected, reset to default
        if (allSelectedIds.length === 0) {
            resetToDefaultSelection();
            return; // emitFilters will be called again via useEffect
        }

        // Always emit the explicitly collected array of IDs instead of 'ALL'
        const marketplaceIds = allSelectedIds;

        // Use applied dates, not current input values
        const formattedStartDate = appliedStartDate ? formatDate(appliedStartDate) : '';
        const formattedEndDate = appliedEndDate ? formatDate(appliedEndDate) : '';

        const filterData = { 
            marketplaceIds, 
            marketplaceNames: allSelectedNames,
            marketplaceKeys: selectedMarketplaceKeys,
            startDate: formattedStartDate, 
            endDate: formattedEndDate,
            hasInactiveAccountSelected,
            requiresRecalculation
        };

        // Save selected marketplace IDs across tabs
        try {
            if (marketplaceIds.length > 0) {
                localStorage.setItem('dashboardSelectedMarketplaces', JSON.stringify(marketplaceIds));
            }
            if (formattedStartDate) localStorage.setItem(`${storagePrefix}StartDate`, formattedStartDate);
            if (formattedEndDate) localStorage.setItem(`${storagePrefix}EndDate`, formattedEndDate);
        } catch (e) {
            console.error('Error saving storage', e);
        }

        // Update global marketplace context for Speedy Agent
        updateMarketplaceContext(filterData);

        // Also call onChange for Dashboard components
        onChange(filterData);
    };

    const handleApplyDateFilter = (startOverride, endOverride) => {
        setDateError('');
        
        const finalStart = startOverride !== undefined ? startOverride : startDate;
        const finalEnd = endOverride !== undefined ? endOverride : endDate;

        // Validate dates are not empty
        if (!finalStart || !finalEnd) {
            setDateError('Both start and end dates are required');
            toast.error('Invalid Dates', {
                description: 'Please select both start and end dates',
                duration: 3000,
            });
            return;
        }

        // Validate date range - max 90 days (approximately 3 months)
        if (maxMonths) {
            const start = new Date(finalStart);
            const end = new Date(finalEnd);
            
            // Calculate difference in days (more accurate than months)
            const diffInMs = end.getTime() - start.getTime();
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
            const maxDays = maxMonths * 30; // Convert months to approximate days (3 months = 90 days)
            
            if (diffInDays > maxDays) {
                setDateError(`Date range cannot exceed ${maxMonths} months (${maxDays} days)`);
                toast.error('Date Range Too Large', {
                    description: `Selected range is ${diffInDays} days. Please select a date range within ${maxDays} days.`,
                    duration: 4000,
                });
                return;
            }
        }

        // Validate start date is not after end date
        if (new Date(finalStart) > new Date(finalEnd)) {
            setDateError('Start date cannot be after end date');
            toast.error('Invalid Date Range', {
                description: 'Start date must be before or equal to end date',
                duration: 3000,
            });
            return;
        }
        
        // Apply the dates
        setAppliedStartDate(finalStart);
        setAppliedEndDate(finalEnd);

        // Emit filters using the new dates
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

            // Safety check: if no accounts selected, reset to default
            if (allSelectedIds.length === 0) {
                console.warn('No accounts selected during date apply, resetting to default');
                resetToDefaultSelection();
                return;
            }

            // Always emit the explicitly collected array of IDs instead of 'ALL'
            const marketplaceIds = allSelectedIds;

            const formattedStartDate = finalStart ? formatDate(finalStart) : '';
            const formattedEndDate = finalEnd ? formatDate(finalEnd) : '';

            onChange({ marketplaceIds, marketplaceNames: allSelectedNames, marketplaceKeys: selectedMarketplaceKeys, startDate: formattedStartDate, endDate: formattedEndDate, hasInactiveAccountSelected, requiresRecalculation });
        }
    };

    // Helper function to ensure date is in YYYY-MM-DD format
    const formatDate = (dateInput) => {
        if (!dateInput) return '';

        // If it's already a string in YYYY-MM-DD format, return as is
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
        }

        // Try to parse and format
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return ''; // Invalid date

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            console.error('Date formatting error:', e);
            return '';
        }
    };

    const toggleMarketplace = (marketplaceKey) => {
        const marketplace = marketplaces.find(m => m.key === marketplaceKey);
        if (!marketplace) return;

        setSelectedMarketplaceKeys([marketplaceKey]);
        setAccountSelections(prevSelections => {
            if (prevSelections[marketplaceKey] && prevSelections[marketplaceKey].length > 0) {
                return prevSelections;
            }
            if (marketplace.accounts && marketplace.accounts.length > 0) {
                const firstAccount = marketplace.accounts[0];
                return {
                    ...prevSelections,
                    [marketplaceKey]: [firstAccount._id]
                };
            }
            return prevSelections;
        });
    };

    const toggleAllMarketplaces = () => {
        if (selectedMarketplaceKeys.length === marketplaces.length) {
            // Instead of clearing all, reset to default
            toast.warning('At least one account must be selected', {
                description: 'Resetting to default account selection'
            });
            resetToDefaultSelection();
        } else {
            // Select all marketplaces
            const allMarketplaceKeys = marketplaces.map(m => m.key);
            setSelectedMarketplaceKeys(allMarketplaceKeys);
            
            // Select all accounts for all marketplaces
            const allAccountSelections = {};
            marketplaces.forEach(m => {
                if (m.accounts && m.accounts.length > 0) {
                    allAccountSelections[m.key] = m.accounts.map(acc => acc._id);
                }
            });
            setAccountSelections(allAccountSelections);
        }
    };

    const toggleAccount = (marketplaceKey, accountId) => {
        setAccountSelections(prev => {
            const current = prev[marketplaceKey] || [];
            if (current.includes(accountId)) {
                const newCurrent = current.filter(id => id !== accountId);
                
                // Check if this would result in no accounts selected anywhere in the CURRENTLY SELECTED marketplaces
                const totalSelectedAfter = selectedMarketplaceKeys.reduce((total, k) => {
                    if (k === marketplaceKey) {
                        return total + newCurrent.length;
                    }
                    const ids = prev[k] || [];
                    return total + ids.length;
                }, 0);
                
                // If would result in zero accounts selected, prevent it
                if (totalSelectedAfter === 0) {
                    toast.warning('At least one account must be selected', {
                        description: 'Cannot deselect the last account'
                    });
                    return prev;
                }
                
                // If this marketplace would have no accounts, remove it from selected marketplaces
                if (newCurrent.length === 0) {
                    setSelectedMarketplaceKeys(prevKeys => prevKeys.filter(k => k !== marketplaceKey));
                }
                
                return { ...prev, [marketplaceKey]: newCurrent };
            } else {
                // Adding an account
                return { ...prev, [marketplaceKey]: [...current, accountId] };
            }
        });
    };

    const toggleAllAccountsForMarketplace = (marketplaceKey) => {
        const marketplace = marketplaces.find(m => m.key === marketplaceKey);
        if (!marketplace) return;

        const current = accountSelections[marketplaceKey] || [];
        if (current.length === marketplace.accounts.length) {
            // Deselecting All: fallback to the first account to ensure at least one remains
            const firstAccount = marketplace.accounts[0];
            if (firstAccount) {
                setAccountSelections(prev => ({ ...prev, [marketplaceKey]: [firstAccount._id] }));
            } else {
                setAccountSelections(prev => ({ ...prev, [marketplaceKey]: [] }));
            }
        } else {
            setAccountSelections(prev => ({
                ...prev,
                [marketplaceKey]: marketplace.accounts.map(acc => acc._id)
            }));
        }
    };

    const resetToDefaultSelection = () => {
        // Reset to first account of first marketplace
        if (marketplaces && marketplaces.length > 0) {
            const firstMarketplace = marketplaces[0];
            if (firstMarketplace.accounts && firstMarketplace.accounts.length > 0) {
                const firstAccount = firstMarketplace.accounts[0];
                setSelectedMarketplaceKeys([firstMarketplace.key]);
                setAccountSelections({
                    [firstMarketplace.key]: [firstAccount._id]
                });
            }
        }
    };

    const removeMarketplace = (marketplaceKey) => {
        // Check if other marketplaces have accounts selected
        const otherMarketplacesHaveAccounts = selectedMarketplaceKeys
            .filter(k => k !== marketplaceKey)
            .some(k => {
                const ids = accountSelections[k] || [];
                return ids.length > 0;
            });
        
        // If this is the last marketplace with accounts, prevent removal
        if (!otherMarketplacesHaveAccounts) {
            toast.warning('At least one account must be selected', {
                description: 'Cannot remove the only selected marketplace'
            });
            return; // Just return, don't reset - keep current selection
        }

        // Safe to remove this marketplace
        const newMarketplaceKeys = selectedMarketplaceKeys.filter(k => k !== marketplaceKey);
        const newSelections = { ...accountSelections };
        delete newSelections[marketplaceKey];
        
        setSelectedMarketplaceKeys(newMarketplaceKeys);
        setAccountSelections(newSelections);
    };

    const clearMarketplaces = () => {
        // Reset to first account of first marketplace
        resetToDefaultSelection();
        toast.info('Reset to Default', {
            description: 'Selection reset to first account of first marketplace',
            duration: 2000,
        });
    };

    const clearDates = () => {
        // Set back to default 90-day range using helper function
        const defaultDates = getDefaultDates();
        
        setStartDate(defaultDates.startDate);
        setEndDate(defaultDates.endDate);
        setAppliedStartDate(defaultDates.startDate);
        setAppliedEndDate(defaultDates.endDate);
        setDateError('');
        
        // Emit filters with default dates
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

            // Safety check: if no accounts selected, reset to default
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
                            Please connect a marketplace in Settings to start filtering your analytics.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-xl shadow-sm border border-slate-200/80 mb-4 animate-in fade-in duration-300 backdrop-blur-sm overflow-visible relative z-50">
            {/* Filter Content */}
            <div className="p-5 overflow-visible">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-visible">
                    {/* Left Side: Marketplace Selector */}
                    <div className="overflow-visible">
                        <div className="flex items-center justify-between mb-4 min-h-[32px]">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-4 bg-brand-600 rounded-full"></div>
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Marketplace & Accounts</h4>
                            </div>
                            {/* Only show Clear if more than one account is selected or default selection is overridden */}
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
                            <div className="relative z-50" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsMarketplaceDropdownOpen(!isMarketplaceDropdownOpen)}
                                    className="group flex flex-shrink-0 items-center justify-center gap-2 px-3 py-1.5 bg-brand-600 text-white border border-brand-600 shadow-sm rounded-lg text-xs font-semibold hover:bg-brand-700 transition-colors"
                                >
                                    <span>Marketplace</span>
                                    <ChevronDown size={16} className={`transition-transform duration-300 ${isMarketplaceDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown Menu */}
                                {isMarketplaceDropdownOpen && (
                                    <div
                                        className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200/80 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden"
                                    >
                                        <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-slate-100">
                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Marketplaces</h4>
                                        </div>
                                        <div className="py-1 max-h-80 overflow-y-auto custom-scrollbar">
                                            {marketplaces.map((marketplace, idx) => (
                                                <div
                                                    key={marketplace.key}
                                                    onClick={() => {
                                                        toggleMarketplace(marketplace.key);
                                                    }}
                                                    className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-all duration-150 group border-l-2 border-transparent hover:border-brand-500 hover:bg-gradient-to-r hover:from-slate-50 hover:to-white"
                                                    style={{ animationDelay: `${idx * 20}ms` }}
                                                >
                                                    <div className="relative">
                                                        <input
                                                            type="radio"
                                                            name="marketplace_selection"
                                                            checked={selectedMarketplaceKeys.includes(marketplace.key)}
                                                            onChange={() => {}}
                                                            className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
                                                        />
                                                    </div>
                                                    <span className="text-sm text-slate-700 flex-1 font-medium group-hover:text-slate-900">{marketplace.key}</span>
                                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-semibold group-hover:bg-brand-100 group-hover:text-brand-700 transition-colors">
                                                        {marketplace.accounts.length}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected Marketplace Pills - Click to Show Accounts */}
                            {selectedMarketplaceKeys.map((marketplaceKey, idx) => {
                                const marketplace = marketplaces.find(m => m.key === marketplaceKey);
                                if (!marketplace) return null;

                                const selectedAccountIds = accountSelections[marketplaceKey] || [];
                                const isExpanded = expandedMarketplace === marketplaceKey;
                                const hasSelectedAccounts = selectedAccountIds.length > 0 && selectedAccountIds.length < marketplace.accounts.length;
                                const hasNoAccounts = selectedAccountIds.length === 0;

                                return (
                                    <div
                                        key={marketplaceKey}
                                        className="relative inline-block animate-in fade-in zoom-in-95 duration-200 z-50"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                        ref={isExpanded ? accountDropdownRef : null}
                                    >
                                        <div
                                            onClick={() => setExpandedMarketplace(isExpanded ? null : marketplaceKey)}
                                            className="group relative inline-flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-brand-500 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                                        >
                                            {/* Indicator Dot */}
                                            <div className={`w-1.5 h-1.5 rounded-full ${hasNoAccounts ? 'bg-slate-400' : hasSelectedAccounts ? 'bg-amber-400' : 'bg-emerald-400'} shadow-sm`}></div>

                                            <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">{marketplaceKey}</span>

                                            {/* Account count badge */}
                                            {selectedAccountIds.length > 0 && (
                                                <span className={`px-1.5 py-0.5 ${selectedAccountIds.length === marketplace.accounts.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} text-xs font-bold rounded`}>
                                                    {selectedAccountIds.length}
                                                </span>
                                            )}

                                            {/* Arrow Icon */}
                                            <ChevronDown
                                                size={16}
                                                className={`text-slate-500 group-hover:text-brand-600 transition-all duration-300 ${isExpanded ? 'rotate-180 text-brand-600' : ''}`}
                                            />


                                            {/* Hover highlight effect */}
                                            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-brand-500/0 to-blue-500/0 group-hover:from-brand-500/5 group-hover:to-blue-500/5 transition-all duration-300 pointer-events-none"></div>
                                        </div>

                                        {/* Account Selection Dropdown */}
                                      {isExpanded && (
    (() => {
        // We'll use a portal-like approach with fixed positioning
        return (
            <>
                <div 
                    className="fixed inset-0 z-[30]" 
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpandedMarketplace(null);
                        setAccountSearchStr('');
                    }} 
                />
                <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200/80 rounded-xl shadow-2xl shadow-slate-900/10 z-[35] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-slate-100">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Accounts for {marketplaceKey}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{marketplace.accounts.length} total accounts</div>
                        <div className="mt-2">
                            <input
                                type="text"
                                placeholder="Search accounts..."
                                value={accountSearchStr}
                                onChange={(e) => setAccountSearchStr(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 placeholder:text-slate-400 bg-white shadow-inner transition-all cursor-text"
                            />
                        </div>
                    </div>
                    <div className="py-1 max-h-48 overflow-y-auto custom-scrollbar">  {/* Reduced max-h-64 to max-h-48 */}
                        {/* Select All Accounts */}
                        {!accountSearchStr && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAllAccountsForMarketplace(marketplaceKey);
                                }}
                                className="px-4 py-2.5 hover:bg-gradient-to-r hover:from-brand-50 hover:to-blue-50 cursor-pointer flex items-center gap-3 border-b border-slate-100 transition-all group"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedAccountIds.length === marketplace.accounts.length}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-2 focus:ring-brand-500/20 pointer-events-none"
                                />
                                <span className="text-sm font-bold text-brand-700 group-hover:text-brand-800">All Accounts</span>
                            </div>
                        )}

                        {marketplace.accounts.filter(a => a.name.toLowerCase().includes(accountSearchStr.toLowerCase())).length === 0 && (
                            <div className="px-4 py-3 text-xs text-slate-500 text-center italic">No accounts found matching "{accountSearchStr}"</div>
                        )}
                        
                        {marketplace.accounts.filter(a => a.name.toLowerCase().includes(accountSearchStr.toLowerCase())).map((account, accIdx) => {
                            const isInactive = account.status === 'inactive';
                            return (
                                <div
                                    key={account._id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAccount(marketplaceKey, account._id);
                                    }}
                                    className={`px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-all duration-150 group border-l-2 border-transparent hover:border-brand-500 hover:bg-gradient-to-r hover:from-slate-50 hover:to-white ${isInactive ? 'opacity-60' : ''}`}
                                    style={{ animationDelay: `${accIdx * 20}ms` }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedAccountIds.includes(account._id)}
                                        onChange={() => {}}
                                        className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-2 focus:ring-brand-500/20 pointer-events-none"
                                    />
                                    <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900">{account.name}</span>
                                    {isInactive && (
                                        <span className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-md tracking-wide">
                                            Deactivated
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Done Button */}
                    <div className="border-t border-slate-100 p-2 bg-slate-50/50">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpandedMarketplace(null);
                                setAccountSearchStr('');
                            }}
                            className="w-full px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:shadow-md active:scale-95"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </>
        );
    })()
)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side: Date Filter */}
                    <div className="overflow-visible mt-4 lg:mt-0">
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
                        
                        <div className="relative select-none z-40 ">
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
                </div>
            </div>
        </div>
    );
};

export default MarketplaceAccountFilter;
