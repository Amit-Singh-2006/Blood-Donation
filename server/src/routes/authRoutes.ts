import { Router } from 'express';
import { register, login, logout, checkAdminInvite, verifySecondStep, refreshSession } from '../controllers/authController';
import { validateRequest } from '../middleware/validateZod';
import {
    registerSchema, loginSchema, adminInviteCheckSchema, mfaVerifySchema,
    forgotPasswordSchema, verifyResetCodeSchema, resetSecondStepSchema, resetPasswordSchema,
} from '../schemas/authSchemas';
import { forgotPassword, verifyResetCode, confirmResetSecondStep, resetPassword } from '../controllers/passwordResetController';
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

// Renews the 30-minute session from "keep me signed in"
const refreshLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please wait a few minutes.' },
});
router.post('/refresh', refreshLimiter, botDetection, refreshSession);

// Forgot password: an emailed code, then (admins and hospitals) the authenticator code
const forgotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // per IP; many mobile users share one (each account also gets at most one code a minute)
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many reset requests. Please try again in 15 minutes.' },
});
const resetStepLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts. Please wait 15 minutes and try again.' },
});
router.post('/password/forgot', forgotLimiter, botDetection, validateRequest(forgotPasswordSchema), forgotPassword);
router.post('/password/verify', resetStepLimiter, botDetection, validateRequest(verifyResetCodeSchema), verifyResetCode);
router.post('/password/second-step', resetStepLimiter, botDetection, validateRequest(resetSecondStepSchema), confirmResetSecondStep);
router.post('/password/reset', resetStepLimiter, botDetection, validateRequest(resetPasswordSchema), resetPassword);

router.post('/logout', logout);

export default router;
