import express, { Router } from 'express';
import {
    getHospitalDonations,
    getHospitalInventory,
    getHospitalRequests,
    createHospitalRequest,
    cancelHospitalRequest,
    getDonorLocations,
    updateHospitalInventory,
    getHospitalProfile,
    recordLabBloodGroup,
} from '../controllers/hospitalController';
import {
    getVerification, submitVerification, uploadVerificationDocument, removeVerificationDocument, downloadOwnDocument,
} from '../controllers/verificationController';
import { labBloodGroupSchema, verificationSubmissionSchema } from '../schemas/verificationSchemas';
import { MAX_DOCUMENT_BYTES } from '../utils/documents';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
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

// The blood group the hospital's lab found for a donation (it becomes the donor's lab-confirmed group)
router.put(
    '/requests/:id/donors/:matchId/lab-blood-group',
    hospitalApiLimiter,
    authMiddleware,
    roleMiddleware(['hospital']),
    massAssignmentGuard(['blood_group']),
    validateRequest(labBloodGroupSchema),
    recordLabBloodGroup
);

// ── Verification documents ──
// A document is sent as the request body itself, read only after sign-in and
// capped at the document limit; utils/documents checks what it really is.
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `hospital:${(req as AuthRequest).user?.id}`,
    message: { message: 'Too many uploads this hour. Please try again later.' },
});
const fileBody = express.raw({ type: () => true, limit: MAX_DOCUMENT_BYTES });
const hospitalOnly = [hospitalApiLimiter, authMiddleware, roleMiddleware(['hospital'])];

router.get('/verification', ...hospitalOnly, getVerification);
router.put(
    '/verification',
    ...hospitalOnly,
    massAssignmentGuard(['registration_number', 'registration_authority', 'hfr_id', 'blood_centre_licence', 'authorised_person', 'authorised_designation', 'declaration']),
    validateRequest(verificationSubmissionSchema),
    submitVerification
);
router.get('/verification/documents/:kind', ...hospitalOnly, downloadOwnDocument);
router.put('/verification/documents/:kind', ...hospitalOnly, uploadLimiter, fileBody, uploadVerificationDocument);
router.delete('/verification/documents/:kind', ...hospitalOnly, uploadLimiter, removeVerificationDocument);

export default router;
