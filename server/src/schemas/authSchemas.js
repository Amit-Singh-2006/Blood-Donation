"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters long"),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
    role: zod_1.z.enum(['donor', 'hospital', 'admin']),
    // Donor specific fields (optional globally, but conditionally helpful)
    blood_group: zod_1.z.string().optional(),
    city: zod_1.z.string().min(2, "City must be at least 2 characters long").optional(),
    phone: zod_1.z.string().min(10, "Phone number must be at least 10 characters long").optional(),
    dob: zod_1.z.string().optional(),
    gender: zod_1.z.enum(['male', 'female', 'other']).optional(),
    // Hospital specific fields
    hospital_name: zod_1.z.string().optional(),
    contact_number: zod_1.z.string().optional(),
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
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(1, "Password is required")
});
//# sourceMappingURL=authSchemas.js.map