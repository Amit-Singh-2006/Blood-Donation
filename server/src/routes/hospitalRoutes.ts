import { Router } from 'express';
import {
    getHospitalDonations,
    getHospitalInventory,
    getHospitalRequests,
    createHospitalRequest,
    updateHospitalInventory,
    verifyDonation,
    getPotentialDonors
} from '../controllers/hospitalController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

router.get('/donations', authMiddleware, roleMiddleware(['hospital']), getHospitalDonations);
router.get('/inventory', authMiddleware, roleMiddleware(['hospital']), getHospitalInventory);
router.get('/requests', authMiddleware, roleMiddleware(['hospital']), getHospitalRequests);
router.get('/potential-donors/:requestId', authMiddleware, roleMiddleware(['hospital']), getPotentialDonors);

router.post('/requests', authMiddleware, roleMiddleware(['hospital']), createHospitalRequest);
router.put('/inventory', authMiddleware, roleMiddleware(['hospital']), updateHospitalInventory);
router.post('/verify-donation', authMiddleware, roleMiddleware(['hospital']), verifyDonation);

export default router;
