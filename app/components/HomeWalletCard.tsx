import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts } from '../theme';

type Props = {
  onPress: () => void;
  balance: number;
  currency?: string;
};

export default function HomeWalletCard({ onPress, balance, currency = 'FCFA' }: Props) {
  const formattedBalance = `${currency} ${Number(balance || 0).toLocaleString('fr-FR')}`;

  return (
    <View style={styles.walletCard}>
      <View>
        <Text style={styles.walletLabel}>Solde du portefeuille</Text>
        <Text style={styles.walletBalance}>{formattedBalance}</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={onPress}>
        <MaterialCommunityIcons name="plus" size={22} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  walletCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, padding: 16, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.lightGray },
  walletLabel: { fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.white, marginBottom: 4 },
  walletBalance: { fontFamily: Fonts.titilliumWebBold, fontSize: 20, color: Colors.white },
  addButton: { backgroundColor: Colors.primary, width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
