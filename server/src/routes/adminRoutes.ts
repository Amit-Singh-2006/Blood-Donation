import { Router } from 'express';
import { getAllDonations, getAllUsers } from '../controllers/adminController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/requireAdmin';
import rateLimit from 'express-rate-limit';

const router = Router();

// Tight rate limit — admins shouldn't hit APIs hundreds of times (prevents data scraping)
const adminLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many admin requests. Please slow down.' }
});

// Double-gated: JWT auth + DB-verified admin role
router.get('/donations', adminLimiter, authMiddleware, requireAdmin, getAllDonations);
router.get('/users', adminLimiter, authMiddleware, requireAdmin, getAllUsers);

export default router;

