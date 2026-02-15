import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
// Optional persistence without hard dependency
let AsyncStorage: any;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch { }
import { logger } from '../../utils/logger';

export type Place = {
  address: string;
  lat: number;
  lon: number;
};

export type LocationState = {
  origin: Place | null;
  destination: Place | null;
  home: Place | null;
  work: Place | null;
  setOrigin: (p: Place | null) => void;
  setDestination: (p: Place | null) => void;
  setWork: (p: Place | null) => void;
  reset: () => void;
  requestUserLocation: (target?: 'origin' | 'destination' | 'none') => Promise<Place | null>;
};

const Ctx = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [home, setHome] = useState<Place | null>(null);
  const [work, setWork] = useState<Place | null>(null);

  // Load favorites on mount
  useEffect(() => {
    (async () => {
      if (!AsyncStorage) return;
      try {
        const h = await AsyncStorage.getItem('fav_home');
        const w = await AsyncStorage.getItem('fav_work');
        if (h) setHome(JSON.parse(h));
        if (w) setWork(JSON.parse(w));
      } catch { }
    })();
  }, []);

  // Persist favorites when changed
  useEffect(() => {
    (async () => {
      if (!AsyncStorage) return;
      try { await AsyncStorage.setItem('fav_home', JSON.stringify(home)); } catch { }
    })();
  }, [home]);
  useEffect(() => {
    (async () => {
      if (!AsyncStorage) return;
      try { await AsyncStorage.setItem('fav_work', JSON.stringify(work)); } catch { }
    })();
  }, [work]);

  const value = useMemo<LocationState>(() => ({
    origin,
    destination,
    home,
    work,
    setOrigin,
    setDestination,
    setHome,
    setWork,
    reset: () => { setOrigin(null); setDestination(null); },
    requestUserLocation: async (target: 'origin' | 'destination' | 'none' = 'origin') => {
      try {
        const { requestForegroundPermissionsAsync, getCurrentPositionAsync, Accuracy } = await import('expo-location');
        const { status } = await requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          const { Alert, Linking } = await import('react-native');
          Alert.alert(
            'Permission requise',
            'Nous avons besoin de votre position pour vous trouver un chauffeur.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings() }
            ]
          );
          return null;
        }
        const loc = await getCurrentPositionAsync({ accuracy: Accuracy.Balanced });
        let lat = loc.coords.latitude;
        let lon = loc.coords.longitude;

        // Détection automatique du simulateur (San Francisco par défaut)
        // On redirige automatiquement vers Cotonou pour faciliter le développement
        if (Math.abs(lat - 37.77) < 0.1 && Math.abs(lon + 122.41) < 0.1) {
          logger.info('📍 Simulateur détecté (SF) → Cotonou');
          lat = 6.3703;
          lon = 2.3912;
        } else {
          logger.info('📍 Position GPS obtenue', { lat: lat.toFixed(4), lon: lon.toFixed(4) });
        }

        // Validation de la zone de service
        const { SERVICE_AREA } = await import('../config');
        const [minLon, minLat, maxLon, maxLat] = SERVICE_AREA.BOUNDS;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
          const { Alert } = await import('react-native');
          Alert.alert(
            'Zone non couverte',
            SERVICE_AREA.OUT_OF_ZONE_MESSAGE
          );
          logger.warn('Position hors zone de service', { lat, lon });
          return null;
        }

        // Tentative de géocodage inverse via le backend
        let address = 'Ma position';
        try {
          const API_URL = process.env.EXPO_PUBLIC_API_URL;
          if (API_URL) {
            const res = await fetch(`${API_URL}/geocoding/reverse?lat=${lat}&lon=${lon}&language=fr`);
            if (res.ok) {
              const data = await res.json();
              if (data?.address) address = data.address;
            }
          }
        } catch (e) {
          console.warn('Reverse geocoding error:', e);
        }

        const place = { address, lat, lon };

        if (target === 'origin') setOrigin(place);
        else if (target === 'destination') setDestination(place);

        return place;
      } catch (error) {
        console.warn('Location error:', error);
        return null;
      }
    },
  }), [origin, destination, home, work]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocationStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocationStore must be used within LocationProvider');
  return ctx;
}
