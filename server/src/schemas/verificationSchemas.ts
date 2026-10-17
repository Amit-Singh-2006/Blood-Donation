import { z } from 'zod';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().default('');

/** A hospital sends its details for review (its documents are uploaded one by one first). */
export const verificationSubmissionSchema = z.object({
    registration_number: z.string().trim()
        .min(3, 'Enter the registration number printed on your certificate.')
        .max(100, 'The registration number is too long.'),
    registration_authority: z.string().trim()
        .min(3, 'Enter who issued the certificate, for example the district registering authority.')
        .max(120, 'Keep "issued by" under 120 characters.'),
    // ABDM Health Facility Registry ID: anyone can look it up at facility.abdm.gov.in
    hfr_id: z.string().trim().toUpperCase()
        .regex(/^([A-Z0-9]{6,20})?$/, 'An ABDM facility ID has 6 to 20 letters and digits.')
        .optional().default(''),
    blood_centre_licence: optionalText(60),
    authorised_person: z.string().trim()
        .min(3, 'Enter the name of the person the authorisation letter names.')
        .max(100, 'The name is too long.'),
    authorised_designation: z.string().trim()
        .min(2, 'Enter their designation, for example Blood Bank Officer.')
        .max(80, 'The designation is too long.'),
    declaration: z.literal(true, { error: 'Confirm that the documents are genuine and that you may register this hospital.' }),
});

const note = z.string().trim()
    .min(10, 'Tell the hospital what to fix, in at least 10 characters.')
    .max(500, 'Keep the note under 500 characters.');

/** An admin's decision on a hospital's verification. */
export const hospitalVerificationSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('approve'),
        // The two checks the admin confirms they did
        checks: z.object({
            documents_match: z.literal(true, { error: 'Confirm the documents match this hospital and are valid.' }),
            phone_confirmed: z.literal(true, { error: 'Confirm you phoned the hospital on a publicly listed number.' }),
        }, { error: 'Tick both checks before approving.' }),
        // The documents the admin reviewed (see utils/documents → documentsDigest)
        documents_digest: z.string().regex(/^[0-9a-f]{64}$/, 'Open the documents before approving.'),
    }),
    z.object({ action: z.literal('request_changes'), note }),
    z.object({ action: z.literal('revoke'), note }),
], { error: 'Choose approve, request changes or revoke.' });

/** The blood group a hospital's lab found for a donation. */
export const labBloodGroupSchema = z.object({
    blood_group: z.enum(BLOOD_GROUPS, { error: 'Choose the blood group your lab found.' }),
});
