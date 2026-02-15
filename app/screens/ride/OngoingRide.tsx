import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Share, Image, Modal, Platform, Linking, Alert } from 'react-native';
import { Colors, Shadows } from '../../theme';
import { Fonts } from '../../font';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { type RouteProp } from '@react-navigation/native';
import { MapPlaceholder } from '../../components/MapPlaceholder';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useLocationStore } from '../../providers/LocationProvider';
import { useServiceStore } from '../../providers/ServiceProvider';
import { useAuth } from '../../providers/AuthProvider';
import { getPusherClient, unsubscribeChannel } from '../../services/pusherClient';
import {
  subscribeToNetworkChanges,
  saveRideState,
  showNetworkErrorAlert,
  checkNetworkConnection,
  fetchWithRetry
} from '../../utils/networkHandler';
import { useSmoothMarker } from '../../hooks/useSmoothMarker';
import { getImageUrl } from '../../utils/images';

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

// Mapbox setup handled in catchable block above

type RootParams = {
  'screens/ride/OngoingRide': { vehicleName: string; rideId: string } | undefined;
};

export default function OngoingRide() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ vehicleName: string; rideId: string }>();
  const vehicleName = params.vehicleName || 'Standard';
  const rideId = params.rideId;

  const { serviceType, packageDetails } = useServiceStore();
  const { token, user } = useAuth();
  const lastProcessedStatus = React.useRef<string | null>(null);

  const [eta, setEta] = React.useState<number | null>(null);
  const [center, setCenter] = React.useState<[number, number] | undefined>(undefined);
  const [coords, setCoords] = React.useState<Array<{ latitude: number; longitude: number }>>([]);
  const [driverPos, setDriverPos] = React.useState<LatLng | null>(null);
  const [rideData, setRideData] = React.useState<any>(null);
  const [isOnline, setIsOnline] = React.useState(true);
  const [stopStartedAt, setStopStartedAt] = React.useState<string | null>(null);
  const [totalStopDurationS, setTotalStopDurationS] = React.useState<number>(0);
  const [liveStopSeconds, setLiveStopSeconds] = React.useState<number>(0);
  const [lastUpdateAt, setLastUpdateAt] = React.useState<number>(Date.now());
  const [isPolling, setIsPolling] = React.useState(false);

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

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // Fetch ride data
  React.useEffect(() => {
    if (!rideId || !token || !API_URL) return;

    (async () => {
      try {
        const res = await fetchWithRetry(`${API_URL}/passenger/rides/${rideId}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          setRideData(json);
          setStopStartedAt(json.stop_started_at);
          setTotalStopDurationS(json.total_stop_duration_s || 0);
        }
      } catch (e) {
        console.error('Error fetching ride data:', e);
      }
    })();
  }, [rideId, token, API_URL]);

  // Pusher for real-time driver updates and status
  React.useEffect(() => {
    if (!rideId || !token) return;

    let channel: any = null;
    let cancelled = false;

    const subscribe = async () => {
      try {
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
        });

        channel.bind('ride.stop.updated', (payload: any) => {
          if (cancelled) return;
          setStopStartedAt(payload.stop_started_at);
          setTotalStopDurationS(payload.total_stop_duration_s || 0);
        });

        channel.bind('ride.completed', (payload: any) => {
          if (cancelled) return;
          if (lastProcessedStatus.current === 'completed') return;
          lastProcessedStatus.current = 'completed';

          router.replace({
            pathname: '/screens/ride/RideReceipt',
            params: {
              rideId: String(rideId),
              amount: payload.fare_amount || rideData?.fare_amount || 0,
              distanceKm: (payload.distance_m || rideData?.distance_m || 0) / 1000,
              vehicleName,
              breakdown: payload.breakdown ? JSON.stringify(payload.breakdown) : undefined,
              pickupLat: origin?.lat || rideData?.pickup_lat || 0,
              pickupLng: origin?.lon || rideData?.pickup_lng || 0,
              dropoffLat: destination?.lat || rideData?.dropoff_lat || 0,
              dropoffLng: destination?.lon || rideData?.dropoff_lng || 0,
              paymentMethod: rideData?.payment_method || 'cash',
            }
          });
        });

        channel.bind('ride.arrived', (payload: any) => {
          if (cancelled) return;
          setRideData((prev: any) => prev ? { ...prev, status: 'arrived', arrived_at: payload.arrived_at } : prev);
        });

        channel.bind('ride.started', (payload: any) => {
          if (cancelled) return;
          setRideData((prev: any) => prev ? { ...prev, status: 'ongoing', started_at: payload.started_at } : prev);
        });

      } catch (error) {
        console.warn('Realtime ride subscription failed', error);
      }
    };

    subscribe();

    return () => {
      cancelled = true;
      if (channel) {
        unsubscribeChannel(channel);
      }
    };
  }, [rideId, token, vehicleName, router]);

  // Fallback Polling
  React.useEffect(() => {
    if (!rideId || !token || !API_URL) return;

    const interval = setInterval(async () => {
      const timeSinceLastUpdate = Date.now() - lastUpdateAt;

      // If no update for 10 seconds, poll (reduced from 20s for better responsiveness)
      if (timeSinceLastUpdate > 10000) {
        setIsPolling(true);
        try {
          const res = await fetchWithRetry(`${API_URL}/passenger/rides/${rideId}`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();

            // Update ride data including potential status change
            if (data?.status === 'completed') {
              if (lastProcessedStatus.current === 'completed') return;
              lastProcessedStatus.current = 'completed';

              router.replace({
                pathname: '/screens/ride/RideReceipt',
                params: {
                  rideId: String(rideId),
                  amount: data.fare_amount || 0,
                  distanceKm: (data.distance_m || 0) / 1000,
                  vehicleName,
                  breakdown: data.breakdown ? JSON.stringify(data.breakdown) : undefined,
                  pickupLat: data.pickup_lat || 0,
                  pickupLng: data.pickup_lng || 0,
                  dropoffLat: data.dropoff_lat || 0,
                  dropoffLng: data.dropoff_lng || 0,
                  paymentMethod: data.payment_method || 'cash',
                }
              });
              return;
            }

            setRideData(data);

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
  }, [rideId, token, lastUpdateAt, API_URL]);

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
        saveRideState({ rideId, driverPos, rideData }).catch(() => { });
        // Afficher une alerte informative (non bloquante)
        showNetworkErrorAlert(true);
      } else if (state.isConnected && !wasOnline && rideId) {
        // Reconnexion : recharger les données
        if (API_URL && token) {
          fetchWithRetry(`${API_URL}/passenger/rides/${rideId}`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          })
            .then(res => res.ok && res.json())
            .then(json => json && setRideData(json))
            .catch(() => { });
        }
      }
    });

    return unsubscribe;
  }, [isOnline, rideId, driverPos, rideData, API_URL, token]);

  // Sauvegarder l'état périodiquement
  React.useEffect(() => {
    if (!rideId || !rideData) return;

    const saveInterval = setInterval(() => {
      saveRideState({ rideId, driverPos, rideData }).catch(() => { });
    }, 30000); // Toutes les 30 secondes

    return () => clearInterval(saveInterval);
  }, [rideId, driverPos, rideData]);

  /* Recovery logic components */
  const { origin, destination, setOrigin: setStoreOrigin, setDestination: setStoreDestination } = useLocationStore();

  // Recovery: if store is empty, but we have rideData, fill the local store
  React.useEffect(() => {
    if (rideData && (!origin || !destination)) {
      if (rideData.pickup?.lat && rideData.pickup?.lng) {
        setStoreOrigin({
          address: rideData.pickup.address || 'Point de départ',
          lat: Number(rideData.pickup.lat),
          lon: Number(rideData.pickup.lng),
        });
      }
      if (rideData.dropoff?.lat && rideData.dropoff?.lng) {
        setStoreDestination({
          address: rideData.dropoff.address || 'Destination',
          lat: Number(rideData.dropoff.lat),
          lon: Number(rideData.dropoff.lng),
        });
      }
    }
  }, [rideData, origin, destination]);

  React.useEffect(() => {
    if (!origin || !destination) return;

    const lat1 = Number(origin.lat);
    const lon1 = Number(origin.lon);
    const lat2 = Number(destination.lat);
    const lon2 = Number(destination.lon);

    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return;

    setCenter([(lon1 + lon2) / 2, (lat1 + lat2) / 2]);

    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
        if (geometry && geometry.length) {
          setCoords(geometry.map(([lon, lat]) => ({ latitude: lat, longitude: lon })));

          const durationS = data?.routes?.[0]?.duration ?? 0;
          setEta(Math.max(1, Math.round(durationS / 60)));
        } else if (origin && destination) {
          setCoords([
            { latitude: origin.lat, longitude: origin.lon },
            { latitude: destination.lat, longitude: destination.lon },
          ]);
        }
      } catch {
        if (origin && destination) {
          setCoords([
            { latitude: origin.lat, longitude: origin.lon },
            { latitude: destination.lat, longitude: destination.lon },
          ]);
        }
      }
    })();
  }, [origin, destination]);

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

  // Live counter effect
  React.useEffect(() => {
    let interval: any;
    if (stopStartedAt) {
      const start = new Date(stopStartedAt).getTime();
      interval = setInterval(() => {
        const now = new Date().getTime();
        setLiveStopSeconds(Math.floor((now - start) / 1000));
      }, 1000);
    } else {
      setLiveStopSeconds(0);
    }
    return () => clearInterval(interval);
  }, [stopStartedAt]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <View style={styles.container}>
      {/* Badge de connexion */}
      {!isOnline && (
        <View style={styles.offlineBadge}>
          <MaterialCommunityIcons name="cloud-off-outline" size={14} color={Colors.white} />
          <Text style={styles.offlineText}>Hors ligne</Text>
        </View>
      )}

      {isOnline && (
        <View style={[styles.statusBadge, isPolling ? styles.pollingBadge : styles.liveBadge]}>
          <View style={[styles.pulseCircle, isPolling ? styles.pollingCircle : styles.liveCircle]} />
          <Text style={styles.statusText}>{isPolling ? 'Mise à jour (API)...' : 'Temps réel'}</Text>
        </View>
      )}

      {/* Carte en plein écran */}
      <View style={StyleSheet.absoluteFill}>
        {Mapbox ? (
          <MapView style={StyleSheet.absoluteFill} attributionEnabled={false} logoEnabled={false}>
            <Camera
              centerCoordinate={center || [2.4333, 6.3667]}
              zoomLevel={center ? 13 : 11}
              animationDuration={1000}
            />

            {origin && (
              <PointAnnotation id="origin" coordinate={[origin.lon, origin.lat]}>
                <View style={styles.markerContainer}>
                  <Ionicons name="location" size={20} color={Colors.primary} />
                </View>
              </PointAnnotation>
            )}

            {destination && (
              <PointAnnotation id="destination" coordinate={[destination.lon, destination.lat]}>
                <View style={styles.markerContainer}>
                  <Ionicons name="flag" size={20} color={'#f59e0b'} />
                </View>
              </PointAnnotation>
            )}

            {driverPos && (
              <PointAnnotation
                id="driver"
                coordinate={[driverPos.longitude, driverPos.latitude]}
              >
                <View style={styles.markerContainer}>
                  <Ionicons name="car" size={22} color={Colors.black} />
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
      </View>

      {/* Overlay Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerIndicator} />
        <View>
          <Text style={styles.headerTitle}>En route !</Text>
          <Text style={styles.headerSub}>Destination : {destination?.address || '...'}</Text>
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <View style={styles.etaRow}>
          <Text style={styles.sheetTitle}>Course en cours</Text>
          <View style={[styles.statusBadge_pill, { backgroundColor: '#E0F2FE' }]}>
            <View style={[styles.pulseCircle_small, { backgroundColor: Colors.primary }]} />
            <Text style={[styles.statusText_pill, { color: Colors.primary }]}>
              {eta ? `${eta} min restants` : 'Calcul...'}
            </Text>
          </View>
        </View>

        <View style={[styles.driverCard, Shadows.md]}>
          <View style={styles.driverCore}>
            <Image
              source={rideData?.driver?.photo ? { uri: getImageUrl(rideData.driver.photo) } : require('../../../assets/images/LOGO_OR.png')}
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.driverName} numberOfLines={1}>
                  {rideData?.driver?.name || 'Chauffeur'}
                </Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text style={styles.ratingText}>
                    {rideData?.driver?.rating_average ? Number(rideData.driver.rating_average).toFixed(1) : '5.0'}
                  </Text>
                </View>
              </View>
              <Text style={styles.driverSub} numberOfLines={1}>
                {rideData?.driver?.vehicle
                  ? `${rideData.driver.vehicle.make} ${rideData.driver.vehicle.model} • `
                  : `${vehicleName} • `}
                <Text style={{ color: Colors.primary }}>
                  {rideData?.driver?.vehicle?.license_plate || rideData?.driver?.vehicle_number || '---'}
                </Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => router.push({
                pathname: '/screens/ride/ContactDriver',
                params: {
                  driverName: rideData?.driver?.name,
                  vehicleName: rideData?.driver?.vehicle ? `${rideData.driver.vehicle.make} ${rideData.driver.vehicle.model}` : vehicleName,
                  driverImage: rideData?.driver?.photo,
                  vehiclePlate: rideData?.driver?.vehicle?.license_plate || rideData?.driver?.vehicle_number,
                  driverPhone: rideData?.driver?.phone,
                  pickupTime: rideData?.started_at,
                  destination: destination?.address || rideData?.dropoff?.address
                }
              })}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={Colors.gray} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.contactActionBtn, styles.callAction]}
              onPress={() => handleCall(rideData?.driver?.phone)}
            >
              <Ionicons name="call" size={18} color={Colors.primary} />
              <Text style={styles.contactActionText}>Appeler</Text>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={[styles.contactActionBtn, styles.waAction]}
              onPress={() => handleWhatsApp(rideData?.driver?.phone)}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#22C55E" />
              <Text style={styles.contactActionText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.consumptionBtn, Shadows.md]}
          onPress={() => router.push({ pathname: '/screens/ride/RideConsumption', params: { rideId: String(rideId) } })}
        >
          <View style={styles.consumptionIconCircle}>
            <Ionicons name="speedometer-outline" size={20} color={Colors.white} />
          </View>
          <Text style={styles.consumptionText}>Suivre la consommation (FCFA)</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.white} style={{ opacity: 0.6 }} />
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              const driverInfo = rideData?.driver ? `${rideData.driver.name} en ${rideData.driver.vehicle ? `${rideData.driver.vehicle.make} ${rideData.driver.vehicle.model}` : vehicleName} (${rideData.driver.vehicle?.license_plate || rideData?.driver?.vehicle_number || '---'})` : 'un chauffeur TIC';
              const pickupT = formatTime(rideData?.started_at);
              const dest = destination?.address || rideData?.dropoff?.address || 'Destination';

              const shareMsg = `Je suis en route avec TIC ! 🚕\n\n` +
                `👤 Chauffeur : ${driverInfo}\n` +
                `📍 Destination : ${dest}\n` +
                (pickupT ? `⏰ Prise en charge : ${pickupT}\n` : '') +
                `🔗 ID Course : ${rideId}`;

              Share.share({ message: shareMsg });
            }}
          >
            <Text style={styles.secondaryText}>Partager le trajet</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL ARRÊT EN COURS */}
      <Modal visible={!!stopStartedAt} transparent animationType="fade">
        <View style={styles.stopModalOverlay}>
          <View style={styles.stopModalContent}>
            <View style={styles.stopModalHeader}>
              <View style={styles.stopIndicator} />
              <Text style={styles.stopModalTitle}>Arrêt en cours</Text>
            </View>

            <Text style={styles.stopModalSub}>Le chauffeur a mis la course en pause.</Text>

            <View style={styles.stopTimerContainer}>
              <MaterialCommunityIcons name="timer-outline" size={32} color={'#f59e0b'} />
              <Text style={styles.stopTimerText}>{formatDuration((totalStopDurationS || 0) + liveStopSeconds)}</Text>
            </View>
            {totalStopDurationS > 0 && liveStopSeconds > 0 && (
              <Text style={styles.stopInfo}>
                Total déjà cumulé: {Math.floor(totalStopDurationS / 60)} min
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

type LatLng = { latitude: number; longitude: number };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
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
    ...Shadows.md,
  },
  offlineText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: Fonts.titilliumWebBold,
  },
  statusBadge: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    ...Shadows.md,
  },
  liveBadge: { backgroundColor: 'rgba(34, 197, 94, 0.9)' },
  pollingBadge: { backgroundColor: 'rgba(245, 158, 11, 0.9)' },
  statusText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: Fonts.titilliumWebBold,
  },
  pulseCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveCircle: { backgroundColor: '#bef264' },
  pollingCircle: { backgroundColor: '#fef3c7' },

  // Header styles
  topHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  headerIndicator: {
    width: 4,
    height: 35,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  headerTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
    lineHeight: 22,
  },
  headerSub: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
  },

  // Bottom Sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    ...Shadows.lg,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 20,
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 20,
    color: Colors.black,
  },
  statusBadge_pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  pulseCircle_small: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText_pill: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 12,
  },

  // Driver Card
  driverCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  driverCore: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  actionDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#F1F5F9',
  },
  contactActionText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.black,
  },
  callAction: {
    opacity: 1,
  },
  waAction: {
    opacity: 1,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  moreBtn: {
    padding: 8,
    marginRight: -4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  driverName: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 17,
    color: Colors.black,
    maxWidth: '70%',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  ratingText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 10,
    color: '#D97706',
  },
  driverSub: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.white,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },

  // Consumption Button
  consumptionBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    gap: 12,
  },
  consumptionIconCircle: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consumptionText: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.white,
    fontSize: 15,
    flex: 1,
  },

  actions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
  },
  secondaryText: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
    fontSize: 14,
  },

  markerContainer: {
    padding: 5,
    backgroundColor: 'white',
    borderRadius: 25,
    ...Shadows.md,
  },

  // Stop Modal Styles
  stopModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stopModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 32,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    ...Shadows.lg,
  },
  stopModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  stopIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F59E0B',
  },
  stopModalTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 24,
    color: Colors.black,
  },
  stopModalSub: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.gray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  stopTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 24,
    gap: 16,
    marginBottom: 20,
  },
  stopTimerText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 48,
    color: '#D97706',
  },
  stopInfo: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
