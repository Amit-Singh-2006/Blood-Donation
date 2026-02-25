"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hospitalController_1 = require("../controllers/hospitalController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const validateZod_1 = require("../middleware/validateZod");
const hospitalSchemas_1 = require("../schemas/hospitalSchemas");
const router = (0, express_1.Router)();
router.get('/donations', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['hospital']), hospitalController_1.getHospitalDonations);
router.get('/inventory', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['hospital']), hospitalController_1.getHospitalInventory);
router.get('/requests', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['hospital']), hospitalController_1.getHospitalRequests);
router.get('/potential-donors/:requestId', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['hospital']), hospitalController_1.getPotentialDonors);
router.post('/requests', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['hospital']), (0, validateZod_1.validateRequest)(hospitalSchemas_1.createHospitalRequestSchema), hospitalController_1.createHospitalRequest);
router.put('/inventory', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['hospital']), (0, validateZod_1.validateRequest)(hospitalSchemas_1.updateHospitalInventorySchema), hospitalController_1.updateHospitalInventory);
router.post('/verify-donation', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['hospital']), (0, validateZod_1.validateRequest)(hospitalSchemas_1.verifyDonationSchema), hospitalController_1.verifyDonation);
exports.default = router;
//# sourceMappingURL=hospitalRoutes.js.map