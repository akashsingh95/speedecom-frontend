import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';

const ViewToggle = ({ view, onViewChange, disableListView = false, disableGridView = false, listViewMessage = "List view is not available", gridViewMessage = "Grid view is not available", gridLabel = "Grid", listLabel = "List" }) => {
    const handleListViewClick = () => {
        if (disableListView) {
            toast.info('List View Not Available', {
                description: listViewMessage,
                duration: 3000,
            });
        } else {
            onViewChange('list');
        }
    };

    const handleGridViewClick = () => {
        if (disableGridView) {
            toast.info('Grid View Not Available', {
                description: gridViewMessage,
                duration: 3000,
            });
        } else {
            onViewChange('grid');
        }
    };

    return (
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
                onClick={handleGridViewClick}
                disabled={disableGridView}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    view === 'grid' && !disableGridView
                        ? 'bg-white text-brand-600 shadow-sm'
                        : disableGridView 
                            ? 'text-slate-400 cursor-not-allowed opacity-50' 
                            : 'text-slate-600 hover:text-slate-800'
                }`}
                title={disableGridView ? gridViewMessage : "Grid View"}
            >
                <LayoutGrid size={16} />
                <span className="hidden sm:inline">{gridLabel}</span>
            </button>
            <button
                onClick={handleListViewClick}
                disabled={disableListView}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    view === 'list' && !disableListView
                        ? 'bg-white text-brand-600 shadow-sm'
                        : disableListView 
                            ? 'text-slate-400 cursor-not-allowed opacity-50' 
                            : 'text-slate-600 hover:text-slate-800'
                }`}
                title={disableListView ? listViewMessage : "List View"}
            >
                <List size={16} />
                <span className="hidden sm:inline">{listLabel}</span>
            </button>
        </div>
    );
};

export default ViewToggle;
