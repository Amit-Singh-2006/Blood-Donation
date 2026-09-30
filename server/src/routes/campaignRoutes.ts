import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateRequest } from '../middleware/validateZod';
import { authMiddleware } from '../middleware/authMiddleware';
import { registrationSchema, reviewSchema } from '../schemas/campaignSchemas';
import { getPublicCampaign, myCampaigns, registerForCampaign } from '../controllers/campaignController';
import { myReviews, saveReview } from '../controllers/reviewController';

const limit = (windowMs: number, max: number, message: string) =>
    rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { message } });

// Campaigns: public details and sign-up (the link in every alert), and the donor's own list
export const campaignRoutes = Router();
const readLimiter = limit(60 * 1000, 60, 'Too many requests. Please wait a minute.');
const registerLimiter = limit(60 * 60 * 1000, 10, 'Too many registrations from this network. Please try again later.');
campaignRoutes.get('/for/me', readLimiter, authMiddleware, myCampaigns);
campaignRoutes.get('/:id', readLimiter, getPublicCampaign);
campaignRoutes.post('/:id/register', registerLimiter, validateRequest(registrationSchema), registerForCampaign);

// Reviews between donors, hospitals and campaigns
export const reviewRoutes = Router();
const reviewLimiter = limit(10 * 60 * 1000, 60, 'Too many requests. Please slow down.');
reviewRoutes.get('/mine', reviewLimiter, authMiddleware, myReviews);
reviewRoutes.post('/', reviewLimiter, authMiddleware, validateRequest(reviewSchema), saveReview);
