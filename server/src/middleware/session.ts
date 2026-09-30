import { Request } from 'express';
import { LEGACY_SESSION_COOKIE, SESSION_ROLES, SessionRole, isSessionRole, sessionCookieName } from '../utils/authCookie';

/**
 * Which of the browser's accounts a request acts as: the X-LifeLink-Role
 * header the dashboards send, or else the route itself (/admin, /hospital,
 * /donor). Works at app level (full path) and inside routers (baseUrl).
 */
export const requestedRole = (req: Request): SessionRole | null => {
    const header = req.header('x-lifelink-role');
    if (isSessionRole(header)) return header;
    const top = (req.baseUrl || req.path || '').split('/')[1];
    return isSessionRole(top) ? top : null;
};

/**
 * The session token for this request. With a role, only that role's cookie
 * counts. Without one, the browser's only session is used (and none if it
 * holds several, rather than guess). Falls back to the old single cookie and
 * to a Bearer token for API clients.
 */
export const sessionToken = (req: Request): string | undefined => {
    const cookies: Record<string, string | undefined> = req.cookies ?? {};
    const bearer = req.header('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const role = requestedRole(req);
    if (role) return cookies[sessionCookieName(role)] ?? bearer;
    const present = SESSION_ROLES.map((r) => cookies[sessionCookieName(r)]).filter(Boolean);
    if (present.length === 1) return present[0];
    return present.length ? undefined : cookies[LEGACY_SESSION_COOKIE] ?? bearer;
};
