export interface Donor {
    id: number;
    blood_group: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
    city: string;
    phone: string;
    last_donation_date?: Date;
    is_eligible: boolean;
}
//# sourceMappingURL=Donor.d.ts.map