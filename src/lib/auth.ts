import { apiFetch } from './api';
import { ROLES, Role, forgetUser, roleForPath } from './session';

/**
 * Ends one account's session on the server (the HttpOnly cookie is only
 * cleared, and the token blacklisted, by /auth/logout) and forgets the local
 * copy. Other accounts signed in on this browser stay signed in. With no
 * role (outside a dashboard), every account is signed out.
 */
export const signOut = async (role: Role | null = roleForPath()) => {
  try {
    await apiFetch('/auth/logout', { method: 'POST', headers: role ? { 'X-LifeLink-Role': role } : {} });
  } catch {
    // Already signed out or offline: clearing the local copy is still right
  }
  for (const r of role ? [role] : ROLES) forgetUser(r);
};
