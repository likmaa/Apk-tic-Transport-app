import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

export default function TwoFactorSetup() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Authentification à deux facteurs</Text>
        <Text style={styles.paragraph}>
          Protégez votre compte en ajoutant une seconde étape de vérification lors de la connexion.
        </Text>
        <Text style={styles.paragraph}>
          Vous pourrez utiliser une application d'authentification (OTP) ou recevoir des codes par SMS.
        </Text>
        <TouchableOpacity style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Configurer maintenant</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>En savoir plus</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  title: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black, marginBottom: 8 },
  paragraph: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.darkGray, lineHeight: 20, marginBottom: 10 },
  primaryBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold },
  secondaryBtn: { marginTop: 10, backgroundColor: Colors.white, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.lightGray },
  secondaryText: { color: Colors.primary, fontFamily: Fonts.titilliumWebBold },
});
