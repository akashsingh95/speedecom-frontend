// ─────────────────────────────────────────────────────────
//  The tour's only piece of UI: a dimming backdrop with a
//  cut-out around the current element, plus the popover.
//
//  Purely presentational — it is handed an element and a step
//  and reports button clicks back. All sequencing lives in
//  TourProvider.
// ─────────────────────────────────────────────────────────

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react';

const GAP = 14;        // space between the cut-out and the popover
const EDGE = 16;       // popover never comes closer than this to the viewport edge
const PAD = 8;         // how far the cut-out is inflated past the element
const POPOVER_W = 360;

/** Rects compare by value; this avoids a state update on every animation frame. */
const sameRect = (a, b) => (
    !!a && !!b
    && Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5
    && Math.abs(a.height - b.height) < 0.5
);

const inflate = (rect) => ({
    top: Math.max(rect.top - PAD, 0),
    left: Math.max(rect.left - PAD, 0),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
});

/**
 * Picks a side with room for the popover, preferring the step's own choice.
 * Returns viewport coordinates plus the side actually used, so the arrow can
 * point back at the element.
 */
const place = (hole, size, preferred) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!hole || preferred === 'center') {
        return {
            top: Math.max((vh - size.height) / 2, EDGE),
            left: Math.max((vw - size.width) / 2, EDGE),
            side: 'center',
        };
    }

    const room = {
        bottom: vh - (hole.top + hole.height) - GAP - EDGE >= size.height,
        top: hole.top - GAP - EDGE >= size.height,
        right: vw - (hole.left + hole.width) - GAP - EDGE >= size.width,
        left: hole.left - GAP - EDGE >= size.width,
    };
    // Preferred side first, then the remaining sides in a fixed order so the
    // choice is deterministic for a given viewport.
    const side = [preferred, 'bottom', 'top', 'right', 'left'].find((s) => room[s]) || 'bottom';

    const clamp = (value, max) => Math.min(Math.max(value, EDGE), Math.max(max - EDGE, EDGE));

    if (side === 'bottom' || side === 'top') {
        const top = side === 'bottom' ? hole.top + hole.height + GAP : hole.top - GAP - size.height;
        return {
            top: clamp(top, vh - size.height),
            left: clamp(hole.left + hole.width / 2 - size.width / 2, vw - size.width),
            side,
        };
    }

    const left = side === 'right' ? hole.left + hole.width + GAP : hole.left - GAP - size.width;
    return {
        top: clamp(hole.top + hole.height / 2 - size.height / 2, vh - size.height),
        left: clamp(left, vw - size.width),
        side,
    };
};

const ARROW_BY_SIDE = {
    bottom: 'top-[-5px] border-l border-t',
    top: 'bottom-[-5px] border-r border-b',
    right: 'left-[-5px] border-l border-b',
    left: 'right-[-5px] border-r border-t',
};

const TourSpotlight = ({
    element,
    step,
    index,
    total,
    isFirst,
    isLast,
    onNext,
    onPrev,
    onClose,
}) => {
    const popoverRef = useRef(null);
    const [hole, setHole] = useState(null);
    const [size, setSize] = useState({ width: POPOVER_W, height: 200 });

    // Follow the element every frame rather than binding scroll/resize
    // listeners: the target can sit inside any number of scrollable panes, and
    // several of them animate on mount. A short-lived rAF loop is cheaper than
    // getting that ancestor bookkeeping right.
    useEffect(() => {
        if (!element) {
            setHole(null);
            return undefined;
        }
        let frame;
        const tick = () => {
            const next = inflate(element.getBoundingClientRect());
            setHole((current) => (sameRect(current, next) ? current : next));
            frame = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frame);
    }, [element]);

    // Measure the popover so placement can react to its real height — the body
    // copy varies enough between steps that a fixed guess mis-clamps.
    useLayoutEffect(() => {
        const node = popoverRef.current;
        if (!node) return undefined;
        const measure = () => {
            const rect = node.getBoundingClientRect();
            setSize((current) => (
                Math.abs(current.height - rect.height) < 0.5 && Math.abs(current.width - rect.width) < 0.5
                    ? current
                    : { width: rect.width, height: rect.height }
            ));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [step?.id]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
            if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); onNext(); }
            if (event.key === 'ArrowLeft' && !isFirst) { event.preventDefault(); onPrev(); }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, onNext, onPrev, isFirst]);

    const position = place(hole, size, step?.side || 'bottom');
    const progress = total > 1 ? ((index + 1) / total) * 100 : 100;

    // Arrow offset along the shared edge — the popover is clamped to the
    // viewport, so the element's centre is often not the popover's centre.
    const arrowOffset = (() => {
        if (!hole || position.side === 'center') return null;
        if (position.side === 'bottom' || position.side === 'top') {
            const center = hole.left + hole.width / 2 - position.left;
            return { left: `${Math.min(Math.max(center, 20), size.width - 20)}px` };
        }
        const center = hole.top + hole.height / 2 - position.top;
        return { top: `${Math.min(Math.max(center, 20), size.height - 20)}px` };
    })();

    return (
        <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true" aria-label="Product tour">
            {/* Dim everything but the cut-out. A mask keeps the corners rounded;
                four positioned divs cannot. */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
                <defs>
                    <mask id="tour-spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {hole && (
                            <rect
                                x={hole.left}
                                y={hole.top}
                                width={hole.width}
                                height={hole.height}
                                rx="12"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(15, 23, 42, 0.6)"
                    mask="url(#tour-spotlight-mask)"
                />
                {hole && (
                    <rect
                        x={hole.left}
                        y={hole.top}
                        width={hole.width}
                        height={hole.height}
                        rx="12"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.9)"
                        strokeWidth="2"
                    />
                )}
            </svg>

            {/* Swallows every click outside the popover: the tour drives
                navigation itself, and a stray click on a highlighted button
                would desync the step from the page. */}
            <div className="absolute inset-0" onClick={(event) => event.stopPropagation()} />

            <div
                ref={popoverRef}
                className="absolute w-[360px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.35)] border border-slate-200/80 font-sans animate-tour-pop"
                style={{ top: `${position.top}px`, left: `${position.left}px` }}
            >
                {arrowOffset && (
                    <div
                        className={`absolute w-2.5 h-2.5 bg-white border-slate-200/80 rotate-45 ${ARROW_BY_SIDE[position.side]}`}
                        style={arrowOffset}
                        aria-hidden="true"
                    />
                )}

                <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-heading font-bold text-slate-800 text-base leading-snug">
                            {step?.title}
                        </h3>
                        <button
                            type="button"
                            onClick={onClose}
                            title="End tour"
                            aria-label="End tour"
                            className="shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed">{step?.body}</p>
                </div>

                <div className="px-5 pb-4">
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div
                            className="h-full bg-brand-600 rounded-full transition-[width] duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-400 tabular-nums">
                            {index + 1} / {total}
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-2 transition-colors"
                            >
                                Skip
                            </button>
                            {!isFirst && (
                                <button
                                    type="button"
                                    onClick={onPrev}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 transition-colors"
                                >
                                    <ArrowLeft size={14} />
                                    Back
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onNext}
                                className="flex items-center gap-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl px-3.5 py-2 shadow-sm transition-colors"
                            >
                                {isLast ? 'Done' : 'Next'}
                                {isLast ? <Check size={14} /> : <ArrowRight size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TourSpotlight;