"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const validateZod_1 = require("../middleware/validateZod");
const authSchemas_1 = require("../schemas/authSchemas");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)();
// Per-route rate limits
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts from this IP, please try again after 15 minutes" }
});
const registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many accounts created from this IP, please try again after an hour" }
});
router.post('/register', registerLimiter, (0, validateZod_1.validateRequest)(authSchemas_1.registerSchema), authController_1.register);
router.post('/login', loginLimiter, (0, validateZod_1.validateRequest)(authSchemas_1.loginSchema), authController_1.login);
router.post('/logout', authController_1.logout);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map