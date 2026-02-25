"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validateZod_1 = require("../middleware/validateZod");
const userSchemas_1 = require("../schemas/userSchemas");
const router = (0, express_1.Router)();
router.get('/notifications', authMiddleware_1.authMiddleware, userController_1.getNotifications);
router.put('/notifications/:id/read', authMiddleware_1.authMiddleware, userController_1.markNotificationRead);
router.put('/profile', authMiddleware_1.authMiddleware, (0, validateZod_1.validateRequest)(userSchemas_1.updateProfileSchema), userController_1.updateProfile);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map