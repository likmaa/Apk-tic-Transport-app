import { useRouter } from "expo-router";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme";

export default function Walkthrough2() {
  const router = useRouter();

  const handlePress = () => {
    router.push("/walkthrough/Walkthrough3");
  };

  const handleSkip = () => {
    router.replace("/auth/LoginPhone");
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/tic2.jpg")}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.8)", "rgba(255,255,255,1)"]}
        style={styles.gradientOverlay}
      />

      {/* Bouton Retour */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>RETOUR</Text>
      </TouchableOpacity>

      {/* Bouton Ignorer */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Ignorer</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Titre */}
        <Text style={styles.title}>Suivi en temps réel</Text>

        {/* Description */}
        <Text style={styles.desc}>
          Visualisez vos trajets  et chauffeurs en direct sur la carte  pour plus de sérénité.
        </Text>

        {/* Indicateur de progression */}
        <View style={styles.dotsContainer}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
        </View>

        {/* Bouton Suivant */}
        <TouchableOpacity style={styles.nextButton} onPress={handlePress}>
          <Text style={styles.nextText}>Suivant</Text>
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
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  backButton: {
    position: "absolute",
    top: 48,
    left: 24,
    paddingVertical: 6,
    paddingHorizontal: 14,
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
    marginBottom: 12,
  },
  desc: {
    fontSize: 16,
    fontFamily: 'Titillium-Regular',
    color: Colors.gray,
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 36,
    lineHeight: 22,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 40,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#dcdde1",
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 20,
  },
  nextButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 48,
    paddingVertical: 10,
    borderRadius: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  nextText: {
    color: Colors.white,
    fontFamily: "Titillium-Bold",
    fontSize: 16,
    textAlign: "center",
  },
});
