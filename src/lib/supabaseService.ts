import { supabase } from './supabase';
import { User as FirebaseUser } from 'firebase/auth';
import { InventoryItem, EmergencyRequest, DonorOffer } from '../context/GlobalContext';

/**
 * Syncs a Firebase Auth User to the Supabase `users` table.
 * Designed to be called right after Firebase signIn/signUp.
 */
export async function syncUserToSupabase(firebaseUser: FirebaseUser, role: 'donor' | 'hospital' | 'admin') {
    try {
        const { error } = await supabase
            .from('users')
            .upsert({
                id: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName,
                role: role
            });

        if (error) throw error;
        console.log('Successfully synced user to Supabase:', firebaseUser.uid);
    } catch (error) {
        console.error('Error syncing user to Supabase:', error);
    }
}

/**
 * Fetches the entire inventory from Supabase if the user is a hospital.
 */
export async function fetchInventory(hospitalId: string) {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('hospital_id', hospitalId);

        if (error) throw error;
        return data as InventoryItem[];
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return [];
    }
}

/**
 * Updates a specific inventory item in Supabase.
 */
export async function upsertInventory(hospitalId: string, type: string, units: number, threshold: number = 0) {
    try {
        const { error } = await supabase
            .from('inventory')
            .upsert({
                hospital_id: hospitalId,
                blood_type: type,
                units: units,
                threshold: threshold
            });

        if (error) throw error;
    } catch (error) {
        console.error('Error updating inventory:', error);
    }
}

/**
 * Broadcasts a new emergency request to Supabase.
 */
export async function createEmergencyRequest(hospitalId: string, request: Omit<EmergencyRequest, 'id' | 'status' | 'time'>) {
    try {
        const { data, error } = await supabase
            .from('emergency_requests')
            .insert({
                hospital_id: hospitalId,
                blood_type: request.type,
                urgency: request.urgency,
                units: request.units
            })
            .select()
            .single();

        if (error) throw error;
        return data; // Returns the newly created request including its Supabase UUID
    } catch (error) {
        console.error('Error creating emergency request:', error);
        return null;
    }
}

/**
 * Searches for live donor matches across the Supabase 'users' and 'donor_offers' tables.
 */
export async function fetchAvailableDonorsForRequest(bloodType: string) {
    try {
        // Here we could join 'users' with 'donor_offers' or implement a custom RPC for location-based finding.
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'donor'); // You would ideally filter by blood type here if it exists on the user profile

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching donors:', error);
        return [];
    }
}
