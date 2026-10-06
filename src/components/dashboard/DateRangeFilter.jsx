import React from 'react';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';

/**
 * Reusable date range filter component for list view
 * @param {string} tempStartDate - Current start date value
 * @param {string} tempEndDate - Current end date value
 * @param {Function} setTempStartDate - Setter for start date (or use handleStartDateChange)
 * @param {Function} setTempEndDate - Setter for end date (or use handleEndDateChange)
 * @param {Function} handleStartDateChange - Handler for start date with validation
 * @param {Function} handleEndDateChange - Handler for end date with validation
 * @param {Function} onApply - Handler for apply button
 * @param {Function} onClear - Handler for clear button
 * @param {string} dateError - Error message to display
 */
const DateRangeFilter = ({ 
    tempStartDate, 
    tempEndDate, 
    setTempStartDate, 
    setTempEndDate,
    handleStartDateChange,
    handleEndDateChange, 
    onApply, 
    onClear,
    dateError 
}) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Calendar size={16} />
                    <span>Filter by Date:</span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-600 mb-1">
                            Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={tempStartDate}
                            onChange={handleStartDateChange || ((e) => setTempStartDate(e.target.value))}
                            required
                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                            placeholder="Start Date"
                        />
                    </div>
                    <span className="text-slate-400 mt-5">to</span>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-600 mb-1">
                            End Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={tempEndDate}
                            onChange={handleEndDateChange || ((e) => setTempEndDate(e.target.value))}
                            required
                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                            placeholder="End Date"
                        />
                    </div>
                    <button
                        onClick={onApply}
                        className="px-4 py-1.5 text-sm bg-brand-600 text-white hover:bg-brand-700 rounded-lg transition-colors font-medium flex items-center gap-2 mt-5"
                    >
                        <CheckCircle size={16} />
                        Apply
                    </button>
                    {(tempStartDate || tempEndDate) && (
                        <button
                            onClick={onClear}
                            className="px-4 py-1.5 text-sm bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors font-medium flex items-center gap-2 mt-5"
                        >
                            <XCircle size={16} />
                            Clear
                        </button>
                    )}
                </div>
            </div>
            
            {dateError && (
                <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600 font-medium">{dateError}</p>
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;
