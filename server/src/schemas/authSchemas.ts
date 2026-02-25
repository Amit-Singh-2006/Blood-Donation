import { z } from 'zod';

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

    // Hospital specific fields
    hospital_name: z.string().max(200).optional(),
    contact_number: z.string().max(15).optional(),

    // Admin invite code (validated server-side in controller)
    admin_invite_code: z.string().optional(),

}).refine(data => {
    if (data.role === 'donor') {
        return !!data.blood_group && !!data.city && !!data.phone;
    }
    if (data.role === 'hospital') {
        return !!data.hospital_name && !!data.city && !!(data.contact_number || data.phone);
    }
    return true;
}, {
    message: 'Missing required fields for the selected role'
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address').max(254),
    password: z.string().min(1, 'Password is required').max(128),
});
