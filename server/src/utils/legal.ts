/**
 * The version of the Terms and Privacy Policy that people agree to when they
 * sign up; it is stored with each account. Keep it equal to LEGAL_UPDATED in
 * src/lib/contact.ts (a test checks this): when the documents change, change
 * both, so new consents record the right version.
 */
export const LEGAL_VERSION = '2026-10-18';

/** NBTC donor selection: blood donors are 18 to 65 years old. */
export const DONOR_MIN_AGE = 18;
export const DONOR_MAX_AGE = 65;

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Whole years between a YYYY-MM-DD birth date and today in India; null if it is not a real date. */
export const ageOn = (dob: string, now = new Date()): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
    if (!m) return null;
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const birth = new Date(Date.UTC(year, month - 1, day));
    // Rejects dates like 31 February, which Date would roll over
    if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return null;
    const today = new Date(now.getTime() + IST_OFFSET_MS);
    let age = today.getUTCFullYear() - year;
    if (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)) age--;
    return age;
};

/** Why this birth date cannot be a blood donor's, or null when it can. */
export const donorAgeProblem = (dob: unknown, now = new Date()): string | null => {
    if (typeof dob !== 'string' || !dob.trim()) return 'Enter your date of birth.';
    const age = ageOn(dob.trim(), now);
    if (age === null || age < 0) return 'Enter a real date of birth.';
    if (age < DONOR_MIN_AGE) return `Blood donors must be at least ${DONOR_MIN_AGE} years old.`;
    if (age > DONOR_MAX_AGE) return `Blood donors can be at most ${DONOR_MAX_AGE} years old (NBTC donor rules).`;
    return null;
};
