import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

export default function SearchingDriverScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{ rideId?: string }>();
  const rideId = params.rideId ? Number(params.rideId) : null;
  const [status, setStatus] = useState<string>('requested');
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let interval: number | undefined;
    const API_URL = process.env.EXPO_PUBLIC_API_URL;
    if (!API_URL || !rideId) {
      return;
    }

    const poll = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        setStatus(json.status || 'requested');
        if (typeof json.fare_amount === 'number') {
          setPrice(json.fare_amount);
        }

        if (json.status === 'accepted' || json.status === 'ongoing') {
          clearInterval(interval as NodeJS.Timer);
          router.replace({ pathname: '/screens/ride/DriverTracking', params: { rideId: String(rideId) } });
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    interval = setInterval(poll, 3000) as unknown as number;

    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [rideId]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.title}>Recherche d'un chauffeur...</Text>
      {price !== null && (
        <Text style={styles.subtitle}>Tarif TIC : {price.toLocaleString('fr-FR')} FCFA</Text>
      )}
      <Text style={styles.subtitle}>Statut : {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black },
  subtitle: { marginTop: 8, fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray },
});
