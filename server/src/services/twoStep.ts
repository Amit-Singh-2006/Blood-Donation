import { query } from '../config/db';
import { base32Decode, hashBackupCode, matchTotp, openSecret } from '../utils/mfa';

// Admins and hospitals see donors' details and act on the network, so a password
// alone is not enough: they also enter a code from an authenticator app
export const SECOND_STEP_ROLES = new Set(['admin', 'hospital']);

/** The account's two-step verification record (absent before setup or after a reset). */
export const twoStepRecord = async (userId: number): Promise<{ enabled: boolean; secret_enc: string; last_step: unknown } | undefined> =>
    (await query('SELECT enabled, secret_enc, last_step FROM user_mfa WHERE user_id = $1', [userId])).rows[0];

/**
 * Checks a code from the account's authenticator app or, for a lost phone, one of
 * its single-use backup codes. Each code works once.
 */
export const useSecondStepCode = async (
    userId: number, code: string, mfa: { secret_enc: string; last_step: unknown },
): Promise<{ ok: boolean; backupCodesLeft?: number }> => {
    const step = matchTotp(base32Decode(openSecret(mfa.secret_enc)), code, mfa.last_step == null ? null : Number(mfa.last_step));
    if (step !== null) {
        await query('UPDATE user_mfa SET last_step = $2, updated_at = now() WHERE user_id = $1', [userId, step]);
        return { ok: true };
    }
    const used = await query(
        `UPDATE user_mfa SET backup_hashes = backup_hashes - $2::text, updated_at = now()
         WHERE user_id = $1 AND backup_hashes ? $2::text
         RETURNING jsonb_array_length(backup_hashes) AS codes_left`,
        [userId, hashBackupCode(code)]);
    return used.rows[0] ? { ok: true, backupCodesLeft: Number(used.rows[0].codes_left) } : { ok: false };
};
