import { Role, forgetUser, getUser, roleForPath, saveUser } from './session';

// Local dev: keep the API on localhost (not 127.0.0.1) so it is the same site as
// the Vite dev server on localhost:3000, otherwise the session cookie is dropped
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const pendingRefresh = new Map<string, Promise<any[] | null | undefined>>();

/**
 * Renews the 30-minute session from "keep me signed in". Resolves to the
 * signed-in accounts (and saves them), null once that sign-in has ended, or
 * undefined when LifeLink could not be reached, so being offline never signs
 * anyone out. Without a role it checks every account kept on this device.
 * Parallel calls share one request.
 */
export const refreshSession = (role?: Role): Promise<any[] | null | undefined> => {
    const key = role ?? 'all';
    let pending = pendingRefresh.get(key);
    if (!pending) {
        pending = fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(role ? { 'X-LifeLink-Role': role } : {}) },
        })
            .then(async (response) => {
                if (response.status === 401) return null;
                if (!response.ok) return undefined;
                const { users } = await response.json();
                (users as any[]).forEach(saveUser);
                return users as any[];
            })
            .catch(() => undefined)
            .finally(() => pendingRefresh.delete(key));
        pendingRefresh.set(key, pending);
    }
    return pending;
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}, retried = false): Promise<any> => {
    // Tell the server which of this browser's accounts the page acts as, so a
    // hospital tab keeps using the hospital session while a donor is signed in too
    const role = roleForPath();
    const headers = {
        'Content-Type': 'application/json',
        ...(role ? { 'X-LifeLink-Role': role } : {}),
        ...options.headers,
    };
    // A page can also act as an account by naming it (a signed-in donor on a campaign page)
    const actingAs = ((headers as Record<string, string>)['X-LifeLink-Role'] as Role | undefined) ?? null;

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (!response.ok) {
            if (response.status === 401 && !endpoint.startsWith('/auth/') && actingAs) {
                // The 30-minute session ran out: renew it from "keep me signed in", then try again
                if (!retried) {
                    const users = await refreshSession(actingAs);
                    if (users?.length) return apiFetch(endpoint, options, true);
                    if (users === undefined) throw new Error('Could not reach LifeLink. Check your connection and try again.');
                }
                // That sign-in has ended: send the user back to sign in instead of
                // leaving a dashboard full of "Authentication required" errors
                if (role === actingAs && getUser(role)) {
                    forgetUser(role);
                    window.location.assign(`/login?expired=1&as=${role}`);
                }
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API error: ${response.status}`);
        }

        return response.json();
    } catch (err: any) {
        console.error(`Fetch error at ${API_BASE_URL}${endpoint}:`, err);
        throw err;
    }
};
