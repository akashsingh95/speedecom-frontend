import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, ArrowUp, ArrowDown, LayoutGrid, List, X } from 'lucide-react';

const SORT_OPTIONS = [
    { key: 'tenantNumericId', label: 'Tenant ID' },
    { key: 'tenantName', label: 'Tenant Name' },
    { key: 'adminName', label: 'Admin Name' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'balance', label: 'Credits' }
];

export default function TenantToolbar({ 
    globalStats, 
    uniqueRMs,
    totalCount,
    currentFilter,
    onChange 
}) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedRM, setSelectedRM] = useState('all');
    const [dateSort, setDateSort] = useState('none');
    const [sortBy, setSortBy] = useState('tenantNumericId');
    const [sortDir, setSortDir] = useState('asc');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('tenantsViewMode') || 'grid');
    
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const sortMenuRef = useRef(null);

    // Close sort menu on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
                setSortMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Emit combined state
    useEffect(() => {
        onChange({ search, filter, selectedRM, dateSort, sortBy, sortDir, viewMode });
    }, [search, filter, selectedRM, dateSort, sortBy, sortDir, viewMode, onChange]);

    // Sync from parent if provided
    useEffect(() => {
        if (currentFilter !== undefined && currentFilter !== filter) {
            setFilter(currentFilter);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFilter]);

    // Derived active chips
    const activeChips = [];
    if (filter !== 'all') {
        const labels = {
            active: 'Active',
            inactive: 'Inactive',
            lowBalance: 'Low balance'
        };
        activeChips.push({ id: 'filter', label: `Filter: ${labels[filter]}` });
    }
    if (selectedRM !== 'all') {
        if (selectedRM === 'unassigned') {
            activeChips.push({ id: 'rm', label: 'RM: Unassigned' });
        } else {
            const rm = uniqueRMs.find(r => r._id === selectedRM);
            if (rm) activeChips.push({ id: 'rm', label: `RM: ${rm.fullName.split(' ')[0]}` });
        }
    }
    if (dateSort !== 'none') {
        activeChips.push({ id: 'dateSort', label: dateSort === 'newer' ? 'Newer first' : 'Older first' });
    }
    if (sortBy !== 'tenantNumericId' || sortDir !== 'asc') {
        const sortLabel = SORT_OPTIONS.find(o => o.key === sortBy)?.label;
        activeChips.push({ id: 'sort', label: `Sort: ${sortLabel} ${sortDir === 'asc' ? 'A→Z' : 'Z→A'}` });
    }
    if (search) {
        activeChips.push({ id: 'search', label: `Search: "${search}"` });
    }

    const clearAll = () => {
        setSearch('');
        setFilter('all');
        setSelectedRM('all');
        setDateSort('none');
        setSortBy('tenantNumericId');
        setSortDir('asc');
    };

    const removeChip = (id) => {
        if (id === 'filter') setFilter('all');
        if (id === 'rm') setSelectedRM('all');
        if (id === 'dateSort') setDateSort('none');
        if (id === 'sort') { setSortBy('tenantNumericId'); setSortDir('asc'); }
        if (id === 'search') setSearch('');
    };

    const getPillStyle = (key) => {
        if (filter === key) {
            if (key === 'active') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            if (key === 'inactive') return 'bg-rose-100 text-rose-700 border-rose-200';
            if (key === 'lowBalance') return 'bg-amber-100 text-amber-700 border-amber-200';
            return 'bg-brand-100 text-brand-700 border-brand-200';
        }
        return 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
    };

    const inactiveCount = globalStats ? globalStats.totalTenants - globalStats.activeCount : 0;

    return (
        <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm">
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
                    
                    {/* Left: Search */}
                    <div className="relative flex-1 w-full xl:max-w-xs shrink-0">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by tenant name, admin..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    {/* Middle: Pill Filters */}
                    <div className="flex flex-wrap items-center gap-2 flex-grow overflow-x-auto no-scrollbar">
                        <button onClick={() => { setFilter('all'); setSelectedRM('all'); }} className={`px-4 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${filter === 'all' && selectedRM === 'all' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                            All
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filter === 'all' && selectedRM === 'all' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{globalStats?.totalTenants || totalCount || 0}</span>
                        </button>
                        <button onClick={() => setFilter('active')} className={`px-4 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${getPillStyle('active')}`}>
                            Active
                            {globalStats?.activeCount !== undefined && <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filter === 'active' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{globalStats.activeCount}</span>}
                        </button>
                        <button onClick={() => setFilter('inactive')} className={`px-4 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${getPillStyle('inactive')}`}>
                            Inactive
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filter === 'inactive' ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>{inactiveCount}</span>
                        </button>
                        <button onClick={() => setFilter('lowBalance')} className={`px-4 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${getPillStyle('lowBalance')}`}>
                            Low balance
                            {globalStats?.lowBalanceCount !== undefined && <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filter === 'lowBalance' ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{globalStats.lowBalanceCount}</span>}
                        </button>

                        {/* RMs Dropdown disguised as a pill */}
                        {uniqueRMs?.length > 0 && (
                            <div className="relative">
                                <select
                                    value={selectedRM}
                                    onChange={(e) => setSelectedRM(e.target.value)}
                                    className={`appearance-none pl-4 pr-7 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none cursor-pointer ${selectedRM !== 'all' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <option value="all">All RMs</option>
                                    <option value="unassigned">Unassigned</option>
                                    {uniqueRMs.map(rm => (
                                        <option key={rm._id} value={rm._id}>{rm.fullName.split(' ')[0]}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${selectedRM !== 'all' ? 'text-cyan-600' : 'text-slate-400'}`} />
                            </div>
                        )}

                        {/* Date Sort Dropdown */}
                        <div className="relative">
                            <select
                                value={dateSort}
                                onChange={(e) => setDateSort(e.target.value)}
                                className={`appearance-none pl-4 pr-7 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none cursor-pointer ${dateSort !== 'none' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <option value="none">Default sort</option>
                                <option value="newer">Newer first</option>
                                <option value="older">Older first</option>
                            </select>
                            <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${dateSort !== 'none' ? 'text-indigo-600' : 'text-slate-400'}`} />
                        </div>
                    </div>

                    {/* Right: Sort and View Toggle */}
                    <div className="flex items-center justify-end gap-3 shrink-0">
                        {/* Sort */}
                        <div className="relative" ref={sortMenuRef}>
                            <button
                                onClick={() => setSortMenuOpen(!sortMenuOpen)}
                                className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-medium transition-colors ${sortMenuOpen ? 'border-brand-300 bg-brand-50 text-brand-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
                            >
                                <span className={sortMenuOpen ? 'text-brand-600' : 'text-slate-500'}>Sort by:</span>
                                <span className="font-semibold">{SORT_OPTIONS.find(o => o.key === sortBy)?.label}</span>
                            </button>
                            {sortMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col">
                                    <div className="p-1.5 border-b border-slate-100 flex flex-col gap-0.5">
                                        {SORT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => setSortBy(opt.key)}
                                                className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${sortBy === opt.key ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                <span>{opt.label}</span>
                                                {sortBy === opt.key && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-1.5 bg-slate-50 flex items-center gap-1.5">
                                        <button 
                                            onClick={() => setSortDir('asc')}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${sortDir === 'asc' ? 'bg-white shadow-sm border border-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-200/50'}`}
                                        >
                                            <ArrowUp size={13} /> A→Z
                                        </button>
                                        <button 
                                            onClick={() => setSortDir('desc')}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${sortDir === 'desc' ? 'bg-white shadow-sm border border-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-200/50'}`}
                                        >
                                            <ArrowDown size={13} /> Z→A
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="w-px h-6 bg-slate-200" />

                        {/* View Toggle */}
                        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/50">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                            >
                                <LayoutGrid size={15} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                            >
                                <List size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Filters Chips */}
            {activeChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                    <span className="text-xs font-semibold text-slate-400 mr-1 uppercase tracking-wider">Filters</span>
                    {activeChips.map(chip => (
                        <div key={chip.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-sm">
                            {chip.label}
                            <button onClick={() => removeChip(chip.id)} className="p-0.5 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors text-slate-400">
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {activeChips.length >= 2 && (
                        <button onClick={clearAll} className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline decoration-brand-300 underline-offset-2 ml-2 transition-colors">
                            Clear all
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}