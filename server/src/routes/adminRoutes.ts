import { Router } from 'express';
import { getAllDonations, getAllUsers } from '../controllers/adminController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

router.get('/donations', authMiddleware, roleMiddleware(['admin']), getAllDonations);
router.get('/users', authMiddleware, roleMiddleware(['admin']), getAllUsers);

export default router;
