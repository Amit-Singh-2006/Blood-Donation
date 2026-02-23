import React, { createContext, useContext, useState, ReactNode } from 'react';

// --- Types ---
export type NavItem = 'overview' | 'inventory' | 'requests' | 'map' | 'settings' | 'matching';

export interface EmergencyRequest {
    id: string;
    type: string;
    status: string;
    urgency: 'Critical' | 'Standard';
    time: string;
    units: number;
}

export interface InventoryItem {
    type: string;
    units: number;
    threshold: number;
}

export interface DonorOffer {
    id: string;
    name: string;
    type: string;
    distance: string;
    time: string;
}

export interface MatchableDonor {
    id: string;
    name: string;
    bloodType: string;
    distance: string;
    phone: string;
    lastDonation: string;
    status: 'Ready' | 'On Way' | 'Notified';
}

interface Notification {
    id: number;
    title: string;
    message: string;
    time: string;
    read: boolean;
}

interface Appointment {
    name: string;
    time: string;
    type: string;
    typeLabel: string;
}

interface GlobalState {
    inventory: InventoryItem[];
    requests: EmergencyRequest[];
    donorOffers: DonorOffer[];
    notifications: Notification[];
    appointments: Appointment[];
    activeTab: NavItem;
    lastRequestedType: string;

    // Actions
    updateInventory: (type: string, delta: number) => void;
    addRequest: (newRequest: Omit<EmergencyRequest, 'id' | 'status' | 'time'>) => void;
    acceptRequest: (id: string) => void;
    acceptDonorOffer: (id: string) => void;
    declineDonorOffer: (id: string) => void;
    setActiveTab: (tab: NavItem) => void;
    setLastRequestedType: (type: string) => void;
}

const GlobalContext = createContext<GlobalState | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
    const [activeTab, setActiveTab] = useState<NavItem>('overview');
    const [lastRequestedType, setLastRequestedType] = useState<string>('O-');

    const [inventory, setInventory] = useState<InventoryItem[]>([
        { type: 'A+', units: 428, threshold: 100 },
        { type: 'A-', units: 156, threshold: 50 },
        { type: 'B+', units: 289, threshold: 80 },
        { type: 'B-', units: 84, threshold: 40 },
        { type: 'AB+', units: 124, threshold: 60 },
        { type: 'AB-', units: 42, threshold: 30 },
        { type: 'O+', units: 562, threshold: 120 },
        { type: 'O-', units: 12, threshold: 100 },
    ]);

    const [requests, setRequests] = useState<EmergencyRequest[]>([
        { id: '882', type: 'O-', status: '8 Donors Notified', urgency: 'Critical', time: '12m ago', units: 5 },
        { id: '879', type: 'A+', status: '14 Donors Notified', urgency: 'Standard', time: '2h ago', units: 10 }
    ]);

    const [notifications, setNotifications] = useState<Notification[]>([
        { id: 1, title: 'Blood Request Fulfilled', message: 'Donor John D. is en route for Request #882', time: '2m ago', read: false },
        { id: 2, title: 'Low Stock Alert', message: 'O- blood type is below critical threshold', time: '1h ago', read: false },
        { id: 3, title: 'New Donor Match', message: '3 new donors found for Request #879', time: '2h ago', read: true },
    ]);

    const [appointments] = useState<Appointment[]>([
        { name: 'Alex Johnson', time: '10:30 AM', type: 'O-', typeLabel: 'Whole Blood' },
        { name: 'Maria Garcia', time: '02:00 PM', type: 'A+', typeLabel: 'Platelets' }
    ]);

    const [donorOffers, setDonorOffers] = useState<DonorOffer[]>([
        { id: 'off1', name: 'James Wilson', type: 'O-', distance: '2.4 km away', time: '5m ago' },
        { id: 'off2', name: 'Elena Rodriguez', type: 'A+', distance: '4.8 km away', time: '12m ago' },
        { id: 'off3', name: 'Robert Chen', type: 'B+', distance: '1.2 km away', time: '15m ago' },
    ]);

    // --- Handlers ---
    const updateInventory = (type: string, delta: number) => {
        setInventory(prev => prev.map(item =>
            item.type === type ? { ...item, units: Math.max(0, item.units + delta) } : item
        ));
        // Provide a small UI feedback hack for agent demonstration
        if (delta > 0) {
            addNotification('Inventory Updated', `Added ${delta} units of ${type}.`);
        } else {
            addNotification('Inventory Updated', `Removed ${Math.abs(delta)} units of ${type}.`);
        }
    };

    const acceptDonorOffer = (id: string) => {
        const offer = donorOffers.find(o => o.id === id);
        if (!offer) return;

        // Remove from offers
        setDonorOffers(prev => prev.filter(o => o.id !== id));

        // Fast-track add to inventory for demonstration
        updateInventory(offer.type, 1);

        // Add notification
        addNotification('Donation Offer Accepted', `You accepted a donation offer from ${offer.name} (${offer.type}).`);
    };

    const declineDonorOffer = (id: string) => {
        setDonorOffers(prev => prev.filter(o => o.id !== id));
    };

    const addRequest = (newRequest: Omit<EmergencyRequest, 'id' | 'status' | 'time'>) => {
        const request: EmergencyRequest = {
            ...newRequest,
            id: Math.floor(Math.random() * 1000).toString(),
            status: 'Searching for Donors',
            time: 'Just now'
        };
        setRequests(prev => [request, ...prev]);

        // Add notification
        addNotification('New Emergency Request Broadcasted', `${request.type} request #${request.id} is now live.`);
    };

    const acceptRequest = (id: string) => {
        setRequests(prev => prev.map(req =>
            req.id === id ? { ...req, status: 'Accepted & En Route' } : req
        ));
    };

    const addNotification = (title: string, message: string) => {
        setNotifications(prev => [{
            id: Date.now(),
            title,
            message,
            time: 'Just now',
            read: false
        }, ...prev]);
    };

    const value = {
        inventory,
        requests,
        donorOffers,
        notifications,
        appointments,
        activeTab,
        lastRequestedType,
        updateInventory,
        addRequest,
        acceptRequest,
        acceptDonorOffer,
        declineDonorOffer,
        setActiveTab,
        setLastRequestedType
    };

    return (
        <GlobalContext.Provider value={value}>
            {children}
        </GlobalContext.Provider>
    );
}

export function useGlobalContext() {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobalContext must be used within a GlobalProvider');
    }
    return context;
}
