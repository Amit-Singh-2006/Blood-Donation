import { z } from 'zod';

// Deleting an account needs its password, so an unattended signed-in phone cannot do it
export const deleteAccountSchema = z.object({
    password: z.string().min(1, 'Enter your password to confirm.').max(128),
});
