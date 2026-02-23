import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

export const register = async (req: Request, res: Response) => {
    const {
        name, email, password, role,
        blood_group, city, phone, dob, gender,
        hospital_name, contact_number
    } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
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
            { expiresIn: '24h' }
        );

        res.status(201).json({
            user: { ...user, blood_group }, // Include blood_group for frontend usability
            token
        });
    } catch (err: any) {
        console.error('Registration error:', err);
        res.status(500).json({ message: err.message });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '24h' }
        );

        let profileData = {};
        if (user.role === 'donor') {
            const donorResult = await query('SELECT blood_group, city, phone, is_eligible, xp_points, current_level, badges FROM donors WHERE user_id = $1', [user.id]);
            if (donorResult.rows.length > 0) {
                profileData = donorResult.rows[0];
            }
        } else if (user.role === 'hospital') {
            const hospitalResult = await query('SELECT hospital_name, city, contact_number FROM hospitals WHERE user_id = $1', [user.id]);
            if (hospitalResult.rows.length > 0) {
                profileData = hospitalResult.rows[0];
            }
        }

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                ...profileData
            },
            token,
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
