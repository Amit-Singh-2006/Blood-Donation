import { Router } from 'express';
import {
    getDonorDonations, getNetworkStatus, updateNetworkPreferences, getDonationCenters, shareLocation, stopSharingLocation,
    getDonorProfile, updateDonorProfile,
} from '../controllers/donorController';
import { issueCertificate } from '../controllers/certificateController';
import { validateRequest } from '../middleware/validateZod';
import { networkPreferencesSchema, donorLocationSchema, donorProfileSchema, certificateRequestSchema } from '../schemas/donorSchemas';
import { massAssignmentGuard } from '../middleware/securityMiddleware';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// ─────────────────────────────────────────────
// Rate limiter for donor API – prevents API Abuse & scraping
// ─────────────────────────────────────────────
const donorApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.' },
});

// All donor routes: auth check + role check + rate limit + bot detection
router.get('/donations', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), getDonorDonations);
// Live alerts, eligibility and preferences from the donor network
router.get('/network', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), getNetworkStatus);
router.put('/network', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), validateRequest(networkPreferencesSchema), updateNetworkPreferences);
router.get('/centers', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), getDonationCenters);

// The donor's own details (the blood group is locked once a hospital lab confirms it)
router.get('/profile', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), getDonorProfile);
router.put('/profile', donorApiLimiter, authMiddleware, roleMiddleware(['donor']),
    massAssignmentGuard(['name', 'phone', 'city', 'gender', 'dob', 'blood_group']), validateRequest(donorProfileSchema), updateDonorProfile);

// A certificate (with a code anyone can check) for one of the donor's own donations
router.post('/certificates', donorApiLimiter, authMiddleware, roleMiddleware(['donor']),
    massAssignmentGuard(['donation_id', 'match_id']), validateRequest(certificateRequestSchema), issueCertificate);
// Opt-in live location for the hospital the donor is travelling to
router.put('/location', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), validateRequest(donorLocationSchema), shareLocation);
router.delete('/location/:matchId', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), stopSharingLocation);

export default router;
