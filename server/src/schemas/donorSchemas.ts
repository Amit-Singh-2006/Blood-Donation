import { z } from 'zod';
import { ALERT_CHANNELS } from '../services/donorNetwork';
import { donorAgeProblem } from '../utils/legal';

// One position report while travelling to the hospital for an accepted request
export const donorLocationSchema = z.object({
    match_id: z.number().int().positive(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy_m: z.number().min(0).max(100000).optional(),
});

export const networkPreferencesSchema = z.object({
    available: z.boolean().optional(),
    preferred_channel: z.enum(ALERT_CHANNELS).optional(),
}).refine((data) => data.available !== undefined || data.preferred_channel !== undefined, {
    message: 'Send available and/or preferred_channel',
});

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/**
 * A donor's own changes to their profile. The blood group can only change
 * while it is self-reported: once a hospital lab confirms it, it is locked
 * (the controller enforces that).
 */
export const donorProfileSchema = z.object({
    name: z.string().trim().min(2, 'Enter your full name.').max(100, 'The name is too long.').optional(),
    phone: z.string().trim().min(10, 'Enter a valid mobile number.').max(20, 'Enter a valid mobile number.').optional(),
    city: z.string().trim().min(2, 'Enter your city.').max(100, 'The city name is too long.').optional(),
    gender: z.enum(['male', 'female', 'other'], { error: 'Choose male, female or other.' }).optional(),
    dob: z.string().trim().optional(),
    blood_group: z.enum(BLOOD_GROUPS, { error: 'Choose a blood group.' }).optional(),
}).superRefine((d, ctx) => {
    if (!Object.values(d).some((v) => v !== undefined)) ctx.addIssue({ code: 'custom', message: 'Nothing to change.' });
    if (d.dob !== undefined) {
        const problem = donorAgeProblem(d.dob);
        if (problem) ctx.addIssue({ code: 'custom', path: ['dob'], message: problem });
    }
});

/** A certificate for one donation: a website record (donation_id) or a network one (match_id). */
export const certificateRequestSchema = z.object({
    donation_id: z.number().int().positive().optional(),
    match_id: z.number().int().positive().optional(),
}).refine((d) => (d.donation_id === undefined) !== (d.match_id === undefined), { message: 'Send donation_id or match_id.' });
