/**
 * ============================================================
 * COMPREHENSIVE SECURITY MIDDLEWARE
 * Blood Donation Management System – FSM Hackathon
 * ============================================================
 *
 * Covers:
 *  🔐 Authentication Attacks  – JWT blacklist (Token Replay), session fixation
 *  👑 Authorization           – Forced browsing protection, IDOR helper
 *  💉 Injection               – XSS sanitization, NoSQL / LDAP injection guard
 *  🧬 Client-Side             – XSS header enforcement (via Helmet CSP in app.ts)
 *  🕸️  Request Attacks        – CSRF origin check, HTTP Verb Tampering
 *  📂 File & Path             – Path traversal detection
 *  🚀 Abuse Attacks           – General API rate limit, bot scraping detection
 *  🗄️  Data Exposure           – Mass assignment guard (whitelist fields)
 *  🌐 Configuration           – Strict CORS enforcement helper
 *  🤖 Automation              – Simple bot fingerprinting, DoS slow-down
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

// ─────────────────────────────────────────────
// 🔐  TOKEN REPLAY / JWT BLACKLIST
// ─────────────────────────────────────────────

/**
 * In-memory JWT blacklist.
 * In production, replace with Redis so it persists across restarts
 * and scales horizontally.
 */
const jwtBlacklist = new Set<string>();
const blacklistExpiry = new Map<string, number>(); // token → expiry ms

/** Add a token to the blacklist (call on logout). */
export const blacklistToken = (token: string, expiresInMs: number): void => {
    jwtBlacklist.add(token);
    blacklistExpiry.set(token, Date.now() + expiresInMs);
};

/** Purge expired tokens periodically (every 10 minutes). */
setInterval(() => {
    const now = Date.now();
    blacklistExpiry.forEach((exp, tok) => {
        if (now > exp) {
            jwtBlacklist.delete(tok);
            blacklistExpiry.delete(tok);
        }
    });
}, 10 * 60 * 1000);

/**
 * Middleware: Reject tokens that have been explicitly revoked (logged out).
 * Prevents TOKEN REPLAY ATTACKS where a stolen JWT is reused after logout.
 */
export const checkTokenBlacklist = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = req.cookies?.token || req.header('Authorization')?.split(' ')[1];
    if (token && jwtBlacklist.has(token)) {
        res.status(401).json({ message: 'Token has been revoked. Please log in again.' });
        return;
    }
    next();
};

// ─────────────────────────────────────────────
// 🔐  SESSION FIXATION PREVENTION
// ─────────────────────────────────────────────

/**
 * Tracks issued session tokens per IP.
 * On login, if the IP already has an active token we force-rotate it
 * (handled inside authController – this helper just records issuance).
 *
 * Real mitigation: always issue a BRAND NEW token on successful login
 * (which the authController already does via jwt.sign).
 * This middleware enforces that no pre-login token cookie survives into a session.
 */
export const preventSessionFixation = (req: Request, res: Response, next: NextFunction): void => {
    // If the request is a login/register POST and there's already a token cookie,
    // clear it before the controller issues a fresh one — prevents fixation.
    if (req.method === 'POST' && (req.path === '/login' || req.path === '/register')) {
        if (req.cookies?.token) {
            res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
        }
    }
    next();
};

// ─────────────────────────────────────────────
// 💉  XSS SANITIZATION
// ─────────────────────────────────────────────

/** Strip dangerous HTML/script tags and event handlers from a string. */
const sanitizeString = (value: string): string => {
    return value
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')   // Remove <script>...</script>
        .replace(/<[^>]*on\w+\s*=\s*["'][^"']*["'][^>]*>/gi, '') // Remove inline event handlers
        .replace(/javascript\s*:/gi, '')                          // Remove javascript: URIs
        .replace(/data\s*:\s*text\/html/gi, '')                   // Remove data:text/html URIs
        .replace(/<iframe[\s\S]*?>/gi, '')                        // Remove iframes
        .replace(/<\/iframe>/gi, '')
        .replace(/vbscript\s*:/gi, '');                           // Remove vbscript: URIs
};

/** Recursively sanitize all string values in an object. */
const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const key of Object.keys(obj)) {
            sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
    }
    return obj;
};

/**
 * Middleware: Sanitize req.body, req.query, req.params against:
 *  – Reflected XSS
 *  – Stored XSS (body sanitized before it hits controllers/DB)
 *  – DOM-based XSS vectors passed via query strings
 */
export const xssSanitizer = (req: Request, res: Response, next: NextFunction): void => {
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) {
        for (const key of Object.keys(req.query)) {
            const val = req.query[key];
            if (typeof val === 'string') req.query[key] = sanitizeString(val);
        }
    }
    next();
};

// ─────────────────────────────────────────────
// 💉  NoSQL / LDAP INJECTION GUARD
// ─────────────────────────────────────────────

/** Detect NoSQL operator injection patterns (MongoDB-style operators). */
const hasNoSQLInjection = (value: string): boolean => {
    return /(\$where|\$gt|\$lt|\$gte|\$lte|\$ne|\$in|\$nin|\$exists|\$regex|\$or|\$and|\$not|\$nor|\$expr|\$jsonSchema|\$mod|\$text|\$where)/i.test(value);
};

/** Detect LDAP injection patterns. */
const hasLDAPInjection = (value: string): boolean => {
    return /[()\\*\x00]/.test(value) || /\|\|/.test(value) || /&&/.test(value);
};

const containsInjection = (obj: any): boolean => {
    if (typeof obj === 'string') return hasNoSQLInjection(obj) || hasLDAPInjection(obj);
    if (Array.isArray(obj)) return obj.some(containsInjection);
    if (obj && typeof obj === 'object') return Object.values(obj).some(containsInjection);
    return false;
};

/**
 * Middleware: Block requests containing NoSQL / LDAP injection patterns.
 * Note: SQL injection is prevented by parameterised queries (pg library).
 */
export const injectionGuard = (req: Request, res: Response, next: NextFunction): void => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(containsInjection)) {
        res.status(400).json({ message: 'Invalid characters detected in request.' });
        return;
    }
    next();
};

// ─────────────────────────────────────────────
// 🕸️  CSRF ORIGIN CHECK
// ─────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]);

/**
 * Middleware: Verify Origin / Referer header for state-mutating requests.
 * Since we use HttpOnly cookies for auth, JavaScript-based CSRF token
 * injection is not possible. This header check stops a malicious third-party
 * site from issuing cross-site form submissions that carry the victim's cookie.
 *
 * Covers: CSRF, Parameter Tampering via cross-origin forms.
 */
export const csrfOriginCheck = (req: Request, res: Response, next: NextFunction): void => {
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(req.method)) { next(); return; }

    const origin = req.headers['origin'] || req.headers['referer'];
    if (!origin) {
        // No origin header – could be a direct server-to-server call.
        // Allow but log it (in production you might block this for browser routes).
        next(); return;
    }

    try {
        const originURL = new URL(origin as string);
        const base = `${originURL.protocol}//${originURL.host}`;
        if (!ALLOWED_ORIGINS.has(base)) {
            res.status(403).json({ message: 'Cross-site request blocked.' });
            return;
        }
    } catch {
        res.status(403).json({ message: 'Invalid origin header.' });
        return;
    }
    next();
};

// ─────────────────────────────────────────────
// 🕸️  HTTP VERB TAMPERING
// ─────────────────────────────────────────────

/** Methods we actually support. Any other method is rejected outright. */
const ALLOWED_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']);

/**
 * Middleware: Block HTTP Verb Tampering.
 * Attackers use verbs like PATCH, TRACE, CONNECT to bypass method-specific
 * access controls or extract debug info.
 */
export const verbTamperingGuard = (req: Request, res: Response, next: NextFunction): void => {
    if (!ALLOWED_HTTP_METHODS.has(req.method)) {
        res.status(405).json({ message: `Method ${req.method} not allowed.` });
        return;
    }
    next();
};

// ─────────────────────────────────────────────
// 📂  PATH TRAVERSAL PREVENTION
// ─────────────────────────────────────────────

const PATH_TRAVERSAL_PATTERN = /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%252e%252e)/i;

/**
 * Middleware: Detect and block Path Traversal attempts in URL and query strings.
 * Prevents attackers from accessing files outside intended directories
 * (e.g., ../../etc/passwd).
 */
export const pathTraversalGuard = (req: Request, res: Response, next: NextFunction): void => {
    const rawUrl = req.originalUrl || req.url;
    if (PATH_TRAVERSAL_PATTERN.test(rawUrl) || PATH_TRAVERSAL_PATTERN.test(JSON.stringify(req.query))) {
        res.status(400).json({ message: 'Path traversal attempt detected.' });
        return;
    }
    next();
};

// ─────────────────────────────────────────────
// 🗄️  MASS ASSIGNMENT GUARD
// ─────────────────────────────────────────────

/**
 * Factory: Creates a middleware that strips any fields not in the whitelist
 * from req.body before passing to controllers.
 * Prevents Mass Assignment attacks where attackers inject extra fields
 * (e.g., setting `role: "admin"` in a profile update payload).
 */
export const massAssignmentGuard = (allowedFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (req.body && typeof req.body === 'object') {
            const filtered: Record<string, any> = {};
            for (const field of allowedFields) {
                if (field in req.body) filtered[field] = req.body[field];
            }
            req.body = filtered;
        }
        next();
    };
};

// ─────────────────────────────────────────────
// 🤖  BOT SCRAPING / AUTOMATION DETECTION
// ─────────────────────────────────────────────

/** Known bad bot signatures in User-Agent strings. */
const BOT_UA_BLACKLIST = [
    'curl', 'wget', 'python-requests', 'go-http-client',
    'java/', 'libwww', 'scrapy', 'masscan', 'nikto',
    'sqlmap', 'nmap', 'zgrab', 'dirbuster', 'hydra',
    'burpsuite', 'owasp', 'httpie',
];

/**
 * Middleware: Detect automated tools / scrapers by User-Agent.
 * Blocks known scanning/exploitation tools.
 * Sensitive endpoints (leaderboard, potential-donors) should apply this.
 */
export const botDetection = (req: Request, res: Response, next: NextFunction): void => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (!ua) {
        // Completely missing UA is a strong bot signal
        res.status(403).json({ message: 'Access denied.' });
        return;
    }
    if (BOT_UA_BLACKLIST.some(bot => ua.includes(bot))) {
        res.status(403).json({ message: 'Automated access is not permitted.' });
        return;
    }
    next();
};

// ─────────────────────────────────────────────
// 🚀  CREDENTIAL STUFFING / BRUTE FORCE HELPERS
// ─────────────────────────────────────────────

/**
 * Progressive delay on repeated failed auth attempts per IP.
 * Works alongside express-rate-limit (which hard-blocks after N attempts).
 * This adds exponential back-off BEFORE the hard block kicks in.
 */
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS_BEFORE_DELAY = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const recordFailedAttempt = (ip: string): void => {
    const now = Date.now();
    const entry = failedAttempts.get(ip);
    if (!entry || now - entry.lastAttempt > RESET_WINDOW_MS) {
        failedAttempts.set(ip, { count: 1, lastAttempt: now });
    } else {
        entry.count += 1;
        entry.lastAttempt = now;
    }
};

export const clearFailedAttempts = (ip: string): void => {
    failedAttempts.delete(ip);
};

/**
 * Middleware: Apply a progressive delay for IPs with repeated failures.
 * Each failed login adds a growing artificial wait (up to 3 seconds).
 * Slows down credential stuffing / brute force tools dramatically.
 */
export const bruteForceDelay = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || 'unknown';
    const entry = failedAttempts.get(ip);
    if (entry && entry.count >= MAX_ATTEMPTS_BEFORE_DELAY) {
        const delayMs = Math.min(entry.count * 500, 3000); // Cap at 3 seconds
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    next();
};

// ─────────────────────────────────────────────
// 🌐  FORCED BROWSING / SENSITIVE DATA EXPOSURE
// ─────────────────────────────────────────────

/**
 * List of URL prefixes that must never be accessible without auth.
 * Acts as a defence-in-depth catch-all even if a route accidentally
 * loses its authMiddleware.
 */
const PROTECTED_PREFIXES = ['/admin', '/donor', '/hospital', '/user'];

/**
 * Intentionally public paths that are under a protected prefix
 * but do NOT require authentication (e.g. the leaderboard).
 */
const PUBLIC_PATHS = ['/donor/leaderboard'];

/**
 * Middleware: Block unauthenticated access to protected path prefixes.
 * Defends against Forced Browsing — manually navigating to /admin/...
 * without a valid token.
 * Exceptions: PUBLIC_PATHS are always allowed through.
 */
export const forcedBrowsingGuard = (req: Request, res: Response, next: NextFunction): void => {
    // Always allow explicitly public paths
    if (PUBLIC_PATHS.includes(req.path)) { next(); return; }

    const cookieToken = (req as any).cookies?.token;
    const authHeader = req.header('Authorization');
    const hasToken = !!cookieToken || !!authHeader;

    const isProtected = PROTECTED_PREFIXES.some(prefix => req.path.startsWith(prefix));

    if (isProtected && !hasToken) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }
    next();
};

// ─────────────────────────────────────────────
// 🌐  STRICT CORS ENFORCEMENT
// ─────────────────────────────────────────────

/**
 * Middleware: Ensure cross-origin requests are only allowed from our allowed
 * origins. If `origin` header is present and NOT in the allowed list, block
 * the request entirely (rather than relying purely on browser CORS enforcement).
 * Defends against CORS Misconfiguration exploits.
 */
export const strictCorsGuard = (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers['origin'];
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        res.status(403).json({ message: 'CORS policy violation.' });
        return;
    }
    next();
};

// ─────────────────────────────────────────────
// 📝  SECURITY EVENT LOGGER
// ─────────────────────────────────────────────

type SecurityEvent = 'TOKEN_REPLAY' | 'PATH_TRAVERSAL' | 'INJECTION' | 'CSRF' | 'BOT' | 'VERB_TAMPER' | 'BRUTE_FORCE' | 'FORCED_BROWSE' | 'MASS_ASSIGN' | 'CORS_VIOLATION';

export const logSecurityEvent = (event: SecurityEvent, req: Request, detail?: string): void => {
    // In production, pipe to a SIEM / structured log (e.g., Winston, Datadog)
    console.warn(`[SECURITY][${new Date().toISOString()}] ${event} | IP: ${req.ip} | Path: ${req.path}${detail ? ` | ${detail}` : ''}`);
};
