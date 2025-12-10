// screens/payment/Withdraw.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const savedDestinations = [
  { id: '1', type: 'bank', name: 'UBA Bank', details: '**** 1234', icon: 'bank' },
  { id: '2', type: 'mobile', name: 'MTN Mobile Money', details: '+229 **** 5678', icon: 'cellphone' },
];

export default function Withdraw() {
  const navigation = useNavigation();
  const [amount, setAmount] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(savedDestinations[0]?.id || null);
  const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    const loadWallet = async () => {
      try {
        if (!API_URL) return;

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const res = await fetch(`${API_URL}/passenger/wallet`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setWalletBalance(0);
          return;
        }

        const json = await res.json();
        const balance = Number(json.balance);
        setWalletBalance(Number.isFinite(balance) ? balance : 0);
      } catch {
        // en cas d'erreur réseau on laisse la valeur par défaut
      }
    };

    loadWallet();
  }, [API_URL]);

  const amountNumber = Number(amount);
  const isAmountValid = amountNumber > 0 && amountNumber <= walletBalance;
  const serviceFee = isAmountValid ? Math.round(amountNumber * 0.015) : 0; // Exemple: 1.5% de frais
  const totalReceived = isAmountValid ? amountNumber - serviceFee : 0;

  const handleWithdraw = () => {
    // Ici, vous ajouteriez la logique d'authentification (PIN, biométrie)
    // avant de soumettre la requête de retrait.
    Alert.alert(
      "Confirmation du Retrait",
      `Vous êtes sur le point de retirer ${amountNumber.toLocaleString('fr-FR')} FCFA. Continuer ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", onPress: () => console.log("Retrait initié") }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {/* <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Retirer des fonds</Text>
        <View style={{ width: 44 }} />
      </View> */}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Carte du Solde */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Solde du portefeuille</Text>
          <Text style={styles.balanceAmount}>{walletBalance.toLocaleString('fr-FR')} FCFA</Text>
        </View>

        {/* Section Montant */}
        <Text style={styles.sectionTitle}>Montant à retirer</Text>
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
        
        {/* Suggestions de montants basées sur le solde */}
        <View style={styles.quickAmountsContainer}>
          <TouchableOpacity style={styles.quickAmountChip} onPress={() => setAmount(String(Math.floor(walletBalance * 0.25)))}>
            <Text style={styles.quickAmountText}>25%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAmountChip} onPress={() => setAmount(String(Math.floor(walletBalance * 0.5)))}>
            <Text style={styles.quickAmountText}>50%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAmountChip} onPress={() => setAmount(String(walletBalance))}>
            <Text style={styles.quickAmountText}>Maximum</Text>
          </TouchableOpacity>
        </View>

        {/* Section Destination */}
        <Text style={styles.sectionTitle}>Transférer vers</Text>
        {savedDestinations.map((dest) => (
          <TouchableOpacity 
            key={dest.id}
            style={[styles.destCard, selectedDestinationId === dest.id && styles.cardActive]}
            onPress={() => setSelectedDestinationId(dest.id)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name={dest.icon as any} size={28} color={selectedDestinationId === dest.id ? Colors.primary : Colors.black} />
            <View style={styles.destTextContainer}>
              <Text style={styles.destTitle}>{dest.name}</Text>
              <Text style={styles.destSubtitle}>{dest.details}</Text>
            </View>
            <Ionicons name={selectedDestinationId === dest.id ? "checkmark-circle" : "radio-button-off"} size={24} color={selectedDestinationId === dest.id ? Colors.primary : Colors.lightGray} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={22} color={Colors.primary} />
          <Text style={styles.addButtonText}>Ajouter une destination</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Footer avec récapitulatif et confirmation */}
      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Frais de service (1.5%)</Text>
          <Text style={styles.summaryValue}>{serviceFee.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <View style={[styles.summaryRow, { marginTop: 8 }]}>
          <Text style={styles.summaryLabelBold}>Vous recevrez</Text>
          <Text style={styles.summaryValueBold}>{totalReceived.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <TouchableOpacity 
          style={[styles.confirmButton, !isAmountValid && styles.buttonDisabled]}
          disabled={!isAmountValid}
          onPress={handleWithdraw}
        >
          <Text style={styles.confirmButtonText}>Confirmer le retrait</Text>
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
  balanceCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 32,
  },
  balanceLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.white + 'A0', // Blanc avec opacité
  },
  balanceAmount: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 36,
    color: Colors.white,
    marginTop: 4,
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
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountInput: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 40,
    color: Colors.black,
    minWidth: 150,
    paddingVertical: 10,
  },
  quickAmountsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  quickAmountChip: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: Colors.lightGray,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickAmountText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.black,
  },
  destCard: {
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
  destTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  destTitle: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
  },
  destSubtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addButtonText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.primary,
    marginLeft: 8,
  },
  footer: {
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    marginBottom:20
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
  },
  summaryValue: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.black,
  },
  summaryLabelBold: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
  },
  summaryValueBold: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
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
