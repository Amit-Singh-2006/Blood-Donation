import { z } from 'zod';

export const createHospitalRequestSchema = z.object({
    blood_group: z.string().min(1, "Blood group is required"),
    units_required: z.number().positive("Units required must be positive"),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
});

export const updateHospitalInventorySchema = z.object({
    blood_group: z.string().min(1, "Blood group is required"),
    units: z.number().min(0, "Units cannot be negative"),
});

export const verifyDonationSchema = z.object({
    donor_id: z.number().positive(),
    units: z.number().positive("Units must be positive"),
    xp_earned: z.number().positive().optional(),
});
