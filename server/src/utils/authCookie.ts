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
