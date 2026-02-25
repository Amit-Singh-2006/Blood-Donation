"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const donorController_1 = require("../controllers/donorController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const router = (0, express_1.Router)();
router.get('/donations', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['donor']), donorController_1.getDonorDonations);
router.get('/matches', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['donor']), donorController_1.getMatchedRequests);
router.get('/impact/:requestId', authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)(['donor']), donorController_1.getImpactPrediction);
router.get('/leaderboard', donorController_1.getLeaderboard);
exports.default = router;
//# sourceMappingURL=donorRoutes.js.map