"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHospitalDonations = void 0;
const db_1 = require("../config/db");
const getHospitalDonations = async (req, res) => {
    const hospitalId = req.user?.id;
    try {
        const result = await (0, db_1.query)('SELECT * FROM donations WHERE hospital_id = $1', [hospitalId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getHospitalDonations = getHospitalDonations;
//# sourceMappingURL=hospitalController.js.map