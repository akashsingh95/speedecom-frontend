// The per-page "Tour this page" button.
//
// Page tours are launcher-only by default (see the autoStart notes in
// steps.js), so this button is the only way into most of them — which is why it
// lives in one component rather than being pasted into every page header.
//
// It stays mounted while a tour runs so a closing step can point back at it;
// the overlay is what stops the click from landing.

import React, { useState } from 'react';
import { Compass } from 'lucide-react';
import { TOUR } from './targets';
import { useTour } from './TourProvider';
import { createPortal } from 'react-dom';

const TourLauncher = ({ tourKey, label = 'Tour this page', className = '' }) => {
    const { startTour, isAvailable } = useTour() || {};

    // Admin-side roles have no tenant page tours; rendering a dead button for
    // them would be worse than rendering nothing.
    const [tooltipState, setTooltipState] = useState({ show: false, x: 0, y: 0 });

    if (!isAvailable || !startTour) return null;

    const handleMouseMove = (e) => {
        setTooltipState({ show: true, x: e.clientX, y: e.clientY });
    };

    const handleMouseLeave = () => {
        setTooltipState({ show: false, x: 0, y: 0 });
    };

    return (
        <>
            <button
                type="button"
                data-tour={TOUR.common.tourLauncher}
                onClick={() => startTour(tourKey)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className={`flex items-center justify-center text-slate-500 hover:text-brand-700 bg-white hover:bg-brand-50/60 border border-slate-200 hover:border-brand-100 rounded-xl p-2 sm:p-2.5 shadow-sm transition-all duration-200 shrink-0 ${className}`}
            >
                <Compass size={18} />
            </button>

            {tooltipState.show && createPortal(
                <div
                    className="fixed z-[99999] bg-white border border-slate-200 shadow-xl rounded-lg px-3 py-2 pointer-events-none text-xs font-bold text-slate-700 animate-in fade-in duration-100 whitespace-nowrap"
                    style={{
                        left: tooltipState.x - 15,
                        top: tooltipState.y + 15,
                        transform: 'translateX(-100%)'
                    }}
                >
                    {label}
                </div>,
                document.body
            )}
        </>
    );
};

export default TourLauncher;