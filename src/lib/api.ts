// Local dev: keep the API on localhost (not 127.0.0.1) so it is the same site as
// the Vite dev server on localhost:3000, otherwise the session cookie is dropped
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (!response.ok) {
            // The 30-minute session expired: send the user back to sign in instead
            // of leaving a dashboard full of "Authentication required" errors.
            if (response.status === 401 && !endpoint.startsWith('/auth/') && localStorage.getItem('user')) {
                localStorage.removeItem('user');
                window.location.assign('/login?expired=1');
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
