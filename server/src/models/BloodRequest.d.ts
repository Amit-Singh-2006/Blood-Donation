export interface BloodRequest {
    id: number;
    hospital_id: number;
    blood_group: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
    units_required: number;
    urgency: 'Normal' | 'Emergency' | 'Urgent';
    status: 'Open' | 'Fulfilled' | 'Cancelled';
    created_at?: Date;
}
//# sourceMappingURL=BloodRequest.d.ts.map