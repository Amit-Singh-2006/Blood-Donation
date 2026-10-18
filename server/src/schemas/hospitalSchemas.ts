import { z } from 'zod';
import { HOSPITAL_TYPES } from './authSchemas';
import { INDIAN_STATES, PIN_CODE } from '../utils/indianStates';

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
    units_required: z.coerce.number().int().positive("Units required must be positive").max(20, 'At most 20 units per request'),
    urgency: z
        .enum(Object.keys(URGENCY_TO_DB) as [keyof typeof URGENCY_TO_DB, ...(keyof typeof URGENCY_TO_DB)[]])
        .transform(u => URGENCY_TO_DB[u]),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    // Ward/bed reference only: never the patient's name (see the Terms)
    patient_ref: z.string().trim().max(40, 'Use a short ward/bed reference (max 40 characters)').optional(),
    required_by: z.iso.datetime({ offset: true }).optional(),
});

export const updateHospitalInventorySchema = z.object({
    blood_group: z.string().min(1, "Blood group is required"),
    units: z.number().min(0, "Units cannot be negative"),
});

// Mobile (optionally +91) or a landline with its STD code, as on the sign-up form
const HOSPITAL_PHONE = /^(\+91)?[6-9]\d{9}$|^0\d{9,10}$/;

/**
 * A hospital's own changes to its profile. The contact number and location
 * can always change; the name, type and address only before the hospital is
 * sent for review or verified (the controller enforces that).
 */
export const hospitalProfileSchema = z.object({
    contact_number: z.string().transform((v) => v.replace(/[\s()-]/g, ''))
        .refine((v) => HOSPITAL_PHONE.test(v), 'Enter a 10-digit mobile number, or a landline with its STD code.').optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    hospital_name: z.string().trim().min(3, 'Enter the hospital name.').max(200).optional(),
    hospital_type: z.enum(HOSPITAL_TYPES).optional(),
    address: z.string().trim().min(5, 'Enter the hospital address.').max(200).optional(),
    city: z.string().trim().min(2, 'Enter the city.').max(100).optional(),
    state: z.enum(INDIAN_STATES, { message: 'Choose a state or union territory' }).optional(),
    pincode: z.string().regex(PIN_CODE, 'A PIN code has 6 digits and does not start with 0.').optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nothing to change.' })
    .refine((d) => (d.latitude === undefined) === (d.longitude === undefined), { message: 'Send both latitude and longitude.' });
