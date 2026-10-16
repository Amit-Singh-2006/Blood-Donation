import { Router } from 'express';
import { getNotifications, markNotificationRead } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// ─────────────────────────────────────────────
// Rate limiter – protect user endpoints from API Abuse
// ─────────────────────────────────────────────
const userApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.' },
});

// ── Routes ──
// markNotificationRead: IDOR is prevented in the controller by scoping the
// UPDATE to WHERE id = $1 AND user_id = $2 (user can only mark their own).
router.get('/notifications', userApiLimiter, authMiddleware, getNotifications);
router.put('/notifications/:id/read', userApiLimiter, authMiddleware, markNotificationRead);

export default router;
