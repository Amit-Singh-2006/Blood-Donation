import { Router } from 'express';
import { getNotifications, markNotificationRead, updateProfile } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/notifications', authMiddleware, getNotifications);
router.put('/notifications/:id/read', authMiddleware, markNotificationRead);
router.put('/profile', authMiddleware, updateProfile);

export default router;
