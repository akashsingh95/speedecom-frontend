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
import { TOURS, TENANT_ONBOARDING } from './steps';
import TourSpotlight from './TourSpotlight';

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

    const isTenantAudience = !!user && (
        ['Admin', 'User'].includes(user.role) || isImpersonating
    );

    // ── Persistence ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!user || !isTenantAudience) {
            setRecords([]);
            return;
        }
        let active = true;
        api.get('/tours/state', { skipErrorToast: true })
            .then((res) => { if (active) setRecords(res.data?.tours || []); })
            // An unreachable endpoint counts as "nothing recorded yet", so a
            // first-time user still gets onboarded through an API blip. The
            // localStorage mirror is what stops a finished tour from replaying
            // while the API is down.
            .catch(() => { if (active) setRecords([]); });
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
        if (key) persist(key, status, index);
    }, [runKey, stepIndex, persist, location.pathname]);

    const startTour = useCallback((key = TENANT_ONBOARDING) => {
        if (!TOURS[key]) return;
        directionRef.current = 1;
        setStepIndex(0);
        setElement(null);
        setRunKey(key);
    }, []);

    const goTo = useCallback((nextIndex, direction) => {
        directionRef.current = direction;
        if (nextIndex < 0) return;
        if (nextIndex >= steps.length) {
            stop('completed');
            return;
        }
        setElement(null);
        setStepIndex(nextIndex);
    }, [steps.length, stop]);

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
            found.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            setElement(found);
        });

        return () => { token.cancelled = true; };
    }, [step, stepIndex, location, navigate, skipUnreachable]);

    // ── Auto-start ───────────────────────────────────────────────────────
    // Whether a tour has been seen at all — completed and skipped both count.
    // Reading localStorage as well as the server record is what keeps a tour
    // from replaying while the state endpoint is unreachable.
    const hasSeen = useCallback(
        (key) => !!readLocalStatus(key) || (records || []).some((record) => record.key === key),
        [records],
    );

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
        autoStartedRef.current.add(eligible.key);
        startTour(eligible.key);
    }, [records, runKey, user, isTenantAudience, isImpersonating, location.pathname, startTour, hasSeen]);

    // Signing out mid-tour must not leave the overlay on the login screen.
    useEffect(() => {
        if (!user && runKey) {
            waitTokenRef.current.cancelled = true;
            setRunKey(null);
            setStepIndex(0);
            setElement(null);
        }
    }, [user, runKey]);

    const value = {
        isRunning: !!runKey,
        // The sidebar entry point only makes sense for tenant-side users.
        isAvailable: isTenantAudience,
        startTour,
        stopTour: () => stop('skipped'),
        restartTour: () => startTour(TENANT_ONBOARDING),
    };

    return (
        <TourContext.Provider value={value}>
            {children}
            {step && (
                <TourSpotlight
                    element={element}
                    step={step}
                    index={stepIndex}
                    total={steps.length}
                    isFirst={stepIndex === 0}
                    isLast={stepIndex === steps.length - 1}
                    onNext={next}
                    onPrev={prev}
                    onClose={() => stop('skipped')}
                />
            )}
        </TourContext.Provider>
    );
};

export default TourProvider;