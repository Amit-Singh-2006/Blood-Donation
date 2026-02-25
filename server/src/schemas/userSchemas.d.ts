import { z } from 'zod';
export declare const updateProfileSchema: z.ZodObject<{
    latitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    longitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    city: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=userSchemas.d.ts.map