import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { chatCompletion } from '../controllers/aiController';
import { validateRequest } from '../middleware/validateZod';
import { chatCompletionSchema } from '../schemas/aiSchemas';

const router = Router();

// ─────────────────────────────────────────────
// Rate limiter – the chat assistants are public, so cap how much of the
// server-side Groq quota a single IP can consume (one agent turn can make
// up to 5 calls).
// ─────────────────────────────────────────────
const aiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many AI requests. Please slow down.' },
});

router.post('/chat', aiLimiter, validateRequest(chatCompletionSchema), chatCompletion);

export default router;
