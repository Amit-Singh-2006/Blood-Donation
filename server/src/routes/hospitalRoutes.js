"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hospitalController_1 = require("../controllers/hospitalController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const router = (0, express_1.Router)();
router.get('/donations', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['hospital']), hospitalController_1.getHospitalDonations);
exports.default = router;
//# sourceMappingURL=hospitalRoutes.js.map