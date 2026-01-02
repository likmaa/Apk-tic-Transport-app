import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Share, Image } from 'react-native';
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

  const { origin, destination } = useLocationStore();
  const { serviceType, packageDetails } = useServiceStore();
  const { token, user } = useAuth();

  const [eta, setEta] = React.useState<number | null>(null);
  const [center, setCenter] = React.useState<[number, number] | undefined>(undefined);
  const [coords, setCoords] = React.useState<Array<{ latitude: number; longitude: number }>>([]);
  const [driverPos, setDriverPos] = React.useState<LatLng | null>(null);
  const [rideData, setRideData] = React.useState<any>(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // Fetch ride data
  React.useEffect(() => {
    if (!rideId || !token || !API_URL) return;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          setRideData(json);
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
          }
        });

        // Listen for completion
        channel.bind('ride.completed', (payload: any) => {
          if (cancelled) return;
          router.replace({
            pathname: '/screens/ride/RideReceipt',
            params: {
              amount: payload.fare_amount || rideData?.fare_amount || 0,
              distanceKm: (payload.distance_m || rideData?.distance_m || 0) / 1000,
              vehicleName,
              // Pass coordinates for Map display
              pickupLat: origin?.lat || rideData?.pickup_lat || 0,
              pickupLng: origin?.lon || rideData?.pickup_lng || 0,
              dropoffLat: destination?.lat || rideData?.dropoff_lat || 0,
              dropoffLng: destination?.lon || rideData?.dropoff_lng || 0,
            }
          });
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

  React.useEffect(() => {
    if (!origin || !destination) return;

    setCenter([(origin.lon + destination.lon) / 2, (origin.lat + destination.lat) / 2]);

    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
        if (geometry && geometry.length) {
          setCoords(geometry.map(([lon, lat]) => ({ latitude: lat, longitude: lon })));

          const durationS = data?.routes?.[0]?.duration ?? 0;
          setEta(Math.max(1, Math.round(durationS / 60)));
        } else {
          setCoords([
            { latitude: origin.lat, longitude: origin.lon },
            { latitude: destination.lat, longitude: destination.lon },
          ]);
        }
      } catch {
        setCoords([
          { latitude: origin.lat, longitude: origin.lon },
          { latitude: destination.lat, longitude: destination.lon },
        ]);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Carte en haut */}
      {origin && destination && center && (
        <View style={styles.mapBox}>
          {Mapbox ? (
            <MapView style={{ flex: 1 }} attributionEnabled={false} logoEnabled={false}>
              <Camera
                defaultSettings={{
                  centerCoordinate: center,
                  zoomLevel: 12
                }}
              />

              <PointAnnotation id="origin" coordinate={[origin.lon, origin.lat]}>
                <View>
                  <MaterialCommunityIcons name="crosshairs-gps" size={24} color={Colors.primary} />
                </View>
              </PointAnnotation>

              <PointAnnotation id="destination" coordinate={[destination.lon, destination.lat]}>
                <View>
                  <MaterialCommunityIcons name="map-marker" size={28} color={'#f59e0b'} />
                </View>
              </PointAnnotation>

              {driverPos && (
                <PointAnnotation id="driver" coordinate={[driverPos.longitude, driverPos.latitude]}>
                  <View style={styles.markerContainer}>
                    <MaterialCommunityIcons name="car" size={24} color={Colors.black} />
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
            <MapPlaceholder style={{ height: '100%' }} />
          )}
        </View>
      )}

      {/* Infos chauffeur */}
      <View style={styles.card}>
        <View style={styles.driverRow}>
          <Image source={require('../../../assets/images/LOGO_OR.png')} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{rideData?.driver?.name || 'Chauffeur'}</Text>
            <Text style={styles.sub}>{vehicleName} • {rideData?.driver?.vehicle_number || 'Vehicule'}</Text>
          </View>
          <View style={styles.etaPill}>
            <Text style={styles.etaPillText}>
              {eta ? `${eta} min` : '-- min'}
            </Text>
          </View>
        </View>
        {serviceType === 'livraison' && (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.sub, { marginBottom: 6 }]}>Infos colis</Text>
            <Text style={styles.sub}>Destinataire: {packageDetails?.recipientName || '-'}</Text>
            <Text style={styles.sub}>Téléphone: {packageDetails?.recipientPhone || '-'}</Text>
            {!!packageDetails?.weightKg && <Text style={styles.sub}>Poids: {packageDetails?.weightKg}</Text>}
            <Text style={styles.sub}>Fragile: {packageDetails?.fragile ? 'Oui' : 'Non'}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => Share.share({ message: `Je suis en route ! Suivez ma course TIC : ${rideId}` })}
        >
          <Text style={styles.secondaryText}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push({ pathname: '/screens/ride/ContactDriver', params: { driverName: rideData?.driver?.name, vehicleName } })}
        >
          <Text style={styles.secondaryText}>Contacter</Text>
        </TouchableOpacity>
      </View>

      {/* Le bouton "Terminer" est supprimé car c'est automatique via Pusher */}
      <View style={{ marginTop: 20, alignItems: 'center' }}>
        <Text style={{ fontFamily: Fonts.titilliumWeb, color: Colors.gray }}>Course en cours...</Text>
      </View>
    </SafeAreaView>
  );
}

type LatLng = { latitude: number; longitude: number };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  mapBox: { height: 220, borderRadius: 14, overflow: 'hidden', marginBottom: 12, backgroundColor: Colors.lightGray },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.background },
  title: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 18 },
  sub: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, marginTop: 4 },
  etaPill: { backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  etaPillText: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryBtn: { flex: 1, backgroundColor: Colors.white, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.lightGray },
  secondaryText: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  primaryBtn: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold },
  markerContainer: { padding: 4, backgroundColor: 'white', borderRadius: 20, elevation: 5 },
});
