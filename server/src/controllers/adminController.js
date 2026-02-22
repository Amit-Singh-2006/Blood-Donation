"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = exports.getAllDonations = void 0;
const db_1 = require("../config/db");
const getAllDonations = async (req, res) => {
    try {
        const result = await (0, db_1.query)('SELECT * FROM donations');
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getAllDonations = getAllDonations;
const getAllUsers = async (req, res) => {
    try {
        const result = await (0, db_1.query)('SELECT id, name, email, role FROM users');
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getAllUsers = getAllUsers;
//# sourceMappingURL=adminController.js.map