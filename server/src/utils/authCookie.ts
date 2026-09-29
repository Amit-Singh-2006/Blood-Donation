import { CookieOptions } from 'express';

/**
 * Options for the HttpOnly auth cookie. In production the frontend and API
 * are served from different sites (two *.vercel.app subdomains), so the cookie
 * must be SameSite=None; Secure or the browser will not send it on API calls.
 * CSRF is still covered by strictCorsGuard and csrfOriginCheck. Clearing the
 * cookie must use the same attributes, otherwise the browser ignores it.
 */
export const authCookieOptions = (): CookieOptions => {
    const production = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: production,
        sameSite: production ? 'none' : 'lax',
        path: '/',
    };
};
