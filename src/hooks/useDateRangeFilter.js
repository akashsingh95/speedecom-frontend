import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for managing date range filters with a default 90-day window
 * @param {Function} onChange - Callback when filters change (receives {marketplaceIds, startDate, endDate})
 * @param {Object} initialFilterData - Initial filter data (marketplaceIds, startDate, endDate)
 * @param {String} defaultRangeType - '90days' or 'lastMonth' (default: '90days')
 * @returns {Object} - Hook state and handlers
 */
export const useDateRangeFilter = (onChange, initialFilterData = {}, defaultRangeType = '90days', storagePrefix = 'dashboard') => {
    // Helper function to get default date range
    const getDefaultDates = () => {
        const today = new Date();
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (defaultRangeType === 'lastMonth') {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return {
                startDate: formatDate(start),
                endDate: formatDate(end)
            };
        }

        // Default 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(today.getDate() - 90);
        return {
            startDate: formatDate(ninetyDaysAgo),
            endDate: formatDate(today)
        };
    };
    
    const defaultDates = getDefaultDates();
    
    // Main filter state
    const [filterData, setFilterData] = useState(() => {
        let savedMarketplaces = null;
        let savedStartDate = null;
        let savedEndDate = null;
        
        try {
            // Namespaced per tab, matching MarketplaceAccountFilter's own storage key —
            // otherwise every tab's initial marketplaceIds would seed from one shared key
            // (used elsewhere for the Uploads page's last-selected marketplace) and flash
            // stale/mismatched data before the tab's real selection loads.
            const marketplacesKey = storagePrefix ? `${storagePrefix}SelectedMarketplaces` : 'dashboardSelectedMarketplaces';
            const savedIds = localStorage.getItem(marketplacesKey);
            if (savedIds) savedMarketplaces = JSON.parse(savedIds);
            
            savedStartDate = localStorage.getItem(`${storagePrefix}StartDate`);
            savedEndDate = localStorage.getItem(`${storagePrefix}EndDate`);
        } catch (e) {}

        const finalInitialData = { ...initialFilterData };
        
        return {
            marketplaceIds: finalInitialData.marketplaceIds?.length ? finalInitialData.marketplaceIds : (savedMarketplaces || []),
            startDate: finalInitialData.startDate || savedStartDate || defaultDates.startDate,
            endDate: finalInitialData.endDate || savedEndDate || defaultDates.endDate,
            ...finalInitialData
        };
    });
    
    // Temporary date state (for input fields before applying)
    const [tempStartDate, setTempStartDate] = useState(() => filterData.startDate);
    const [tempEndDate, setTempEndDate] = useState(() => filterData.endDate);
    
    // Error state for date validation
    const [dateError, setDateError] = useState('');
    
    // Track if this is the initial mount
    const isInitialMount = useRef(true);
    
    // Initialize temp dates when filterData dates change externally
    useEffect(() => {
        if (filterData.startDate && filterData.endDate) {
            setTempStartDate(filterData.startDate);
            setTempEndDate(filterData.endDate);
        }
    }, [filterData.startDate, filterData.endDate]);
    
    // Handler to apply date filter
    const handleApplyDateFilter = () => {
        setDateError('');
        
        // Validate dates are not empty
        if (!tempStartDate || !tempEndDate) {
            const defaultDates = getDefaultDates();
            setTempStartDate(defaultDates.startDate);
            setTempEndDate(defaultDates.endDate);
            setFilterData({ ...filterData, startDate: defaultDates.startDate, endDate: defaultDates.endDate });
            
            toast.warning('Date Cannot Be Empty', {
                description: 'Dates reset to default 90-day range.',
                duration: 2500,
            });
            return;
        }
        
        // Validate date range - max 90 days (3 months)
        const start = new Date(tempStartDate);
        const end = new Date(tempEndDate);
        
        // Validate start date is not after end date
        if (start > end) {
            setDateError('Start date cannot be after end date');
            toast.error('Invalid Date Range', {
                description: 'Start date must be before or equal to end date',
                duration: 3000,
            });
            return;
        }
        
        // Calculate difference in days
        const diffInMs = end.getTime() - start.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        
        // Check if exceeds 90 days
        if (diffInDays > 90) {
            setDateError('Date range cannot exceed 3 months (90 days)');
            toast.error('Date Range Too Large', {
                description: `Selected range is ${diffInDays} days. Please select a date range within 90 days.`,
                duration: 4000,
            });
            return;
        }
        
        // Apply the dates
        setFilterData({ ...filterData, startDate: tempStartDate, endDate: tempEndDate });
    };
    
    // Handler to clear date filter (reset to defaults)
    const handleClearDateFilter = () => {
        const defaultDates = getDefaultDates();
        setTempStartDate(defaultDates.startDate);
        setTempEndDate(defaultDates.endDate);
        setFilterData({ ...filterData, startDate: defaultDates.startDate, endDate: defaultDates.endDate });
        setDateError('');
        
        toast.info('Dates Reset', {
            description: 'Date range reset to default 90-day period.',
            duration: 2000,
        });
    };
    
    // Handler for marketplace/account filter changes
    const handleFilterChange = (filters) => {
        setFilterData(filters);
    };
    
    // Handler for start date change with immediate validation
    const handleStartDateChange = (e) => {
        const newValue = e.target.value;
        
        if (!newValue) {
            const defaultDates = getDefaultDates();
            setTempStartDate(defaultDates.startDate);
            setTempEndDate(defaultDates.endDate);
            setDateError('');
            
            toast.warning('Date Cannot Be Empty', {
                description: 'Start date reset to default.',
                duration: 2000,
            });
            return;
        }
        
        setTempStartDate(newValue);
        setDateError('');
    };
    
    // Handler for end date change with immediate validation
    const handleEndDateChange = (e) => {
        const newValue = e.target.value;
        
        if (!newValue) {
            const defaultDates = getDefaultDates();
            setTempStartDate(defaultDates.startDate);
            setTempEndDate(defaultDates.endDate);
            setDateError('');
            
            toast.warning('Date Cannot Be Empty', {
                description: 'End date reset to default.',
                duration: 2000,
            });
            return;
        }
        
        setTempEndDate(newValue);
        setDateError('');
    };
    // Derived state
    const hasMarketplacesSelected = !!filterData.marketplaceIds?.length;
    
    return {
        // State
        filterData,
        hasMarketplacesSelected,
        tempStartDate,
        tempEndDate,
        dateError,
        
        // Setters
        setFilterData,
        setTempStartDate,
        setTempEndDate,
        setDateError,
        
        // Handlers
        handleApplyDateFilter,
        handleClearDateFilter,
        handleFilterChange,
        handleStartDateChange,
        handleEndDateChange,
        
        // Utilities
        getDefaultDates
    };
};
