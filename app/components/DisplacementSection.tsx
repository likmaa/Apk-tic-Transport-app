import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, Image, Modal, StyleSheet, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../providers/LocationProvider';
import { EMBARKATION_POINTS } from '../data/embarkationPoints';
import { Colors, Fonts } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../providers/AuthProvider';

export default function DisplacementSection() {
  const router = useRouter();
  const { origin, setOrigin, destination, requestUserLocation } = useLocationStore();
  const { token } = useAuth();
  const [showEmbarkModal, setShowEmbarkModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());
  const [scheduleTime, setScheduleTime] = useState<Date>(new Date());
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [homeAddress, setHomeAddress] = useState<{
    id: number;
    label: string;
    full_address: string;
    lat?: number | null;
    lng?: number | null;
    type?: string | null;
  } | null>(null);
  const ads = [
    require('../../assets/images/tic1.jpg'),
    require('../../assets/images/tic2.jpg'),
    require('../../assets/images/tic3.jpg'),
  ];
  const adsRef = useRef<ScrollView | null>(null);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      currentIndexRef.current = (currentIndexRef.current + 1) % ads.length;
      adsRef.current?.scrollTo({ x: currentIndexRef.current * 232, animated: true });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const api = process.env.EXPO_PUBLIC_API_URL;
    if (!api) return;

    (async () => {
      try {
        if (!token) return;

        const res = await fetch(`${api}/passenger/addresses`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;

        const json = await res.json();
        if (!Array.isArray(json)) return;

        const home = json.find((a: any) => a.type === 'home' || a.label === 'Domicile');
        if (home) {
          setHomeAddress(home);
        }
      } catch {
        // silencieux pour ne pas gêner l'écran principal
      }
    })();
  }, []);

  useEffect(() => {
    if (!origin) setShowEmbarkModal(true);
  }, [origin]);

  const handleSelectEmbark = (p: { id: string; name: string; lat: number; lon: number; address?: string }) => {
    setOrigin({ address: p.address || p.name, lat: p.lat, lon: p.lon });
    setShowEmbarkModal(false);
  };

  const handleUseMyLocation = async () => {
    setShowEmbarkModal(false);
    await requestUserLocation();
  };

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const distanceMeters = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const R = 6371000; const dLat = (b.lat - a.lat) * Math.PI / 180; const dLon = (b.lon - a.lon) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180; const la2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    const d = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * d;
  };

  const computeLocalQuote = () => {
    const base = 200; let surcharge = 0;
    if (origin) {
      const overlaps = EMBARKATION_POINTS.filter(ep => distanceMeters({ lat: origin.lat, lon: origin.lon }, { lat: ep.lat, lon: ep.lon }) <= (ep.radiusMeters || 300)).length;
      if (overlaps > 1) surcharge = 100;
    }
    return base + surcharge;
  };

  const onSeePrice = async () => {
    setQuoting(true); setQuote(null);
    try {
      const api = process.env.EXPO_PUBLIC_API_URL;
      if (api && origin && destination) {
        const res = await fetch(`${api}/routing/estimate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickup: { lat: origin.lat, lng: origin.lon }, dropoff: { lat: destination.lat, lng: destination.lon } }) });
        if (res.ok) { const data = await res.json(); setQuote(typeof data?.price === 'number' ? data.price : computeLocalQuote()); } else { setQuote(computeLocalQuote()); }
      } else { setQuote(computeLocalQuote()); }
    } catch { setQuote(computeLocalQuote()); } finally { setQuoting(false); }
  };

  const canStartRide = !!origin && !!destination && !creating;

  return (
    <>
      <TouchableOpacity activeOpacity={0.8} style={styles.searchBox} onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'destination' } })}>
        <Ionicons name="search" size={20} color={Colors.gray} />
        <TextInput style={styles.searchInput} placeholder="Où allez-vous ?" placeholderTextColor={Colors.gray} editable={false} pointerEvents="none" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.suggestionItem} onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'origin' } })} onLongPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'origin', saveAs: 'home' } })}>
        <View style={styles.suggestionIcon}>
          <MaterialCommunityIcons name="home-outline" size={24} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.suggestionTitle}>Domicile</Text>
          <Text style={styles.suggestionDesc}>
            {homeAddress?.full_address || 'Ajouter ou modifier votre domicile'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.categoryGrid}>
        <TouchableOpacity style={styles.categoryCard} onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'destination' } })}>
          <MaterialCommunityIcons name="cart-outline" size={36} color={Colors.secondary} />
          <Text style={styles.categoryTitle}>Course immédiate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryCard} onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'destination' } })}>
          <MaterialCommunityIcons name="pill" size={36} color={Colors.secondary} />
          <Text style={styles.categoryTitle}>Course programmée</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryCard} onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'destination' } })}>
          <MaterialCommunityIcons name="bread-slice-outline" size={36} color={Colors.secondary} />
          <Text style={styles.categoryTitle}>Multi-arrêts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryCard} onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'destination' } })}>
          <MaterialCommunityIcons name="store-outline" size={36} color={Colors.secondary} />
          <Text style={styles.categoryTitle}>Inter-ville</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton pour créer une course classique avec recherche chauffeur */}
      {origin && destination && (
        <TouchableOpacity
          style={[styles.startRideButton, (!canStartRide) && { opacity: 0.6 }]}
          disabled={!canStartRide}
          onPress={async () => {
            if (!origin || !destination) return;
            if (!API_URL) {
              Alert.alert('Erreur', 'API_URL non configurée.');
              return;
            }

            try {
              setCreating(true);
              // user is guaranteed to be logged in by AuthProvider
              if (!token) {
                Alert.alert('Erreur', 'Utilisateur non authentifié.');
                return;
              }

              // 1) On tente de récupérer une estimation backend pour distance/durée/prix
              let distance_m = 1000;
              let duration_s = 600;
              let price = computeLocalQuote();

              try {
                const estRes = await fetch(`${API_URL}/routing/estimate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    pickup: { lat: origin.lat, lng: origin.lon },
                    dropoff: { lat: destination.lat, lng: destination.lon },
                  }),
                });
                if (estRes.ok) {
                  const data = await estRes.json().catch(() => null);
                  if (data) {
                    if (typeof data.distance_m === 'number') distance_m = data.distance_m;
                    if (typeof data.eta_s === 'number') duration_s = data.eta_s;
                    if (typeof data.price === 'number') price = data.price;
                  }
                }
              } catch { }

              // 2) Création de la course côté backend
              const res = await fetch(`${API_URL}/trips/create`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  pickup: { lat: origin.lat, lng: origin.lon, label: origin.address },
                  dropoff: { lat: destination.lat, lng: destination.lon, label: destination.address },
                  distance_m,
                  duration_s,
                  price,
                }),
              });

              const json = await res.json().catch(() => null);
              if (!res.ok || !json || !json.id) {
                Alert.alert('Erreur', json?.message || 'Impossible de créer la course.');
                return;
              }

              router.push({ pathname: '/screens/ride/SearchingDriverScreen', params: { rideId: String(json.id) } });
            } catch {
              Alert.alert('Erreur', 'Impossible de créer la course.');
            } finally {
              setCreating(false);
            }
          }}
        >
          <Text style={styles.startRideButtonText}>{creating ? 'Création de la course...' : 'Démarrer ma course'}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Publicités</Text>
      <ScrollView ref={adsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adsRow}>
        {ads.map((src, idx) => (
          <Image key={idx} source={src} style={styles.adImage} resizeMode="cover" />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.lightGray },
  searchInput: { flex: 1, height: 50, fontSize: 16, fontFamily: Fonts.titilliumWeb, color: Colors.black, marginLeft: 10, paddingTop: 13 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.lightGray, marginTop: -20 },
  suggestionIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: Colors.lightGray, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  suggestionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
  suggestionDesc: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 20 },
  categoryCard: { width: '48%', backgroundColor: Colors.white, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: Colors.lightGray },
  categoryTitle: { fontFamily: 'Titillium-SemiBold', fontSize: 14, color: Colors.black, textAlign: 'center' },
  sectionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black, marginBottom: 16 },
  adsRow: { paddingRight: 20 },
  adImage: { width: 220, height: 110, borderRadius: 10, marginRight: 12, backgroundColor: Colors.lightGray },
  startRideButton: { marginTop: 20, marginBottom: 16, backgroundColor: Colors.secondary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  startRideButtonText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },
});
