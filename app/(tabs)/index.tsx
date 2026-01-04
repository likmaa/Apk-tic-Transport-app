import React, { useRef, useMemo, useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Alert, StatusBar } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '../theme';
import { Fonts } from '../font';

// New Components
import HomeServiceSelector from '../components/HomeServiceSelector';
import CourseSection from '../components/CourseSection';
import DeplacementSection from '../components/DeplacementSection';
import DeliverySection from '../components/DeliverySection';

type ServiceType = 'Course' | 'Déplacement' | 'Livraison';

export default function HomeTab() {
  const navigation = useNavigation();
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<ServiceType>('Course');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userName, setUserName] = useState<string>('');
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // 1. Session Protection & User Data
  useEffect(() => {
    const checkRole = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("authUser");
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          setUserName(userObj.name || '');
        }

        if (!API_URL) return;
        const token = await AsyncStorage.getItem("authToken");
        if (!token) return;

        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;
        const user = await res.json();
        setUserName(user.name);

        if (user?.role === "driver") {
          await AsyncStorage.removeItem("authToken");
          await AsyncStorage.removeItem("authUser");
          Alert.alert(
            "Compte chauffeur",
            "Ce compte est un compte chauffeur. Veuillez vous connecter avec l'application chauffeur."
          );
          router.replace("/auth/LoginPhone");
        }
      } catch (err) {
        console.warn("Role check error:", err);
      }
    };
    checkRole();
  }, [API_URL, router]);

  // 2. Persistent Ride Recovery
  useEffect(() => {
    const checkActiveRide = async () => {
      try {
        if (!API_URL) return;
        const token = await AsyncStorage.getItem("authToken");
        if (!token) return;

        const res = await fetch(`${API_URL}/passenger/rides/current`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;
        const ride = await res.json();

        if (ride && ride.id) {
          if (ride.status === 'requested') {
            router.replace({
              pathname: '/screens/ride/SearchingDriver',
              params: {
                rideId: String(ride.id),
                vehicleName: ride.vehicle_type === 'vip' ? 'VIP' : 'Standard'
              }
            });
          } else if (['accepted', 'arrived', 'started', 'ongoing'].includes(ride.status)) {
            router.replace({
              pathname: '/screens/ride/DriverTracking',
              params: {
                rideId: String(ride.id),
                vehicleName: ride.vehicle_type === 'vip' ? 'VIP' : 'Standard',
                driver: JSON.stringify(ride.driver)
              }
            });
          }
        }
      } catch (err) {
        console.warn("Active ride check error:", err);
      }
    };
    checkActiveRide();
  }, [API_URL, router]);

  const renderActiveSection = () => {
    switch (selectedService) {
      case 'Course':
        return <CourseSection activeService={selectedService} />;
      case 'Déplacement':
        return <DeplacementSection />;
      case 'Livraison':
        return <DeliverySection />;
      default:
        return <CourseSection />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* LOGO AREA */}
        <View style={styles.logoRow}>
          <Image source={require('../../assets/images/LOGO_OR.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {/* PREMIUM HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingTitle}>Bonjour{userName ? `, ${userName}` : ''} !</Text>
            <Text style={styles.greetingSub}>Où souhaitez-vous aller aujourd'hui ?</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => navigation.navigate('screens/Notifications' as never)}
          >
            <Ionicons name="notifications" size={22} color={Colors.secondary} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* WALLET CARD - PREMIUM DESIGN */}
        <LinearGradient
          colors={[Colors.primary, '#4c66e8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.walletCard}
        >
          <View style={styles.walletInfo}>
            <View style={styles.walletRow}>
              <Ionicons name="wallet-outline" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
              <Text style={styles.walletLabel}>Solde TIC Wallet</Text>
            </View>
            <Text style={styles.walletBalance}>{walletBalance.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <TouchableOpacity
            style={styles.addFundsBtn}
            onPress={() => navigation.navigate('screens/wallet/AddFunds' as never)}
          >
            <Text style={styles.addFundsText}>Recharger</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </LinearGradient>

        {/* SERVICE SELECTOR TABS */}
        <View style={styles.selectorContainer}>
          <HomeServiceSelector activeService={selectedService} onChange={setSelectedService} />
        </View>

        {/* DYNAMIC CONTENT SECTION */}
        <View style={styles.sectionContainer}>
          {renderActiveSection()}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FD' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },

  logoRow: { marginBottom: 12 },
  logo: { width: 80, height: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  greetingTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 22,
    color: '#1A1D1E'
  },
  greetingSub: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: '#6A6A6A',
    marginTop: 2
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  notificationDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.white,
    backgroundColor: Colors.error
  },

  walletCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6
  },
  walletInfo: { flex: 1 },
  walletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  walletLabel: {
    fontFamily: Fonts.titilliumWeb,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  walletBalance: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.white,
    fontSize: 26
  },
  addFundsBtn: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  addFundsText: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.secondary,
    fontSize: 13,
    marginRight: 4
  },

  selectorContainer: {
    marginBottom: 20
  },
  sectionContainer: {
    marginTop: 0,
  },
});
