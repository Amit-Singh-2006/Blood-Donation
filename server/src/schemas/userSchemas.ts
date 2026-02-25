import { z } from 'zod';

export const updateProfileSchema = z.object({
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    city: z.string().optional(),
    phone: z.string().optional(),
});
