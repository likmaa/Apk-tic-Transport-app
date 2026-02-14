import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../providers/LocationProvider';
import { Colors, Fonts } from '../theme';

export default function DeliverySection() {
  const router = useRouter();
  const [packageSize, setPackageSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [fragile, setFragile] = useState(false);
  const [notes, setNotes] = useState('');
  const { origin, destination } = useLocationStore();
  const isValid = !!origin && !!destination;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Envoyer un colis</Text>

      {/* ADDRESS CARD */}
      <View style={styles.formCard}>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'origin' } })}
        >
          <View style={[styles.iconDot, { backgroundColor: '#E0E7FF' }]}>
            <MaterialCommunityIcons name="radiobox-marked" size={18} color={Colors.primary} />
          </View>
          <View style={styles.inputContent}>
            <Text style={styles.inputLabel}>ADRESSE DE DÉPART</Text>
            <Text style={[styles.inputValue, !origin && styles.placeholder]} numberOfLines={1}>
              {origin?.address || "D'où part le colis ?"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.inputSeparator} />

        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'destination' } })}
        >
          <View style={[styles.iconDot, { backgroundColor: '#FEE2E2' }]}>
            <MaterialCommunityIcons name="map-marker" size={18} color="#EF4444" />
          </View>
          <View style={styles.inputContent}>
            <Text style={styles.inputLabel}>ADRESSE D'ARRIVÉE</Text>
            <Text style={[styles.inputValue, !destination && styles.placeholder]} numberOfLines={1}>
              {destination?.address || "Où doit-on livrer ?"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.subSubtitle}>Taille du colis</Text>
      <View style={styles.sizeGrid}>
        {[
          { id: 'small', label: 'Petit', icon: 'email-outline' },
          { id: 'medium', label: 'Moyen', icon: 'cube-outline' },
          { id: 'large', label: 'Grand', icon: 'package-variant-closed' },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.8}
            onPress={() => setPackageSize(opt.id as any)}
            style={[styles.sizeOption, packageSize === opt.id && styles.sizeOptionActive]}
          >
            <View style={[styles.sizeIconBg, packageSize === opt.id && { backgroundColor: Colors.white }]}>
              <MaterialCommunityIcons
                name={opt.icon as any}
                size={22}
                color={packageSize === opt.id ? Colors.primary : Colors.gray}
              />
            </View>
            <Text style={[styles.sizeText, packageSize === opt.id && styles.sizeTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.fragileBox, fragile && styles.fragileBoxActive]}
        onPress={() => setFragile(!fragile)}
      >
        <Ionicons
          name={fragile ? "checkbox" : "square-outline"}
          size={24}
          color={fragile ? Colors.primary : Colors.gray}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.fragileTitle}>Colis fragile</Text>
          <Text style={styles.fragileSub}>Gestion spéciale du transport</Text>
        </View>
        <Ionicons name="alert-circle-outline" size={20} color={fragile ? Colors.primary : Colors.gray} />
      </TouchableOpacity>

      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Instructions au livreur</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Ex: Sonner à la porte, laisser à la réception..."
          placeholderTextColor="#9CA3AF"
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <View style={styles.infoAlert}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.gray} />
        <Text style={styles.infoText}>
          Livraison {packageSize === 'small' ? 'rapide' : packageSize === 'medium' ? 'standard' : 'grand format'}{fragile ? ' • Option fragile incluse' : ''}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.confirmButton, !isValid && { opacity: 0.6 }]}
        disabled={!isValid}
        onPress={() => router.push({ pathname: '/screens/delivery/PackageDetails' })}
      >
        <Text style={styles.confirmButtonText}>Suivant</Text>
        <Ionicons name="arrow-forward" size={20} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  sectionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: '#1A1D1E', marginBottom: 16 },

  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  inputBox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  iconDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  inputContent: { flex: 1 },
  inputLabel: { fontFamily: Fonts.titilliumWebBold, fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  inputValue: { fontFamily: Fonts.titilliumWebBold, fontSize: 15, color: '#1A1D1E' },
  placeholder: { color: '#D1D5DB' },
  inputSeparator: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10, marginLeft: 50 },

  subSubtitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: '#1A1D1E', marginBottom: 12 },
  sizeGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  sizeOption: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  sizeOptionActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary
  },
  sizeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  sizeText: { fontFamily: Fonts.titilliumWebBold, fontSize: 13, color: Colors.gray },
  sizeTextActive: { color: Colors.white },

  fragileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 24
  },
  fragileBoxActive: {
    borderColor: Colors.secondary,
    backgroundColor: '#FFF7ED'
  },
  fragileTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 15, color: '#1A1D1E' },
  fragileSub: { fontFamily: Fonts.titilliumWeb, fontSize: 12, color: '#6B7280' },

  notesSection: { marginBottom: 24 },
  notesLabel: { fontFamily: Fonts.titilliumWebBold, color: '#1A1D1E', marginBottom: 8, fontSize: 14 },
  notesInput: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: Fonts.titilliumWeb,
    color: '#1A1D1E',
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },

  infoAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 10,
    marginBottom: 24
  },
  infoText: { fontFamily: Fonts.titilliumWeb, fontSize: 13, color: '#6B7280' },

  confirmButton: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 40
  },
  confirmButtonText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },
});
