import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useAuth } from '../../providers/AuthProvider';
import { getPusherClient, unsubscribeChannel } from '../../services/pusherClient';
import { Channel } from 'pusher-js';

export default function SearchingDriverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rideId?: string }>();
  const rideId = params.rideId ? Number(params.rideId) : null;
  const [status, setStatus] = useState<string>('requested');
  const [price, setPrice] = useState<number | null>(null);
  const { token, user } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    if (!rideId || !token || !user || !API_URL) return;

    let pusherChannel: Channel | null = null;
    let isActive = true;

    const setupPusher = async () => {
      try {
        // Initial fetch to get current status/price
        const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (isActive) {
            setStatus(json.status || 'requested');
            if (typeof json.fare_amount === 'number') {
              setPrice(json.fare_amount);
            }
            if (json.status === 'accepted' || json.status === 'ongoing') {
              router.replace({ pathname: '/screens/ride/DriverTracking', params: { rideId: String(rideId) } });
              return; // No need to subscribe if already accepted
            }
          }
        }

        // Subscribe to Pusher
        const client = await getPusherClient(token);
        // Backend broadcasts RideAccepted on private-rider.{rider_id}
        const channelName = `private-rider.${user.id}`;

        pusherChannel = client.subscribe(channelName);

        pusherChannel.bind('ride.accepted', (data: any) => {
          console.log('ride.accepted Event', data);
          if (isActive && Number(data.rideId) === rideId) {
            router.replace({ pathname: '/screens/ride/DriverTracking', params: { rideId: String(rideId) } });
          }
        });

        // Also listen for status updates if needed (using ride-specific channel if backend supports it)
        // For now, ride.accepted is the most critical for this screen.

      } catch (e) {
        console.warn('Pusher setup error', e);
      }
    };

    setupPusher();

    return () => {
      isActive = false;
      if (pusherChannel) {
        unsubscribeChannel(pusherChannel);
      }
    };
  }, [rideId, token]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.title}>Recherche d'un chauffeur...</Text>
      {price !== null && (
        <Text style={styles.subtitle}>Tarif TIC : {price.toLocaleString('fr-FR')} FCFA</Text>
      )}
      <Text style={styles.subtitle}>
        Statut : {
          status === 'requested' ? 'En attente' :
            status === 'accepted' ? 'Accepté' :
              status === 'ongoing' ? 'En cours' : status
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black },
  subtitle: { marginTop: 8, fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray },
});
