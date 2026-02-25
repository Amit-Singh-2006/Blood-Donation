import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { query } from '../config/db';

/**
 * CRITICAL: Double-check admin role directly in the database.
 * Prevents JWT role forgery — even if an attacker tampers with a token,
 * the role is verified against the live DB record, not just the token payload.
 */
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify role from database — never trust token alone
        const result = await query('SELECT role FROM users WHERE id = $1', [userId]);

        if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }

        next();
    } catch (err: any) {
        return res.status(500).json({ message: 'Authorization check failed' });
    }
};
