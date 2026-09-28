export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = typeof BLOOD_GROUPS[number];

/**
 * Red-cell / whole-blood ABO-Rh compatibility: the donor groups each recipient
 * group can safely receive. O- is the universal donor, AB+ the universal recipient.
 */
export const COMPATIBLE_DONORS: Record<BloodGroup, readonly BloodGroup[]> = {
    'O-': ['O-'],
    'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'],
    'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'],
    'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

const isBloodGroup = (value: unknown): value is BloodGroup =>
    typeof value === 'string' && (BLOOD_GROUPS as readonly string[]).includes(value);

/** Donor groups that can give to a patient of `recipient` (empty for an unknown group). */
export const compatibleDonorGroups = (recipient: unknown): BloodGroup[] =>
    isBloodGroup(recipient) ? [...COMPATIBLE_DONORS[recipient]] : [];

/** Patient groups a donor of `donor` can give to (empty for an unknown group). */
export const recipientGroupsFor = (donor: unknown): BloodGroup[] =>
    isBloodGroup(donor) ? BLOOD_GROUPS.filter(r => COMPATIBLE_DONORS[r].includes(donor)) : [];

/**
 * Minimum days between whole-blood donations (NBTC India guidance). Unknown
 * gender uses the longer window.
 */
export const DEFERRAL_DAYS = { male: 90, female: 120 } as const;

/** SQL predicate on the `donors d` alias: the donor's deferral window has passed. */
export const ELIGIBILITY_WINDOW_SQL =
    `(d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - ` +
    `(CASE WHEN d.gender = 'male' THEN ${DEFERRAL_DAYS.male} ELSE ${DEFERRAL_DAYS.female} END))`;
