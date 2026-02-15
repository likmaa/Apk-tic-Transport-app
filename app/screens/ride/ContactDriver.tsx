// screens/ride/ContactDriver.tsx
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Alert, Image, Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../theme';
import { Fonts } from '../../font';
import { getImageUrl } from '../../utils/images';
import { Share } from 'react-native';

type RootParams = {
  'screens/ride/ContactDriver': {
    driverName?: string;
    vehicleName?: string;
    driverImage?: string;
    vehiclePlate?: string;
    driverPhone?: string;
    pickupTime?: string;
    destination?: string;
  } | undefined;
};

export default function ContactDriver() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/ContactDriver'>>();

  // Utilisation de valeurs par défaut plus réalistes
  const driverName = route.params?.driverName || 'Chauffeur';
  const vehicleName = route.params?.vehicleName || 'Véhicule TIC';
  const vehiclePlate = route.params?.vehiclePlate || '---';
  const driverImage = route.params?.driverImage;
  const phoneNumber = route.params?.driverPhone || '';
  const sanitizedPhone = phoneNumber.replace(/[^\d+]/g, '');

  const handleShare = async () => {
    try {
      const time = route.params?.pickupTime ?
        new Date(route.params.pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const dest = route.params?.destination || 'ma destination';

      const shareMsg = `Je suis en route avec TIC ! 🚕\n\n` +
        `👤 Chauffeur : ${driverName} en ${vehicleName} (${vehiclePlate})\n` +
        `📍 Destination : ${dest}\n` +
        (time ? `⏰ Prise en charge : ${time}\n` : '') +
        `Suis mon trajet en toute sécurité.`;

      await Share.share({ message: shareMsg });
    } catch (error) {
      console.error(error);
    }
  };

  const openPhone = () => {
    if (!sanitizedPhone) return Alert.alert('Information', 'Numéro de téléphone non disponible.');
    Linking.openURL(`tel:${sanitizedPhone}`).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir l'application Téléphone.")
    );
  };

  const openWhatsApp = () => {
    if (!sanitizedPhone) return Alert.alert('Information', 'Numéro de téléphone non disponible.');
    const digits = sanitizedPhone.replace(/[^\d]/g, '');
    if (!digits.length) return;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent("Bonjour, j'aimerais vous contacter concernant ma course.")}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp.")
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={() => navigation.goBack()}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.handle} />

          <Text style={styles.sheetTitle}>Contacter le chauffeur</Text>

          <View style={[styles.driverCard, Shadows.md]}>
            <Image
              source={driverImage ? { uri: getImageUrl(driverImage) || '' } : require('../../../assets/images/LOGO_OR.png')}
              style={styles.avatar}
            />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.vehicleInfo}>{vehicleName}</Text>
              <Text style={styles.plateText}>{vehiclePlate}</Text>
            </View>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionItem} onPress={openPhone}>
              <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="call" size={24} color="#22C55E" />
              </View>
              <Text style={styles.actionLabel}>Appeler</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={openWhatsApp}>
              <View style={[styles.actionIcon, { backgroundColor: '#F0FDFA' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#0D9488" />
              </View>
              <Text style={styles.actionLabel}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleShare}>
              <View style={[styles.actionIcon, { backgroundColor: '#F8FAFC' }]}>
                <Ionicons name="share-social" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Partager</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={() => Alert.alert('S.O.S', 'Le service d’urgence a été prévenu de votre position.')}>
              <View style={[styles.actionIcon, { backgroundColor: '#FEF2F2' }]}>
                <MaterialCommunityIcons name="alert-decagram" size={26} color="#EF4444" />
              </View>
              <Text style={styles.actionLabel}>Urgence</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  content: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 20,
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 24,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 16,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
  },
  vehicleInfo: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  plateText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 13,
    color: Colors.primary,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 32,
  },
  actionItem: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: Colors.black,
  },
  closeButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  closeButtonText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.gray,
  },
});
