import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sessionToken } from './session';
import { query } from '../config/db';

dotenv.config();

export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

// A deactivated or deleted account loses access at once, not when its 30-minute
// session runs out. The answer is remembered briefly per account, so this costs
// one small query per account every few seconds.
const ACCOUNT_CHECK_MS = 15 * 1000;
const checkedAccounts = new Map<number, { open: boolean; at: number }>();

const accountOpen = async (userId: number) => {
    const hit = checkedAccounts.get(userId);
    if (hit && Date.now() - hit.at < ACCOUNT_CHECK_MS) return hit.open;
    const row = (await query('SELECT disabled_at FROM users WHERE id = $1', [userId])).rows[0];
    const open = !!row && row.disabled_at == null;
    if (checkedAccounts.size > 10000) checkedAccounts.clear();
    checkedAccounts.set(userId, { open, at: Date.now() });
    return open;
};

/** After deactivating, reactivating or deleting an account: check it afresh. */
export const forgetAccountCheck = (userId: number) => { checkedAccounts.delete(userId); };

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // The cookie for the account this page acts as (see middleware/session)
    const token = sessionToken(req);

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] });
    } catch (err) {
        return res.status(401).json({ message: 'Token is not valid' });
    }

    try {
        if (!(await accountOpen(Number(decoded.id)))) {
            return res.status(401).json({ message: 'This account is no longer active. Please sign in again.', error: 'account_closed' });
        }
    } catch (err: any) {
        console.error('Account check failed:', err?.message ?? err);
        return res.status(503).json({ message: 'Could not check your sign-in. Please try again.' });
    }
    req.user = decoded;
    next();
};
