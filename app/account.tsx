// app/account.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "./theme";

export default function AccountScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compte</Text>
      <Text style={styles.desc}>Gérez vos informations personnelles et préférences.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex:1, justifyContent:'center', alignItems:'center', backgroundColor: Colors.white},
  title: { fontSize: 22, fontFamily: "Titillium-Bold", color: Colors.primary },
  desc: { fontSize: 16, fontFamily: "TitilliumWeb_400Regular", color: Colors.gray, marginTop: 8 }
});
