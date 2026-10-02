import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Two-step verification for admin and hospital accounts: a 6-digit code from an
 * authenticator app (TOTP, RFC 6238: HMAC-SHA1, 30-second steps), the standard
 * Google Authenticator and Microsoft Authenticator use. Backup codes cover a lost phone.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

export const base32Encode = (bytes: Buffer): string => {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += BASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
    return out;
};

export const base32Decode = (text: string): Buffer => {
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of text.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
        value = (value << 5) | BASE32.indexOf(ch);
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
};

/** A new 160-bit secret, base32 as authenticator apps expect it. */
export const generateSecret = (): string => base32Encode(randomBytes(20));

export const totpAt = (secret: Buffer, step: number, digits = 6): string => {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const hmac = createHmac('sha1', secret).update(counter).digest();
    const offset = hmac[hmac.length - 1]! & 0xf;
    const binary = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
    return String(binary % 10 ** digits).padStart(digits, '0');
};

export const currentStep = (now = Date.now()): number => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * The time step the code belongs to (current, or one step either side for clock
 * drift), or null. Steps at or before lastStep are refused, so a code works once.
 */
export const matchTotp = (secret: Buffer, code: string, lastStep: number | null, now = Date.now()): number | null => {
    const given = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(given)) return null;
    const step = currentStep(now);
    for (const s of [step, step - 1, step + 1]) {
        if (lastStep !== null && s <= lastStep) continue;
        if (timingSafeEqual(Buffer.from(totpAt(secret, s)), Buffer.from(given))) return s;
    }
    return null;
};

export const otpauthUrl = (email: string, secret: string): string =>
    `otpauth://totp/${encodeURIComponent(`LifeLink:${email}`)}?secret=${secret}&issuer=LifeLink&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;

// Keys derived from JWT_SECRET, each for one purpose only
const derivedKey = (purpose: string): Buffer => {
    const root = process.env.JWT_SECRET;
    if (!root) throw new Error('JWT_SECRET is not set');
    return Buffer.from(hkdfSync('sha256', root, 'lifelink-mfa', purpose, 32));
};

/** Encrypts an authenticator secret for storage (AES-256-GCM). */
export const sealSecret = (secret: string): string => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', derivedKey('totp-secret-v1'), iv);
    const sealed = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), sealed.toString('base64')].join(':');
};

export const openSecret = (stored: string): string => {
    const [version, iv, tag, sealed] = stored.split(':');
    if (version !== 'v1' || !iv || !tag || !sealed) throw new Error('Unreadable authenticator secret');
    const decipher = createDecipheriv('aes-256-gcm', derivedKey('totp-secret-v1'), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(sealed, 'base64')), decipher.final()]).toString('utf8');
};

export type SecondStepMode = 'setup' | 'verify';
export interface PendingSignIn { uid: number; role: string; mode: SecondStepMode; remember: boolean }

/**
 * The 10-minute ticket between the password and the code. It is signed with its
 * own key, so it can never pass as a session token.
 */
export const signPendingToken = (uid: number, role: string, mode: SecondStepMode, remember = false): string =>
    jwt.sign({ uid, role, mode, remember }, derivedKey('pending-sign-in-v1'), { expiresIn: '10m' });

export const readPendingToken = (token: unknown): PendingSignIn | null => {
    if (typeof token !== 'string') return null;
    try {
        const t = jwt.verify(token, derivedKey('pending-sign-in-v1')) as any;
        return Number.isInteger(t?.uid) && typeof t.role === 'string' && (t.mode === 'setup' || t.mode === 'verify')
            ? { uid: t.uid, role: t.role, mode: t.mode, remember: t.remember === true }
            : null;
    } catch {
        return null;
    }
};

// Backup codes: XXXX-XXXX from an alphabet without look-alike characters
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const newBackupCodes = (count = 10): string[] =>
    Array.from({ length: count }, () => {
        const chars = [...randomBytes(8)].map((b) => BACKUP_ALPHABET[b % BACKUP_ALPHABET.length]).join('');
        return `${chars.slice(0, 4)}-${chars.slice(4)}`;
    });

export const hashBackupCode = (code: string): string =>
    createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
