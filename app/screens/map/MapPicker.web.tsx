import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

export default function MapPickerScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.messageBox}>
        <Text style={styles.title}>Carte non disponible sur le web</Text>
        <Text style={styles.subtitle}>
          La sélection d\'un point sur la carte n\'est pas encore supportée sur
          la version web de l\'application.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBox: {
    padding: 24,
  },
  title: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 20,
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'center',
  },
});
