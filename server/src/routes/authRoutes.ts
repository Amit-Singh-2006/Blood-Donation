import { Router } from 'express';
import { register, login, logout } from '../controllers/authController';
import { validateRequest } from '../middleware/validateZod';
import { registerSchema, loginSchema } from '../schemas/authSchemas';
import rateLimit from 'express-rate-limit';

const router = Router();

// Per-route rate limits
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts from this IP, please try again after 15 minutes" }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many accounts created from this IP, please try again after an hour" }
});

router.post('/register', registerLimiter, validateRequest(registerSchema), register);
router.post('/login', loginLimiter, validateRequest(loginSchema), login);
router.post('/logout', logout);

export default router;
