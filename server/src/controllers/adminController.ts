import { Request, Response } from 'express';
import { query } from '../config/db';

export const getAllDonations = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM donations');
        res.json(result.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT id, name, email, role FROM users');
        res.json(result.rows);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
