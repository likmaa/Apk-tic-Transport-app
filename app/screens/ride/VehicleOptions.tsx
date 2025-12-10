import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useLocationStore } from '../../providers/LocationProvider';
import { useServiceStore } from '../../providers/ServiceProvider';
import { useNavigation } from 'expo-router';

// Pricing tables per serviceType
const pricingDeplacement = {
  eco: { base: 700, perKm: 400 },
  standard: { base: 900, perKm: 600 },
  premium: { base: 1500, perKm: 900 },
} as const;

// Slightly higher for 'course'
const pricingCourse = {
  eco: { base: 800, perKm: 500 },
  standard: { base: 1050, perKm: 700 },
  premium: { base: 1700, perKm: 1000 },
} as const;

// Delivery options and pricing
const pricingLivraison = {
  moto: { base: 700, perKm: 500 },
  tricycle: { base: 1200, perKm: 700 },
  camionnette: { base: 2500, perKm: 1200 },
} as const;

// images retirées

export default function VehicleOptions() {
  const { origin, destination } = useLocationStore();
  const { serviceType } = useServiceStore();
  const navigation = useNavigation();
  const [loading, setLoading] = React.useState(false);
  const [distanceKm, setDistanceKm] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      if (!(origin && destination)) { setDistanceKm(0); return; }
      try {
        setLoading(true);
        const toRad = (d: number) => (d * Math.PI) / 180;
        const R = 6371; // km
        const dLat = toRad(destination.lat - origin.lat);
        const dLon = toRad(destination.lon - origin.lon);
        const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLon/2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const haversineKm = R * c;

        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;
        const res = await fetch(url);
        const data = await res.json();
        const meters = data?.routes?.[0]?.distance || 0;
        let km = meters / 1000;
        if (!km || km === 0) km = Math.max(0, haversineKm);
        setDistanceKm(km);
      } catch {
        // Fallback sur haversine si OSRM échoue
        const toRad = (d: number) => (d * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(destination!.lat - origin!.lat);
        const dLon = toRad(destination!.lon - origin!.lon);
        const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(origin!.lat)) * Math.cos(toRad(destination!.lat)) * Math.sin(dLon/2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        setDistanceKm(R * c);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [origin, destination]);

  type Option = { id: string; name: string; eta: string };
  function getOptions(): Option[] {
    if (serviceType === 'livraison') {
      return [
        { id: 'moto', name: 'Moto', eta: '3 min' },
        { id: 'tricycle', name: 'Tricycle', eta: '5 min' },
        { id: 'camionnette', name: 'Camionnette', eta: '8 min' },
      ];
    }
    return [
      { id: 'eco', name: 'Éco', eta: '3 min' },
      { id: 'standard', name: 'Standard', eta: '4 min' },
      { id: 'premium', name: 'Premium', eta: '6 min' },
    ];
  }

  function computePrice(id: string) {
    if (distanceKm <= 0) return 0;
    if (serviceType === 'livraison') {
      const p = pricingLivraison[id as keyof typeof pricingLivraison];
      if (!p) return 0;
      return Math.round(p.base + p.perKm * distanceKm);
    }
    const table = serviceType === 'course' ? pricingCourse : pricingDeplacement;
    const p = table[id as keyof typeof table];
    if (!p) return 0;
    return Math.round(p.base + p.perKm * distanceKm);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Trajet</Text>
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
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : null}

      <FlatList
        data={getOptions()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedId(item.id)}
            style={({ pressed }) => ([
              styles.card,
              selectedId === item.id && { borderColor: Colors.primary, borderWidth: 1.5 },
              pressed && { transform: [{ scale: 0.98 }], shadowOpacity: 0.16, shadowRadius: 5 },
            ])}
          >
            <View style={styles.leftRow}>
              <View style={styles.iconWrap}>
                {item.id === 'eco' && <MaterialCommunityIcons name="car-outline" size={22} color={Colors.black} />}
                {item.id === 'standard' && <MaterialCommunityIcons name="car-side" size={22} color={Colors.black} />}
                {item.id === 'premium' && <MaterialCommunityIcons name="crown-outline" size={22} color={Colors.black} />}
                {item.id === 'moto' && <MaterialCommunityIcons name="motorbike" size={22} color={Colors.black} />}
                {item.id === 'tricycle' && <MaterialCommunityIcons name="dump-truck" size={22} color={Colors.black} />}
                {item.id === 'camionnette' && <MaterialCommunityIcons name="truck-outline" size={22} color={Colors.black} />}
              </View>
              <View>
                <Text style={styles.carName}>{item.name}</Text>
                <Text style={styles.eta}>{item.eta}</Text>
              </View>
            </View>
            <Text style={styles.price}>
              {distanceKm > 0 ? (
                `FCFA ${computePrice(item.id).toLocaleString('fr-FR')}`
              ) : '...'}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.summary}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.summaryText}>Distance: {distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '...'}</Text>
          {selectedId && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaBadgeText}>Arrivée chauffeur: {getOptions().find((o: Option) => o.id === selectedId)?.eta}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.summaryText, { marginTop: 6 }]}>
          {selectedId ? `Prix estimé: ${distanceKm > 0 ? `FCFA ${computePrice(selectedId).toLocaleString('fr-FR')}` : '...'}` : 'Choisissez un véhicule'}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (distanceKm === 0 || !selectedId) && { opacity: 0.5 }
        ]}
        disabled={distanceKm === 0 || !selectedId}
        onPress={() => {
          if (!selectedId) return;
          const price = computePrice(selectedId);
          const o = getOptions().find(o => o.id === selectedId);
          navigation.navigate({ name: 'screens/ride/RideSummary', params: { vehicleId: selectedId, vehicleName: o?.name || '', price, distanceKm } } as never);
        }}
      >
        <Text style={styles.primaryText}>Commander</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerCard: { backgroundColor: Colors.white, margin: 16, padding: 14, borderRadius: 14, shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  title: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black, marginBottom: 10 },
  odRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotOrigin: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2e7d32' },
  dotDest: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#c62828' },
  dottedLine: { height: 18, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: Colors.lightGray, marginVertical: 8, marginLeft: 5 },
  odLabel: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  odAddress: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 18, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  carName: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, marginBottom: 2, fontSize: 16 },
  eta: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  price: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 16 },
  summary: { position: 'absolute', left: 16, right: 16, bottom: 130, backgroundColor: Colors.white, borderRadius: 12, padding: 12, shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  summaryText: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  etaBadge: { backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  etaBadgeText: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 12 },
  primaryBtn: { position: 'absolute', left: 16, right: 16, bottom: 50, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },
});
