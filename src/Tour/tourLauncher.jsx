// The per-page "Tour this page" button.
//
// Page tours are launcher-only by default (see the autoStart notes in
// steps.js), so this button is the only way into most of them — which is why it
// lives in one component rather than being pasted into every page header.
//
// It stays mounted while a tour runs so a closing step can point back at it;
// the overlay is what stops the click from landing.

import React from 'react';
import { Compass } from 'lucide-react';
import { TOUR } from './targets';
import { useTour } from './TourProvider';

const TourLauncher = ({ tourKey, label = 'Tour this page', className = '' }) => {
    const { startTour, isAvailable } = useTour() || {};

    // Admin-side roles have no tenant page tours; rendering a dead button for
    // them would be worse than rendering nothing.
    if (!isAvailable || !startTour) return null;

    return (
        <button
            type="button"
            data-tour={TOUR.common.tourLauncher}
            onClick={() => startTour(tourKey)}
            className={`flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-700 bg-white hover:bg-brand-50/60 border border-slate-200 hover:border-brand-100 rounded-xl px-3.5 py-2 shadow-sm transition-all duration-200 shrink-0 ${className}`}
        >
            <Compass size={16} />
            {label}
        </button>
    );
};

export default TourLauncher;