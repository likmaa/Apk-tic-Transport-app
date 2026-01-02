// screens/ride/Confirm.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLocation from 'expo-location';
import { useNavigation } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocationStore } from '../../providers/LocationProvider';
import { usePaymentStore } from '../../providers/PaymentProvider';
import { useServiceStore } from '../../providers/ServiceProvider';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const reverseBackend = async (lat: number, lon: number): Promise<string | null> => {
  try {
    if (!API_URL) return null;
    const res = await fetch(`${API_URL}/geocoding/reverse?lat=${lat}&lon=${lon}&language=fr`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.address === 'string' ? data.address : null;
  } catch (e) {
    return null;
  }
};

// Tarifs configurables
const BASE_FARE = 500;      // Forfait de base (F CFA)
const PER_KM = 200;         // Prix par kilomètre (F CFA)
// Multiplicateurs par type de service
const SERVICE_MULTIPLIER: Record<string, number> = {
  deplacement: 1.0,
  course: 0.9,
  livraison: 1.15,
};

const truncateWords = (text: string | undefined | null, maxWords: number): string => {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
};

export default function ConfirmRide() {
  const navigation = useNavigation();
  const { origin, destination, setOrigin, requestUserLocation } = useLocationStore();
  const { method } = usePaymentStore();
  const { serviceType } = useServiceStore();

  const [isLoading, setIsLoading] = useState(true);
  const [priceEstimate, setPriceEstimate] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Logique pour s'assurer que l'origine est définie
  useEffect(() => {
    const ensureOrigin = async () => {
      if (origin) {
        setIsLoading(false);
        return;
      }
      try {
        const place = await requestUserLocation('origin');
        if (!place) {
          // Alert already shown by provider
          navigation.goBack();
          return;
        }

        // Try to refine address
        const address = await reverseBackend(place.lat, place.lon);
        if (address) {
          setOrigin({ ...place, address });
        }
      } catch (error) {
        Alert.alert("Erreur", "Impossible de récupérer votre position.");
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };
    ensureOrigin();
  }, [origin, setOrigin, navigation]);

  // Logique pour calculer le prix
  useEffect(() => {
    if (!origin || !destination) return;
    const calculatePrice = async () => {
      try {
        if (!API_URL) return;
        const res = await fetch(`${API_URL}/routing/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickup: { lat: origin.lat, lng: origin.lon },
            dropoff: { lat: destination.lat, lng: destination.lon },
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverPrice = data?.price as number | undefined;
        if (typeof serverPrice === 'number') {
          setPriceEstimate(serverPrice);
        }
        if (typeof data?.distance_m === 'number') {
          setDistanceMeters(data.distance_m);
        }
        if (typeof data?.duration_s === 'number') {
          setDurationSeconds(data.duration_s);
        }
      } catch { }
    };
    calculatePrice();
  }, [origin, destination, serviceType]);

  const paymentLabel = (m: ReturnType<typeof usePaymentStore>['method']) => {
    const labels = { cash: 'Espèces', mobile_money: 'Mobile Money', card: 'Carte', wallet: 'Portefeuille', qr: 'QR Code' };
    return labels[m] || String(m);
  };

  if (isLoading || !origin || !destination) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Finalisation de votre demande...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Récapitulatif</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Carte de Trajet */}
        <View style={styles.card}>
          <View style={styles.locationRow}>
            <View style={styles.locationDotContainer}>
              <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Départ</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>{truncateWords(origin.address, 8)}</Text>
            </View>
          </View>
          <View style={styles.line} />
          <View style={styles.locationRow}>
            <View style={styles.locationDotContainer}>
              <View style={[styles.dot, { backgroundColor: Colors.secondary }]} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Destination</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>{truncateWords(destination.address, 8)}</Text>
            </View>
          </View>
        </View>

        {/* Carte de Service */}
        <View style={styles.card}>
          <View style={styles.serviceHeader}>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}>
                <MaterialCommunityIcons name="car-clock" size={24} color={Colors.primary} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Standard</Text>
                <Text style={styles.optionSubtitle}>Arrivée dans ~5 min</Text>
              </View>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Prix estimé</Text>
            <Text style={styles.priceText}>
              {priceEstimate ? `${priceEstimate.toLocaleString('fr-FR')} FCFA` : '...'}
            </Text>
          </View>
        </View>

        {/* Carte de Paiement */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.paymentRow} onPress={() => (navigation as any).navigate('screens/payment/PaymentOptions')}>
            <View style={styles.optionIcon}>
              <Ionicons name="card-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Paiement</Text>
              <Text style={styles.optionSubtitle}>{paymentLabel(method)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Colors.gray} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer avec le bouton de confirmation */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.confirmButton}
          disabled={submitting}
          onPress={async () => {
            if (!origin || !destination || !priceEstimate) {
              Alert.alert('Erreur', 'Données de trajet manquantes.');
              return;
            }

            if (!API_URL) {
              Alert.alert('Erreur', 'API_URL non configurée.');
              return;
            }

            try {
              setSubmitting(true);
              const token = await AsyncStorage.getItem('authToken');
              const res = await fetch(`${API_URL}/trips/create`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  pickup: { lat: origin.lat, lng: origin.lon, label: origin.address },
                  dropoff: { lat: destination.lat, lng: destination.lon, label: destination.address },
                  distance_m: distanceMeters ?? 1000,
                  duration_s: durationSeconds ?? 600,
                  price: priceEstimate,
                }),
              });

              const json = await res.json().catch(() => null);
              if (!res.ok || !json || !json.id) {
                Alert.alert('Erreur', json?.message || 'Impossible de créer la course.');
                return;
              }

              (navigation as any).navigate('screens/ride/SearchingDriver', {
                origin,
                destination,
                priceEstimate,
                method,
                serviceType,
                rideId: json.id,
              });
            } catch (e) {
              Alert.alert('Erreur réseau', 'Impossible de contacter le serveur.');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Text style={styles.confirmButtonText}>{submitting ? 'Création de la course...' : 'Confirmer la commande'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: 10, fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 20, color: Colors.black },
  scrollContent: { padding: 20, paddingBottom: 140 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 50 },
  locationDotContainer: { width: 28, alignItems: 'center', paddingTop: 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { height: 30, width: 2, backgroundColor: Colors.lightGray, marginLeft: 13, marginVertical: 6 },
  locationTextContainer: { flex: 1, paddingRight: 10 },
  locationLabel: { fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.gray, marginBottom: 4 },
  locationAddress: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 16, color: Colors.black, lineHeight: 22 },
  serviceHeader: { marginBottom: 16 },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  optionIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  optionTextContainer: { flex: 1 },
  optionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
  optionSubtitle: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray, marginTop: 2 },
  priceContainer: { borderTopWidth: 1, borderTopColor: Colors.lightGray, paddingTop: 16, marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray },
  priceText: { fontFamily: Fonts.titilliumWebBold, fontSize: 20, color: Colors.primary },
  paymentRow: { flexDirection: 'row', alignItems: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, borderTopWidth: 1, borderTopColor: Colors.lightGray, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 5 },
  confirmButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  confirmButtonText: { color: 'white', fontFamily: Fonts.titilliumWebBold, fontSize: 18 },
});
