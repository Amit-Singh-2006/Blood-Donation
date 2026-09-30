import { Router } from 'express';
import { getDonorDonations, getMatchedRequests, getLeaderboard, getImpactPrediction, getNetworkStatus, updateNetworkPreferences, getDonationCenters, shareLocation, stopSharingLocation } from '../controllers/donorController';
import { validateRequest } from '../middleware/validateZod';
import { networkPreferencesSchema, donorLocationSchema } from '../schemas/donorSchemas';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import { botDetection } from '../middleware/securityMiddleware';
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
router.get('/matches', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), getMatchedRequests);
router.get('/impact/:requestId', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), getImpactPrediction);
// Live alerts, eligibility and preferences from the n8n donor network
router.get('/network', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), getNetworkStatus);
router.put('/network', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), validateRequest(networkPreferencesSchema), updateNetworkPreferences);
router.get('/centers', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), getDonationCenters);
// Opt-in live location for the hospital the donor is travelling to
router.put('/location', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), validateRequest(donorLocationSchema), shareLocation);
router.delete('/location/:matchId', donorApiLimiter, authMiddleware, roleMiddleware(['donor']), stopSharingLocation);

// Leaderboard is public but bot-protected to prevent scraping
router.get('/leaderboard', botDetection, donorApiLimiter, getLeaderboard);

export default router;
