import { Router } from 'express';
import { getDonorDonations, getMatchedRequests, getLeaderboard, getImpactPrediction } from '../controllers/donorController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

router.get('/donations', authMiddleware, roleMiddleware(['donor']), getDonorDonations);
router.get('/matches', authMiddleware, roleMiddleware(['donor']), getMatchedRequests);
router.get('/impact/:requestId', authMiddleware, roleMiddleware(['donor']), getImpactPrediction);
router.get('/leaderboard', getLeaderboard);

export default router;
