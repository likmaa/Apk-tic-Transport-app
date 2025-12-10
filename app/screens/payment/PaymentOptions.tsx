// screens/payment/PaymentOptions.tsx
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons } from '@expo/vector-icons';
import { usePaymentStore } from '../../providers/PaymentProvider';

// Données pour les options de paiement pour un rendu dynamique
const paymentMethods = [
  { key: 'cash', label: 'Espèces', icon: 'cash-outline' },
  { key: 'mobile_money', label: 'Mobile Money', icon: 'phone-portrait-outline' },
  { key: 'card', label: 'Carte bancaire', icon: 'card-outline' },
  { key: 'qr', label: 'QR Code', icon: 'qr-code-outline' },
] as const; // 'as const' pour un typage plus strict

export default function PaymentOptions() {
  const navigation = useNavigation();
  const { method, setMethod, walletBalance, setPaymentStatus } = usePaymentStore();

  const handleConfirm = () => {
    setPaymentStatus('ready');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Options de paiement</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section Portefeuille */}
        <Text style={styles.sectionTitle}>Portefeuille & Promotions</Text>
        <TouchableOpacity 
          style={[styles.card, method === 'wallet' && styles.cardActive]} 
          onPress={() => setMethod('wallet')}
          activeOpacity={0.8}
        >
          <View style={styles.optionRow}>
            <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '20' }]}>
              <Ionicons name="wallet" size={24} color={Colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.optionTitle}>Portefeuille</Text>
              <Text style={styles.optionSubtitle}>Solde : {walletBalance.toLocaleString('fr-FR')} FCFA</Text>
            </View>
            {method === 'wallet' && (
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.addFundsButton}>
            <Text style={styles.addFundsText}>Ajouter des fonds</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Section Autres Moyens de Paiement */}
        <Text style={styles.sectionTitle}>Autres moyens de paiement</Text>
        <View style={styles.card}>
          {paymentMethods.map((item, index) => (
            <TouchableOpacity 
              key={item.key}
              style={[
                styles.optionRow, 
                index < paymentMethods.length - 1 && styles.borderBottom,
                method === item.key && styles.optionRowActive
              ]}
              onPress={() => setMethod(item.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: Colors.background }]}>
                <Ionicons name={item.icon as any} size={24} color={Colors.black} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.optionTitle}>{item.label}</Text>
              </View>
              {method === item.key && (
                <View style={styles.checkIcon}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.addCardButton}>
          <Ionicons name="add" size={24} color={Colors.primary} />
          <Text style={styles.addCardText}>Ajouter une carte de paiement</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer avec le bouton de confirmation */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Confirmer</Text>
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
    marginTop:30,
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
    paddingBottom: 40,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden', // Pour que les bordures internes s'affichent correctement
  },
  cardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionRowActive: {
    backgroundColor: Colors.primary + '10',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
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
  checkIcon: {
    marginLeft: 16,
  },
  addFundsButton: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
  },
  addFundsText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.primary,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderStyle: 'dashed',
  },
  addCardText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.primary,
    marginLeft: 8,
  },
  footer: {
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: 30, // Espace pour la zone de sécurité en bas
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
  confirmButtonText: {
    color: 'white',
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
  },
});
