import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Share, Image, Modal } from 'react-native';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useNavigation, useRouter } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { MapPlaceholder } from '../../components/MapPlaceholder';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  const route = useRoute<RouteProp<RootParams, 'screens/ride/OngoingRide'>>();
  const vehicleName = route.params?.vehicleName || 'Standard';
  const rideId = route.params?.rideId;

  const { serviceType, packageDetails } = useServiceStore();
  const { token, user } = useAuth();

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

  const { lat: smoothLat, lng: smoothLng } = useSmoothMarker(driverPos);

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
  }, [rideId, token, rideData, vehicleName, router]);

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
      if (rideData.pickup_lat && rideData.pickup_lng) {
        setStoreOrigin({
          address: rideData.pickup_address,
          lat: Number(rideData.pickup_lat),
          lon: Number(rideData.pickup_lng),
        });
      }
      if (rideData.dropoff_lat && rideData.dropoff_lng) {
        setStoreDestination({
          address: rideData.dropoff_address || 'Destination',
          lat: Number(rideData.dropoff_lat),
          lon: Number(rideData.dropoff_lng),
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
                  <MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.primary} />
                </View>
              </PointAnnotation>
            )}

            {destination && (
              <PointAnnotation id="destination" coordinate={[destination.lon, destination.lat]}>
                <View style={styles.markerContainer}>
                  <MaterialCommunityIcons name="map-marker" size={24} color={'#f59e0b'} />
                </View>
              </PointAnnotation>
            )}

            {driverPos && (
              <PointAnnotation id="driver" coordinate={[smoothLng.value, smoothLat.value]}>
                <View style={styles.markerContainer}>
                  <MaterialCommunityIcons name="car" size={20} color={Colors.black} />
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
        <Text style={styles.headerTitle}>En route !</Text>
        <Text style={styles.headerSub}>Pour votre destination</Text>
      </View>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <View style={styles.etaRow}>
          <Text style={styles.sheetTitle}>Course en cours</Text>
          <View style={styles.etaPill}>
            <Text style={styles.etaPillText}>
              {eta ? `Arrivée dans ${eta} min` : 'Calcul...'}
            </Text>
          </View>
        </View>

        <View style={styles.driverCard}>
          <Image source={require('../../../assets/images/LOGO_OR.png')} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{rideData?.driver?.name || 'Chauffeur'}</Text>
            <Text style={styles.driverSub}>{vehicleName} • {rideData?.driver?.vehicle_number || 'Vehicule'}</Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push({ pathname: '/screens/ride/ContactDriver', params: { driverName: rideData?.driver?.name, vehicleName } })}
          >
            <MaterialCommunityIcons name="message-text" size={20} color={Colors.black} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.consumptionBtn}
          onPress={() => router.push({ pathname: '/screens/ride/RideConsumption', params: { rideId: String(rideId) } })}
        >
          <MaterialCommunityIcons name="chart-line" size={20} color={Colors.white} />
          <Text style={styles.consumptionText}>Suivre la consommation (FCFA)</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => Share.share({ message: `Je suis en route ! Suivez ma course TIC : ${rideId}` })}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
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
  topHeader: { position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: 'rgba(255,255,255,0.9)', padding: 16, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  headerTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 22, color: Colors.black },
  headerSub: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray },

  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.lightGray, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black },
  etaPill: { backgroundColor: 'rgba(74, 222, 128, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  etaPillText: { fontFamily: Fonts.titilliumWebBold, color: '#166534', fontSize: 13 },

  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 12, borderRadius: 16, gap: 12, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.lightGray },
  driverName: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
  driverSub: { fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.gray },
  iconBtn: { padding: 10, backgroundColor: Colors.white, borderRadius: 12 },

  consumptionBtn: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  consumptionText: { fontFamily: Fonts.titilliumWebBold, color: Colors.white, fontSize: 16 },

  actions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: { flex: 1, backgroundColor: Colors.white, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: Colors.lightGray },
  secondaryText: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 14 },

  markerContainer: { padding: 4, backgroundColor: 'white', borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 5 },

  // Stop Modal Styles
  stopModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  stopModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  stopModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  stopIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.secondary,
  },
  stopModalTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 22,
    color: Colors.black,
  },
  stopModalSub: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.gray,
    textAlign: 'center',
    marginBottom: 24,
  },
  stopTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 20,
    gap: 12,
    marginBottom: 24,
  },
  stopTimerText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 40,
    color: Colors.secondary,
  },
  stopInfo: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
