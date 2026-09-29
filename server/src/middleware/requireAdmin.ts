import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { query } from '../config/db';
import { AdminScope, scopeFromProfile } from '../utils/jurisdiction';

export interface AdminRequest extends AuthRequest {
    adminScope?: AdminScope;
}

/**
 * CRITICAL: Double-check admin role directly in the database.
 * Prevents JWT role forgery — even if an attacker tampers with a token,
 * the role is verified against the live DB record, not just the token payload.
 * Also loads the admin's jurisdiction and refuses deactivated admins.
 */
export const requireAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify role from database — never trust token alone
        const result = await query(
            `SELECT u.role, p.is_national, p.state, p.cities, p.active
             FROM users u LEFT JOIN admin_profiles p ON p.user_id = u.id
             WHERE u.id = $1`,
            [userId]
        );
        const row = result.rows[0];

        if (!row || row.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        if (row.active === null || row.active === undefined) {
            return res.status(403).json({ message: 'Your admin profile is not set up yet. Please try again in a minute.' });
        }
        if (!row.active) {
            return res.status(403).json({ message: 'Your admin access has been removed.' });
        }

        req.adminScope = scopeFromProfile(userId, row);
        next();
    } catch (err: any) {
        return res.status(500).json({ message: 'Authorization check failed' });
    }
};

/** Only national admins may invite or remove other admins. */
export const requireNationalAdmin = (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.adminScope?.isNational) {
        return res.status(403).json({ message: 'Only a national admin can manage admins.' });
    }
    next();
};
