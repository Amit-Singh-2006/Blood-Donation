import { Router } from 'express';
import {
    getHospitalDonations,
    getHospitalInventory,
    getHospitalRequests,
    createHospitalRequest,
    cancelHospitalRequest,
    getDonorLocations,
    updateHospitalInventory,
    getHospitalProfile,
} from '../controllers/hospitalController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import { validateRequest } from '../middleware/validateZod';
import { createHospitalRequestSchema, updateHospitalInventorySchema } from '../schemas/hospitalSchemas';
import { massAssignmentGuard } from '../middleware/securityMiddleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// ─────────────────────────────────────────────
// Rate limiter – prevent API Abuse & DoS on hospital routes
// ─────────────────────────────────────────────
const hospitalApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.' },
});

// ── GET routes ──
router.get('/profile', hospitalApiLimiter, authMiddleware, roleMiddleware(['hospital']), getHospitalProfile);
router.get('/donations', hospitalApiLimiter, authMiddleware, roleMiddleware(['hospital']), getHospitalDonations);
router.get('/inventory', hospitalApiLimiter, authMiddleware, roleMiddleware(['hospital']), getHospitalInventory);
router.get('/requests', hospitalApiLimiter, authMiddleware, roleMiddleware(['hospital']), getHospitalRequests);
router.get('/donor-locations', hospitalApiLimiter, authMiddleware, roleMiddleware(['hospital']), getDonorLocations);

// ── POST / PUT routes with Mass Assignment Guards ──
// massAssignmentGuard whitelists only the fields the endpoint actually needs,
// blocking any extra fields an attacker might try to inject (e.g., hospital_id).

router.post(
    '/requests',
    hospitalApiLimiter,
    authMiddleware,
    roleMiddleware(['hospital']),
    massAssignmentGuard(['blood_group', 'units_required', 'urgency', 'latitude', 'longitude', 'patient_ref', 'required_by']),
    validateRequest(createHospitalRequestSchema),
    createHospitalRequest
);

router.put(
    '/inventory',
    hospitalApiLimiter,
    authMiddleware,
    roleMiddleware(['hospital']),
    massAssignmentGuard(['blood_group', 'units']),
    validateRequest(updateHospitalInventorySchema),
    updateHospitalInventory
);

// Only for requests that never reached the donor network (see the controller)
router.put('/requests/:id/cancel', hospitalApiLimiter, authMiddleware, roleMiddleware(['hospital']), massAssignmentGuard([]), cancelHospitalRequest);

export default router;
