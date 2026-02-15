import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Alert, StatusBar } from 'react-native';
import { useNavigation, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';

import { Colors } from '../theme';
import { Fonts } from '../font';

// New Components
import HomeServiceSelector from '../components/HomeServiceSelector';
import CourseSection from '../components/CourseSection';
import DeplacementSection from '../components/DeplacementSection';
import DeliverySection from '../components/DeliverySection';

type ServiceType = 'Course' | 'Déplacement' | 'Livraison';

interface ActiveRide {
  id: number;
  status: string;
  vehicle_type: string;
  driver?: any;
  fare_amount?: number;
  distance_m?: number;
  payment_method?: string;
  breakdown?: any;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
}

export default function HomeTab() {
  const navigation = useNavigation();
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<ServiceType>('Course');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userName, setUserName] = useState<string>('');
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const dismissedCompletedRideRef = React.useRef<string | null>(null);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // Wallet icon pulse animation
  const walletIconScale = useSharedValue(1);
  useEffect(() => {
    walletIconScale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);
  const walletIconStyle = useAnimatedStyle(() => ({
    marginRight: 6,
    transform: [{ scale: walletIconScale.value }],
    opacity: 0.7 + walletIconScale.value * 0.15,
  }));

  // 1. Session Protection, User Data & Wallet Balance
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

        // Fetch user profile and wallet balance
        const [userRes, walletRes] = await Promise.all([
          fetch(`${API_URL}/auth/me`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/passenger/wallet`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          })
        ]);

        if (userRes.ok) {
          const user = await userRes.json();
          setUserName(user.name);
          if (user?.role === "driver") {
            await AsyncStorage.multiRemove(["authToken", "authUser"]);
            Alert.alert("Compte chauffeur", "Veuillez vous connecter avec l'application chauffeur.");
            router.replace("/auth/LoginPhone");
          }
        }

        if (walletRes.ok) {
          const wallet = await walletRes.json();
          setWalletBalance(Number(wallet.balance) || 0);
        }
      } catch (err) {
        console.warn("Home screen init error:", err);
      }
    };
    checkRole();
  }, [API_URL, router]);

  // 2. Check for Active Ride (show banner instead of auto-redirect)
  useFocusEffect(
    useCallback(() => {
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

          if (!res.ok) {
            setActiveRide(null);
            return;
          }
          const ride = await res.json();

          if (ride && ride.id) {
            // Skip completed rides that were already dismissed
            if (ride.status === 'completed' && dismissedCompletedRideRef.current === String(ride.id)) {
              setActiveRide(null);
              return;
            }
            setActiveRide(ride);
          } else {
            setActiveRide(null);
          }
        } catch (err) {
          console.warn("Active ride check error:", err);
          setActiveRide(null);
        }
      };
      checkActiveRide();
    }, [API_URL])
  );

  // Navigate to active ride screen
  const handleReturnToRide = () => {
    if (!activeRide) return;

    if (activeRide.status === 'requested') {
      router.push({
        pathname: '/screens/ride/SearchingDriver',
        params: {
          rideId: String(activeRide.id),
          vehicleName: activeRide.vehicle_type === 'vip' ? 'VIP' : 'Standard'
        }
      });
    } else if (['accepted', 'arrived', 'started', 'ongoing'].includes(activeRide.status)) {
      router.push({
        pathname: '/screens/ride/DriverTracking',
        params: {
          rideId: String(activeRide.id),
          vehicleName: activeRide.vehicle_type === 'vip' ? 'VIP' : 'Standard',
          driver: JSON.stringify(activeRide.driver)
        }
      });
    } else if (activeRide.status === 'completed') {
      // Mark this completed ride as dismissed so we don't loop
      dismissedCompletedRideRef.current = String(activeRide.id);
      router.push({
        pathname: '/screens/ride/RideReceipt',
        params: {
          rideId: String(activeRide.id),
          amount: activeRide.fare_amount || 0,
          distanceKm: (activeRide.distance_m || 0) / 1000,
          vehicleName: activeRide.vehicle_type === 'vip' ? 'VIP' : 'Standard',
          paymentMethod: activeRide.payment_method || 'cash',
          breakdown: activeRide.breakdown ? JSON.stringify(activeRide.breakdown) : undefined,
          pickupLat: activeRide.pickup_lat,
          pickupLng: activeRide.pickup_lng,
          dropoffLat: activeRide.dropoff_lat,
          dropoffLng: activeRide.dropoff_lng
        }
      });
    }
  };

  // Get status label for active ride banner
  const getActiveRideLabel = () => {
    if (!activeRide) return '';
    switch (activeRide.status) {
      case 'requested': return 'Recherche de chauffeur en cours...';
      case 'accepted': return 'Chauffeur en route vers vous';
      case 'arrived': return 'Votre chauffeur est arrivé';
      case 'started':
      case 'ongoing': return 'Course en cours';
      case 'completed': return 'Évaluer votre course';
      default: return 'Course active';
    }
  };

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
          colors={['#1a3a8a', '#2d5dd9', '#4c7cf5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          {/* Decorative blurred coins */}
          <View style={styles.coinDecor1} />
          <View style={styles.coinDecor2} />
          <View style={styles.coinDecor3} />

          <View style={styles.walletInfo}>
            <View style={styles.walletRow}>
              <Animated.View style={walletIconStyle}>
                <Ionicons name="wallet-outline" size={18} color="rgba(255,255,255,0.85)" />
              </Animated.View>
              <Text style={styles.walletLabel}>Solde TIC Wallet</Text>
            </View>
            <Text style={styles.walletBalance}>{walletBalance.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <TouchableOpacity
            style={styles.addFundsBtn}
            onPress={() => navigation.navigate('screens/wallet/AddFunds' as never)}
          >
            <Text style={styles.addFundsText}>Recharger</Text>
            <Ionicons name="chevron-forward" size={16} color="#1a3a8a" />
          </TouchableOpacity>
        </LinearGradient>

        {/* SERVICE SELECTOR TABS */}
        <View style={styles.selectorContainer}>
          <HomeServiceSelector activeService={selectedService} onChange={setSelectedService} />
        </View>

        {/* ACTIVE RIDE BANNER - inline */}
        {activeRide && (
          <TouchableOpacity
            style={styles.activeRideBanner}
            onPress={handleReturnToRide}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF6B35', '#F7931E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.activeRideBannerGradient}
            >
              <View style={styles.activeRideBannerContent}>
                <View style={styles.activeRidePulse} />
                <View style={styles.activeRideInfo}>
                  <Text style={styles.activeRideLabel}>{getActiveRideLabel()}</Text>
                  <Text style={styles.activeRideAction}>Appuyez pour retourner à votre course</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

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
    borderRadius: 10,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
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
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#1a3a8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6
  },
  coinDecor1: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    top: -20,
    right: -10,
  },
  coinDecor2: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
    bottom: -15,
    right: 60,
  },
  coinDecor3: {
    position: 'absolute',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    top: 5,
    right: 100,
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
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6
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

  // Active Ride Banner Styles
  activeRideBanner: {
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  activeRideBannerGradient: {
    borderRadius: 12,
    padding: 16,
  },
  activeRideBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeRidePulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 12,
  },
  activeRideInfo: {
    flex: 1,
  },
  activeRideLabel: {
    fontFamily: Fonts.titilliumWebBold,
    color: '#fff',
    fontSize: 15,
  },
  activeRideAction: {
    fontFamily: Fonts.titilliumWeb,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
});
