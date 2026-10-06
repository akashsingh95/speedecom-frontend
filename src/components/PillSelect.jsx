import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export default function PillSelect({ value, onChange, options, activeValue, activeClass, chevronActive }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const isActive = value !== activeValue;
    const current = options.find(o => o.value === value);
    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`pl-4 pr-7 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none cursor-pointer ${isActive ? activeClass : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
                {current?.label}
            </button>
            <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isActive ? chevronActive : 'text-slate-400'}`} />
            {open && (
                <div className="absolute left-0 mt-2 min-w-[12rem] bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 flex flex-col gap-0.5">
                    {options.map(opt => (
                        <button
                            type="button"
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${value === opt.value ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span>{opt.label}</span>
                            {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
