import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { encryptPassword } from './api';
import { clearCampaignStarted } from './components/listingStudio/lastCampaign';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedTenant, setImpersonatedTenant] = useState(null);
    // True from the moment startImpersonating flips isImpersonating until the /auth/profile
    // refetch below resolves. isImpersonating/impersonatedTenant must stay synchronous (callers
    // navigate immediately after calling startImpersonating, and TenantOnly's guard depends on
    // isImpersonating being true by then) — this flag instead lets consumers like
    // ListingStudioGuard defer their decision until listingStudioEnabled has actually been
    // refreshed for the impersonated tenant, instead of racing on the outgoing user's stale value.
    const [impersonationSyncing, setImpersonationSyncing] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const storedImpersonated = localStorage.getItem('impersonatedTenant');

        let parsedUser = null;

        if (token && storedUser) {
            try {
                parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
            } catch (e) {
                console.error('Failed to parse stored user', e);
                localStorage.removeItem('user');
            }
        }

        if (storedImpersonated && ['SuperAdmin', 'SBM', 'RM'].includes(parsedUser?.role)) {
            try {
                setImpersonatedTenant(JSON.parse(storedImpersonated));
                setIsImpersonating(true);
            } catch (e) {
                console.error('Failed to parse impersonated tenant', e);
                localStorage.removeItem('impersonatedTenant');
            }
        } else if (storedImpersonated) {
            localStorage.removeItem('impersonatedTenant');
        }

        // Refresh profile from backend to pick up latest permissions (e.g. updated by SuperAdmin)
        if (token && parsedUser) {
            api.get('/auth/profile')
                .then((res) => {
                    const fresh = res.data;
                    // When impersonating, the /auth/profile endpoint returns the tenant's profile
                    // (because the interceptor appends ?tenantId=). We must NOT overwrite the
                    // real admin's role/tenantId/permissions with the impersonated tenant's data.
                    const isCurrentlyImpersonating = !!storedImpersonated;
                    const refreshed = {
                        ...parsedUser,
                        // When impersonating, the interceptor appends ?tenantId= to all requests,
                        // so /auth/profile returns the tenant's data (their name, email, role etc.).
                        // We must NOT overwrite any of the real admin's fields in that case.
                        fullName: isCurrentlyImpersonating ? parsedUser.fullName : (fresh.fullName ?? parsedUser.fullName),
                        email: isCurrentlyImpersonating ? parsedUser.email : (fresh.email ?? parsedUser.email),
                        role: isCurrentlyImpersonating ? parsedUser.role : (fresh.role ?? parsedUser.role),
                        tenantId: (() => {
                            if (isCurrentlyImpersonating) return parsedUser.tenantId;
                            // /auth/profile may populate tenantId as a full object — always normalize
                            // both the fresh and the stored value to an _id string, never an object.
                            const normalize = (v) => (v && typeof v === 'object') ? v._id?.toString() : v;
                            return normalize(fresh.tenantId) ?? normalize(parsedUser.tenantId);
                        })(),
                        assignedTenantIds: isCurrentlyImpersonating ? parsedUser.assignedTenantIds : (fresh.assignedTenantIds ?? parsedUser.assignedTenantIds ?? []),
                        userType: isCurrentlyImpersonating ? parsedUser.userType : (fresh.userType ?? parsedUser.userType),
                        permissions: isCurrentlyImpersonating ? parsedUser.permissions : (fresh.permissions ?? parsedUser.permissions ?? {}),
                        profilePicture: isCurrentlyImpersonating ? (fresh.profilePicture ?? '') : (fresh.profilePicture ?? parsedUser.profilePicture ?? ''),
                        // When impersonating, /auth/profile returns the impersonated tenant's data,
                        // so its listingStudioEnabled is exactly what we want to show for that tenant.
                        listingStudioEnabled: isCurrentlyImpersonating ? fresh.listingStudioEnabled : (fresh.listingStudioEnabled ?? parsedUser.listingStudioEnabled),
                    };
                    localStorage.setItem('user', JSON.stringify(refreshed));
                    setUser(refreshed);
                })
                .catch(() => { /* silently ignore — stale cache is still usable */ })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }

        // Silently verify session and refresh permissions when tab becomes visible or window gains focus.
        // The api.js interceptor handles 403 (deactivated/expired) → force logout.
        let silentCheckTimer = null;
        const silentCheck = () => {
            if (!localStorage.getItem('token')) return;
            const isCurrentlyImpersonating = !!localStorage.getItem('impersonatedTenant');
            // Don't refresh permissions while impersonating (profile returns tenant data)
            if (isCurrentlyImpersonating) {
                // Still verify session is valid
                api.get('/auth/profile').catch(() => {});
                return;
            }
            // Debounce: visibility + focus can fire together — only run once per 2s
            clearTimeout(silentCheckTimer);
            silentCheckTimer = setTimeout(() => {
                api.get('/auth/profile')
                    .then((res) => {
                        const fresh = res.data;
                        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                        // Only update if permissions actually changed
                        const currentPerms = JSON.stringify(currentUser.permissions || {});
                        const freshPerms = JSON.stringify(fresh.permissions || {});                        if (currentPerms !== freshPerms
                            || currentUser.fullName !== fresh.fullName
                            || currentUser.listingStudioEnabled !== fresh.listingStudioEnabled) {
                            const refreshed = {
                                ...currentUser,
                                fullName: fresh.fullName ?? currentUser.fullName,
                                email: fresh.email ?? currentUser.email,
                                role: fresh.role ?? currentUser.role,
                                permissions: fresh.permissions ?? currentUser.permissions ?? {},
                                listingStudioEnabled: fresh.listingStudioEnabled ?? currentUser.listingStudioEnabled,
                            };
                            localStorage.setItem('user', JSON.stringify(refreshed));
                            setUser(refreshed);
                        }
                    })
                    .catch(() => {});
            }, 200);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') silentCheck();
        };
        const handleFocus = () => silentCheck();
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);

        // Periodic permission refresh every 60s while tab is active
        const permInterval = setInterval(() => {
            if (document.visibilityState === 'visible') silentCheck();
        }, 60000);

        const interval = setInterval(silentCheck, 5 * 60 * 1000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleFocus);
            clearInterval(permInterval);
            clearInterval(interval);
            if (silentCheckTimer) clearTimeout(silentCheckTimer);
        };
    }, []);

    const login = async (email, password) => {
        try {
            const encryptedPassword = await encryptPassword(password);
            const res = await api.post('/auth/login', { email, password: encryptedPassword });

            localStorage.setItem('token', res.data.token);

            // Store minimal user info
            const userData = {
                _id: res.data._id,
                fullName: res.data.fullName,
                email: res.data.email,
                role: res.data.role,
                tenantId: res.data.tenantId,
                assignedTenantIds: res.data.assignedTenantIds || [],
                userType: res.data.userType,
                permissions: res.data.permissions || {},
                profilePicture: res.data.profilePicture || '',
                listingStudioEnabled: res.data.listingStudioEnabled,
            };

            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.removeItem('impersonatedTenant');
            setUser(userData);
            setIsImpersonating(false);
            setImpersonatedTenant(null);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed'
            };
        }
    };

    const signupTenant = async (fullName, email, password, tenantName, mobileNumber, gstDetails, additionalDetails) => {
        try {
            const encryptedPassword = await encryptPassword(password);
            await api.post('/auth/signup-admin', {
                fullName,
                email,
                password: encryptedPassword,
                tenantName,
                mobileNumber,
                gstDetails,
                perDayOrder: additionalDetails?.perDayOrder || 0,
                numberOfAccount: additionalDetails?.numberOfAccount || 0,
                salesPersonName: additionalDetails?.salesPersonName || '',
                platform: additionalDetails?.platform || '',
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Signup failed'
            };
        }
    };

    const createTenantUser = async (fullName, email, password) => {
        try {
            const encryptedPassword = await encryptPassword(password);
            await api.post('/auth/create-user', {
                fullName,
                email,
                password: encryptedPassword
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'User creation failed'
            };
        }
    };

    const logout = () => {
        clearCampaignStarted();
        const removeStorageItems = (items) => {
            items.forEach(item => localStorage.removeItem(item));
        };

        removeStorageItems([
            'uploads_activeTab',
            'uploads_type',
            'uploads_marketplaceId',
            'uploadsStartDate',
            'uploadsEndDate',
            'uploadHist_marketplace',
            'uploadHist_account',
            'uploadHist_type',
            'uploadHist_status',
            'upload_speech_muted',
            'upload_speech_lang',
            'token',
            'user',
            'impersonatedTenant',
            'dashboardSelectedMarketplaces',
            'speedyAgentFilters'
        ]);
        setUser(null);
        setIsImpersonating(false);
        setImpersonatedTenant(null);
    };

    const startImpersonating = (tenant) => {
        localStorage.setItem('impersonatedTenant', JSON.stringify(tenant));
        setImpersonatedTenant(tenant);
        setIsImpersonating(true);
        setImpersonationSyncing(true);

        // Fetch tenant admin's profile to sync profilePicture and Speedy Listing access
        api.get('/auth/profile').then(res => {
            const fresh = res.data;
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const updated = { ...currentUser, profilePicture: fresh.profilePicture || '', listingStudioEnabled: fresh.listingStudioEnabled };
            localStorage.setItem('user', JSON.stringify(updated));
            setUser(updated);
        }).catch(() => {}).finally(() => setImpersonationSyncing(false));
    };

    const stopImpersonating = () => {
        localStorage.removeItem('impersonatedTenant');
        setImpersonatedTenant(null);
        setIsImpersonating(false);

        // Restore admin's own profilePicture and Speedy Listing access
        api.get('/auth/profile').then(res => {
            const fresh = res.data;
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const updated = { ...currentUser, profilePicture: fresh.profilePicture || '', listingStudioEnabled: fresh.listingStudioEnabled };
            localStorage.setItem('user', JSON.stringify(updated));
            setUser(updated);
        }).catch(() => {});
    };

    const updateUserInContext = (updatedData) => {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const updatedUser = { ...currentUser, ...updatedData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ 
            user, login, signupTenant, createTenantUser, logout, loading, updateUserInContext,
            isImpersonating, impersonatedTenant, startImpersonating, stopImpersonating, impersonationSyncing
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
