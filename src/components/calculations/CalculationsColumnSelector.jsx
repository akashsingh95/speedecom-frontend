import React from 'react';
import { Columns, GripVertical } from 'lucide-react';

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
    columnOrder,
    visibleColumns,
    visibleCount,
    selectorMode,
    setSelectorMode,
    show,
    setShow,
    onToggle,
    onSelectAll,
    onDeselectAll,
    onReorder,
    onResetColumnOrder,
    dragOver,
    setDragOver,
    dragItemRef,
    containerRef,
    COLUMN_LABELS,
    isMyntra,
    pinnedCol = 'sku',
}) => {
    return (
        <div className="w-full flex flex-col">
            <h2 className="text-base font-semibold text-slate-800 mb-2">Columns</h2>
            <div className="relative" ref={containerRef}>
                <button
                    onClick={() => setShow(!show)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-white rounded-lg shadow-sm border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <Columns size={18} />
                    <span className="text-xs">Select Columns</span>
                    <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">{visibleCount}</span>
                </button>

                {show && (
                    <div className="absolute right-0 mt-2 w-full bg-white rounded-lg shadow-lg border border-slate-200 z-50 max-h-[28rem] flex flex-col">
                        {/* Sticky header with mode tabs */}
                        <div className="sticky top-0 bg-white border-b border-slate-200 p-3 z-10 flex-shrink-0">
                            <div className="flex items-center gap-1 mb-2">
                                <button
                                    onClick={() => setSelectorMode('reorder')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${selectorMode === 'reorder'
                                        ? 'bg-brand-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <GripVertical size={13} />
                                    Reorder
                                </button>
                                <button
                                    onClick={() => setSelectorMode('select')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${selectorMode === 'select'
                                        ? 'bg-brand-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <Columns size={13} />
                                    Select
                                </button>
                            </div>
                            {selectorMode === 'select' && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">Toggle column visibility</span>
                                    <div className="flex gap-2">
                                        <button onClick={onSelectAll} className="text-xs text-brand-600 hover:text-brand-700 font-medium">All</button>
                                        <span className="text-slate-300">|</span>
                                        <button onClick={onDeselectAll} className="text-xs text-slate-600 hover:text-slate-700 font-medium">None</button>
                                    </div>
                                </div>
                            )}
                            {selectorMode === 'reorder' && (
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-400">Drag to reorder visible columns</p>
                                    <button
                                        onClick={onResetColumnOrder}
                                        className="text-xs text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap ml-2"
                                    >
                                        Reset Default
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Reorder mode */}
                        {selectorMode === 'reorder' && (
                            <div className="p-2 overflow-y-auto">
                                {(columnOrder.length > 0 ? columnOrder : allColumns)
                                    .filter(col => allColumns.includes(col) && visibleColumns[col] !== false)
                                    .map(col => (
                                        <div
                                            key={col}
                                            draggable={col !== pinnedCol}
                                            onDragStart={() => { dragItemRef.current = col; }}
                                            onDragOver={(e) => { e.preventDefault(); if (col !== pinnedCol) setDragOver(col); }}
                                            onDrop={() => {
                                                if (dragItemRef.current && dragItemRef.current !== col) {
                                                    onReorder(dragItemRef.current, col);
                                                }
                                                setDragOver(null);
                                            }}
                                            onDragEnd={() => { dragItemRef.current = null; setDragOver(null); }}
                                            className={`flex items-center gap-3 px-3 py-2 rounded transition-colors select-none ${col === pinnedCol
                                                ? 'opacity-50 cursor-not-allowed'
                                                : dragOver === col
                                                    ? 'bg-brand-50 border border-brand-300 cursor-grabbing'
                                                    : 'hover:bg-slate-50 cursor-grab'
                                            }`}
                                        >
                                            <GripVertical size={14} className="text-slate-400 flex-shrink-0" />
                                            <span className="text-sm text-slate-700 flex-1">{col === 'profit_loss' && isMyntra ? 'Profit / Loss' : (COLUMN_LABELS[col] || col)}</span>
                                            {col === pinnedCol && (
                                                <span className="text-xs text-slate-400">Required</span>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}

                        {/* Select mode */}
                        {selectorMode === 'select' && (
                            <div className="p-2 overflow-y-auto">
                                {allColumns.map(col => (
                                    <label
                                        key={col}
                                        className={`flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-50 cursor-pointer transition-colors ${col === pinnedCol ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns[col] !== false}
                                                onChange={() => onToggle(col)}
                                                disabled={col === pinnedCol}
                                                className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                                            />
                                        </div>
                                        <span className="text-sm text-slate-700 flex-1">{col === 'profit_loss' && isMyntra ? 'Profit / Loss' : (COLUMN_LABELS[col] || col)}</span>
                                        {col === pinnedCol && (
                                            <span className="text-xs text-slate-400">Required</span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalculationsColumnSelector;
