import React, { useEffect } from 'react';
import { View, StyleSheet, Image, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from './theme';
import { useAuth } from './providers/AuthProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function Splash() {
  const router = useRouter();
  const { signOut, token: contextToken } = useAuth(); // Access auth context

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Vérifier le token
        const token = await AsyncStorage.getItem('authToken');

        if (token && API_URL) {
          try {
            const res = await fetch(`${API_URL}/auth/me`, {
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });

            if (res.ok) {
              // Token valide, on va à l'accueil
              if (!cancelled) {
                // Petit délai pour l'UX
                setTimeout(() => router.replace('/'), 800);
              }
              return;
            } else {
              // Token invalide ou expiré
              await signOut(); // Nettoyer le contexte
            }
          } catch (e) {
            // Erreur réseau ou autre, on continue s'il n'y a pas de réponse auth
            // Optionnel: si pas de réseau, peut-être laisser passer si on veut un mode offline?
            // Pour l'instant on assume qu'on doit re-login si doute
          }
        }

        // 2) Logique Walkthrough
        const seen = await AsyncStorage.getItem('has_seen_walkthrough');
        const target = seen ? '/auth/LoginPhone' : '/walkthrough/Walkthrough1';
        // Note: Si seen=true mais pas de token, on va au Login, pas à Home ('/') qui est protégé

        if (!cancelled) {
          setTimeout(() => router.replace(target as any), 1000);
        }
      } catch (e) {
        if (!cancelled) router.replace('/auth/LoginPhone');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerWrap}>
        <Image
          source={require('../assets/images/LOGO.png')}
          resizeMode="contain"
          style={styles.logo}
        />
      </View>
      <ActivityIndicator color={Colors.white} size="large" style={styles.spinner} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 120,
  },
  spinner: {
    marginBottom: 40,
    alignSelf: 'center',
  },
});
