import React, { useRef, useMemo, useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { useNavigation } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet, { BottomSheetView, BottomSheetFlatList } from '@gorhom/bottom-sheet';

import { Colors } from '../theme';
import { Fonts } from '../font';
import { useLocationStore } from '../providers/LocationProvider';
import { EMBARKATION_POINTS } from '../data/embarkationPoints';

const { width } = Dimensions.get('window');

// Images assets (assurez-vous que les fichiers existent dans assets/images)
// Utilisez require pour les images locales
const IMAGES = {
  logo: require('../../assets/images/LOGO.png'),
  ad1: require('../../assets/images/tic1.jpg'),
  ad2: require('../../assets/images/tic2.jpg'),
  ad3: require('../../assets/images/tic3.jpg'),
};

export default function HomeTab() {
  const navigation = useNavigation();
  const { origin, destination, reset, setOrigin, requestUserLocation } = useLocationStore();

  // State pour les onglets de service
  const [selectedService, setSelectedService] = useState<'courses' | 'deplacement' | 'livraison'>('courses');

  // Bottom Sheet Ref & SnapPoints
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '85%'], []);

  // Ouverture automatique si pas d'origine (optionnel, peut être désactivé si trop intrusif)
  // useFocusEffect(
  //   useCallback(() => {
  //     if (!origin) {
  //        setTimeout(() => bottomSheetRef.current?.expand(), 1000);
  //     }
  //     return () => {};
  //   }, [origin])
  // );

  const handleSelectEmbark = (p: { id: string; name: string; lat: number; lon: number; address?: string }) => {
    setOrigin({ address: p.address || p.name, lat: p.lat, lon: p.lon });
    bottomSheetRef.current?.close();
    // Après sélection, on pourrait naviguer directement vers VehicleOptions si la destination est déjà là
    if (destination) {
      navigation.navigate('screens/ride/VehicleOptions' as never);
    }
  };

  const handleUseMyLocation = async () => {
    bottomSheetRef.current?.close();
    await requestUserLocation();
  };

  const openRideSheet = () => {
    bottomSheetRef.current?.expand();
  };

  const renderServiceTab = (id: 'courses' | 'deplacement' | 'livraison', label: string, icon: any) => {
    const isSelected = selectedService === id;
    return (
      <TouchableOpacity
        style={styles.serviceTab}
        onPress={() => setSelectedService(id)}
        activeOpacity={0.7}
      >
        <View style={[styles.serviceIconContainer, isSelected && styles.serviceIconActive]}>
          <Ionicons name={icon} size={24} color={isSelected ? Colors.primary : Colors.gray} />
        </View>
        <Text style={[styles.serviceLabel, isSelected && styles.serviceLabelActive]}>{label}</Text>
        {isSelected && <View style={styles.activeIndicator} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.header}>
          <Image source={IMAGES.logo} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('screens/Notifications' as never)}>
            <Ionicons name="notifications-outline" size={24} color={Colors.black} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* SERVICE TABS */}
        <View style={styles.servicesContainer}>
          {renderServiceTab('courses', 'Courses', 'car')}
          {renderServiceTab('deplacement', 'Déplacement', 'walk')}
          {renderServiceTab('livraison', 'Livraison', 'cube')}
        </View>

        {/* WALLET CARD */}
        <LinearGradient
          colors={[Colors.primary, '#4c66e8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <View>
            <Text style={styles.walletLabel}>Solde du portefeuille</Text>
            <Text style={styles.walletBalance}>XOF 0</Text>
          </View>
          <TouchableOpacity
            style={styles.addFundsBtn}
            onPress={() => navigation.navigate('screens/wallet/AddFunds' as never)}
          >
            <Ionicons name="add" size={24} color={Colors.white} />
          </TouchableOpacity>
        </LinearGradient>

        {/* ADDRESS SHORTCUT (DOMICILE) */}
        <TouchableOpacity style={styles.addressShortcut}>
          <View style={styles.homeIconCircle}>
            <Ionicons name="home" size={20} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.addressTitle}>Domicile</Text>
            <Text style={styles.addressSubtitle}>Ajouter ou modifier votre domicile</Text>
          </View>
        </TouchableOpacity>

        {/* ACTION GRID */}
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            {/* Course Immédiate -> Ouvre BottomSheet */}
            <TouchableOpacity style={styles.gridCard} onPress={openRideSheet}>
              <View style={styles.gridIconWrap}>
                <Ionicons name="car-sport" size={28} color={Colors.secondary} />
              </View>
              <Text style={styles.gridLabel}>Course immédiate</Text>
            </TouchableOpacity>

            {/* Course Programmée (Placeholder) */}
            <TouchableOpacity style={styles.gridCard}>
              <View style={styles.gridIconWrap}>
                <Ionicons name="calendar" size={28} color={Colors.secondary} />
              </View>
              <Text style={styles.gridLabel}>Course programmée</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gridRow}>
            <TouchableOpacity style={styles.gridCard}>
              <View style={styles.gridIconWrap}>
                <Ionicons name="map" size={28} color={Colors.secondary} />
              </View>
              <Text style={styles.gridLabel}>Multi-arrêts</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gridCard}>
              <View style={styles.gridIconWrap}>
                <Ionicons name="business" size={28} color={Colors.secondary} />
              </View>
              <Text style={styles.gridLabel}>Inter-ville</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ADS SECTION */}
        <Text style={styles.sectionTitle}>Publicités</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adsContainer}>
          {[IMAGES.ad1, IMAGES.ad2, IMAGES.ad3].map((img: any, i: number) => (
            <Image key={i} source={img} style={styles.adImage} resizeMode="cover" />
          ))}
        </ScrollView>

        {/* Espace pour le scroll */}
        <View style={{ height: 100 }} />

      </ScrollView>

      {/* BOTTOM SHEET */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1} // Fermé par défaut
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: Colors.white, borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Où est-ce qu'on vous prend ?</Text>

          <TouchableOpacity style={styles.modalRow} onPress={handleUseMyLocation}>
            <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.modalRowText}>Utiliser ma position actuelle</Text>
          </TouchableOpacity>

          <Text style={styles.sectionHeader}>Points populaires</Text>

          <BottomSheetFlatList
            data={EMBARKATION_POINTS}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }: { item: typeof EMBARKATION_POINTS[0] }) => (
              <TouchableOpacity style={styles.modalRow} onPress={() => handleSelectEmbark(item)}>
                <View style={[styles.iconCircle, { backgroundColor: '#F5F5F5' }]}>
                  <MaterialCommunityIcons name="map-marker" size={22} color={Colors.secondary} />
                </View>
                <Text style={styles.modalRowText}>{item.name}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </BottomSheetView>
      </BottomSheet>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo: { width: 100, height: 40 },
  notificationBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  notificationDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },

  // Tabs
  servicesContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  serviceTab: { alignItems: 'center' },
  serviceIconContainer: { marginBottom: 6 },
  serviceIconActive: {},
  serviceLabel: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, fontSize: 13 },
  serviceLabelActive: { fontFamily: Fonts.titilliumWebBold, color: Colors.primary },
  activeIndicator: { marginTop: 4, width: 20, height: 3, backgroundColor: Colors.primary, borderRadius: 2 },

  // Wallet
  walletCard: { borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  walletLabel: { fontFamily: Fonts.titilliumWeb, color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 4 },
  walletBalance: { fontFamily: Fonts.unboundedBold, color: Colors.white, fontSize: 24 },
  addFundsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // Shortcuts
  addressShortcut: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
  homeIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  addressTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
  addressSubtitle: { fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.gray },

  // Grid
  gridContainer: { gap: 12, marginBottom: 24 },
  gridRow: { flexDirection: 'row', gap: 12 },
  gridCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, height: 110 },
  gridIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }, // Light orange bg
  gridLabel: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 14, color: Colors.black, textAlign: 'center' },

  // Ads
  sectionTitle: { fontFamily: Fonts.unboundedBold, fontSize: 18, color: Colors.black, marginBottom: 12 },
  adsContainer: { marginBottom: 20 },
  adImage: { width: width * 0.75, height: 140, borderRadius: 16, marginRight: 12 },

  // Bottom Sheet
  sheetContent: { flex: 1, padding: 24 },
  sheetTitle: { fontFamily: Fonts.unboundedBold, fontSize: 18, color: Colors.black, marginBottom: 20, textAlign: 'center' },
  sectionHeader: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.gray, marginTop: 24, marginBottom: 12 },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  modalRowText: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 16, color: Colors.black },
});
