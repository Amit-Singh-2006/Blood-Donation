export interface Donor {
    id: number; // linked to User.id
    blood_group: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
    city: string;
    phone: string;
    last_donation_date?: Date;
    is_eligible: boolean;
}

