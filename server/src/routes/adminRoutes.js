"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireAdmin_1 = require("../middleware/requireAdmin");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)();
// Tight rate limit — admins shouldn't hit APIs hundreds of times (prevents data scraping)
const adminLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many admin requests. Please slow down.' }
});
// Double-gated: JWT auth + DB-verified admin role
router.get('/donations', adminLimiter, authMiddleware_1.authMiddleware, requireAdmin_1.requireAdmin, adminController_1.getAllDonations);
router.get('/users', adminLimiter, authMiddleware_1.authMiddleware, requireAdmin_1.requireAdmin, adminController_1.getAllUsers);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map