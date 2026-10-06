import React, { createContext, useContext, useState, useEffect } from 'react';

const MarketplaceContext = createContext();

export const useMarketplace = () => {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error('useMarketplace must be used within MarketplaceProvider');
  }
  return context;
};

export const MarketplaceProvider = ({ children }) => {
  // Active filters from MarketplaceAccountFilter
  const [activeFilters, setActiveFilters] = useState({
    marketplaceIds: [], // Array of selected marketplace account IDs
    marketplaceNames: [], // Array of selected marketplace names (e.g., "Amazon India - Account 1")
    startDate: '', // Formatted start date
    endDate: '', // Formatted end date
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Load persisted filters from localStorage on mount
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem('speedyAgentFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        setActiveFilters(parsed);
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    }
  }, []);

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('speedyAgentFilters', JSON.stringify(activeFilters));
    } catch (error) {
      console.error('Failed to save filters:', error);
    }
  }, [activeFilters]);

  // Update filters (called by MarketplaceAccountFilter)
  const updateFilters = (newFilters) => {
    setActiveFilters({
      marketplaceIds: newFilters.marketplaceIds || [],
      marketplaceNames: newFilters.marketplaceNames || [],
      startDate: newFilters.startDate || '',
      endDate: newFilters.endDate || '',
    });
  };

  // Clear all filters (reset to empty state)
  const clearFilters = () => {
    setActiveFilters({
      marketplaceIds: [],
      marketplaceNames: [],
      startDate: '',
      endDate: '',
    });
  };

  // Check if filters are applied (has marketplace selections)
  const hasActiveFilters = () => {
    return activeFilters.marketplaceIds.length > 0;
  };

  // Get human-readable filter summary
  const getFilterSummary = () => {
    if (!hasActiveFilters()) return 'All Marketplaces';
    
    const count = activeFilters.marketplaceIds.length;
    if (count === 1) {
      return activeFilters.marketplaceNames[0] || '1 Marketplace';
    }
    return `${count} Marketplaces`;
  };

  const value = {
    activeFilters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    getFilterSummary,
    refreshTrigger,
    triggerRefresh,
  };

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
};
