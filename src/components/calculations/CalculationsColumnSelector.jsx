import React from 'react';
import { Settings, X } from 'lucide-react';

/**
 * Shared Column Selector panel (visibility + drag-reorder).
 *
 * Props:
 *  - allColumns         : string[] — ordered full column list for this page
 *  - columnOrder        : string[] — current drag order
 *  - visibleColumns     : { [col]: boolean }
 *  - visibleCount       : number — count of visible columns (for badge)
 *  - selectorMode       : 'reorder' | 'select'
 *  - setSelectorMode
 *  - show               : boolean — whether the popover is open
 *  - setShow
 *  - onToggle(col)      : toggle visibility of a column
 *  - onSelectAll()
 *  - onDeselectAll()
 *  - onReorder(draggedCol, targetCol)
 *  - dragOver           : string | null
 *  - setDragOver
 *  - dragItemRef        : { current: string | null }
 *  - containerRef       : ref for click-outside detection
 *  - COLUMN_LABELS      : { [col]: string }
 *  - pinnedCol          : string — column that cannot be hidden (default: 'sku')
 */
const CalculationsColumnSelector = ({
    allColumns,
    visibleColumns,
    visibleCount,
    show,
    setShow,
    onToggle,
    onSelectAll,
    onDeselectAll,
    containerRef,
    COLUMN_LABELS,
    isMyntra,
    pinnedCol = 'sku',
}) => {
    const [searchQuery, setSearchQuery] = React.useState('');
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                ref={containerRef}
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                            <Settings size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Column Settings</h3>
                            <p className="text-xs text-slate-500">Manage visible columns ({visibleCount} selected)</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShow(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Controls Bar */}
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">Select Columns</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={onSelectAll} disabled={visibleCount === allColumns.length} className={`text-xs ${visibleCount === allColumns.length ? 'text-gray-400' : 'text-brand-600 hover:text-brand-700'} font-semibold`}>Select All</button>
                        <span className="text-slate-300">|</span>
                        <button onClick={onDeselectAll} className="text-xs text-slate-600 hover:text-slate-800 font-semibold">Deselect All</button>
                    </div>
                </div>

                {/* Modal Content / Column Grid */}
                <div className="p-6 overflow-y-auto flex-1 max-h-[60vh]">
                    <div className="space-y-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search columns by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {allColumns
                                .filter(col => (COLUMN_LABELS[col] || col).toLowerCase().includes(searchQuery.toLowerCase()))
                                .map(col => (
                                    <label
                                        key={col}
                                        className={`flex items-center gap-3 px-4 py-2.5 border rounded-xl hover:bg-slate-50 cursor-pointer transition-all ${col === pinnedCol ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-brand-300'
                                            }`}
                                    >
                                        <input
                                                type="checkbox"
                                                checked={visibleColumns[col] !== false}
                                                onChange={() => onToggle(col)}
                                                disabled={col === pinnedCol}
                                                className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                                            />
                                        <span className="text-sm font-medium text-slate-700 flex-1">{col === 'profit_loss' && isMyntra ? 'Profit / Loss' : (COLUMN_LABELS[col] || col)}</span>
                                        {col === pinnedCol && (
                                            <span className="text-xs font-medium text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-md">Required</span>
                                        )}
                                    </label>
                                ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setShow(false)}
                        className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalculationsColumnSelector;
