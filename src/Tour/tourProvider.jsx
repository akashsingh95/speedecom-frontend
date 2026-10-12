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

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { tourSelector } from './targets';
import { TOURS, TENANT_ONBOARDING, BILLING_TOUR } from './steps';
import TourSpotlight from './TourSpotlight';
import WelcomeModal from './WelcomeModal';

const TourContext = createContext(null);

export const useTour = () => useContext(TourContext);

// How long to wait for a step's element before giving up on it. Required steps
// get a long budget because they are worth waiting for (a slow first render of
// the sidebar); optional ones fail fast so skipping is not perceptible.
const WAIT_REQUIRED_MS = 6000;
const WAIT_OPTIONAL_MS = 1200;

/** Mirrors the server record so a failed POST cannot cause a replay loop. */
const localKey = (key) => `tour:${key}`;

const readLocalStatus = (key) => {
    try {
        return localStorage.getItem(localKey(key));
    } catch {
        return null;
    }
};

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

    const [runKey, setRunKey] = useState(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [element, setElement] = useState(null);
    const [records, setRecords] = useState(null); // null = not fetched yet
    const [recordsLoaded, setRecordsLoaded] = useState(false);
    const [actionCompleted, setActionCompleted] = useState(false);
    const [actionMeta, setActionMeta] = useState(null);
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
    const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
        try {
            return localStorage.getItem('tour:welcome_dismissed') === 'true';
        } catch {
            return false;
        }
    });

    const [billingOnboardingActive, setBillingOnboardingActive] = useState(() => {
        try {
            const isCompleted = localStorage.getItem(localKey(TENANT_ONBOARDING)) === 'completed';
            const isActive = localStorage.getItem('tour:billing_onboarding_active') === 'true';
            return !isCompleted && isActive;
        } catch {
            return false;
        }
    });

    const lastLocationPathRef = useRef(location.pathname);

    // Which way the user is moving. A step whose element is missing is skipped
    // in the direction of travel, so Back never lands on the same dead step.
    const directionRef = useRef(1);
    // Cancels an in-flight element wait when the step changes underneath it.
    const waitTokenRef = useRef({ cancelled: false });
    // Tours already auto-started this mount. A Set rather than a boolean because
    // there is now more than one auto-starting tour: finishing onboarding on
    // /dashboard must not stop the marketplace tour from firing later.
    const autoStartedRef = useRef(new Set());
    // Navigation attempts made for the current step. A route guard can bounce us
    // straight back (a User without upload permission is redirected off
    // /uploads), and without this the effect would navigate on every bounce.
    const navAttemptsRef = useRef({ index: -1, count: 0 });
    // Route the last tour ended on. Onboarding now walks through
    // /settings/marketplace, so ending it there would otherwise satisfy the
    // marketplace tour's `requires` and start a second overlay on the spot.
    // Cleared by navigating anywhere else.
    const endedOnRouteRef = useRef(null);

    const run = runKey ? TOURS[runKey] : null;
    const steps = run?.steps || [];
    const step = steps[stepIndex] || null;

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
                    setRecords(fetchedRecords);
                    setRecordsLoaded(true);
                    if (fetchedRecords.some((r) => r.key === TENANT_ONBOARDING && r.status === 'completed')) {
                        setBillingOnboardingActive(false);
                        try {
                            localStorage.removeItem('tour:billing_onboarding_active');
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
    }, [user?._id, isTenantAudience]);

    const persist = useCallback((key, status, lastStep) => {
        try {
            localStorage.setItem(localKey(key), status);
        } catch { /* private mode — the server record still covers it */ }
        setRecords((current) => {
            const others = (current || []).filter((record) => record.key !== key);
            return [...others, { key, status, lastStep }];
        });
        api.post('/tours/state', { key, status, lastStep }, { skipErrorToast: true })
            .catch(() => { /* localStorage already prevents a replay */ });
    }, []);

    // ── Controls ─────────────────────────────────────────────────────────
    const stop = useCallback((status) => {
        const key = runKey;
        const index = stepIndex;
        waitTokenRef.current.cancelled = true;
        endedOnRouteRef.current = location.pathname;
        setRunKey(null);
        setStepIndex(0);
        setElement(null);
        if (key && status !== 'plans_explored') persist(key, status, index);
    }, [runKey, stepIndex, persist, location.pathname]);

    const startTour = useCallback((key = TENANT_ONBOARDING, initialIndex = 0) => {
        if (!TOURS[key]) return;
        directionRef.current = 1;
        navAttemptsRef.current = { index: -1, count: 0 };
        endedOnRouteRef.current = null;
        setStepIndex(initialIndex);
        setElement(null);
        setRunKey(key);

        const targetStep = TOURS[key]?.steps?.[initialIndex] || TOURS[key]?.steps?.[0];
        if (targetStep?.route && location.pathname !== targetStep.route) {
            navigate(`${targetStep.route}${targetStep.search || ''}`);
        }
    }, [location.pathname, navigate]);

    const resetTour = useCallback((key = TENANT_ONBOARDING) => {
        try {
            localStorage.removeItem(localKey(key));
            localStorage.removeItem('tour:action:billing_done');
            localStorage.removeItem('tour:billing_onboarding_active');
            localStorage.removeItem('tour:welcome_dismissed');
        } catch { /* ignore */ }
        setWelcomeDismissed(false);
        setIsWelcomeOpen(false);
        setBillingOnboardingActive(false);
        autoStartedRef.current.delete(key);
        setRecords((current) => (current || []).filter((record) => record.key !== key));
        setActionCompleted(false);
        setActionMeta(null);
        api.post('/tours/reset', { key }, { skipErrorToast: true }).catch(() => {});
        startTour(key);
    }, [startTour]);

    const completeBillingOnboarding = useCallback((meta) => {
        setBillingOnboardingActive(false);
        try {
            localStorage.removeItem('tour:billing_onboarding_active');
        } catch { /* ignore */ }
        persist(TENANT_ONBOARDING, 'completed', 4);
    }, [persist]);

    const goTo = useCallback((nextIndex, direction) => {
        directionRef.current = direction;
        if (nextIndex < 0) return;
        if (nextIndex >= steps.length) {
            if (runKey === TENANT_ONBOARDING || runKey === BILLING_TOUR) {
                // The user has explored all plans!
                // Explicitly exit the guided highlighting phase to completely clear the UI.
                stop('plans_explored');
                setBillingOnboardingActive(true);
                try {
                    localStorage.setItem('tour:billing_onboarding_active', 'true');
                } catch { /* ignore */ }
                return;
            }
            stop('completed');
            return;
        }
        setElement(null);
        setStepIndex(nextIndex);
    }, [steps.length, stop, runKey]);

    const next = useCallback(() => goTo(stepIndex + 1, 1), [goTo, stepIndex]);
    const prev = useCallback(() => goTo(stepIndex - 1, -1), [goTo, stepIndex]);

    // Moves past a step that cannot be shown, in whichever direction the user
    // was travelling. This is the normal path for permission-gated and
    // state-dependent steps, so it is silent.
    const skipUnreachable = useCallback(() => {
        const nextIndex = stepIndex + directionRef.current;
        if (nextIndex < 0) {
            // Ran off the front while going back — turn around rather than end
            // a tour the user is still in.
            directionRef.current = 1;
            setStepIndex(stepIndex + 1);
            return;
        }
        if (nextIndex >= steps.length) {
            stop('completed');
            return;
        }
        setStepIndex(nextIndex);
    }, [stepIndex, steps.length, stop]);

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
            setElement(found);
        });

        return () => { token.cancelled = true; };
    }, [step, stepIndex, location, navigate, skipUnreachable]);

    // ── Auto-start ───────────────────────────────────────────────────────
    // Whether a tour has been seen at all — completed and skipped both count.
    // If the server records are successfully fetched, we use them as authority
    // so clearing user state on the server isn't blocked by stale localStorage.
    const hasSeen = useCallback(
        (key) => {
            if (recordsLoaded) {
                return (records || []).some((record) => record.key === key);
            }
            return !!readLocalStatus(key) || (records || []).some((record) => record.key === key);
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

        // If this is the main onboarding tour and user hasn't seen the welcome screen yet, show it first on dashboard
        if (eligible.key === TENANT_ONBOARDING && !welcomeDismissed && location.pathname === '/dashboard') {
            setIsWelcomeOpen(true);
            return;
        }

        autoStartedRef.current.add(eligible.key);
        startTour(eligible.key);
    }, [records, runKey, user, isTenantAudience, isImpersonating, location.pathname, startTour, hasSeen, welcomeDismissed]);

    const handleStartFromWelcome = useCallback(() => {
        setIsWelcomeOpen(false);
        autoStartedRef.current.add(TENANT_ONBOARDING);
        startTour(TENANT_ONBOARDING);
    }, [startTour]);

    const handleDismissWelcome = useCallback(() => {
        setIsWelcomeOpen(false);
        setWelcomeDismissed(true);
        try {
            localStorage.setItem('tour:welcome_dismissed', 'true');
        } catch { /* ignore */ }
    }, []);

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
                if (actionType) localStorage.setItem(`tour:action:${actionType}_done`, 'true');
            } catch { /* ignore */ }
            if (step.autoAdvance) {
                setTimeout(() => {
                    next();
                }, 1200);
            }
        }
    }, [step, next]);

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
            }
        };
        window.addEventListener('tour:action-completed', handler);
        return () => window.removeEventListener('tour:action-completed', handler);
    }, [step, completeTourAction]);

    const value = {
        isRunning: !!runKey,
        // The sidebar entry point only makes sense for tenant-side users.
        isAvailable: isTenantAudience,
        currentStep: step,
        billingOnboardingActive,
        setBillingOnboardingActive,
        completeBillingOnboarding,
        startHighlightingPlans: () => {
            setBillingOnboardingActive(false);
            const targetIndex = location.pathname === '/subscription' ? 1 : 0;
            startTour(TENANT_ONBOARDING, targetIndex);
        },
        actionCompleted,
        actionMeta,
        completeTourAction,
        bypassTourAction,
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
            {step && (
                <TourSpotlight
                    element={element}
                    step={step}
                    index={stepIndex}
                    total={steps.length}
                    isFirst={stepIndex === 0}
                    isLast={stepIndex === steps.length - 1}
                    actionCompleted={actionCompleted}
                    actionMeta={actionMeta}
                    onCompleteAction={completeTourAction}
                    onBypassAction={bypassTourAction}
                    onNext={next}
                    onPrev={prev}
                    onClose={() => stop('skipped')}
                />
            )}
        </TourContext.Provider>
    );
};

export default TourProvider;