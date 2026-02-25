import { z } from 'zod';
export declare const createHospitalRequestSchema: z.ZodObject<{
    blood_group: z.ZodString;
    units_required: z.ZodNumber;
    urgency: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        critical: "critical";
    }>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateHospitalInventorySchema: z.ZodObject<{
    blood_group: z.ZodString;
    units: z.ZodNumber;
}, z.core.$strip>;
export declare const verifyDonationSchema: z.ZodObject<{
    donor_id: z.ZodNumber;
    units: z.ZodNumber;
    xp_earned: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
//# sourceMappingURL=hospitalSchemas.d.ts.map