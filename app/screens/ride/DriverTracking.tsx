import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Image } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { MapPlaceholder } from '../../components/MapPlaceholder';

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
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons } from '@expo/vector-icons';
import { useLocationStore } from '../../providers/LocationProvider';
import { useAuth } from '../../providers/AuthProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePaymentStore } from '../../providers/PaymentProvider';
import { haversineDistanceKm } from '../../utils/distance';
import { getImageUrl } from '../../utils/images';
import { getPusherClient, unsubscribeChannel } from '../../services/pusherClient';
import {
  subscribeToNetworkChanges,
  saveRideState,
  showNetworkErrorAlert,
  checkNetworkConnection
} from '../../utils/networkHandler';
import { useSmoothMarker } from '../../hooks/useSmoothMarker';

if (Mapbox) {
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
}

type RouteParams = {
  'screens/ride/DriverTracking': {
    vehicleName?: string;
    rideId?: number;
    driver?: {
      name?: string;
      phone?: string;
      photo?: string;
      vehicle?: {
        make?: string;
        model?: string;
        color?: string;
        license_plate?: string;
      };
    };
  } | undefined;
};

type LatLng = { latitude: number; longitude: number };

function WaitTimer({ arrivedAt }: { arrivedAt: string }) {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    const start = new Date(arrivedAt).getTime();
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [arrivedAt]);

  const grace = 5 * 60; // 5 min
  const isOverGrace = seconds > grace;
  const displaySeconds = isOverGrace ? seconds - grace : grace - seconds;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[timerStyles.timerCard, isOverGrace && timerStyles.timerCardAlert]}>
      <Ionicons
        name={isOverGrace ? "warning" : "hourglass-outline"}
        size={24}
        color={isOverGrace ? "#ef4444" : Colors.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={timerStyles.timerLabel}>
          {isOverGrace ? "Attente facturée" : "Délai de grâce"}
        </Text>
        <Text style={[timerStyles.timerValue, isOverGrace && timerStyles.timerValueAlert]}>
          {formatTime(displaySeconds)}
        </Text>
      </View>
      {isOverGrace && (
        <View style={timerStyles.feeBadge}>
          <Text style={timerStyles.feeText}>+{Math.floor(displaySeconds / 60) * 10} F</Text>
        </View>
      )}
    </View>
  );
}

const timerStyles = StyleSheet.create({
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timerCardAlert: {
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
  },
  timerLabel: {
    color: Colors.gray,
    fontSize: 12,
    fontFamily: Fonts.titilliumWeb,
  },
  timerValue: {
    color: Colors.black,
    fontSize: 18,
    fontFamily: Fonts.titilliumWebBold,
  },
  timerValueAlert: {
    color: '#ef4444',
  },
  feeBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  feeText: {
    color: '#ef4444',
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 12,
  },
});

export default function DriverTracking() {
  const router = useRouter();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'screens/ride/DriverTracking'>>();
  const { origin, destination, setOrigin: setOriginStore, setDestination: setDestinationStore } = useLocationStore();
  const vehicleNameParam = route.params?.vehicleName;
  const rideId = route.params?.rideId;
  const initialDriver = route.params?.driver;
  const { method, paymentStatus } = usePaymentStore();
  const { token } = useAuth();

  const cameraRef = React.useRef<any>(null);

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

  const [pickupPos, setPickupPos] = React.useState<LatLng | null>(null);
  const [destinationPos, setDestinationPos] = React.useState<LatLng | null>(null);
  const [driverPos, setDriverPos] = React.useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = React.useState<LatLng[]>([]);
  const [pickupAddress, setPickupAddress] = React.useState<string | undefined>(undefined);
  const [etaMin, setEtaMin] = React.useState<number | null>(null);
  const [distanceKm, setDistanceKm] = React.useState<number | null>(null);
  const [driverName, setDriverName] = React.useState<string | undefined>(initialDriver?.name);
  const [driverPhone, setDriverPhone] = React.useState<string | undefined>(initialDriver?.phone);
  const [driverPhoto, setDriverPhoto] = React.useState<string | undefined>(initialDriver?.photo);
  const [vehicleInfo, setVehicleInfo] = React.useState<{ make?: string; model?: string; color?: string; license_plate?: string } | undefined>(initialDriver?.vehicle);
  const [ratingAverage, setRatingAverage] = React.useState<number>(0);
  const [rideStatus, setRideStatus] = React.useState<string | undefined>(undefined);
  const [cancelling, setCancelling] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [arrivedAt, setArrivedAt] = React.useState<string | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = React.useState<number>(Date.now());
  const [isPolling, setIsPolling] = React.useState(false);

  const { lat: smoothLat, lng: smoothLng } = useSmoothMarker(driverPos);

  const handleCancel = () => {
    if (!rideId) return;

    Alert.alert(
      'Annuler la course',
      'Voulez-vous vraiment annuler votre course ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: () => {
            // Navigate to the reason selection screen
            router.push({
              pathname: '/screens/ride/CancelReason',
              params: { rideId: String(rideId) }
            });
          }
        },
      ]
    );
  };

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
    if (initialDriver.photo) {
      setDriverPhoto(getImageUrl(initialDriver.photo) || undefined);
    }
    if (initialDriver.vehicle) {
      setVehicleInfo(initialDriver.vehicle);
    }
    if ((initialDriver as any).rating_average) {
      setRatingAverage((initialDriver as any).rating_average);
    }
    if ((initialDriver as any).lat && (initialDriver as any).lng) {
      setDriverPos({
        latitude: Number((initialDriver as any).lat),
        longitude: Number((initialDriver as any).lng),
      });
    }
  }, [initialDriver]);

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

        const pickup = json.pickup || {};
        const dropoff = json.dropoff || {};

        if (pickup.address) {
          setPickupAddress(pickup.address);
          if (pickup.lat && pickup.lng) {
            const pPos = { latitude: Number(pickup.lat), longitude: Number(pickup.lng) };
            setPickupPos(pPos);
            if (!origin) {
              setOriginStore({ address: pickup.address, lat: pPos.latitude, lon: pPos.longitude });
            }
          }
        } else if (origin) {
          setPickupPos({ latitude: origin.lat, longitude: origin.lon });
          setPickupAddress(origin.address);
        }

        if (dropoff.lat && dropoff.lng) {
          const dPos = { latitude: Number(dropoff.lat), longitude: Number(dropoff.lng) };
          setDestinationPos(dPos);
          if (!destination) {
            setDestinationStore({ address: dropoff.address || 'Destination', lat: dPos.latitude, lon: dPos.longitude });
          }
        }
        if (json?.driver) {
          setDriverName(json.driver.name);
          setDriverPhone(json.driver.phone);
          if (json.driver.photo) {
            setDriverPhoto(getImageUrl(json.driver.photo) || undefined);
          }
          if (json.driver.vehicle) {
            setVehicleInfo(json.driver.vehicle);
          }
          if (json.driver.rating_average !== undefined) {
            setRatingAverage(json.driver.rating_average);
          }
          if (json.driver.lat && json.driver.lng) {
            setDriverPos({
              latitude: Number(json.driver.lat),
              longitude: Number(json.driver.lng),
            });
          }
        }
        if (json?.status) {
          setRideStatus(json.status);
          if (json.arrived_at) {
            setArrivedAt(json.arrived_at);
          }
          if (['ongoing', 'started'].includes(json.status)) {
            navigation.navigate({
              name: 'screens/ride/OngoingRide',
              params: { vehicleName: vehicleNameParam || 'Véhicule', rideId: String(rideId) }
            } as never);
          }
        }
      } catch {
        // ignore for now
      }
    })();
  }, [rideId, API_URL, origin]);

  // Poller le statut de la course (fallback seulement si WebSocket échoue)
  // Le WebSocket devrait gérer les événements ride.started, ride.completed, ride.cancelled
  React.useEffect(() => {
    if (!rideId || !API_URL || !isOnline) return;

    let cancelled = false;
    let lastWebSocketEvent = Date.now();

    // Vérifier périodiquement si le WebSocket fonctionne
    // Si pas d'événement depuis 60s, faire un polling de fallback
    const fallbackStatusInterval = setInterval(async () => {
      const timeSinceLastEvent = Date.now() - lastWebSocketEvent;

      // Si pas d'événement depuis 60s, faire un appel API de fallback
      if (timeSinceLastEvent > 60000) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (res.ok) {
            const json = await res.json().catch(() => null);
            if (json?.status && !cancelled) {
              setRideStatus(json.status);
              if (json.arrived_at) {
                setArrivedAt(json.arrived_at);
              }
              lastWebSocketEvent = Date.now();
            }
          }
        } catch {
          // ignore
        }
      }
    }, 30000); // Vérifier toutes les 30 secondes

    return () => {
      cancelled = true;
      clearInterval(fallbackStatusInterval);
    };
  }, [rideId, API_URL, isOnline]);

  // Surveiller la connexion réseau
  React.useEffect(() => {
    // Vérifier l'état initial
    checkNetworkConnection().then(state => setIsOnline(state.isConnected));

    // S'abonner aux changements de connexion
    const unsubscribe = subscribeToNetworkChanges((state) => {
      const wasOnline = isOnline;
      setIsOnline(state.isConnected);

      // Si on perd la connexion pendant une course active
      if (!state.isConnected && wasOnline && rideId) {
        // Sauvegarder l'état de la course
        saveRideState({ rideId, driverPos, rideStatus }).catch(() => { });
        // Afficher une alerte informative (non bloquante)
        showNetworkErrorAlert(true);
      }
    });

    return unsubscribe;
  }, [isOnline, rideId, driverPos, rideStatus]);

  // Fallback Polling
  React.useEffect(() => {
    if (!rideId || !API_URL || !isOnline) return;

    const interval = setInterval(async () => {
      const timeSinceLastUpdate = Date.now() - lastUpdateAt;

      // If no update for 10 seconds, poll (reduced from 20s for better responsiveness)
      if (timeSinceLastUpdate > 10000) {
        setIsPolling(true);
        try {
          const token = await AsyncStorage.getItem('authToken');
          const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();

            if (data.status) {
              setRideStatus(data.status);

              if (data.status === 'arrived' && data.arrived_at) {
                setArrivedAt(data.arrived_at);
              }

              if (['ongoing', 'started'].includes(data.status)) {
                navigation.navigate({
                  name: 'screens/ride/OngoingRide',
                  params: { vehicleName: vehicleNameParam || 'Véhicule', rideId: String(rideId) }
                } as never);
                return;
              }

              if (data.status === 'completed') {
                const p = data.pickup || {};
                const d = data.dropoff || {};
                navigation.navigate({
                  name: 'screens/ride/RideReceipt',
                  params: {
                    rideId: String(rideId),
                    amount: data.fare_amount || 0,
                    distanceKm: (data.distance_m || 0) / 1000,
                    vehicleName: vehicleNameParam || 'Véhicule',
                    paymentMethod: data.payment_method || method,
                    breakdown: data.breakdown,
                    pickupLat: p.lat,
                    pickupLng: p.lng,
                    dropoffLat: d.lat,
                    dropoffLng: d.lng,
                  }
                } as never);
                return;
              }
            }

            if (data.driver_lat && data.driver_lng) {
              setDriverPos({
                latitude: Number(data.driver_lat),
                longitude: Number(data.driver_lng),
              });
              setLastUpdateAt(Date.now());
            }
          }
        } catch (e) {
          console.warn('Fallback polling failed', e);
        } finally {
          setIsPolling(false);
        }
      }
    }, 5000); // Check every 5s

    return () => clearInterval(interval);
  }, [rideId, token, lastUpdateAt, API_URL, isOnline]);

  // Recenter map logic
  React.useEffect(() => {
    const target = driverPos ?? pickupPos ?? destinationPos ?? (origin ? { latitude: origin.lat, longitude: origin.lon } : null);
    if (!target) return;

    // Animate camera to target
    cameraRef.current?.setCamera({
      centerCoordinate: [target.longitude, target.latitude],
      zoomLevel: 14,
      animationDuration: 1000,
    });
  }, [driverPos, pickupPos, destinationPos, origin]);

  React.useEffect(() => {
    if (!rideId) return;

    let channel: any = null;
    let cancelled = false;

    const subscribe = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;
        const client = await getPusherClient(token);
        channel = client.subscribe(`private-ride.${rideId}`);
        channel.bind('driver.location.updated', (payload: any) => {
          if (cancelled) return;
          if (typeof payload?.lat === 'number' && typeof payload?.lng === 'number') {
            setDriverPos({
              latitude: payload.lat,
              longitude: payload.lng,
            });
            setLastUpdateAt(Date.now());
          }
          if (typeof payload?.eta_minutes === 'number') {
            setEtaMin(payload.eta_minutes);
          }
        });

        channel.bind('ride.started', (payload: any) => {
          if (cancelled) return;
          console.log('Ride started event received', payload);
          setRideStatus('ongoing');
          (window as any)._lastDriverLocationUpdate = Date.now();
          // Navigate to OngoingRide screen
          navigation.navigate({
            name: 'screens/ride/OngoingRide',
            params: { vehicleName: vehicleNameParam || 'Véhicule', rideId: String(rideId) }
          } as never);
        });

        channel.bind('ride.completed', (payload: any) => {
          if (cancelled) return;
          console.log('Ride completed event received', payload);
          setRideStatus('completed');
          navigation.navigate({
            name: 'screens/ride/RideReceipt',
            params: {
              rideId: String(rideId),
              amount: payload.fare_amount || 0,
              distanceKm: (payload.distance_m || 0) / 1000,
              vehicleName: vehicleNameParam || 'Véhicule',
              paymentMethod: method,
              breakdown: payload.breakdown, // Pass the breakdown
              pickupLat: pickupPos?.latitude,
              pickupLng: pickupPos?.longitude,
              dropoffLat: destinationPos?.latitude,
              dropoffLng: destinationPos?.longitude,
            }
          } as never);
        });

        channel.bind('ride.cancelled', (payload: any) => {
          if (cancelled) return;
          setRideStatus('cancelled');
          Alert.alert('Course annulée', 'La course a été annulée.');
          navigation.navigate('index' as never);
        });

        channel.bind('ride.arrived', (payload: any) => {
          if (cancelled) return;
          setRideStatus('arrived');
          if (payload.arrived_at) {
            setArrivedAt(payload.arrived_at);
          }
          console.log('Driver arrived event received', payload);
          Alert.alert('Chauffeur arrivé', 'Votre chauffeur est arrivé au point de prise en charge.');
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

  React.useEffect(() => {
    const lat1 = driverPos?.latitude;
    const lon1 = driverPos?.longitude;
    const lat2 = pickupPos?.latitude;
    const lon2 = pickupPos?.longitude;

    if (Number.isFinite(lat1) && Number.isFinite(lon1) &&
      Number.isFinite(lat2) && Number.isFinite(lon2)) {

      setRouteCoords([
        { latitude: lat1!, longitude: lon1! },
        { latitude: lat2!, longitude: lon2! }
      ]);

      const dist = haversineDistanceKm(
        { latitude: lat1!, longitude: lon1! },
        { latitude: lat2!, longitude: lon2! }
      );

      setDistanceKm(dist);
      // Average 25 km/h in urban area
      const etaMinutes = Math.max(1, Math.round((dist / 25) * 60));
      setEtaMin(etaMinutes);
    } else {
      setRouteCoords([]);
      setEtaMin(null);
      setDistanceKm(null);
    }
  }, [driverPos, pickupPos]);

  const pickupCoordinate = pickupPos ?? (origin ? { latitude: origin.lat, longitude: origin.lon } : null);

  const routeLine = React.useMemo(() => {
    if (routeCoords.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoords.map(c => [c.longitude, c.latitude])
      }
    };
  }, [routeCoords]);

  return (
    <View style={styles.container}>
      {Mapbox ? (
        <MapView
          style={StyleSheet.absoluteFill}
          attributionEnabled={false}
          logoEnabled={false}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: pickupPos ? [pickupPos.longitude, pickupPos.latitude] : [2.43, 6.37],
              zoomLevel: 14
            }}
          />

          {driverPos && (
            <PointAnnotation id="driver" coordinate={[smoothLng.value, smoothLat.value]}>
              <View style={styles.markerContainer}>
                <Ionicons name="car" size={24} color={Colors.black} />
              </View>
            </PointAnnotation>
          )}

          {pickupPos && (
            <PointAnnotation id="pickup" coordinate={[pickupPos.longitude, pickupPos.latitude]}>
              <View style={styles.markerContainer}>
                <Ionicons name="location" size={24} color="#f59e0b" />
              </View>
            </PointAnnotation>
          )}

          {routeLine && (
            <ShapeSource id="routeSource" shape={routeLine as any}>
              <LineLayer
                id="routeFill"
                style={{
                  lineColor: Colors.primary,
                  lineWidth: 4,
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

      {/* Bouton retour overlay */}
      <TouchableOpacity style={styles.backOverlay} onPress={() => (navigation as any).goBack?.()}>
        <Ionicons name="chevron-back" size={22} color={Colors.black} />
      </TouchableOpacity>

      {/* Badge de connexion */}
      {!isOnline && (
        <View style={styles.offlineBadge}>
          <Ionicons name="cloud-offline" size={14} color={Colors.white} />
          <Text style={styles.offlineText}>Hors ligne</Text>
        </View>
      )}

      {isOnline && (
        <View style={styles.glassPill}>
          <View style={[styles.statusDot, isPolling ? styles.pollingDot : styles.liveDot]} />
          <Text style={styles.pillText}>
            {isPolling ? 'Actualisation...' : 'Chauffeur en ligne'}
          </Text>
        </View>
      )}

      {/* Bottom sheet */}
      <View style={styles.premiumSheet}>
        <View style={styles.dragHandle} />

        <View style={styles.etaContainer}>
          <Text style={styles.etaLabel}>Arrivée estimée</Text>
          <Text style={styles.etaValue}>
            {etaMin !== null ? `${etaMin} min` : 'Calcul...'}
          </Text>
          {distanceKm !== null && (
            <Text style={styles.distanceLabel}>{distanceKm.toFixed(1)} km</Text>
          )}
        </View>

        {rideStatus === 'arrived' && arrivedAt && (
          <WaitTimer arrivedAt={arrivedAt} />
        )}

        <View style={styles.driverCard}>
          <View style={styles.driverInfoPrimary}>
            <View style={styles.profileContainer}>
              {driverPhoto ? (
                <Image source={{ uri: driverPhoto }} style={styles.driverPhoto} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={30} color={Colors.gray} />
                </View>
              )}
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#EAB308" />
                <Text style={styles.ratingText}>{ratingAverage > 0 ? ratingAverage.toFixed(1) : 'New'}</Text>
              </View>
            </View>

            <View style={styles.driverMainDetails}>
              <Text style={styles.driverNameText}>{driverName || 'Chauffeur'}</Text>
              <Text style={styles.vehicleText}>
                {vehicleInfo ? `${vehicleInfo.make} ${vehicleInfo.model} • ${vehicleInfo.color}` : 'Véhicule en route'}
              </Text>
              <Text style={styles.plateText}>{vehicleInfo?.license_plate || '---'}</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.contactActionBtn, styles.callAction]} onPress={() => handleCall(driverPhone)}>
              <Ionicons name="call" size={18} color={Colors.primary} />
              <Text style={styles.contactActionText}>Appeler</Text>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity style={[styles.contactActionBtn, styles.waAction]} onPress={() => handleWhatsApp(driverPhone)}>
              <Ionicons name="logo-whatsapp" size={18} color="#22C55E" />
              <Text style={styles.contactActionText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.addressSection}>
          <View style={styles.addressLine}>
            <View style={styles.dot} />
            <Text style={styles.addressValue} numberOfLines={1}>
              {pickupAddress || origin?.address || 'Chargement...'}
            </Text>
          </View>
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

        {method === 'wallet' && (
          <TouchableOpacity
            style={[styles.payBtn, paymentStatus === 'ready' && styles.payBtnDisabled]}
            onPress={() => navigation.navigate('screens/payment/PaymentOptions' as never)}
            disabled={paymentStatus === 'ready'}
          >
            <Text style={styles.payText}>{paymentStatus === 'ready' ? 'Paiement prêt' : 'Payer par portefeuille'}</Text>
          </TouchableOpacity>
        )}

        {rideStatus !== 'ongoing' && rideStatus !== 'completed' && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancelling && { opacity: 0.5 }]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            <Text style={styles.cancelText}>{cancelling ? 'Annulation...' : 'Annuler la course'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  offlineBadge: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  offlineText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: Fonts.titilliumWebBold,
  },
  glassPill: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  liveDot: { backgroundColor: '#22C55E' },
  pollingDot: { backgroundColor: '#F59E0B' },
  pillText: {
    fontSize: 12,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
  },
  premiumSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  etaContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  etaLabel: {
    fontSize: 11,
    color: Colors.gray,
    fontFamily: Fonts.titilliumWeb,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etaValue: {
    fontSize: 28,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.primary,
    marginTop: -2,
  },
  distanceLabel: {
    fontSize: 13,
    color: Colors.gray,
    fontFamily: Fonts.titilliumWeb,
    marginTop: -6,
  },
  driverCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  driverInfoPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileContainer: {
    position: 'relative',
  },
  driverPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingText: {
    fontSize: 9,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
    marginLeft: 2,
  },
  driverMainDetails: {
    flex: 1,
    marginLeft: 12,
  },
  driverNameText: {
    fontSize: 16,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
  },
  vehicleText: {
    fontSize: 11,
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
    marginTop: 1,
  },
  plateText: {
    fontSize: 11,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.primary,
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  contactActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  callAction: {},
  waAction: {},
  actionDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
  },
  contactActionText: {
    fontSize: 13,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
  },
  addressSection: {
    marginBottom: 16,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginRight: 12,
  },
  addressValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.titilliumWeb,
    color: Colors.black,
  },
  label: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  value: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  paymentRow: { flexDirection: 'row', alignItems: 'center', marginTop: -4, marginBottom: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, marginLeft: 6 },
  payBtn: { marginTop: 14, backgroundColor: Colors.primary, borderRadius: 12, alignItems: 'center', paddingVertical: 14 },
  payBtnDisabled: { backgroundColor: '#CBD5E1' },
  payText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold },
  cancelBtn: { backgroundColor: '#F1F5F9', borderRadius: 16, alignItems: 'center', paddingVertical: 16 },
  cancelText: { color: '#64748B', fontFamily: Fonts.titilliumWebBold, fontSize: 14 },
  backOverlay: { position: 'absolute', top: 56, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, zIndex: 100 },
  markerContainer: { padding: 4, backgroundColor: 'white', borderRadius: 20, elevation: 5 },
});
