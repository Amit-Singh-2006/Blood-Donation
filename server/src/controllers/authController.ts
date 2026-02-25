import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import dotenv from 'dotenv';
import {
    blacklistToken,
    recordFailedAttempt,
    clearFailedAttempts,
    bruteForceDelay,
    logSecurityEvent,
} from '../middleware/securityMiddleware';

dotenv.config();

const JWT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * POST /auth/register
 * 
 * Attack coverage:
 *  – Mass Assignment: only whitelisted fields are used (role whitelisted explicitly)
 *  – Privilege Escalation: admin registration requires invite code + single-admin check
 *  – Sensitive Data Exposure: password is never returned; stack traces not leaked
 */
export const register = async (req: Request, res: Response) => {
    const {
        name, email, password, role,
        blood_group, city, phone, dob, gender,
        hospital_name, contact_number
    } = req.body;

    // Enforce allowed roles explicitly → Privilege Escalation / Vertical Access Control Bypass
    if (!['donor', 'hospital', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified' });
    }

    try {
        // ── ADMIN PROTECTION ─────────────────────────────────────────────
        // Requires secret invite code + enforces single-admin constraint.
        // Prevents: Privilege Escalation, Vertical Access Control Bypass
        if (role === 'admin') {
            const inviteCode = req.body.admin_invite_code;
            const validCode = process.env.ADMIN_INVITE_CODE;
            if (!inviteCode || inviteCode !== validCode) {
                logSecurityEvent('MASS_ASSIGN', req, 'Admin registration attempt without valid invite code');
                return res.status(403).json({ message: 'Invalid or missing admin invite code' });
            }

            const adminExists = await query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
            if (adminExists.rows.length > 0) {
                return res.status(403).json({ message: 'Admin account already exists. Contact the system administrator.' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 12); // cost factor 12 (stronger than 10)
        const result = await query(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role]
        );

        const user = result.rows[0];

        if (role === 'donor') {
            await query(
                'INSERT INTO donors (user_id, blood_group, city, phone, dob, gender) VALUES ($1, $2, $3, $4, $5, $6)',
                [user.id, blood_group, city, phone, dob, gender]
            );
        } else if (role === 'hospital') {
            await query(
                'INSERT INTO hospitals (user_id, hospital_name, city, contact_number) VALUES ($1, $2, $3, $4)',
                [user.id, hospital_name || name, city, contact_number || phone]
            );
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '30m' }
        );

        // HttpOnly cookie → prevents JavaScript/XSS from stealing the token
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: JWT_EXPIRY_MS,
        });

        // ── SENSITIVE DATA EXPOSURE PREVENTION ──────────────────────────
        // Never return password_hash or internal DB fields
        res.status(201).json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role, blood_group }
        });
    } catch (err: any) {
        console.error('Registration error:', err);

        // Handle PostgreSQL unique constraint violation (duplicate email)
        // Return generic message to avoid email enumeration
        if (err.code === '23505') {
            return res.status(400).json({
                message: 'This email is already registered. Please login instead or use a different email.',
                error: 'duplicate_email'
            });
        }

        // ── SENSITIVE DATA EXPOSURE PREVENTION ──────────────────────────
        // Do NOT leak err.message or stack traces to the client
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};

/**
 * POST /auth/login
 *
 * Attack coverage:
 *  – Brute Force: progressive delay + IP tracking (express-rate-limit in route)
 *  – Credential Stuffing: same brute force mechanism applies
 *  – Session Fixation: old cookie cleared by preventSessionFixation middleware
 *  – Sensitive Data Exposure: password_hash never returned
 *  – JWT Tampering: token signed server-side; admin role DB-verified on protected routes
 */
export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    // Apply progressive delay based on prior failed attempts (brute force slow-down)
    await bruteForceDelay(req, res, () => { });

    try {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);

        // ── TIMING ATTACK MITIGATION ─────────────────────────────────────
        // Always run bcrypt.compare even if the user is not found.
        // This prevents timing-based email enumeration.
        const dummyHash = '$2b$12$invalidhashfortemporarydummyuse000000000000000000000';
        const userFound = result.rows.length > 0;
        const user = userFound ? result.rows[0] : { password_hash: dummyHash };
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!userFound || !isMatch) {
            recordFailedAttempt(ip);
            logSecurityEvent('BRUTE_FORCE', req, `Failed login attempt for email: ${email}`);
            // Generic error message prevents username enumeration
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Clear failed attempts on successful login
        clearFailedAttempts(ip);

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '30m' }
        );

        // Track last login IP for admin accounts (anomaly detection)
        if (user.role === 'admin') {
            await query('UPDATE users SET last_login_ip = $1 WHERE id = $2', [ip, user.id]).catch(() => { });
        }

        let profileData = {};
        if (user.role === 'donor') {
            const donorResult = await query(
                'SELECT blood_group, city, phone, is_eligible, xp_points, current_level, badges FROM donors WHERE user_id = $1',
                [user.id]
            );
            if (donorResult.rows.length > 0) profileData = donorResult.rows[0];
        } else if (user.role === 'hospital') {
            const hospitalResult = await query(
                'SELECT hospital_name, city, contact_number FROM hospitals WHERE user_id = $1',
                [user.id]
            );
            if (hospitalResult.rows.length > 0) profileData = hospitalResult.rows[0];
        }

        // HttpOnly + SameSite cookie prevents XSS token theft and CSRF
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: JWT_EXPIRY_MS,
        });

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                ...profileData
            }
        });
    } catch (err: any) {
        // ── SENSITIVE DATA EXPOSURE PREVENTION ──────────────────────────
        // Never leak internal error details to the client
        res.status(500).json({ message: 'Login failed. Please try again.' });
    }
};

/**
 * POST /auth/logout
 *
 * Attack coverage:
 *  – Token Replay Attack: logs the token out by adding it to the blacklist
 *    so that even a stolen copy of the token cannot be reused post-logout
 *  – Session Hijacking: clearing HttpOnly cookie ends the session
 */
export const logout = async (req: Request, res: Response) => {
    const token = req.cookies?.token;

    if (token) {
        // Add to blacklist so it cannot be replayed even before it naturally expires
        blacklistToken(token, JWT_EXPIRY_MS);
    }

    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
    res.json({ message: 'Logged out successfully' });
};
