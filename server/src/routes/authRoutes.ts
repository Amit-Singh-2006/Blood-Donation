import { Router } from 'express';
import { register, login, logout, checkAdminInvite, verifySecondStep } from '../controllers/authController';
import { validateRequest } from '../middleware/validateZod';
import { registerSchema, loginSchema, adminInviteCheckSchema, mfaVerifySchema } from '../schemas/authSchemas';
import rateLimit from 'express-rate-limit';
import { preventSessionFixation, botDetection, bruteForceDelay } from '../middleware/securityMiddleware';

const router = Router();

// ─────────────────────────────────────────────
// Rate Limiters
// Covers: Brute Force, Credential Stuffing, Rate Limit Bypass
// ─────────────────────────────────────────────

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                      // 5 attempts per IP before hard block
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts from this IP, please try again after 15 minutes' },
    // Skip successful requests in the count so valid logins don't eat the limit
    skipSuccessfulRequests: true,
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5,                      // 5 account creations per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many accounts created from this IP, please try again after an hour' },
});

// Codes are unguessable (about 79 bits), but still no free guessing
const inviteCheckLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many invite checks. Please try again in 15 minutes.' },
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// preventSessionFixation clears any existing session cookie before login/register
// botDetection blocks automated tools (sqlmap, hydra, curl scripts, etc.)
// bruteForceDelay adds progressive wait after repeated failures

router.post(
    '/register',
    registerLimiter,
    botDetection,
    preventSessionFixation,
    validateRequest(registerSchema),
    register
);

router.post(
    '/login',
    loginLimiter,
    botDetection,
    preventSessionFixation,
    bruteForceDelay,
    validateRequest(loginSchema),
    login
);

router.post('/admin-invite/check', inviteCheckLimiter, botDetection, validateRequest(adminInviteCheckSchema), checkAdminInvite);

// Second step for admins and hospitals: at most 10 wrong codes per 10 minutes per IP
const mfaLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many verification attempts. Please wait 10 minutes and sign in again.' },
    skipSuccessfulRequests: true,
});
router.post('/mfa/verify', mfaLimiter, botDetection, validateRequest(mfaVerifySchema), verifySecondStep);

router.post('/logout', logout);

export default router;
