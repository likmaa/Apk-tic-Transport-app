// screens/ride/ContactDriver.tsx
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Alert, Image } from 'react-native';
import { useNavigation } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { getImageUrl } from '../../utils/images';

type RootParams = {
  'screens/ride/ContactDriver': {
    driverName?: string;
    vehicleName?: string;
    driverImage?: string; // URL de l'image du chauffeur
    vehiclePlate?: string; // Plaque d'immatriculation
  } | undefined;
};

export default function ContactDriver() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/ContactDriver'>>();

  // Utilisation de valeurs par défaut plus réalistes
  const driverName = route.params?.driverName || 'Firmin T.';
  const vehicleName = route.params?.vehicleName || 'Toyota Yaris';
  const vehiclePlate = route.params?.vehiclePlate || 'AG 1234 RB';
  const driverImage = route.params?.driverImage; // Sera undefined si non fourni
  const phoneNumber = '+22900000000'; // Numéro de téléphone mock
  const sanitizedPhone = phoneNumber.replace(/[^\d+]/g, '');

  const openPhone = () => {
    Linking.openURL(`tel:${sanitizedPhone}`).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir l'application Téléphone.")
    );
  };

  const openWhatsApp = () => {
    const digits = sanitizedPhone.replace(/[^\d]/g, '');
    if (!digits.length) return;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent("Bonjour, j'aimerais vous contacter concernant ma course.")}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp.")
    );
  };

  return (
    <View style={styles.container}>
      {/* Fond semi-transparent cliquable pour fermer */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.bottomSheet}>
          {/* Poignée pour indiquer que le panneau est déplaçable */}
          <View style={styles.handle} />

          {/* Carte de profil du chauffeur */}
          <View style={styles.driverCard}>
            <Image
              source={driverImage ? { uri: getImageUrl(driverImage) || '' } : require('../../../assets/images/LOGO_OR.png')} // Image par défaut
              style={styles.avatar}
            />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.vehicleInfo}>{vehicleName} • {vehiclePlate}</Text>
            </View>
          </View>

          {/* Grille d'actions */}
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={openPhone}>
              <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="call" size={26} color="#4CAF50" />
              </View>
              <Text style={styles.actionLabel}>Appeler</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={openWhatsApp}>
              <View style={[styles.actionIcon, { backgroundColor: '#e0f2f1' }]}>
                <Ionicons name="logo-whatsapp" size={26} color="#128C7E" />
              </View>
              <Text style={styles.actionLabel}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Fonctionnalité à venir', 'Partagez les détails de votre course avec un contact.')}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.background }]}>
                <Ionicons name="share-social" size={26} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Partager</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Problème signalé', 'Notre support a été notifié. Nous vous contacterons si nécessaire.')}>
              <View style={[styles.actionIcon, { backgroundColor: '#FFEBEE' }]}>
                <MaterialCommunityIcons name="alert-circle" size={28} color="#F44336" />
              </View>
              <Text style={styles.actionLabel}>Urgence</Text>
            </TouchableOpacity>
          </View>

          {/* Bouton Annuler */}
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fond semi-transparent
    justifyContent: 'flex-end',
    marginBottom: 50,
  },
  safeArea: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheet: {
    padding: 20,
    paddingBottom: 10,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.lightGray,
    alignSelf: 'center',
    marginBottom: 16,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.lightGray,
    marginRight: 16,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 22,
    color: Colors.black,
  },
  vehicleInfo: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.gray,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: Colors.black,
  },
  cancelButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: "white",
  },
});
