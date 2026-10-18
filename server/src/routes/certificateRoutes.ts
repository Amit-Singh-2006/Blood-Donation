import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyCertificate } from '../controllers/certificateController';
import { sharedLimitStore } from '../middleware/rateLimitStore';

const router = Router();

// Public, so no sign-in; codes have about 40 bits, and guessing is limited
const verifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { valid: false, message: 'Too many checks. Please wait a minute.' },
    ...sharedLimitStore('certificate-check'),
});

// GET /certificates/:code: is this LifeLink certificate real?
router.get('/:code', verifyLimiter, verifyCertificate);

export default router;
