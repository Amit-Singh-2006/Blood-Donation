import { CookieOptions } from 'express';

/**
 * Options for the HttpOnly auth cookie. In production the frontend and API
 * are served from different sites (two *.vercel.app subdomains), so the cookie
 * must be SameSite=None; Secure or the browser will not send it on API calls.
 * It is also Partitioned (CHIPS): browsers that block third-party cookies
 * (Safari, Brave, Firefox strict, Chrome incognito) still keep a cookie that is
 * only ever sent from the LifeLink site, instead of dropping it and signing the
 * user out right after they sign in. CSRF is still covered by strictCorsGuard
 * and csrfOriginCheck. Clearing the cookie must use the same attributes,
 * otherwise the browser ignores it.
 */
export const authCookieOptions = (): CookieOptions => {
    const production = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: production,
        sameSite: production ? 'none' : 'lax',
        ...(production ? { partitioned: true } : {}),
        path: '/',
    };
};

/**
 * One browser can be signed in as an admin, a hospital and a donor at the same
 * time: each account type has its own session cookie. Before, a single cookie
 * meant registering a donor in one tab silently turned the hospital tab's
 * session into the donor's ("Access denied: insufficient permissions").
 */
export const SESSION_ROLES = ['admin', 'hospital', 'donor'] as const;
export type SessionRole = typeof SESSION_ROLES[number];

export const isSessionRole = (value: unknown): value is SessionRole =>
    typeof value === 'string' && (SESSION_ROLES as readonly string[]).includes(value);

export const sessionCookieName = (role: SessionRole) => `ll_${role}`;

/** The cookie that held the one-per-browser session before per-role cookies. */
export const LEGACY_SESSION_COOKIE = 'token';
