import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        donor: "donor";
        hospital: "hospital";
    }>;
    blood_group: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    dob: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
    }>>;
    hospital_name: z.ZodOptional<z.ZodString>;
    contact_number: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=authSchemas.d.ts.map