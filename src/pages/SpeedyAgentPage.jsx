import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Home, MessageSquare, BookOpen, Package,
    BarChart3, RotateCcw, CreditCard, LogOut,
    Sparkles, ArrowRight, Send, ChevronRight, ArrowLeft,
    FileText, TrendingUp, Zap, Store,
    ChevronDown, ChevronUp, ChevronLeft, Sun, Moon, ChevronsLeft, ChevronsRight,
    Calendar, Plus, X, SquarePenIcon, AlertTriangle, Search, Mic, MicOff,
    // Per-question card icons (see QUESTION_ICONS)
    Coins, LineChart, Rocket, Ban, Percent, Trophy, PackageX, TrendingDown,
    ListFilter, Layers, PieChart, ArrowLeftRight, Warehouse, MapPin,
    Megaphone, MegaphoneOff, ReceiptText, Clock, HandCoins,
    PackageSearch, Hourglass, AlarmClock, Undo2, Boxes,
    Check,
} from 'lucide-react';
import DateRangePicker from '../components/DateRangePicker';
import { useAuth } from '../AuthContext';
import api from '../api';
import { getMarketplaceLogo } from '../utils/marketplaceLogos';
import { VISIBLE_CATEGORIES, getQuestionsByCategory, isQuestionSupportedForMarketplace } from '../Speedydata/faqQuestions';
import { LanguageProvider, useLanguage } from '../Speedydata/LanguageContext';
import ResponseRenderer from '../components/speedy/ResponseRenderer';
import TypewriterText from '../components/speedy/TypewriterText';
import TrialOfferPopup from '../components/speedy/TrialOfferPopup';

// ─── Sidebar FAQ category icons (matches reference UI) ───
const SIDEBAR_CAT_ICONS = {
    sku_analysis: Package,
    warehouse: Store,
    ads: BarChart3,
    returns: RotateCcw,
    order_lookup: PackageSearch,
    payments: CreditCard,
    claims: FileText,
    business: TrendingUp,
};

// ─── Suggested questions for empty chat state ────────────
const SUGGESTED_QUESTIONS = [
    'What are my top 10 SKUs by profit this month?',
    'Show me ROAS breakdown by marketplace',
    'Which products have the highest return rate?',
    "What's my pending settlement amount?",
];

// ─── Custom scrollbar styles for dark theme ──────────────
const scrollbarStyles = `
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
    }
    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(139, 92, 246, 0.3);
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(139, 92, 246, 0.5);
    }

    /* ─── IMP: a light travelling around the card's border ───────────────────
       Done with an SVG rect + stroke-dash, NOT a conic-gradient. A conic sweeps
       by ANGLE measured from the element's centre, and these cards are ~14:1
       wide — from the centre the top edge spans ~172 degrees while each short
       side spans ~8, so the light crawls along the top and teleports around the
       corners. stroke-dashoffset instead walks the actual perimeter, so it moves
       at a constant speed and turns the corners properly.

       pathLength="100" re-normalises the perimeter to 100 units, so the dash
       lengths stay in percent no matter how wide the card is.

       The pace is deliberately UNEVEN — the light eases and surges twice per
       lap, which is the lively feel the old conic version had by accident (it
       dawdled along the long edges and shot around the corners). Here it is
       intentional and geometry-independent.

       The stops sample  offset(t) = 100t − 5·sin(4πt)  every 10%. That keeps
       speed between ~0.37x and ~1.63x — never stalling, never reversing — and
       the end velocity equals the start velocity, so the loop has no visible
       seam or hitch. A plain linear ramp is what made it feel mechanical;
       ease-in-out would instead dead-stop once per lap.

       NOTE: this whole stylesheet lives in a JS template literal, so never use
       backticks in these comments — they close the string and break the build. */
    @keyframes imp-dash {
        0%   { stroke-dashoffset: 0; }
        10%  { stroke-dashoffset: -5.2; }
        20%  { stroke-dashoffset: -17.1; }
        30%  { stroke-dashoffset: -32.9; }
        40%  { stroke-dashoffset: -44.8; }
        50%  { stroke-dashoffset: -50; }
        60%  { stroke-dashoffset: -55.2; }
        70%  { stroke-dashoffset: -67.1; }
        80%  { stroke-dashoffset: -82.9; }
        90%  { stroke-dashoffset: -94.8; }
        100% { stroke-dashoffset: -100; }
    }
    .imp-dash {
        stroke-dasharray: 22 78;
        animation: imp-dash 3s linear infinite;
    }

    /* Respect users who ask for less motion — the rim freezes, colours stay. */
    @media (prefers-reduced-motion: reduce) {
        .imp-dash {
            animation: none;
            stroke-dasharray: none;
        }
    }
`;

// ─── Date helpers ────────────────────────────────────────────
const fmtDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const SPEEDY_DATE_PRESETS = [
    {
        label: 'This Month',
        fn: () => {
            const t = new Date(); t.setHours(0, 0, 0, 0);
            return { min: fmtDate(new Date(t.getFullYear(), t.getMonth(), 1)), max: fmtDate(t) };
        },
    },
    {
        label: 'Last Month',
        fn: () => {
            const t = new Date(); t.setHours(0, 0, 0, 0);
            return { min: fmtDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)), max: fmtDate(new Date(t.getFullYear(), t.getMonth(), 0)) };
        },
    },
    {
        label: 'Last 3 Months',
        fn: () => {
            const t = new Date(); t.setHours(0, 0, 0, 0);
            return { min: fmtDate(new Date(t.getFullYear(), t.getMonth() - 3, 1)), max: fmtDate(new Date(t.getFullYear(), t.getMonth(), 0)) };
        },
    },
    {
        label: 'Last 6 Months',
        fn: () => {
            const t = new Date(); t.setHours(0, 0, 0, 0);
            return { min: fmtDate(new Date(t.getFullYear(), t.getMonth() - 6, 1)), max: fmtDate(new Date(t.getFullYear(), t.getMonth(), 0)) };
        },
    },
];

const formatDateDisplay = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [sy, sm, sd] = String(startDate).split('-').map(Number);
    const [ey, em, ed] = String(endDate).split('-').map(Number);
    // Guard: malformed inputs (e.g. cleared state, stale "undefined" string)
    // would otherwise render "undefined undefined NaN".
    const allValid = [sy, sm, sd, ey, em, ed].every(Number.isFinite)
        && sm >= 1 && sm <= 12 && em >= 1 && em <= 12;
    if (!allValid) return null;
    if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
    return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
};

// ─── SpeedyDateFilter ─────────────────────────────────────────
// inlineMode=false → collapsible panel (for chat)
// inlineMode=true  → always-visible (for FAQ params page)
const SpeedyDateFilter = ({
    startDate, endDate, onChange,
    isExpanded, setIsExpanded,
    inlineMode = false,
    required = false,
    hideLabel = false,
}) => {
    const displayText = formatDateDisplay(startDate, endDate);
    const isSet = !!(startDate && endDate);

    const applyPreset = (preset) => {
        const v = preset.fn();
        onChange(v.min, v.max);
    };

    const getActivePreset = () => {
        for (const p of SPEEDY_DATE_PRESETS) {
            const v = p.fn();
            if (startDate === v.min && endDate === v.max) return p.label;
        }
        return null;
    };
    const activePreset = getActivePreset();

    // Full picker content (used in chat collapsible mode)
    const pickerContent = (
        <div className="px-3 pb-3 pt-2">
            <div className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="w-[120px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/50 flex flex-col p-2 gap-1 overflow-y-auto max-h-[300px]">
                    <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 px-1">Presets</div>
                    {SPEEDY_DATE_PRESETS.map(preset => (
                        <button key={preset.label} type="button" onClick={() => applyPreset(preset)}
                            className={`text-left px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-colors border ${activePreset === preset.label ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50 shadow-sm' : 'text-slate-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-gray-200 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm'}`}>
                            {preset.label}
                        </button>
                    ))}
                    <button type="button"
                        className={`text-left px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-colors border mt-auto ${!activePreset && (startDate || endDate) ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50 shadow-sm' : 'text-slate-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-gray-200 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm'}`}>
                        Custom
                    </button>
                </div>
                <div className="flex-grow p-3 bg-white dark:bg-gray-950">
                    <DateRangePicker startDate={startDate || ''} endDate={endDate || ''} onChange={({ min, max }) => onChange(min, max || '')} maxDays={366} accentColor="indigo" hideDisplayChip={true} />
                    {isSet && (
                        <div className="mt-3 flex justify-end">
                            <button type="button" onClick={() => onChange('', '')} className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 font-semibold px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">Clear dates</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // ── Compact inline mode (FAQ params form) ──────────────
    if (inlineMode) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [showCustom, setShowCustom] = React.useState(false);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const popoverRef = React.useRef(null);

        // eslint-disable-next-line react-hooks/rules-of-hooks
        React.useEffect(() => {
            if (!showCustom) return;
            const handleClickOutside = (e) => {
                if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                    setShowCustom(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [showCustom]);

        const handlePreset = (preset) => {
            applyPreset(preset);
            setShowCustom(false);
        };
        const handleCustom = () => setShowCustom(p => !p);

        return (
            <div>
                {!hideLabel && (
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
                        Date Range
                        {required ? <span className="text-red-400 ml-1">*</span> : <span className="font-normal ml-1 normal-case text-gray-400">(optional)</span>}
                    </label>
                )}

                {/* Compact preset pill row + Custom button anchor */}
                <div className="relative" ref={popoverRef}>
                    <div className="flex flex-wrap gap-1.5">
                        {SPEEDY_DATE_PRESETS.map(preset => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => handlePreset(preset)}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                                    activePreset === preset.label
                                        ? 'bg-indigo-600 text-white border-transparent shadow-sm'
                                        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={handleCustom}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all flex items-center gap-1 ${
                                showCustom || (!activePreset && isSet)
                                    ? 'bg-indigo-600 text-white border-transparent shadow-sm'
                                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400'
                            }`}
                        >
                            <Calendar size={10} /> Custom
                        </button>
                    </div>

                    {/* Floating calendar popover — overlays content, no layout shift */}
                    {showCustom && (
                        <div className="absolute left-0 top-[calc(100%+6px)] z-50 rounded-xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" style={{ minWidth: 320 }}>
                            <DateRangePicker
                                startDate={startDate || ''}
                                endDate={endDate || ''}
                                onChange={({ min, max }) => { onChange(min, max || ''); if (min && max) setShowCustom(false); }}
                                maxDays={366}
                                accentColor="indigo"
                                hideDisplayChip={true}
                            />
                        </div>
                    )}
                </div>

                {/* Selected date chip */}
                {displayText && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg">
                            {displayText}
                        </span>
                        <button type="button" onClick={() => { onChange('', ''); setShowCustom(false); }} className="text-[11px] text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                            × clear
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Collapsible mode (chat)
    return (
        <div className="max-w-3xl mx-auto mb-2">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-2xl overflow-hidden transition-all duration-300">
                {/* Expandable body */}
                <div
                    className="overflow-hidden transition-all duration-300"
                    style={{ maxHeight: isExpanded ? '480px' : '0px', opacity: isExpanded ? 1 : 0 }}
                >
                    {pickerContent}
                </div>
                {/* Toggle header */}
                <div
                    onClick={() => setIsExpanded(p => !p)}
                    className={`w-full px-4 py-3 flex items-center justify-between transition-colors bg-gray-50/50 dark:bg-gray-950/50 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${isExpanded ? 'border-t border-gray-200 dark:border-gray-700/80' : ''}`}
                >
                    <div className="flex items-center gap-2">
                        <Calendar className={`w-4 h-4 ${isSet ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-400'}`} />
                        <span className={`text-sm font-semibold uppercase tracking-wide ${isSet ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            Date Range
                        </span>
                        {displayText && (
                            <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                                {displayText}
                            </span>
                        )}
                        {!isSet && (
                            <span className="text-xs text-red-400 font-medium">Required</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isSet && (
                            <button
                                onClick={e => { e.stopPropagation(); onChange('', ''); }}
                                className="text-[10px] text-red-400 hover:text-red-300 font-medium px-2 py-1 hover:bg-red-500/10 rounded transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Custom Responsive SVG Robot Loader ────────────────────
const RobotLoader = () => {
    return (
        <div className="flex justify-start my-2">
            <div className="flex items-center gap-3 bg-white dark:bg-[#0f172a] border border-blue-500/20 px-4 py-2.5 rounded-2xl rounded-bl-none shadow-sm min-w-[200px] overflow-hidden">
                
                {/* SVG Animation Container */}
                <div className="relative flex items-center justify-center w-[36px] h-[36px] shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                        <defs>
                            <linearGradient id="blueGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                            <style>
                                {`
                                    .svg-robot-group { animation: svgFadeOut 3s infinite cubic-bezier(0.4, 0, 0.2, 1); }
                                    .svg-notebook-group { opacity: 0; animation: svgFadeIn 3s infinite cubic-bezier(0.4, 0, 0.2, 1); }
                                    
                                    .svg-head {
                                        transform-origin: 50px 50px;
                                        animation: svgHeadBob 3s infinite ease-in-out;
                                    }
                                    .svg-sparkle1 { transform-origin: 80px 20px; animation: svgPop 3s infinite 0.2s; }
                                    .svg-sparkle2 { transform-origin: 88px 38px; animation: svgPop 3s infinite 0.4s; }
                                    
                                    .svg-pen {
                                        opacity: 0;
                                        transform-origin: 75px 65px;
                                        animation: svgScribble 3s infinite cubic-bezier(0.4, 0, 0.2, 1);
                                    }

                                    @keyframes svgHeadBob {
                                        0%, 15% { transform: translateY(0) rotate(0deg); }
                                        25% { transform: translateY(-4px) rotate(-8deg); }
                                        35%, 100% { transform: translateY(0) rotate(0deg); }
                                    }
                                    @keyframes svgPop {
                                        0%, 15% { opacity: 0; transform: scale(0.5); }
                                        25% { opacity: 1; transform: scale(1.3); }
                                        35%, 100% { opacity: 0; transform: scale(0.5); }
                                    }
                                    @keyframes svgFadeOut {
                                        0%, 45% { opacity: 1; transform: translateY(0); }
                                        50%, 95% { opacity: 0; transform: translateY(5px); }
                                        100% { opacity: 1; transform: translateY(0); }
                                    }
                                    @keyframes svgFadeIn {
                                        0%, 45% { opacity: 0; transform: translateY(-5px); }
                                        50%, 95% { opacity: 1; transform: translateY(0); }
                                        100% { opacity: 0; transform: translateY(-5px); }
                                    }
                                    @keyframes svgScribble {
                                        0%, 45% { opacity: 0; transform: translate(15px, -15px) rotate(20deg); }
                                        50% { opacity: 1; transform: translate(0px, 0px) rotate(0deg); }
                                        55% { transform: translate(-8px, 6px) rotate(-15deg); }
                                        65% { transform: translate(8px, 2px) rotate(10deg); }
                                        75% { transform: translate(-6px, 8px) rotate(-5deg); }
                                        85% { transform: translate(4px, 4px) rotate(5deg); }
                                        90% { opacity: 1; transform: translate(0px, 0px) rotate(0deg); }
                                        95%, 100% { opacity: 0; transform: translate(15px, -15px) rotate(20deg); }
                                    }
                                `}
                            </style>
                        </defs>
                        
                        {/* Background Container */}
                        <circle cx="50" cy="50" r="48" className="fill-blue-50 dark:fill-slate-800" />
                        
                        {/* ─── Phase 1: Thinking Robot ─── */}
                        <g className="svg-robot-group">
                            <g className="svg-head">
                                {/* Neck */}
                                <rect x="42" y="65" width="16" height="10" rx="2" fill="#94a3b8" />
                                {/* Face Area */}
                                <rect x="20" y="30" width="60" height="42" rx="12" fill="url(#blueGlow)" />
                                <rect x="25" y="36" width="50" height="30" rx="8" className="fill-white dark:fill-[#0f172a]" />
                                {/* Eyes */}
                                <circle cx="38" cy="48" r="6" fill="url(#blueGlow)" className="animate-[pulse_1s_infinite]" />
                                <circle cx="62" cy="48" r="6" fill="url(#blueGlow)" className="animate-[pulse_1s_infinite]" />
                                {/* Mouth */}
                                <rect x="45" y="58" width="10" height="3" rx="1.5" className="fill-blue-600 dark:fill-blue-400" />
                                {/* Antenna */}
                                <line x1="50" y1="30" x2="50" y2="15" stroke="url(#blueGlow)" strokeWidth="4" strokeLinecap="round" />
                                <circle cx="50" cy="12" r="5" className="fill-yellow-400 animate-ping" style={{ animationDuration: '2s' }} />
                                <circle cx="50" cy="12" r="5" className="fill-yellow-400" />
                            </g>
                            {/* Sparkles */}
                            <path className="svg-sparkle1" d="M 80 10 L 82 17 L 89 19 L 82 21 L 80 28 L 78 21 L 71 19 L 78 17 Z"  />
                            <path className="svg-sparkle2" d="M 88 32 L 89 36 L 93 37 L 89 38 L 88 42 L 87 38 L 83 37 L 87 36 Z"  />
                        </g>
                        
                        {/* ─── Phase 2: Writing Notebook ─── */}
                        <g className="svg-notebook-group">
                            {/* Book Body */}
                            <rect x="25" y="25" width="46" height="54" rx="4" className="fill-white dark:fill-slate-700 stroke-blue-200 dark:stroke-slate-600" strokeWidth="3" />
                            {/* Spine */}
                            <rect x="20" y="25" width="8" height="54" rx="2" fill="url(#blueGlow)" />
                            {/* Paper Lines */}
                            <line x1="38" y1="40" x2="60" y2="40" className="stroke-blue-200 dark:stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
                            <line x1="38" y1="52" x2="64" y2="52" className="stroke-blue-200 dark:stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
                            <line x1="38" y1="64" x2="50" y2="64" className="stroke-blue-200 dark:stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
                            
                            {/* Animated Pen */}
                            <g className="svg-pen">
                                {/* Pen Body */}
                                <path d="M 55 60 L 75 20 L 85 25 L 65 65 Z" fill="url(#blueGlow)" stroke="#ffffff" strokeWidth="2" />
                                {/* Pen Tip */}
                                <polygon points="55,60 65,65 52,72" className="fill-slate-800 dark:fill-white" />
                                {/* Ink Drop */}
                                <circle cx="50" cy="74" r="3" className="fill-slate-800 dark:fill-white animate-pulse" />
                            </g>
                        </g>
                    </svg>
                </div>

                {/* Text Content */}
                <div className="flex flex-col relative w-[130px] h-[32px] justify-center ml-1">
                    {/* Phase 1 Text */}
                    <div className="absolute inset-0 flex flex-col justify-center animate-bot-think">
                        <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">
                            Speedy is thinking
                        </span>
                        <span className="text-[10px] text-gray-400 mt-[1px]">
                            Analyzing parameters...
                        </span>
                    </div>
                    {/* Phase 2 Text */}
                    <div className="absolute inset-0 flex flex-col justify-center animate-bot-write">
                        <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 tracking-tight">
                            Generating numbers
                        </span>
                        <span className="text-[10px] text-gray-400 mt-[1px]">
                            Reconciling data...
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
};

// ─── FAQ Full-Screen Loading Animation ─────────────────────
const FAQLoadingScreen = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="faqBlueGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <style>{`
                        .faq-robot { animation: svgFadeOut 3s infinite cubic-bezier(0.4,0,0.2,1); }
                        .faq-notebook { opacity:0; animation: svgFadeIn 3s infinite cubic-bezier(0.4,0,0.2,1); }
                        .faq-head { transform-origin: 50px 50px; animation: svgHeadBob 3s infinite ease-in-out; }
                        .faq-sp1 { transform-origin: 80px 20px; animation: svgPop 3s infinite 0.2s; }
                        .faq-sp2 { transform-origin: 88px 38px; animation: svgPop 3s infinite 0.4s; }
                        .faq-pen { opacity:0; transform-origin:75px 65px; animation: svgScribble 3s infinite cubic-bezier(0.4,0,0.2,1); }
                    `}</style>
                </defs>
                <circle cx="50" cy="50" r="48" className="fill-blue-50 dark:fill-slate-800" />
                <g className="faq-robot">
                    <g className="faq-head">
                        <rect x="42" y="65" width="16" height="10" rx="2" fill="#94a3b8" />
                        <rect x="20" y="30" width="60" height="42" rx="12" fill="url(#faqBlueGlow)" />
                        <rect x="25" y="36" width="50" height="30" rx="8" className="fill-white dark:fill-[#0f172a]" />
                        <circle cx="38" cy="48" r="6" fill="url(#faqBlueGlow)" className="animate-[pulse_1s_infinite]" />
                        <circle cx="62" cy="48" r="6" fill="url(#faqBlueGlow)" className="animate-[pulse_1s_infinite]" />
                        <rect x="45" y="58" width="10" height="3" rx="1.5" className="fill-blue-600 dark:fill-blue-400" />
                        <line x1="50" y1="30" x2="50" y2="15" stroke="url(#faqBlueGlow)" strokeWidth="4" strokeLinecap="round" />
                        <circle cx="50" cy="12" r="5" className="fill-yellow-400 animate-ping" style={{ animationDuration: '2s' }} />
                        <circle cx="50" cy="12" r="5" className="fill-yellow-400" />
                    </g>
                    <path className="faq-sp1" d="M 80 10 L 82 17 L 89 19 L 82 21 L 80 28 L 78 21 L 71 19 L 78 17 Z" />
                    <path className="faq-sp2" d="M 88 32 L 89 36 L 93 37 L 89 38 L 88 42 L 87 38 L 83 37 L 87 36 Z" />
                </g>
                <g className="faq-notebook">
                    <rect x="25" y="25" width="46" height="54" rx="4" className="fill-white dark:fill-slate-700 stroke-blue-200 dark:stroke-slate-600" strokeWidth="3" />
                    <rect x="20" y="25" width="8" height="54" rx="2" fill="url(#faqBlueGlow)" />
                    <line x1="38" y1="40" x2="60" y2="40" className="stroke-blue-200 dark:stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
                    <line x1="38" y1="52" x2="64" y2="52" className="stroke-blue-200 dark:stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
                    <line x1="38" y1="64" x2="50" y2="64" className="stroke-blue-200 dark:stroke-slate-500" strokeWidth="3" strokeLinecap="round" />
                    <g className="faq-pen">
                        <path d="M 55 60 L 75 20 L 85 25 L 65 65 Z" fill="url(#faqBlueGlow)" stroke="#ffffff" strokeWidth="2" />
                        <polygon points="55,60 65,65 52,72" className="fill-slate-800 dark:fill-white" />
                        <circle cx="50" cy="74" r="3" className="fill-slate-800 dark:fill-white animate-pulse" />
                    </g>
                </g>
            </svg>
        </div>

        <div className="relative h-12 w-72 text-center">
            <div className="absolute inset-0 flex flex-col items-center justify-center animate-bot-think">
                <p className="text-base font-semibold text-gray-800 dark:text-gray-200">Speedy is thinking…</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Analyzing your parameters</p>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center animate-bot-write">
                <p className="text-base font-semibold text-gray-800 dark:text-gray-200">Generating numbers</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Building your insights</p>
            </div>
        </div>

        <div className="flex gap-2">
            {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════
//  SpeedyAgentPage — Full-page AI Agent experience
// ═══════════════════════════════════════════════════════════

const useTheme = () => {
    // Speedy AI defaults to DARK. Uses its own storage key ('speedyTheme') rather
    // than the legacy 'theme' key: the old code wrote 'theme'='light' on every
    // mount, so reusing it would pin returning users to light and hide this
    // default. A fresh key means dark-by-default while still remembering an
    // explicit toggle to light.
    const [theme, setTheme] = useState(() => localStorage.getItem('speedyTheme') || 'dark');

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        localStorage.setItem('speedyTheme', theme);

        // Revert back to light mode globally when leaving the SpeedyAgentPage
        return () => {
            root.classList.remove('dark');
            root.classList.add('light');
        };
    }, [theme]);

    return [theme, setTheme];
};

// ═══════════════════════════════════════════════════════════
//  REMEMBERED ACCOUNT SELECTION
//  Speedy AI keeps the marketplace + accounts you last analysed so you don't
//  re-pick them for every question.
//
//  ⚠ Stored ids are ALWAYS re-validated against the freshly fetched
//    marketplaces before use: accounts get deleted — a stale id must never
//    reach the backend.
// ═══════════════════════════════════════════════════════════
const FAQ_SELECTION_KEY = 'speedyFaqSelection';   // { marketplace, accountIds }
const CHAT_ACCOUNTS_KEY = 'speedyChatAccounts';   // [accountId]

const readStored = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
        return fallback;   // corrupt/blocked storage must never break the page
    }
};
const writeStored = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* quota/private mode */ }
};

// Resolve a stored FAQ selection against the live marketplace list.
// Returns null when the marketplace no longer exists (deleted).
const resolveFaqSelection = (stored, marketplaces) => {
    const mp = stored?.marketplace && marketplaces.find(m => m.key === stored.marketplace);
    if (!mp) return null;
    const ids = (stored.accountIds || []).filter(id => mp.accounts?.some(a => a._id === id));
    return { marketplace: mp.key, accountIds: ids };
};

// ═══════════════════════════════════════════════════════════
//  LANGUAGE SWITCH — EN / हिंदी sliding pill
//  Sits at the top-right of every view. Talks to LanguageContext
//  directly, so no props need threading down from the page.
//  Both buttons are w-12 so the 50%-wide indicator lands exactly
//  on each half — don't change one width without the other.
// ═══════════════════════════════════════════════════════════
const LanguageSwitch = ({ className = '' }) => {
    const { lang, setLang } = useLanguage();

    return (
        <div
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            title="Change question language"
            className={`relative flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1
                cursor-pointer shrink-0 select-none ${className}`}
        >
            {/* Sliding indicator */}
            <div className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white dark:bg-gray-900
                rounded-md shadow-sm transition-transform duration-300 ease-in-out ${
                lang === 'hi' ? 'translate-x-full' : 'translate-x-0'
            }`} />
            <button
                onClick={e => { e.stopPropagation(); setLang('en'); }}
                className={`relative z-10 w-12 py-1 text-[11px] font-medium rounded-md transition-colors duration-200 ${
                    lang === 'en'
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
            >
                EN
            </button>
            <button
                onClick={e => { e.stopPropagation(); setLang('hi'); }}
                className={`relative z-10 w-12 py-1 text-[11px] font-medium rounded-md transition-colors duration-200 ${
                    lang === 'hi'
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
            >
                हिंदी
            </button>
        </div>
    );
};

const SpeedyAgentPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // ── Language (translation) ───────────────────────────
    const { lang, setLang, t } = useLanguage();

    // ── Navigation state ─────────────────────────────────
    const [theme, setTheme] = useTheme();
    const [activeView, setActiveView] = useState('home');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedQuestion, setSelectedQuestion] = useState(null);

    // ── Sidebar collapse state ────────────────────────────
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const toggleSidebar = () => setSidebarOpen(prev => !prev);

    // ── Chat state ───────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // ── Marketplace filter state ─────────────────────────
    const [marketplaces, setMarketplaces] = useState([]);
    const [marketplacesLoaded, setMarketplacesLoaded] = useState(false);
    const [selectedAccounts, setSelectedAccounts] = useState([]);
    const [selectedMarketplaceKey, setSelectedMarketplaceKey] = useState(null);

    // ── Chat date range state ────────────────────────────
    const [chatStartDate, setChatStartDate] = useState('');
    const [chatEndDate, setChatEndDate] = useState('');
    const [actionBarOpen, setActionBarOpen] = useState(true);
    const [dateModalOpen, setDateModalOpen] = useState(false);
    const [mpModalOpen, setMpModalOpen] = useState(false);

    // ── FAQ Param collection state ───────────────────────
    const [params, setParams] = useState({});
    const [selectedMarketplace, setSelectedMarketplace] = useState('');
    const [selectedAccount, setSelectedAccount] = useState([]); // array of account _ids
    const [paramLoading, setParamLoading] = useState(false);
    const [paramErrors, setParamErrors] = useState({});

    const tenantId = user?.tenantId || user?._id;

    // ── Fetch marketplaces ───────────────────────────────
    useEffect(() => {
        if (marketplacesLoaded) return;
        (async () => {
            try {
                const res = await api.get('/marketplaces/filter-options?includeInactive=true');
                const raw = Array.isArray(res.data) ? res.data : res.data?.data || [];
                // Myntra is supported in Speedy AI now.
                setMarketplaces(raw);
            } catch (_) {
                setMarketplaces([]);
            } finally {
                setMarketplacesLoaded(true);
            }
        })();
    }, [marketplacesLoaded]);

    // ── Restore the remembered selection (once, after load) ──
    // Runs before the auto-pick effects below so a remembered choice wins over
    // "auto-select the only option". Validated ids only — see readStored notes.
    const selectionRestored = useRef(false);
    useEffect(() => {
        if (!marketplacesLoaded || selectionRestored.current) return;
        selectionRestored.current = true;

        const faq = resolveFaqSelection(readStored(FAQ_SELECTION_KEY, null), marketplaces);
        if (faq) {
            setSelectedMarketplace(faq.marketplace);
            if (faq.accountIds.length) setSelectedAccount(faq.accountIds);
        }

        const liveIds = new Set(marketplaces.flatMap(m => (m.accounts || []).map(a => a._id)));
        const chatIds = (readStored(CHAT_ACCOUNTS_KEY, []) || []).filter(id => liveIds.has(id));
        if (chatIds.length) setSelectedAccounts(chatIds);
    }, [marketplacesLoaded, marketplaces]);

    // ── Persist selections ───────────────────────────────
    // Guarded on a non-empty marketplace: opening a question the marketplace
    // doesn't support clears it transiently, and that must not wipe the memory.
    useEffect(() => {
        if (!selectionRestored.current || !selectedMarketplace) return;
        writeStored(FAQ_SELECTION_KEY, { marketplace: selectedMarketplace, accountIds: selectedAccount });
    }, [selectedMarketplace, selectedAccount]);

    useEffect(() => {
        if (!selectionRestored.current) return;
        writeStored(CHAT_ACCOUNTS_KEY, selectedAccounts);
    }, [selectedAccounts]);

    // ── Auto-pick the only marketplace ───────────────────
    useEffect(() => {
        if (marketplaces.length === 1 && !selectedMarketplace) {
            setSelectedMarketplace(marketplaces[0].key);
        }
    }, [marketplaces, selectedMarketplace]);

    // ── Auto-select account when marketplace has only 1 ──
    useEffect(() => {
        if (!selectedMarketplace) { setSelectedAccount([]); return; }
        const mp = marketplaces.find(m => m.key === selectedMarketplace);
        if (mp?.accounts?.length === 1) setSelectedAccount([mp.accounts[0]._id]);
    }, [selectedMarketplace, marketplaces]);

    // ── Scroll chat to bottom ────────────────────────────
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);

    // ── Auto-resize textarea ─────────────────────────────
    const autoResizeTextarea = () => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            const nextHeight = Math.min(ta.scrollHeight, 200);
            ta.style.height = `${nextHeight}px`;
            ta.style.overflowY = ta.scrollHeight > 200 ? 'auto' : 'hidden';
        }
    };

    // ── Navigation helpers ───────────────────────────────
    const goHome = () => {
        setActiveView('home');
        setSelectedCategory(null);
        setSelectedQuestion(null);
        setResponse(null);
    };

    const goToChat = () => {
        setActiveView('chat');
        setSelectedCategory(null);
        setSelectedQuestion(null);
    };

    const goToFAQ = () => {
        setActiveView('faq');
        setSelectedCategory(null);
        setSelectedQuestion(null);
    };

    const goToCategory = (cat) => {
        setSelectedCategory(cat);
        setActiveView('faq');
    };

    const goToQuestion = (q, cat) => {
        if (cat) setSelectedCategory(cat);
        setSelectedQuestion(q);
        // Seed param defaults into state.
        //   - Any param with an explicit defaultValue is seeded, REQUIRED ones
        //     included. A required toggle (adsMode, comparator) shows its default
        //     visually via a value||defaultValue fallback, but state stays
        //     undefined until clicked — so required-validation would fail with
        //     no visible error (toggles render none). Seeding closes that gap.
        //   - Optional NUMBER fields keep using their placeholder as a soft
        //     default (that's how minOrders / topN etc. carry their default).
        //   - Placeholders are NOT seeded for date/text fields: those are hints
        //     like "Leave blank for all time", and feeding one into the date
        //     parser produced an Invalid Date → the whole calendar rendered NaN.
        const initial = {};
        q.params?.forEach(p => {
            if (p.defaultValue !== undefined) {
                initial[p.key] = String(p.defaultValue);
            } else if (!p.required && p.type === 'number' && p.placeholder !== undefined) {
                initial[p.key] = String(p.placeholder);
            }
        });
        setParams(initial);
        setParamErrors({});
        // Reuse the remembered marketplace/accounts instead of clearing — that
        // reset was why every question needed the picker filled in again. If the
        // question doesn't support the remembered marketplace, the support effect
        // in FAQWorkspace clears it right after (and the persist guard keeps the
        // stored value intact).
        const remembered = resolveFaqSelection(readStored(FAQ_SELECTION_KEY, null), marketplaces);
        setSelectedMarketplace(remembered?.marketplace || '');
        setSelectedAccount(remembered?.accountIds || []);
        if (q.type === 'static') {
            setResponse({ data: [], format: 'text', chartType: null, summary: q.answer });
            setActiveView('response');
        } else {
            setActiveView('params');
        }
    };

    // ── Chat send handler ────────────────────────────────
    const handleChatSend = async (queryOverride) => {
        const query = (queryOverride || chatInput).trim();
        if (!query || isLoading || !tenantId) return;

        // Require date range and marketplace selection
        if (!chatStartDate || !chatEndDate || selectedAccounts.length === 0) return;

        // Check analysisStartDate to append warning later
        const invalidAccounts = [];
        const startDateTime = new Date(chatStartDate).getTime();
        for (const mp of marketplaces) {
            for (const acc of mp.accounts) {
                if (selectedAccounts.includes(acc._id) && acc.analysisStartDate) {
                    const analysisTime = new Date(acc.analysisStartDate).getTime();
                    if (startDateTime < analysisTime) {
                        invalidAccounts.push({ name: acc.name, date: acc.analysisStartDate });
                    }
                }
            }
        }

        setChatInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setMessages(prev => [...prev, { type: 'user', text: query, timestamp: Date.now() }]);
        setIsLoading(true);

        try {
            const conversationHistory = messages.slice(-6).map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.text,
                // Include the SQL that produced this response so the AI can understand
                // what columns/entities were returned for follow-up questions.
                ...(msg.sql ? { sql: msg.sql } : {}),
            }));

            const requestData = { query, tenantId, conversationHistory };
            if (selectedAccounts.length > 0) requestData.marketplaceIds = selectedAccounts;
            if (chatStartDate && chatEndDate) {
                requestData.startDate = chatStartDate;
                requestData.endDate = chatEndDate;
            }

            const res = await api.post('/agent/query', requestData);
            let { summary, data, format, chartType, sql } = res.data;

            if (invalidAccounts.length > 0) {
                const warningText = `\n\n⚠️ Data limit: Results exclude dates before each account's analysis start — ` + invalidAccounts.map(a => `${a.name} (from ${new Date(a.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })})`).join(', ') + '.';
                summary = (summary || '') + warningText;
            }

            setMessages(prev => [...prev, {
                type: 'agent', text: summary,
                data: data || [], format: format || (data?.length ? 'table' : 'text'),
                chartType: chartType || null, timestamp: Date.now(),
                sql: sql || null,
            }]);
        } catch (_) {
            setMessages(prev => [...prev, {
                type: 'agent', text: 'Something went wrong. Please try again.',
                data: null, format: 'text', chartType: null, timestamp: Date.now(),
            }]);
        } finally {
            setIsLoading(false);
            // Auto-close action bar after first send (success or error)
            setActionBarOpen(false);
        }
    };

    // ── FAQ param run handler ────────────────────────────
    const handleRunFAQ = async () => {
        if (!selectedQuestion) return;

        // Validate
        const newErrors = {};

        // Dates are required by default; allow opt-out via param-level required:false.
        const datesRequired = (selectedQuestion.params || [])
            .filter(p => p.key === 'startDate' || p.key === 'endDate')
            .every(p => p.required !== false);
        if (datesRequired && (!params.startDate || !params.endDate)) {
            newErrors.startDate = 'Start date is required';
            newErrors.endDate = 'End date is required';
        }

        if (selectedQuestion.requiresMarketplace) {
            if (!selectedMarketplace) {
                newErrors._marketplace = 'Please select a marketplace';
            } else if (selectedAccount.length === 0) {
                newErrors._account = 'Please select at least one account';
            }
        }

        selectedQuestion.params?.forEach(p => {
            if (p.required && !params[p.key]?.toString().trim()) {
                newErrors[p.key] = `${p.label} is required`;
            }
        });
        setParamErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        // Check analysisStartDate for FAQ params — warn for earliest account in selection
        let faqWarning = '';
        if (selectedAccount.length > 0 && params.startDate) {
            let earliest = null;
            for (const mp of marketplaces) {
                for (const a of mp.accounts) {
                    if (selectedAccount.includes(a._id) && a.analysisStartDate) {
                        if (!earliest || new Date(a.analysisStartDate) > new Date(earliest.analysisStartDate)) {
                            earliest = a;
                        }
                    }
                }
            }
            if (earliest) {
                const startDateTime = new Date(params.startDate).getTime();
                const analysisTime = new Date(earliest.analysisStartDate).getTime();
                if (startDateTime < analysisTime) {
                    faqWarning = `\n\n⚠️ Data limit: ${earliest.name} has data only from ${new Date(earliest.analysisStartDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} onwards. Earlier dates are excluded.`;
                }
            }
        }

        // Clear previous response immediately so stale summary/data don't show during new query
        setResponse(null);
        setParamLoading(true);
        const finalParams = { ...params };
        if (selectedAccount.length > 0) finalParams.accountId = selectedAccount.length === 1 ? selectedAccount[0] : selectedAccount;

        try {
            const res = await api.post('/agent/faq', {
                questionId: selectedQuestion.id,
                params: finalParams,
                tenantId,
            });
            
            const responseData = { ...res.data };
            if (faqWarning) {
                responseData.summary = (responseData.summary || '') + faqWarning;
            }
            
            setResponse(responseData);
            setActiveView('response');
        } catch (_) {
            setResponse({
                data: [], format: 'text', chartType: null,
                summary: 'Failed to fetch data. Please try again.',
            });
            setActiveView('response');
        } finally {
            setParamLoading(false);
        }
    };

    // ── Go back to params form from result ───────────────
    const handleModifyFAQParams = () => {
        setResponse(null);
        setActiveView('params');
    };

    // ── Marketplace filter helpers (for chat) ────────────
    const toggleAccount = (accountId) => {
        setSelectedAccounts(prev =>
            prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
        );
    };

    const toggleMarketplaceSelection = (marketplace) => {
        const ids = marketplace.accounts.map(a => a._id);
        const allSelected = ids.every(id => selectedAccounts.includes(id));
        if (allSelected) {
            setSelectedAccounts(prev => prev.filter(id => !ids.includes(id)));
        } else {
            setSelectedAccounts(prev => [...new Set([...prev, ...ids])]);
        }
    };

    const isMarketplaceFullySelected = (mp) => {
        const ids = mp.accounts.map(a => a._id);
        return ids.length > 0 && ids.every(id => selectedAccounts.includes(id));
    };

    const isMarketplacePartiallySelected = (mp) => {
        const ids = mp.accounts.map(a => a._id);
        const count = ids.filter(id => selectedAccounts.includes(id)).length;
        return count > 0 && count < ids.length;
    };

    const getCurrentFilter = () => {
        if (selectedAccounts.length === 0) return null;
        if (selectedAccounts.length === 1) {
            for (const mp of marketplaces) {
                const acc = mp.accounts.find(a => a._id === selectedAccounts[0]);
                if (acc) return acc.name;
            }
            return '1 Account';
        }
        return `${selectedAccounts.length} Accounts`;
    };

    // ── Handle sign out ──────────────────────────────────

    const handleSignOut = () => {
        logout();
        navigate('/login');
    };

    // ═══════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════
    return (
        <>
            <style>{scrollbarStyles}</style>
            <div className="flex h-screen bg-slate-50 dark:bg-gray-950 dark:bg-none text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
                {/* ═══ SIDEBAR ═══════════════════════════════ */}
                <aside
                    className={`${
                        sidebarOpen ? 'w-64' : 'w-[64px]'
                    } transition-all duration-300 ease-in-out bg-slate-100/50 dark:bg-gray-900 border-r border-gray-200/80 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden`}
                >
                    {/* ─── Header: Logo icon (fixed) + fading title + toggle ─── */}
                    <div className="h-14 flex items-center shrink-0 pl-3 pr-3 gap-3 relative group">
                        {/* Logo icon area — when sidebar is CLOSED, hovering swaps Zap for ChevronsRight */}
                        <div 
                            className={`relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all ${
                                !sidebarOpen ? 'cursor-pointer hover:bg-gray-200/70 dark:hover:bg-gray-700/60' : ''
                            }`}
                            onClick={!sidebarOpen ? toggleSidebar : undefined}
                            title={!sidebarOpen ? 'Expand sidebar' : undefined}
                        >
                            <div className={`flex items-center justify-center w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-700 rounded-xl shrink-0 transition-all shadow-sm ${
                                !sidebarOpen ? 'group-hover:opacity-0 group-hover:scale-95 absolute' : 'relative'
                            }`}>
                                <Zap size={22} className="text-white" />
                            </div>
                            {!sidebarOpen && (
                                <ChevronsRight size={22} className="opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all text-gray-500 dark:text-gray-400 absolute" />
                            )}
                        </div>
                        {/* Title — fades + clips, never wraps */}
                        <span className={`text-lg font-semibold tracking-tight font-heading whitespace-nowrap overflow-hidden transition-all duration-300 ${
                            sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                        }`}>
                            Speedy <span className="text-blue-600 dark:text-blue-400">AI</span>
                        </span>
                        {/* Toggle Collapse — floats right when open, clips completely when closed */}
                        <div className={`overflow-hidden transition-all duration-300 flex items-center justify-end ${
                            sidebarOpen ? 'opacity-100 max-w-[32px] ml-auto' : 'opacity-0 max-w-0 ml-0 p-0 m-0 pointer-events-none'
                        }`}>
                            <button
                                onClick={toggleSidebar}
                                title="Collapse sidebar"
                                className="shrink-0 p-1.5 rounded-md text-gray-800 hover:text-gray-900 hover:bg-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700/60 transition-all duration-150"
                            >
                                <ChevronsLeft size={18} />
                            </button>
                        </div>
                    </div>



                    {/* ─── Main Navigation ─── */}
                    <nav className="px-2 space-y-0.5 shrink-0">
                        <SidebarNavItem icon={Home} label="Home"
                            active={activeView === 'home'} onClick={goHome} open={sidebarOpen} />
                        <SidebarNavItem icon={BookOpen} label="Most Popular Questions"
                            active={activeView === 'faq' || activeView === 'params' || activeView === 'response'}
                            onClick={goToFAQ} open={sidebarOpen} />
                        <SidebarNavItem icon={MessageSquare} label="Ask Speedy AI"
                            active={activeView === 'chat'} onClick={goToChat} open={sidebarOpen} />
                    </nav>

                    {/* ─── FAQ Categories ─── */}
                    <div className="px-2 mt-3 flex-1 overflow-hidden flex flex-col min-h-0">
                        <div className="h-4 flex items-center pl-[14px] pr-3 mb-1.5 shrink-0">
                            <span className={`text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                            }`}>
                                FAQ Categories
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-0.5 pb-4">
                            {VISIBLE_CATEGORIES.map(cat => {
                                const Icon = SIDEBAR_CAT_ICONS[cat.id] || Package;
                                const isActive = selectedCategory?.id === cat.id &&
                                    (activeView === 'faq' || activeView === 'params' || activeView === 'response');
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => goToCategory(cat)}
                                        title={!sidebarOpen ? cat.label : undefined}
                                        className={`w-full flex items-center gap-3 px-[14px] py-3 rounded-xl text-sm transition-all duration-150 ${
                                            isActive
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-white'
                                                : 'text-gray-800 dark:text-gray-100 hover:text-gray-700 hover:bg-gray-100/80 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <Icon size={20} className="shrink-0" />
                                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                            sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                                        }`}>{cat.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ─── Bottom: Dashboard + Theme + Sign Out ─── */}
                    <div className="px-2 pb-4 space-y-0.5 border-t border-gray-200 dark:border-gray-800 pt-2 shrink-0">
                        <button
                            onClick={() => navigate('/dashboard')}
                            title={!sidebarOpen ? 'Back to Dashboard' : undefined}
                            className="w-full flex items-center gap-3 px-[14px] py-3 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 dark:hover:bg-gray-800 transition-all"
                        >
                            <Home size={20} className="shrink-0" />
                            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                            }`}>Back to Dashboard</span>
                        </button>
                        {/* Theme toggle — icon crossfades + rotates, label tracks current theme */}
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            title={!sidebarOpen ? (theme === 'dark' ? 'Dark Mode' : 'Light Mode') : undefined}
                            className="w-full flex items-center gap-3 px-[14px] py-3 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 dark:hover:bg-gray-800 transition-all"
                        >
                            <span className="relative w-5 h-5 shrink-0">
                                <Sun size={20} className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                                    theme === 'dark' ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
                                }`} />
                                <Moon size={20} className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                                    theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
                                }`} />
                            </span>
                            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                            }`}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                        </button>
                        {/* <button
                            onClick={handleSignOut}
                            title={!sidebarOpen ? 'Sign Out' : undefined}
                            className="w-full flex items-center gap-3 px-[14px] py-3 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 dark:hover:bg-gray-800 transition-all"
                        >
                            <LogOut size={20} className="shrink-0" />
                            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                            }`}>Sign Out</span>
                        </button> */}
                    </div>

                </aside>

                {/* ═══ MAIN CONTENT ══════════════════════════ */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {activeView === 'home' && <HomeContent onBrowseFAQ={goToFAQ} onAskCustom={goToChat} />}

                    {activeView === 'chat' && (
                        <ChatContent
                            messages={messages}
                            setMessages={setMessages}
                            chatInput={chatInput}
                            setChatInput={setChatInput}
                            isLoading={isLoading}
                            onSend={handleChatSend}
                            textareaRef={textareaRef}
                            messagesEndRef={messagesEndRef}
                            autoResizeTextarea={autoResizeTextarea}
                            marketplaces={marketplaces}
                            selectedAccounts={selectedAccounts}
                            setSelectedAccounts={setSelectedAccounts}
                            selectedMarketplaceKey={selectedMarketplaceKey}
                            setSelectedMarketplaceKey={setSelectedMarketplaceKey}
                            toggleAccount={toggleAccount}
                            toggleMarketplaceSelection={toggleMarketplaceSelection}
                            isMarketplaceFullySelected={isMarketplaceFullySelected}
                            isMarketplacePartiallySelected={isMarketplacePartiallySelected}
                            getCurrentFilter={getCurrentFilter}
                            chatStartDate={chatStartDate}
                            chatEndDate={chatEndDate}
                            onDateChange={(s, e) => { setChatStartDate(s); setChatEndDate(e); }}
                            actionBarOpen={actionBarOpen}
                            setActionBarOpen={setActionBarOpen}

                            dateModalOpen={dateModalOpen}
                            setDateModalOpen={setDateModalOpen}
                            mpModalOpen={mpModalOpen}
                            setMpModalOpen={setMpModalOpen}
                        />
                    )}

                    {/* ── FAQ section: persistent category panel + content ── */}
                    {(activeView === 'faq' || activeView === 'params' || activeView === 'response') && (
                        <div className="flex-1 flex overflow-hidden">
                            <FAQCategoryPanel
                                selectedCategory={selectedCategory}
                                onSelectCategory={goToCategory}
                                onBack={goHome}
                            />

                            {activeView === 'faq' && (
                                <FAQContent
                                    key={selectedCategory?.id}
                                    onSelectQuestion={goToQuestion}
                                    initialCategory={selectedCategory}
                                />
                            )}

                            {(activeView === 'params' || activeView === 'response') && selectedQuestion && (
                                <FAQWorkspace
                                    question={selectedQuestion}
                                    selectedCategory={selectedCategory}
                                    marketplaces={marketplaces}
                                    params={params}
                                    setParams={setParams}
                                    paramErrors={paramErrors}
                                    setParamErrors={setParamErrors}
                                    selectedMarketplace={selectedMarketplace}
                                    setSelectedMarketplace={setSelectedMarketplace}
                                    selectedAccount={selectedAccount}
                                    setSelectedAccount={setSelectedAccount}
                                    isLoading={paramLoading}
                                    onRun={handleRunFAQ}
                                    onBack={() => setActiveView('faq')}
                                    onAskAnother={goToFAQ}
                                    onModifyParams={handleModifyFAQParams}
                                    response={activeView === 'response' ? response : null}
                                />
                            )}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

// ═══════════════════════════════════════════════════════════
//  SIDEBAR NAV ITEM
// ═══════════════════════════════════════════════════════════
const SidebarNavItem = ({ icon: Icon, label, active, onClick, open }) => (
    <button
        onClick={onClick}
        title={!open ? label : undefined}
        className={`w-full flex items-center gap-3 px-[14px] py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
            active
                ? 'bg-indigo-50/70 shadow-[0_2px_10px_rgba(99,102,241,0.1)] dark:shadow-none dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-700 hover:bg-gray-100/80 dark:hover:bg-gray-800'
        }`}
    >
        <Icon size={20} className={`shrink-0 transition-colors duration-200 ${active ? 'text-indigo-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`} />

        <span
            className={`whitespace-nowrap overflow-hidden font-semibold ${
                open ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            } ${
                active
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(99,102,241,0.3)] dark:bg-gradient-to-br dark:from-green-500 dark:to-yellow-300 dark:drop-shadow-none transition-colors duration-200'
                    : ''
            }`}
        >
            {label}
        </span>
    </button>
);

// ═══════════════════════════════════════════════════════════
//  HOME CONTENT
// ═══════════════════════════════════════════════════════════
const HomeContent = ({ onBrowseFAQ, onAskCustom }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center px-6 relative w-full">
            <TrialOfferPopup />

            {/* Sparkle icon with glow */}
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-100 blur-2xl rounded-full scale-150" />
                <Sparkles size={48} className="text-blue-600 dark:text-blue-400 relative z-10" />
            </div>

            <h1 className="text-4xl font-semibold font-heading mb-3 text-center">
                Welcome to <span className='text-blue-500'>Speedy AI</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-lg mb-12 leading-relaxed">
                Choose how you want to analyze your data today. Pick our instant pre-built answers or ask the AI directly.
            </p>

            {/* Two main cards */}
            <div className="flex gap-6 w-full max-w-2xl">
                <button
                    onClick={onBrowseFAQ}
                    className="flex-1 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 dark:hover:bg-gray-900
                        dark:hover:border-blue-500/50 hover:border-blue-500/50 hover:bg-blue-50 transition-all duration-200 text-left group"
                >
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                        <BookOpen size={22} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">✨ Most Popular Questions</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                        Get instant, cost-free answers to common analytical questions. Structured insights without waiting for AI processing.
                    </p>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 flex items-center gap-1">
                        Explore Categories <ArrowRight size={14} />
                    </span>
                </button>

                <button
                    onClick={onAskCustom}
                    className="flex-1 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 dark:hover:bg-gray-900
                        dark:hover:border-blue-500/50 hover:border-blue-500/40 hover:bg-blue-50  transition-all duration-200 text-left group"
                >
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                        <MessageSquare size={22} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Speedy AI</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                        Chat openly with our AI to slice and dice your data. Best for unique queries or deep follow-up questions.
                    </p>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 flex items-center gap-1">
                        Start Chatting <ArrowRight size={14} />
                    </span>
                </button>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
//  DATE PICKER MODAL — centered overlay
// ═══════════════════════════════════════════════════════════
const DatePickerModal = ({ isOpen, onClose, startDate, endDate, onChange }) => {
    if (!isOpen) return null;

    // Helper to find if a preset is active
    const getActivePresetLabel = () => {
        if (!startDate && !endDate) return null;
        for (const preset of SPEEDY_DATE_PRESETS) {
            const v = preset.fn();
            if (startDate === v.min && endDate === v.max) {
                return preset.label;
            }
        }
        return 'Custom';
    };

    const activePreset = getActivePresetLabel();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl flex max-w-[500px] overflow-hidden animate-fadeIn">
                {/* Left Sidebar - Presets */}
                <div className="w-[140px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/50 flex flex-col p-3 gap-1.5 overflow-y-auto max-h-[450px]">
                    <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2 mt-1">Date Range</div>
                    {SPEEDY_DATE_PRESETS.map(preset => {
                        const isActive = activePreset === preset.label;
                        return (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                    const v = preset.fn();
                                    onChange(v.min, v.max);
                                }}
                                className={`text-left px-3 py-2.5 text-[12px] font-semibold rounded-xl transition-colors border ${
                                    isActive
                                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50 shadow-sm'
                                        : 'text-slate-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-gray-200 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm'
                                }`}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        className={`text-left px-3 py-2.5 text-[12px] font-semibold rounded-xl transition-colors border mt-auto ${
                            activePreset === 'Custom'
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50 shadow-sm'
                                : 'text-slate-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-gray-200 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm'
                        }`}
                    >
                        Custom
                    </button>
                </div>

                {/* Right Area - Calendar & Actions */}
                <div className="flex flex-col p-4 w-[320px] shrink-0 bg-white dark:bg-gray-950">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-50 dark:border-gray-800/50">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-[14px]">
                            <Calendar size={16} className="text-indigo-600 dark:text-indigo-500" />
                            {startDate && endDate ? formatDateDisplay(startDate, endDate) : 'Select Date'}
                        </h3>
                        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Calendar Area */}
                    <div className="relative flex-grow bg-white dark:bg-gray-950 rounded-xl mb-4 mt-2">
                        <DateRangePicker
                            startDate={startDate || ''}
                            endDate={endDate || ''}
                            onChange={({ min, max }) => onChange(min, max || '')}
                            maxDays={366}
                            accentColor="indigo"
                            hideDisplayChip={true}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto justify-end">
                        <button
                            onClick={() => {
                                onChange('', '');
                            }}
                            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all shadow-sm"
                        >
                            Clear
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold shadow-md transition-all border border-indigo-600"
                        >
                            Set Date
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
//  MARKETPLACE MODAL — centered overlay with search
// ═══════════════════════════════════════════════════════════
const MarketplaceModal = ({
    isOpen, onClose,
    marketplaces, selectedAccounts, setSelectedAccounts,
    toggleAccount, toggleMarketplaceSelection,
    isMarketplaceFullySelected, isMarketplacePartiallySelected,
}) => {
    const [search, setSearch] = React.useState('');
    const searchRef = React.useRef(null);

    // Auto-focus search when modal opens; clear search when it closes
    React.useEffect(() => {
        if (isOpen) {
            setSearch('');
            setTimeout(() => searchRef.current?.focus(), 60);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const q = search.trim().toLowerCase();

    // Filter: keep marketplace if its name matches OR any account name matches
    const filteredMarketplaces = marketplaces.map(mp => {
        const mpMatch = mp.key.toLowerCase().includes(q);
        const filteredAccounts = q
            ? mp.accounts.filter(a => a.name.toLowerCase().includes(q))
            : mp.accounts;
        if (!q || mpMatch || filteredAccounts.length > 0) {
            return { ...mp, accounts: mpMatch && !q ? mp.accounts : filteredAccounts };
        }
        return null;
    }).filter(Boolean);

    const noResults = q && filteredMarketplaces.length === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fadeIn">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                        <Store size={16} className="text-blue-600 dark:text-blue-400" />
                        Select Marketplace
                    </h3>
                    <div className="flex items-center gap-2">
                        {selectedAccounts.length > 0 && (
                            <button
                                onClick={() => setSelectedAccounts([])}
                                className="text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-semibold px-2 py-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-all"
                            >
                                Clear all
                            </button>
                        )}
                        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Search bar */}
                <div className="px-4 pt-3 pb-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search marketplace or account…"
                            className="w-full pl-8 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 transition-all"
                        />
                        {search && (
                            <button
                                onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="px-4 pb-3 space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                    {noResults ? (
                        <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                            No results for "<span className="font-medium text-gray-600 dark:text-gray-400">{search}</span>"
                        </div>
                    ) : (
                        filteredMarketplaces.map(mp => (
                            <div key={mp.key} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                                {/* Marketplace row */}
                                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all">
                                    <input
                                        type="checkbox"
                                        checked={isMarketplaceFullySelected(mp)}
                                        ref={el => { if (el) el.indeterminate = isMarketplacePartiallySelected(mp); }}
                                        onChange={() => toggleMarketplaceSelection(mp)}
                                        className="w-4 h-4 shrink-0 rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                                    />
                                    <span className="flex-1 font-semibold text-sm text-gray-800 dark:text-gray-200">
                                        {mp.key.charAt(0).toUpperCase() + mp.key.slice(1)}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {mp.accounts.length} account{mp.accounts.length !== 1 ? 's' : ''}
                                    </span>
                                </label>

                                {/* Sub-accounts */}
                                {mp.accounts.length > 0 && (
                                    <div className="px-4 pb-3 space-y-1.5 border-t border-gray-100 dark:border-gray-800/60 pt-2">
                                        {mp.accounts.map(acc => (
                                            <label key={acc._id} className="flex items-center gap-2.5 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAccounts.includes(acc._id)}
                                                    onChange={() => toggleAccount(acc._id)}
                                                    className="w-3.5 h-3.5 ml-5 shrink-0 rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                                                />
                                                <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors flex items-center gap-1.5">
                                                    {acc.name}
                                                    {acc.status === 'inactive' && (
                                                        <span className="text-[10px] text-red-500 font-medium">(Inactive)</span>
                                                    )}
                                                    {acc.analysisStartDate && (
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-600 font-normal">
                                                            From {new Date(acc.analysisStartDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 pb-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3 min-h-[20px]">
                        {selectedAccounts.length > 0 ? (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''} selected
                            </span>
                        ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">No accounts selected</span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold transition-all shadow-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
//  CHAT CONTENT
// ═══════════════════════════════════════════════════════════
const ChatContent = ({
    messages, setMessages, chatInput, setChatInput, isLoading, onSend,
    textareaRef, messagesEndRef, autoResizeTextarea,
    marketplaces, selectedAccounts, setSelectedAccounts,
    selectedMarketplaceKey, setSelectedMarketplaceKey,
    toggleAccount, toggleMarketplaceSelection,
    isMarketplaceFullySelected, isMarketplacePartiallySelected,
    getCurrentFilter,
    chatStartDate, chatEndDate, onDateChange,
    actionBarOpen, setActionBarOpen,
    dateModalOpen, setDateModalOpen, mpModalOpen, setMpModalOpen,
}) => {
    const [warningDismissed, setWarningDismissed] = useState(false);

    // ── Speech-to-text ───────────────────────────────────
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasSpeech = !!SpeechRecognition;
    const [isListening, setIsListening] = useState(false);
    const [interimText, setInterimText] = useState('');
    const [speechError, setSpeechError] = useState('');   // shown as tooltip near mic
    const [speechLang, setSpeechLang] = useState('en-IN');
    const [showLangPicker, setShowLangPicker] = useState(false);
    const recognitionRef = useRef(null);
    const langPickerRef = useRef(null);
    const speechErrorTimer = useRef(null);

    const SPEECH_LANGS = [
        { code: 'en-IN', label: 'EN', name: 'English' },
        { code: 'hi-IN', label: 'हि', name: 'Hindi' },
        { code: 'gu-IN', label: 'ગུ', name: 'Gujarati' },
    ];

    const showSpeechError = (msg) => {
        setSpeechError(msg);
        clearTimeout(speechErrorTimer.current);
        speechErrorTimer.current = setTimeout(() => setSpeechError(''), 3500);
    };

    // Close lang picker on outside click
    useEffect(() => {
        if (!showLangPicker) return;
        const handler = (e) => {
            if (langPickerRef.current && !langPickerRef.current.contains(e.target))
                setShowLangPicker(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showLangPicker]);

    const toggleListening = useCallback(() => {
        if (!SpeechRecognition) return;
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }
        const rec = new SpeechRecognition();
        rec.lang = speechLang;
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        rec.onstart = () => { setIsListening(true); setSpeechError(''); };
        rec.onend = () => { setIsListening(false); setInterimText(''); };
        rec.onerror = (e) => {
            setIsListening(false);
            setInterimText('');
            // Map Web Speech API error codes to user-friendly messages
            const errorMap = {
                'not-allowed':       'Microphone access denied. Allow it in browser settings.',
                'service-not-allowed': 'Speech recognition is blocked in this browser.',
                'network':           'Speech recognition is not supported in this browser.',
                'no-speech':         'No speech detected. Try speaking again.',
                'audio-capture':     'No microphone found.',
                'aborted':           '',   // user stopped — no message needed
            };
            const msg = errorMap[e.error] ?? 'Speech recognition is not supported in this browser.';
            if (msg) showSpeechError(msg);
        };
        rec.onresult = (e) => {
            const latest = e.results[e.results.length - 1];
            const transcript = latest[0].transcript;
            if (latest.isFinal) {
                setChatInput(prev => (prev.trimEnd() ? prev.trimEnd() + ' ' + transcript : transcript));
                setInterimText('');
                setTimeout(autoResizeTextarea, 0);
                rec.stop();
            } else {
                setInterimText(transcript);
            }
        };
        recognitionRef.current = rec;
        try {
            rec.start();
        } catch {
            showSpeechError('Speech recognition is not supported in this browser.');
        }
    }, [isListening, SpeechRecognition, speechLang, setChatInput, autoResizeTextarea]);

    // Reset dismiss whenever date range or accounts change — new selection = new warning
    useEffect(() => {
        setWarningDismissed(false);
    }, [chatStartDate, chatEndDate, selectedAccounts]);

    const getAccountDateWarnings = () => {
        if (!chatStartDate || !chatEndDate || selectedAccounts.length === 0) return { noData: [], partialData: [], allInvalid: false };
        const start = new Date(chatStartDate).getTime();
        const end = new Date(chatEndDate).getTime();
        let validCount = 0;
        const noData = [];
        const partialData = [];
        marketplaces.forEach(mp => {
            mp.accounts.forEach(acc => {
                if (selectedAccounts.includes(acc._id)) {
                    if (acc.analysisStartDate) {
                        const analysisTime = new Date(acc.analysisStartDate).getTime();
                        if (end < analysisTime) {
                            noData.push({ name: acc.name, date: acc.analysisStartDate });
                        } else if (start < analysisTime) {
                            partialData.push({ name: acc.name, date: acc.analysisStartDate });
                            validCount++;
                        } else {
                            validCount++;
                        }
                    } else {
                        validCount++;
                    }
                }
            });
        });
        const allInvalid = validCount === 0 && noData.length > 0;
        return { noData, partialData, allInvalid };
    };

    const warnings = getAccountDateWarnings();
    const hasMessages = messages.length > 0;
    const canSend = !!(chatStartDate && chatEndDate && selectedAccounts.length > 0 && !warnings.allInvalid);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSend();
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    const exportChat = () => {
        // Find agent messages that have table data
        const dataMessages = messages.filter(m => m.type === 'agent' && m.data?.length > 0);
        if (dataMessages.length === 0) {
            // Export conversation as plain text
            const lines = messages.map(m => {
                const role = m.type === 'user' ? 'You' : 'Speedy AI';
                const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return `[${time}] ${role}: ${m.text || ''}`;
            });
            const blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `speedy-chat-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            return;
        }

        // Export the last agent data message as CSV
        const lastData = dataMessages[dataMessages.length - 1];
        const rows = lastData.data;
        const headers = Object.keys(rows[0]);
        const csvLines = [
            headers.join(','),
            ...rows.map(row =>
                headers.map(h => {
                    const v = row[h];
                    if (v === null || v === undefined) return '';
                    const s = String(v);
                    return s.includes(',') || s.includes('"') || s.includes('\n')
                        ? `"${s.replace(/"/g, '""')}"` : s;
                }).join(',')
            ),
        ];
        const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `speedy-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 shrink-0">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium shrink-0">Analytics</span>
                {/* Filter chips — show selected values */}
                <div className="flex-1 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {selectedAccounts.length > 0 ? (
                        <button
                            onClick={() => setMpModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors whitespace-nowrap"
                        >
                            <Store size={11} />
                            {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''}
                        </button>
                    ) : (
                        <button
                            onClick={() => setMpModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors whitespace-nowrap"
                        >
                            <Store size={11} />
                            No accounts
                        </button>
                    )}
                    {chatStartDate && chatEndDate ? (
                        <button
                            onClick={() => setDateModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors whitespace-nowrap"
                        >
                            <Calendar size={11} />
                            {formatDateDisplay(chatStartDate, chatEndDate)}
                        </button>
                    ) : (
                        <button
                            onClick={() => setDateModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors whitespace-nowrap"
                        >
                            <Calendar size={11} />
                            No date selected
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {/* Data limit warning icon — lives outside overflow container so tooltip is never clipped */}
                    {(warnings.noData.length > 0 || warnings.partialData.length > 0) && (() => {
                        const allAffected = [...warnings.noData, ...warnings.partialData];
                        const minDate = new Date(Math.min(...allAffected.map(a => new Date(a.date).getTime())));
                        const minDateStr = minDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                        const isBlocked = warnings.allInvalid;
                        return (
                            <div className="relative group/warn">
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium cursor-default transition-colors ${isBlocked ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40 text-amber-600 dark:text-amber-400'}`}>
                                    <AlertTriangle size={11} />
                                    <span>Data limit</span>
                                </div>
                                {/* Tooltip — anchored right so it doesn't overflow off screen */}
                                <div className="absolute top-full right-0 mt-2 w-72 z-50 invisible opacity-0 group-hover/warn:visible group-hover/warn:opacity-100 transition-all duration-150 pointer-events-none">
                                    <div className={`rounded-xl border text-xs leading-relaxed px-3 py-2.5 shadow-lg ${isBlocked ? 'bg-red-50 dark:bg-gray-900 border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-400' : 'bg-amber-50 dark:bg-gray-900 border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400'}`}>
                                        <div className="font-semibold mb-1.5">
                                            {isBlocked
                                                ? <>No data for selected range. Earliest from <span className="underline">{minDateStr}</span>.</>
                                                : <>Partial data from <span className="underline">{minDateStr}</span> onwards.</>
                                            }
                                        </div>
                                        <div className="space-y-0.5 opacity-80">
                                            {warnings.noData.map(a => (
                                                <div key={a.name}>• {a.name} — no data before {new Date(a.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</div>
                                            ))}
                                            {warnings.partialData.map(a => (
                                                <div key={a.name}>• {a.name} — data from {new Date(a.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} only</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                    <button
                        onClick={clearChat}
                        className="text-xs text-gray-800 hover:text-gray-900 dark:text-gray-100 transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        Clear
                    </button>
                    <button
                        onClick={exportChat}
                        disabled={messages.length === 0}
                        className="text-xs text-gray-800 hover:text-gray-900 dark:text-gray-100 transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={messages.some(m => m.type === 'agent' && m.data?.length > 0) ? 'Export last result as CSV' : 'Export conversation as text'}
                    >
                        Export
                    </button>
                </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full dark-scrollbar flex flex-col" style={{ scrollbarGutter: 'stable' }}>
                {!hasMessages && !isLoading ? (
                    /* Empty state — flex-1 fills available height, justify-center works correctly */
                    <div className="flex-1 flex flex-col w-full items-center justify-center px-6 py-6" style={{ minHeight: 'min-content' }}>
                        <div className="relative mb-6">
                            <Sparkles size={36} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-semibold font-heading mb-2">
                            What would you like to know?
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                            Ask anything about your Flipkart, Meesho or Amazon business.
                        </p>
                        {!canSend && (
                            <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium">
                                <Calendar size={14} className="shrink-0" />
                                Select a <strong>date range</strong> and <strong>marketplace account</strong> below before querying.
                            </div>
                        )}
                        <div className={`w-full max-w-xl flex flex-col items-center space-y-3 ${!canSend ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                            {SUGGESTED_QUESTIONS.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => canSend && onSend(q)}
                                    disabled={!canSend}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                                        border border-gray-200 dark:border-gray-800 hover:border-blue-500/50 hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900 dark:hover:border-blue-500/50
                                        transition-all duration-150 text-left group disabled:cursor-not-allowed"
                                >
                                    <ArrowRight size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100">{q}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">or type your own question below</p>
                    </div>
                ) : (
                    /* Messages */
                    <div className="max-w-3xl mx-auto w-full space-y-4 px-6 py-6">
                        {/* Active filter badge */}
                        {getCurrentFilter() && (
                            <div className="flex justify-center mb-2">
                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                                    <Store className="w-3 h-3" />
                                    <span>Filtering: {getCurrentFilter()}</span>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.type === 'user' ? (
                                    <div className="max-w-[80%] bg-blue-600 dark:bg-blue-600/30 dark:border dark:border-blue-500/30 text-white dark:text-blue-100 px-4 py-2.5 rounded-2xl rounded-br-none text-sm leading-relaxed">
                                        {msg.text}
                                    </div>
                                ) : (
                                    <div className="w-full max-w-full">
                                        {msg.text && (
                                            <div className="flex items-start gap-2 mb-2">
                                                <Sparkles size={14} className="text-blue-600 dark:text-blue-400 mt-1 shrink-0" />
                                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Speedy AI</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                        )}
                                        {msg.text && (
                                            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2 pl-5">
                                                <TypewriterText
                                                    text={msg.text}
                                                    speed={15}
                                                    className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                                                />
                                            </div>
                                        )}
                                        {msg.data?.length > 0 && (
                                            <div className="mt-3 pl-5 speedy-light-chart">
                                                <ResponseRenderer
                                                    data={msg.data}
                                                    format={msg.format}
                                                    chartType={msg.chartType}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading */}
                        {isLoading && <RobotLoader />}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input area */}
            <div className="shrink-0 px-6 pb-2 mt-auto">
                <div className="max-w-3xl mx-auto">
                    {/* Collapsible action bar */}
                    <div
                        className="overflow-hidden transition-all duration-300"
                        style={{ maxHeight: actionBarOpen ? '56px' : '0px', opacity: actionBarOpen ? 1 : 0, marginBottom: actionBarOpen ? '8px' : '0px' }}
                    >
                        <div className="flex items-center gap-2 px-1 py-1">
                            <button
                                onClick={() => setMpModalOpen(true)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 ${
                                    selectedAccounts.length > 0
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 animate-pulse'
                                }`}
                            >
                                <Store size={13} />
                                {selectedAccounts.length > 0 ? `${selectedAccounts.length} account${selectedAccounts.length !== 1 ? 's' : ''}` : 'Select accounts'}
                            </button>
                            <button
                                onClick={() => setDateModalOpen(true)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 ${
                                    chatStartDate && chatEndDate
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 animate-pulse'
                                }`}
                            >
                                <Calendar size={13} />
                                {chatStartDate && chatEndDate ? formatDateDisplay(chatStartDate, chatEndDate) : 'Select date range'}
                            </button>
                        </div>
                    </div>

                    {/* Interim speech preview — shown above pill when listening */}
                    {/* {isListening && (
                        <div className="mb-1.5 px-4 py-2 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 text-[13px] leading-snug">
                            {interimText ? (
                                <>
                                    {chatInput && <span className="text-gray-800 dark:text-gray-200">{chatInput} </span>}
                                    <span className="text-gray-400 dark:text-gray-500 italic">{interimText}</span>
                                </>
                            ) : (
                                <span className="text-gray-400 dark:text-gray-500 italic">Listening…</span>
                            )}
                        </div>
                    )} */}

                    {/* Input row — single unified pill */}
                    <div className={`flex items-end gap-2 bg-white dark:bg-[#1a1a2e] border rounded-[26px] px-3 py-2 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12)] dark:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.8)] transition-all duration-200
                        ${canSend ? 'border-gray-200 dark:border-gray-800/60 focus-within:border-blue-400 focus-within:shadow-[0_2px_16px_-3px_rgba(59,130,246,0.15)]' : 'border-gray-300 dark:border-gray-700 opacity-70'}`}>
                        {/* Toggle icon — left */}
                        <button
                            onClick={() => setActionBarOpen(p => !p)}
                            title={actionBarOpen ? 'Close filters' : 'Open filters'}
                            className={`relative flex items-center justify-center w-9 h-9 shrink-0 rounded-full transition-all duration-300 ${
                                actionBarOpen
                                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                    : canSend
                                        ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            }`}
                        >
                            {/* Heartbeat pulse wave when selection is missing and bar is closed */}
                            {!canSend && !actionBarOpen && (
                                <span className="absolute inset-0 rounded-full bg-amber-400/40 dark:bg-amber-400/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></span>
                            )}
                            <span
                                className="relative z-10 block transition-transform duration-300"
                                style={{ transform: actionBarOpen ? 'rotate(135deg)' : 'rotate(0deg)' }}
                            >
                                {canSend ? <SquarePenIcon size={19} /> : <Plus size={18} />}
                            </span>
                        </button>

                        {/* Textarea — no wrapper div; grow+min-w-0 directly on textarea */}
                        <textarea
                            ref={textareaRef}
                            value={chatInput}
                            onChange={(e) => { setChatInput(e.target.value); autoResizeTextarea(); }}
                            onKeyDown={handleKeyDown}
                            disabled={!canSend}
                            placeholder={
                                isListening
                                    ? 'Listening'
                                    : !chatStartDate || !chatEndDate
                                        ? 'Select a date range first...'
                                        : selectedAccounts.length === 0
                                            ? 'Select a marketplace account first...'
                                            : getCurrentFilter()
                                                ? `Ask about ${getCurrentFilter()}...`
                                                : 'Ask Speedy AI anything...'
                            }
                            className="grow min-w-0 overflow-y-hidden bg-transparent text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none outline-none border-transparent focus:border-transparent border-0 focus:ring-0 shadow-none leading-relaxed min-h-[36px] max-h-[200px] py-[6px] px-2 custom-scrollbar disabled:cursor-not-allowed m-0"
                            rows={1}
                        />

                        {/* Mic + lang picker — only if browser supports Speech Recognition */}
                        {hasSpeech && (
                            <div ref={langPickerRef} className="relative shrink-0 flex items-center gap-0.5">

                                {/* ── Language slide panel — animates over textarea from the right ── */}
                                <div className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/80 rounded-2xl px-2 py-1.5 shadow-md transition-all duration-300 origin-right ${
                                    showLangPicker && !isListening
                                        ? 'opacity-100 scale-x-100 pointer-events-auto'
                                        : 'opacity-0 scale-x-0 pointer-events-none'
                                }`}>
                                    {SPEECH_LANGS.map(l => (
                                        <button
                                            key={l.code}
                                            onClick={() => { setSpeechLang(l.code); setShowLangPicker(false); }}
                                            className={`flex flex-col items-center px-3 py-1 rounded-xl transition-all duration-200 ${
                                                speechLang === l.code
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <span className="text-[13px] font-bold leading-tight">{l.label}</span>
                                            <span className="text-[9px] leading-tight opacity-80">{l.name}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* ── Left arrow — triggers lang panel, animates direction ── */}
                                {!isListening && (
                                    <button
                                        onClick={() => setShowLangPicker(p => !p)}
                                        title="Select language"
                                        className="text-gray-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-500 transition-all duration-200 flex items-center"
                                    >
                                        <ChevronLeft
                                            size={14}
                                            className={`transition-transform duration-300 ${showLangPicker ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                )}

                                {/* ── Mic button — lang badge sits at bottom-right corner of the button ── */}
                                <div className="relative">
                                    {/* Error tooltip — appears above mic when speech fails */}
                                    {speechError && (
                                        <div className="absolute bottom-full right-0 mb-2 w-52 bg-gray-900 dark:bg-gray-800 text-white text-[11px] leading-snug px-3 py-2 rounded-xl shadow-lg z-50 pointer-events-none">
                                            {speechError}
                                            {/* Arrow */}
                                            <span className="absolute top-full right-3 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
                                        </div>
                                    )}
                                    <button
                                        onClick={toggleListening}
                                        disabled={isLoading || !canSend}
                                        title={isListening ? 'Stop listening' : `Speak in ${SPEECH_LANGS.find(l => l.code === speechLang)?.name}`}
                                        className={`flex items-center justify-center w-9 h-9 transition-all duration-300 rounded-full disabled:cursor-not-allowed ${
                                            isListening
                                                ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_12px_-2px_rgba(239,68,68,0.5)] animate-pulse'
                                                : speechError
                                                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40'
                                        }`}
                                    >
                                        {isListening
                                            ? <MicOff size={16} className="text-white" />
                                            : <Mic size={16} />
                                        }
                                    </button>
                                    {/* Lang badge — bottom-right corner of mic, stays inside the pill */}
                                    {!isListening && (
                                        <span className="absolute -bottom-0.5 -right-0.5 text-[7px] font-bold leading-none px-1 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-900 pointer-events-none select-none">
                                            {SPEECH_LANGS.find(l => l.code === speechLang)?.label}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Send button — right */}
                        <button
                            onClick={() => onSend()}
                            disabled={!chatInput.trim() || isLoading || !canSend}
                            className="flex items-center justify-center w-9 h-9 shrink-0 transition-all duration-300 rounded-full bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)] disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:shadow-none disabled:cursor-not-allowed group"
                        >
                            <Send size={16} className="text-white group-disabled:text-gray-400 dark:group-disabled:text-gray-600 transition-colors" />
                        </button>
                    </div>

                    {/* Analysis start date warning banner — only before first message, dismissible */}
                    {!hasMessages && !warningDismissed && (warnings.noData.length > 0 || warnings.partialData.length > 0) && (() => {
                        const allAffected = [...warnings.noData, ...warnings.partialData];
                        const minDate = new Date(Math.min(...allAffected.map(a => new Date(a.date).getTime())));
                        const minDateStr = minDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                        // Red only when ALL selected accounts are out of range (input blocked)
                        const isBlocked = warnings.allInvalid;
                        return (
                            <div className={`mt-2 px-3 py-2.5 rounded-xl border text-xs leading-relaxed ${isBlocked ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'}`}>
                                <div className="flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">⚠️</span>
                                    <div className="flex-1">
                                        <div className="mb-1">
                                            {isBlocked
                                                ? <><span className="font-semibold">No data for selected range. </span>Earliest available from <span className="font-semibold">{minDateStr}</span>.</>
                                                : <><span className="font-semibold">Partial data. </span>Some accounts have data only from <span className="font-semibold">{minDateStr}</span> onwards.</>
                                            }
                                        </div>
                                        <div className="space-y-0.5 opacity-80">
                                            {warnings.noData.map(a => (
                                                <div key={a.name}>• {a.name} — no data before {new Date(a.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</div>
                                            ))}
                                            {warnings.partialData.map(a => (
                                                <div key={a.name}>• {a.name} — data from {new Date(a.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} only</div>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setWarningDismissed(true)}
                                        className="shrink-0 mt-0.5 p-0.5 rounded hover:opacity-60 transition-opacity"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    <div className="flex justify-center mt-2 gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {canSend
                            ? <><span className="text-gray-500 dark:text-gray-400">Speedy is AI and can make mistakes.</span></>
                            : warnings.allInvalid
                                ? <span className="text-red-500 dark:text-red-400">No data available for the selected accounts &amp; date range</span>
                                : <span className="text-amber-500 dark:text-amber-400">Select marketplace account and date to start chat.</span>
                        }
                    </div>
                </div>
            </div>

            {/* Modals */}
            <DatePickerModal
                isOpen={dateModalOpen}
                onClose={() => setDateModalOpen(false)}
                startDate={chatStartDate}
                endDate={chatEndDate}
                onChange={onDateChange}
            />
            <MarketplaceModal
                isOpen={mpModalOpen}
                onClose={() => setMpModalOpen(false)}
                marketplaces={marketplaces}
                selectedAccounts={selectedAccounts}
                setSelectedAccounts={setSelectedAccounts}
                toggleAccount={toggleAccount}
                toggleMarketplaceSelection={toggleMarketplaceSelection}
                isMarketplaceFullySelected={isMarketplaceFullySelected}
                isMarketplacePartiallySelected={isMarketplacePartiallySelected}
                selectedMarketplaceKey={selectedMarketplaceKey}
                setSelectedMarketplaceKey={setSelectedMarketplaceKey}
            />
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
//  FAQ CONTENT (Browse Categories)
// ═══════════════════════════════════════════════════════════
const FAQ_GRID_ICONS = {
    sku_analysis: { icon: Package,      desc: 'Profit, loss, SKU keyword search, comparisons' },
    warehouse:    { icon: Store,        desc: 'Warehouse-wise sales, returns, and profit/loss' },
    ads:          { icon: BarChart3,    desc: 'Ad spend, ROAS, campaign-level breakdown' },
    returns:      { icon: RotateCcw,    desc: 'Return %, RTO loss, overcharges' },
    order_lookup: { icon: PackageSearch, desc: 'Order-ID lookups — pending payments' },
    payments:     { icon: CreditCard,   desc: 'Pending settlements, TCS/TDS, GST' },
    claims:       { icon: FileText,     desc: 'Claim recovery status' },
    business:     { icon: TrendingUp,   desc: 'Overall P&L, monthly trends' },
};

// ─── Brand palette ──────────────────────────────────────────────────────────
// Every category renders in brand blue — decided by the product owners: blue is
// the product's theme colour and the FAQ should not look like a rainbow. So
// categories are NOT colour-coded any more; questions are told apart by their
// per-question icon (QUESTION_ICONS) instead.
//
// `cardGradient` + `watermark` drive the question cards.
// These MUST stay literal strings — Tailwind scans this file for class names,
// so anything built by string concatenation (`from-${hue}-50`) is never emitted.
//
// To give one category its own colour again, point its key below at a different
// token object — nothing else needs touching. But see btnGradient in
// FAQWorkspace: it matches on `stripe`, so any new palette needs a branch there.
const BRAND = {
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    light: 'bg-blue-50 dark:bg-blue-900/20',
    activeBorder: 'border-r-2 border-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    stripe: 'bg-blue-500',
    cardGradient: 'from-blue-50 to-blue-100/70 dark:from-blue-900/25 dark:to-blue-800/10',
    watermark: 'text-blue-500/10 dark:text-blue-400/10',
};

// Deeper shade of the same blue — used by every SECOND card (see CAT_ALT_COLORS).
const BRAND_DEEP = {
    dot: 'bg-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
    light: 'bg-blue-100 dark:bg-blue-800/30',
    activeBorder: 'border-r-2 border-blue-700',
    badge: 'bg-blue-200 dark:bg-blue-700/50 text-blue-800 dark:text-blue-100',
    stripe: 'bg-blue-700',
    cardGradient: 'from-blue-100 to-blue-200/80 dark:from-blue-700/45 dark:to-blue-800/25',
    watermark: 'text-blue-600/[0.12] dark:text-blue-300/[0.12]',
};

// Color tokens per category — used in split panel, question list, breadcrumb
const CAT_COLORS = {
    sku_analysis: BRAND,
    warehouse:    BRAND,
    ads:          BRAND,
    returns:      BRAND,
    order_lookup: BRAND,
    payments:     BRAND,
    claims:       BRAND,
    business:     BRAND,
};

// Every SECOND card in a list uses these instead of the base tokens above, so a
// list alternates light / deep / light / deep and gets some rhythm rather than
// reading as one flat block of colour.
//
// Deliberately the SAME hue at a deeper shade, NOT a neighbouring hue. Adjacent
// hues were tried first (orange→amber, red→rose) and rejected: measured against
// the actually-rendered tint they came out at only ΔE 2.4 and 6.1 — i.e. the two
// cards looked identical. Hues collapse towards each other at the -900 shade the
// dark tint uses, so no hue jump survives there. Same hue at two shades measures
// ΔE ~28 in dark and ~16 in light, which reads clearly and stays on-brand.
const CAT_ALT_COLORS = {
    sku_analysis: BRAND_DEEP,
    warehouse:    BRAND_DEEP,
    ads:          BRAND_DEEP,
    returns:      BRAND_DEEP,
    order_lookup: BRAND_DEEP,
    payments:     BRAND_DEEP,
    claims:       BRAND_DEEP,
    business:     BRAND_DEEP,
};

// ─── Per-question icon ──────────────────────────────────────────────────────
// The whole point: a user should recognise a question by its card, without
// reading it. Each icon reflects what the question DOES (its subject + output),
// not just its category. Keyed by question id — add an entry when adding a
// question; unknown ids fall back to the generic Package icon.
const QUESTION_ICONS = {
    // ── SKU Analysis ──
    1:  Coins,          // total profit / loss for a master SKU
    2:  LineChart,      // 2–3 month performance trend
    4:  Rocket,         // winners — promote these
    6:  Ban,            // losers — discontinue these
    11: TrendingDown,   // losing money even after delivery
    14: Percent,        // margin above X%
    15: ListFilter,     // order IDs filtered by a settlement threshold
    20: Layers,         // pack-size / quantity comparison
    32: Trophy,         // top N profitable
    33: PackageX,       // profitable but heavily returned
    34: AlertTriangle,  // rising return / RTO trend — a warning
    82: HandCoins,      // every loss-making SKU — money going out
    84: BarChart3,      // month-wise P/L fluctuation, as bars
    // ── OrderId Wise ──
    83: Hourglass,      // orders whose payment is still pending
    86: Undo2,          // RTO orders with a negative settlement
    87: Boxes,          // multi-quantity orders (2, 4, 6 … units per order)
    // ── Warehouse ──
    16: PieChart,       // % split of sales per warehouse
    17: ArrowLeftRight, // orders vs returns, side by side
    18: Warehouse,      // full warehouse-wise breakdown
    19: MapPin,         // one SKU, per warehouse
    // ── Ads ──
    3:  Megaphone,      // ad spend / orders / return ratio
    7:  MegaphoneOff,   // spending on ads, zero orders
    9:  TrendingDown,   // ads dragging the SKU into loss
    24: Percent,        // % of sales eaten by ads
    // ── Returns & RTO ──
    10: RotateCcw,      // more returns than delivered
    12: ReceiptText,    // overcharged returned orders
    81: Clock,          // reimbursement still pending
    85: AlarmClock,     // overdue return orders (Meesho)
};

// ─── IMP flag ───────────────────────────────────────────────────────────────
// Opt in per question in faqQuestions.js:
//     { id: 1, important: true, ... }   -> corner ribbon + travelling rim
//
// Amber is the ONLY non-blue accent left in the FAQ UI, and that is the whole
// point — everything else is brand blue, so the flag reads instantly. Don't
// "harmonise" it to blue or it stops working.
//
// The ribbon, the pill and the travelling rim all sit on amber-500 (#f59e0b) so
// they read as one flag rather than three unrelated marks.
// Text is amber-950, NOT white: white on amber-500 measures 2.15:1, which is
// unreadable at this size. amber-950 gets it to 6.97:1.

// IMP — an amber ribbon cutting across the card's top-left corner.
//
// The band is a plain rectangle rotated -45deg and hung off the left edge; the
// card's `overflow-hidden` is what crops it into a corner ribbon. That means it
// ONLY works inside a positioned, clipped parent — drop it anywhere else and you
// get a stray diagonal bar across the layout. Geometry: rotating about the
// band's own centre (~21,21) puts its axis on the diagonal running from the left
// edge to the top edge, so it cuts the corner evenly.
const ImpRibbon = () => (
    <span
        aria-label="Important"
        className="absolute z-20 pointer-events-none select-none
            top-[13px] -left-[34px] w-[110px] py-[3px] -rotate-45
            text-center bg-amber-500 text-slate-950
            text-[9px] font-extrabold uppercase tracking-[0.18em]
            shadow-[0_1px_5px_rgba(0,0,0,0.4)]"
    >
        Imp
    </span>
);

// IMP, header variant — the ribbon needs a free clipped corner to work against,
// and the question header's corner belongs to the breadcrumb, so flag it with a
// pill in the same amber instead.
const ImpBadge = ({ className = '' }) => (
    <span
        className={`inline-flex items-center gap-1 pl-1.5 pr-2 py-[3px] rounded-full
            bg-amber-500 border border-amber-300/60
            text-amber-950 text-[9px] font-extrabold uppercase tracking-wider leading-none
            shadow-sm shadow-amber-500/40 select-none ${className}`}
    >
        <AlertTriangle size={9} strokeWidth={3} className="shrink-0" />
        Imp
    </span>
);

// ═══════════════════════════════════════════════════════════
//  PERSISTENT FAQ CATEGORY PANEL  (always visible in FAQ views)
// ═══════════════════════════════════════════════════════════
const FAQCategoryPanel = ({ selectedCategory, onSelectCategory, onBack }) => {
    // Determine which category to highlight:
    // In 'faq' view → the one being browsed
    // In 'params'/'response' → the one of the selected question
    const activeCatId = selectedCategory?.id || VISIBLE_CATEGORIES[0].id;

    return (
        <div className="w-52 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-[#0d0d1a]">
            {/* Header */}
            <div className="px-4 pt-5 pb-3 shrink-0">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-300 mb-4 transition-colors"
                >
                    <ArrowLeft size={12} /> Home
                </button>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-800 uppercase tracking-widest">Categories</p>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto pb-4">
                {VISIBLE_CATEGORIES.map(cat => {
                    const colors = CAT_COLORS[cat.id];
                    const Icon = FAQ_GRID_ICONS[cat.id]?.icon || Package;
                    const isActive = activeCatId === cat.id;
                    const count = getQuestionsByCategory(cat.id).length;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => onSelectCategory(cat)}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all duration-150
                                ${isActive
                                    ? `${colors.light} ${colors.activeBorder}`
                                    : 'hover:bg-white dark:hover:bg-gray-900/60'}`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot} ${isActive ? 'opacity-100' : 'opacity-25'} transition-opacity`} />
                            <Icon size={13} className={isActive ? colors.text : 'text-gray-400 dark:text-gray-800'} />
                            <span className={`text-[12px] font-medium flex-1 dark:text-gray-400 leading-tight ${isActive ? colors.text : 'text-gray-700'}`}>
                                {cat.label}
                            </span>
                            <span className={`text-[10px] font-semibold h-5 w-5 rounded-full flex justify-center items-center shrink-0 ${isActive ? colors.badge : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-400'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
//  FAQ CONTENT  (question list + search — no category panel)
// ═══════════════════════════════════════════════════════════
const FAQContent = ({ onSelectQuestion, initialCategory }) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState(initialCategory || VISIBLE_CATEGORIES[0]);

    const isSearching = searchQuery.trim().length > 0;

    // Flat list of all questions with their parent category — for search
    const allQuestions = React.useMemo(() =>
        VISIBLE_CATEGORIES.flatMap(cat =>
            getQuestionsByCategory(cat.id).map(q => ({ ...q, _cat: cat }))
        ), []);

    // 1-based position of each question within its own category — stable
    // identifier for support / verbal communication ("Q3 of SKU Analysis").
    const questionPosByCategory = React.useMemo(() => {
        const map = new Map();
        VISIBLE_CATEGORIES.forEach(cat => {
            getQuestionsByCategory(cat.id).forEach((q, i) => map.set(q.id, i + 1));
        });
        return map;
    }, []);

    // Search matches the user-visible string in whichever language is active.
    const displayQuestions = isSearching
        ? allQuestions.filter(q =>
            t(q.question).toLowerCase().includes(searchQuery.toLowerCase().trim()))
        : getQuestionsByCategory(activeCategory?.id || VISIBLE_CATEGORIES[0].id);

    const activeCat = activeCategory || VISIBLE_CATEGORIES[0];
    const activeColors = CAT_COLORS[activeCat.id] || CAT_COLORS.sku_analysis;
    const ActiveIcon = FAQ_GRID_ICONS[activeCat.id]?.icon || Package;

    // Canvas is deliberately tinted (slate-50 / gray-950) — the question cards are
    // white / gray-900, so the canvas must sit a shade behind them. Match the two
    // and the cards flatten back into plain text.
    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">

                {/* Right header — search + category badge */}
                <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0">
                    {/* Live search bar */}
                    <div className="flex-1 relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={isSearching ? 'Searching all 80 questions…' : `Search in ${activeCat.label}…`}
                            className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500/40 focus:bg-white dark:focus:bg-black/20 transition-all placeholder:text-gray-700 dark:placeholder:text-gray-700 text-gray-800 dark:text-gray-200"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Active category badge (hidden while searching) */}
                    {!isSearching ? (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 ${activeColors.badge}`}>
                            <ActiveIcon size={11} />
                            <span className="text-[11px] font-semibold">{activeCat.label}</span>
                            <span className="text-[10px] opacity-70">· {displayQuestions.length}</span>
                        </div>
                    ) : (
                        <span className="text-[11px] text-gray-400 dark:text-gray-800 shrink-0 whitespace-nowrap">
                            {displayQuestions.length} result{displayQuestions.length !== 1 ? 's' : ''}
                        </span>
                    )}

                    {/* Language — far right, after the category badge */}
                    <LanguageSwitch />
                </div>

                {/* Question list */}
                <div className="flex-1 overflow-y-auto dark-scrollbar px-4 py-4">
                    {displayQuestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-16">
                            <Search size={30} className="text-gray-200 dark:text-gray-800 mb-3" />
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No questions found</p>
                            <p className="text-xs text-gray-300 dark:text-gray-700 mt-1">Try different keywords</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {displayQuestions.map((q, i) => {
                                const cat = isSearching ? q._cat : activeCat;
                                // Alternate A/B down the list: even cards take the category hue,
                                // odd cards its companion hue. Index-based, so it re-flows
                                // correctly when the list is filtered by search.
                                const base = CAT_COLORS[cat.id] || CAT_COLORS.sku_analysis;
                                const alt = CAT_ALT_COLORS[cat.id] || CAT_ALT_COLORS.sku_analysis;
                                const colors = i % 2 === 1 ? alt : base;
                                const paramCount = q.params?.length || 0;
                                const isSoon = !!q.comingSoon;
                                const QIcon = QUESTION_ICONS[q.id] || Package;
                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => !isSoon && onSelectQuestion(q, isSearching ? q._cat : activeCat)}
                                        disabled={isSoon}
                                        className={`relative w-full flex items-stretch rounded-xl text-left border overflow-hidden
                                            bg-gradient-to-br ${colors.cardGradient} shadow-sm
                                            transition-all duration-200 ease-out group
                                            ${/* amber static rim so the travelling light has a track to run on,
                                                  instead of doubling up against the default grey border */''}
                                            ${q.important ? '!border-amber-500/30 dark:!border-amber-500/25' : ''}
                                            ${isSoon
                                                ? 'border-gray-200 dark:border-gray-800 opacity-60 cursor-not-allowed'
                                                : `border-gray-200/80 dark:border-gray-800 cursor-pointer
                                                   hover:border-gray-300 dark:hover:border-gray-700
                                                   hover:shadow-md hover:-translate-y-0.5
                                                   active:translate-y-0 active:shadow-sm`
                                            }`}
                                    >
                                        {/* Watermark — same icon, oversized and faint. Sized to sit fully
                                            inside the card (h-20 vs the card's ~84px) and tilted left, so the
                                            whole glyph reads instead of being clipped by the edge.
                                            Decorative only: aria-hidden + pointer-events-none. */}
                                        <QIcon
                                            aria-hidden="true"
                                            strokeWidth={1.5}
                                            className={`absolute right-5 top-1/2 -translate-y-1/2 w-20 h-20
                                                -rotate-12 pointer-events-none ${colors.watermark}
                                                transition-transform duration-300 ease-out
                                                group-hover:scale-110 group-hover:-rotate-[18deg]`}
                                        />

                                        {/* IMP — light running around the perimeter. The rect is drawn at the
                                            full box with a 3px stroke; the card's overflow-hidden clips the
                                            outer half, leaving a ~1.5px rim exactly on the border. */}
                                        {q.important && (
                                            <svg
                                                aria-hidden="true"
                                                className="absolute inset-0 w-full h-full pointer-events-none z-[1] overflow-visible"
                                            >
                                                <rect
                                                    x="0" y="0" width="100%" height="100%" rx="12"
                                                    fill="none"
                                                    stroke="#f59e0b"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    pathLength="100"
                                                    className="imp-dash"
                                                />
                                            </svg>
                                        )}

                                        {/* IMP — ribbon across the top-left corner */}
                                        {q.important && <ImpRibbon />}

                                        {/* Category accent bar — flush to the card edge, full height */}
                                        <div className={`relative w-1 shrink-0 ${colors.stripe} ${isSoon ? 'opacity-30' : ''}`} />

                                        <div className="relative flex-1 flex items-center gap-3 px-4 py-5 min-w-0">
                                            {/* Semantic icon — the primary way to recognise this question */}
                                            <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                                                ${colors.badge} ${isSoon ? 'opacity-50' : ''}
                                                transition-transform duration-200 ease-out group-hover:scale-105`}>
                                                <QIcon size={17} strokeWidth={2} />
                                            </span>

                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[14px] font-medium leading-snug ${isSoon ? 'text-gray-500 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'} transition-colors duration-200`}>
                                                    {t(q.question)}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {/* Per-category index — stable reference for support / verbal comms */}
                                                    <span className={`font-mono text-[10px] font-bold tabular-nums ${colors.text} ${isSoon ? 'opacity-50' : 'opacity-70'}`}>
                                                        {String(questionPosByCategory.get(q.id) || '').padStart(2, '0')}
                                                    </span>
                                                    {isSearching && (
                                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                                                            {cat.label}
                                                        </span>
                                                    )}
                                                    {isSoon ? (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                            Coming Soon
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {paramCount > 0 && (
                                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                    · {paramCount} param{paramCount !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {!isSoon && (
                                                <ChevronRight
                                                    size={15}
                                                    className={`${colors.text} opacity-40 group-hover:opacity-100
                                                        shrink-0 transition-all duration-200 ease-out group-hover:translate-x-0.5`}
                                                />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
        </div>
    );
};

// QuestionListContent removed — merged into FAQContent split panel


// ─── Toggle / text / number input for a single param ───────
// Map known toggle tokens to friendlier display labels. Anything not in the
// map renders the raw option string — so new toggles don't need code changes.
// Multi-select params hold an ARRAY. Normalise whatever is in state (array,
// comma string from a restored/serialised value, or undefined) to an array.
const toArrayValue = (v) =>
    Array.isArray(v) ? v : (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : []);

// Render a param value as text. Arrays MUST be joined explicitly — React
// concatenates array children with no separator, so ['Return','RTO'] would
// otherwise print as "ReturnRTO".
const displayParamValue = (v) =>
    Array.isArray(v) ? v.join(', ') : v;

// Some options only exist on certain marketplaces — e.g. "Refund Loss" is
// Amazon-only data, so offering it under Flipkart/Meesho would just be a filter
// that always matches nothing. A param declares this via
//   optionPlatforms: { 'Refund Loss': ['amazon'] }
// Options with no entry are available everywhere.
const isOptionAvailable = (p, opt, mpKey) => {
    const allowed = p.optionPlatforms?.[opt];
    if (!allowed) return true;
    const mp = String(mpKey || '').toLowerCase();
    return allowed.some(a => mp.includes(String(a).toLowerCase()));
};

const TOGGLE_LABELS = {
    'desc':         '↓ High → Low',
    'asc':          '↑ Low → High',
    'Less than':    '<  Less than',
    'Greater than': '>  Greater than',
    // Spelled out because "with / without ads" is easy to read backwards —
    // With Ads = ad spend already deducted from the profit figure.
    'With Ads':     'With Ads',
    'Without Ads':  'Without Ads',
};
const ParamInput = ({ p, value, onChange, error, autoFocus = false, accentColor = 'blue', marketplace = '' }) => {
    // Multi-select chips — pick any number of options (e.g. Return + RTO).
    // Value is an ARRAY. Nothing selected == no filter ("All"), matching this
    // file's convention that an empty optional param skips its filter.
    if (p.type === 'multiselect') {
        // Marketplace-specific options are hidden, not just disabled — an option
        // that can never match is noise (see isOptionAvailable).
        const options  = (p.options || []).filter(o => isOptionAvailable(p, o, marketplace));
        const selected = toArrayValue(value);
        const toggleOpt = (opt) => {
            onChange(selected.includes(opt)
                ? selected.filter(o => o !== opt)
                : [...selected, opt]);
        };
        return (
            <>
                <div className="flex flex-wrap gap-1.5">
                    {options.map(opt => {
                        const isActive = selected.includes(opt);
                        return (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => toggleOpt(opt)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                                    isActive
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-700 dark:hover:border-blue-600'
                                }`}
                            >
                                {isActive && <Check size={11} strokeWidth={3} />}
                                {opt}
                            </button>
                        );
                    })}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    {selected.length === 0
                        ? 'None selected — showing all statuses'
                        : `${selected.length} selected`}
                </p>
                {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
            </>
        );
    }

    if (p.type === 'toggle') {
        const options = p.options || [];
        const current = value || p.defaultValue || options[0];
        return (
            <>
                <div className={`flex rounded-lg overflow-hidden border bg-gray-100 dark:bg-gray-800/60 p-0.5 gap-0.5
                    ${error ? 'border-red-400/60' : 'border-gray-200 dark:border-gray-700'}`}>
                    {options.map(opt => {
                        const isActive = current === opt;
                        return (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => onChange(opt)}
                                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                                    isActive
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
                                }`}
                            >
                                {TOGGLE_LABELS[opt] || opt}
                            </button>
                        );
                    })}
                </div>
                {/* A toggle always shows a selection, so this should never fire —
                    but if a required toggle ever slips through unset, the error is
                    now visible instead of the button silently doing nothing. */}
                {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
            </>
        );
    }

    return (
        <>
            <input
                autoFocus={autoFocus}
                type={p.type === 'date' ? 'text' : p.type}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={p.placeholder}
                className={`w-full bg-gray-50 dark:bg-gray-900 border rounded-lg px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100
                    placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-${accentColor}-500/20 focus:border-${accentColor}-500/40
                    ${error ? 'border-red-400/60' : `border-gray-200 dark:border-gray-800`}`}
            />
            {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
        </>
    );
};

// ─── Shared micro-components for ParamContent ──────────────
const FormSectionLabel = ({ children, required }) => (
    <div className="flex items-center gap-3 mb-3">
        {/* The dark-mode colour used to be gray-800 — near-black on the dark
            canvas, barely legible. gray-500/400 stays subtle but readable. */}
        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">
            {children}
            {required && <span className="text-red-400 ml-1">*</span>}
        </p>
        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
    </div>
);

const PillBtn = ({ active, onClick, children, capitalize }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            active
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
        } ${capitalize ? 'capitalize' : ''}`}
    >
        {children}
    </button>
);

// ═══════════════════════════════════════════════════════════
//  PARAM COLLECTION CONTENT
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  ACCOUNT MULTI-SELECT DROPDOWN
// ═══════════════════════════════════════════════════════════
const AccountMultiSelect = ({ accounts, selected, onChange, required = false, error = '' }) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const ref = React.useRef(null);
    const inputRef = React.useRef(null);

    // Close on outside click
    React.useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Auto-focus search input when trigger morphs open
    React.useEffect(() => {
        if (open) {
            // Wait for morph animation to settle before focus (~180ms)
            const t = setTimeout(() => inputRef.current?.focus(), 180);
            return () => clearTimeout(t);
        }
    }, [open]);

    const filtered = accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    const noneSelected = selected.length === 0;

    const toggle = (id) => {
        if (selected.includes(id)) {
            onChange(selected.filter(x => x !== id));
        } else {
            onChange([...selected, id]);
        }
    };

    const clearAll  = () => onChange([]);

    // Label for trigger button
    const triggerLabel = () => {
        if (noneSelected) return 'Select accounts';
        if (selected.length === accounts.length) return `All accounts (${accounts.length})`;
        if (selected.length === 1) {
            const acc = accounts.find(a => a._id === selected[0]);
            return acc?.name || '1 account';
        }
        return `${selected.length} of ${accounts.length} accounts`;
    };

    return (
        <div ref={ref} className="relative">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                Account {required && <span className="text-red-500">*</span>}
            </p>

            {/* ── MORPHING TRIGGER: button ⇄ search input ── */}
            <div
                className={`relative w-full rounded-2xl border transition-all duration-300 ease-out overflow-hidden
                    ${error
                        ? 'border-red-400 dark:border-red-500 bg-red-50/30 dark:bg-red-900/10'
                        : open
                            ? 'border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-900 ring-2 ring-blue-100 dark:ring-blue-900/40 shadow-md shadow-blue-100/50 dark:shadow-blue-900/30'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
            >
                {/* Layered children share the same cell so the swap morphs in place */}
                <div className="grid grid-cols-1 grid-rows-1 h-[3rem]">

                    {/* Closed state: label button */}
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-expanded={open}
                        className={`col-start-1 row-start-1 w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-left
                            transition-all duration-300 ease-out
                            ${open ? 'opacity-0 -translate-y-1 pointer-events-none' : 'opacity-100 translate-y-0'}
                            ${error ? 'text-gray-700 dark:text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                        <span className="flex items-center gap-2 min-w-0">
                            <span className={`shrink-0 w-2 h-2 rounded-full transition-colors duration-200 ${noneSelected ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500'}`} />
                            <span className="truncate text-[13px]">{triggerLabel()}</span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                            {!noneSelected && selected.length < accounts.length && (
                                <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                                    {selected.length}
                                </span>
                            )}
                            <ChevronDown size={13} className="transition-transform duration-300" />
                        </span>
                    </button>

                    {/* Open state: search input morphed in same space */}
                    <div
                        className={`col-start-1 row-start-1 w-full flex items-center gap-2 px-3 py-2
                            transition-all duration-300 ease-out
                            ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}
                    >
                        <Search size={14} className="text-blue-500 shrink-0 transition-transform duration-300" style={{ transform: open ? 'scale(1)' : 'scale(0.7)' }} />
                        <input
                            ref={inputRef}
                            type="text"
                            tabIndex={open ? 0 : -1}
                            placeholder={`Search ${accounts.length} account${accounts.length !== 1 ? 's' : ''}…`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } }}
                            className="flex-1 bg-transparent text-[13px] text-gray-700 dark:text-gray-200 placeholder-gray-400 border-0 border-gray-300 dark:border-gray-600 focus:ring-0 transition-colors"
                        />
                        {search ? (
                            <button
                                type="button"
                                onClick={() => { setSearch(''); inputRef.current?.focus(); }}
                                className="shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                aria-label="Clear search"
                            >
                                <X size={12} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => { setOpen(false); setSearch(''); }}
                                className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                aria-label="Close"
                            >
                                <ChevronDown size={13} className="rotate-180 transition-transform duration-300" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── DROPDOWN PANEL — animated slide-down ── */}
            <div
                className={`absolute z-50 w-full transition-all ease-out
                    ${open
                        ? 'opacity-100 translate-y-0 duration-300 mt-1.5 max-h-[420px]'
                        : 'opacity-0 -translate-y-1 duration-200 mt-0 max-h-0 pointer-events-none'
                    }`}
                style={{ transformOrigin: 'top' }}
            >
                <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden">

                    {/* Select all row — checkbox-styled, looks like an account row */}
                    {filtered.length > 0 && (() => {
                        const visibleIds = filtered.map(a => a._id);
                        const allChecked = visibleIds.every(id => selected.includes(id));
                        const someChecked = !allChecked && visibleIds.some(id => selected.includes(id));
                        const handleToggleAll = () => {
                            if (allChecked) {
                                onChange(selected.filter(id => !visibleIds.includes(id)));
                            } else {
                                onChange(Array.from(new Set([...selected, ...visibleIds])));
                            }
                        };
                        return (
                            <button
                                type="button"
                                onClick={handleToggleAll}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-gray-200 dark:border-gray-700 transition-colors
                                    ${allChecked
                                        ? 'bg-blue-50 dark:bg-blue-900/20'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                                    }`}
                            >
                                <span className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                                    ${allChecked
                                        ? 'bg-blue-600 border-blue-600'
                                        : someChecked
                                            ? 'bg-blue-200 border-blue-400 dark:bg-blue-700 dark:border-blue-500'
                                            : 'border-gray-300 dark:border-gray-600'
                                    }`}>
                                    {allChecked && <span className="text-white text-[9px] font-semibold leading-none">✓</span>}
                                    {someChecked && <span className="text-white text-[9px] font-semibold leading-none">–</span>}
                                </span>
                                <span className={`flex-1 text-[12px] font-semibold ${allChecked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                    Select all {search ? `(${filtered.length} matching)` : `(${accounts.length})`}
                                </span>
                                {!noneSelected && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); clearAll(); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); clearAll(); } }}
                                        className="text-[10px] text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:underline"
                                    >
                                        Clear
                                    </span>
                                )}
                            </button>
                        );
                    })()}

                    {/* Account list — staggered fade-in */}
                    <div className="max-h-52 overflow-y-auto dark-scrollbar py-1">
                        {filtered.length === 0 ? (
                            <p className="text-center text-xs text-gray-400 py-4 animate-fadeIn">
                                No accounts match "<span className="font-semibold text-gray-500">{search}</span>"
                            </p>
                        ) : filtered.map((a, i) => {
                            const isChecked = selected.includes(a._id);
                            return (
                                <button
                                    key={a._id}
                                    type="button"
                                    onClick={() => toggle(a._id)}
                                    style={open ? { animationDelay: `${Math.min(i, 10) * 25}ms`, animationFillMode: 'both' } : undefined}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${open ? 'animate-fadeIn' : ''}
                                        ${isChecked
                                            ? 'bg-blue-50 dark:bg-blue-900/20'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                                        }`}
                                >
                                    {/* Checkbox */}
                                    <span className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                                        ${isChecked
                                            ? 'bg-blue-600 border-blue-600 scale-110'
                                            : 'border-gray-200 dark:border-gray-700 scale-100'
                                        }`}>
                                        {isChecked && <span className="text-white text-[9px] font-semibold leading-none">✓</span>}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className={`block text-[12px] font-semibold truncate ${isChecked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {a.name}
                                        </span>
                                        {a.analysisStartDate && (
                                            <span className="block text-[10px] text-gray-500 dark:text-gray-400">
                                                Data from {new Date(a.analysisStartDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer with Done button */}
                    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                        <span className="text-[11px] text-gray-400">
                            {noneSelected ? 'None selected' : `${selected.length} selected`}
                        </span>
                        <button type="button" onClick={() => { setOpen(false); setSearch(''); }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-lg transition-all hover:shadow-md active:scale-95">
                            Done
                        </button>
                    </div>
                </div>
            </div>
            {error && <p className="text-xs text-red-400 mt-2 animate-fadeIn">{error}</p>}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
//  FAQ WORKSPACE  (question header + animated param↔result)
// ═══════════════════════════════════════════════════════════
const FAQWorkspace = ({
    question, selectedCategory, marketplaces,
    params, setParams, paramErrors, setParamErrors,
    selectedMarketplace, setSelectedMarketplace,
    selectedAccount, setSelectedAccount,
    isLoading, onRun, onBack, onAskAnother, onModifyParams,
    response,                          // null = no result yet
}) => {
    const { t } = useLanguage();
    const hasResult = !!response;

    // ── AI summary collapse state ──────────────────────────
    const [summaryExpanded, setSummaryExpanded] = React.useState(true);
    // Re-expand whenever a new result arrives
    React.useEffect(() => { setSummaryExpanded(true); }, [response]);

    // ── Category theme ─────────────────────────────────────
    const cat = selectedCategory || VISIBLE_CATEGORIES[0];
    // Base palette (not the alternating deep one) — this screen is a single
    // question, so there is no A/B rhythm to follow here.
    const catColors = CAT_COLORS[cat.id] || CAT_COLORS.sku_analysis;
    const CatIcon = FAQ_GRID_ICONS[cat.id]?.icon || Package;
    // Per-question icon — same one the list card shows, so the two views match.
    const QIcon = QUESTION_ICONS[question.id] || Package;
    // Every category is brand blue now, so this is a constant rather than the
    // old per-hue lookup. Give a category its own palette again and this needs
    // to branch on catColors.stripe once more.
    const btnGradient = 'from-blue-600 to-sky-500';

    // ── Form logic ─────────────────────────────────────────
    const isMarketplaceSupported = (mpKey) => isQuestionSupportedForMarketplace(question, mpKey);

    React.useEffect(() => {
        if (!marketplaces.length) return;
        const supportedMps = marketplaces.filter(m => isMarketplaceSupported(m.key));
        const isCurrentSupported = selectedMarketplace && isMarketplaceSupported(selectedMarketplace);

        if (selectedMarketplace && !isCurrentSupported) {
            setSelectedMarketplace('');
        }

        if (supportedMps.length === 1 && (!selectedMarketplace || !isCurrentSupported)) {
            setSelectedMarketplace(supportedMps[0].key);
        }
    }, [marketplaces, question, selectedMarketplace]);

    // Marketplace-specific multi-select options disappear when the marketplace
    // changes (e.g. Refund Loss when switching Amazon → Flipkart). Drop any
    // choice the new marketplace no longer offers, otherwise a now-invisible
    // selection would keep filtering the query down to nothing.
    React.useEffect(() => {
        (question.params || []).forEach(p => {
            if (p.type !== 'multiselect') return;
            const current = toArrayValue(params[p.key]);
            if (current.length === 0) return;
            const kept = current.filter(o => isOptionAvailable(p, o, selectedMarketplace));
            if (kept.length !== current.length) {
                setParams(prev => ({ ...prev, [p.key]: kept }));
            }
        });
    }, [selectedMarketplace, question]);

    const mp = marketplaces.find(m => m.key === selectedMarketplace);
    const accounts = mp?.accounts || [];
    const showMarketplace = marketplaces.length > 0;
    const hasDateParams = true; // Always show date filter for FAQ
    // Date range is required by default — opt out per-question by declaring
    // startDate/endDate params with `required: false` (e.g. Q81 backlog view).
    const dateRequired = (Array.isArray(question.params) ? question.params : [])
        .filter(p => p.key === 'startDate' || p.key === 'endDate')
        .every(p => p.required !== false);
    const nonDateParams = (Array.isArray(question.params) ? question.params : []).filter(p => p.type !== 'date');
    const requiredParams = nonDateParams.filter(p => p.required);
    const optionalParams = nonDateParams.filter(p => !p.required);
    const [activeOptional, setActiveOptional] = React.useState(null);
    const toggleOptional = (key) => {
        setActiveOptional(prev => prev === key ? null : key);
    };
    const clearOptional = (key) => {
        setParams(p => { const c = { ...p }; delete c[key]; return c; });
        setParamErrors(p => { const c = { ...p }; delete c[key]; return c; });
        setActiveOptional(prev => prev === key ? null : prev);
    };
    const hasDateError = !!(paramErrors.startDate || paramErrors.endDate);

    const setParam = (key, value) => {
        setParams(prev => ({ ...prev, [key]: value }));
        setParamErrors(prev => ({ ...prev, [key]: '' }));
    };

    const handleClearFilters = () => {
        setParams(prev => {
            const next = { ...prev };
            optionalParams.forEach(p => delete next[p.key]);
            return next;
        });
        setParamErrors(prev => {
            const next = { ...prev };
            optionalParams.forEach(p => delete next[p.key]);
            return next;
        });
        setActiveOptional(null);
    };

    const getParamWarnings = () => {
        if (!params.startDate || !params.endDate || selectedAccount.length === 0)
            return { noData: false, partialData: false, noDataAccounts: [], partialDataAccounts: [], allBlocked: false };
        const start = new Date(params.startDate).getTime();
        const end   = new Date(params.endDate).getTime();
        const noDataAccounts    = [];
        const partialDataAccounts = [];
        for (const m of marketplaces) {
            for (const a of m.accounts) {
                if (!selectedAccount.includes(a._id) || !a.analysisStartDate) continue;
                const analysisTime = new Date(a.analysisStartDate).getTime();
                if (end < analysisTime)   noDataAccounts.push(a);
                else if (start < analysisTime) partialDataAccounts.push(a);
            }
        }
        const allBlocked = noDataAccounts.length > 0 && noDataAccounts.length === selectedAccount.length;
        return {
            noData:               noDataAccounts.length > 0,
            partialData:          partialDataAccounts.length > 0,
            noDataAccounts,
            partialDataAccounts,
            allBlocked,
        };
    };
    const paramWarnings = getParamWarnings();
    
    // Check if question is Ads-related and marketplace is meesho
    // Force English when regex-matching so the rule works regardless of UI lang.
    const isMeeshoAdsBlocked = (selectedMarketplace || '').toLowerCase().trim() === 'meesho' && (question.category === 'ads' || /(?:\bads?\b)/i.test(t(question.question, 'en')));
    const canRun = !paramWarnings.allBlocked && !isMeeshoAdsBlocked;

    // ── Static answer guard (no API call needed) ──────────
    if (question.type === 'static') {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className={`shrink-0 border-b border-gray-100 dark:border-gray-800/60 ${catColors.light}`}>
                    <div className="px-6 py-4">
                        <button
                            onClick={onBack}
                            className={`flex items-center gap-1.5 text-[11px] font-semibold mb-2.5 transition-opacity opacity-50 hover:opacity-100 ${catColors.text}`}
                        >
                            <ArrowLeft size={12} /> <CatIcon size={11} /> {cat.label}
                        </button>
                        <h2 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                            {t(question.question)}
                        </h2>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5">
                    <div className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400" />
                                <span className="text-[10px] font-extrabold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Speedy AI</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{question.answer}</p>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        ← Back to Questions
                    </button>
                </div>
            </div>
        );
    }

    // ── Coming Soon guard ──────────────────────────────────
    if (question.comingSoon) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className={`shrink-0 border-b border-gray-100 dark:border-gray-800/60 ${catColors.light}`}>
                    <div className="px-6 py-4">
                        <button
                            onClick={onBack}
                            className={`flex items-center gap-1.5 text-[11px] font-semibold mb-2.5 transition-opacity opacity-50 hover:opacity-100 ${catColors.text}`}
                        >
                            <ArrowLeft size={12} /> <CatIcon size={11} /> {cat.label}
                        </button>
                        <h2 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                            {t(question.question)}
                        </h2>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center border border-amber-200 dark:border-amber-800/40">
                        <span className="text-3xl">🚧</span>
                    </div>
                    <div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[11px] font-semibold uppercase tracking-wider border border-amber-200 dark:border-amber-800/50 mb-3">
                            Coming Soon
                        </span>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                            This feature is under development
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
                            This query requires additional data sources that are currently being integrated. It will be available soon.
                        </p>
                    </div>
                    <button
                        onClick={onBack}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        ← Back to Questions
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">

            {/* ══ QUESTION HEADER (always visible) ═══════════════ */}
            <div className={`relative shrink-0 border-b border-gray-100 dark:border-gray-800/60 overflow-hidden ${catColors.light}`}>
                {/* Same watermark as the question's card in the list, so the card you
                    clicked and the screen you land on read as the same thing.
                    Offset clear of the language pill. Decorative only. */}
                <QIcon
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className={`absolute right-36 top-1/2 -translate-y-1/2 w-24 h-24
                        -rotate-12 pointer-events-none ${catColors.watermark}`}
                />

                <div className="relative px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        {/* Back breadcrumb */}
                        <button
                            onClick={onBack}
                            className={`flex items-center gap-1.5 text-[11px] font-semibold mb-2.5 transition-opacity opacity-50 hover:opacity-100 ${catColors.text}`}
                        >
                            <ArrowLeft size={12} /> <CatIcon size={11} /> {cat.label}
                        </button>
                        <div className="flex items-center gap-2.5">
                            {/* Semantic icon chip — mirrors the list card */}
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${catColors.badge}`}>
                                <QIcon size={16} strokeWidth={2} />
                            </span>
                            <h2 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                                {t(question.question)}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {question.important && <ImpBadge />}
                        {/* Language — top right, so switching re-reads the question above */}
                        <LanguageSwitch />
                    </div>
                </div>
            </div>

            {/* ══ BODY: params → loading → result ════════════════ */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* ── Loading state ─────────────────────────────────── */}
                {isLoading && <FAQLoadingScreen />}

                {/* ── Params view (full screen) ──────────────────────── */}
                {!isLoading && !hasResult && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="space-y-5 px-8 py-6 max-w-xl mx-auto">

                            {/* Account filter */}
                            {showMarketplace && (
                                <div className="space-y-3">
                                    {/* ── Marketplace cards ── */}
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                                            Marketplace <span className="text-red-500">*</span>
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {marketplaces.map(m => {
                                                const logoUrl = getMarketplaceLogo(m.key);
                                                const isActive = selectedMarketplace === m.key;
                                                const isSupported = isMarketplaceSupported(m.key);
                                                const label = m.key.charAt(0).toUpperCase() + m.key.slice(1);
                                                return (
                                                    <button
                                                        key={m.key}
                                                        type="button"
                                                        disabled={!isSupported}
                                                        onClick={() => { if(isSupported) { setSelectedMarketplace(m.key); setSelectedAccount([]); } }}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
                                                            !isSupported
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60'
                                                                : isActive
                                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 dark:shadow-blue-900/30'
                                                                    : 'bg-white dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-700 dark:hover:border-blue-600'
                                                        }`}
                                                        title={!isSupported ? 'Not supported for this question' : ''}
                                                    >
                                                        {logoUrl ? (
                                                            <span className="w-3.5 h-3.5 rounded bg-white flex items-center justify-center shrink-0 shadow-sm">
                                                                <img src={logoUrl} alt={label}
                                                                    className={`w-3.5 h-3.5 object-contain ${!isSupported ? 'grayscale opacity-50' : ''}`}
                                                                    onError={e => e.target.parentElement.innerHTML = label[0]} />
                                                            </span>
                                                        ) : (
                                                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-semibold shrink-0 ${!isSupported ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500' : isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{label[0]}</span>
                                                        )}
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {paramErrors._marketplace && (
                                            <p className="text-xs text-red-400 mt-2">{paramErrors._marketplace}</p>
                                        )}
                                    </div>

                                    {/* ── Account multi-select dropdown ── */}
                                    {selectedMarketplace && accounts.length > 0 && (
                                        <div>
                                            <AccountMultiSelect
                                                accounts={accounts}
                                                selected={selectedAccount}
                                                onChange={(ids) => {
                                                    setSelectedAccount(ids);
                                                    if (ids.length > 0 && paramErrors._account) {
                                                        setParamErrors(prev => ({ ...prev, _account: '' }));
                                                    }
                                                }}
                                                required
                                                error={paramErrors._account}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Date range */}
                            <div>
                                <FormSectionLabel required={dateRequired}>Date range</FormSectionLabel>
                                <div className={hasDateError ? 'ring-2 ring-red-300/60 dark:ring-red-700/60 rounded-xl' : ''}>
                                    <SpeedyDateFilter
                                        startDate={params.startDate || ''}
                                        endDate={params.endDate || ''}
                                        onChange={(s, e) => { setParam('startDate', s); setParam('endDate', e); }}
                                        inlineMode={true}
                                        required={dateRequired}
                                        hideLabel={true}
                                    />
                                </div>
                                {hasDateError && <p className="text-xs text-red-400 mt-2">Please select a date range</p>}
                            </div>

                            {/* Required params */}
                            {requiredParams.length > 0 && (
                                <div>
                                    <FormSectionLabel required>Parameters</FormSectionLabel>
                                    <div className="grid grid-cols-2 gap-3">
                                        {requiredParams.map(p => (
                                            <div key={p.key}>
                                                <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 block mb-1">
                                                    {p.label}<span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <ParamInput
                                                    p={p}
                                                    value={params[p.key]}
                                                    onChange={v => setParam(p.key, v)}
                                                    error={paramErrors[p.key]}
                                                    accentColor="blue"
                                                    marketplace={selectedMarketplace}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Optional params — chip buttons */}
                            {optionalParams.length > 0 && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Add optional parameters</p>
                                        <button
                                            type="button"
                                            onClick={handleClearFilters}
                                            className="text-[8px] font-semibold text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors uppercase tracking-wide"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {optionalParams.map(p => {
                                            const isActive = activeOptional === p.key;
                                            const val = params[p.key];
                                            const hasVal = val !== undefined && val !== '';
                                            return (
                                                <span
                                                    key={p.key}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all
                                                        ${isActive
                                                            ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300'
                                                            : hasVal
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                                                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600'
                                                        }`}
                                                >
                                                    {/* Clickable label area → opens edit input */}
                                                    <button type="button" onClick={() => toggleOptional(p.key)} className="flex items-center gap-1.5">
                                                        {!hasVal && <span className="text-[10px] opacity-60">+</span>}
                                                        {hasVal
                                                            ? <><span className="opacity-60">{p.label}:</span> <span className="font-semibold">{p.type === 'toggle' ? (TOGGLE_LABELS[val] || val) : displayParamValue(val)}</span></>
                                                            : <span>{p.label}</span>
                                                        }
                                                    </button>
                                                    {/* × always visible when there's a value */}
                                                    {hasVal && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); clearOptional(p.key); }}
                                                            className="opacity-50 hover:opacity-100 transition-opacity text-[10px] leading-none"
                                                        >✕</button>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {/* Active optional inputs */}
                                    {activeOptional !== null && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {optionalParams.filter(p => activeOptional === p.key).map(p => (
                                                <div key={p.key} className={(p.type === 'toggle' || p.type === 'multiselect') ? 'col-span-2' : ''}>
                                                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 block mb-1">
                                                        {p.label}
                                                    </label>
                                                    <ParamInput
                                                        p={p}
                                                        value={params[p.key]}
                                                        onChange={v => setParam(p.key, v)}
                                                        error={paramErrors[p.key]}
                                                        autoFocus
                                                        accentColor="indigo"
                                                        marketplace={selectedMarketplace}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Meesho Ads Blocked warning */}
                            {isMeeshoAdsBlocked && (
                                <div className="flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-400">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="font-semibold">Meesho Note</p>
                                        <p>This Question Cannot be asked for the Meesho Marketplace, because the panel does not provide SKU-wise Ads report.</p>
                                    </div>
                                </div>
                            )}

                            {/* Data limit warning — all affected accounts */}
                            {(paramWarnings.noData || paramWarnings.partialData) && !isMeeshoAdsBlocked && (
                                <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${paramWarnings.allBlocked ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'}`}>
                                    <span className="shrink-0 mt-0.5">⚠️</span>
                                    <div className="space-y-1">
                                        {paramWarnings.allBlocked
                                            ? <p className="font-semibold">No data available for this date range.</p>
                                            : <p className="font-semibold">Data limit: results are filtered per account's start date.</p>
                                        }
                                        {paramWarnings.noDataAccounts.length > 0 && (
                                            <div>
                                                <p className="font-semibold opacity-80 mb-0.5">No data (entirely outside range):</p>
                                                {paramWarnings.noDataAccounts.map(a => (
                                                    <p key={a._id}>• {a.name} — data starts {new Date(a.analysisStartDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>
                                                ))}
                                            </div>
                                        )}
                                        {paramWarnings.partialDataAccounts.length > 0 && (
                                            <div>
                                                <p className="font-semibold opacity-80 mb-0.5">Partial data (start date will be clamped):</p>
                                                {paramWarnings.partialDataAccounts.map(a => (
                                                    <p key={a._id}>• {a.name} — data from {new Date(a.analysisStartDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} only</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-col gap-3">
                                {/* Run button */}
                                <button
                                    onClick={onRun}
                                    disabled={isLoading || !canRun}
                                    className={`w-full flex items-center justify-center gap-2.5 text-white font-semibold py-3.5 rounded-2xl
                                        shadow-sm hover:shadow-md hover:opacity-95 disabled:opacity-50 disabled:shadow-none
                                        transition-all duration-150 bg-gradient-to-r ${btnGradient}`}
                                >
                                    {isLoading
                                        ? <>
                                            <span className="animate-spin text-lg leading-none">&#x29B6;</span>
                                            <span>Speedy is thinking…</span>
                                          </>
                                        : hasResult
                                            ? <>
                                                <Sparkles size={15} />
                                                <span>Re-analyse with Speedy AI</span>
                                              </>
                                            : <>
                                                <Sparkles size={15} />
                                                <span>Ask Speedy AI</span>
                                                <span className="opacity-60 text-[11px] font-normal border-l border-white/30 pl-2.5 ml-0.5">generate insights →</span>
                                              </>
                                    }
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                {/* ── Result view (full screen) ─────────────────── */}
                {!isLoading && hasResult && response && (
                    <div className="flex-1 overflow-y-auto dark-scrollbar flex flex-col gap-3 px-6 py-5">

                        {/* ── Action bar: Modify Filters + New question ── */}
                        <div className="faq-block relative z-20 flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800/60" style={{ animationDelay: '0ms' }}>
                            <button
                                onClick={onModifyParams}
                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={12} /> Modify Filters
                            </button>
                            <div className="flex items-center gap-2">
                                {/* ── Disclaimer note Tooltip ── */}
                                <div className="group relative flex items-center">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 cursor-help">
                                        <AlertTriangle size={10} />
                                        P&amp;L Info
                                    </span>
                                    
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[280px] p-2.5 bg-gray-900 dark:bg-gray-800 text-white text-[11px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                        <div className="flex gap-1.5 items-start">
                                            <AlertTriangle size={12} className="shrink-0 mt-0.5 text-amber-400" />
                                            <p className="leading-snug text-left whitespace-normal">
                                                P&amp;L is <span className="font-semibold text-amber-300">before GST</span>. Ad spend shown separately — see <span className="font-semibold text-amber-300">Profit After Ads</span> for the true net figure.
                                            </p>
                                        </div>
                                        {/* Tooltip triangle */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-gray-900 dark:border-b-gray-800"></div>
                                    </div>
                                </div>
                                <button
                                    onClick={onAskAnother}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Sparkles size={11} /> New question
                                </button>
                            </div>
                        </div>

                            {/* ── Block 1: Meta chips ── */}
                            <div className="faq-block flex flex-wrap items-center gap-1.5" style={{ animationDelay: '0ms' }}>
                                {/* Row count badge */}
                                {response.data?.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                                        {response.data.length} rows
                                    </span>
                                )}
                                {/* Date range */}
                                {params.startDate && params.endDate && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 text-blue-700 dark:text-blue-400">
                                        <Calendar size={10} />
                                        {formatDateDisplay(params.startDate, params.endDate)}
                                    </span>
                                )}
                                {/* Account */}
                                {selectedAccount.length > 0 && (() => {
                                    const accNames = [];
                                    for (const mp of marketplaces)
                                        for (const a of mp.accounts)
                                            if (selectedAccount.includes(a._id)) accNames.push(a.name);
                                    return accNames.length > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                                            <Store size={10} />
                                            {accNames.length === 1 ? accNames[0] : `${accNames.length} accounts`}
                                        </span>
                                    ) : null;
                                })()}
                                {/* Param chips */}
                                {Object.keys(params).filter(k => k !== 'startDate' && k !== 'endDate' && params[k]?.toString().trim()).map(k => {
                                    const pDef = (Array.isArray(question.params) ? question.params : []).find(p => p.key === k);
                                    const label = pDef?.label || k;
                                    const val   = params[k];
                                    // Only sort-order toggles get the arrow mapping — key off the
                                    // actual value, not the param type. Other toggles (Profit basis:
                                    // With/Without Ads, Comparison: Less/Greater than) show their value.
                                    const display = (val === 'desc' || val === 'asc')
                                        ? (val === 'desc' ? '↓ High→Low' : '↑ Low→High')
                                        : displayParamValue(val);
                                    return (
                                        <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/40 text-violet-700 dark:text-violet-400">
                                            <span className="opacity-60 font-normal">{label}:</span>
                                            <span className="font-semibold">{display}</span>
                                        </span>
                                    );
                                })}
                                {isLoading && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40 text-indigo-500 dark:text-indigo-400 animate-pulse">
                                        <Sparkles size={10} /> Updating…
                                    </span>
                                )}
                            </div>

                            {/* ── Meesho Note (if applicable) ── */}
                            {isMeeshoAdsBlocked && (
                                <div className="faq-block flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-700/30" style={{ animationDelay: '60ms' }}>
                                    <AlertTriangle size={11} className="shrink-0 mt-0.5 text-indigo-500 dark:text-indigo-400" />
                                    <p className="text-[11px] text-indigo-700 dark:text-indigo-400 leading-snug font-semibold">
                                        Meesho Note:
                                        <span className="font-normal ml-1">This Question Cannot be asked for the Meesho Marketplace, because the panel does not provide SKU-wise Ads report.</span>
                                    </p>
                                </div>
                            )}

                            {/* ── Combined Insight + Data card ── */}
                            {(response.summary || response.data?.length > 0 || response.format === 'text') && (
                                <div className="faq-block" style={{ animationDelay: '80ms' }}>
                                    {/* Gradient border wrapper */}
                                    <div className="p-[1.5px] rounded-2xl faq-ai-glow shadow-md">
                                        <div className="rounded-2xl bg-white dark:bg-gray-950 px-4 pt-3.5 pb-2.5">
                                            {/* Header row */}
                                            {response.summary && (
                                                <>
                                                    <div className="flex items-center gap-2 mb-2.5">
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700/50">
                                                            <span className="faq-live-dot w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400" />
                                                            <span className="text-[10px] font-extrabold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Speedy AI</span>
                                                        </div>
                                                        <div className="flex-1 h-px bg-gradient-to-r from-violet-200 dark:from-violet-800/50 to-transparent" />
                                                        {/* Show more / Show less button — bottom right */}
                                                        <div className="flex justify-end mt-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSummaryExpanded(v => !v)}
                                                                className="flex items-center gap-1 text-[11px] font-semibold text-violet-500 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                                                            >
                                                                {summaryExpanded ? (
                                                                    <><ChevronUp size={12} /> Show less</>
                                                                ) : (
                                                                    <><ChevronDown size={12} /> Show more</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Summary text with clamp + fade overlay */}
                                                    <div className="relative mb-5 mt-3">
                                                        <div
                                                            className="text-[13px] text-gray-800 dark:text-gray-100 leading-relaxed font-[450] transition-all duration-300 overflow-hidden"
                                                            style={{ maxHeight: summaryExpanded ? '600px' : '0' }}
                                                        >
                                                            <TypewriterText text={response.summary} speed={12} />
                                                        </div>

                                                        {/* Fade-out gradient when collapsed */}
                                                        {!summaryExpanded && (
                                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white dark:from-gray-950 to-transparent pointer-events-none" />
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* ── Block 3: Data ── */}
                                            {(response.data?.length > 0 || response.format === 'text') && (
                                                <div className="mt-4">
                                                    {/* Section label */}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-800 uppercase tracking-widest">Data</span>
                                                        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                                                        {response.data?.length > 0 && (
                                                            <span className="text-[10px] text-gray-400 dark:text-gray-800 font-medium">{response.data.length} record{response.data.length !== 1 ? 's' : ''}</span>
                                                        )}
                                                    </div>
                                                    <ResponseRenderer data={response.data} format={response.format} chartType={response.chartType} chartKeys={response.chartKeys} highlightKey={response.highlightKey} secondaryChart={response.secondaryChart} monthlyBreakdown={response.monthlyBreakdown} chartColors={response.chartColors} chartAbsKeys={response.chartAbsKeys} chartPnlPct={response.chartPnlPct} distributionCharts={response.distributionCharts} showTotals={response.showTotals} />
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            )}

                    </div>
                )}

            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
//  RESPONSE CONTENT
// ═══════════════════════════════════════════════════════════

// Wrap with LanguageProvider so the toggle persists across the whole agent UI.
const SpeedyAgentPageWithProviders = () => (
    <LanguageProvider>
        <SpeedyAgentPage />
    </LanguageProvider>
);

export default SpeedyAgentPageWithProviders;






