import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { useNavigation } from 'expo-router';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons } from '@expo/vector-icons';
import { useLocationStore } from '../../providers/LocationProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePaymentStore } from '../../providers/PaymentProvider';
import { haversineDistanceKm } from '../../utils/distance';
import { getPusherClient, unsubscribeChannel } from '../../services/pusherClient';

type RouteParams = {
  'screens/ride/DriverTracking': {
    vehicleName?: string;
    rideId?: number;
    driver?: {
      name?: string;
      phone?: string;
    };
  } | undefined;
};

type LatLng = { latitude: number; longitude: number };

export default function DriverTracking() {
  const navigation = useNavigation();
  const route = (require('@react-navigation/native') as typeof import('@react-navigation/native')).useRoute<
    import('@react-navigation/native').RouteProp<RouteParams, 'screens/ride/DriverTracking'>
  >();
  const { origin } = useLocationStore();
  const vehicleNameParam = route.params?.vehicleName;
  const rideId = route.params?.rideId;
  const initialDriver = route.params?.driver as { name?: string; phone?: string } | undefined;
  const { method, paymentStatus } = usePaymentStore();

  const paymentLabel = (m: ReturnType<typeof usePaymentStore>['method']) => {
    const labels: Record<string, string> = {
      cash: 'Espèces',
      mobile_money: 'Mobile Money',
      card: 'Carte bancaire',
      wallet: 'Portefeuille',
      qr: 'QR Code',
    };
    return labels[m] || String(m);
  };

  const [mapRegion, setMapRegion] = React.useState<Region | null>(null);
  const [pickupPos, setPickupPos] = React.useState<LatLng | null>(null);
  const [destinationPos, setDestinationPos] = React.useState<LatLng | null>(null);
  const [driverPos, setDriverPos] = React.useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = React.useState<LatLng[]>([]);
  const [pickupAddress, setPickupAddress] = React.useState<string | undefined>(undefined);
  const [etaMin, setEtaMin] = React.useState<number | null>(null);
  const [driverName, setDriverName] = React.useState<string | undefined>(initialDriver?.name);
  const [driverPhone, setDriverPhone] = React.useState<string | undefined>(initialDriver?.phone);
  const [rideStatus, setRideStatus] = React.useState<string | undefined>(undefined);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const sanitizePhone = (phone?: string) => phone?.replace(/[^\d+]/g, '');

  const handleCall = (phone?: string) => {
    const sanitized = sanitizePhone(phone);
    if (!sanitized) return;
    Linking.openURL(`tel:${sanitized}`).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir l'application Téléphone.")
    );
  };

  const handleWhatsApp = (phone?: string) => {
    const sanitized = sanitizePhone(phone);
    if (!sanitized) return;
    const digits = sanitized.replace(/[^\d]/g, '');
    if (!digits.length) return;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent("Bonjour, je souhaite vous contacter pour ma course.")}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp.")
    );
  };

  React.useEffect(() => {
    if (!initialDriver) return;
    setDriverName(initialDriver.name);
    setDriverPhone(initialDriver.phone);
  }, [initialDriver?.name, initialDriver?.phone]);

  // Charger les infos de la course
  React.useEffect(() => {
    if (!rideId || !API_URL) return;

    (async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) return;
        const json = await res.json();

        if (json?.pickup?.address) setPickupAddress(json.pickup.address);
        if (typeof json?.pickup?.lat === 'number' && typeof json?.pickup?.lng === 'number') {
          setPickupPos({ latitude: json.pickup.lat, longitude: json.pickup.lng });
        } else if (origin) {
          setPickupPos({ latitude: origin.lat, longitude: origin.lon });
        }
        if (typeof json?.dropoff?.lat === 'number' && typeof json?.dropoff?.lng === 'number') {
          setDestinationPos({ latitude: json.dropoff.lat, longitude: json.dropoff.lng });
        }
        if (json?.driver) {
          setDriverName(json.driver.name);
          setDriverPhone(json.driver.phone);
        }
        if (json?.status) {
          setRideStatus(json.status);
        }
      } catch {
        // ignore for now
      }
    })();
  }, [rideId, API_URL, origin]);

  React.useEffect(() => {
    if (!rideId || !API_URL) return;
    let cancelled = false;

    const refreshStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (!json || cancelled) return;
        if (json.status) setRideStatus(json.status);
      } catch {
        // ignore
      }
    };

    const interval = setInterval(refreshStatus, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rideId, API_URL]);

  // Poller la position du chauffeur
  React.useEffect(() => {
    if (!rideId || !API_URL) return;

    let cancelled = false;

    const fetchDriverLocation = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetch(`${API_URL}/passenger/rides/${rideId}/driver-location`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json?.lat === 'number' && typeof json?.lng === 'number') {
          if (!cancelled) {
            setDriverPos({ latitude: json.lat, longitude: json.lng });
          }
        }
      } catch {
        // ignore
      }
    };

    fetchDriverLocation();
    const interval = setInterval(fetchDriverLocation, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rideId, API_URL]);

  // Mettre à jour la région de la carte
  React.useEffect(() => {
    const target = driverPos ?? pickupPos ?? destinationPos ?? (origin ? { latitude: origin.lat, longitude: origin.lon } : null);
    if (!target) return;

    setMapRegion((prev) => ({
      latitude: target.latitude,
      longitude: target.longitude,
      latitudeDelta: prev?.latitudeDelta ?? 0.04,
      longitudeDelta: prev?.longitudeDelta ?? 0.04,
    }));
  }, [driverPos, pickupPos, destinationPos, origin]);

  React.useEffect(() => {
    if (!rideId) return;

    let channel: any = null;
    let cancelled = false;

    const subscribe = async () => {
      try {
        const client = await getPusherClient();
        channel = client.subscribe(`private-ride.${rideId}`);
        channel.bind('driver.location.updated', (payload: any) => {
          if (cancelled) return;
          if (typeof payload?.lat === 'number' && typeof payload?.lng === 'number') {
            setDriverPos({
              latitude: payload.lat,
              longitude: payload.lng,
            });
          }
          if (typeof payload?.eta_minutes === 'number') {
            setEtaMin(payload.eta_minutes);
          }
        });
      } catch (error) {
        console.warn('Realtime ride subscription failed', error);
      }
    };

    subscribe();

    return () => {
      cancelled = true;
      unsubscribeChannel(channel);
    };
  }, [rideId]);

  // Mettre à jour le tracé et l'ETA
  React.useEffect(() => {
    if (driverPos && pickupPos) {
      setRouteCoords([driverPos, pickupPos]);
      const distanceKm = haversineDistanceKm(driverPos, pickupPos);
      // Supposons 25 km/h de moyenne en milieu urbain
      const etaMinutes = Math.max(1, Math.round((distanceKm / 25) * 60));
      setEtaMin(etaMinutes);
    } else {
      setRouteCoords([]);
      setEtaMin(null);
    }
  }, [driverPos, pickupPos]);

  const currentRegion = mapRegion ?? {
    latitude: origin?.lat ?? 6.37,
    longitude: origin?.lon ?? 2.43,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };

  const pickupCoordinate = pickupPos ?? (origin ? { latitude: origin.lat, longitude: origin.lon } : null);

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={currentRegion}
        region={mapRegion ?? undefined}
        onRegionChangeComplete={setMapRegion}
      >
        {driverPos && <Marker coordinate={driverPos} title="Chauffeur" />}
        {pickupCoordinate && <Marker coordinate={pickupCoordinate} title="Pick-up" pinColor="#f59e0b" />}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={Colors.primary} strokeWidth={4} />
        )}
      </MapView>

      {/* Bouton retour overlay */}
      <TouchableOpacity style={styles.backOverlay} onPress={() => (navigation as any).goBack?.()}>
        <Ionicons name="chevron-back" size={22} color={Colors.black} />
      </TouchableOpacity>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Chauffeur en approche</Text>
        <Text style={styles.sheetSub}>
          {etaMin ? (
            <>Arrivée estimée dans <Text style={{ color: Colors.primary }}>{etaMin} min</Text></>
          ) : (
            "Localisation en cours..."
          )}
        </Text>

        <TouchableOpacity style={styles.driverCard} activeOpacity={0.8} onPress={() => navigation.navigate('screens/ride/ContactDriver' as never)}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{driverName || 'Chauffeur assigné'}</Text>
            <Text style={styles.driverCar}>{driverPhone || 'Numéro indisponible'}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleCall(driverPhone)}>
            <Ionicons name="call" size={18} color={Colors.black} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleWhatsApp(driverPhone)}>
            <Ionicons name="logo-whatsapp" size={18} color={Colors.black} />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={{ marginTop: 6 }}>
          <Text style={styles.label}>Point de prise en charge</Text>
          <Text style={styles.value} numberOfLines={2}>{pickupAddress || origin?.address || 'Chargement...'}</Text>
        </View>

        {/* Paiement sélectionné et statut */}
        <View style={styles.paymentRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Paiement</Text>
            <Text style={styles.value}>{paymentLabel(method)}</Text>
          </View>
          {paymentStatus === 'ready' && (
            <View style={styles.statusPill}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
              <Text style={styles.statusPillText}>Paiement prêt</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.payBtn, paymentStatus === 'ready' && styles.payBtnDisabled]}
          onPress={() => navigation.navigate('screens/payment/PaymentOptions' as never)}
          disabled={paymentStatus === 'ready'}
        >
          <Text style={styles.payText}>{paymentStatus === 'ready' ? 'Paiement prêt' : 'Payer maintenant'}</Text>
        </TouchableOpacity>

        {rideStatus !== 'ongoing' && rideStatus !== 'completed' && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() =>
              (navigation as any).navigate({ name: 'screens/map/PickLocation', params: { mode: 'destination' } })
            }
          >
            <Text style={styles.cancelText}>Annuler la course</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  sheetTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black },
  sheetSub: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, marginBottom: 12 },
  driverCard: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  driverName: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  driverCar: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  iconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  label: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  value: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  paymentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, marginLeft: 6 },
  payBtn: { marginTop: 14, backgroundColor: Colors.primary, borderRadius: 12, alignItems: 'center', paddingVertical: 14 },
  payBtnDisabled: { backgroundColor: Colors.lightGray },
  payText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold },
  cancelBtn: { marginTop: 12, backgroundColor: '#f97316', borderRadius: 12, alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
  cancelText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold },
  backOverlay: { position: 'absolute', top: 24, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
});
