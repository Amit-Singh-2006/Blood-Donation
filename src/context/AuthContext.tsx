import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthState {
    user: User | null;
    role: 'donor' | 'hospital' | 'admin' | null;
    loading: boolean;
    loginWithGoogle: (role: 'donor' | 'hospital' | 'admin') => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'donor' | 'hospital' | 'admin' | null>(() => {
        return (localStorage.getItem('userRole') as 'donor' | 'hospital' | 'admin') || null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async (selectedRole: 'donor' | 'hospital' | 'admin') => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            setUser(result.user);
            setRole(selectedRole);
            localStorage.setItem('userRole', selectedRole);
            // Store user object in the same shape as email/password login
            // so ProtectedRoute can read the role correctly
            localStorage.setItem('user', JSON.stringify({
                id: result.user.uid,
                name: result.user.displayName,
                email: result.user.email,
                role: selectedRole,
            }));
            // Set a dummy token so ProtectedRoute's token check passes
            localStorage.setItem('token', 'firebase-google-auth');
        } catch (error) {
            console.error("Error signing in with Google", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
            setRole(null);
            localStorage.removeItem('userRole');
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        } catch (error) {
            console.error("Error signing out", error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, loginWithGoogle, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
