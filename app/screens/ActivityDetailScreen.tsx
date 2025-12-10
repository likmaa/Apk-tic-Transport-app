// screens/ActivityDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { Fonts } from '../font';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- TYPES (INCHANGÉS) ---
type ActivityItem = {
  id: string; type: "Rent" | "Taxi"; status: "upcoming" | "past" | "ongoing" | "pending" | "cancelled";
  date: string; time: string; from: string; to: string; price: string;
  driverName?: string; vehiclePlate?: string; notes?: string; driverImage?: any; mapImage?: any;
  // Ajoutons des coordonnées pour la carte
  originCoords?: { latitude: number; longitude: number };
  destCoords?: { latitude: number; longitude: number };
  routeCoords?: { latitude: number; longitude: number }[];
};
type RootStackParamList = { "screens/ActivityDetailScreen": { activity: ActivityItem }; "screens/ride/ContactDriver": undefined; };
type ActivityDetailRouteProp = RouteProp<RootStackParamList, 'screens/ActivityDetailScreen'>;

export default function ActivityDetailScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<ActivityDetailRouteProp>();
  const { activity } = route.params;
  const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;
  const [detailActivity, setDetailActivity] = useState<ActivityItem | null>(null);

  useEffect(() => {
    const loadRideDetail = async () => {
      try {
        if (!API_URL) return;

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const res = await fetch(`${API_URL}/passenger/rides/${activity.id}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const ride = await res.json().catch(() => null);
        if (!ride) return;

        const dateSource = ride.scheduled_at ?? ride.created_at ?? new Date().toISOString();
        const d = new Date(dateSource);
        const date = isNaN(d.getTime())
          ? activity.date
          : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        const time = isNaN(d.getTime())
          ? activity.time
          : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const from = String(ride.origin_address ?? ride.pickup_address ?? activity.from);
        const to = String(ride.destination_address ?? ride.dropoff_address ?? activity.to);

        const priceNumber = Number(ride.total_amount ?? ride.price ?? 0);
        const price = priceNumber
          ? `${priceNumber.toLocaleString('fr-FR')} FCFA`
          : activity.price;

        const originCoords = (ride.pickup_lat && ride.pickup_lng)
          ? { latitude: Number(ride.pickup_lat), longitude: Number(ride.pickup_lng) }
          : activity.originCoords;
        const destCoords = (ride.dropoff_lat && ride.dropoff_lng)
          ? { latitude: Number(ride.dropoff_lat), longitude: Number(ride.dropoff_lng) }
          : activity.destCoords;

        const mapped: ActivityItem = {
          id: String(ride.id ?? activity.id),
          type: activity.type || 'Taxi',
          status: activity.status,
          date,
          time,
          from,
          to,
          price,
          driverName: ride.driver?.name ?? activity.driverName,
          vehiclePlate: ride.driver?.vehicle_plate ?? activity.vehiclePlate,
          driverImage: activity.driverImage || require('../../assets/images/LOGO_OR.png'),
          originCoords,
          destCoords,
          routeCoords: activity.routeCoords,
        };

        setDetailActivity(mapped);
      } catch {
        // En cas d'erreur réseau on reste sur les données passées en paramètre
      }
    };

    loadRideDetail();
  }, [API_URL, activity]);

  const baseActivity = detailActivity || activity;
  const mockActivity: ActivityItem = {
    ...baseActivity,
    driverName: baseActivity.driverName || 'John Doe',
    vehiclePlate: baseActivity.vehiclePlate || 'AB-123-CD',
    driverImage: baseActivity.driverImage || require('../../assets/images/LOGO_OR.png'),
    originCoords: baseActivity.originCoords || { latitude: 6.369, longitude: 2.418 },
    destCoords: baseActivity.destCoords || { latitude: 6.35, longitude: 2.43 },
    routeCoords: baseActivity.routeCoords || [
      { latitude: 6.369, longitude: 2.418 },
      { latitude: 6.365, longitude: 2.425 },
      { latitude: 6.35, longitude: 2.43 },
    ],
  };

  return (
    <View style={styles.container}>
      {/* Carte en arrière-plan */}
      <MapView
        style={StyleSheet.absoluteFill}
        provider="google"
        initialRegion={{
          latitude: (mockActivity.originCoords!.latitude + mockActivity.destCoords!.latitude) / 2,
          longitude: (mockActivity.originCoords!.longitude + mockActivity.destCoords!.longitude) / 2,
          latitudeDelta: Math.abs(mockActivity.originCoords!.latitude - mockActivity.destCoords!.latitude) * 2,
          longitudeDelta: Math.abs(mockActivity.originCoords!.longitude - mockActivity.destCoords!.longitude) * 2,
        }}
      >
        <Marker coordinate={mockActivity.originCoords!} title="Départ" pinColor="green" />
        <Marker coordinate={mockActivity.destCoords!} title="Arrivée" pinColor="red" />
        {mockActivity.routeCoords && <Polyline coordinates={mockActivity.routeCoords} strokeColor={Colors.primary} strokeWidth={4} />}
      </MapView>

    

      {/* Panneau d'informations inférieur */}
      <View style={styles.bottomSheet}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Récapitulatif principal */}
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryDate}>{mockActivity.date}, {mockActivity.time}</Text>
            <Text style={styles.summaryPrice}>{mockActivity.price}</Text>
            <Text style={styles.summaryServiceType}>{mockActivity.type === 'Taxi' ? 'Course Standard' : 'Location'}</Text>
          </View>

          {/* Itinéraire */}
          <View style={styles.section}>
            <View style={styles.locationRow}>
              <Ionicons name="radio-button-on-outline" size={20} color={Colors.primary} style={styles.locationIcon} />
              <Text style={styles.locationText} numberOfLines={1}>{mockActivity.from}</Text>
            </View>
            <View style={styles.dots} />
            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color={Colors.primary} style={styles.locationIcon} />
              <Text style={styles.locationText} numberOfLines={1}>{mockActivity.to}</Text>
            </View>
          </View>

          {/* Détails du paiement */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Détails du paiement</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Moyen de paiement</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="card" size={20} color={Colors.black} style={{ marginRight: 8 }} />
                <Text style={styles.paymentValue}>**** 4963</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.receiptButton}>
              <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
              <Text style={styles.receiptButtonText}>Télécharger le reçu</Text>
            </TouchableOpacity>
          </View>

          {/* Chauffeur */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Votre chauffeur</Text>
            <View style={styles.driverRow}>
              <Image source={mockActivity.driverImage} style={styles.driverAvatar} />
              <View>
                <Text style={styles.driverName}>{mockActivity.driverName}</Text>
                <Text style={styles.vehicleInfo}>{mockActivity.vehiclePlate}</Text>
              </View>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFC107" />
                <Text style={styles.ratingText}>4.9</Text>
              </View>
            </View>
          </View>

          {/* Aide */}
          <TouchableOpacity style={styles.helpButton}>
            <Ionicons name="help-buoy-outline" size={22} color={Colors.primary} />
            <Text style={styles.helpButtonText}>Obtenir de l'aide</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightGray,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'white',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '65%',
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 16,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryHeader: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  summaryDate: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
    color: Colors.gray,
  },
  summaryPrice: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 40,
    color: Colors.black,
    marginVertical: 8,
  },
  summaryServiceType: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
  },
  section: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  sectionTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginRight: 12,
  },
  locationText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
    flex: 1,
  },
  dots: {
    height: 20,
    width: 2,
    backgroundColor: Colors.lightGray,
    marginLeft: 9,
    marginVertical: 6,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.gray,
  },
  paymentValue: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  receiptButtonText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.primary,
    marginLeft: 8,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  driverName: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
  },
  vehicleInfo: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.black,
    marginLeft: 4,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 10,
  },
  helpButtonText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.primary,
    marginLeft: 10,
  },
});
