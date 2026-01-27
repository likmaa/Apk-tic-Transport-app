// screens/ride/Confirm.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, ScrollView, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLocation from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocationStore } from '../../providers/LocationProvider';
import { usePaymentStore } from '../../providers/PaymentProvider';
import { useServiceStore } from '../../providers/ServiceProvider';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';

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

  if (Mapbox) {
    Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
  }
} catch (e) {
  Mapbox = null;
}

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
const PER_KM = 250;         // Prix par kilomètre (F CFA)
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
  const router = useRouter();
  const { passengerName, passengerPhone } = useLocalSearchParams();
  const { origin, destination, setOrigin, requestUserLocation } = useLocationStore();
  const { method } = usePaymentStore();
  const { serviceType, packageDetails } = useServiceStore();

  const [isLoading, setIsLoading] = useState(true);
  const [priceEstimate, setPriceEstimate] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState<'standard' | 'vip'>('standard');
  const [hasBaggage, setHasBaggage] = useState(false);
  const [luggageCount, setLuggageCount] = useState(0);
  const [routeGeometry, setRouteGeometry] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = ['15%', '50%', '90%'];
  const cameraRef = useRef<any>(null);

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
          router.back();
          return;
        }

        // Try to refine address
        const address = await reverseBackend(place.lat, place.lon);
        if (address) {
          setOrigin({ ...place, address });
        }
      } catch (error) {
        Alert.alert("Erreur", "Impossible de récupérer votre position.");
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    ensureOrigin();
  }, [origin, setOrigin, router]);

  // Logique pour calculer le prix
  useEffect(() => {
    if (!origin || !destination) return;
    const calculatePrice = async () => {
      try {
        if (!API_URL) {
          console.warn("⚠️ API_URL is missing in .env");
          return;
        }
        console.log(`📡 Fetching estimate from: ${API_URL}/routing/estimate`);
        const res = await fetch(`${API_URL}/routing/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickup: { lat: origin.lat, lng: origin.lon },
            dropoff: { lat: destination.lat, lng: destination.lon },
            vehicle_type: vehicleType,
            luggage_count: luggageCount,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`❌ Estimate API error (${res.status}):`, errorText);
          setPriceEstimate(-1); // Signal error
          return;
        }

        const data = await res.json();
        console.log("✅ Estimate received:", data);
        const serverPrice = data?.price as number | undefined;
        if (typeof serverPrice === 'number') {
          setPriceEstimate(serverPrice);
        } else {
          console.warn("⚠️ Price not found in response data");
          setPriceEstimate(-1);
        }

        if (typeof data?.distance_m === 'number') {
          setDistanceMeters(data.distance_m);
        }
        if (typeof data?.eta_s === 'number') {
          setDurationSeconds(data.eta_s);
        }
        if (data?.geometry) {
          setRouteGeometry(data.geometry);
        } else {
          console.warn("⚠️ No geometry in estimate response");
          setRouteGeometry(null);
        }
      } catch (err) {
        console.error("❌ Network error fetching estimate:", err);
        setPriceEstimate(-1);
      }
    };
    calculatePrice();
  }, [origin, destination, vehicleType, luggageCount]);

  // Fetch nearby drivers
  useEffect(() => {
    if (!origin || !API_URL) return;

    const fetchDrivers = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetch(`${API_URL}/passenger/drivers/nearby?lat=${origin.lat}&lng=${origin.lon}&radius=5`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setNearbyDrivers(data.drivers || []);
        }
      } catch (e) {
        console.warn('Failed to fetch nearby drivers', e);
      }
    };

    fetchDrivers();
    const interval = setInterval(fetchDrivers, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [origin]);

  const paymentLabel = (m: ReturnType<typeof usePaymentStore>['method']) => {
    const labels = { cash: 'Espèces', mobile_money: 'Mobile Money', card: 'Carte', wallet: 'Portefeuille', qr: 'QR Code' };
    return labels[m] || String(m);
  };

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const MAP_BOTTOM_PADDING = SCREEN_HEIGHT * 0.45;

  // Fit bounds when geometry is available
  useEffect(() => {
    if (origin?.lon && destination?.lon && cameraRef.current) {
      console.log("📸 Fitting camera to markers...");
      setTimeout(() => {
        cameraRef.current.setCamera({
          bounds: {
            ne: [Math.max(Number(origin.lon), Number(destination.lon)), Math.max(Number(origin.lat), Number(destination.lat))],
            sw: [Math.min(Number(origin.lon), Number(destination.lon)), Math.min(Number(origin.lat), Number(destination.lat))],
            paddingBottom: MAP_BOTTOM_PADDING + 80,
            paddingTop: 100,
            paddingLeft: 50,
            paddingRight: 50,
          },
          animationDuration: 2000,
        });
      }, 800);
    }
  }, [origin, destination]); // Trigger on coords even without geometry

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
      {/* Map Section - Background */}
      <View style={styles.mapBackground}>
        {Mapbox ? (
          <MapView
            style={StyleSheet.absoluteFill}
            attributionEnabled={false}
            logoEnabled={false}
          >
            <Camera
              ref={cameraRef}
              centerCoordinate={[origin.lon, origin.lat]}
              zoomLevel={12}
              padding={{ paddingBottom: MAP_BOTTOM_PADDING }}
            />

            {/* Fallback straight line if routing failed */}
            {!routeGeometry && origin && destination && (
              <ShapeSource
                id="straightLineSource"
                shape={{
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: [[origin.lon, origin.lat], [destination.lon, destination.lat]]
                  },
                  properties: {}
                }}
              >
                <LineLayer
                  id="straightLineLayer"
                  style={{
                    lineColor: Colors.gray,
                    lineWidth: 3,
                    lineDasharray: [2, 2],
                    lineJoin: 'round',
                    lineCap: 'round',
                  }}
                />
              </ShapeSource>
            )}

            {/* Itinerary Route */}
            {routeGeometry && (
              <ShapeSource
                id="routeSource"
                shape={{
                  type: 'Feature',
                  geometry: routeGeometry,
                  properties: {}
                }}
              >
                <LineLayer
                  id="routeLayerBackground"
                  style={{
                    lineColor: Colors.primary,
                    lineWidth: 12,
                    lineOpacity: 0.15,
                    lineJoin: 'round',
                    lineCap: 'round',
                  }}
                />
                <LineLayer
                  id="routeLayer"
                  style={{
                    lineColor: Colors.primary,
                    lineWidth: 6,
                    lineJoin: 'round',
                    lineCap: 'round',
                  }}
                />
              </ShapeSource>
            )}

            {/* Nearby Drivers Markers */}
            {nearbyDrivers.map((d) => (
              <PointAnnotation
                key={`driver-${d.id}`}
                id={`driver-${d.id}`}
                coordinate={[Number(d.lng), Number(d.lat)]}
              >
                <View style={styles.driverMarkerContainer}>
                  <MaterialCommunityIcons name="car" size={20} color={Colors.black} />
                </View>
              </PointAnnotation>
            ))}

            {/* Origin Marker */}
            <PointAnnotation id="origin" coordinate={[origin.lon, origin.lat]}>
              <View style={styles.originMarker}>
                <View style={styles.originDot} />
              </View>
            </PointAnnotation>

            {/* Destination Marker */}
            <PointAnnotation id="destination" coordinate={[destination.lon, destination.lat]}>
              <View style={styles.destinationMarker}>
                <View style={styles.destinationDot} />
              </View>
            </PointAnnotation>
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ fontFamily: Fonts.titilliumWebBold }}>Carte non disponible</Text>
          </View>
        )}

        <TouchableOpacity style={styles.floatingBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        handleIndicatorStyle={styles.sheetIndicator}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetTitle}>Récapitulatif de votre course</Text>

          {/* Trajet Court */}
          <View style={styles.routeSummaryCard}>
            <View style={styles.routeSummaryRow}>
              <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.summaryAddress} numberOfLines={1}>{origin.address}</Text>
            </View>
            <View style={styles.lineSmall} />
            <View style={styles.routeSummaryRow}>
              <View style={[styles.dot, { backgroundColor: Colors.secondary }]} />
              <Text style={styles.summaryAddress} numberOfLines={1}>{destination.address}</Text>
            </View>
          </View>

          {/* Sélection du Véhicule */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Type de véhicule</Text>
            {distanceMeters && (
              <View style={styles.distanceBadge}>
                <Ionicons name="navigate" size={12} color={Colors.primary} />
                <Text style={styles.distanceText}>{(distanceMeters / 1000).toFixed(1)} km</Text>
              </View>
            )}
          </View>

          <View style={styles.vehicleSelectionContainer}>
            <TouchableOpacity
              style={[styles.vehicleCard, vehicleType === 'standard' && styles.activeVehicleCard]}
              onPress={() => setVehicleType('standard')}
            >
              <View style={[styles.vehicleIconCircle, vehicleType === 'standard' && styles.activeIconCircle]}>
                <MaterialCommunityIcons
                  name="car-side"
                  size={32}
                  color={vehicleType === 'standard' ? Colors.white : Colors.primary}
                />
              </View>
              <Text style={[styles.vehicleCardName, vehicleType === 'standard' && styles.activeCardText]}>Standard</Text>
              <Text style={[styles.vehicleCardPrice, vehicleType === 'standard' && styles.activeCardText]}>
                {priceEstimate === -1 ? 'Erreur' : (priceEstimate ?
                  (vehicleType === 'standard' ? priceEstimate : Math.round(priceEstimate / 1.5)).toLocaleString('fr-FR') + ' F'
                  : '...')
                }
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vehicleCard, vehicleType === 'vip' && styles.activeVehicleCard]}
              onPress={() => setVehicleType('vip')}
            >
              <View style={[styles.vehicleIconCircle, vehicleType === 'vip' && styles.activeIconCircle, { backgroundColor: vehicleType === 'vip' ? Colors.primary : '#fef3c7' }]}>
                <MaterialCommunityIcons
                  name="car-estate"
                  size={32}
                  color={vehicleType === 'vip' ? Colors.white : '#b45309'}
                />
              </View>
              <Text style={[styles.vehicleCardName, vehicleType === 'vip' && styles.activeCardText]}>VIP</Text>
              <Text style={[styles.vehicleCardPrice, vehicleType === 'vip' && styles.activeCardText]}>
                {priceEstimate === -1 ? 'Erreur' : (priceEstimate ?
                  (vehicleType === 'vip' ? priceEstimate : Math.round(priceEstimate * 1.5)).toLocaleString('fr-FR') + ' F'
                  : '...')
                }
              </Text>
            </TouchableOpacity>
          </View>

          {/* Paiement */}
          <TouchableOpacity style={styles.optionCard} onPress={() => router.push('/screens/payment/PaymentOptions')}>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}>
                <Ionicons name="card-outline" size={22} color={Colors.primary} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionLabel}>Mode de paiement</Text>
                <Text style={styles.optionValue}>{paymentLabel(method)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
            </View>
          </TouchableOpacity>

          <View style={styles.optionCard}>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}>
                <MaterialCommunityIcons name="bag-personal" size={22} color={Colors.primary} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionLabel}>Bagages Volumineux (100F/u)</Text>
                <Text style={styles.optionValue}>
                  {luggageCount === 0 ? 'Pas de bagages' : `${luggageCount} bagage${luggageCount > 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={styles.counterContainer}>
                <TouchableOpacity
                  onPress={() => setLuggageCount(Math.max(0, luggageCount - 1))}
                  style={styles.counterBtn}
                >
                  <Ionicons name="remove" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{luggageCount}</Text>
                <TouchableOpacity
                  onPress={() => setLuggageCount(Math.min(3, luggageCount + 1))}
                  style={styles.counterBtn}
                >
                  <Ionicons name="add" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.priceContainer}>
              <View>
                <Text style={styles.priceLabel}>Prix total estimé</Text>
                {vehicleType === 'vip' && <Text style={styles.vipTag}>Inclus: Service VIP (+50%)</Text>}
              </View>
              <Text style={styles.priceText}>
                {priceEstimate === -1 ? 'Erreur de calcul' : (priceEstimate ? `${priceEstimate.toLocaleString('fr-FR')} FCFA` : '...')}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.confirmButton}
            disabled={submitting}
            onPress={async () => {
              if (priceEstimate === -1) {
                Alert.alert('Erreur', 'Impossible de calculer le prix. Vérifiez votre connexion.');
                return;
              }
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
                    passenger_name: passengerName,
                    passenger_phone: passengerPhone,
                    vehicle_type: vehicleType,
                    has_baggage: luggageCount > 0,
                    luggage_count: luggageCount,
                    payment_method: method,
                    service_type: serviceType, // course, livraison, deplacement
                    ...(serviceType === 'livraison' && packageDetails ? {
                      recipient_name: packageDetails.recipientName,
                      recipient_phone: packageDetails.recipientPhone,
                      package_description: packageDetails.description,
                      package_weight: packageDetails.weightKg,
                      is_fragile: packageDetails.fragile,
                    } : {}),
                  }),
                });

                const json = await res.json().catch(() => null);
                if (!res.ok || !json || !json.id) {
                  Alert.alert('Erreur', json?.message || 'Impossible de créer la course.');
                  return;
                }

                router.replace({
                  pathname: '/screens/ride/SearchingDriver',
                  params: {
                    rideId: String(json.id),
                    vehicleName: vehicleType === 'vip' ? 'VIP' : 'Standard',
                  }
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

          <View style={{ height: 40 }} />
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: 10, fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  mapBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F3F4F6' },
  floatingBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  sheetBackground: {
    backgroundColor: 'white',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetIndicator: { backgroundColor: '#e5e7eb', width: 40 },
  sheetTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 20,
  },
  scrollContent: { padding: 20, paddingBottom: 40 },
  routeSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  routeSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryAddress: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: Colors.black,
    flex: 1,
  },
  lineSmall: {
    height: 12,
    width: 2,
    backgroundColor: '#e5e7eb',
    marginLeft: 5,
    marginVertical: 2
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  originMarker: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  originDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  destinationMarker: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  destinationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.secondary },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  distanceText: { fontFamily: Fonts.titilliumWebBold, fontSize: 12, color: Colors.primary },

  vehicleSelectionContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  vehicleCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
    backgroundColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  activeVehicleCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  vehicleIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeIconCircle: {
    backgroundColor: Colors.primary,
  },
  vehicleCardName: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
  vehicleCardPrice: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 14, color: Colors.primary, marginTop: 4 },
  activeCardText: { color: Colors.black },

  optionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  optionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionTextContainer: { flex: 1 },
  optionLabel: { fontFamily: Fonts.titilliumWeb, fontSize: 12, color: Colors.gray },
  optionValue: { fontFamily: Fonts.titilliumWebBold, fontSize: 15, color: Colors.black, marginTop: 1 },

  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  priceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 14, color: Colors.gray },
  priceText: { fontFamily: Fonts.titilliumWebBold, fontSize: 24, color: Colors.primary },
  vipTag: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 11, color: Colors.primary, marginTop: 2 },

  confirmButton: { backgroundColor: Colors.secondary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 56, marginTop: 8 },
  confirmButtonText: { color: 'white', fontFamily: Fonts.titilliumWebBold, fontSize: 18 },

  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.lightGray, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  driverMarkerContainer: {
    padding: 4,
    backgroundColor: 'white',
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: '#eee'
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  counterValue: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
    marginHorizontal: 15,
    minWidth: 10,
    textAlign: 'center',
  },
});
