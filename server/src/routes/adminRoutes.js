"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const router = (0, express_1.Router)();
router.get('/donations', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['admin']), adminController_1.getAllDonations);
router.get('/users', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['admin']), adminController_1.getAllUsers);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map