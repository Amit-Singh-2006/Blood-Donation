import { z } from 'zod';
import { ALERT_CHANNELS } from '../services/donorNetwork';

// One position report while travelling to the hospital for an accepted request
export const donorLocationSchema = z.object({
    match_id: z.number().int().positive(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy_m: z.number().min(0).max(100000).optional(),
});

export const networkPreferencesSchema = z.object({
    available: z.boolean().optional(),
    preferred_channel: z.enum(ALERT_CHANNELS).optional(),
}).refine((data) => data.available !== undefined || data.preferred_channel !== undefined, {
    message: 'Send available and/or preferred_channel',
});
