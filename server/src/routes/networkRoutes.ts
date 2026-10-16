import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { analyticsView, donorResponse, networkTick, requestStatus, ussdCallback } from '../controllers/networkController';

const limit = (max: number, message: string) =>
    rateLimit({ windowMs: 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { message } });

// The donor network's public endpoints. One-tap links carry their own secret
// token, tracking needs the unguessable tracking token and the statistics are
// aggregate counts, so none of these needs a sign-in.
const router = Router();
router.get('/donor-response', limit(30, 'Too many requests. Please wait a minute.'), donorResponse);
router.get('/request-status', limit(60, 'Too many requests. Please wait a minute.'), requestStatus);
router.get('/analytics', limit(60, 'Too many requests. Please wait a minute.'), analyticsView);
router.post('/ussd', rateLimit({
    windowMs: 60 * 1000, max: 240, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => { res.status(429).type('text/plain').send('END Too many requests. Please try again shortly.'); },
}), ussdCallback);
router.post('/tick', limit(20, 'Too many requests.'), networkTick);

export default router;
