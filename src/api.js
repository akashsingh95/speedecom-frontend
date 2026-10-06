import axios from 'axios';
import forge from 'node-forge';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    const impersonated = localStorage.getItem('impersonatedTenant');
    if (impersonated) {
        try {
            const tenant = JSON.parse(impersonated);
            config.params = { ...config.params, tenantId: tenant._id };
        } catch (e) {
            console.error('Failed to parse impersonated tenant from localStorage', e);
        }
    }

    // Safety net: if any code path passes a full tenantId object as a query param,
    // normalize it to just the _id string before Axios serializes it into the URL.
    // If no _id can be extracted, drop the param entirely so we never serialize
    // "[object Object]" (or an ambiguous undefined) into the URL.
    if (config.params?.tenantId && typeof config.params.tenantId === 'object') {
        const tenantIdStr = config.params.tenantId._id?.toString();
        config.params = { ...config.params, tenantId: tenantIdStr };
        if (!tenantIdStr) delete config.params.tenantId;
    }

    return config;
});

// Global Error Handler
import { toast } from 'sonner';

const STATUS_MESSAGES = {
    400: 'Invalid request. Please check your input.',
    401: 'Session expired. Please log in again.',
    403: 'You don\'t have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'This record already exists.',
    429: 'Too many requests. Please slow down and try again.',
    500: 'Something went wrong on our end. Please try again.',
    502: 'Server is temporarily unreachable. Please try again.',
    503: 'Service temporarily unavailable. Please try again shortly.',
};

api.interceptors.response.use(
    (response) => {
        const { data } = response;
        // Automatically unwrap { success: true, data: ... } if present (Compatibility Layer)
        if (!response.config?.skipUnwrap && data && typeof data === 'object' && 'success' in data && 'data' in data) {
            // Preserve other metadata dynamically
            Object.keys(data).forEach(key => {
                if (key !== 'data' && key !== 'success' && !(key in response)) {
                    response[key] = data[key];
                }
            });
            response.data = data.data;
        }
        return response;
    },
    (error) => {
        // Use friendly message from backend if available, otherwise map by HTTP status
        const backendMessage = error.response?.data?.message || error.response?.data?.error;
        const status = error.response?.status;

        let message;
        if (backendMessage) {
            message = backendMessage;
        } else if (!error.response) {
            message = 'No internet connection. Please check your network.';
        } else {
            message = STATUS_MESSAGES[status] || 'Something went wrong. Please try again.';
        }

        // If session is unauthorized (401) or account is deactivated/suspended/expired (403), force logout immediately
        // Skip this for requests where a 401 means "you typed the wrong password for this
        // specific action", not "your session is invalid" — those forms should show the
        // error inline instead of logging the user out of the whole app.
        const isAuthPublicRequest = error.config?.url?.includes('/auth/login') ||
            error.config?.url?.includes('/auth/forgot-password') ||
            error.config?.url?.includes('/auth/reset-password') ||
            error.config?.url?.includes('/auth/change-password') ||
            error.config?.url?.includes('/marketplaces/verify-account-password') ||
            error.config?.url?.includes('/marketplaces/verify') ||
            // A 401 here means the stored MEESHO password was rejected (or Akamai blocked the login) — a third-party credential problem, not the user's own app session being invalid.
            error.config?.url?.includes('/meesho-sync/trigger') ||
            error.config?.url?.includes('/meesho-sync/check-credentials');

        if (!isAuthPublicRequest) {
            if (status === 401 || (status === 403 && (
                backendMessage?.toLowerCase().includes('deactivated') ||
                backendMessage?.toLowerCase().includes('expired') ||
                backendMessage?.toLowerCase().includes('suspended')
            ))) {
                toast.error(message);
                localStorage.clear();
                window.location.href = '/client/login';
                return Promise.reject(error);
            }
        }

        // Some callers poll for a resource that legitimately may not exist yet
        // (e.g. a research job right after it's kicked off) and already handle
        // the rejection themselves — they opt out of the global toast via this flag.
        if (!error.config?.skipErrorToast) {
            toast.error(message);
        }
        return Promise.reject(error);
    }
);

let publicKey = null;

export const fetchPublicKey = async () => {
    if (publicKey) return publicKey;
    try {
        const res = await api.get('/auth/public-key');
        publicKey = res.data.publicKey;
        if (!publicKey && res.data.data && res.data.data.publicKey) {
            publicKey = res.data.data.publicKey;
        }
        return publicKey;
    } catch (error) {
        console.error('Failed to fetch public key', error);
        return null;
    }
};

export const encryptPassword = async (password) => {
    const keyPem = await fetchPublicKey();
    if (!keyPem) throw new Error('Public key not available');

    const pki = forge.pki;
    const publicKey = pki.publicKeyFromPem(keyPem);
    const encrypted = publicKey.encrypt(password, 'RSA-OAEP');
    return forge.util.encode64(encrypted);
};

export default api;
