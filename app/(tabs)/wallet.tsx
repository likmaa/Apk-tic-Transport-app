import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme';
import { Fonts } from '../font';

export default function WalletTab() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Portefeuille</Text>
      <View style={styles.card}>
        <Text style={styles.value}>Solde: FCFA 0</Text>
        <Text style={styles.sub}>Historique et rechargement à venir</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  title: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 20, marginBottom: 12 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16 },
  value: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 16 },
  sub: { fontFamily: Fonts.titilliumWeb, color: Colors.gray, marginTop: 6 },
});
