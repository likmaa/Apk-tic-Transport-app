// screens/delivery/PackageDetails.tsx
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useServiceStore } from '../../providers/ServiceProvider';
import { useLocationStore } from '../../providers/LocationProvider';

export default function PackageDetails() {
  const navigation = useNavigation();
  const router = useRouter();
  const { packageDetails, setPackageDetails } = useServiceStore();
  const { origin, destination } = useLocationStore();

  const [recipientName, setRecipientName] = useState(packageDetails?.recipientName || '');
  const [recipientPhone, setRecipientPhone] = useState(packageDetails?.recipientPhone || '');
  const [description, setDescription] = useState(packageDetails?.description || '');
  const [weightKg, setWeightKg] = useState(packageDetails?.weightKg || '');
  const [fragile, setFragile] = useState(!!packageDetails?.fragile);

  const isValid = recipientName.trim().length >= 2 && recipientPhone.trim().length >= 8;
  const addressesValid = !!origin && !!destination;

  function onContinue() {
    if (!isValid) return;
    setPackageDetails({ recipientName, recipientPhone, description, weightKg, fragile });
    navigation.navigate('screens/ride/Confirm' as never);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {/* <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du Colis</Text>
        <View style={{ width: 44 }} />
      </View> */}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Section Adresses (pré-remplie depuis le store) */}
          <Text style={styles.sectionTitle}>Adresses</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.inputRow}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'origin' } })}
            >
              <MaterialCommunityIcons name="arrow-up-circle-outline" size={24} color={Colors.gray} style={styles.inputIcon} />
              <Text style={[styles.input, { height: 55, textAlignVertical: 'center' }]} numberOfLines={1}>
                {origin?.address || "Sélectionner l'adresse de départ"}
              </Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.inputRow}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'destination' } })}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={24} color={Colors.primary} style={styles.inputIcon} />
              <Text style={[styles.input, { height: 55, textAlignVertical: 'center' }]} numberOfLines={1}>
                {destination?.address || "Sélectionner l'adresse d'arrivée"}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Section Destinataire */}
          <Text style={styles.sectionTitle}>Pour qui est le colis ?</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="account-outline" size={24} color={Colors.gray} style={styles.inputIcon} />
              <TextInput
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Nom du destinataire"
                placeholderTextColor={Colors.gray}
                style={styles.input}
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="phone-outline" size={24} color={Colors.gray} style={styles.inputIcon} />
              <TextInput
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                keyboardType="phone-pad"
                placeholder="Téléphone du destinataire"
                placeholderTextColor={Colors.gray}
                style={styles.input}
              />
            </View>
          </View>

          {/* Section Contenu du colis */}
          <Text style={styles.sectionTitle}>Qu'est-ce que vous envoyez ?</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="pencil-box-outline" size={24} color={Colors.gray} style={styles.inputIcon} />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Description (ex: Documents, Vêtements)"
                placeholderTextColor={Colors.gray}
                style={styles.input}
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="weight-kilogram" size={24} color={Colors.gray} style={styles.inputIcon} />
              <TextInput
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="numeric"
                placeholder="Poids approximatif (kg)"
                placeholderTextColor={Colors.gray}
                style={styles.input}
              />
            </View>
          </View>

          {/* Section Options */}
          <Text style={styles.sectionTitle}>Options</Text>
          <TouchableOpacity 
            style={[styles.card, styles.optionCard, fragile && styles.cardActive]}
            onPress={() => setFragile(f => !f)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="glass-fragile" size={28} color={fragile ? Colors.primary : Colors.black} />
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Colis Fragile</Text>
              <Text style={styles.optionSubtitle}>Nécessite une manipulation spéciale</Text>
            </View>
            <Ionicons name={fragile ? "checkmark-circle" : "radio-button-off"} size={24} color={fragile ? Colors.primary : Colors.lightGray} />
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer avec le bouton de confirmation */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.confirmButton, (!isValid || !addressesValid) && styles.buttonDisabled]} 
          disabled={!isValid || !addressesValid} 
          onPress={onContinue}
        >
          <Text style={styles.confirmButtonText}>Continuer</Text>
        </TouchableOpacity>
        {!addressesValid && (
          <Text style={{ marginTop: 8, textAlign: 'center', color: Colors.gray, fontFamily: Fonts.titilliumWeb }}>
            Merci de sélectionner les adresses de départ et d'arrivée.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.gray,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 55,
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.black,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.lightGray,
    marginLeft: 52, // Aligné avec le début du texte
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  optionTitle: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
  },
  optionSubtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  footer: {
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: Colors.mediumGray,
  },
  confirmButtonText: {
    color: 'white',
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
  },
});
