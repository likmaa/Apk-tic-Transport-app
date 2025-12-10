// screens/payment/AddFunds.tsx
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Options de montants rapides
const quickAmounts = [1000, 2000, 5000, 10000];

export default function AddFunds() {
  const navigation = useNavigation();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'mobile' | 'card' | null>('mobile');

  const handleAmountSelect = (value: number) => {
    setAmount(String(value));
  };

  const isAmountValid = Number(amount) >= 500; // Montant minimum de 500 FCFA par exemple

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {/* <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recharger le portefeuille</Text>
        <View style={{ width: 44 }} />
      </View> */}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Section Montant */}
          <Text style={styles.sectionTitle}>Montant à ajouter (FCFA)</Text>
          <View style={styles.amountInputContainer}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={Colors.lightGray}
              keyboardType="number-pad"
              style={styles.amountInput}
              textAlign="center"
            />
          </View>

          {/* Suggestions de montants */}
          <View style={styles.quickAmountsContainer}>
            {quickAmounts.map((value) => (
              <TouchableOpacity 
                key={value} 
                style={styles.quickAmountChip} 
                onPress={() => handleAmountSelect(value)}
              >
                <Text style={styles.quickAmountText}>+{value.toLocaleString('fr-FR')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section Méthode de paiement */}
          <Text style={styles.sectionTitle}>Source des fonds</Text>
          
          <TouchableOpacity 
            style={[styles.methodCard, selectedMethod === 'mobile' && styles.cardActive]}
            onPress={() => setSelectedMethod('mobile')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="cellphone" size={28} color={selectedMethod === 'mobile' ? Colors.primary : Colors.black} />
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Mobile Money</Text>
              <Text style={styles.methodSubtitle}>MTN, Moov, etc.</Text>
            </View>
            <Ionicons name={selectedMethod === 'mobile' ? "checkmark-circle" : "radio-button-off"} size={24} color={selectedMethod === 'mobile' ? Colors.primary : Colors.lightGray} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.methodCard, selectedMethod === 'card' && styles.cardActive]}
            onPress={() => setSelectedMethod('card')}
            activeOpacity={0.8}
          >
            <Ionicons name="card" size={26} color={selectedMethod === 'card' ? Colors.primary : Colors.black} />
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Carte bancaire</Text>
              <Text style={styles.methodSubtitle}>Visa, Mastercard</Text>
            </View>
            <Ionicons name={selectedMethod === 'card' ? "checkmark-circle" : "radio-button-off"} size={24} color={selectedMethod === 'card' ? Colors.primary : Colors.lightGray} />
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer avec le bouton de confirmation */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.confirmButton, !isAmountValid && styles.buttonDisabled]}
          disabled={!isAmountValid}
          onPress={() => { /* Logique de paiement */ }}
        >
          <Text style={styles.confirmButtonText}>
            Ajouter {isAmountValid ? Number(amount).toLocaleString('fr-FR') : ''} FCFA
          </Text>
        </TouchableOpacity>
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
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  amountInputContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountInput: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 48,
    color: Colors.black,
    minWidth: 150,
  },
  quickAmountsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  quickAmountChip: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickAmountText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.primary,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  methodTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  methodTitle: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
  },
  methodSubtitle: {
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
    marginBottom:20
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
