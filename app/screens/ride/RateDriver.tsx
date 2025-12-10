import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type RootParams = {
  'screens/ride/RateDriver': { rideId: number };
};

export default function RateDriverScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/RateDriver'>>();
  const rideId = route.params?.rideId;

  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!rideId) {
      Alert.alert('Course inconnue', "Impossible d'identifier la course à noter.");
      return;
    }
    if (!API_URL) {
      Alert.alert('Configuration', "L'URL de l'API n'est pas définie.");
      return;
    }
    setLoading(true);
    try {
      const token = await (async () => {
        try {
          const as = require('@react-native-async-storage/async-storage').default;
          return await as.getItem('authToken');
        } catch {
          return null;
        }
      })();
      if (!token) {
        setLoading(false);
        Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
        return;
      }

      const res = await fetch(`${API_URL}/passenger/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ride_id: rideId,
          stars,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        Alert.alert('Erreur', text || 'Impossible denvoyer votre avis.');
      } else {
        Alert.alert('Merci', 'Votre avis a bien été enregistré.', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch {
      Alert.alert('Erreur', 'Une erreur est survenue lors de lenvoi de votre avis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Noter votre chauffeur</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Comment sest passée votre course ?</Text>
        <Text style={styles.subtitle}>Donnez une note entre 1 et 5 étoiles.</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setStars(value)}
              activeOpacity={0.7}
              style={styles.starButton}
            >
              <Ionicons
                name={value <= stars ? 'star' : 'star-outline'}
                size={32}
                color={value <= stars ? '#fbbf24' : Colors.gray}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.commentLabel}>Un commentaire ? (optionnel)</Text>
        <TextInput
          style={styles.commentInput}
          placeholder="Partagez un détail sur votre expérience..."
          placeholderTextColor={Colors.gray}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>{loading ? 'Envoi...' : 'Envoyer mon avis'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  headerTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontFamily: Fonts.titilliumWebBold, fontSize: 22, color: Colors.black, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.titilliumWeb, fontSize: 15, color: Colors.gray, marginBottom: 24 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24 },
  starButton: { marginHorizontal: 6 },
  commentLabel: { fontFamily: Fonts.titilliumWebBold, fontSize: 15, color: Colors.black, marginBottom: 8 },
  commentInput: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.black,
    textAlignVertical: 'top',
    backgroundColor: Colors.white,
  },
  footer: { paddingHorizontal: 16, paddingBottom: 24 },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },
});
