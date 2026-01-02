import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useLocationStore } from '../../providers/LocationProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { useServiceStore } from '../../providers/ServiceProvider';

// Set Mapbox token (ensure this is configured in your project)
// Mapbox setup handled in catchable block above

type RootParams = {
  'screens/ride/RideSummary': { vehicleId: string; vehicleName: string; price: number; distanceKm: number };
};

export default function RideSummary() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/RideSummary'>>();
  const { origin, destination } = useLocationStore();
  const { vehicleId, vehicleName } = route.params;
  const price = Number(route.params.price || 0);
  const distanceKm = Number(route.params.distanceKm || 0);
  const { serviceType, packageDetails } = useServiceStore();

  const [coords, setCoords] = React.useState<Array<{ latitude: number; longitude: number }>>([]);
  const [center, setCenter] = React.useState<[number, number] | undefined>(undefined);

  React.useEffect(() => {
    if (!origin || !destination) return;

    // Set initial center
    setCenter([(origin.lon + destination.lon) / 2, (origin.lat + destination.lat) / 2]);

    // Récupérer géométrie OSRM
    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
        if (geometry && geometry.length) {
          setCoords(geometry.map(([lon, lat]) => ({ latitude: lat, longitude: lon })));
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
      {/* Carte avec tracé */}
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
                <View style={styles.markerContainer}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={24} color={Colors.primary} />
                </View>
              </PointAnnotation>

              <PointAnnotation id="destination" coordinate={[destination.lon, destination.lat]}>
                <View style={styles.markerContainer}>
                  <MaterialCommunityIcons name="map-marker" size={28} color={'#f59e0b'} />
                </View>
              </PointAnnotation>

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

      <View style={styles.card}>
        <Text style={styles.title}>Résumé {serviceType === 'livraison' ? 'de la livraison' : 'de la course'}</Text>
        {serviceType && (
          <Text style={styles.typeBadge}>
            {serviceType === 'deplacement' ? 'Déplacement' : serviceType === 'course' ? 'Course' : 'Livraison'}
          </Text>
        )}

        {/* Départ / Destination visuels */}
        <View style={styles.odRow}>
          <View style={styles.dotOrigin} />
          <View style={{ flex: 1 }}>
            <Text style={styles.odLabel}>Départ</Text>
            <Text style={styles.odAddress} numberOfLines={1}>{origin?.address || '-'}</Text>
          </View>
        </View>
        <View style={styles.dottedLine} />
        <View style={styles.odRow}>
          <View style={styles.dotDest} />
          <View style={{ flex: 1 }}>
            <Text style={styles.odLabel}>Destination</Text>
            <Text style={styles.odAddress} numberOfLines={1}>{destination?.address || '-'}</Text>
          </View>
        </View>

        {/* Détails avec icônes */}
        <View style={[styles.detailRow, { marginTop: 14 }]}>
          <MaterialCommunityIcons name="car-outline" size={22} color={Colors.black} />
          <Text style={styles.detailText}>{vehicleName}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="map-marker-distance" size={22} color={Colors.black} />
          <Text style={styles.detailText}>Distance: {distanceKm.toFixed(1)} km</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="cash" size={22} color={Colors.black} />
          <Text style={styles.detailText}>Estimation: FCFA {price.toLocaleString('fr-FR')}</Text>
        </View>
        {serviceType === 'livraison' && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.subTitle}>Infos colis</Text>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="account-outline" size={20} color={Colors.black} />
              <Text style={styles.detailText}>{packageDetails?.recipientName || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="phone-outline" size={20} color={Colors.black} />
              <Text style={styles.detailText}>{packageDetails?.recipientPhone || '-'}</Text>
            </View>
            {!!packageDetails?.description && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="package-variant" size={20} color={Colors.black} />
                <Text style={styles.detailText}>{packageDetails?.description}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="weight-kilogram" size={20} color={Colors.black} />
              <Text style={styles.detailText}>{packageDetails?.weightKg || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Colors.black} />
              <Text style={styles.detailText}>Fragile: {packageDetails?.fragile ? 'Oui' : 'Non'}</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => navigation.navigate({ name: 'screens/ride/SearchingDriver', params: { vehicleName } } as never)}
        activeOpacity={0.9}
      >
        <Text style={styles.primaryText}>Confirmer et chercher un chauffeur</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  mapBox: { height: 220, borderRadius: 14, overflow: 'hidden', marginBottom: 12, backgroundColor: Colors.lightGray },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  title: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 20, marginBottom: 12 },
  typeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.background, color: Colors.black, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontFamily: Fonts.titilliumWebBold, marginBottom: 8 },
  // OD visuals
  odRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotOrigin: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2e7d32' },
  dotDest: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#c62828' },
  dottedLine: { height: 18, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: Colors.lightGray, marginVertical: 8, marginLeft: 5 },
  odLabel: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  odAddress: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  // Details rows with icons
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  detailText: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  subTitle: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, marginBottom: 6 },
  // CTA
  primaryBtn: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },
});
