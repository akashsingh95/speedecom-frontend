// ─────────────────────────────────────────────────────────
//  The tour's only piece of UI: a dimming backdrop with a
//  cut-out around the current element, plus the popover.
//
//  Purely presentational — it is handed an element and a step
//  and reports button clicks back. All sequencing lives in
//  TourProvider.
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight, Sparkles, Zap, ShieldCheck, Clock, TrendingUp, Check, Lock, RefreshCw, AlertCircle, Info, Loader2 } from 'lucide-react';
import { TOUR, tourSelector } from './targets';
import { isValidEmail } from '../components/ConnectMarketplaceModal';
import UploadReadinessChecklist from '../components/UploadReadinessChecklist';

const GAP = 14;        // space between the cut-out and the popover
const EDGE = 20;       // popover never comes closer than this to the viewport edge
const PAD = 8;         // how far the cut-out is inflated past the element
const POPOVER_W = 420;

/**
 * Natural size of the popover. scrollHeight ignores a max-height cap, so a
 * capped popover keeps reporting the height it wants rather than the height it
 * was squeezed to, which would otherwise flip the placement on every render.
 */
const measurePopover = (node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: Math.max(rect.height, node.scrollHeight) };
};

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
 * Detects whether a checkout modal (SpeedEcom checkout or active Razorpay frame)
 * is currently visibly open in the DOM.
 * Strictly scoped to billing steps and verifies that the container is actively visible
 * so stale/hidden elements from prior transactions never suppress the spotlight hole.
 */
const isCheckoutActivelyOpen = (step) => {
    if (typeof document === 'undefined') return false;
    const isBilling = step?.id?.startsWith?.('bill-') || step?.target?.startsWith?.('billing');
    if (!isBilling) return false;

    const modal = document.querySelector('[data-tour-modal="checkout"]') ||
        document.querySelector(`${tourSelector(TOUR.billing.modal)} > div`);
    if (modal) {
        const r = modal.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return true;
    }

    const rzp = document.querySelector('.razorpay-container');
    if (rzp) {
        const r = rzp.getBoundingClientRect();
        const style = window.getComputedStyle(rzp);
        if (r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            return true;
        }
    }
    return false;
};

/**
 * Picks a side with room for the popover, preferring the step's own choice or
 * dynamically selecting the most natural adjacent position (beside or below).
 * Returns viewport coordinates plus the side actually used, so the arrow can
 * point directly back at the element.
 */
const place = (hole, size, preferred, step = null, viewport = null) => {
    const vw = viewport?.width || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const vh = viewport?.height || (typeof window !== 'undefined' ? window.innerHeight : 800);

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

    const stepModalEl = step?.modalSelector && typeof document !== 'undefined'
        ? document.querySelector(step.modalSelector)
        : null;

    const isMarketplaceModal = !stepModalEl && !!(
        step?.target?.startsWith?.('marketplace.modal') ||
        (step?.id?.startsWith?.('mp-') && step?.id?.includes('-') && !step?.isMarketplaceSelect && !step?.isCelebration)
    );

    const checkoutModalEl = (!isMarketplaceModal && isCheckoutActivelyOpen(step))
        ? (typeof document !== 'undefined'
            ? (document.querySelector('[data-tour-modal="checkout"]') ||
               document.querySelector(`${tourSelector(TOUR.billing.modal)} > div`) ||
               document.querySelector('.razorpay-container'))
            : null)
        : null;

    const isModalTarget = !!(checkoutModalEl || isMarketplaceModal || stepModalEl);

    // Non-modal centering steps
    if (!isModalTarget && (!hole || preferred === 'center' || step?.isBillingIntro || step?.isMarketplaceSelect || step?.isCelebration)) {
        return {
            top: clampY(Math.round((vh - size.height) / 2), size.height),
            left: clampX(Math.round((vw - size.width) / 2), size.width),
            side: 'center',
        };
    }

    // Modal-aware positioning: keep popover completely outside the modal dialog
    // so inputs and buttons remain visible, unclipped, and freely editable.
    if (isModalTarget) {
        const modalEl = stepModalEl || (isMarketplaceModal
            ? (typeof document !== 'undefined'
                ? (document.querySelector('[data-tour-modal="connect-marketplace"]') ||
                   document.querySelector('.connect-marketplace-modal') ||
                   document.querySelector('[data-tour-modal]') ||
                   document.querySelector('.fixed .rounded-3xl.bg-white') ||
                   document.querySelector('.fixed .bg-white.rounded-3xl'))
                : null)
            : checkoutModalEl);
        const modalRect = modalEl?.getBoundingClientRect();

        if (modalRect && modalRect.width > 0 && modalRect.height > 0) {
            const spaceRight = vw - modalRect.right - GAP - EDGE;
            const spaceLeft = modalRect.left - GAP - EDGE;
            const popoverW = size.width || 340;
            const popoverH = size.height || 300;

            const targetY = hole
                ? (hole.top + hole.height / 2)
                : (modalRect.top + Math.min(140, modalRect.height / 3));
            const idealTop = clampY(targetY - popoverH / 2, popoverH);

            // 1. Preferred: comfortable room to the right of the entire modal
            if (spaceRight >= popoverW) {
                return {
                    top: idealTop,
                    left: Math.max(modalRect.right + GAP, Math.min(modalRect.right + GAP, vw - popoverW - EDGE)),
                    side: 'right',
                };
            }
            // 2. Comfortable room to the left of the entire modal
            if (spaceLeft >= popoverW) {
                return {
                    top: idealTop,
                    left: Math.max(EDGE, modalRect.left - GAP - popoverW),
                    side: 'left',
                };
            }

            // 3. Medium-to-large displays (vw >= 768px):
            // Keep strictly clear of the modal dialog so all inputs remain unblocked
            if (vw >= 768) {
                if (spaceRight >= spaceLeft && spaceRight >= 160) {
                    return {
                        top: idealTop,
                        left: Math.max(modalRect.right + GAP, vw - popoverW - EDGE),
                        side: 'right',
                    };
                } else if (spaceLeft >= 160) {
                    return {
                        top: idealTop,
                        left: Math.min(modalRect.left - GAP - popoverW, EDGE),
                        side: 'left',
                    };
                }
            }

            // 4. Narrow mobile screens (<768px): dock above or below modal without blocking form fields
            if (modalRect.top >= popoverH + GAP + EDGE) {
                return {
                    top: EDGE,
                    left: clampX((vw - popoverW) / 2, popoverW),
                    side: 'top',
                };
            }
            return {
                top: clampY(vh - popoverH - EDGE, popoverH),
                left: clampX((vw - popoverW) / 2, popoverW),
                side: 'bottom',
            };
        }
    }

    // If hole is still null at this point (e.g. modal element not yet in DOM), return centered.
    if (!hole) {
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
    let side = preferred;
    if (!side || side === 'auto' || side === 'center-bottom' || (isPlanCard && (side === 'bottom' || side === 'top'))) {
        if (room.right || room.left) {
            if (room.right && room.left) {
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
        if (room.right) side = 'right';
        else if (room.left) side = 'left';
        else if (room.bottom) side = 'bottom';
        else if (room.top) side = 'top';
        else if (isPlanCard) side = spaceLeft >= spaceRight ? 'left' : 'right';
        else {
            // Nothing fits beside the target: take the roomiest side rather than
            // sitting on top of what the step is pointing at.
            const roomiest = [
                { s: 'bottom', val: spaceBottom },
                { s: 'top', val: spaceTop },
                { s: 'right', val: spaceRight },
                { s: 'left', val: spaceLeft },
            ].sort((a, b) => b.val - a.val)[0];
            side = roomiest.s;
        }
    }

    if (side === 'bottom' || side === 'top') {
        // A popover taller than the free space is capped (it scrolls inside)
        // so it never covers the highlighted element.
        const available = side === 'bottom' ? spaceBottom : spaceTop;
        const maxHeight = size.height > available ? Math.max(available, 220) : undefined;
        const height = maxHeight ?? size.height;
        const rawTop = side === 'bottom' ? hole.top + hole.height + GAP : hole.top - GAP - height;
        return {
            top: clampY(rawTop, height),
            left: clampX(hole.left + hole.width / 2 - size.width / 2, size.width),
            side,
            maxHeight,
        };
    }

    const left = side === 'right' ? hole.left + hole.width + GAP : hole.left - GAP - size.width;
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
    actionError = null,
    readinessMarketplaceId = null,
    onRetryAfterFailure,
    onCompleteAction,
    onBypassAction,
    onNext,
    onPrev,
    onClose,
    onGoToDashboard,
}) => {
    const popoverRef = useRef(null);
    const [hole, setHole] = useState(null);

    const isModalTarget = !!(
        step?.modalSelector ||
        step?.target?.startsWith?.('marketplace.modal') ||
        (step?.id?.startsWith?.('mp-') && step?.id?.includes('-') && !step?.isMarketplaceSelect && !step?.isCelebration)
    );

    const defaultWidth = step?.isBillingIntro || step?.isMarketplaceSelect || step?.isCelebration
        ? 580
        : isModalTarget
            ? 340
            : (step?.id?.startsWith('bill-plan-') ? 340 : POPOVER_W);
    const [size, setSize] = useState({ width: defaultWidth, height: step?.isBillingIntro ? 420 : 200 });
    const [viewport, setViewport] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1280,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
    }));

    // Live form state & synchronization for validation
    const [formState, setFormState] = useState({
        accountName: '',
        email: '',
        password: '',
        analysisStartDate: '',
        enableSizeWiseCalculation: false,
        showAutoSyncFields: false,
        loading: false,
        errorMessage: '',
    });

    useEffect(() => {
        const readLiveValues = () => {
            const accountInput = document.querySelector(`input[name="accountName"], ${tourSelector(TOUR.marketplace.modalAccountName)} input`);
            const emailInput = document.querySelector(`input[name="email"], ${tourSelector(TOUR.marketplace.modalEmail)} input`);
            const passwordInput = document.querySelector(`input[name="password"], ${tourSelector(TOUR.marketplace.modalPassword)} input`);
            setFormState(prev => ({
                ...prev,
                accountName: accountInput?.value ?? prev.accountName,
                email: emailInput?.value ?? prev.email,
                password: passwordInput?.value ?? prev.password,
            }));
        };
        readLiveValues();

        const handleFormChange = (e) => {
            if (e.detail) {
                setFormState(prev => ({
                    ...prev,
                    accountName: e.detail.accountName ?? prev.accountName,
                    email: e.detail.email ?? prev.email,
                    password: e.detail.password ?? prev.password,
                    analysisStartDate: e.detail.analysisStartDate ?? prev.analysisStartDate,
                    enableSizeWiseCalculation: typeof e.detail.enableSizeWiseCalculation === 'boolean'
                        ? e.detail.enableSizeWiseCalculation
                        : prev.enableSizeWiseCalculation,
                    showAutoSyncFields: typeof e.detail.showAutoSyncFields === 'boolean'
                        ? e.detail.showAutoSyncFields
                        : prev.showAutoSyncFields,
                    loading: !!e.detail.loading,
                }));
            }
        };

        const handleSetSizeWise = (e) => {
            if (typeof e.detail?.value === 'boolean') {
                setFormState(prev => ({ ...prev, enableSizeWiseCalculation: e.detail.value }));
            }
        };

        const handleSetAutoSync = (e) => {
            if (typeof e.detail?.value === 'boolean') {
                setFormState(prev => ({ ...prev, showAutoSyncFields: e.detail.value }));
            }
        };

        const handleConnError = (e) => {
            if (e.detail?.message) {
                setFormState(prev => ({ ...prev, errorMessage: e.detail.message, loading: false }));
            }
        };

        const handleLiveInput = (e) => {
            if (e.target?.name === 'accountName') {
                setFormState(prev => ({ ...prev, accountName: e.target.value, errorMessage: '' }));
            }
            if (e.target?.name === 'email') {
                setFormState(prev => ({ ...prev, email: e.target.value, errorMessage: '' }));
            }
            if (e.target?.name === 'password') {
                setFormState(prev => ({ ...prev, password: e.target.value, errorMessage: '' }));
            }
        };

        window.addEventListener('tour:form_change', handleFormChange);
        window.addEventListener('tour:set_sizewise', handleSetSizeWise);
        window.addEventListener('tour:set_autosync', handleSetAutoSync);
        window.addEventListener('tour:connection_error', handleConnError);
        document.addEventListener('input', handleLiveInput);
        document.addEventListener('change', handleLiveInput);

        return () => {
            window.removeEventListener('tour:form_change', handleFormChange);
            window.removeEventListener('tour:set_sizewise', handleSetSizeWise);
            window.removeEventListener('tour:set_autosync', handleSetAutoSync);
            window.removeEventListener('tour:connection_error', handleConnError);
            document.removeEventListener('input', handleLiveInput);
            document.removeEventListener('change', handleLiveInput);
        };
    }, [step?.id]);

    const trimmedAccountName = (formState.accountName || '').trim();
    const isAccountNameValid = trimmedAccountName.length > 0;
    const trimmedEmail = (formState.email || '').trim();
    const isEmailValid = isValidEmail(trimmedEmail);
    const trimmedPassword = (formState.password || '').trim();
    const isPasswordValid = trimmedPassword.length > 0;

    let isNextDisabled = false;
    let actionStatus = null;

    if (step?.actionType === 'accountName') {
        if (!isAccountNameValid) {
            isNextDisabled = true;
            actionStatus = {
                type: 'prompt',
                text: 'Type your account nickname or store name above to proceed',
            };
        } else {
            isNextDisabled = false;
            actionStatus = {
                type: 'valid',
                text: 'Account name entered. Click Next to proceed',
            };
        }
    } else if (step?.actionType === 'email') {
        if (!trimmedEmail) {
            isNextDisabled = true;
            actionStatus = {
                type: 'prompt',
                text: 'Type your panel email address above to proceed',
            };
        } else if (!isEmailValid) {
            isNextDisabled = true;
            actionStatus = {
                type: 'invalid',
                text: 'Enter a valid email address with a complete domain (e.g. seller@store.com)',
            };
        } else {
            isNextDisabled = false;
            actionStatus = {
                type: 'valid',
                text: 'Valid email format entered. Click Next to proceed',
            };
        }
    } else if (step?.actionType === 'password') {
        if (!isPasswordValid) {
            isNextDisabled = true;
            actionStatus = {
                type: 'prompt',
                text: 'Enter your panel password above to proceed',
            };
        } else {
            isNextDisabled = false;
            actionStatus = {
                type: 'valid',
                text: 'Password completed securely. Click Next to proceed',
            };
        }
    } else if (step?.actionType === 'connect') {
        isNextDisabled = true;
    } else if (step?.requiresAction && !actionCompleted) {
        isNextDisabled = true;
        actionStatus = actionError
            ? { type: 'failed', text: actionError.message }
            : { type: 'prompt', text: step.actionPrompt || 'Complete this step to continue' };
    }

    // Reliably resolves the live target element from DOM if the prop reference is stale/detached
    const resolveLiveElement = useCallback(() => {
        if (element && element.isConnected) {
            const r = element.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return element;
        }
        if (step?.target) {
            const sel = tourSelector(step.target);
            if (sel) {
                const found = document.querySelector(sel);
                if (found && found.isConnected) {
                    const r = found.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0) return found;
                }
            }
        }
        return element && element.isConnected ? element : null;
    }, [element, step?.target]);

    // Recalculates viewport dimensions, element hole, and popover size
    const remeasureAll = useCallback(() => {
        // 1. Sync viewport dimensions
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setViewport((prev) => (prev.width === vw && prev.height === vh ? prev : { width: vw, height: vh }));

        // 2. Measure target element hole from live DOM
        const isCheckoutOpen = isCheckoutActivelyOpen(step);
        if (isCheckoutOpen) {
            setHole(null);
        } else {
            const liveEl = resolveLiveElement();
            if (liveEl) {
                const rect = liveEl.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    const nextHole = inflate(rect);
                    setHole((curr) => (sameRect(curr, nextHole) ? curr : nextHole));
                }
            } else if (!step?.target) {
                setHole(null);
            }
        }

        // 3. Measure popover size
        if (popoverRef.current) {
            const popRect = measurePopover(popoverRef.current);
            if (popRect.width > 0 && popRect.height > 0) {
                setSize((curr) => (
                    Math.abs(curr.height - popRect.height) < 0.5 && Math.abs(curr.width - popRect.width) < 0.5
                        ? curr
                        : popRect
                ));
            }
        }
    }, [resolveLiveElement, step?.target]);

    // Recalculate on window focus, tab visibility changes, viewport resize, and pageshow
    useEffect(() => {
        let timer1, timer2;
        const handleSync = () => {
            remeasureAll();
            requestAnimationFrame(remeasureAll);
            clearTimeout(timer1);
            clearTimeout(timer2);
            timer1 = setTimeout(remeasureAll, 50);
            timer2 = setTimeout(remeasureAll, 150);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleSync();
            }
        };

        window.addEventListener('focus', handleSync);
        window.addEventListener('resize', handleSync);
        window.addEventListener('pageshow', handleSync);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            window.removeEventListener('focus', handleSync);
            window.removeEventListener('resize', handleSync);
            window.removeEventListener('pageshow', handleSync);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [remeasureAll]);

    // Follow the element every frame with live DOM resolution
    useEffect(() => {
        let frame;
        const tick = () => {
            const isCheckoutOpen = isCheckoutActivelyOpen(step);
            if (isCheckoutOpen) {
                setHole(null);
            } else {
                const liveEl = resolveLiveElement();
                if (liveEl) {
                    const rect = liveEl.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        const next = inflate(rect);
                        setHole((current) => (sameRect(current, next) ? current : next));
                    }
                } else if (!step?.target) {
                    setHole(null);
                }
            }
            frame = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frame);
    }, [resolveLiveElement, step?.target]);

    // Measure the popover so placement can react to its real height — the body
    // copy varies enough between steps that a fixed guess mis-clamps.
    useLayoutEffect(() => {
        const node = popoverRef.current;
        if (!node) return undefined;
        const measure = () => {
            const rect = measurePopover(node);
            if (rect.width > 0 && rect.height > 0) {
                setSize((current) => (
                    Math.abs(current.height - rect.height) < 0.5 && Math.abs(current.width - rect.width) < 0.5
                        ? current
                        : rect
                ));
            }
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        // A capped popover keeps its own size when content changes, so watch the content too.
        Array.from(node.children).forEach((child) => observer.observe(child));
        return () => observer.disconnect();
    }, [step?.id, actionCompleted, step?.isBillingIntro, isNextDisabled, actionStatus?.type]);

    // Scrolling lock during guide/highlight:
    // User requested that neither background nor modal should be scrollable
    // while highlighting or giving guide.
    // Typing inside form inputs (Space, Backspace, Arrow keys) is preserved.
    useEffect(() => {
        const isTypingTarget = (target) => {
            if (!target) return false;
            const tag = target.tagName ? target.tagName.toUpperCase() : '';
            return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
        };

        const preventScroll = (event) => {
            // Allow wheel only if cursor is inside the tour popover itself and popover content overflows
            if (popoverRef.current && popoverRef.current.contains(event.target)) {
                const isScrollable = popoverRef.current.scrollHeight > popoverRef.current.clientHeight;
                if (isScrollable) return;
            }
            // Everywhere else: strictly prevent wheel and touchmove from scrolling
            event.preventDefault();
        };

        const preventScrollKeys = (event) => {
            if (isTypingTarget(event.target)) {
                return; // NEVER block space or navigation keys while typing inside an input!
            }
            if (['Space', 'PageUp', 'PageDown', 'End', 'Home', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
                if (popoverRef.current && popoverRef.current.contains(event.target)) {
                    const isScrollable = popoverRef.current.scrollHeight > popoverRef.current.clientHeight;
                    if (isScrollable) return;
                }
                event.preventDefault();
            }
        };

        window.addEventListener('wheel', preventScroll, { passive: false });
        window.addEventListener('touchmove', preventScroll, { passive: false });
        window.addEventListener('keydown', preventScrollKeys, { passive: false });

        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.classList.add('tour-active');
        document.documentElement.classList.add('tour-active');

        return () => {
            window.removeEventListener('wheel', preventScroll);
            window.removeEventListener('touchmove', preventScroll);
            window.removeEventListener('keydown', preventScrollKeys);
            document.body.style.overflow = prevBodyOverflow;
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.body.classList.remove('tour-active');
            document.documentElement.classList.remove('tour-active');
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }

            const tag = event.target?.tagName ? event.target.tagName.toUpperCase() : '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) {
                return; // Let user type and use arrow keys without navigating the tour
            }

            if (event.key === 'ArrowRight' || event.key === 'Enter') {
                event.preventDefault();
                if (step?.isCelebration) {
                    onGoToDashboard?.();
                } else if (!isNextDisabled) {
                    onNext();
                }
            }
            if (event.key === 'ArrowLeft' && !isFirst) { event.preventDefault(); onPrev(); }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, onNext, onPrev, onGoToDashboard, step?.isCelebration, isFirst, isNextDisabled]);

    const position = place(hole, size, step?.side || 'bottom', step, viewport);
    const progress = total > 1 ? ((index + 1) / total) * 100 : 100;

    // Arrow offset along the shared edge — suppressed for centered popups
    const arrowOffset = (() => {
        if (!hole || position.side === 'center' || position.side === 'center-bottom' || step?.isMarketplaceSelect) return null;
        if (position.side === 'bottom' || position.side === 'top') {
            const center = hole.left + hole.width / 2 - position.left;
            return { left: `${Math.min(Math.max(center, 24), Math.max(size.width - 24, 24))}px` };
        }
        const isPlanCard = step?.id?.startsWith('bill-plan-') || hole.height > 280;
        const targetHoleY = isPlanCard ? hole.top + Math.min(80, hole.height / 2) : hole.top + hole.height / 2;
        const center = targetHoleY - position.top;
        return { top: `${Math.min(Math.max(center, 24), Math.max(size.height - 24, 24))}px` };
    })();

    const vh = viewport.height;
    const vw = viewport.width;

    const isCheckoutModalOpen = isCheckoutActivelyOpen(step);

    // Safety guard: if the connect marketplace modal is open in the DOM, never show the marketplace selection card
    const hasConnectModalInDom = typeof document !== 'undefined' && !!document.querySelector('[data-tour-modal="connect-marketplace"]');
    if (step?.isMarketplaceSelect && hasConnectModalInDom) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[9998] pointer-events-none" role="dialog" aria-modal="true" aria-label="Product tour">
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
                    fill={!isCheckoutModalOpen && (hole || !step?.target) ? "rgba(15, 23, 42, 0.65)" : "transparent"}
                    mask="url(#tour-spotlight-mask)"
                    className="transition-all duration-200"
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

            {/* Swallows clicks OUTSIDE the cutout without detached overflow boxes (suppressed for modal targets to keep form inputs fully interactive) */}
            {hole && !isModalTarget && (
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

            {/* During plan exploration steps, absorb clicks on the highlighted plan card to prevent accidental button clicks */}
            {hole && step?.id?.startsWith('bill-plan-') && (
                <div
                    className="absolute pointer-events-auto cursor-default z-[9999]"
                    style={{
                        top: `${hole.top}px`,
                        left: `${hole.left}px`,
                        width: `${hole.width}px`,
                        height: `${hole.height}px`,
                        borderRadius: '16px',
                    }}
                    onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                    }}
                />
            )}

            <div
                ref={popoverRef}
                className={`absolute pointer-events-auto bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.8)] border border-slate-200/90 font-sans animate-tour-pop overflow-y-auto max-h-[calc(100vh-40px)] custom-scrollbar transition-[top,left] duration-150 ease-out ${
                    step?.isBillingIntro || step?.isMarketplaceSelect || step?.isCelebration
                        ? 'w-[580px] max-w-[calc(100vw-32px)]'
                        : (isModalTarget || step?.id?.startsWith('bill-plan-'))
                            ? 'w-[340px] max-w-[calc(100vw-24px)]'
                            : 'w-[420px] max-w-[calc(100vw-32px)]'
                }`}
                style={{
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                    ...(position.maxHeight ? { maxHeight: `${position.maxHeight}px` } : {}),
                }}
            >
                {/* Gradient Accent Bar */}
                <div className={`h-1.5 w-full ${
                    step?.isCelebration
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600'
                        : 'bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600'
                }`} />

                {arrowOffset && !step?.isCelebration && (
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
                                {step?.isCelebration ? (step?.celebration?.badge || 'Connection Success') : step?.isBillingIntro ? 'Billing & Credits Overview' : step?.isMarketplaceSelect ? 'Marketplace Selection' : 'Guided Onboarding'}
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

                    {step?.note && (
                        <div className="mt-3 p-3 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-start gap-2">
                            <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
                            <span className="leading-snug">{step.note}</span>
                        </div>
                    )}

                    {step?.showReadiness && readinessMarketplaceId && (
                        <UploadReadinessChecklist marketplaceId={readinessMarketplaceId} compact />
                    )}

                    {/* ── Marketplace Selection Cards ────────────────────── */}
                    {step?.isMarketplaceSelect && (
                        <div className="mt-4 space-y-2.5">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Supported Marketplace Integrations
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {[
                                    {
                                        id: 'Meesho',
                                        title: 'Meesho',
                                        sub: 'Auto-sync & Size-wise SKU P&L',
                                        badge: 'Recommended for Fashion',
                                        border: 'border-pink-200 hover:border-pink-400 bg-pink-50/40',
                                        accent: 'text-pink-600 bg-pink-100',
                                    },
                                    {
                                        id: 'Amazon India (Seller)',
                                        title: 'Amazon India',
                                        sub: 'Seller Central SP-API & Settlements',
                                        badge: 'FBA & EasyShip Audits',
                                        border: 'border-amber-200 hover:border-amber-400 bg-amber-50/40',
                                        accent: 'text-amber-600 bg-amber-100',
                                    },
                                    {
                                        id: 'Flipkart',
                                        title: 'Flipkart',
                                        sub: 'Seller Hub fees & order reconciliations',
                                        badge: 'Commission Slip Audits',
                                        border: 'border-blue-200 hover:border-blue-400 bg-blue-50/40',
                                        accent: 'text-blue-600 bg-blue-100',
                                    },
                                    {
                                        id: 'Myntra',
                                        title: 'Myntra',
                                        sub: 'Omni-channel catalog & order data',
                                        badge: 'Catalog & Leakage Intelligence',
                                        border: 'border-purple-200 hover:border-purple-400 bg-purple-50/40',
                                        accent: 'text-purple-600 bg-purple-100',
                                    },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            window.dispatchEvent(new CustomEvent('tour:select_marketplace', { detail: { name: item.id } }));
                                        }}
                                        className={`p-3 rounded-2xl border text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-95 cursor-pointer flex flex-col justify-between ${item.border}`}
                                    >
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                            <span className="text-xs font-bold text-slate-800">{item.title}</span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.accent}`}>
                                                {item.badge}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-snug mb-2">
                                            {item.sub}
                                        </p>
                                        <span className="text-[10px] font-extrabold text-brand-600 flex items-center gap-1">
                                            Connect {item.title} ➔
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Meesho: Size-wise calculations helper ──────────── */}
                    {step?.id === 'mp-meesho-sizewise' && (
                        <div className="mt-3.5 p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200/80 space-y-2.5">
                            {/* Live interactive toggle row */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-brand-200/80 shadow-xs">
                                <div className="pr-2">
                                    <h4 className="text-xs font-bold text-slate-800">Size-wise Calculations</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {formState.enableSizeWiseCalculation
                                            ? 'Enabled — calculates P&L separately per SKU size'
                                            : 'Disabled — single size SKU calculation'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextVal = !formState.enableSizeWiseCalculation;
                                        window.dispatchEvent(new CustomEvent('tour:set_sizewise', { detail: { value: nextVal } }));
                                    }}
                                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                                        formState.enableSizeWiseCalculation ? 'bg-brand-600' : 'bg-slate-300'
                                    }`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${
                                        formState.enableSizeWiseCalculation ? 'left-5.5' : 'left-0.5'
                                    }`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between text-xs font-bold text-slate-700 pt-0.5">
                                <span>Do your SKUs have different size variants?</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('tour:set_sizewise', { detail: { value: true } }))}
                                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                                        formState.enableSizeWiseCalculation
                                            ? 'bg-brand-600 text-white ring-2 ring-brand-400'
                                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    <Check size={14} />
                                    Yes, Multi-Size
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('tour:set_sizewise', { detail: { value: false } }))}
                                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                                        !formState.enableSizeWiseCalculation
                                            ? 'bg-slate-700 text-white ring-2 ring-slate-400'
                                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    <X size={14} />
                                    No, Single Size
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Meesho: Auto-Sync helper ──────────────────────── */}
                    {step?.id === 'mp-meesho-autosync' && (
                        <div className="mt-3.5 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2.5">
                            {/* Live interactive toggle row */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-emerald-200/80 shadow-xs">
                                <div className="pr-2">
                                    <h4 className="text-xs font-bold text-slate-800">Auto-Sync (Meesho Sync)</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {formState.showAutoSyncFields
                                            ? 'Enabled — daily orders & returns sync automatically'
                                            : 'Disabled — upload orders manually via Excel'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextVal = !formState.showAutoSyncFields;
                                        window.dispatchEvent(new CustomEvent('tour:set_autosync', { detail: { value: nextVal } }));
                                    }}
                                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                                        formState.showAutoSyncFields ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${
                                        formState.showAutoSyncFields ? 'left-5.5' : 'left-0.5'
                                    }`} />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('tour:set_autosync', { detail: { value: true } }))}
                                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                                        formState.showAutoSyncFields
                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    <RefreshCw size={13} />
                                    Enable Auto-Sync
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('tour:set_autosync', { detail: { value: false } }))}
                                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                                        !formState.showAutoSyncFields
                                            ? 'bg-slate-700 text-white ring-2 ring-slate-400'
                                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    Manual Uploads
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Account Name Helper Notice ─────────────────── */}
                    {(step?.actionType === 'accountName' || step?.id?.includes('account-name')) && (
                        <div className="mt-3.5 p-3 rounded-xl bg-indigo-50 border border-indigo-200/80 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                                <Sparkles size={12} className="text-indigo-600 shrink-0" />
                                <span>Unique Store / Brand Nickname</span>
                            </div>
                            <p className="text-[11px] text-indigo-700 leading-relaxed">
                                Enter your store or brand nickname above (e.g. "My {step?.id?.includes('flipkart') ? 'Flipkart' : step?.id?.includes('amazon') ? 'Amazon' : step?.id?.includes('myntra') ? 'Myntra' : 'Meesho'} Store"). This ensures you can identify and distinguish this connection in multi-account dashboards.
                            </p>
                        </div>
                    )}

                    {/* ── Credentials Security Callout ──────────────────── */}
                    {(step?.id?.includes('credentials') || step?.id?.includes('password') || step?.id === 'mp-credentials') && (
                        <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200/80 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                                <Lock size={12} className="text-amber-600 shrink-0" />
                                <span>Zero-Knowledge Encryption Notice</span>
                            </div>
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                Passwords and credentials are encrypted directly in your browser with RSA-OAEP 2048-bit encryption before transmission and are never stored or logged in plain text.
                            </p>
                        </div>
                    )}

                    {/* ── Action Validation & Guidance Feedback ──────────── */}
                    {actionStatus && (
                        <div className={`mt-3.5 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                            actionStatus.type === 'valid'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : actionStatus.type === 'failed'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                : actionStatus.type === 'invalid'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                            {actionStatus.type === 'valid' ? (
                                <Check size={15} className="text-emerald-600 shrink-0" />
                            ) : actionStatus.type === 'failed' ? (
                                <AlertCircle size={15} className="text-red-600 shrink-0" />
                            ) : actionStatus.type === 'invalid' ? (
                                <AlertCircle size={15} className="text-amber-600 shrink-0" />
                            ) : (
                                <Info size={15} className="text-slate-500 shrink-0 animate-pulse" />
                            )}
                            <span className="leading-snug">{actionStatus.text}</span>
                        </div>
                    )}

                    {actionStatus?.type === 'failed' && step?.failureHelp && (
                        <p className="mt-2 text-xs text-slate-600 leading-relaxed">{step.failureHelp}</p>
                    )}

                    {/* ── Backend Connection Error Feedback on Connect Step ── */}
                    {step?.actionType === 'connect' && formState.errorMessage && (
                        <div className="mt-3.5 p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-700 border border-red-200 flex items-start gap-2 animate-fadeIn">
                            <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <span className="font-bold">Verification failed:</span> {formState.errorMessage}. Please check your credentials in the form and click "Connect Securely" to retry.
                            </div>
                        </div>
                    )}

                    {/* ── Analysis Start Date Callout ───────────────────── */}
                    {(step?.id?.includes('analysis-date') || step?.id === 'mp-analysis-date') && (
                        <div className="mt-3.5 p-3 rounded-xl bg-blue-50 border border-blue-200/80 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                                <Clock size={12} className="text-blue-600 shrink-0" />
                                <span>Analysis Period &amp; Processing Credits</span>
                            </div>
                            <p className="text-[11px] text-blue-700 leading-relaxed">
                                Processing credits will be deducted based on the historical date selected. Calculations and reconciliations will be generated from this month onward.
                            </p>
                        </div>
                    )}

                    {/* ── Celebratory Appreciation Message ──────────────── */}
                    {step?.isCelebration && (
                        <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 text-center space-y-3">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <Sparkles size={28} className="text-emerald-600 animate-bounce" />
                            </div>
                            <div>
                                <h4 className="text-base font-extrabold text-slate-800">
                                    {step.celebration?.heading || 'Marketplace Successfully Connected!'}
                                </h4>
                                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                                    {step.celebration?.text || 'Your store is now linked with SpeedEcom. We have initialized your order, settlement, and return synchronization pipeline for your selected analysis period.'}
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-1">
                                {(step.celebration?.points || ['Order Reconciliation Active', 'SKU Profit Intelligence']).map((point) => (
                                    <div key={point} className="p-2.5 rounded-lg bg-white/80 border border-emerald-100 flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                                        <span>{point}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                        {step?.isCelebration ? (
                            <div className="flex items-center justify-between w-full gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                    {step.celebration?.secondaryLabel || 'Stay on Marketplace'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onGoToDashboard || (() => {
                                        onClose();
                                        window.location.href = '/dashboard';
                                    })}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-md shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>{step.celebration?.primaryLabel || 'Go to Dashboard ➔'}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between w-full gap-2">
                                {!isFirst ? (
                                    <button
                                        type="button"
                                        onClick={onPrev}
                                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-xl px-3.5 py-2 transition-all active:scale-95 cursor-pointer"
                                    >
                                        <ArrowLeft size={14} />
                                        Back
                                    </button>
                                ) : (
                                    <div />
                                )}

                                <div className="flex items-center gap-2 ml-auto">
                                    {step?.actionType === 'connect' ? (
                                        <div className="flex items-center gap-2">
                                            {formState.loading ? (
                                                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold shadow-xs">
                                                    <Loader2 size={14} className="animate-spin text-brand-600 shrink-0" />
                                                    <span>Connecting &amp; Verifying...</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-brand-50 to-indigo-50 border border-brand-200 text-brand-700 text-xs font-bold shadow-xs animate-pulse">
                                                    <Sparkles size={13} className="text-amber-500 shrink-0" />
                                                    <span>Click "Connect Securely" below</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : actionStatus?.type === 'failed' && onRetryAfterFailure ? (
                                        <button
                                            type="button"
                                            onClick={onRetryAfterFailure}
                                            className="flex items-center gap-1.5 text-xs font-extrabold text-white rounded-xl px-4 py-2 shadow-md bg-gradient-to-r from-brand-600 via-brand-700 to-indigo-700 hover:from-brand-500 hover:to-indigo-600 transition-all active:scale-95 cursor-pointer"
                                        >
                                            <RefreshCw size={14} />
                                            <span>Upload a different file</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={isNextDisabled}
                                            onClick={step?.isMarketplaceSelect ? () => {
                                                window.dispatchEvent(new CustomEvent('tour:select_marketplace', { detail: { name: 'Meesho' } }));
                                            } : onNext}
                                            className={`flex items-center gap-1.5 text-xs font-extrabold text-white rounded-xl px-4 py-2 shadow-md transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none ${
                                                isLast && !step?.isMarketplaceSelect
                                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                                                    : 'bg-gradient-to-r from-brand-600 via-brand-700 to-indigo-700 hover:from-brand-500 hover:to-indigo-600 shadow-brand-500/25 hover:scale-[1.02]'
                                            }`}
                                        >
                                            <span>
                                                {isLast && !step?.isMarketplaceSelect
                                                    ? (step?.lastButtonText || 'Finish Tour & Choose Plan ➔')
                                                    : (step?.id === 'mp-meesho-autosync'
                                                        ? (formState.showAutoSyncFields ? 'Next: Password ➔' : 'Next: Connect ➔')
                                                        : (step?.nextButtonText || 'Next'))}
                                            </span>
                                            {(!isLast || step?.isMarketplaceSelect) && !(step?.id === 'mp-meesho-autosync' || step?.nextButtonText?.includes('➔')) && <ArrowRight size={14} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TourSpotlight;