import { z } from 'zod';
import { INDIAN_STATES } from '../utils/indianStates';

export const adminActiveSchema = z.object({
    active: z.boolean(),
});

// An invite is issued to one named person; a city admin's jurisdiction is a
// state plus one or more cities (e.g. Pune and Pimpri-Chinchwad)
export const adminInviteSchema = z.object({
    name: z.string().trim().min(2, 'Enter the admin\'s full name').max(100),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
    is_national: z.boolean().default(false),
    state: z.enum(INDIAN_STATES).optional(),
    cities: z.array(z.string().trim().min(2, 'City names need at least 2 letters').max(60)).max(20).default([]),
    valid_days: z.number().int().min(1).max(30).default(7),
}).refine((d) => d.is_national || (!!d.state && d.cities.length > 0), {
    message: 'Choose a state and at least one city for a city admin',
    path: ['cities'],
});

// Deactivating a donor or hospital account needs a reason; it is kept with the account
export const userActiveSchema = z.object({
    active: z.boolean(),
    reason: z.string().trim().max(300, 'Keep the reason under 300 characters.').optional(),
}).refine((d) => d.active || (d.reason?.length ?? 0) >= 5, { message: 'Say why the account is deactivated (at least 5 characters).', path: ['reason'] });
