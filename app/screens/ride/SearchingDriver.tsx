// screens/ride/SearchingDriver.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import MapView from 'react-native-maps';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useLocationStore } from '../../providers/LocationProvider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPusherClient, unsubscribeChannel } from '../../services/pusherClient';

type RootParams = {
  'screens/ride/SearchingDriver': {
    origin: { address: string; lat: number; lon: number };
    destination: { address: string; lat: number; lon: number };
    priceEstimate: number | null;
    method: any;
    serviceType?: string | null;
    rideId?: number;
    vehicleName?: string;
  } | undefined;
};

// Onde animée
const Pulse = ({ delay }: { delay: number }) => {
  const opacity = useSharedValue(0.6);
  const scale = useSharedValue(1);

  useEffect(() => {
    const anim = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );

    const t = setTimeout(() => {
      scale.value = anim;
      opacity.value = withRepeat(withTiming(0, { duration: 2400 }), -1, false);
    }, delay);

    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * 4.2 }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulse, style]} />;
};

export default function SearchingDriver() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/SearchingDriver'>>();
  const { origin } = useLocationStore();
  const vehicleName = route.params?.vehicleName || 'Standard';
  const rideId = route.params?.rideId;

  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const [assignmentReceived, setAssignmentReceived] = useState(false);

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

        const client = await getPusherClient();
        channel = client.subscribe(`private-rider.${riderId}`);
        channel.bind('ride.accepted', (payload: any) => {
          if (cancelled) return;
          const payloadRideId = payload?.rideId ?? rideId;
          if (rideId && payloadRideId && Number(payloadRideId) !== Number(rideId)) {
            return;
          }
          setAssignmentReceived(true);
          navigation.navigate({
            name: 'screens/ride/DriverTracking',
            params: {
              vehicleName,
              rideId: payloadRideId ?? rideId,
              driver: payload?.driver,
            },
          } as never);
        });
      } catch (error) {
        console.warn('Realtime subscription failed', error);
      }
    };

    subscribe();

    return () => {
      cancelled = true;
      unsubscribeChannel(channel);
    };
  }, [rideId, navigation, vehicleName]);

  useEffect(() => {
    if (!rideId || !API_URL || assignmentReceived) return;

    let cancelled = false;
    let abortController: AbortController | null = null;

    const waitForAssignment = async () => {
      while (!cancelled && !assignmentReceived) {
        try {
          abortController = new AbortController();
          const token = await AsyncStorage.getItem('authToken');
          const res = await fetch(`${API_URL}/passenger/rides/${rideId}/wait-assignment?timeout=25`, {
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: abortController.signal,
          });

          if (cancelled) return;

          if (res.status === 200) {
            setAssignmentReceived(true);
            navigation.navigate({
              name: 'screens/ride/DriverTracking',
              params: { vehicleName, rideId },
            } as never);
            return;
          }

          if (res.status !== 204) {
            Alert.alert('Erreur', 'Impossible de trouver un chauffeur. Veuillez réessayer.');
            navigation.goBack();
            return;
          }
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            return;
          }
          if (!cancelled) {
            Alert.alert('Connexion perdue', 'Nouvelle tentative...');
          }
        }
      }
    };

    waitForAssignment();

    return () => {
      cancelled = true;
      abortController?.abort();
    };
  }, [API_URL, rideId, navigation, vehicleName, assignmentReceived]);

  return (
    <View style={styles.container}>

      {/* Carte */}
      {origin && (
        <MapView
          style={StyleSheet.absoluteFill}
          provider="google"
          initialRegion={{
            latitude: origin.lat,
            longitude: origin.lon,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          userInterfaceStyle="dark"
          scrollEnabled={false}
          zoomEnabled={false}
        />
      )}

      {/* Overlay sombre + blur visuel */}
      <View style={styles.overlay} />

      {/* Effet radar */}
      <View style={styles.pulseContainer}>
        <Pulse delay={0} />
        <Pulse delay={800} />
        <Pulse delay={1600} />
        <View style={styles.pulseCenter} />
      </View>

      {/* Textes */}
      <View style={styles.textBlock}>
        <Text style={styles.title}>Recherche du chauffeur</Text>
        <Text style={styles.subtitle}>
          Nous contactons les chauffeurs proches pour votre trajet en{' '}
          <Text style={styles.vehicle}>{vehicleName}</Text>.
        </Text>
      </View>

      {/* Bouton Annuler */}
      <SafeAreaView style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={22} color="#000" />
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  pulseContainer: {
    position: 'absolute',
    top: '33%',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 30,
    backgroundColor: `${Colors.primary}40`,
    borderWidth: 1.2,
    borderColor: Colors.primary,
  },

  pulseCenter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    elevation: 5,
  },

  textBlock: {
    position: 'absolute',
    top: '52%',
    width: '100%',
    paddingHorizontal: 30,
    alignItems: 'center',
  },

  title: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 26,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },

  subtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: '#d7d7d7',
    textAlign: 'center',
    lineHeight: 24,
  },

  vehicle: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.white,
  },

  footer: {
    position: 'absolute',
    bottom: 100,
    width: '100%',
  },

  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#fff',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
  },

  cancelText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: '#000',
    marginLeft: 6,
  },
});
