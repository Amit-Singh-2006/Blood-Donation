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
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
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
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
