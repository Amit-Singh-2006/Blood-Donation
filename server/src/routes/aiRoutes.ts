import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { chatCompletion } from '../controllers/aiController';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateZod';
import { chatCompletionSchema } from '../schemas/aiSchemas';

const router = Router();

// ─────────────────────────────────────────────
// The assistant runs on the server-side Groq quota, so it is for signed-in
// accounts only, and each IP and each account gets a limited share (one
// agent turn can make up to 5 calls).
// ─────────────────────────────────────────────
const aiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many AI requests. Please slow down.' },
});
const accountLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `account:${(req as AuthRequest).user?.id}`,
    message: { message: 'You have used the assistant a lot this hour. Please try again later.' },
});

router.post('/chat', aiLimiter, authMiddleware, accountLimiter, validateRequest(chatCompletionSchema), chatCompletion);

export default router;
