import React, { useState } from 'react';
import { Columns, X, Search, GripVertical } from 'lucide-react';
import ConfirmModal from '../ConfirmModal';

/**
 * Right Sidebar Add Column Selector Modal
 */
const AddColumnSidebar = ({
    allColumns,
    columnOrder,
    visibleColumns,
    visibleCount,
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
    pinnedCols = ['sku'],
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('select'); // 'select' or 'reorder'
    const [selectedForReorder, setSelectedForReorder] = useState([]);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    if (!show) return null;

    // Filter by search query (for select mode)
    const filteredColumns = allColumns.filter(col =>
        (COLUMN_LABELS[col] || col).toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Split into selected and unselected, maintaining order for selected
    const selectedCols = (columnOrder.length > 0 ? columnOrder : allColumns)
        .filter(col => filteredColumns.includes(col) && visibleColumns[col] !== false);

    const unselectedCols = filteredColumns.filter(col => visibleColumns[col] === false);

    const renderColumn = (col) => (
        <label
            key={col}
            className={`flex items-center gap-3 px-4 py-2.5 border rounded-xl hover:bg-slate-50 cursor-pointer transition-all ${pinnedCols.includes(col) ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-brand-300'
                }`}
        >
            <input
                type="checkbox"
                checked={visibleColumns[col] !== false}
                onChange={() => onToggle(col)}
                disabled={pinnedCols.includes(col)}
                className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                {col === 'profit_loss' && isMyntra ? 'Profit / Loss' : (COLUMN_LABELS[col] || col)}
            </span>
            {pinnedCols.includes(col) && (
                <span className="text-xs font-medium text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-md">Required</span>
            )}
        </label>
    );

    return (
        <div className="absolute right-0 top-[100%] h-[calc(100vh-110px)] z-[50] flex justify-end animate-in fade-in duration-200 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.1)]">
            <div
                ref={containerRef}
                className="bg-white border-l border-slate-200 w-[320px] sm:w-[380px] h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 rounded-bl-xl"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-50 to-white px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                            <Columns size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Columns</h3>
                            <p className="text-xs text-slate-500">{visibleCount} visible columns</p>
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

                {/* Tabs & Actions */}
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col gap-3 flex-shrink-0">
                    {/* Tabs */}
                    <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-lg self-start">
                        <button
                            onClick={() => setActiveTab('select')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'select'
                                ? 'bg-white text-brand-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            <Columns size={14} />
                            Add Columns
                        </button>
                        <button
                            onClick={() => setActiveTab('reorder')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'reorder'
                                ? 'bg-white text-brand-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            <GripVertical size={14} />
                            Drag Column
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end">
                        {activeTab === 'select' && (
                            <div className="flex items-center gap-2">
                                <button onClick={onSelectAll} disabled={visibleCount === allColumns.length} className={`text-xs ${visibleCount === allColumns.length ? 'text-gray-400' : 'text-brand-600 hover:text-brand-700'} font-semibold`}>Select All</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={onDeselectAll} className="text-xs text-slate-600 hover:text-slate-800 font-semibold">Deselect All</button>
                            </div>
                        )}
                        {activeTab === 'reorder' && (
                            <button
                                onClick={() => setShowResetConfirm(true)}
                                className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
                            >
                                Reset Order
                            </button>
                        )}
                    </div>
                </div>

                {showResetConfirm && (
                    <ConfirmModal
                        isOpen={true}
                        onClose={() => setShowResetConfirm(false)}
                        onConfirm={() => {
                            if (onResetColumnOrder) onResetColumnOrder();
                            setShowResetConfirm(false);
                        }}
                        title="Reset Column Order"
                        message="Are you sure you want to reset the column order to default?"
                        confirmText="OK"
                        cancelText="Cancel"
                    />
                )}

                {/* Content */}
                {activeTab === 'select' ? (
                    <>
                        {/* Search */}
                        <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0 relative">
                            <input
                                type="text"
                                placeholder="Search columns..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:bg-white transition-colors"
                            />
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>

                        {/* Content List for Select */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-slate-50/30">
                            {/* Selected Columns */}
                            {selectedCols.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Visible Columns</h4>
                                    <div className="flex flex-col gap-2">
                                        {selectedCols.map(renderColumn)}
                                    </div>
                                </div>
                            )}

                            {/* Unselected Columns */}
                            {unselectedCols.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Hidden Columns</h4>
                                    <div className="flex flex-col gap-2">
                                        {unselectedCols.map(renderColumn)}
                                    </div>
                                </div>
                            )}

                            {selectedCols.length === 0 && unselectedCols.length === 0 && (
                                <div className="text-center py-8 text-sm text-slate-500">
                                    No columns match your search.
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="p-5 overflow-y-auto flex-1 bg-slate-50/30">
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-xs text-slate-500">Select multiple items using checkboxes, then drag to change table column order.</p>
                                {selectedForReorder.length > 0 && (
                                    <button
                                        onClick={() => setSelectedForReorder([])}
                                        className="text-[10px] text-brand-600 hover:text-brand-700 font-semibold"
                                    >
                                        Clear Selection
                                    </button>
                                )}
                            </div>
                            {(columnOrder.length > 0 ? columnOrder : allColumns)
                                .filter(col => allColumns.includes(col) && visibleColumns[col] !== false)
                                .map(col => (
                                    <div
                                        key={col}
                                        draggable={!pinnedCols.includes(col)}
                                        onDragStart={(e) => {
                                            if (!selectedForReorder.includes(col)) {
                                                if (dragItemRef) dragItemRef.current = [col];
                                            } else {
                                                if (dragItemRef) dragItemRef.current = selectedForReorder;
                                            }
                                        }}
                                        onDragOver={(e) => { e.preventDefault(); if (!pinnedCols.includes(col) && setDragOver) setDragOver(col); }}
                                        onDrop={() => {
                                            if (dragItemRef && dragItemRef.current && onReorder) {
                                                onReorder(dragItemRef.current, col);
                                            }
                                            if (setDragOver) setDragOver(null);
                                        }}
                                        onDragEnd={() => { if (dragItemRef) dragItemRef.current = null; if (setDragOver) setDragOver(null); }}
                                        className={`flex items-center gap-3 px-4 py-2 border rounded-xl transition-all select-none ${pinnedCols.includes(col)
                                            ? 'opacity-50 border-slate-200 cursor-not-allowed bg-slate-50'
                                            : dragOver === col
                                                ? 'bg-brand-50 border-brand-400 shadow-md cursor-grabbing scale-[1.01]'
                                                : selectedForReorder.includes(col)
                                                    ? 'bg-blue-50 border-blue-300 shadow-sm cursor-grab hover:bg-blue-100'
                                                    : 'bg-white hover:bg-slate-100/80 border-slate-200 cursor-grab hover:border-slate-300'
                                            }`}
                                    >
                                        {!pinnedCols.includes(col) && (
                                            <input
                                                type="checkbox"
                                                checked={selectedForReorder.includes(col)}
                                                onChange={() => {
                                                    if (selectedForReorder.includes(col)) {
                                                        setSelectedForReorder(prev => prev.filter(c => c !== col));
                                                    } else {
                                                        setSelectedForReorder(prev => [...prev, col]);
                                                    }
                                                }}
                                                className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                        <GripVertical size={16} className="text-slate-400 flex-shrink-0" />
                                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                                            {col === 'profit_loss' && isMyntra ? 'Profit / Loss' : (COLUMN_LABELS[col] || col)}
                                        </span>
                                        {pinnedCols.includes(col) && (
                                            <span className="text-xs font-medium text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-md">Required</span>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="bg-white px-5 py-4 border-t border-slate-200 flex justify-end flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button
                        type="button"
                        onClick={() => setShow(false)}
                        className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-brand-500/20 transition-all hover:-translate-y-0.5 w-full"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddColumnSidebar;
