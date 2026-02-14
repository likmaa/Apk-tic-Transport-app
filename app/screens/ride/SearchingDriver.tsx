// screens/ride/SearchingDriver.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Alert, Dimensions, Image, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPlaceholder } from '../../components/MapPlaceholder';

// Tentative d'importation sécurisée de Mapbox
let Mapbox: any = null;
let MapView: any = View;
let Camera: any = View;

try {
  const MB = require('@rnmapbox/maps');
  Mapbox = MB.default || MB;
  MapView = MB.MapView;
  Camera = MB.Camera;

  if (Mapbox && typeof Mapbox.setAccessToken === 'function') {
    Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
  }
} catch (e) {
  Mapbox = null;
}
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  useDerivedValue
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useLocationStore } from '../../providers/LocationProvider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPusherClient, unsubscribeChannel } from '../../services/pusherClient';
import {
  subscribeToNetworkChanges,
  showNetworkErrorAlert,
  checkNetworkConnection,
  fetchWithRetry,
  saveRideState
} from '../../utils/networkHandler';

if (Mapbox) {
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
}

const { width, height } = Dimensions.get('window');

// Composant Pulse amélioré avec dégradé
const EnhancedPulse = ({ delay, color }: { delay: number; color: string }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      progress.value = withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.3, 4.5]) }],
    opacity: interpolate(progress.value, [0, 0.4, 1], [0.8, 0.4, 0]),
  }));

  return (
    <Animated.View style={[styles.pulse, animatedStyle]}>
      <LinearGradient
        colors={[color, 'transparent']}
        style={styles.pulseGradient}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
};

// Indicateur de recherche avec dots animés
const SearchingDots = () => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 400 })
    ), -1, false);
    dot2.value = withDelay(200, withRepeat(withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 400 })
    ), -1, false));
    dot3.value = withDelay(400, withRepeat(withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 400 })
    ), -1, false));
  }, []);

  const style1 = useAnimatedStyle(() => ({ opacity: interpolate(dot1.value, [0, 1], [0.3, 1]) }));
  const style2 = useAnimatedStyle(() => ({ opacity: interpolate(dot2.value, [0, 1], [0.3, 1]) }));
  const style3 = useAnimatedStyle(() => ({ opacity: interpolate(dot3.value, [0, 1], [0.3, 1]) }));

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, style1]} />
      <Animated.View style={[styles.dot, style2]} />
      <Animated.View style={[styles.dot, style3]} />
    </View>
  );
};

// Timer de recherche
const SearchTimer = ({ onTimeout }: { onTimeout: () => void }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => {
        const next = s + 1;
        if (next === 600) onTimeout(); // 10 minutes
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <View style={styles.timerContainer}>
      <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.7)" />
      <Text style={styles.timerText}>{formatted}</Text>
    </View>
  );
};

export default function SearchingDriver() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rideId?: string; vehicleName?: string; price?: string }>();
  const { origin, destination, setOrigin, setDestination } = useLocationStore();
  const vehicleName = params.vehicleName || 'Standard';
  const rideId = params.rideId ? Number(params.rideId) : undefined;
  const price = params.price ? Number(params.price) : null;
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const [assignmentReceived, setAssignmentReceived] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  // Recovery logic: if we don't have origin/destination, fetch them from the ride
  useEffect(() => {
    if (!rideId || !API_URL) return;
    if (origin && destination) return; // Already have them

    const fetchRideDetails = async () => {
      try {
        setLoadingDetails(true);
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetchWithRetry(`${API_URL}/passenger/rides/${rideId}`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) return;
        const json = await res.json();

        if (json?.pickup_address && json?.dropoff_address) {
          setOrigin({
            address: json.pickup_address,
            lat: Number(json.pickup_lat),
            lon: Number(json.pickup_lng),
          });
          setDestination({
            address: json.dropoff_address,
            lat: Number(json.dropoff_lat),
            lon: Number(json.dropoff_lng),
          });
        }
      } catch (e) {
        console.warn("Failed to recover ride details", e);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchRideDetails();
  }, [rideId, API_URL]);

  // Animation du bouton
  const buttonScale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }]
  }));

  const handleCancel = async () => {
    if (!rideId) {
      router.back();
      return;
    }
    router.push({
      pathname: '/screens/ride/CancelReason',
      params: { rideId: String(rideId) }
    });
  };

  // Fetch nearby drivers
  useEffect(() => {
    if (!origin || !API_URL || assignmentReceived) return;

    const fetchDrivers = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetchWithRetry(`${API_URL}/passenger/drivers/nearby?lat=${origin.lat}&lng=${origin.lon}&radius=5`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setNearbyDrivers(data.drivers || []);
        }
      } catch (e) {
        console.warn('Failed to fetch nearby drivers', e);
      }
    };

    fetchDrivers();
    const interval = setInterval(fetchDrivers, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [origin, assignmentReceived]);

  useEffect(() => {
    let channel: any = null;
    let cancelled = false;

    const subscribe = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('authUser');
        if (!storedUser) return;
        const parsed = JSON.parse(storedUser);
        const riderId = parsed?.id;
        if (!riderId) return;

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;
        const client = await getPusherClient(token);
        channel = client.subscribe(`private-rider.${riderId}`);
        channel.bind('ride.accepted', (payload: any) => {
          if (cancelled) return;
          const payloadRideId = payload?.rideId ?? rideId;
          if (rideId && payloadRideId && Number(payloadRideId) !== Number(rideId)) {
            return;
          }
          setAssignmentReceived(true);
          router.replace({
            pathname: '/screens/ride/DriverTracking',
            params: {
              vehicleName,
              rideId: String(payloadRideId ?? rideId),
              driver: JSON.stringify(payload?.driver),
            },
          });
        });

        channel.bind('ride.cancelled', (payload: any) => {
          if (cancelled) return;
          if (payload?.reason === 'timeout_no_driver') {
            setHasTimedOut(true);
          } else {
            Alert.alert('Course annulée', 'Votre demande de course a été annulée.');
            router.replace('/(tabs)');
          }
        });
      } catch (error) {
        console.warn('Realtime subscription failed', error);
      }
    };

    subscribe();

    // Periodic state saving & Status polling (fallback)
    const interval = setInterval(async () => {
      // Periodic state saving
      if (rideId && origin && destination) {
        saveRideState({ rideId, origin, destination, vehicleName, status: 'searching' }).catch(() => { });
      }

      // Status polling (fallback if Pusher fails)
      if (rideId && API_URL && !assignmentReceived) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const json = await res.json();
            if (json.status !== 'searching' && json.status !== 'pending') {
              // Ride was accepted or moved to another state
              if (['accepted', 'arrived', 'ongoing', 'started'].includes(json.status)) {
                setAssignmentReceived(true);
                router.replace({
                  pathname: '/screens/ride/DriverTracking',
                  params: {
                    vehicleName,
                    rideId: String(rideId),
                    driver: JSON.stringify(json.driver),
                  },
                });
              } else if (json.status === 'cancelled') {
                router.replace('/(tabs)');
              }
            }
          }
        } catch (e) {
          console.warn('Status polling fallback failed', e);
        }
      }
    }, 15000); // Every 15s

    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribeChannel(channel);
    };
  }, [rideId, router, vehicleName, origin, destination, assignmentReceived]);

  // Surveiller la connexion réseau
  useEffect(() => {
    // Vérifier l'état initial
    checkNetworkConnection().then(state => setIsOnline(state.isConnected));

    // S'abonner aux changements de connexion
    const unsubscribe = subscribeToNetworkChanges((state) => {
      const wasOnline = isOnline;
      setIsOnline(state.isConnected);

      // Si on perd la connexion pendant la recherche
      if (!state.isConnected && wasOnline && rideId) {
        showNetworkErrorAlert(false);
      }
    });

    return unsubscribe;
  }, [isOnline, rideId]);



  return (
    <View style={styles.container}>
      {/* Carte en arrière-plan */}
      {origin && (
        Mapbox ? (
          <MapView
            style={StyleSheet.absoluteFill}
            scrollEnabled={false}
            attributionEnabled={false}
            logoEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            zoomEnabled={false}
          >
            <Camera
              defaultSettings={{
                centerCoordinate: [origin.lon, origin.lat],
                zoomLevel: 15
              }}
            />
            {/* Nearby Drivers Markers */}
            {nearbyDrivers.map((d) => (
              <Mapbox.PointAnnotation
                key={`driver-${d.id}`}
                id={`driver-${d.id}`}
                coordinate={[Number(d.lng), Number(d.lat)]}
              >
                <View style={styles.driverMarkerContainer}>
                  <MaterialCommunityIcons name="car" size={18} color={Colors.black} />
                </View>
              </Mapbox.PointAnnotation>
            ))}
          </MapView>
        ) : (
          <MapPlaceholder style={StyleSheet.absoluteFill} />
        )
      )}

      {/* Overlay avec dégradé Orange vers Blanc */}
      <LinearGradient
        colors={['rgba(255,123,0,0.4)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,1)']}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Effet radar amélioré en Orange */}
      <View style={styles.pulseContainer}>
        <EnhancedPulse delay={0} color={Colors.secondary + '60'} />
        <EnhancedPulse delay={700} color={Colors.secondary + '50'} />
        <EnhancedPulse delay={1400} color={Colors.secondary + '40'} />

        {/* Centre avec icône véhicule */}
        <View style={styles.pulseCenterOuter}>
          <LinearGradient
            colors={[Colors.secondary, '#FF9D00']}
            style={styles.pulseCenterInner}
          >
            <MaterialCommunityIcons name="car-connected" size={28} color="#fff" />
          </LinearGradient>
        </View>
      </View>

      {/* Timer en haut */}
      <SafeAreaView style={styles.topBar}>
        <SearchTimer onTimeout={() => setHasTimedOut(true)} />
        {!isOnline && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline" size={14} color={Colors.white} />
            <Text style={styles.offlineText}>Hors ligne</Text>
          </View>
        )}
      </SafeAreaView>

      {/* Carte glassmorphic avec infos */}
      <View style={styles.infoCardWrapper}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.searchingBadge}>
              <SearchingDots />
              <Text style={styles.searchingText}>
                {hasTimedOut ? 'Recherche expirée' : 'Recherche TIC'}
              </Text>
            </View>
          </View>

          {hasTimedOut && (
            <View style={styles.timeoutMessage}>
              <Text style={styles.timeoutText}>
                Aucun chauffeur en ligne actuellement, contactez le support.
              </Text>
            </View>
          )}

          {/* Détails du trajet */}
          <View style={styles.routeDetails}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.routeAddress} numberOfLines={1}>
                {origin?.address || 'Point de départ'}
              </Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.routeAddress} numberOfLines={1}>
                {destination?.address || 'Destination'}
              </Text>
            </View>
          </View>

          {/* Véhicule et prix */}
          <View style={styles.rideMetaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="car" size={20} color="rgba(255,255,255,0.7)" />
              <Text style={styles.metaText}>{vehicleName}</Text>
            </View>
            {price && (
              <View style={styles.metaItem}>
                <Text style={styles.priceText}>{price.toLocaleString('fr-FR')} FCFA</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Bouton Annuler ou Support */}
      <SafeAreaView style={styles.footer}>
        {hasTimedOut ? (
          <View style={styles.supportButtons}>
            <TouchableOpacity
              style={[styles.supportButton, { backgroundColor: '#25D366' }]}
              onPress={() => {
                const message = `Bonjour Support TIC,\n\nJe ne trouve pas de chauffeur pour ma course #${rideId}.\n\nDépart: ${origin?.address}\nDestination: ${destination?.address}\n\nPouvez-vous m'aider ?`;
                Linking.openURL(`https://wa.me/2290157792662?text=${encodeURIComponent(message)}`);
              }}
            >
              <Ionicons name="logo-whatsapp" size={24} color="#fff" />
              <Text style={styles.supportButtonText}>WhatsApp Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.supportButton, { backgroundColor: Colors.secondary }]}
              onPress={() => Linking.openURL('tel:+2290157792662')}
            >
              <Ionicons name="call" size={24} color="#fff" />
              <Text style={styles.supportButtonText}>Appeler Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.backButtonText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.View style={buttonStyle}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={cancelling}
              onPressIn={() => { buttonScale.value = withTiming(0.96, { duration: 100 }); }}
              onPressOut={() => { buttonScale.value = withTiming(1, { duration: 100 }); }}
              activeOpacity={0.9}
            >
              <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
              <Text style={styles.cancelText}>{cancelling ? 'Annulation...' : 'Annuler la recherche'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <Text style={styles.footerHint}>
          {hasTimedOut ? 'Le support est disponible 24/7' : 'Nous vous préviendrons dès qu\'un chauffeur accepte'}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    alignItems: 'center',
  },
  offlineBadge: {
    position: 'absolute',
    top: 60,
    right: 20,
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
    zIndex: 1000,
  },
  offlineText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: Fonts.titilliumWebBold,
  },

  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },

  timerText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.black,
    fontVariant: ['tabular-nums'],
  },

  pulseContainer: {
    position: 'absolute',
    top: height * 0.22,
    alignSelf: 'center',
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  pulseGradient: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
  },

  pulseCenterOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  pulseCenterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },

  infoCardWrapper: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
  },

  infoCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },

  infoHeader: {
    marginBottom: 16,
  },

  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },

  searchingText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
  },

  routeDetails: {
    marginBottom: 16,
  },

  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  routeAddress: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
    color: Colors.black,
    flex: 1,
  },

  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginLeft: 5,
    marginVertical: 4,
  },

  rideMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  metaText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 15,
    color: Colors.gray,
  },

  priceText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: '#22c55e',
  },

  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },

  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },

  cancelText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: '#ef4444',
  },

  footerHint: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
    textAlign: 'center',
    marginTop: 12,
  },
  timeoutMessage: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12,
    borderRadius: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  timeoutText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  supportButtons: {
    gap: 12,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  supportButtonText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.white,
  },
  backButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: Colors.gray,
    textDecorationLine: 'underline',
  },
  driverMarkerContainer: {
    padding: 3,
    backgroundColor: 'white',
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#eee'
  },
});
