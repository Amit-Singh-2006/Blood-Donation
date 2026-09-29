import { z } from 'zod';

export const hospitalVerificationSchema = z.object({
    verified: z.boolean(),
});
