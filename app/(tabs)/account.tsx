import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme';
import { Fonts } from '../font';

export default function AccountTab() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Compte</Text>
      <View style={styles.card}>
        <Text style={styles.value}>Profil et paramètres à venir</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  title: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 20, marginBottom: 12 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16 },
  value: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
});
