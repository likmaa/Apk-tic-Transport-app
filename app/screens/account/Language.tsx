import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

const languages = [
  { code: 'fr', label: 'Français' },
];

export default function Language() {
  const [current, setCurrent] = useState('fr');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.list}>
        {languages.map(lang => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.row, current === lang.code && styles.rowActive]}
            onPress={() => setCurrent(lang.code)}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>{lang.label}</Text>
            {current === lang.code && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16 },
  row: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  rowActive: {
    borderColor: Colors.primary,
  },
  rowLabel: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
  },
  check: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.primary,
    fontSize: 16,
  },
});
