// ─────────────────────────────────────────────────────────
//  The tour runner.
//
//  Owns the step index and everything awkward about pointing at
//  a live React app: navigating to the page a step lives on,
//  waiting for the element to mount, skipping steps whose element
//  never appears (permissions, empty states, collapsed panels),
//  and remembering that the user is done.
//
//  Mounted once, above the routes — not inside DashboardLayout,
//  which remounts on every navigation and would tear the tour
//  down halfway through.
// ─────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { TOUR, tourSelector } from './targets';
import { TOURS, TENANT_ONBOARDING, BILLING_TOUR, MARKETPLACE_SETTINGS, UPLOAD_ONBOARDING, getMarketplaceTourKey } from './steps';
import TourSpotlight from './TourSpotlight';
import WelcomeModal from './WelcomeModal';

const TourContext = createContext(null);

export const useTour = () => useContext(TourContext);

// How long to wait for a step's element before giving up on it. Required steps
// get a long budget because they are worth waiting for (a slow first render of
// the sidebar); optional ones fail fast so skipping is not perceptible.
const WAIT_REQUIRED_MS = 6000;
const WAIT_OPTIONAL_MS = 1200;

/** Scopes localStorage keys per user to guarantee zero cross-account state bleed. */
export const getTourKey = (key, userId) => (userId ? `tour:${userId}:${key}` : `tour:${key}`);

/** Resolves once the element is in the DOM and laid out, or null on timeout. */
const waitForElement = (selector, timeout, token) => new Promise((resolve) => {
    const started = performance.now();
    const attempt = () => {
        if (token.cancelled) return resolve(null);
        const element = document.querySelector(selector);
        // A zero-size box means it is present but collapsed or still animating
        // in — highlighting it would spotlight nothing.
        if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return resolve(element);
        }
        if (performance.now() - started >= timeout) return resolve(null);
        requestAnimationFrame(attempt);
        return undefined;
    };
    attempt();
});

/** True when the URL already satisfies the step's route and query requirement. */
const isOnStepLocation = (step, location) => {
    if (step.route && location.pathname !== step.route) return false;
    if (!step.search) return true;
    const wanted = new URLSearchParams(step.search);
    const current = new URLSearchParams(location.search);
    return [...wanted.entries()].every(([key, value]) => current.get(key) === value);
};

export const TourProvider = ({ children }) => {
    const { user, isImpersonating } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const localKey = useCallback((key) => getTourKey(key, user?._id), [user?._id]);

    const readLocalStatus = useCallback((key) => {
        try {
            return localStorage.getItem(localKey(key));
        } catch {
            return null;
        }
    }, [localKey]);

    // Which way the user is moving. A step whose element is missing is skipped
    // in the direction of travel, so Back never lands on the same dead step.
    const directionRef = useRef(1);
    // Cancels an in-flight element wait when the step changes underneath it.
    const waitTokenRef = useRef({ cancelled: false });
    // Tours already auto-started this mount. A Set rather than a boolean because
    // there is now more than one auto-starting tour: finishing onboarding on
    // /dashboard must not stop the marketplace tour from firing later.
    const autoStartedRef = useRef(new Set());
    // Tracks in-flight and persisted tour events to prevent redundant network calls and loops
    const persistedStateRef = useRef(new Map());
    // Navigation attempts made for the current step. A route guard can bounce us
    // straight back (a User without upload permission is redirected off
    // /uploads), and without this the effect would navigate on every bounce.
    const navAttemptsRef = useRef({ index: -1, count: 0 });
    // Route the last tour ended on. Onboarding now walks through
    // /settings/marketplace, so ending it there would otherwise satisfy the
    // marketplace tour's `requires` and start a second overlay on the spot.
    // Cleared by navigating anywhere else.
    const endedOnRouteRef = useRef(null);
    const lastLocationPathRef = useRef(location.pathname);
    // Actions reported before their step is on screen (a fast upload can finish
    // while the previous step is still auto-advancing).
    const pendingActionsRef = useRef(new Map());

    const [runKey, setRunKey] = useState(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [element, setElement] = useState(null);
    const [records, setRecords] = useState(null); // null = not fetched yet
    const [recordsLoaded, setRecordsLoaded] = useState(false);
    const [actionCompleted, setActionCompleted] = useState(false);
    const [actionMeta, setActionMeta] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [suspended, setSuspended] = useState(false);
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
    const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
        try {
            return user?._id ? localStorage.getItem(getTourKey('welcome_dismissed', user._id)) === 'true' : false;
        } catch {
            return false;
        }
    });

    const [billingOnboardingActive, setBillingOnboardingActive] = useState(() => {
        try {
            if (!user?._id) return false;
            const isCompleted = localStorage.getItem(getTourKey(TENANT_ONBOARDING, user._id)) === 'completed';
            const isActive = localStorage.getItem(getTourKey('billing_onboarding_active', user._id)) === 'true';
            return !isCompleted && isActive;
        } catch {
            return false;
        }
    });

    const [selectedMarketplace, setSelectedMarketplace] = useState(() => {
        try {
            return (user?._id && localStorage.getItem(getTourKey('selected_marketplace', user._id))) || 'Meesho';
        } catch {
            return 'Meesho';
        }
    });

    const handleSetSelectedMarketplace = useCallback((name) => {
        if (!name) return;
        setSelectedMarketplace(name);
        try {
            localStorage.setItem(localKey('selected_marketplace'), name);
        } catch { /* ignore */ }
    }, [localKey]);

    // Reset and re-sync all tour state and caches whenever active user changes
    useEffect(() => {
        autoStartedRef.current.clear();
        persistedStateRef.current.clear();
        endedOnRouteRef.current = null;
        setRunKey(null);
        setStepIndex(0);
        setElement(null);
        try {
            if (user?._id) {
                setWelcomeDismissed(localStorage.getItem(localKey('welcome_dismissed')) === 'true');
                const isCompleted = localStorage.getItem(localKey(TENANT_ONBOARDING)) === 'completed';
                const isActive = localStorage.getItem(localKey('billing_onboarding_active')) === 'true';
                setBillingOnboardingActive(!isCompleted && isActive);
                const savedMp = localStorage.getItem(localKey('selected_marketplace'));
                if (savedMp) setSelectedMarketplace(savedMp);
            } else {
                setWelcomeDismissed(false);
                setBillingOnboardingActive(false);
                setSelectedMarketplace('Meesho');
            }
        } catch {
            setWelcomeDismissed(false);
            setBillingOnboardingActive(false);
            setSelectedMarketplace('Meesho');
        }
    }, [user?._id, localKey]);

    useEffect(() => {
        const handler = (e) => {
            if (e.detail?.name) {
                handleSetSelectedMarketplace(e.detail.name);
            }
        };
        window.addEventListener('tour:select_marketplace', handler);
        return () => window.removeEventListener('tour:select_marketplace', handler);
    }, [handleSetSelectedMarketplace]);

    const isStepApplicable = useCallback((s, mp) => {
        if (!s) return false;
        // If Meesho password step is requested but password field is not in DOM (auto-sync is disabled), skip it
        if (s.id === 'mp-meesho-password') {
            return !!document.querySelector(tourSelector(TOUR.marketplace.modalPassword));
        }
        if (!s.forMarketplaces || s.forMarketplaces.length === 0) return true;
        if (!mp) return true;
        const norm = mp.toLowerCase();
        return s.forMarketplaces.some((m) => norm.includes(m.toLowerCase()));
    }, []);

    const run = runKey ? TOURS[runKey] : null;
    const steps = run?.steps || [];
    const rawStep = steps[stepIndex] || null;
    const step = useMemo(() => {
        if (!rawStep?.byMarketplace) return rawStep;
        const norm = (selectedMarketplace || '').toLowerCase();
        const slug = Object.keys(rawStep.byMarketplace).find((key) => norm.includes(key));
        return slug ? { ...rawStep, ...rawStep.byMarketplace[slug] } : rawStep;
    }, [rawStep, selectedMarketplace]);

    // Reset or evaluate action status whenever current step changes
    useEffect(() => {
        if (!step) {
            setActionCompleted(false);
            return;
        }
        if (!step.requiresAction) {
            setActionCompleted(true);
            return;
        }
        // Action requires real completion during this tour session
        setActionCompleted(false);
        setActionError(null);
    }, [step?.id, step?.requiresAction]);

    const isTenantAudience = !!user && (
        ['Admin', 'User'].includes(user.role) || isImpersonating
    );

    // ── Persistence ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!user || !isTenantAudience) {
            setRecords([]);
            setRecordsLoaded(false);
            return;
        }
        let active = true;
        api.get('/tours/state', { skipErrorToast: true })
            .then((res) => {
                if (active) {
                    const fetchedRecords = res.data?.tours || [];
                    fetchedRecords.forEach((r) => {
                        persistedStateRef.current.set(r.key, `${r.key}:${r.status}:${r.lastStep}`);
                    });
                    setRecords(fetchedRecords);
                    setRecordsLoaded(true);
                    if (fetchedRecords.some((r) => r.key === TENANT_ONBOARDING && r.status === 'completed')) {
                        setBillingOnboardingActive(false);
                        try {
                            localStorage.removeItem(localKey('billing_onboarding_active'));
                        } catch { /* ignore */ }
                    }
                }
            })
            // An unreachable endpoint counts as "nothing recorded yet", so a
            // first-time user still gets onboarded through an API blip. The
            // localStorage mirror is what stops a finished tour from replaying
            // while the API is down.
            .catch(() => {
                if (active) {
                    setRecords([]);
                    setRecordsLoaded(false);
                }
            });
        return () => { active = false; };
    }, [user?._id, isTenantAudience, localKey]);

    const persist = useCallback((key, status, lastStep) => {
        if (!key) return;
        try {
            localStorage.setItem(localKey(key), status);
        } catch { /* private mode — the server record still covers it */ }

        // Deduplicate in state: avoid creating new array reference if record didn't change
        setRecords((current) => {
            if (!current) return current;
            const existing = current.find((record) => record.key === key);
            if (existing && existing.status === status && existing.lastStep === lastStep) {
                return current;
            }
            const others = current.filter((record) => record.key !== key);
            return [...others, { key, status, lastStep }];
        });

        // Deduplicate network requests: skip POST if already persisted with this exact state
        const payloadKey = `${key}:${status}:${lastStep}`;
        if (persistedStateRef.current.get(key) === payloadKey) {
            return;
        }
        persistedStateRef.current.set(key, payloadKey);

        api.post('/tours/state', { key, status, lastStep }, { skipErrorToast: true })
            .catch(() => { /* localStorage already prevents a replay */ });
    }, [localKey]);

    // ── Controls ─────────────────────────────────────────────────────────
    const stop = useCallback((status = 'skipped') => {
        const key = runKey;
        const index = stepIndex;
        waitTokenRef.current.cancelled = true;
        endedOnRouteRef.current = location.pathname;

        setRunKey(null);
        setStepIndex(0);
        setElement(null);
        setBillingOnboardingActive(false);

        try {
            localStorage.removeItem(localKey('billing_onboarding_active'));
            localStorage.removeItem(localKey('active_marketplace_tour'));
            if (key) {
                localStorage.setItem(localKey(key), status);
            }
            if (key?.startsWith('mp-onboarding-')) {
                const mpSlug = key.replace('mp-onboarding-', '');
                localStorage.setItem(localKey(`marketplace_onboarded:${mpSlug}`), status);
            }
        } catch { /* ignore */ }

        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.classList.remove('tour-active');
            document.documentElement.classList.remove('tour-active');
        }

        if (key && status !== 'plans_explored') {
            persist(key, status, index);
        }

        window.dispatchEvent(new CustomEvent('tour:stopped', { detail: { key, status } }));
    }, [runKey, stepIndex, persist, location.pathname, localKey]);

    const startTour = useCallback((key = TENANT_ONBOARDING, initialIndex = 0) => {
        if (!TOURS[key]) return;
        waitTokenRef.current.cancelled = true;
        directionRef.current = 1;
        navAttemptsRef.current = { index: -1, count: 0 };
        endedOnRouteRef.current = null;
        pendingActionsRef.current.clear();
        if (runKey === TENANT_ONBOARDING && key !== TENANT_ONBOARDING) {
            persist(TENANT_ONBOARDING, 'completed', 5);
        }
        setActionCompleted(false);
        setActionMeta(null);
        setStepIndex(initialIndex);
        setElement(null);
        setRunKey(key);

        const targetStep = TOURS[key]?.steps?.[initialIndex] || TOURS[key]?.steps?.[0];
        if (targetStep?.route && location.pathname !== targetStep.route) {
            navigate(`${targetStep.route}${targetStep.search || ''}`);
        }
    }, [location.pathname, navigate, runKey, persist]);

    const resetTour = useCallback((key = TENANT_ONBOARDING) => {
        try {
            localStorage.removeItem(localKey(key));
            localStorage.removeItem(localKey('action:billing_done'));
            localStorage.removeItem(localKey('billing_done'));
            localStorage.removeItem(localKey('billing_onboarding_completed'));
            localStorage.removeItem(localKey('billing_onboarding_active'));
            localStorage.removeItem(localKey('welcome_dismissed'));
            localStorage.removeItem(localKey('selected_marketplace'));
            localStorage.removeItem(localKey('marketplace_connected'));
            localStorage.removeItem(localKey('active_marketplace_tour'));
            ['meesho', 'amazon', 'flipkart', 'myntra'].forEach((mp) => {
                localStorage.removeItem(localKey(`marketplace_onboarded:${mp}`));
            });
            // Legacy unscoped cleanup
            localStorage.removeItem(`tour:${key}`);
            localStorage.removeItem('tour:billing_done');
            localStorage.removeItem('tour:billing_onboarding_completed');
            localStorage.removeItem('tour:billing_onboarding_active');
            localStorage.removeItem('tour:welcome_dismissed');
            localStorage.removeItem('tour:selected_marketplace');
            localStorage.removeItem('tour:marketplace_connected');
            localStorage.removeItem('tour:active_marketplace_tour');
        } catch { /* ignore */ }
        setWelcomeDismissed(false);
        setIsWelcomeOpen(false);
        setBillingOnboardingActive(false);
        setSelectedMarketplace('Meesho');
        autoStartedRef.current.delete(key);
        persistedStateRef.current.delete(key);
        persistedStateRef.current.delete('billing_onboarding');
        setRecords((current) => (current || []).filter((record) => record.key !== key));
        setActionCompleted(false);
        setActionMeta(null);
        api.post('/tours/reset', { key }, { skipErrorToast: true }).catch(() => {});
        api.post('/tours/reset', { key: 'billing_onboarding' }, { skipErrorToast: true }).catch(() => {});
        startTour(key);
    }, [startTour, localKey]);

    const completeBillingOnboarding = useCallback((meta) => {
        setBillingOnboardingActive(false);
        try {
            localStorage.removeItem(localKey('billing_onboarding_active'));
            localStorage.setItem(localKey('billing_done'), 'true');
            localStorage.setItem(localKey('billing_onboarding_completed'), 'true');
        } catch { /* ignore */ }
        persist('billing_onboarding', 'completed', 1);
        persist(TENANT_ONBOARDING, 'in_progress', 5);
        startTour(TENANT_ONBOARDING, 5);
    }, [persist, startTour, localKey]);

    const onMarketplaceConnected = useCallback((connectedName) => {
        const norm = (connectedName || '').toLowerCase();
        const mpSlug = norm.includes('meesho') ? 'meesho'
            : norm.includes('amazon') ? 'amazon'
            : norm.includes('flipkart') ? 'flipkart'
            : norm.includes('myntra') ? 'myntra' : norm;

        try {
            if (mpSlug) {
                localStorage.setItem(localKey(`marketplace_onboarded:${mpSlug}`), 'completed');
            }
            localStorage.setItem(localKey('marketplace_connected'), 'true');
            localStorage.removeItem(localKey('active_marketplace_tour'));
        } catch { /* ignore */ }

        const tourKey = getMarketplaceTourKey(connectedName) || runKey;
        if (tourKey) {
            persist(tourKey, 'completed', 99);
        }
        persist(TENANT_ONBOARDING, 'completed', 5);

        const tourDef = tourKey ? TOURS[tourKey] : null;
        const targetSteps = tourDef?.steps || steps;
        const congratsIdx = targetSteps.findIndex(
            (s) => s.isCelebration || s.id?.includes('congratulations')
        );

        if (congratsIdx >= 0 && tourKey) {
            setRunKey(tourKey);
            setStepIndex(congratsIdx);
            setElement(null);
        }
    }, [persist, runKey, steps, localKey]);

    // Keep stepIndex updated in active_marketplace_tour so refreshes restore the exact step
    useEffect(() => {
        if (runKey && runKey.startsWith('mp-onboarding-')) {
            try {
                const raw = localStorage.getItem(localKey('active_marketplace_tour'));
                const parsed = raw ? JSON.parse(raw) : {};
                localStorage.setItem(localKey('active_marketplace_tour'), JSON.stringify({
                    ...parsed,
                    key: runKey,
                    stepIndex,
                }));
            } catch { /* ignore */ }
        }
    }, [runKey, stepIndex, localKey]);

    const goTo = useCallback((nextIndex, direction) => {
        directionRef.current = direction;
        if (nextIndex < 0) return;

        // When leaving plan exploration on step 4, pause tour to allow plan interaction and purchase
        if (stepIndex === 4 && runKey === TENANT_ONBOARDING && direction === 1) {
            stop('plans_explored');
            setBillingOnboardingActive(true);
            try {
                localStorage.setItem(localKey('billing_onboarding_active'), 'true');
            } catch { /* ignore */ }
            return;
        }

        let targetIndex = nextIndex;
        while (
            targetIndex >= 0 &&
            targetIndex < steps.length &&
            !isStepApplicable(steps[targetIndex], selectedMarketplace)
        ) {
            targetIndex += direction;
        }

        if (targetIndex >= steps.length) {
            stop('completed');
            return;
        }
        if (targetIndex < 0) return;

        setElement(null);
        setStepIndex(targetIndex);
    }, [stepIndex, runKey, steps, isStepApplicable, selectedMarketplace, stop]);

    const next = useCallback(() => goTo(stepIndex + 1, 1), [goTo, stepIndex]);
    const prev = useCallback(() => {
        const backIndex = step?.backTo ? steps.findIndex((s) => s.id === step.backTo) : -1;
        goTo(backIndex >= 0 ? backIndex : stepIndex - 1, -1);
    }, [goTo, stepIndex, step, steps]);

    const retryAfterFailure = useCallback(() => {
        window.dispatchEvent(new CustomEvent('tour:upload_reset'));
        prev();
    }, [prev]);

    // Moves past a step that cannot be shown, in whichever direction the user
    // was travelling. This is the normal path for permission-gated and
    // state-dependent steps, so it is silent.
    const skipUnreachable = useCallback(() => {
        let nextIndex = stepIndex + directionRef.current;
        while (
            nextIndex >= 0 &&
            nextIndex < steps.length &&
            !isStepApplicable(steps[nextIndex], selectedMarketplace)
        ) {
            nextIndex += directionRef.current;
        }
        if (nextIndex < 0) {
            directionRef.current = 1;
            setStepIndex(stepIndex + 1);
            return;
        }
        if (nextIndex >= steps.length) {
            stop('completed');
            return;
        }
        setStepIndex(nextIndex);
    }, [stepIndex, steps, isStepApplicable, selectedMarketplace, stop]);

    // ── Step resolution ──────────────────────────────────────────────────
    // Runs on every step change and every navigation: get to the right URL,
    // then find the element or move past the step.
    useEffect(() => {
        if (!step) return undefined;

        if (!isOnStepLocation(step, location)) {
            const attempts = navAttemptsRef.current;
            if (attempts.index !== stepIndex) {
                navAttemptsRef.current = { index: stepIndex, count: 0 };
            }
            // Two tries, then treat the page as unreachable. A route guard that
            // redirects us away would otherwise bounce navigation forever.
            if (navAttemptsRef.current.count >= 2) {
                skipUnreachable();
                return undefined;
            }
            navAttemptsRef.current.count += 1;
            navigate(`${step.route || location.pathname}${step.search || ''}`);
            return undefined;
        }

        const token = { cancelled: false };
        waitTokenRef.current = token;

        if (!step.target) {
            setElement(null);
            return () => { token.cancelled = true; };
        }

        waitForElement(
            tourSelector(step.target),
            step.required ? WAIT_REQUIRED_MS : WAIT_OPTIONAL_MS,
            token,
        ).then((found) => {
            if (token.cancelled) return;
            if (!found) {
                skipUnreachable();
                return;
            }
            const isModal = !!(
                step?.modalSelector ||
                found.closest('[role="dialog"], .fixed') ||
                step?.target?.startsWith?.('marketplace.modal') ||
                (step?.id?.startsWith?.('mp-') && !step?.isMarketplaceSelect && !step?.isCelebration)
            );

            if (isModal) {
                // When targeting an element inside a modal dialog, keep modal stable
                // and only adjust scroll if the field is actually outside the viewport.
                const modalScrollContainer = found.closest('.overflow-y-auto, .overflow-auto');
                if (modalScrollContainer) {
                    const cRect = modalScrollContainer.getBoundingClientRect();
                    const fRect = found.getBoundingClientRect();
                    if (fRect.top < cRect.top || fRect.bottom > cRect.bottom) {
                        found.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            } else {
                const rect = found.getBoundingClientRect();
                // Ensure clearance for sticky page headers (e.g. Subscription header is ~80px)
                const HEADER_CLEARANCE = 85;
                const BOTTOM_CLEARANCE = 24;
                const isComfortable = rect.top >= HEADER_CLEARANCE && rect.bottom <= (window.innerHeight - BOTTOM_CLEARANCE);
                if (!isComfortable) {
                    const scrollContainer = found.closest('.overflow-y-auto, .overflow-auto, main');
                    if (scrollContainer) {
                        const containerRect = scrollContainer.getBoundingClientRect();
                        const relativeTop = rect.top - containerRect.top + scrollContainer.scrollTop;
                        // Position element top cleanly with 16px breathing room below header
                        scrollContainer.scrollTo({
                            top: Math.max(0, relativeTop - 16),
                            behavior: 'auto'
                        });
                    } else {
                        found.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
                    }
                }
            }
            setElement(found);
        });

        return () => { token.cancelled = true; };
    }, [step, stepIndex, location, navigate, skipUnreachable]);

    // Re-verify and refresh target element when window regains focus, visibility changes, or resizes
    useEffect(() => {
        const handleRefresh = () => {
            if (document.visibilityState === 'visible' && step?.target) {
                const sel = tourSelector(step.target);
                if (sel) {
                    const el = document.querySelector(sel);
                    if (el && el.isConnected) {
                        const r = el.getBoundingClientRect();
                        if (r.width > 0 && r.height > 0) {
                            setElement(el);
                        }
                    }
                }
            }
        };

        window.addEventListener('focus', handleRefresh);
        window.addEventListener('resize', handleRefresh);
        window.addEventListener('pageshow', handleRefresh);
        document.addEventListener('visibilitychange', handleRefresh);

        return () => {
            window.removeEventListener('focus', handleRefresh);
            window.removeEventListener('resize', handleRefresh);
            window.removeEventListener('pageshow', handleRefresh);
            document.removeEventListener('visibilitychange', handleRefresh);
        };
    }, [step]);

    // ── Auto-start ───────────────────────────────────────────────────────
    // Whether a tour has been seen at all — completed and skipped both count.
    // If the server records are successfully fetched, we use them as authority
    // so clearing user state on the server isn't blocked by stale localStorage.
    const isTourFinished = (status) => status === 'completed' || status === 'skipped';

    const hasSeen = useCallback(
        (key) => {
            if (recordsLoaded) {
                return (records || []).some((record) => record.key === key && isTourFinished(record.status));
            }
            const local = readLocalStatus(key);
            return isTourFinished(local) || (records || []).some((record) => record.key === key && isTourFinished(record.status));
        },
        [records, recordsLoaded],
    );

    // Auto-trigger on query param (?tour=start or ?tour=reset or ?tour=tenant-onboarding)
    useEffect(() => {
        if (!user || !isTenantAudience) return;
        const searchParams = new URLSearchParams(location.search);
        const tourParam = searchParams.get('tour');
        if (tourParam === 'reset' || tourParam === 'start' || tourParam === 'trigger' || tourParam === TENANT_ONBOARDING) {
            searchParams.delete('tour');
            const cleanSearch = searchParams.toString();
            navigate({ pathname: location.pathname, search: cleanSearch ? `?${cleanSearch}` : '' }, { replace: true });
            resetTour(TENANT_ONBOARDING);
        }
    }, [location.search, location.pathname, user, isTenantAudience, navigate, resetTour]);

    // Expose convenient global helpers for developer testing and manual re-triggering
    useEffect(() => {
        window.__speedecom_restart_tour = () => resetTour(TENANT_ONBOARDING);
        window.__speedecom_start_tour = () => startTour(TENANT_ONBOARDING);
        return () => {
            delete window.__speedecom_restart_tour;
            delete window.__speedecom_start_tour;
        };
    }, [resetTour, startTour]);

    useEffect(() => {
        if (runKey || records === null) return;
        if (!user || !isTenantAudience) return;
        // An impersonating admin is looking at someone else's data, and writing
        // completion would record it against the wrong user.
        if (isImpersonating) return;
        // Give the page back to the user after a tour ends here; another tour may
        // start once they navigate somewhere else.
        if (endedOnRouteRef.current === location.pathname) return;

        const eligible = Object.values(TOURS).find(({ key, autoStart }) => {
            if (!autoStart) return false;                                    // launcher-only
            if (autoStartedRef.current.has(key)) return false;
            if (!autoStart.roles.includes(user.role)) return false;
            if (!autoStart.routes.includes(location.pathname)) return false;
            if (hasSeen(key)) return false;
            // A page tour waits its turn behind the tour it depends on.
            if (autoStart.requires && !hasSeen(autoStart.requires)) return false;
            return true;
        });

        if (!eligible) return;

        // ── Main Tenant Onboarding Tour ──
        if (eligible.key === TENANT_ONBOARDING) {
            autoStartedRef.current.add(eligible.key);

            const isBillingDone = (() => {
                try {
                    return localStorage.getItem(localKey('billing_done')) === 'true' ||
                        localStorage.getItem(localKey('billing_onboarding_completed')) === 'true';
                } catch {
                    return false;
                }
            })();
            const isMarketplaceConnected = (() => {
                try {
                    return localStorage.getItem(localKey('marketplace_connected')) === 'true';
                } catch {
                    return false;
                }
            })();

            // If user has already finished both billing and marketplace setup, onboarding is done
            if (isBillingDone && isMarketplaceConnected) {
                persist(TENANT_ONBOARDING, 'completed', 5);
                return;
            }

            // If this is the main onboarding tour and user hasn't seen the welcome screen yet, show it first on dashboard
            if (!welcomeDismissed && location.pathname === '/dashboard') {
                setIsWelcomeOpen(true);
                return;
            }

            const onboardingRecord = (records || []).find((r) => r.key === TENANT_ONBOARDING);
            if (location.pathname === '/settings/marketplace' || isBillingDone) {
                const resumeStep = Math.max(5, onboardingRecord?.lastStep || 5);
                startTour(eligible.key, resumeStep);
            } else {
                startTour(eligible.key, onboardingRecord?.lastStep || 0);
            }
            return;
        }

        // ── Other Auto-Starting Tours (e.g. MARKETPLACE_SETTINGS) ──
        // Do not auto-start if user is actively in a marketplace connection modal or has an active onboarding tour
        if (typeof document !== 'undefined' && document.querySelector('[data-tour-modal="connect-marketplace"]')) {
            return;
        }
        try {
            if (localStorage.getItem(localKey('active_marketplace_tour'))) {
                return;
            }
        } catch { /* ignore */ }

        // If user already connected a marketplace, skip the generic marketplace-settings tour
        if (eligible.key === MARKETPLACE_SETTINGS) {
            autoStartedRef.current.add(eligible.key);
            const isMpConnected = (() => {
                try {
                    return localStorage.getItem(localKey('marketplace_connected')) === 'true';
                } catch {
                    return false;
                }
            })();
            if (isMpConnected) {
                persist(eligible.key, 'completed', 0);
                return;
            }
            startTour(eligible.key);
            return;
        }

        autoStartedRef.current.add(eligible.key);
        startTour(eligible.key);
    }, [records, runKey, user, isTenantAudience, isImpersonating, location.pathname, startTour, hasSeen, welcomeDismissed, persist, localKey]);

    const handleStartFromWelcome = useCallback(() => {
        setIsWelcomeOpen(false);
        autoStartedRef.current.add(TENANT_ONBOARDING);
        startTour(TENANT_ONBOARDING);
    }, [startTour]);

    const handleDismissWelcome = useCallback(() => {
        setIsWelcomeOpen(false);
        setWelcomeDismissed(true);
        try {
            localStorage.setItem(localKey('welcome_dismissed'), 'true');
        } catch { /* ignore */ }
        stop('skipped');
        // stop() has no run to record here (the welcome modal opens before the
        // tour starts), so persist the dismissal or it returns on other devices.
        persist(TENANT_ONBOARDING, 'skipped', 0);
    }, [stop, persist, localKey]);

    // Signing out mid-tour must not leave the overlay on the login screen.
    useEffect(() => {
        if (!user && runKey) {
            waitTokenRef.current.cancelled = true;
            setRunKey(null);
            setStepIndex(0);
            setElement(null);
        }
    }, [user, runKey]);

    const completeTourAction = useCallback((actionType, meta) => {
        if (!step) return;
        if (!step.actionType || step.actionType === actionType) {
            setActionCompleted(true);
            if (meta) setActionMeta(meta);
            try {
                if (actionType) localStorage.setItem(localKey(`action:${actionType}_done`), 'true');
            } catch { /* ignore */ }
            if (step.autoAdvance) {
                setTimeout(() => {
                    next();
                }, step.autoAdvanceDelay ?? 1200);
            }
        }
    }, [step, next, localKey]);

    // Auto-advance forward ONLY if user was on /dashboard and actively navigated forward to /subscription
    useEffect(() => {
        const fromPath = lastLocationPathRef.current;
        const currentPath = location.pathname;
        lastLocationPathRef.current = currentPath;

        if (
            runKey === TENANT_ONBOARDING &&
            step?.id === 'nav-billing' &&
            fromPath === '/dashboard' &&
            currentPath === '/subscription' &&
            directionRef.current >= 0
        ) {
            directionRef.current = 1;
            next();
        }
    }, [runKey, step?.id, location.pathname, next]);

    const bypassTourAction = useCallback(() => {
        if (step?.requiresAction) {
            const demoMeta = step.actionType === 'billing'
                ? {
                    bypassed: true,
                    planName: 'Value Plus (Demo)',
                    credits: 10000,
                    paymentId: `pay_demo_${Date.now().toString(36)}`,
                }
                : { bypassed: true };
            completeTourAction(step.actionType || 'custom', demoMeta);
        }
    }, [step, completeTourAction]);

    useEffect(() => {
        const handler = (e) => {
            const { action, meta } = e.detail || {};
            if (step && (!step.actionType || step.actionType === action)) {
                completeTourAction(action, meta);
            } else if (runKey && action) {
                pendingActionsRef.current.set(action, meta);
            }
        };
        window.addEventListener('tour:action-completed', handler);
        return () => window.removeEventListener('tour:action-completed', handler);
    }, [step, runKey, completeTourAction]);

    useEffect(() => {
        const pending = pendingActionsRef.current;
        if (step?.requiresAction && step.actionType && pending.has(step.actionType)) {
            const meta = pending.get(step.actionType);
            pending.delete(step.actionType);
            completeTourAction(step.actionType, meta);
        }
    }, [step, completeTourAction]);

    useEffect(() => {
        const handler = (e) => {
            const { action, message } = e.detail || {};
            if (step?.requiresAction && step.actionType === action) {
                setActionError(message ? { message } : null);
            }
        };
        window.addEventListener('tour:action-failed', handler);
        return () => window.removeEventListener('tour:action-failed', handler);
    }, [step]);

    // A page modal that needs the user's full attention hides the overlay
    // instead of stacking under it.
    useEffect(() => {
        const suspend = () => setSuspended(true);
        const resume = () => setSuspended(false);
        window.addEventListener('tour:suspend', suspend);
        window.addEventListener('tour:resume', resume);
        return () => {
            window.removeEventListener('tour:suspend', suspend);
            window.removeEventListener('tour:resume', resume);
        };
    }, []);

    useEffect(() => {
        if (!runKey) setSuspended(false);
    }, [runKey]);

    // Cancelling the upload confirmation sends the user back to pick another file.
    useEffect(() => {
        const handler = () => {
            if (runKey === UPLOAD_ONBOARDING && step?.id === 'up-confirm') {
                goTo(stepIndex - 1, -1);
            }
        };
        window.addEventListener('tour:upload_cancelled', handler);
        return () => window.removeEventListener('tour:upload_cancelled', handler);
    }, [runKey, step?.id, stepIndex, goTo]);

    const applicableSteps = steps.filter((s) => isStepApplicable(s, selectedMarketplace));
    const currentApplicableIndex = applicableSteps.findIndex((s) => s.id === step?.id);
    const displayIndex = currentApplicableIndex >= 0 ? currentApplicableIndex : stepIndex;
    const displayTotal = applicableSteps.length > 0 ? applicableSteps.length : steps.length;

    const value = {
        isRunning: !!runKey,
        runKey,
        // The sidebar entry point only makes sense for tenant-side users.
        isAvailable: isTenantAudience,
        currentStep: step,
        billingOnboardingActive,
        setBillingOnboardingActive,
        completeBillingOnboarding,
        onMarketplaceConnected,
        selectedMarketplace,
        setSelectedMarketplace: handleSetSelectedMarketplace,
        startHighlightingPlans: () => {
            setBillingOnboardingActive(false);
            const targetIndex = location.pathname === '/subscription' ? 1 : 0;
            startTour(TENANT_ONBOARDING, targetIndex);
        },
        actionCompleted,
        actionMeta,
        completeTourAction,
        records,
        recordsLoaded,
        hasSeen,
        localKey,
        hasSeenBillingOnboarding: (
            hasSeen('billing_onboarding') ||
            hasSeen('billing') ||
            (records || []).some((r) => (r.key === 'billing_onboarding' || r.key === 'billing') && (r.status === 'completed' || r.status === 'skipped')) ||
            readLocalStatus('billing_onboarding') === 'completed' ||
            readLocalStatus('billing_done') === 'true' ||
            readLocalStatus('billing_onboarding_completed') === 'true'
        ),
        startTour,
        stopTour: () => stop('skipped'),
        restartTour: () => resetTour(TENANT_ONBOARDING),
        resetTour,
        openWelcomeModal: () => setIsWelcomeOpen(true),
    };

    return (
        <TourContext.Provider value={value}>
            {children}
            <WelcomeModal
                isOpen={isWelcomeOpen}
                onStartTour={handleStartFromWelcome}
                onDismiss={handleDismissWelcome}
            />
            {step && !suspended && (
                <TourSpotlight
                    element={element}
                    step={step}
                    index={displayIndex}
                    total={displayTotal}
                    isFirst={displayIndex === 0}
                    isLast={displayIndex === displayTotal - 1 || step?.isCelebration}
                    actionCompleted={actionCompleted}
                    actionMeta={actionMeta}
                    actionError={actionError}
                    onRetryAfterFailure={retryAfterFailure}
                    onCompleteAction={completeTourAction}
                    onBypassAction={bypassTourAction}
                    onNext={next}
                    onPrev={prev}
                    onClose={() => stop(step?.isCelebration ? 'completed' : 'skipped')}
                    onGoToDashboard={() => {
                        const nextTour = step?.celebration?.nextTour;
                        stop('completed');
                        if (nextTour) {
                            startTour(nextTour);
                        } else {
                            navigate('/dashboard');
                        }
                    }}
                />
            )}
        </TourContext.Provider>
    );
};

export default TourProvider;