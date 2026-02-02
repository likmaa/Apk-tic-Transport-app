import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Alert, TextInput, ScrollView } from 'react-native';
import { getPusherClient, unsubscribeChannel } from '../../services/pusherClient';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useRouter } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useServiceStore } from '../../providers/ServiceProvider';
import { usePaymentStore } from '../../providers/PaymentProvider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MapPlaceholder } from '../../components/MapPlaceholder';

type RootParams = {
  'screens/ride/RideReceipt': {
    rideId: string;
    amount: number;
    distanceKm: number;
    vehicleName: string;
    durationMin?: number;
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
    paymentMethod?: string;
    breakdown?: any;
  } | undefined;
};

export default function RideReceipt() {
  const router = useRouter();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/RideReceipt'>>();
  const rideId = route.params?.rideId;
  const amount = Number(route.params?.amount ?? 0);
  const distanceKm = Number(route.params?.distanceKm ?? 0);
  const vehicleName = route.params?.vehicleName ?? 'Standard';
  const durationMin = route.params?.durationMin ?? '--';
  const paymentMethod = route.params?.paymentMethod ?? 'cash';

  const [stars, setStars] = useState(5);
  const [tip, setTip] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [coords, setCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const breakdownRaw = route.params?.breakdown;
  const breakdown = React.useMemo(() => {
    if (!breakdownRaw) return null;
    try {
      return typeof breakdownRaw === 'string' ? JSON.parse(breakdownRaw) : breakdownRaw;
    } catch (e) {
      console.warn('Failed to parse breakdown', e);
      return null;
    }
  }, [breakdownRaw]);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let channel: any = null;

    if (rideId && (paymentMethod === 'qr' || paymentMethod === 'card')) {
      (async () => {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (!token) return;

          const client = await getPusherClient(token);
          channel = client.subscribe(`private-ride.${rideId}`);

          channel.bind('payment.confirmed', (data: any) => {
            if (!isMounted.current) return;
            console.log('[RideReceipt] Payment confirmed globally:', data);
            setPaymentVerified(true);
            Alert.alert(
              "Paiement Confirmé !",
              "Votre paiement a été reçu avec succès. Merci d'avoir utilisé TIC !",
              [{ text: "Super !" }]
            );
          });
        } catch (e) {
          console.warn('[RideReceipt] Pusher error:', e);
        }
      })();
    }

    return () => {
      isMounted.current = false;
      if (channel) {
        unsubscribeChannel(channel);
      }
    };
  }, [rideId, paymentMethod]);

  // Coordinates for Map
  const pickupLat = Number(route.params?.pickupLat ?? 0);
  const pickupLng = Number(route.params?.pickupLng ?? 0);
  const dropoffLat = Number(route.params?.dropoffLat ?? 0);
  const dropoffLng = Number(route.params?.dropoffLng ?? 0);

  const { serviceType } = useServiceStore();


  const tipOptions = [200, 500, 1000, 2000];

  // Center map on path
  const center = (pickupLat && dropoffLat) ? [(pickupLng + dropoffLng) / 2, (pickupLat + dropoffLat) / 2] : undefined;

  useEffect(() => {
    if (!pickupLat || !dropoffLat) return;
    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
        if (geometry && geometry.length) {
          setCoords(geometry.map(([lon, lat]) => ({ latitude: lat, longitude: lon })));
        } else {
          setCoords([{ latitude: pickupLat, longitude: pickupLng }, { latitude: dropoffLat, longitude: dropoffLng }]);
        }
      } catch {
        setCoords([{ latitude: pickupLat, longitude: pickupLng }, { latitude: dropoffLat, longitude: dropoffLng }]);
      }
    })();
  }, [pickupLat, dropoffLat, pickupLng, dropoffLng]);

  const routeLine = React.useMemo(() => {
    if (coords.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coords.map(c => [c.longitude, c.latitude])
      }
    };
  }, [coords]);

  const handleSubmitRating = async () => {
    if (!rideId) {
      router.replace('/');
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const API_URL = process.env.EXPO_PUBLIC_API_URL;

      const res = await fetch(`${API_URL}/passenger/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ride_id: rideId,
          stars,
          tip_amount: tip || 0,
        }),
      });

      if (res.ok) {
        Alert.alert('Merci !', 'Votre note a été enregistrée.', [
          { text: 'OK', onPress: () => router.replace('/') }
        ]);
      } else {
        const errorData = await res.json().catch(() => ({}));
        // If rating already exists, still allow user to continue
        if (res.status === 409) {
          router.replace('/');
        } else {
          console.warn('Rating error:', errorData);
          Alert.alert('Erreur', 'Impossible d\'enregistrer votre note. Veuillez réessayer.');
        }
      }
    } catch (e) {
      console.warn('Rating error:', e);
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* MAP BACKGROUND */}
      <View style={styles.mapContainer}>
        {Mapbox && pickupLat !== 0 ? (
          <MapView style={StyleSheet.absoluteFill} attributionEnabled={false} logoEnabled={false} scrollEnabled={false} zoomEnabled={false}>
            <Camera
              defaultSettings={{
                centerCoordinate: center || [pickupLng, pickupLat],
                zoomLevel: 12
              }}
            />
            <PointAnnotation id="pickup" coordinate={[pickupLng, pickupLat]}>
              <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
            </PointAnnotation>
            <PointAnnotation id="dropoff" coordinate={[dropoffLng, dropoffLat]}>
              <View style={[styles.dot, { backgroundColor: Colors.secondary }]} />
            </PointAnnotation>
            {routeLine && (
              <ShapeSource id="routeSource" shape={routeLine as any}>
                <LineLayer
                  id="routeFill"
                  style={{
                    lineColor: Colors.primary,
                    lineWidth: 4,
                    lineOpacity: 0.6,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </ShapeSource>
            )}
          </MapView>
        ) : (
          <MapPlaceholder style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.mapOverlay} />
      </View>

      {/* CONTENT WITH SCROLL */}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={{ height: 100 }} />

          <View style={styles.card}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            </View>
            <Text style={styles.title}>Course terminée !</Text>
            <Text style={styles.subHeader}>Le montant a été payé avec succès.</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Distance</Text>
                <Text style={styles.statValue}>{distanceKm.toFixed(1)} km</Text>
              </View>
              <View style={styles.verticalLine} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Durée</Text>
                <Text style={styles.statValue}>{durationMin} min</Text>
              </View>
              <View style={styles.verticalLine} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Prix</Text>
                <Text style={styles.statValue}>{(amount).toLocaleString('fr-FR')}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* BREAKDOWN SECTION */}
            <View style={styles.breakdownContainer}>
              <Text style={styles.sectionTitle}>Détails de la tarification</Text>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Prix de base (Prise en charge)</Text>
                <Text style={styles.breakdownValue}>{breakdown?.base_fare?.toLocaleString('fr-FR') || '--'} FCFA</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Distance ({distanceKm.toFixed(1)} km)</Text>
                <Text style={styles.breakdownValue}>{breakdown?.distance_fare?.toLocaleString('fr-FR') || '--'} FCFA</Text>
              </View>

              {breakdown?.luggage_fare > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Frais de bagages ({breakdown?.luggage_count})</Text>
                  <Text style={styles.breakdownValue}>{breakdown?.luggage_fare?.toLocaleString('fr-FR')} FCFA</Text>
                </View>
              )}

              {breakdown?.stop_fare > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Frais d'attente</Text>
                  <Text style={styles.breakdownValue}>{breakdown?.stop_fare?.toLocaleString('fr-FR')} FCFA</Text>
                </View>
              )}

              {breakdown?.surge_multiplier > 1 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Majoration (x{breakdown?.surge_multiplier})</Text>
                  <Text style={styles.breakdownValue}>Inclus</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* QR SCAN BUTTON */}
            {paymentMethod === 'qr' && !paymentVerified && (
              <View style={styles.qrSection}>
                <TouchableOpacity style={styles.qrButton} onPress={() => router.push('/screens/payment/ScanQR')}>
                  <Ionicons name="qr-code-outline" size={24} color="white" />
                  <Text style={styles.qrButtonText}>Scanner le QR Code</Text>
                </TouchableOpacity>
              </View>
            )}

            {paymentMethod === 'qr' && paymentVerified && (
              <View style={[styles.qrSection, { backgroundColor: '#ECFDF5', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={{ color: '#065F46', fontFamily: Fonts.titilliumWebBold }}>Paiement Terminé</Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* RATING SECTION */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>Notez votre chauffeur</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setStars(s)} style={{ padding: 5 }}>
                    <Ionicons
                      name={s <= stars ? "star" : "star-outline"}
                      size={32}
                      color={s <= stars ? "#fbbf24" : Colors.lightGray}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* TIP SECTION */}
            <View style={styles.tipSection}>
              <Text style={styles.tipTitle}>Ajouter un pourboire ?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tipOptions}>
                <TouchableOpacity
                  style={[styles.tipCard, tip === null && styles.tipCardActive]}
                  onPress={() => setTip(null)}
                >
                  <Text style={[styles.tipAmount, tip === null && styles.tipAmountActive]}>Non</Text>
                </TouchableOpacity>
                {tipOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.tipCard, tip === opt && styles.tipCardActive]}
                    onPress={() => setTip(opt)}
                  >
                    <Text style={[styles.tipAmount, tip === opt && styles.tipAmountActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailsRow}>
              <Text style={styles.totalLabel}>Total à payer</Text>
              <Text style={styles.totalValue}>{(amount + (tip || 0)).toLocaleString('fr-FR')} FCFA</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmitRating}
              disabled={loading}
            >
              <Text style={styles.primaryText}>{loading ? 'Envoi...' : "Terminer"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.receiptBtn} onPress={() => Alert.alert('Envoyé', 'Le reçu a été envoyé par email.')}>
              <Text style={styles.receiptBtnText}>Envoyer le reçu par email</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}


// Tentative d'importation sécurisée de Mapbox
let Mapbox: any = null;
let MapView: any = View;
let Camera: any = View;
let PointAnnotation: any = View;
let ShapeSource: any = View;
let LineLayer: any = View;

try {
  const MB = require('@rnmapbox/maps');
  Mapbox = MB.default || MB;
  MapView = MB.MapView;
  Camera = MB.Camera;
  PointAnnotation = MB.PointAnnotation;
  ShapeSource = MB.ShapeSource;
  LineLayer = MB.LineLayer;

  if (Mapbox && typeof Mapbox.setAccessToken === 'function') {
    Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
  }
} catch (e) {
  Mapbox = null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mapContainer: { height: '50%', width: '100%', position: 'absolute', top: 0, left: 0 },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.4)' },

  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },

  card: { backgroundColor: Colors.white, borderRadius: 24, padding: 24, shadowColor: Colors.black, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  successIcon: { alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 24, marginBottom: 4, textAlign: 'center' },
  subHeader: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, fontSize: 15, marginBottom: 24, textAlign: 'center' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 16, padding: 16 },
  statItem: { alignItems: 'center', flex: 1 },
  statLabel: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, fontSize: 12, marginBottom: 4 },
  statValue: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 15 },
  verticalLine: { width: 1, height: 24, backgroundColor: Colors.lightGray },

  divider: { height: 1, backgroundColor: Colors.lightGray, marginVertical: 20 },

  qrSection: { marginBottom: 20 },
  qrButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.black, borderRadius: 16, paddingVertical: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },
  qrButtonText: { fontFamily: Fonts.titilliumWebBold, color: '#fff', fontSize: 16 },

  ratingSection: { alignItems: 'center' },
  ratingTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black, marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 8 },

  tipSection: { alignItems: 'center' },
  tipTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black, marginBottom: 12 },
  tipOptions: { flexDirection: 'row', gap: 10, paddingBottom: 5 },
  tipCard: { backgroundColor: Colors.background, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.lightGray },
  tipCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tipAmount: { fontFamily: Fonts.titilliumWebSemiBold, color: Colors.black, fontSize: 14 },
  tipAmountActive: { color: Colors.white },

  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  totalLabel: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 18 },
  totalValue: { fontFamily: Fonts.titilliumWebBold, color: Colors.primary, fontSize: 22 },

  breakdownContainer: { width: '100%', gap: 12 },
  sectionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 14, color: Colors.gray, marginBottom: 4, textTransform: 'uppercase' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.black },
  breakdownValue: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 14, color: Colors.black },

  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  primaryText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },

  receiptBtn: { marginTop: 16, paddingVertical: 10, alignItems: 'center' },
  receiptBtnText: { fontFamily: Fonts.titilliumWebSemiBold, color: Colors.gray, fontSize: 14 },

  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'white' },
});
