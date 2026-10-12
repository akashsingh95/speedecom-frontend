// ─────────────────────────────────────────────────────────
//  The tour's only piece of UI: a dimming backdrop with a
//  cut-out around the current element, plus the popover.
//
//  Purely presentational — it is handed an element and a step
//  and reports button clicks back. All sequencing lives in
//  TourProvider.
// ─────────────────────────────────────────────────────────

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight, Sparkles, Zap, ShieldCheck, Clock, TrendingUp } from 'lucide-react';

const GAP = 14;        // space between the cut-out and the popover
const EDGE = 20;       // popover never comes closer than this to the viewport edge
const PAD = 8;         // how far the cut-out is inflated past the element
const POPOVER_W = 420;

/** Rects compare by value; this avoids a state update on every animation frame. */
const sameRect = (a, b) => (
    !!a && !!b
    && Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5
    && Math.abs(a.height - b.height) < 0.5
);

/** Preserves exact viewport coordinates so scrolling never detaches the cut-out */
const inflate = (rect) => ({
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
});

/**
 * Picks a side with room for the popover, preferring the step's own choice or
 * dynamically selecting the most natural adjacent position (beside or below).
 * Returns viewport coordinates plus the side actually used, so the arrow can
 * point directly back at the element.
 */
const place = (hole, size, preferred, step = null) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Clamps coordinates strictly inside the viewport with safe margins
    const clampY = (val, h) => {
        const minTop = EDGE;
        const maxTop = Math.max(minTop, vh - h - EDGE);
        return Math.max(minTop, Math.min(val, maxTop));
    };
    const clampX = (val, w) => {
        const minLeft = EDGE;
        const maxLeft = Math.max(minLeft, vw - w - EDGE);
        return Math.max(minLeft, Math.min(val, maxLeft));
    };

    if (!hole || preferred === 'center' || step?.isBillingIntro) {
        return {
            top: clampY(Math.round((vh - size.height) / 2), size.height),
            left: clampX(Math.round((vw - size.width) / 2), size.width),
            side: 'center',
        };
    }

    const room = {
        right: vw - (hole.left + hole.width) - GAP - EDGE >= size.width,
        left: hole.left - GAP - EDGE >= size.width,
        bottom: vh - (hole.top + hole.height) - GAP - EDGE >= size.height,
        top: hole.top - GAP - EDGE >= size.height,
    };

    const isPlanCard = step?.id?.startsWith('bill-plan-') || hole.height > 280;
    const holeCenterH = hole.left + hole.width / 2;
    const spaceLeft = hole.left - GAP - EDGE;
    const spaceRight = vw - (hole.left + hole.width) - GAP - EDGE;
    const spaceBottom = vh - (hole.top + hole.height) - GAP - EDGE;
    const spaceTop = hole.top - GAP - EDGE;

    // Dynamically choose adjacent side:
    // When preferred is 'auto', 'center-bottom', or for plan cards, prioritize placing
    // immediately beside the card (left or right) so the full card height (price,
    // Buy Now button, and benefits) remains completely visible and unobstructed.
    let side = preferred;
    if (!side || side === 'auto' || side === 'center-bottom' || (isPlanCard && (side === 'bottom' || side === 'top'))) {
        if (room.right || room.left) {
            if (room.right && room.left) {
                // Both sides have room: if card is in left half of viewport, put on right; otherwise put on left
                side = holeCenterH < vw / 2 ? 'right' : 'left';
            } else if (room.right) {
                side = 'right';
            } else {
                side = 'left';
            }
        } else if (room.bottom) {
            side = 'bottom';
        } else if (room.top) {
            side = 'top';
        } else {
            // Constrained screen width: prefer side with more horizontal room for tall cards
            if (isPlanCard) {
                side = spaceLeft >= spaceRight ? 'left' : 'right';
            } else {
                const spaces = [
                    { s: 'bottom', val: spaceBottom },
                    { s: 'right', val: spaceRight },
                    { s: 'left', val: spaceLeft },
                    { s: 'top', val: spaceTop },
                ];
                spaces.sort((a, b) => b.val - a.val);
                side = spaces[0].s;
            }
        }
    } else if (!room[side]) {
        // Fallback if preferred side has insufficient room
        if (room.right) side = 'right';
        else if (room.left) side = 'left';
        else if (room.bottom) side = 'bottom';
        else if (room.top) side = 'top';
        else side = isPlanCard ? (spaceLeft >= spaceRight ? 'left' : 'right') : 'bottom';
    }

    if (side === 'bottom' || side === 'top') {
        const rawTop = side === 'bottom' ? hole.top + hole.height + GAP : hole.top - GAP - size.height;
        return {
            top: clampY(rawTop, size.height),
            left: clampX(hole.left + hole.width / 2 - size.width / 2, size.width),
            side,
        };
    }

    const left = side === 'right' ? hole.left + hole.width + GAP : hole.left - GAP - size.width;
    // For tall plan cards: align popover with the upper portion of the plan card so the user
    // can comfortably view the plan title & price right next to the instruction card,
    // while clampY guarantees top >= EDGE and top + size.height <= vh - EDGE.
    const targetTop = isPlanCard
        ? Math.max(hole.top, EDGE)
        : (hole.top + hole.height / 2 - size.height / 2);

    return {
        top: clampY(targetTop, size.height),
        left: clampX(left, size.width),
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
    actionCompleted = false,
    actionMeta = null,
    onCompleteAction,
    onBypassAction,
    onNext,
    onPrev,
    onClose,
}) => {
    const popoverRef = useRef(null);
    const [hole, setHole] = useState(null);
    const defaultWidth = step?.isBillingIntro
        ? 580
        : (step?.id?.startsWith('bill-plan-') ? 350 : POPOVER_W);
    const [size, setSize] = useState({ width: defaultWidth, height: step?.isBillingIntro ? 420 : 200 });

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
    }, [step?.id, actionCompleted, step?.isBillingIntro]);

    // Lock background scrolling during walkthrough, prevent layout shifts and detached highlights.
    // Restores scrolling completely when walkthrough ends, is skipped, or closes.
    useEffect(() => {
        const preventScroll = (event) => {
            // Allow scrolling within the popover itself if content exceeds max-height
            if (popoverRef.current && popoverRef.current.contains(event.target)) {
                return;
            }
            event.preventDefault();
        };

        const preventScrollKeys = (event) => {
            if (['Space', 'PageUp', 'PageDown', 'End', 'Home'].includes(event.code)) {
                if (popoverRef.current && popoverRef.current.contains(event.target)) {
                    return;
                }
                event.preventDefault();
            }
        };

        window.addEventListener('wheel', preventScroll, { passive: false });
        window.addEventListener('touchmove', preventScroll, { passive: false });
        window.addEventListener('keydown', preventScrollKeys, { passive: false });

        const prevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const scrollables = Array.from(document.querySelectorAll('.overflow-y-auto, .overflow-auto, main'));
        const prevOverflows = scrollables.map((el) => el.style.overflow);
        scrollables.forEach((el) => {
            el.style.overflow = 'hidden';
        });

        return () => {
            window.removeEventListener('wheel', preventScroll);
            window.removeEventListener('touchmove', preventScroll);
            window.removeEventListener('keydown', preventScrollKeys);
            document.body.style.overflow = prevBodyOverflow;
            scrollables.forEach((el, idx) => {
                el.style.overflow = prevOverflows[idx] || '';
            });
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
            if (event.key === 'ArrowRight' || event.key === 'Enter') {
                event.preventDefault();
                onNext();
            }
            if (event.key === 'ArrowLeft' && !isFirst) { event.preventDefault(); onPrev(); }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, onNext, onPrev, isFirst]);

    const position = place(hole, size, step?.side || 'bottom', step);
    const progress = total > 1 ? ((index + 1) / total) * 100 : 100;

    // Arrow offset along the shared edge — suppressed for centered popups
    const arrowOffset = (() => {
        if (!hole || position.side === 'center' || position.side === 'center-bottom') return null;
        if (position.side === 'bottom' || position.side === 'top') {
            const center = hole.left + hole.width / 2 - position.left;
            return { left: `${Math.min(Math.max(center, 24), Math.max(size.width - 24, 24))}px` };
        }
        const isPlanCard = step?.id?.startsWith('bill-plan-') || hole.height > 280;
        const targetHoleY = isPlanCard ? hole.top + Math.min(80, hole.height / 2) : hole.top + hole.height / 2;
        const center = targetHoleY - position.top;
        return { top: `${Math.min(Math.max(center, 24), Math.max(size.height - 24, 24))}px` };
    })();

    const vh = window.innerHeight;
    const vw = window.innerWidth;

    return (
        <div className="fixed inset-0 z-[9990] pointer-events-none" role="dialog" aria-modal="true" aria-label="Product tour">
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
                                rx="16"
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
                    fill="rgba(15, 23, 42, 0.65)"
                    mask="url(#tour-spotlight-mask)"
                />
                {hole && (
                    <rect
                        x={hole.left}
                        y={hole.top}
                        width={hole.width}
                        height={hole.height}
                        rx="16"
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth={3}
                        className="transition-all duration-200"
                    />
                )}
            </svg>

            {/* Swallows clicks OUTSIDE the cutout without detached overflow boxes */}
            {hole && (
                <>
                    {hole.top > 0 && (
                        <div
                            className="absolute top-0 left-0 right-0 pointer-events-auto"
                            style={{ height: `${Math.min(hole.top, vh)}px` }}
                            onClick={(event) => event.stopPropagation()}
                        />
                    )}
                    {hole.top + hole.height < vh && (
                        <div
                            className="absolute left-0 right-0 bottom-0 pointer-events-auto"
                            style={{ top: `${Math.max(0, hole.top + hole.height)}px` }}
                            onClick={(event) => event.stopPropagation()}
                        />
                    )}
                    {hole.left > 0 && (
                        <div
                            className="absolute pointer-events-auto"
                            style={{
                                top: `${Math.max(0, hole.top)}px`,
                                left: 0,
                                width: `${Math.min(hole.left, vw)}px`,
                                height: `${Math.max(0, Math.min(hole.top + hole.height, vh) - Math.max(0, hole.top))}px`,
                            }}
                            onClick={(event) => event.stopPropagation()}
                        />
                    )}
                    {hole.left + hole.width < vw && (
                        <div
                            className="absolute pointer-events-auto"
                            style={{
                                top: `${Math.max(0, hole.top)}px`,
                                left: `${Math.min(hole.left + hole.width, vw)}px`,
                                right: 0,
                                height: `${Math.max(0, Math.min(hole.top + hole.height, vh) - Math.max(0, hole.top))}px`,
                            }}
                            onClick={(event) => event.stopPropagation()}
                        />
                    )}
                </>
            )}

            <div
                ref={popoverRef}
                className={`absolute pointer-events-auto bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.8)] border border-slate-200/90 font-sans animate-tour-pop overflow-y-auto max-h-[calc(100vh-40px)] custom-scrollbar ${
                    step?.isBillingIntro
                        ? 'w-[580px] max-w-[calc(100vw-32px)]'
                        : (step?.id?.startsWith('bill-plan-')
                            ? 'w-[350px] max-w-[calc(100vw-32px)]'
                            : 'w-[410px] max-w-[calc(100vw-32px)]')
                }`}
                style={{ top: `${position.top}px`, left: `${position.left}px` }}
            >
                {/* Gradient Accent Bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600" />

                {arrowOffset && (
                    <div
                        className={`absolute w-2.5 h-2.5 bg-white border-slate-200/80 rotate-45 ${ARROW_BY_SIDE[position.side]}`}
                        style={arrowOffset}
                        aria-hidden="true"
                    />
                )}

                <div className="p-5 sm:p-6 pb-3">
                    {/* Header: Badge & Close */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide uppercase bg-brand-50 text-brand-700 border border-brand-200/80 shadow-xs">
                                <Sparkles size={11} className="text-amber-500 shrink-0" />
                                {step?.isBillingIntro ? 'Billing & Credits Overview' : 'Guided Onboarding'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                                Step {index + 1} of {total}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Dismiss tour"
                            aria-label="Dismiss tour"
                            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Title */}
                    <h3 className="font-heading font-extrabold text-slate-900 text-lg leading-snug tracking-tight">
                        {step?.title}
                    </h3>

                    {/* Body */}
                    <p className="text-sm text-slate-600 leading-relaxed mt-1.5">
                        {step?.body}
                    </p>

                    {/* Rich Platform Benefits for Billing Introduction */}
                    {step?.isBillingIntro && (
                        <div className="mt-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-slate-50 transition-all flex items-start gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Zap size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                                            Pay-As-You-Go Credits
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            No locked recurring contracts. 1 credit = 1 order or settlement unit processed.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-slate-50 transition-all flex items-start gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <ShieldCheck size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                                            100% Roll-over & Zero Expiry
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Unused credits never expire. Recharges automatically roll over your entire balance.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-slate-50 transition-all flex items-start gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Clock size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                                            Fee & Leakage Audits
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Audits courier weight overcharges, marketplace commission slips, and returns.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-slate-50 transition-all flex items-start gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Sparkles size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                                            Choose By Store Volume
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Select Basic (₹5k), Value (₹10k), or Premium (₹20k) based on your catalog capacity.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-5 sm:px-6 pb-4 pt-2">
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3.5">
                        <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-xs font-semibold text-slate-400 hover:text-slate-700 px-2 py-1.5 transition-colors cursor-pointer"
                        >
                            Skip
                        </button>

                        <div className="flex items-center gap-2">
                            {!isFirst && (
                                <button
                                    type="button"
                                    onClick={onPrev}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-xl px-3.5 py-2 transition-all active:scale-95 cursor-pointer"
                                >
                                    <ArrowLeft size={14} />
                                    Back
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onNext}
                                className={`flex items-center gap-1.5 text-xs font-extrabold text-white rounded-xl px-4 py-2 shadow-md transition-all duration-200 active:scale-95 cursor-pointer ${
                                    isLast
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                                        : 'bg-gradient-to-r from-brand-600 via-brand-700 to-indigo-700 hover:from-brand-500 hover:to-indigo-600 shadow-brand-500/25 hover:scale-[1.02]'
                                }`}
                            >
                                <span>{isLast ? (step?.lastButtonText || 'Finish Tour & Choose Plan ➔') : (step?.nextButtonText || 'Next')}</span>
                                {!isLast && !step?.nextButtonText?.includes('➔') && <ArrowRight size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TourSpotlight;