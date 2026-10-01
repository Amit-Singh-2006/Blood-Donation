import { Router } from 'express';
import {
    getAllDonations, getAllUsers, getHospitals, setHospitalVerification, getOverview, getDonors, getRequests,
    getMe, listAdmins, setAdminActive, listInvites, createInvite, revokeInvite, resetSecondStep,
} from '../controllers/adminController';
import { validateRequest } from '../middleware/validateZod';
import { createCampaign, listCampaigns, listRegistrations, markAttendance, cancelCampaign } from '../controllers/campaignController';
import { campaignSchema, attendanceSchema } from '../schemas/campaignSchemas';
import { hospitalVerificationSchema, adminActiveSchema, adminInviteSchema } from '../schemas/adminSchemas';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireAdmin, requireNationalAdmin } from '../middleware/requireAdmin';
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
router.get('/users', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, requireNationalAdmin, getAllUsers);
router.get('/hospitals', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getHospitals);
router.get('/overview', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getOverview);
router.get('/donors', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getDonors);
router.put('/hospitals/:id/verification', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, validateRequest(hospitalVerificationSchema), setHospitalVerification);
router.get('/me', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getMe);
router.get('/requests', adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, getRequests);

// Admin management: national admins invite city admins and can remove access
const national = [adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin, requireNationalAdmin];
router.get('/admins', ...national, listAdmins);
router.put('/admins/:id/active', ...national, validateRequest(adminActiveSchema), setAdminActive);
router.get('/invites', ...national, listInvites);
router.post('/invites', ...national, validateRequest(adminInviteSchema), createInvite);
router.put('/invites/:id/revoke', ...national, revokeInvite);

// Blood donation campaigns: city admins run them in their own cities
const anyAdmin = [adminLimiter, botDetection, auditAdminAccess, authMiddleware, requireAdmin];
router.get('/campaigns', ...anyAdmin, listCampaigns);
router.post('/campaigns', ...anyAdmin, validateRequest(campaignSchema), createCampaign);
router.get('/campaigns/:id/registrations', ...anyAdmin, listRegistrations);
router.put('/campaigns/:id/registrations/:regId', ...anyAdmin, validateRequest(attendanceSchema), markAttendance);
router.put('/campaigns/:id/cancel', ...anyAdmin, cancelCampaign);

// Lost phone: the account sets up two-step verification again at its next sign-in
router.post('/users/:id/mfa-reset', ...anyAdmin, resetSecondStep);

export default router;
