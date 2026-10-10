import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Popover } from '@headlessui/react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import DateRangePicker from './DateRangePicker.jsx';

const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getPresets = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getMonday = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
        return new Date(date.setDate(diff));
    };

    return [
        {
            label: 'This week',
            getValue: () => {
                const start = getMonday(today);
                return { min: fmt(start), max: fmt(today) };
            }
        },
        {
            label: 'Last week',
            getValue: () => {
                const end = getMonday(today);
                end.setDate(end.getDate() - 1);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                return { min: fmt(start), max: fmt(end) };
            }
        },
        {
            label: 'This month',
            getValue: () => {
                const start = new Date(today.getFullYear(), today.getMonth(), 1);
                return { min: fmt(start), max: fmt(today) };
            }
        },
        {
            label: 'Last month',
            getValue: () => {
                const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const end = new Date(today.getFullYear(), today.getMonth(), 0);
                return { min: fmt(start), max: fmt(end) };
            }
        },
        {
            label: 'This quarter',
            getValue: () => {
                const startMonth = Math.floor(today.getMonth() / 3) * 3;
                const start = new Date(today.getFullYear(), startMonth, 1);
                return { min: fmt(start), max: fmt(today) };
            }
        },
        {
            label: 'Last quarter',
            getValue: () => {
                const startMonth = Math.floor(today.getMonth() / 3) * 3 - 3;
                const start = new Date(today.getFullYear(), startMonth, 1);
                const end = new Date(today.getFullYear(), startMonth + 3, 0);
                return { min: fmt(start), max: fmt(end) };
            }
        },

        {
            label: 'Custom',
            getValue: () => null 
        }
    ];
};

const THEMES = {
    indigo: {
        focusRing: 'focus:ring-indigo-500',
        focusBorder: 'focus:border-indigo-500',
        bgPrimary: 'bg-indigo-600',
        hoverBgPrimary: 'hover:bg-indigo-700',
        borderPrimary: 'border-indigo-600',
        bgLight: 'bg-indigo-50',
        borderLight: 'border-indigo-200',
        textLightHover: 'hover:text-indigo-600',
        textLightActive: 'text-indigo-700',
        ringLightActive: 'ring-indigo-500',
        activePresetBg: 'bg-indigo-100 text-indigo-700 shadow-sm border-indigo-200',
        accentColor: 'indigo'
    },
    brand: {
        focusRing: 'focus:ring-brand-500',
        focusBorder: 'focus:border-brand-500',
        bgPrimary: 'bg-brand-600',
        hoverBgPrimary: 'hover:bg-brand-700',
        borderPrimary: 'border-brand-600',
        bgLight: 'bg-brand-50',
        borderLight: 'border-brand-200',
        textLightHover: 'hover:text-brand-600',
        textLightActive: 'text-brand-700',
        ringLightActive: 'ring-brand-500',
        activePresetBg: 'bg-brand-100 text-brand-700 shadow-sm border-brand-200',
        accentColor: 'brand'
    }
};

const AdvancedDateRangePicker = ({ 
    startDate, 
    endDate, 
    onChange, 
    onApply,
    onClear,
    maxDays = 92,
    alwaysOpen = false,
    inlineMode = false,
    availableMonths = null,
    availableYears = null,
    nullDateActive = false,
    onNullDate = null,
    defaultMonthOpen = false,
    colorTheme = 'indigo'
}) => {
    const theme = THEMES[colorTheme] || THEMES.indigo;
    const presets = useMemo(() => getPresets(), []);
    const buttonRef = useRef(null);
    const justDeactivatedNullDate = useRef(false);
    
    // Internal state for unsaved edits while popover is open
    const [tempStart, setTempStart] = useState(startDate || '');
    const [tempEnd, setTempEnd] = useState(endDate || '');
    const [activePreset, setActivePreset] = useState('Custom');
    const [forceMonthOpen, setForceMonthOpen] = useState(defaultMonthOpen);

    // Run preset calculation on mount if default is active and empty
    useEffect(() => {
        if (nullDateActive) {
            justDeactivatedNullDate.current = true;
            setTempStart('');
            setTempEnd('');
            setActivePreset('N/A');
            return;
        }
        // Transitioning out of N/A — preset click already set tempStart/tempEnd/activePreset, don't override
        if (justDeactivatedNullDate.current) {
            justDeactivatedNullDate.current = false;
            return;
        }
        if (!startDate && !endDate) {
            const defaultPreset = presets.find(p => p.label === 'This quarter');
            if (defaultPreset) {
                const vals = defaultPreset.getValue();
                setTempStart(vals.min);
                setTempEnd(vals.max);
                setActivePreset('This quarter');
                if (onChange) onChange(vals.min, vals.max);
            }
        } else {
            setTempStart(startDate || '');
            setTempEnd(endDate || '');
            
            // Auto match preset if not nullDateActive
            const matchedPreset = presets.find(p => {
                if (p.label === 'Custom') return false;
                const vals = p.getValue();
                return vals.min === startDate && vals.max === endDate;
            });
            
            if (matchedPreset) {
                setActivePreset(matchedPreset.label);
            } else {
                setActivePreset('Custom');
            }
        }
    }, [nullDateActive, startDate, endDate, presets, onChange]);

    const handlePresetClick = (preset) => {
        setActivePreset(preset.label);
        if (nullDateActive && onNullDate) onNullDate(false);
        if (preset.label !== 'Custom') {
            const vals = preset.getValue();
            setTempStart(vals.min);
            setTempEnd(vals.max);
            // When deactivating N/A via a preset, propagate dates immediately
            // (the useEffect will be skipped via the ref, so onChange must be called here)
            if (nullDateActive && onChange) onChange(vals.min, vals.max);
        }
    };

    const handleNullDateClick = () => {
        setActivePreset('N/A');
        setTempStart('');
        setTempEnd('');
        if (onNullDate) onNullDate(true);
    };

    const handleCalendarChange = ({ min, max }) => {
        let finalMin = min || '';
        let finalMax = max || '';

        if (finalMin && finalMax && maxDays) {
            const start = new Date(finalMin);
            const end = new Date(finalMax);
            const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
            if (diff >= maxDays) {
                const clamped = new Date(start);
                clamped.setDate(clamped.getDate() + maxDays - 1);
                
                const today = new Date();
                today.setHours(0,0,0,0);
                finalMax = fmt(clamped > today ? today : clamped);
            }
        }

        setTempStart(finalMin);
        setTempEnd(finalMax);
        if (nullDateActive && onNullDate) onNullDate(false);
        if (activePreset !== 'Custom') {
            setActivePreset('Custom');
        }
    };

    return (
        <Popover className={`w-full flex flex-col gap-2 ${inlineMode ? '' : 'relative'}`}>
            {({ open, close }) => (
                <>
                    {/* Always-visible external inputs */}
                    <div className="flex items-center gap-1.5 w-full">
                        <input 
                            type="date" 
                            value={nullDateActive ? '' : (tempStart || '')} 
                            onChange={(e) => handleCalendarChange({ min: e.target.value, max: tempEnd })}
                            disabled={nullDateActive}
                            className={`flex-1 min-w-0 text-[10px] sm:text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700 focus:outline-none ${theme.focusBorder} focus:ring-1 ${theme.focusRing} shadow-sm transition-colors [&::-webkit-calendar-picker-indicator]:hidden ${nullDateActive ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'bg-white cursor-text'}`}
                        />
                        <span className="text-slate-400 font-medium text-xs">-</span>
                        <input 
                            type="date" 
                            value={nullDateActive ? '' : (tempEnd || '')} 
                            onChange={(e) => handleCalendarChange({ min: tempStart, max: e.target.value })}
                            disabled={nullDateActive}
                            className={`flex-1 min-w-0 text-[10px] sm:text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700 focus:outline-none ${theme.focusBorder} focus:ring-1 ${theme.focusRing} shadow-sm transition-colors [&::-webkit-calendar-picker-indicator]:hidden ${nullDateActive ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'bg-white cursor-text'}`}
                        />
                        {!inlineMode && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (onChange) onChange(tempStart, tempEnd);
                                    if (onApply) onApply(tempStart, tempEnd);
                                    close();
                                }}
                                className={`px-3 py-1.5 text-xs font-semibold text-white ${theme.bgPrimary} ${theme.hoverBgPrimary} border ${theme.borderPrimary} shadow-sm rounded-lg transition-colors flex-shrink-0`}
                            >
                                Set Date
                            </button>
                        )}
                        {!inlineMode && (
                            <Popover.Button 
                                ref={buttonRef}
                                className={`flex flex-shrink-0 items-center justify-center p-2 rounded-lg border shadow-sm transition-colors focus:outline-none ${
                                    open 
                                        ? `${theme.bgLight} ${theme.borderLight} ${theme.textLightActive} ring-1 ${theme.ringLightActive}` 
                                        : `bg-white border-slate-200 text-slate-500 hover:bg-slate-50 ${theme.textLightHover}`
                                }`}
                                title={open ? "Hide Calendar Panel" : "Show Calendar Panel"}
                            >
                                <CalendarIcon size={16} />
                            </Popover.Button>
                        )}
                    </div>

                    {/* Popover Panel holding exactly the presets and calendar */}
                    {(alwaysOpen || open) && (
                        <Popover.Panel static className={
                            inlineMode
                            ? "mt-1 bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden w-full"
                            : `absolute top-full right-[10%] mt-3 z-50 bg-white rounded-xl border border-slate-200 flex transform origin-top-right transition-all w-max min-w-[430px] ${alwaysOpen ? 'shadow-sm' : 'shadow-xl'}`
                        }>
                            {/* Left Sidebar - Presets */}
                        <div className="w-24 flex-shrink-0 border-r border-slate-100 bg-slate-50/70 flex flex-col p-2 gap-1 overflow-y-auto max-h-[350px]">
                            {presets.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => handlePresetClick(preset)}
                                    className={`text-left px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors border ${
                                        !nullDateActive && activePreset === preset.label
                                            ? theme.activePresetBg
                                            : 'text-slate-600 hover:bg-white hover:text-slate-900 border-transparent hover:border-slate-200 hover:shadow-sm'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => { setForceMonthOpen(!forceMonthOpen); setActivePreset('Custom'); }}
                                className={`select-month-btn text-left px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors border ${
                                    forceMonthOpen
                                        ? 'bg-brand-100 text-brand-700 shadow-sm border-brand-200'
                                        : 'text-slate-600 hover:bg-white hover:text-slate-900 border-transparent hover:border-slate-200 hover:shadow-sm'
                                }`}
                            >
                                Select Month
                            </button>
                            {onNullDate && (
                            <button
                                type="button"
                                onClick={handleNullDateClick}
                                className={`text-left px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors border ${
                                    nullDateActive
                                        ? 'bg-orange-100 text-orange-700 shadow-sm border-orange-200'
                                        : 'text-slate-600 hover:bg-white hover:text-slate-900 border-transparent hover:border-slate-200 hover:shadow-sm'
                                }`}
                            >
                                N/A
                            </button>
                            )}
                        </div>

                        {/* Right Area - Calendar & Actions */}
                        <div className="flex flex-col p-3 flex-1 min-w-0">
                            {/* Calendar Area */}
                            <div className="relative flex-grow h-full bg-white rounded-lg">
                                <div 
                                    className={`transition-all duration-300 relative h-full`}
                                >
                                    <DateRangePicker
                                        startDate={tempStart}
                                        endDate={tempEnd}
                                        onChange={handleCalendarChange}
                                        hideDisplayChip={true}
                                        maxDays={maxDays}
                                        accentColor={theme.accentColor}
                                        availableMonths={availableMonths}
                                        availableYears={availableYears}
                                        forceMonthOpen={forceMonthOpen}
                                        onMonthToggle={(state) => setForceMonthOpen(state)}
                                    />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-3 flex gap-2 w-full justify-end shrink-0 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onChange) onChange(tempStart, tempEnd);
                                        if (onApply) onApply(tempStart, tempEnd);
                                        close();
                                    }}
                                    className={`px-4 py-1.5 text-xs font-semibold text-white ${theme.bgPrimary} ${theme.hoverBgPrimary} border ${theme.borderPrimary} shadow-sm rounded-lg transition-colors`}
                                >
                                    Set Date
                                </button>
                            </div>
                        </div>
                        </Popover.Panel>
                    )}
                </>
            )}
        </Popover>
    );
};

export default AdvancedDateRangePicker;
