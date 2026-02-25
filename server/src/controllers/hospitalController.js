"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPotentialDonors = exports.verifyDonation = exports.updateHospitalInventory = exports.createHospitalRequest = exports.getHospitalRequests = exports.getHospitalInventory = exports.getHospitalDonations = void 0;
const db_1 = require("../config/db");
const getHospitalDonations = async (req, res) => {
    const hospitalId = req.user?.id;
    try {
        const result = await (0, db_1.query)(`SELECT d.id, d.donation_date, d.units, u.name as donor_name 
             FROM donations d 
             JOIN users u ON d.donor_id = u.id 
             WHERE d.hospital_id = $1 
             ORDER BY d.donation_date DESC`, [hospitalId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getHospitalDonations = getHospitalDonations;
const getHospitalInventory = async (req, res) => {
    const hospitalId = req.user?.id;
    try {
        const result = await (0, db_1.query)('SELECT * FROM blood_inventory WHERE hospital_id = $1', [hospitalId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getHospitalInventory = getHospitalInventory;
const getHospitalRequests = async (req, res) => {
    const hospitalId = req.user?.id;
    try {
        const result = await (0, db_1.query)('SELECT * FROM blood_requests WHERE hospital_id = $1 ORDER BY created_at DESC', [hospitalId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getHospitalRequests = getHospitalRequests;
const createHospitalRequest = async (req, res) => {
    const hospitalId = req.user?.id;
    const { blood_group, units_required, urgency, latitude, longitude } = req.body;
    try {
        const result = await (0, db_1.query)('INSERT INTO blood_requests (hospital_id, blood_group, units_required, urgency, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [hospitalId, blood_group, units_required, urgency, latitude, longitude]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createHospitalRequest = createHospitalRequest;
const updateHospitalInventory = async (req, res) => {
    const hospitalId = req.user?.id;
    const { blood_group, units } = req.body;
    try {
        const result = await (0, db_1.query)(`INSERT INTO blood_inventory (hospital_id, blood_group, units, last_updated) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
             ON CONFLICT (hospital_id, blood_group) 
             DO UPDATE SET units = $3, last_updated = CURRENT_TIMESTAMP
             RETURNING *`, [hospitalId, blood_group, units]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateHospitalInventory = updateHospitalInventory;
const verifyDonation = async (req, res) => {
    const hospitalId = req.user?.id;
    const { donor_id, units, xp_earned } = req.body;
    try {
        await (0, db_1.query)('BEGIN');
        // 1. Insert into donations
        const donationResult = await (0, db_1.query)('INSERT INTO donations (donor_id, hospital_id, units, xp_earned) VALUES ($1, $2, $3, $4) RETURNING id, donation_date', [donor_id, hospitalId, units, xp_earned || (units * 10)]);
        // 2. Update Hospital Inventory
        // First, get the blood group of the donor
        const donorData = await (0, db_1.query)('SELECT blood_group FROM donors WHERE user_id = $1', [donor_id]);
        if (donorData.rows.length === 0) {
            throw new Error('Donor not found');
        }
        const bloodGroup = donorData.rows[0].blood_group;
        await (0, db_1.query)(`INSERT INTO blood_inventory (hospital_id, blood_group, units, last_updated) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
             ON CONFLICT (hospital_id, blood_group) 
             DO UPDATE SET units = blood_inventory.units + $3, last_updated = CURRENT_TIMESTAMP`, [hospitalId, bloodGroup, units]);
        // 3. Update Donor Stats (XP and Last Donation Date)
        const earnedXP = xp_earned || (units * 10);
        await (0, db_1.query)(`UPDATE donors 
             SET xp_points = xp_points + $1, 
                 last_donation_date = CURRENT_DATE,
                 current_level = floor((xp_points + $1) / 100) + 1
             WHERE user_id = $2`, [earnedXP, donor_id]);
        await (0, db_1.query)('COMMIT');
        res.status(201).json({
            message: 'Donation verified successfully',
            donation: donationResult.rows[0],
            xp_earned: earnedXP
        });
    }
    catch (err) {
        await (0, db_1.query)('ROLLBACK');
        res.status(500).json({ message: err.message });
    }
};
exports.verifyDonation = verifyDonation;
const getPotentialDonors = async (req, res) => {
    const { requestId } = req.params;
    const hospitalId = req.user?.id;
    try {
        // 1. Get the request details
        const requestResult = await (0, db_1.query)('SELECT * FROM blood_requests WHERE id = $1', [requestId]);
        if (requestResult.rows.length === 0)
            return res.status(404).json({ message: 'Request not found' });
        const request = requestResult.rows[0];
        // Ensure the hospital owns the request (IDOR Prevention)
        if (request.hospital_id !== hospitalId) {
            return res.status(403).json({ message: 'Forbidden: You do not have access to this request' });
        }
        // 2. Find matching donors using distance if coordinates exist
        let matchesQuery = `
             SELECT u.name, d.blood_group, d.city, d.phone, d.is_eligible, d.xp_points
             FROM donors d
             JOIN users u ON d.user_id = u.id
             WHERE d.blood_group = $1
             AND d.is_eligible = TRUE
        `;
        let queryParams = [request.blood_group];
        if (request.latitude != null && request.longitude != null) {
            matchesQuery += ` AND d.latitude IS NOT NULL AND calculate_distance(d.latitude, d.longitude, $2, $3) < 50 `;
            queryParams.push(request.latitude, request.longitude);
        }
        else {
            // Fallback to hospital city
            matchesQuery += ` AND d.city = (SELECT city FROM hospitals WHERE user_id = $2) `;
            queryParams.push(request.hospital_id);
        }
        matchesQuery += ` ORDER BY d.xp_points DESC NULLS LAST`;
        const donors = await (0, db_1.query)(matchesQuery, queryParams);
        res.json(donors.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getPotentialDonors = getPotentialDonors;
//# sourceMappingURL=hospitalController.js.map