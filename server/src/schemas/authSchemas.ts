import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    role: z.enum(['donor', 'hospital', 'admin']),

    // Donor specific fields (optional globally, but conditionally helpful)
    blood_group: z.string().optional(),
    city: z.string().min(2, "City must be at least 2 characters long").optional(),
    phone: z.string().min(10, "Phone number must be at least 10 characters long").optional(),
    dob: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),

    // Hospital specific fields
    hospital_name: z.string().optional(),
    contact_number: z.string().optional(),
}).refine(data => {
    // If donor, ensure basic donor fields exist
    if (data.role === 'donor') {
        return !!data.blood_group && !!data.city && !!data.phone;
    }
    // If hospital, ensure hospital fields exist
    if (data.role === 'hospital') {
        return !!data.hospital_name && !!data.city && !!(data.contact_number || data.phone);
    }
    return true;
}, {
    message: "Missing required fields for the selected role"
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required")
});
