/**
 * NBTC donor selection: blood donors are 18 to 65 years old. The API checks
 * the same rule (server/src/utils/legal.ts); this only answers sooner.
 */
export const DONOR_MIN_AGE = 18;
export const DONOR_MAX_AGE = 65;

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Today in India as [year, month (1-12), day]. */
const indiaToday = (now: Date): [number, number, number] => {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
};

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Whole years between a YYYY-MM-DD birth date and today in India; null if it is not a real date. */
export const ageOn = (dob: string, now = new Date()): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return null;
  const [ty, tm, td] = indiaToday(now);
  return ty - year - (tm < month || (tm === month && td < day) ? 1 : 0);
};

/** Why this birth date cannot be a blood donor's, or null when it can. Same wording as the API. */
export const donorAgeProblem = (dob: string, now = new Date()): string | null => {
  if (!dob.trim()) return 'Enter your date of birth.';
  const age = ageOn(dob.trim(), now);
  if (age === null || age < 0) return 'Enter a real date of birth.';
  if (age < DONOR_MIN_AGE) return `Blood donors must be at least ${DONOR_MIN_AGE} years old.`;
  if (age > DONOR_MAX_AGE) return `Blood donors can be at most ${DONOR_MAX_AGE} years old (NBTC donor rules).`;
  return null;
};

/** The birth dates a donor can have today, for the date picker's min and max. */
export const donorBirthDateRange = (now = new Date()): { min: string; max: string } => {
  const [y, m, d] = indiaToday(now);
  const day = (yearsAgo: number, offset: number) => {
    const t = new Date(Date.UTC(y - yearsAgo, m - 1, d + offset));
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  };
  // From this day 66 and 18 years ago, step to the first and last birth dates that pass
  // (one step usually; 29 February can need two)
  let first = 0;
  while ((ageOn(day(DONOR_MAX_AGE + 1, first), now) ?? 0) > DONOR_MAX_AGE) first++;
  let last = 1;
  while ((ageOn(day(DONOR_MIN_AGE, last), now) ?? DONOR_MIN_AGE) < DONOR_MIN_AGE) last--;
  return { min: day(DONOR_MAX_AGE + 1, first), max: day(DONOR_MIN_AGE, last) };
};
