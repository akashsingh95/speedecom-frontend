import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import ExportButton from '../ExportButton';
import AdvancedDateRangePicker from '../AdvancedDateRangePicker';

/**
 * Shared page header for PaymentsCalculations and MasterSkuCalculations.
 *
 * Props:
 *  - currentView        : 'sku-wise' | 'master-sku-wise'
 *  - onViewSwitch(val)  : called when dropdown changes
 *  - onBackToDashboard  : navigate back
 *  - onGoToSettlements  : navigate to settlements page
 *
 *  - loading / error / calculations / settlements (for conditional rendering)
 *  - showFiltersPanel, setShowFiltersPanel
 *  - tempStartDate, tempEndDate, handleDateRangeChange, handleClearFilter
 *  - dateError, isAmazon, nullDateFilter, handleNullDateSelect
 *  - availableMonths, availableYears
 *  - marketplaceFilter, resolvedMarketplaceNames, filterData, nullDateFilter, returnStatusFilter
 *  - marketplaceIdToName
 *  - exportProps: object of props forwarded to ExportButton (optional — SKU page only)
 */
const CalculationsHeader = ({
    currentView,
    onViewSwitch,
    onBackToDashboard,
    onGoToSettlements,
    onOpenCalculator,
    loading,
    error,
    settlements,
    calculations,
    showFiltersPanel,
    setShowFiltersPanel,
    tempStartDate,
    tempEndDate,
    handleDateRangeChange,
    handleClearFilter,
    dateError,
    isAmazon,
    nullDateFilter,
    handleNullDateSelect,
    availableMonths,
    availableYears,
    marketplaceFilter,
    resolvedMarketplaceNames,
    filterData,
    returnStatusFilter,
    marketplaceIdToName,
    exportProps,
}) => {
    const hasActiveFilters = marketplaceFilter || filterData?.startDate || filterData?.endDate || nullDateFilter || returnStatusFilter?.length > 0;

    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const viewDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target)) {
                setIsViewDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    return (
        <div className="mb-6 flex items-center justify-between">
            {/* Left: Back button */}
            <button
                type="button"
                onClick={onBackToDashboard}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft size={20} />
                <span>Back to Dashboard</span>
            </button>

            {/* Centre: Title + View Switcher + Active Filters */}
            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-800">Calculations</h1>
                    <div className="relative z-50 inline-block" ref={viewDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 py-1.5 pl-3 pr-3 rounded font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-pointer shadow-sm hover:border-brand-300 transition-colors"
                        >
                            <span>{currentView === 'sku-wise' ? 'SKU-Wise View' : 'Master-SKU Wise View'}</span>
                            <ChevronDown size={14} className={`transition-transform duration-300 ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isViewDropdownOpen && (
                            <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200/80 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select View</h4>
                                </div>
                                <div className="py-1">
                                    {[
                                        { id: 'sku-wise', label: 'SKU-Wise View' },
                                        { id: 'master-sku-wise', label: 'Master-SKU Wise View' }
                                    ].map(viewOption => (
                                        <div
                                            key={viewOption.id}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (viewOption.id !== currentView) {
                                                    onViewSwitch(viewOption.id);
                                                }
                                                setIsViewDropdownOpen(false);
                                            }}
                                            className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-all duration-150 group border-l-2 border-transparent hover:border-brand-500 hover:bg-gradient-to-r hover:from-slate-50 hover:to-white"
                                        >
                                            <div className="relative">
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${currentView === viewOption.id ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}>
                                                    {currentView === viewOption.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                </div>
                                            </div>
                                            <span className={`text-sm flex-1 font-medium group-hover:text-slate-900 ${currentView === viewOption.id ? 'text-brand-700' : 'text-slate-700'}`}>
                                                {viewOption.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {hasActiveFilters && (
                    <div className="mt-2 flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-slate-600 font-medium">Active Filters:</span>
                        {marketplaceFilter && Array.isArray(marketplaceFilter) && marketplaceFilter.length > 0 && (
                            <span className="px-2 py-1 bg-brand-100 text-brand-800 rounded">
                                {resolvedMarketplaceNames?.length > 0
                                    ? resolvedMarketplaceNames.join(', ')
                                    : `${marketplaceFilter.length} Account${marketplaceFilter.length > 1 ? 's' : ''}`
                                }
                            </span>
                        )}
                        {(nullDateFilter || filterData?.startDate || filterData?.endDate) && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                                {nullDateFilter ? 'Date: N/A' : `Date: ${filterData?.startDate || '...'} to ${filterData?.endDate || '...'}`}
                            </span>
                        )}
                        {returnStatusFilter?.length > 0 && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                                Return: {returnStatusFilter.length === 1 ? returnStatusFilter[0] : `${returnStatusFilter.length} statuses`}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Date picker (compact), toggle filter panel, settlements, export */}
            <div className="flex items-center gap-3">
                {!loading && (
                    <>
                        {!showFiltersPanel && (
                            <div className="w-[360px] relative">
                                <AdvancedDateRangePicker
                                    startDate={tempStartDate}
                                    endDate={tempEndDate}
                                    onChange={handleDateRangeChange}
                                    onClear={handleClearFilter}
                                    maxDays={92}
                                    alwaysOpen={false}
                                    nullDateActive={isAmazon ? nullDateFilter : false}
                                    onNullDate={isAmazon ? handleNullDateSelect : null}
                                    availableMonths={availableMonths}
                                    availableYears={availableYears}
                                    defaultMonthOpen={true}
                                />
                                {dateError && (
                                    <div className="absolute top-[105%] left-0 w-full px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg shadow-sm z-50">
                                        <p className="text-[10px] text-red-600 font-medium">{dateError}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowFiltersPanel(prev => !prev)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${showFiltersPanel
                                ? 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                                : 'bg-brand-50 border-brand-300 text-brand-700 hover:bg-brand-100'
                                }`}
                            title={showFiltersPanel ? 'Hide summary & filters' : 'Show summary & filters'}
                        >
                            {showFiltersPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {showFiltersPanel ? 'Hide Panel' : 'Show Panel'}
                        </button>
                    </>
                )}

                {onOpenCalculator && (
                    <button
                        type="button"
                        onClick={onOpenCalculator}
                        className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg bg-brand-700 hover:bg-brand-800 text-white border-0 cursor-pointer text-[13px] font-semibold transition-colors shadow-sm"
                        title="Open Price Estimate"
                    >
                        <Calculator size={20} className="text-white" />
                    </button>
                )}

                <button
                    type="button"
                    onClick={onGoToSettlements}
                    className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg bg-brand-600 hover:bg-brand-700 text-white border-0 cursor-pointer text-[13px] font-semibold transition-colors"
                    title="View detailed settlements breakdown filtered by payment date"
                >
                    Verify Bank Received
                </button>

                {!loading && !error && calculations?.length > 0 && exportProps && (
                    <ExportButton {...exportProps} />
                )}
            </div>
        </div>
    );
};

export default CalculationsHeader;
