import { Router } from 'express';
import { getAllDonations, getAllUsers, getHospitals, setHospitalVerification, getOverview, getDonors } from '../controllers/adminController';
import { validateRequest } from '../middleware/validateZod';
import { hospitalVerificationSchema } from '../schemas/adminSchemas';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/requireAdmin';
import { botDetection, logSecurityEvent } from '../middleware/securityMiddleware';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// ─────────────────────────────────────────────
// Tight rate limit — prevent data scraping & API abuse on admin routes
// Covers: Bot Scraping, API Abuse, Brute Force on admin panel
// ─────────────────────────────────────────────
const adminLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many admin requests. Please slow down.' },
});

// ─────────────────────────────────────────────
// Security audit log for admin route access
// Covers: Sensitive Data Exposure monitoring
// ─────────────────────────────────────────────
const auditAdminAccess = (req: Request, res: Response, next: NextFunction): void => {
    logSecurityEvent('FORCED_BROWSE', req, `Admin route accessed: ${req.method} ${req.path}`);
    next();
};

// ─────────────────────────────────────────────
// Routes: Triple-gated (JWT auth + DB-verified admin role + bot detection)
// Covers: Privilege Escalation, JWT Tampering, Vertical Access Control Bypass
// ─────────────────────────────────────────────
router.get('/donations', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getAllDonations);
router.get('/users', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getAllUsers);
router.get('/hospitals', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getHospitals);
router.get('/overview', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getOverview);
router.get('/donors', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getDonors);
router.put('/hospitals/:id/verification', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, validateRequest(hospitalVerificationSchema), setHospitalVerification);

export default router;
