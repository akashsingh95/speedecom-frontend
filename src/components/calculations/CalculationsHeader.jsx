import React from 'react';
import { ArrowLeft, Eye, EyeOff, Calculator } from 'lucide-react';
import ExportButton from '../ExportButton';
import AdvancedDateRangePicker from '../AdvancedDateRangePicker';
import { getMarketplaceLogo, MARKETPLACE_LOGOS } from '../../utils/marketplaceLogos';
import CalculationAccountFilter from '../CalculationAccountFilter';
import { TOUR } from '../../tour/targets';
import TourLauncher from '../../tour/TourLauncher';
import { PAYMENTS_TOUR } from '../../tour/steps';

/**
 * Shared page header for PaymentsCalculations and MasterSkuCalculations.
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
    setShowColumnSelector,
    tempStartDate,
    tempEndDate,
    handleDateRangeChange,
    handleClearFilter,
    dateError,
    isAmazon,
    isMeesho,
    nullDateFilter,
    handleNullDateSelect,
    availableMonths,
    availableYears,
    marketplaceFilter,
    resolvedMarketplaceNames,
    filterData,
    returnStatusFilter,
    marketplaceIdToName,
    availableMarketplaces,
    onApplyMarketplaceFilters,
    exportProps,
    children
}) => {
    // Only check marketplace & return status for active filters badge (Date filter removed as requested)
    const hasActiveFilters = (marketplaceFilter && Array.isArray(marketplaceFilter) && marketplaceFilter.length > 0) || (returnStatusFilter && returnStatusFilter.length > 0);

    return (
        <div data-tour={TOUR.payments.header} className="sticky top-0 z-[40] bg-slate-50 pt-4 pb-1 mb-2 border-b border-slate-200 shadow-sm">
            {/* ── Row 1: Back button & Marketplace Logo (left) | Action buttons (right) ── */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                {/* Left: Back button + Marketplace Logo Indicator */}
                <div className="flex items-center gap-3">
                    {/* <button
                        type="button"
                        onClick={onBackToDashboard}
                        className="flex items-center gap-2 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-300 hover:text-slate-800 transition-colors text-sm bg-slate-100 hover:bg-slate-200 font-medium"
                    >
                        <ArrowLeft size={18} />
                        <span>Back to Dashboard</span>
                    </button> */}

                    {/* Account Filter Popover */}
                    {availableMarketplaces && availableMarketplaces.length > 0 && (() => {
                        // 1. Filter availableMarketplaces to only show the marketplace(s) of the previously selected accounts
                        const activePlatforms = new Set();
                        if (marketplaceFilter && marketplaceFilter.length > 0) {
                            marketplaceFilter.forEach(accId => {
                                const mp = availableMarketplaces.find(m => m.accounts?.some(a => String(a._id || a.id).trim() === String(accId).trim()));
                                if (mp) activePlatforms.add(mp.key);
                            });
                        }

                        const filteredMarketplaces = (activePlatforms.size > 0)
                            ? availableMarketplaces.filter(mp => activePlatforms.has(mp.key))
                            : availableMarketplaces;

                        // Icons for the currently active marketplace(s), shown on the
                        // closed trigger button itself — not just inside the popover.
                        // Amazon's default logo is a wide wordmark that looks cramped
                        // at this icon size, so use its square variant here only.
                        const activeLogos = Array.from(activePlatforms)
                            .map(key => key.toLowerCase().includes('amazon')
                                ? `${import.meta.env.BASE_URL}assets/amazonsmall.svg`
                                : getMarketplaceLogo(key))
                            .filter(Boolean);

                        // 2. Format button label for max 2 names
                        let buttonLabel = <span className="font-medium">Filter Accounts</span>;
                        if (marketplaceFilter && marketplaceFilter.length > 0) {
                            if (resolvedMarketplaceNames?.length > 2) {
                                buttonLabel = (
                                    <span className="flex items-center font-medium">
                                        <span>{resolvedMarketplaceNames.slice(0, 2).join(', ')}</span>
                                        <span className="ml-1.5 text-[11px] font-medium text-blue-200 underline decoration-blue-300/60 underline-offset-2 hover:text-white hover:decoration-white transition-all cursor-pointer opacity-90 hover:opacity-100">
                                            + {resolvedMarketplaceNames.length - 2} view more
                                        </span>
                                    </span>
                                );
                            } else if (resolvedMarketplaceNames?.length > 0) {
                                buttonLabel = <span className="font-medium">{resolvedMarketplaceNames.join(', ')}</span>;
                            } else {
                                buttonLabel = <span className="font-medium">{marketplaceFilter.length} Account(s)</span>;
                            }
                        }

                        return (
                            <CalculationAccountFilter
                                availableMarketplaces={filteredMarketplaces}
                                marketplaceFilters={marketplaceFilter || []}
                                onApplyFilters={onApplyMarketplaceFilters}
                                buttonLabel={buttonLabel}
                                activeLogos={activeLogos}
                            />
                        );
                    })()}

                    {/* Active Filters (Return Status only) */}
                    {returnStatusFilter?.length > 0 ? (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                            <span className="text-slate-600 font-medium text-[16px]">Active Filters:</span>
                            <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md font-medium text-xs">
                                Return: {returnStatusFilter.length === 1 ? returnStatusFilter[0] : `${returnStatusFilter.length} statuses`}
                            </span>
                        </div>
                    ) : null}

                    {/* Marketplace Icon Display based on Active Filters */}
                    {/* {mpDisplay?.logo && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <img src={mpDisplay.logo} alt={mpDisplay.name} className="w-5 h-5 object-contain" />
                            <span className="text-xs font-semibold text-slate-700">{mpDisplay.name}</span>
                        </div>
                    )} */}
                </div>

                {/* Center: Date Picker */}
                {!loading && (
                    <div className="w-[320px] relative">
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

                {/* Right: Eye Toggle Icon + Settings Icon + Verify Bank + Export */}
                <div className="flex items-center gap-2.5">

                    {onOpenCalculator && (
                        <button
                            type="button"
                            onClick={onOpenCalculator}
                            className="flex items-center justify-center p-2 rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-700 border border-brand-200 cursor-pointer transition-colors shadow-sm"
                            title="Open Price Estimate Calculator"
                        >
                            <Calculator size={20} />
                        </button>
                    )}

                    <button
                        type="button"
                        data-tour={TOUR.payments.settlementsBtn}
                        onClick={onGoToSettlements}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[14px] font-semibold border border-cyan-300/50 shadow-[0_8px_25px_rgba(6,182,212,0.35)] hover:shadow-[0_10px_35px_rgba(6,182,212,0.55)] hover:scale-105 transition-all duration-300"
                    >
                        Verify Bank Received
                    </button>

                    {!loading && (
                        <>
                            {/* Toggle Panel Eye / Eye-off Icon */}
                            <button
                                type="button"
                                data-tour={TOUR.payments.panelToggle}
                                onClick={() => setShowFiltersPanel(prev => !prev)}
                                className={`p-2 rounded-lg border transition-colors shadow-sm cursor-pointer ${showFiltersPanel
                                    ? 'bg-brand-50 border-brand-300 text-brand-700 hover:bg-brand-100'
                                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                                    }`}
                                title={showFiltersPanel ? 'Hide Filters Panel' : 'Show Filters Panel'}
                            >
                                {showFiltersPanel ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>

                        </>
                    )}

                    {!loading && !error && calculations?.length > 0 && exportProps && (
                        <span data-tour={TOUR.payments.exportBtn} className="inline-flex">
                            <ExportButton {...exportProps} />
                        </span>
                    )}

                    {currentView === 'sku-wise' && <TourLauncher tourKey={PAYMENTS_TOUR} label="Tour" />}
                </div>
            </div>

            {/* ── Row 2: Active Filters (left) | Date Picker (right) ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Verify Bank Received Button */}

            </div>
            {children}
        </div>
    );
};

export default CalculationsHeader;