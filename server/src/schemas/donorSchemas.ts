import { z } from 'zod';
import { ALERT_CHANNELS } from '../services/donorNetwork';

export const networkPreferencesSchema = z.object({
    available: z.boolean().optional(),
    preferred_channel: z.enum(ALERT_CHANNELS).optional(),
}).refine((data) => data.available !== undefined || data.preferred_channel !== undefined, {
    message: 'Send available and/or preferred_channel',
});
