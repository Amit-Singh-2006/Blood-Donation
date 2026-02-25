"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImpactPrediction = exports.getLeaderboard = exports.getMatchedRequests = exports.getDonorDonations = void 0;
const db_1 = require("../config/db");
const getDonorDonations = async (req, res) => {
    const donorId = req.user?.id;
    try {
        const result = await (0, db_1.query)(`SELECT d.id, d.donation_date, d.units, h.hospital_name as hospital_name 
             FROM donations d 
             JOIN hospitals h ON d.hospital_id = h.user_id 
             WHERE d.donor_id = $1 
             ORDER BY d.donation_date DESC`, [donorId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getDonorDonations = getDonorDonations;
const getMatchedRequests = async (req, res) => {
    const donorId = req.user?.id;
    try {
        // 1. Get donor profile (blood group and city/location)
        const donorResult = await (0, db_1.query)('SELECT blood_group, city, latitude, longitude FROM donors WHERE user_id = $1', [donorId]);
        if (donorResult.rows.length === 0)
            return res.status(404).json({ message: 'Donor profile not found' });
        const donor = donorResult.rows[0];
        // 2. Advanced Matching: Use calculate_distance if coordinates are available, else fallback to city
        let matchesQuery = `
            SELECT br.*, h.hospital_name, h.city as hospital_city
            FROM blood_requests br
            JOIN hospitals h ON br.hospital_id = h.user_id
            WHERE br.blood_group = $1 
            AND br.status = 'Open'
        `;
        let queryParams = [donor.blood_group];
        if (donor.latitude != null && donor.longitude != null) {
            // Match within ~50 miles radius
            matchesQuery += ` AND calculate_distance(h.latitude, h.longitude, $2, $3) < 50 `;
            queryParams.push(donor.latitude, donor.longitude);
        }
        else {
            // Fallback to city
            matchesQuery += ` AND h.city = $2 `;
            queryParams.push(donor.city);
        }
        matchesQuery += ` ORDER BY br.urgency DESC, br.created_at DESC`;
        const matches = await (0, db_1.query)(matchesQuery, queryParams);
        res.json(matches.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getMatchedRequests = getMatchedRequests;
const getLeaderboard = async (req, res) => {
    try {
        const result = await (0, db_1.query)(`SELECT u.name, d.xp_points, d.current_level, d.blood_group, d.city
             FROM donors d
             JOIN users u ON d.user_id = u.id
             ORDER BY d.xp_points DESC
             LIMIT 10`);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getLeaderboard = getLeaderboard;
const getImpactPrediction = async (req, res) => {
    const { requestId } = req.params;
    try {
        const result = await (0, db_1.query)(`SELECT br.*, h.hospital_name, bi.units as current_stock
             FROM blood_requests br
             JOIN hospitals h ON br.hospital_id = h.user_id
             LEFT JOIN blood_inventory bi ON br.hospital_id = bi.hospital_id AND br.blood_group = bi.blood_group
             WHERE br.id = $1`, [requestId]);
        if (result.rows.length === 0)
            return res.status(404).json({ message: 'Request not found' });
        const data = result.rows[0];
        const stock = data.current_stock || 0;
        let impactLevel = 'Normal';
        let insight = 'Your donation will help maintain a healthy blood supply.';
        if (data.urgency === 'Urgent' || stock < 10) {
            impactLevel = 'High';
            insight = `Critical Need! the current inventory for ${data.blood_group} is low (${stock} units). Your donation could save a life today.`;
        }
        else if (data.urgency === 'Emergency' || stock < 5) {
            impactLevel = 'Critical';
            insight = `Immediate Action Required! This hospital is in an emergency state for ${data.blood_group}. Your contribution is vital for upcoming surgeries.`;
        }
        res.json({
            requestId: data.id,
            blood_group: data.blood_group,
            impactLevel,
            insight,
            current_stock: stock,
            urgency: data.urgency
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getImpactPrediction = getImpactPrediction;
//# sourceMappingURL=donorController.js.map