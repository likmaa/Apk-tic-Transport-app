import { useRouter } from "expo-router";
import React from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme";

export default function Walkthrough3() {
  const router = useRouter();

  const goToLogin = () => {
    console.log("Navigating to: auth/LoginPhone");
    router.replace("/auth/LoginPhone"); // ✅ sans "/" au début
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/tic3.jpg")}
        style={styles.backgroundImage}
        resizeMode="cover"
        onError={() => Alert.alert("Erreur", "Impossible de charger l’image.")}
      />

      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.8)", "rgba(255,255,255,1)"]}
        style={styles.gradientOverlay}
      />

      {/* Bouton retour */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>RETOUR</Text>
      </TouchableOpacity>

      {/* Bouton ignorer */}
      <TouchableOpacity style={styles.skipButton} onPress={goToLogin}>
        <Text style={styles.skipText}>Ignorer</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Titre */}
        <Text style={styles.title}>Paiement sécurisé</Text>

        {/* Description */}
        <Text style={styles.desc}>
          Choisissez votre moyen de paiement et voyagez en toute sécurité.
        </Text>

        {/* Bouton commencer */}
        <TouchableOpacity style={styles.nextButton} onPress={goToLogin}>
          <Text style={styles.nextText}>Commencer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "93%",
  },
  gradientOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  skipButton: {
    position: "absolute",
    top: 48,
    right: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  backButton: {
    position: "absolute",
    top: 48,
    left: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  skipText: {
    fontSize: 14,
    color: Colors.white,
    fontFamily: "Titillium-SemiBold",
    textTransform: "uppercase",
  },
  backText: {
    fontSize: 14,
    color: Colors.secondary,
    fontFamily: "Titillium-SemiBold",
  },
  content: {
    flex: 1,
    padding: 24,
    paddingBottom: 80,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  title: {
    fontSize: 26,
    fontFamily: 'Titillium-Bold',
    color: Colors.primary,
    textAlign: "center",
    marginBottom: 16,
  },
  desc: {
    fontSize: 16,
    fontFamily: 'Titillium-Regular',
    color: Colors.gray,
    textAlign: "center",
    marginBottom: 48,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  nextButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 48,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  nextText: {
    color: Colors.white,
    fontFamily: "Titillium-Bold",
    fontSize: 16,
  },
});
