import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { logger } from '../../utils/logger';

type User = {
    id: number;
    phone: string;
    role: string;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
};

type AuthContextType = {
    token: string | null;
    user: User | null;
    isLoading: boolean;
    signIn: (token: string, user: User) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const segments = useSegments();
    const router = useRouter();

    // Load token on mount
    useEffect(() => {
        const loadAuth = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('authToken');
                const storedUser = await AsyncStorage.getItem('authUser');

                if (storedToken) {
                    setToken(storedToken);
                    if (storedUser) {
                        setUser(JSON.parse(storedUser));
                    }
                    logger.info('Session restaurée', { userId: storedUser ? JSON.parse(storedUser)?.id : null });
                } else {
                    logger.info('Aucune session sauvegardée');
                }
            } catch (e) {
                logger.error('Erreur chargement auth', { error: String(e) });
            } finally {
                setIsLoading(false);
            }
        };
        loadAuth();
    }, []);

    // Route protection
    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === 'auth';
        const inWalkthrough = segments[0] === 'walkthrough';
        const inSplash = (segments as any)[0] === 'Splash' || (segments as any)[0] === 'index' || (segments as any).length === 0;

        const isAtRoot = (segments as any)[0] === 'index' || (segments as any).length === 0;

        // If not signed in and not in public areas, redirect to onboarding
        if (!token && !inAuthGroup && !inWalkthrough && !inSplash) {
            router.replace('/walkthrough/Walkthrough1');
        } else if (token && (inAuthGroup || inWalkthrough)) {
            // If signed in and in auth/walkthrough, redirect to home
            router.replace('/(tabs)');
        }
    }, [token, segments, isLoading]);

    const signIn = async (newToken: string, newUser: User) => {
        try {
            logger.info('Connexion utilisateur', { userId: newUser.id, phone: newUser.phone });
            setToken(newToken);
            setUser(newUser);
            await AsyncStorage.setItem('authToken', newToken);
            await AsyncStorage.setItem('authUser', JSON.stringify(newUser));

            // Register Push Notifications
            try {
                const { registerForPushNotificationsAsync, registerTokenWithBackend } = require('../utils/notificationHandler');
                const fcmToken = await registerForPushNotificationsAsync();
                if (fcmToken) {
                    await registerTokenWithBackend(fcmToken, newToken);
                    logger.info('Push notification enregistré');
                }
            } catch (notifyErr) {
                logger.warn('Push notification échoué', { error: String(notifyErr) });
            }
        } catch (e) {
            logger.error('Erreur connexion', { error: String(e) });
        }
    };

    const signOut = async () => {
        try {
            logger.info('Déconnexion utilisateur');
            setToken(null);
            setUser(null);
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('authUser');
        } catch (e) {
            logger.error('Erreur déconnexion', { error: String(e) });
        }
    };

    return (
        <AuthContext.Provider value={{ token, user, isLoading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
