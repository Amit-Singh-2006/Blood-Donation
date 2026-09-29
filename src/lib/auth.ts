import { apiFetch } from './api';

const STORED_KEYS = ['user', 'token', 'userRole'];

export const clearStoredSession = () => {
  for (const key of STORED_KEYS) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
  }
};

/**
 * Ends the session on the server (the HttpOnly cookie is only cleared, and
 * the token blacklisted, by /auth/logout) and then forgets the local copy.
 */
export const signOut = async () => {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Already signed out or offline: clearing the local copy is still right
  }
  clearStoredSession();
};
