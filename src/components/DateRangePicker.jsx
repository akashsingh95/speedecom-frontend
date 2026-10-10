import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Format date to YYYY-MM-DD
const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// Parse YYYY-MM-DD to Date. Returns null for anything that isn't a real date —
// crucially NOT an Invalid Date object, which is truthy and would slip past
// `parse(x) || today` fallbacks and make getFullYear()/getMonth() return NaN,
// rendering the whole calendar as "NaN".
const parse = (s) => {
    if (!s) return null;
    const [y, m, d] = String(s).split('-').map(Number);
    if (![y, m, d].every(Number.isFinite)) return null;
    const dt = new Date(y, m - 1, d);
    // Round-trip check: rejects both Invalid Date and silent overflow rollover
    // (e.g. "2026-13-99", which JS would otherwise normalise into 2027).
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
};

const isSameDay = (a, b) => a && b && fmt(a) === fmt(b);
const isInRange = (day, start, end) => {
    if (!start || !end) return false;
    const t = day.getTime();
    return t > start.getTime() && t < end.getTime();
};

// minDate (optional, "YYYY-MM-DD"): earliest selectable day — days, months and years before it
// are disabled (e.g. SBM users, who can only see the last 7 days).
const DateRangePicker = ({ startDate, endDate, onChange, accentColor = 'brand', maxDays = 31, hideDisplayChip = false, availableMonths = null, availableYears = null, forceMonthOpen = false, onMonthToggle, minDate = null, allowFuture = false }) => {
    // Today (no future dates allowed)
    const today = useMemo(() => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    }, []);
    const min = useMemo(() => parse(minDate), [minDate]);
    const isBeforeMin = (date) => !!min && date < min;
    const isBeforeMinMonth = (year, month) => !!min && (year < min.getFullYear() || (year === min.getFullYear() && month < min.getMonth()));

    const initialDate = parse(startDate) || today;
    const [viewYear, setViewYear] = useState(initialDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
    const [hoverDate, setHoverDate] = useState(null);
    const [selectingEnd, setSelectingEnd] = useState(!!startDate && !endDate);
    const [showPicker, setShowPicker] = useState(false);
    
    // Determine if the month picker state is controlled by the parent
    const isControlled = forceMonthOpen !== undefined && onMonthToggle !== undefined;
    const isMonthPickerOpen = isControlled ? forceMonthOpen : showPicker;
    const pickerRef = useRef(null);

    const start = parse(startDate);
    const end = parse(endDate);

    useEffect(() => {
        if (start) {
            setViewYear(start.getFullYear());
            setViewMonth(start.getMonth());
        }
    }, [startDate]);

    useEffect(() => {
        const handler = (e) => {
            // Ignore clicks hitting the parent component's toggle buttons directly
            // so we don't conflict with their onClick events.
            if (e.target.closest('.select-month-btn')) return;

            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                if (isControlled) {
                    onMonthToggle(false);
                } else {
                    setShowPicker(false);
                }
            }
        };
        if (isMonthPickerOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isMonthPickerOpen, isControlled, onMonthToggle]);

    const colors = useMemo(() => {
        const map = {
            brand: {
                bg: 'bg-brand-500',
                bgLight: 'bg-brand-50 dark:bg-brand-900/30',
                text: 'text-brand-600 dark:text-brand-400',
                rangeBg: 'bg-brand-50 dark:bg-brand-900/20',
                rangeText: 'text-brand-600 dark:text-brand-400',
                monthActive: 'bg-brand-500 text-white',
                monthHover: 'hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30 dark:hover:text-brand-400',
            },
            emerald: {
                bg: 'bg-emerald-500',
                bgLight: 'bg-emerald-50 dark:bg-emerald-900/30',
                text: 'text-emerald-600 dark:text-emerald-400',
                rangeBg: 'bg-emerald-50 dark:bg-emerald-900/20',
                rangeText: 'text-emerald-600 dark:text-emerald-400',
                monthActive: 'bg-emerald-500 text-white',
                monthHover: 'hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400',
            },
            indigo: {
                bg: 'bg-indigo-600',
                bgLight: 'bg-indigo-50 dark:bg-indigo-900/30',
                text: 'text-indigo-600 dark:text-indigo-400',
                rangeBg: 'bg-indigo-50 dark:bg-indigo-900/20',
                rangeText: 'text-indigo-600 dark:text-indigo-400',
                monthActive: 'bg-indigo-600 text-white',
                monthHover: 'hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400',
            },
        };
        return map[accentColor] || map.brand;
    }, [accentColor]);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1);
        const lastDay = new Date(viewYear, viewMonth + 1, 0);
        const startPad = firstDay.getDay();
        const totalDays = lastDay.getDate();
        const days = [];

        const prevMonthLast = new Date(viewYear, viewMonth, 0).getDate();
        for (let i = startPad - 1; i >= 0; i--) {
            days.push({ date: new Date(viewYear, viewMonth - 1, prevMonthLast - i), isCurrentMonth: false });
        }
        for (let d = 1; d <= totalDays; d++) {
            days.push({ date: new Date(viewYear, viewMonth, d), isCurrentMonth: true });
        }
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ date: new Date(viewYear, viewMonth + 1, i), isCurrentMonth: false });
        }
        if (days.length > 35 && !days.slice(35).some(d => d.isCurrentMonth)) {
            days.splice(35);
        }
        return days;
    }, [viewYear, viewMonth]);

    // Year options: use availableYears prop if provided, otherwise default to 5 years back from today
    const yearOptions = useMemo(() => {
        if (availableYears && availableYears.length > 0) {
            return [...availableYears].sort((a, b) => b - a);
        }
        const currentYear = today.getFullYear();
        const oldestYear = min ? Math.max(min.getFullYear(), currentYear - 5) : currentYear - 5;
        const years = [];
        for (let y = currentYear; y >= oldestYear; y--) years.push(y);
        return years;
    }, [today, availableYears, min]);

    const isPrevDisabled = useMemo(() => {
        const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
        return isBeforeMinMonth(prevY, prevM);
    }, [viewMonth, viewYear, min]);

    const prevMonth = () => {
        if (isPrevDisabled) return;
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };

    const nextMonth = () => {
        const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
        if (!allowFuture && (nextY > today.getFullYear() || (nextY === today.getFullYear() && nextM > today.getMonth()))) return;
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const isFuture = (date) => !allowFuture && date > today;

    const isNextDisabled = useMemo(() => {
        if (allowFuture) return false;
        const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
        return nextY > today.getFullYear() || (nextY === today.getFullYear() && nextM > today.getMonth());
    }, [viewMonth, viewYear, today, allowFuture]);

    const handleDayClick = (day) => {
        if (isFuture(day) || isBeforeMin(day)) return;
        const dayMonth = day.getMonth();
        const dayYear = day.getFullYear();
        if (dayMonth !== viewMonth || dayYear !== viewYear) {
            setViewMonth(dayMonth);
            setViewYear(dayYear);
        }
        if (!selectingEnd || !start) {
            onChange({ min: fmt(day), max: '' });
            setSelectingEnd(true);
            setHoverDate(null);
        } else {
            let finalStart = start;
            let finalEnd = day;
            if (day < start) { finalStart = day; finalEnd = start; }
            const diff = Math.round((finalEnd - finalStart) / (1000 * 60 * 60 * 24));
            if (diff >= maxDays) {
                const clamped = new Date(finalStart);
                clamped.setDate(clamped.getDate() + maxDays - 1);
                onChange({ min: fmt(finalStart), max: fmt(!allowFuture && clamped > today ? today : clamped) });
            } else {
                onChange({ min: fmt(finalStart), max: fmt(!allowFuture && finalEnd > today ? today : finalEnd) });
            }
            setSelectingEnd(false);
            setHoverDate(null);
        }
    };

    const handleDayHover = (day) => {
        if (selectingEnd && start) setHoverDate(day);
    };

    const handleMonthSelect = (month) => {
        if (!allowFuture && viewYear === today.getFullYear() && month > today.getMonth()) return;
        if (isBeforeMinMonth(viewYear, month)) return;
        setViewMonth(month);

        if (isControlled) {
            onMonthToggle(false);
        } else {
            setShowPicker(false);
        }

        const monthStart = new Date(viewYear, month, 1);
        // Never start the selected range before minDate (the month containing it is selectable).
        const firstDay = min && monthStart < min ? new Date(min) : monthStart;
        const lastDayOfMonth = new Date(viewYear, month + 1, 0);
        let lastDay = (!allowFuture && lastDayOfMonth > today) ? today : lastDayOfMonth;
        const diff = Math.round((lastDay - firstDay) / (1000 * 60 * 60 * 24));
        if (diff >= maxDays) {
            const clamped = new Date(firstDay);
            clamped.setDate(clamped.getDate() + maxDays - 1);
            lastDay = (!allowFuture && clamped > today) ? today : clamped;
        }
        onChange({ min: fmt(firstDay), max: fmt(lastDay) });
        setSelectingEnd(false);
    };

    const handleYearSelect = (year) => {
        setViewYear(year);
        if (!allowFuture && year === today.getFullYear() && viewMonth > today.getMonth()) {
            setViewMonth(today.getMonth());
        }
    };

    const effectiveEnd = selectingEnd && hoverDate ? hoverDate : end;
    const rangeStart = start && effectiveEnd && start > effectiveEnd ? effectiveEnd : start;
    const rangeEnd = start && effectiveEnd && start > effectiveEnd ? start : effectiveEnd;

    const displayText = useMemo(() => {
        if (start && end) {
            return `${start.getDate()}/${start.getMonth() + 1}/${start.getFullYear()} – ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
        }
        if (start) return `${start.getDate()}/${start.getMonth() + 1}/${start.getFullYear()} – Select end`;
        return 'Select date range';
    }, [start, end]);

    return (
        <div className="w-full">
            {/* Date display chip */}
            {!hideDisplayChip && (
                <div className="flex items-center justify-between mb-3">
                    <div className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg border ${start && end
                        ? `${colors.bgLight} ${colors.text} border-current/10`
                        : 'bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-100 dark:border-gray-700'} transition-all`}>
                        {displayText}
                    </div>
                    {selectingEnd && start && (
                        <span className="text-[10px] text-slate-400 dark:text-gray-500 animate-pulse font-medium">Click end date</span>
                    )}
                </div>
            )}

            {/* Calendar */}
            <div className="bg-white dark:bg-[#0d1117] rounded-xl border border-slate-100 dark:border-gray-700/60 shadow-sm overflow-hidden">
                {/* Month navigation */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50 dark:border-gray-700/40 relative">
                    <button
                        type="button"
                        onClick={prevMonth}
                        disabled={isPrevDisabled}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isPrevDisabled
                                ? 'text-slate-200 dark:text-gray-700 cursor-not-allowed'
                                : 'hover:bg-slate-100 dark:hover:bg-gray-700/60 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
                        }`}
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (isControlled) {
                                onMonthToggle(!forceMonthOpen);
                            } else {
                                setShowPicker(prev => !prev);
                            }
                        }}
                        onMouseDown={(e) => { if (isMonthPickerOpen) e.stopPropagation(); }}
                        className="text-[13px] font-bold text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-gray-700/50 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                        {MONTHS[viewMonth]} {viewYear}
                        <svg
                            className={`w-3 h-3 text-slate-400 dark:text-gray-500 transition-transform ${isMonthPickerOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <button
                        type="button"
                        onClick={nextMonth}
                        disabled={isNextDisabled}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isNextDisabled
                                ? 'text-slate-200 dark:text-gray-700 cursor-not-allowed'
                                : 'hover:bg-slate-100 dark:hover:bg-gray-700/60 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
                        }`}
                    >
                        <ChevronRight size={16} />
                    </button>

                    {/* Month/Year Dropdown */}
                    {isMonthPickerOpen && (
                        <div ref={pickerRef} className="absolute top-full left-0 right-0 z-20 bg-white dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-gray-700 shadow-lg mt-1 p-3 animate-fadeIn">
                            {/* Year selector */}
                            <div className="flex items-center gap-1.5 mb-3 pb-2.5 border-b border-slate-100 dark:border-gray-700/60">
                                {yearOptions.map(y => (
                                    <button
                                        key={y}
                                        type="button"
                                        onClick={() => handleYearSelect(y)}
                                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${viewYear === y ? colors.monthActive : `text-slate-500 dark:text-gray-400 ${colors.monthHover}`}`}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                            {/* Month grid */}
                            <div className="grid grid-cols-4 gap-1.5">
                                {MONTHS_SHORT.map((m, i) => {
                                    const isFutureMonth = !allowFuture && viewYear === today.getFullYear() && i > today.getMonth();
                                    // If availableMonths has data, only enable months explicitly present for this year
                                    // If no availableMonths data exists (new marketplace), all non-future months are enabled
                                    const hasAvailableData = availableMonths && Object.keys(availableMonths).length > 0;
                                    const monthsForYear = hasAvailableData ? availableMonths[viewYear] : null;
                                    const hasNoData = hasAvailableData ? (!monthsForYear || !monthsForYear.includes(i + 1)) : false;
                                    const isDisabled = isFutureMonth || hasNoData || isBeforeMinMonth(viewYear, i);
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => handleMonthSelect(i)}
                                            disabled={isDisabled}
                                            className={`py-2 text-[11px] font-semibold rounded-lg transition-all ${viewMonth === i && !isDisabled
                                                ? colors.monthActive
                                                : isDisabled
                                                    ? 'text-slate-200 dark:text-gray-700 cursor-not-allowed'
                                                    : `text-slate-600 dark:text-gray-300 ${colors.monthHover}`
                                                }`}
                                        >
                                            {m}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-2.5 py-2">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAYS.map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-slate-300 dark:text-gray-600 uppercase tracking-wider py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map(({ date, isCurrentMonth }, i) => {
                            const future = isFuture(date);
                            const disabled = future || isBeforeMin(date);
                            const isStart = isSameDay(date, rangeStart);
                            const isEnd = isSameDay(date, rangeEnd);
                            const inRange = isInRange(date, rangeStart, rangeEnd);
                            const isToday = isSameDay(date, today);
                            const isSelected = isStart || isEnd;

                            let cellBg = '';
                            let textColor = disabled
                                ? 'text-slate-200 dark:text-gray-700'
                                : isCurrentMonth
                                    ? 'text-slate-700 dark:text-gray-300'
                                    : 'text-slate-300 dark:text-gray-600';
                            let fontWeight = '';
                            let extra = '';

                            if (isSelected && !disabled) {
                                cellBg = `${colors.bg} text-white`;
                                textColor = 'text-white';
                                fontWeight = 'font-bold';
                                extra = 'shadow-sm';
                            } else if (inRange && !disabled) {
                                cellBg = colors.rangeBg;
                                textColor = colors.rangeText;
                                fontWeight = 'font-medium';
                            } else if (isToday && !disabled) {
                                fontWeight = 'font-bold';
                                extra = 'ring-1 ring-slate-200 dark:ring-gray-600';
                            }

                            let stripClass = '';
                            if (inRange) stripClass = colors.rangeBg;
                            if (isStart && rangeEnd) stripClass = `${colors.rangeBg} rounded-l-full`;
                            if (isEnd && rangeStart) stripClass = `${colors.rangeBg} rounded-r-full`;
                            if (isStart && isEnd) stripClass = '';

                            return (
                                <div
                                    key={i}
                                    className="relative flex items-center justify-center"
                                    onMouseEnter={() => !disabled && handleDayHover(date)}
                                >
                                    {stripClass && (
                                        <div className={`absolute inset-y-0.5 inset-x-0 ${stripClass}`}></div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => !disabled && handleDayClick(date)}
                                        disabled={disabled}
                                        className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-[12px] transition-all duration-150
                                            ${cellBg} ${textColor} ${fontWeight} ${extra}
                                            ${!disabled && !isSelected ? 'hover:bg-slate-100 dark:hover:bg-gray-700/60 cursor-pointer' : ''}
                                            ${disabled ? 'cursor-not-allowed' : ''}
                                        `}
                                    >
                                        {date.getDate()}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DateRangePicker;
