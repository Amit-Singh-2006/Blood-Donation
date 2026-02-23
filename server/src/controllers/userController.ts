import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { query } from '../config/db';

export const getNotifications = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    try {
        const result = await query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    try {
        await query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        res.json({ message: 'Notification marked as read' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { latitude, longitude, city, phone } = req.body;
    const role = req.user?.role;

    try {
        if (role === 'donor') {
            await query(
                'UPDATE donors SET latitude = $1, longitude = $2, city = $3, phone = $4 WHERE user_id = $5',
                [latitude, longitude, city, phone, userId]
            );
        } else if (role === 'hospital') {
            await query(
                'UPDATE hospitals SET latitude = $1, longitude = $2, city = $3, contact_number = $4 WHERE user_id = $5',
                [latitude, longitude, city, phone, userId]
            );
        }
        res.json({ message: 'Profile updated successfully' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
