/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Popover } from '@headlessui/react';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const parse = (s) => {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const isSameDay = (a, b) => a && b && fmt(a) === fmt(b);
const isInRange = (day, start, end) => {
    if (!start || !end) return false;
    return day.getTime() > start.getTime() && day.getTime() < end.getTime();
};

const getPresets = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return [
        { label: 'This month',   getValue: () => ({ min: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), max: fmt(today) }) },
        { label: 'Last month',   getValue: () => { const s = new Date(today.getFullYear(), today.getMonth() - 1, 1); const e = new Date(today.getFullYear(), today.getMonth(), 0); return { min: fmt(s), max: fmt(e) }; } },
        { label: 'Last 3 months',getValue: () => { const s = new Date(today.getFullYear(), today.getMonth() - 3, 1); const e = new Date(today.getFullYear(), today.getMonth(), 0); return { min: fmt(s), max: fmt(e) }; } },
        { label: 'This quarter', getValue: () => { const sm = Math.floor(today.getMonth() / 3) * 3; return { min: fmt(new Date(today.getFullYear(), sm, 1)), max: fmt(today) }; } },
        { label: 'Last quarter', getValue: () => { const sm = Math.floor(today.getMonth() / 3) * 3 - 3; return { min: fmt(new Date(today.getFullYear(), sm, 1)), max: fmt(new Date(today.getFullYear(), sm + 3, 0)) }; } },
        { label: 'Last 6 months',getValue: () => { const s = new Date(today.getFullYear(), today.getMonth() - 6, 1); const e = new Date(today.getFullYear(), today.getMonth(), 0); return { min: fmt(s), max: fmt(e) }; } },
        { label: 'Custom',       getValue: () => null },
    ];
};

// ─── Calendar grid ────────────────────────────────────────────────────────────
const Calendar = ({ startDate, endDate, onChange, maxDays }) => {
    const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);
    const initial = parse(startDate) || today;
    const [viewYear, setViewYear] = useState(initial.getFullYear());
    const [viewMonth, setViewMonth] = useState(initial.getMonth());
    const [hoverDate, setHoverDate] = useState(null);
    const [selectingEnd, setSelectingEnd] = useState(!!startDate && !endDate);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const pickerRef = useRef(null);

    const start = parse(startDate);
    const end   = parse(endDate);

    useEffect(() => {
        if (start) { setViewYear(start.getFullYear()); setViewMonth(start.getMonth()); }
    }, [startDate]);  

    useEffect(() => {
        const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowMonthPicker(false); };
        if (showMonthPicker) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMonthPicker]);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1);
        const lastDay  = new Date(viewYear, viewMonth + 1, 0);
        const startPad = firstDay.getDay();
        const days = [];
        const prevLast = new Date(viewYear, viewMonth, 0).getDate();
        for (let i = startPad - 1; i >= 0; i--) days.push({ date: new Date(viewYear, viewMonth - 1, prevLast - i), isCurrentMonth: false });
        for (let d = 1; d <= lastDay.getDate(); d++) days.push({ date: new Date(viewYear, viewMonth, d), isCurrentMonth: true });
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) days.push({ date: new Date(viewYear, viewMonth + 1, i), isCurrentMonth: false });
        if (days.length > 35 && !days.slice(35).some(d => d.isCurrentMonth)) days.splice(35);
        return days;
    }, [viewYear, viewMonth]);

    const yearOptions = useMemo(() => {
        const cur = today.getFullYear();
        return Array.from({ length: 5 }, (_, i) => cur - i);
    }, [today]);

    const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
    const nextMonth = () => {
        const nM = viewMonth === 11 ? 0 : viewMonth + 1;
        const nY = viewMonth === 11 ? viewYear + 1 : viewYear;
        if (nY > today.getFullYear() || (nY === today.getFullYear() && nM > today.getMonth())) return;
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1);
    };
    const isNextDisabled = useMemo(() => {
        const nM = viewMonth === 11 ? 0 : viewMonth + 1;
        const nY = viewMonth === 11 ? viewYear + 1 : viewYear;
        return nY > today.getFullYear() || (nY === today.getFullYear() && nM > today.getMonth());
    }, [viewMonth, viewYear, today]);

    const handleDayClick = (date) => {
        if (date > today) return;
        if (!selectingEnd || !start) {
            onChange({ min: fmt(date), max: '' });
            setSelectingEnd(true);
            setHoverDate(null);
        } else {
            let s = start, e = date;
            if (date < start) { s = date; e = start; }
            const diff = Math.round((e - s) / 864e5);
            if (diff >= maxDays) {
                const clamped = new Date(s);
                clamped.setDate(clamped.getDate() + maxDays - 1);
                onChange({ min: fmt(s), max: fmt(clamped > today ? today : clamped) });
            } else {
                onChange({ min: fmt(s), max: fmt(e > today ? today : e) });
            }
            setSelectingEnd(false);
            setHoverDate(null);
        }
    };

    const effectiveEnd = selectingEnd && hoverDate ? hoverDate : end;
    const rangeStart   = start && effectiveEnd && start > effectiveEnd ? effectiveEnd : start;
    const rangeEnd     = start && effectiveEnd && start > effectiveEnd ? start : effectiveEnd;

    return (
        <div className="select-none w-72">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 relative">
                <button type="button" onClick={prevMonth}
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                    <ChevronLeft size={15} />
                </button>

                <button type="button" onClick={() => setShowMonthPicker(p => !p)}
                    className="flex items-center gap-1 text-sm font-bold text-slate-800 hover:text-violet-700 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors">
                    {MONTHS[viewMonth]} {viewYear}
                    <ChevronDown size={12} className={`text-slate-400 transition-transform ${showMonthPicker ? 'rotate-180' : ''}`} />
                </button>

                <button type="button" onClick={nextMonth} disabled={isNextDisabled}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isNextDisabled ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                    <ChevronRight size={15} />
                </button>

                {/* Month / Year dropdown */}
                {showMonthPicker && (
                    <div ref={pickerRef} className="absolute top-full left-0 right-0 z-30 bg-white rounded-xl border border-slate-200 shadow-xl mt-1 p-3">
                        {/* Year row */}
                        <div className="flex items-center gap-1 mb-2.5 pb-2 border-b border-slate-100">
                            {yearOptions.map(y => (
                                <button key={y} type="button"
                                    onClick={() => { setViewYear(y); if (y === today.getFullYear() && viewMonth > today.getMonth()) setViewMonth(today.getMonth()); }}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${viewYear === y ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-violet-50 hover:text-violet-700'}`}>
                                    {y}
                                </button>
                            ))}
                        </div>
                        {/* Month grid */}
                        <div className="grid grid-cols-4 gap-1">
                            {MONTHS_SHORT.map((m, i) => {
                                const disabled = viewYear === today.getFullYear() && i > today.getMonth();
                                return (
                                    <button key={m} type="button" disabled={disabled}
                                        onClick={() => { if (!disabled) { setViewMonth(i); setShowMonthPicker(false); } }}
                                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                            viewMonth === i && !disabled ? 'bg-violet-600 text-white' :
                                            disabled ? 'text-slate-200 cursor-not-allowed' :
                                            'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                                        }`}>
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Day grid */}
            <div className="px-3 pt-2 pb-3">
                <div className="grid grid-cols-7 mb-1">
                    {DAYS.map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-wider py-1">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {calendarDays.map(({ date, isCurrentMonth }, i) => {
                        const disabled  = date > today;
                        const isStart   = isSameDay(date, rangeStart);
                        const isEnd     = isSameDay(date, rangeEnd);
                        const inRange   = isInRange(date, rangeStart, rangeEnd);
                        const isToday   = isSameDay(date, today);
                        const isSelected = isStart || isEnd;

                        let stripClass = '';
                        if (inRange)              stripClass = 'bg-violet-50';
                        if (isStart && rangeEnd)  stripClass = 'bg-violet-50 rounded-l-full';
                        if (isEnd   && rangeStart) stripClass = 'bg-violet-50 rounded-r-full';
                        if (isStart && isEnd)     stripClass = '';

                        return (
                            <div key={i} className="relative flex items-center justify-center"
                                onMouseEnter={() => !disabled && selectingEnd && start && setHoverDate(date)}
                                onMouseLeave={() => setHoverDate(null)}>
                                {stripClass && <div className={`absolute inset-y-0.5 inset-x-0 ${stripClass}`} />}
                                <button type="button" onClick={() => !disabled && handleDayClick(date)} disabled={disabled}
                                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-[12px] transition-all duration-100
                                        ${isSelected && !disabled
                                            ? 'bg-violet-600 text-white font-bold shadow-sm shadow-violet-200'
                                            : inRange && !disabled
                                                ? 'text-violet-700 font-medium'
                                                : isToday && !disabled
                                                    ? 'font-bold ring-2 ring-violet-300 text-violet-700'
                                                    : disabled
                                                        ? 'text-slate-200 cursor-not-allowed'
                                                        : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}
                                        ${!disabled && !isSelected ? 'hover:bg-violet-100 hover:text-violet-800 cursor-pointer' : ''}
                                    `}>
                                    {date.getDate()}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectingEnd && start && (
                <p className="text-center text-xs text-violet-500 font-medium pb-2.5 animate-pulse">Click to select end date</p>
            )}
        </div>
    );
};

// ─── Main exported component ──────────────────────────────────────────────────
const DATE_FIELD_OPTIONS = [
    { value: 'return_created_date', label: 'Return Created Date' },
    { value: 'delivered_date',      label: 'Return Delivered Date' },
    { value: 'dispatch_date',       label: 'Order Dispatched Date' },
];

const ReturnDateRangePicker = ({ startDate, endDate, onChange, maxDays = 92, dateField = 'return_created_date', onDateFieldChange }) => {
    const presets = useMemo(() => getPresets(), []);
    const [tempStart, setTempStart]   = useState(startDate || '');
    const [tempEnd,   setTempEnd]     = useState(endDate   || '');
    const [activePreset, setActivePreset] = useState('Custom');

    // Keep temp state in sync when parent propagates a change (e.g. preset via KPI click)
    useEffect(() => { setTempStart(startDate || ''); setTempEnd(endDate || ''); }, [startDate, endDate]);

    // Default to "This quarter" on first mount if no dates are provided
    useEffect(() => {
        if (!startDate && !endDate) {
            const q = presets.find(p => p.label === 'This quarter');
            if (q) {
                const v = q.getValue();
                setTempStart(v.min); setTempEnd(v.max);
                setActivePreset('This quarter');
                if (onChange) onChange(v.min, v.max);
            }
        }
    }, []);  

    const handlePresetClick = (preset) => {
        setActivePreset(preset.label);
        if (preset.label !== 'Custom') {
            const v = preset.getValue();
            setTempStart(v.min);
            setTempEnd(v.max);
        }
    };

    const handleCalendarChange = ({ min, max }) => {
        setTempStart(min || '');
        setTempEnd(max || '');
        if (activePreset !== 'Custom') setActivePreset('Custom');
    };

    const triggerLabel = useMemo(() => {
        const s = parse(tempStart);
        const e = parse(tempEnd);
        if (s && e) {
            const fmtShort = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const sameYear = s.getFullYear() === e.getFullYear();
            return `${fmtShort(s)} – ${fmtShort(e)}${sameYear ? `, ${e.getFullYear()}` : ''}`;
        }
        if (s) return `${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – pick end`;
        return 'Select date range';
    }, [tempStart, tempEnd]);

    return (
        <Popover className="relative shrink-0">
            {({ open, close }) => (
                <>
                    {/* ── Trigger button ── */}
                    <Popover.Button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-sm font-bold transition-all shadow-sm focus:outline-none whitespace-nowrap ${
                        open
                            ? 'border-violet-400 bg-violet-100 text-violet-800'
                            : 'border-slate-300 bg-white text-slate-800 hover:border-violet-300 hover:text-violet-700'
                    }`}>
                        <CalendarIcon size={15} className={open ? 'text-violet-600' : 'text-slate-500'} />
                        <span className="tracking-wide">{triggerLabel}</span>
                        <ChevronDown size={14} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </Popover.Button>

                    {/* ── Popover panel ── */}
                    <Popover.Panel className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl flex overflow-hidden">
                        {/* Presets sidebar */}
                        <div className="w-32 flex-shrink-0 border-r border-slate-100 bg-slate-50/70 flex flex-col p-2 gap-0.5">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1">Quick select</p>
                            {presets.map(preset => (
                                <button key={preset.label} type="button" onClick={() => handlePresetClick(preset)}
                                    className={`text-left px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                                        activePreset === preset.label
                                            ? 'bg-violet-100 text-violet-700 border border-violet-200'
                                            : 'text-slate-600 hover:bg-white hover:text-violet-700 hover:shadow-sm border border-transparent'
                                    }`}>
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Calendar + footer */}
                        <div className="flex flex-col">
                            <Calendar
                                startDate={tempStart}
                                endDate={tempEnd}
                                onChange={handleCalendarChange}
                                maxDays={maxDays}
                            />

                            {/* Date field selector */}
                            <div className="px-4 pt-2 pb-1 border-t border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Filter by</p>
                                <div className="flex flex-col gap-0.5">
                                    {DATE_FIELD_OPTIONS.map(opt => (
                                        <button key={opt.value} type="button"
                                            onClick={() => onDateFieldChange?.(opt.value)}
                                            className={`text-left text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all border ${
                                                dateField === opt.value
                                                    ? 'bg-violet-100 text-violet-700 border-violet-200'
                                                    : 'text-slate-500 hover:bg-slate-100 border-transparent'
                                            }`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Footer: selected range label + Apply */}
                            <div className="px-4 pb-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
                                <span className="text-xs text-slate-400 font-medium truncate">
                                    {tempStart && tempEnd ? triggerLabel : 'Pick a start then an end date'}
                                </span>
                                <button type="button"
                                    onClick={() => { if (onChange && tempStart && tempEnd) { onChange(tempStart, tempEnd); } close(); }}
                                    disabled={!tempStart || !tempEnd}
                                    className="px-5 py-2 text-sm font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0">
                                    Apply
                                </button>
                            </div>
                        </div>
                    </Popover.Panel>
                </>
            )}
        </Popover>
    );
};

export default ReturnDateRangePicker;
