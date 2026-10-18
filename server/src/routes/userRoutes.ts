import { Router } from 'express';
import { deleteAccount } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import { validateRequest } from '../middleware/validateZod';
import { massAssignmentGuard } from '../middleware/securityMiddleware';
import { sharedLimitStore } from '../middleware/rateLimitStore';
import { deleteAccountSchema } from '../schemas/userSchemas';
import rateLimit from 'express-rate-limit';

const router = Router();

// Deleting asks for the password: no guessing it here either
const deleteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts. Please wait 15 minutes and try again.' },
    ...sharedLimitStore('account-delete'),
});

// A donor deletes their own account and data (see the controller)
router.delete('/account', deleteLimiter, authMiddleware, roleMiddleware(['donor']),
    massAssignmentGuard(['password']), validateRequest(deleteAccountSchema), deleteAccount);

export default router;
