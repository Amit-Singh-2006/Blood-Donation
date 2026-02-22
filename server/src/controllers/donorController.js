"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDonorDonations = void 0;
const db_1 = require("../config/db");
const getDonorDonations = async (req, res) => {
    const donorId = req.user?.id;
    try {
        const result = await (0, db_1.query)('SELECT * FROM donations WHERE donor_id = $1', [donorId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getDonorDonations = getDonorDonations;
//# sourceMappingURL=donorController.js.map