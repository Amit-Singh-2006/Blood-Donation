"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../config/db");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const register = async (req, res) => {
    const { name, email, password, role, blood_group, city, phone, dob, gender, hospital_name, contact_number } = req.body;
    try {
        // CRITICAL: Admin registration requires a server-side invite code
        if (role === 'admin') {
            const inviteCode = req.body.admin_invite_code;
            const validCode = process.env.ADMIN_INVITE_CODE;
            if (!inviteCode || inviteCode !== validCode) {
                return res.status(403).json({ message: 'Invalid or missing admin invite code' });
            }
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const result = await (0, db_1.query)('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role', [name, email, hashedPassword, role]);
        const user = result.rows[0];
        if (role === 'donor') {
            await (0, db_1.query)('INSERT INTO donors (user_id, blood_group, city, phone, dob, gender) VALUES ($1, $2, $3, $4, $5, $6)', [user.id, blood_group, city, phone, dob, gender]);
        }
        else if (role === 'hospital') {
            await (0, db_1.query)('INSERT INTO hospitals (user_id, hospital_name, city, contact_number) VALUES ($1, $2, $3, $4)', [user.id, hospital_name || name, city, contact_number || phone]);
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30m' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 60 * 1000 // 30 minutes
        });
        res.status(201).json({
            user: { ...user, blood_group } // Include blood_group for frontend usability
        });
    }
    catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({
            message: err.message || 'Unknown registration error',
            error: err
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await (0, db_1.query)('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const isMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30m' });
        // --- Store last_login_ip for admin accounts (helps detect sudden IP jumps) ---
        if (user.role === 'admin') {
            const ip = req.ip || req.socket?.remoteAddress || 'unknown';
            await (0, db_1.query)('UPDATE users SET last_login_ip = $1 WHERE id = $2', [ip, user.id]).catch(() => { });
        }
        let profileData = {};
        if (user.role === 'donor') {
            const donorResult = await (0, db_1.query)('SELECT blood_group, city, phone, is_eligible, xp_points, current_level, badges FROM donors WHERE user_id = $1', [user.id]);
            if (donorResult.rows.length > 0) {
                profileData = donorResult.rows[0];
            }
        }
        else if (user.role === 'hospital') {
            const hospitalResult = await (0, db_1.query)('SELECT hospital_name, city, contact_number FROM hospitals WHERE user_id = $1', [user.id]);
            if (hospitalResult.rows.length > 0) {
                profileData = hospitalResult.rows[0];
            }
        }
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 60 * 1000 // 30 minutes
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
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.login = login;
const logout = async (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
};
exports.logout = logout;
//# sourceMappingURL=authController.js.map