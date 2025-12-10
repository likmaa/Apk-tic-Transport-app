import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Share, Image } from 'react-native';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useNavigation } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocationStore } from '../../providers/LocationProvider';
import { useServiceStore } from '../../providers/ServiceProvider';

 type RootParams = {
  'screens/ride/OngoingRide': { vehicleName: string } | undefined;
 };

export default function OngoingRide() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/OngoingRide'>>();
  const vehicleName = route.params?.vehicleName || 'Standard';
  const [eta, setEta] = React.useState(12);
  const { origin, destination } = useLocationStore();
  const { serviceType, packageDetails } = useServiceStore();
  const [region, setRegion] = React.useState<Region | undefined>(undefined);
  const [coords, setCoords] = React.useState<Array<{ latitude: number; longitude: number }>>([]);

  React.useEffect(() => {
    const t = setInterval(() => setEta((e) => (e > 1 ? e - 1 : 1)), 5000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (!origin || !destination) return;
    const midLat = (origin.lat + destination.lat) / 2;
    const midLon = (origin.lon + destination.lon) / 2;
    const latDelta = Math.max(0.02, Math.abs(origin.lat - destination.lat) * 1.6);
    const lonDelta = Math.max(0.02, Math.abs(origin.lon - destination.lon) * 1.6);
    setRegion({ latitude: midLat, longitude: midLon, latitudeDelta: latDelta, longitudeDelta: lonDelta });

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Carte en haut */}
      {origin && destination && region && (
        <View style={styles.mapBox}>
          <MapView style={{ flex: 1 }} initialRegion={region}>
            <Marker coordinate={{ latitude: origin.lat, longitude: origin.lon }}>
              <MaterialCommunityIcons name="crosshairs-gps" size={24} color={Colors.primary} />
            </Marker>
            <Marker coordinate={{ latitude: destination.lat, longitude: destination.lon }}>
              <MaterialCommunityIcons name="map-marker" size={28} color={'#f59e0b'} />
            </Marker>
            {coords.length >= 2 && (
              <Polyline coordinates={coords} strokeColor={Colors.primary} strokeWidth={4} />
            )}
          </MapView>
        </View>
      )}

      {/* Infos chauffeur */}
      <View style={styles.card}>
        <View style={styles.driverRow}>
          <Image source={require('../../../assets/images/LOGO_OR.png')} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>John Doe</Text>
            <Text style={styles.sub}>{vehicleName} • Toyota Corolla • AB-123-CD</Text>
          </View>
          <View style={styles.etaPill}><Text style={styles.etaPillText}>{eta} min</Text></View>
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
          onPress={() => Share.share({ message: 'Suivez ma course: https://example.com/ride/12345' })}
        >
          <Text style={styles.secondaryText}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate({ name: 'screens/ride/ContactDriver', params: { driverName: 'John Doe', vehicleName } } as never)}
        >
          <Text style={styles.secondaryText}>Contacter</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate({ name: 'screens/ride/RideReceipt', params: { amount: 2500, distanceKm: 5.4, vehicleName } } as never)}>
        <Text style={styles.primaryText}>Terminer la course</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

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
});
