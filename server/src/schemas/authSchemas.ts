import { z } from 'zod';
import { ALERT_CHANNELS } from '../services/donorNetwork';
import { INDIAN_STATES, PIN_CODE } from '../utils/indianStates';

export const HOSPITAL_TYPES = ['Government', 'Private', 'Trust / NGO', 'Public-Private'] as const;

/**
 * Strong password validation:
 * – Minimum 8 characters (was 6)
 * – Must contain at least one uppercase, one lowercase, one digit, one special character
 * Covers: Brute Force, Credential Stuffing (weak passwords make these much easier)
 */
const strongPasswordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .refine(
        val => /[A-Z]/.test(val),
        'Password must contain at least one uppercase letter'
    )
    .refine(
        val => /[a-z]/.test(val),
        'Password must contain at least one lowercase letter'
    )
    .refine(
        val => /[0-9]/.test(val),
        'Password must contain at least one number'
    )
    .refine(
        val => /[^A-Za-z0-9]/.test(val),
        'Password must contain at least one special character'
    );

export const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long').max(100, 'Name is too long'),
    email: z.string().email('Invalid email address').max(254, 'Email is too long'),
    password: strongPasswordSchema,
    role: z.enum(['donor', 'hospital', 'admin']),

    // Donor specific fields
    blood_group: z.string().optional(),
    city: z.string().min(2, 'City must be at least 2 characters long').max(100).optional(),
    phone: z.string().min(10, 'Phone number must be at least 10 characters long').max(15).optional(),
    dob: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    preferred_channel: z.enum(ALERT_CHANNELS).optional(),

    // Hospital specific fields
    hospital_name: z.string().max(200).optional(),
    contact_number: z.string().max(15).optional(),
    // Registration / licence number an admin checks before verifying the hospital
    registration_number: z.string().trim().max(100).optional(),
    // Optional hospital coordinates so donors are ranked by distance, not just city
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    state: z.enum(INDIAN_STATES, { message: 'Choose a state or union territory' }).optional(),
    address: z.string().trim().min(5, 'Enter the hospital address').max(200).optional(),
    pincode: z.string().regex(PIN_CODE, 'A PIN code has 6 digits and does not start with 0').optional(),
    hospital_type: z.enum(HOSPITAL_TYPES).optional(),

    // Admin invite code (validated server-side in controller)
    admin_invite_code: z.string().trim().max(100).optional(),
    remember: z.boolean().optional(),

}).refine(data => {
    if (data.role === 'donor') {
        return !!data.blood_group && !!data.city && !!data.phone;
    }
    if (data.role === 'hospital') {
        return !!data.hospital_name && !!data.city && !!(data.contact_number || data.phone) && !!data.registration_number;
    }
    if (data.role === 'admin') {
        return !!data.admin_invite_code;
    }
    return true;
}, {
    message: 'Missing required fields for the selected role'
});

export const adminInviteCheckSchema = z.object({
    code: z.string().trim().min(1, 'Enter your invite code').max(100),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address').max(254),
    password: z.string().min(1, 'Password is required').max(128),
    remember: z.boolean().optional(),
});

export const mfaVerifySchema = z.object({
    token: z.string().min(20).max(2000),
    code: z.string().trim().min(6, 'Enter the 6-digit code from your authenticator app').max(12),
});

// Forgot password (controllers/passwordResetController)
const resetEmail = z.string().trim().email('Enter a valid email address').max(254);
const resetTicket = z.string().min(20).max(2000);
export const forgotPasswordSchema = z.object({ email: resetEmail });
export const verifyResetCodeSchema = z.object({
    email: resetEmail,
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
});
export const resetSecondStepSchema = z.object({
    token: resetTicket,
    code: z.string().trim().min(6, 'Enter the 6-digit code from your authenticator app').max(12),
});
export const resetPasswordSchema = z.object({ token: resetTicket, password: strongPasswordSchema });
