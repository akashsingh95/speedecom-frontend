import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MonthYearPicker = ({ value, onChange, minYear, maxYear }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState({});
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);

    const _minYear = minYear || new Date().getFullYear() - 20;
    const _maxYear = maxYear || new Date().getFullYear();

    const initialYear = value ? parseInt(value.split('-')[0], 10) : new Date().getFullYear();
    const [viewYear, setViewYear] = useState(initialYear);

    // Keep viewYear in sync when value changes externally
    useEffect(() => {
        if (value) {
            const y = parseInt(value.split('-')[0], 10);
            if (!isNaN(y)) setViewYear(y);
        }
    }, [value]);

    // Position dropdown relative to button using fixed coordinates so it escapes any overflow context
    const openDropdown = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownWidth = 288; // w-72

            // Flip upward if not enough space below
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropdownHeight = 200;
            const showAbove = spaceBelow < dropdownHeight + 8;

            setDropdownStyle({
                position: 'fixed',
                top: showAbove ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
                left: Math.min(rect.left, window.innerWidth - dropdownWidth - 8),
                width: dropdownWidth,
                zIndex: 99999,
            });
        }
        setIsOpen(true);
    };

    const toggleOpen = () => {
        if (isOpen) {
            setIsOpen(false);
        } else {
            openDropdown();
        }
    };

    // Close on outside click (both button and portal dropdown)
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (
                buttonRef.current && !buttonRef.current.contains(e.target) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    // Close on scroll/resize to avoid stale positioning
    useEffect(() => {
        if (!isOpen) return;
        const close = () => setIsOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [isOpen]);

    const handleSelectMonth = (monthIndex) => {
        const mm = (monthIndex + 1).toString().padStart(2, '0');
        onChange(`${viewYear}-${mm}`);
        setIsOpen(false);
    };

    const handlePrevYear = (e) => {
        e.preventDefault();
        if (viewYear > _minYear) setViewYear(prev => prev - 1);
    };

    const handleNextYear = (e) => {
        e.preventDefault();
        if (viewYear < _maxYear) setViewYear(prev => prev + 1);
    };

    const displayValue = value ? (() => {
        const [y, m] = value.split('-');
        const idx = parseInt(m, 10) - 1;
        const monthName = MONTHS[idx >= 0 && idx < 12 ? idx : 0];
        return `${monthName} ${y}`;
    })() : 'Select Month/Year';

    const dropdown = isOpen && (
        <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-in fade-in zoom-in-95 duration-200"
        >
            <div className="flex items-center justify-between mb-4">
                <button
                    type="button"
                    onClick={handlePrevYear}
                    disabled={viewYear <= _minYear}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 transition-colors"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="font-bold text-slate-800">{viewYear}</span>
                <button
                    type="button"
                    onClick={handleNextYear}
                    disabled={viewYear >= _maxYear}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 transition-colors"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((month, idx) => {
                    const isSelected =
                        value &&
                        parseInt(value.split('-')[1], 10) - 1 === idx &&
                        parseInt(value.split('-')[0], 10) === viewYear;

                    const currentY = new Date().getFullYear();
                    const currentM = new Date().getMonth();
                    const isFuture = viewYear === currentY && idx > currentM;
                    const disabled = isFuture && viewYear === _maxYear;

                    return (
                        <button
                            key={month}
                            type="button"
                            onClick={() => !disabled && handleSelectMonth(idx)}
                            disabled={disabled}
                            className={`
                                py-2 px-1 rounded-xl text-sm font-medium transition-all
                                ${isSelected
                                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30'
                                    : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600 border border-transparent hover:border-brand-100'}
                                ${disabled ? 'opacity-30 cursor-not-allowed hidden' : ''}
                            `}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="relative w-full">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 outline-none transition-all flex items-center justify-between hover:border-brand-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 text-slate-700"
            >
                <span className={value ? 'text-slate-800' : 'text-slate-400'}>{displayValue}</span>
                <Calendar size={18} className="text-slate-400" />
            </button>

            {isOpen && createPortal(dropdown, document.body)}
        </div>
    );
};

export default MonthYearPicker;
