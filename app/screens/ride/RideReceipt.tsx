import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Alert, Switch } from 'react-native';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useNavigation, useRouter } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useServiceStore } from '../../providers/ServiceProvider';
import { usePaymentStore } from '../../providers/PaymentProvider';

import { MapPlaceholder } from '../../components/MapPlaceholder';

type RootParams = {
  'screens/ride/RideReceipt': {
    amount: number;
    distanceKm: number;
    vehicleName: string;
    durationMin?: number;
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
  } | undefined;
};

export default function RideReceipt() {
  const router = useRouter();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/RideReceipt'>>();
  const amount = Number(route.params?.amount ?? 0);
  const distanceKm = Number(route.params?.distanceKm ?? 0);
  const vehicleName = route.params?.vehicleName ?? 'Standard';
  const durationMin = route.params?.durationMin ?? '--';

  // Coordinates for Map
  const pickupLat = Number(route.params?.pickupLat ?? 0);
  const pickupLng = Number(route.params?.pickupLng ?? 0);
  const dropoffLat = Number(route.params?.dropoffLat ?? 0);
  const dropoffLng = Number(route.params?.dropoffLng ?? 0);

  const { serviceType, packageDetails } = useServiceStore();
  const base = amount > 800 ? 800 : amount;
  const other = amount - base;

  // Center map on path
  const center = (pickupLat && dropoffLat) ? [(pickupLng + dropoffLng) / 2, (pickupLat + dropoffLat) / 2] : undefined;

  const handleClose = () => {
    // Navigate slightly differently to ensure we hit the MAIN Root Navigation (Image 1)
    // and not the (tabs) sub-navigator (Image 2) if they are distinct.
    // 'Home' refers to the screen name in app/index.tsx (if app/index.tsx is the root tab navigator)

    // Using router.replace('/') usually goes to index.tsx. 
    // If index.tsx IS the main tab navigator, this is correct.
    router.replace('/');
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
          </MapView>
        ) : (
          <MapPlaceholder style={StyleSheet.absoluteFill} />
        )}
        {/* Overlay Gradiant or Darken */}
        <View style={styles.mapOverlay} />
      </View>

      {/* CARD CONTENT */}
      <SafeAreaView style={styles.contentContainer}>
        <View style={{ flex: 1 }} />

        <View style={styles.card}>
          <Text style={styles.title}>Course terminée !</Text>
          <Text style={styles.subHeader}>Merci d'avoir voyagé avec TIC.</Text>

          <View style={styles.divider} />

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

          <View style={styles.detailsRow}>
            <Text style={styles.label}>Véhicule</Text>
            <Text style={styles.value}>{vehicleName}</Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.label}>Base</Text>
            <Text style={styles.value}>{base.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          {other > 0 && (
            <View style={styles.detailsRow}>
              <Text style={styles.label}>Frais & autres</Text>
              <Text style={styles.value}>{other.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          )}

          <View style={[styles.detailsRow, { marginTop: 8 }]}>
            <Text style={styles.totalLabel}>Total payé</Text>
            <Text style={styles.totalValue}>{amount.toLocaleString('fr-FR')} FCFA</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Envoyé', 'Le reçu a été envoyé par email.')}>
              <Text style={styles.secondaryText}>Reçu par email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleClose}>
              <Text style={styles.primaryText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}


// Tentative d'importation sécurisée de Mapbox
let Mapbox: any = null;
let MapView: any = View;
let Camera: any = View;
let PointAnnotation: any = View;

try {
  const MB = require('@rnmapbox/maps');
  Mapbox = MB.default || MB;
  MapView = MB.MapView;
  Camera = MB.Camera;
  PointAnnotation = MB.PointAnnotation;

  if (Mapbox && typeof Mapbox.setAccessToken === 'function') {
    Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
  }
} catch (e) {
  Mapbox = null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mapContainer: { height: '40%', width: '100%', position: 'absolute', top: 0, left: 0 },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)' },
  contentContainer: { flex: 1, padding: 16 },

  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 10 },

  title: { fontFamily: Fonts.unboundedBold, color: Colors.black, fontSize: 24, marginBottom: 4, textAlign: 'center' },
  subHeader: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, fontSize: 16, marginBottom: 20, textAlign: 'center' },

  divider: { height: 1, backgroundColor: Colors.lightGray, marginVertical: 16 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statLabel: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, fontSize: 13, marginBottom: 4 },
  statValue: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 16 },
  verticalLine: { width: 1, height: 30, backgroundColor: Colors.lightGray },

  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, fontSize: 15 },
  value: { fontFamily: Fonts.titilliumWebSemiBold, color: Colors.black, fontSize: 15 },

  totalLabel: { fontFamily: Fonts.unboundedBold, color: Colors.black, fontSize: 16 },
  totalValue: { fontFamily: Fonts.unboundedBold, color: Colors.primary, fontSize: 20 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  secondaryBtn: { flex: 1, backgroundColor: Colors.white, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.lightGray },
  secondaryText: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  primaryBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  primaryText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold },

  // unused valid styles
  typeBadge: { display: 'none' },
  row: { display: 'none' },
  rowBetween: { display: 'none' },
  sep: { display: 'none' },
  subTitle: { display: 'none' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'white' },
});

function labelFor(m: ReturnType<typeof usePaymentStore>['method']) {
  switch (m) {
    case 'cash': return 'Espèces';
    case 'mobile_money': return 'Mobile Money';
    case 'card': return 'Carte bancaire';
    case 'wallet': return 'Portefeuille';
    case 'qr': return 'QR Code';
    default: return String(m);
  }
}
