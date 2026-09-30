import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time');
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const campaignSchema = z.object({
    name: z.string().trim().min(3, 'Give the campaign a name').max(150),
    description: optionalText(2000),
    city: z.string().trim().min(2, 'Enter the city').max(100),
    state: optionalText(100),
    venue: z.string().trim().min(3, 'Enter the venue').max(200),
    address: optionalText(500),
    map_url: z.union([z.string().trim().url('Enter a valid map link').max(500), z.literal('')]).optional(),
    start_date: date,
    days: z.number().int().min(1, 'A campaign runs at least 1 day').max(30, 'A campaign can run at most 30 days'),
    start_time: time,
    end_time: time,
    rewards: optionalText(500),
    refreshments: optionalText(500),
    contact_phone: optionalText(20),
    target_donors: z.number().int().min(1).max(100000).optional(),
});

export const attendanceSchema = z.object({
    attended: z.boolean(),
    donated: z.boolean(),
    volume_ml: z.number().int().min(50).max(600).nullable().optional(),
    remarks: optionalText(300),
});

// Donor selection follows India's NBTC guidelines: 18–65 years, at least 45 kg,
// 90 days between donations (120 for women), and a same-day health declaration
const yes = (message: string) => z.literal(true, { message });
export const registrationSchema = z.object({
    name: z.string().trim().min(2, 'Enter your full name').max(100),
    email: z.string().trim().email('Enter a valid email address').max(150),
    phone: z.string().trim().min(10, 'Enter a valid mobile number').max(20),
    blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']),
    gender: z.enum(['male', 'female', 'other']),
    dob: date,
    weight_kg: z.number().int().min(30, 'Enter your weight in kg').max(250),
    city: optionalText(100),
    preferred_date: date.optional(),
    preferred_slot: optionalText(40),
    last_donation_date: date.optional(),
    health: z.object({
        feeling_well: yes('Please confirm you feel healthy'),
        no_recent_illness: yes('Please confirm you have had no fever, infection or antibiotics in the last 2 weeks'),
        no_tattoo_12m: yes('Please confirm you have had no tattoo, piercing or acupuncture in the last 12 months'),
        no_alcohol_24h: yes('Please confirm you will not drink alcohol in the 24 hours before donating'),
        not_pregnant: z.boolean().optional(),
        consent: yes('Please agree to share these details with the camp organisers'),
    }),
});

export const reviewSchema = z.object({
    target_type: z.enum(['hospital', 'donor', 'campaign']),
    target_id: z.number().int().positive(),
    context: z.string().regex(/^(donation|campaign):\d+$/),
    rating: z.number().int().min(1, 'Choose 1 to 5 stars').max(5),
    comment: optionalText(1000),
});
