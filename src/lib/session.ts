/**
 * The accounts signed in on this browser. A browser can hold an admin, a
 * hospital and a donor session at the same time (the server keeps one cookie
 * per account type), so each page works with the account for its own area:
 * /admin, /hospital or /donor. Signing in as a donor no longer changes what an
 * open hospital tab is signed in as.
 */
export type Role = 'admin' | 'hospital' | 'donor';
export const ROLES: Role[] = ['admin', 'hospital', 'donor'];

export const DASHBOARD: Record<Role, string> = { donor: '/donor', hospital: '/hospital', admin: '/admin' };
export const ROLE_LABEL: Record<Role, string> = { donor: 'Donor', hospital: 'Hospital', admin: 'Admin' };

const storageKey = (role: Role) => `lifelink.user.${role}`;
const isRole = (value: unknown): value is Role => typeof value === 'string' && (ROLES as string[]).includes(value);

/** The account a page acts as, from its path. */
export const roleForPath = (path: string = typeof window !== 'undefined' ? window.location.pathname : ''): Role | null => {
  const top = path.split('/')[1];
  return isRole(top) ? top : null;
};

export const getUser = (role: Role | null = roleForPath()): any | null => {
  if (!role) return null;
  try {
    const raw = localStorage.getItem(storageKey(role));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveUser = (user: { role: string }) => {
  if (!isRole(user.role)) return;
  try { localStorage.setItem(storageKey(user.role), JSON.stringify(user)); } catch { /* storage unavailable */ }
};

export const forgetUser = (role: Role) => {
  try { localStorage.removeItem(storageKey(role)); } catch { /* storage unavailable */ }
};

const LAST_ROLE_KEY = 'lifelink.lastRole';

/** The dashboard opened most recently, so the app can reopen on it. */
export const rememberLastRole = (role: Role) => {
  try { localStorage.setItem(LAST_ROLE_KEY, role); } catch { /* storage unavailable */ }
};

export const lastRole = (): Role | null => {
  try {
    const role = localStorage.getItem(LAST_ROLE_KEY);
    return isRole(role) ? role : null;
  } catch {
    return null;
  }
};

/** Every account signed in on this browser, in a fixed order. */
export const signedInUsers = (): any[] => ROLES.map((role) => getUser(role)).filter(Boolean);

// Before per-account sessions there was a single "user" entry: move it over once
try {
  const legacy = localStorage.getItem('user');
  if (legacy) {
    const user = JSON.parse(legacy);
    if (isRole(user?.role) && !getUser(user.role)) saveUser(user);
    for (const key of ['user', 'token', 'userRole']) localStorage.removeItem(key);
  }
} catch { /* storage unavailable or corrupt: nothing to migrate */ }
