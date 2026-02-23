import { Request, Response } from 'express';
import { query } from '../config/db';

export const getAllDonations = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM donations');
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT id, name, email, role FROM users');
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
