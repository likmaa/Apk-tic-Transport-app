import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, Animated, StatusBar } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from './theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function SplashScreen() {
  const router = useRouter();
  const segments = useSegments();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const prepareAndNavigate = async () => {
      let targetRoute = '/walkthrough/Walkthrough1';
      try {
        // 1) Vérifier la présence du token pour décider du délai
        const token = await AsyncStorage.getItem('authToken');
        const minDelay = token ? 1500 : 5000; // 1.5s pour les habitués, 5s pour les nouveaux

        // 2) Lancer la vérification et le timer en parallèle
        const verificationPromise = verifySession();
        const minDelayPromise = new Promise(resolve => setTimeout(resolve, minDelay));

        // 3) Attendre les deux
        const [determinedRoute] = await Promise.all([verificationPromise, minDelayPromise]);
        targetRoute = determinedRoute;

      } catch (e) {
        // En cas d'erreur fatale
        targetRoute = '/walkthrough/Walkthrough1';
      } finally {
        setIsChecking(false);
        router.replace(targetRoute as any);
      }
    };

    const verifySession = async (): Promise<string> => {
      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          return '/walkthrough/Walkthrough1';
        }

        if (!API_URL) {
          return '/(tabs)';
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.status === 401) {
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('authUser');
          return '/walkthrough/Walkthrough1';
        }

        if (res.ok) {
          return '/(tabs)';
        } else {
          return '/walkthrough/Walkthrough1';
        }

      } catch (error) {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          return '/(tabs)';
        } else {
          return '/walkthrough/Walkthrough1';
        }
      }
    };

    prepareAndNavigate();
  }, []);

  if (isChecking) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} translucent />
        <Animated.View style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}>
          <Image
            source={require('../assets/images/Logo blanc.png')}
            style={{ width: 180, height: 180, resizeMode: 'contain' }}
          />
          <ActivityIndicator size="large" color="white" style={{ marginTop: 20 }} />
        </Animated.View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20
  }
});
