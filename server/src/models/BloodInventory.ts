export interface BloodInventory {
    id: number;
    hospital_id: number;
    blood_group: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
    units: number;
}
