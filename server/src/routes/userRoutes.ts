import { Router } from 'express';
import { getNotifications, markNotificationRead, updateProfile } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateZod';
import { updateProfileSchema } from '../schemas/userSchemas';

const router = Router();

router.get('/notifications', authMiddleware, getNotifications);
router.put('/notifications/:id/read', authMiddleware, markNotificationRead);
router.put('/profile', authMiddleware, validateRequest(updateProfileSchema), updateProfile);

export default router;
