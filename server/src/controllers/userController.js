"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.markNotificationRead = exports.getNotifications = void 0;
const db_1 = require("../config/db");
const getNotifications = async (req, res) => {
    const userId = req.user?.id;
    try {
        const result = await (0, db_1.query)('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getNotifications = getNotifications;
const markNotificationRead = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    try {
        await (0, db_1.query)('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({ message: 'Notification marked as read' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.markNotificationRead = markNotificationRead;
const updateProfile = async (req, res) => {
    const userId = req.user?.id;
    const { latitude, longitude, city, phone } = req.body;
    const role = req.user?.role;
    try {
        if (role === 'donor') {
            await (0, db_1.query)('UPDATE donors SET latitude = $1, longitude = $2, city = $3, phone = $4 WHERE user_id = $5', [latitude, longitude, city, phone, userId]);
        }
        else if (role === 'hospital') {
            await (0, db_1.query)('UPDATE hospitals SET latitude = $1, longitude = $2, city = $3, contact_number = $4 WHERE user_id = $5', [latitude, longitude, city, phone, userId]);
        }
        res.json({ message: 'Profile updated successfully' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateProfile = updateProfile;
//# sourceMappingURL=userController.js.map