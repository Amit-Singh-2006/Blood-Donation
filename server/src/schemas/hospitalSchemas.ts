import { z } from 'zod';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

// The blood_requests.urgency CHECK constraint only allows 'Normal' | 'Urgent' | 'Emergency'.
// Clients send 'standard' | 'critical' (dashboard, AI agent) or the legacy low..critical scale,
// so map every accepted value onto the DB vocabulary here.
const URGENCY_TO_DB = {
    standard: 'Normal', low: 'Normal', medium: 'Normal', Normal: 'Normal',
    high: 'Urgent', Urgent: 'Urgent',
    critical: 'Emergency', Emergency: 'Emergency',
} as const;

export const createHospitalRequestSchema = z.object({
    blood_group: z.enum(BLOOD_GROUPS),
    // The dashboard form posts this as a string; the DB column is INTEGER.
    units_required: z.coerce.number().int().positive("Units required must be positive"),
    urgency: z
        .enum(Object.keys(URGENCY_TO_DB) as [keyof typeof URGENCY_TO_DB, ...(keyof typeof URGENCY_TO_DB)[]])
        .transform(u => URGENCY_TO_DB[u]),
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
