import React, { useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../theme";

export default function OTPVerification() {
  const { phone, otp_key } = useLocalSearchParams();
  const router = useRouter();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // Timer (30s)
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const handleChange = (text: string, index: number) => {
    if (/^[0-9]$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      if (index < 5 && text) {
        inputs.current[index + 1]?.focus();
      }
    } else if (text === "") {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && otp[index] === "" && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const verifyOTP = async () => {
    const code = otp.join("");
    if (code.length !== 6 || loading) {
      Alert.alert("Information", "Veuillez entrer le code OTP complet (6 chiffres).");
      return;
    }

    if (!API_URL) {
      Alert.alert("Erreur", "API_URL non configurée");
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          phone,
          code,
          otp_key,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        const msg = json?.message || "Vérification OTP échouée";
        setError(msg);
        Alert.alert("Erreur", msg);
        return;
      }

      // On s'attend à recevoir { status, message, token, user }
      if (!json?.token) {
        const msg = json?.message || "Token manquant dans la réponse";
        setError(msg);
        Alert.alert("Erreur", msg);
        return;
      }

      try {
        await AsyncStorage.setItem("authToken", json.token);
        if (json.user) {
          await AsyncStorage.setItem("authUser", JSON.stringify(json.user));
        }

        // Vérifier le rôle de l'utilisateur côté backend pour bloquer les comptes chauffeur
        const token = json.token as string;
        const resMe = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (resMe.ok) {
          const user = await resMe.json();

          if (user?.role === "driver") {
            // Bloquer l'accès pour les comptes chauffeur dans l'app passager
            await AsyncStorage.removeItem("authToken");
            await AsyncStorage.removeItem("authUser");
            Alert.alert(
              "Compte chauffeur",
              "Ce compte est un compte chauffeur. Veuillez vous connecter avec l'application chauffeur."
            );
            return;
          }
        }

        // Rôle autorisé (ou rôle non renvoyé) → on entre dans l'app
        router.push({ pathname: "/", params: { phone } });

      } catch (storageError: any) {
        console.warn("Erreur stockage token / vérification rôle", storageError);
      }
    } catch (e: any) {
      console.warn("Erreur verifyOTP", e);
      const msg = e?.message || "Erreur réseau lors de la vérification";
      setError(msg);
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!canResend || loading) return;
    setError(null);
    // Bypass backend resend: just reset UI timer and fields
    setOtp(["", "", "", "", "", ""]);
    setTimeLeft(30);
    setCanResend(false);
    inputs.current[0]?.focus();
  };

  return (
    <View style={styles.container}>
      {/* Bouton Retour */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}> Retour</Text>
      </TouchableOpacity>

      {/* Titre */}
      <Text style={styles.title}>Vérification OTP</Text>

      {/* Texte descriptif */}
      <Text style={styles.desc}>
        Un code de 6 chiffres a été envoyé à {phone}. Entrez-le ci-dessous.
      </Text>

      {error ? (
        <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
      ) : null}

      {/* Les 6 cases OTP */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputs.current[index] = ref;
            }}
            style={[
              styles.otpInput,
              focusedIndex === index && styles.otpInputFocused,
            ]}
            keyboardType="numeric"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            onFocus={() => handleFocus(index)}
            onBlur={handleBlur}
            textAlign="center"
            placeholder="•"
            placeholderTextColor={Colors.gray}
          />
        ))}
      </View>

      {/* Bouton Vérifier */}
      <TouchableOpacity style={styles.button} onPress={verifyOTP} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Vérification...' : 'Vérifier le code'}</Text>
      </TouchableOpacity>

      {/* Timer ou bouton Renvoyer */}
      {canResend ? (
        <TouchableOpacity onPress={resendCode} disabled={loading}>
          <Text style={styles.resendText}>Renvoyer le code</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.timerText}>Renvoyer dans {timeLeft}s</Text>
      )}

      {/* Texte d’appui */}
      <Text style={styles.helperText}>
        Vous n'avez pas reçu le code ? Vérifiez votre numéro ou attendez le renvoi.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: Colors.white,
  },
  backButton: {
    position: "absolute",
    top: 48,
    left: 24,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 123, 0, 0.2)",
  },
  backText: {
    fontSize: 16,
    color: Colors.secondary,
    fontFamily: 'Titillium-SemiBold',
  },
  title: {
    fontSize: 28,
    fontFamily: "Titillium-Bold",
    color: Colors.primary,
    textAlign: "center",
    marginBottom: 16,
  },
  desc: {
    fontSize: 16,
    fontFamily: "Titillium-SemiBold",
    color: Colors.gray,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 16,
    lineHeight: 24,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 48,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 5,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "Titillium-SemiBold",
    color: Colors.primary,
    backgroundColor: Colors.white,
  },
  otpInputFocused: {
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 100,
    paddingVertical: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonText: {
    color: Colors.white,
    fontFamily: "Titillium-SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  timerText: {
    fontSize: 14,
    fontFamily: "Titillium-Regular",
    color: Colors.secondary,
    marginBottom: 10,
  },
  resendText: {
    fontSize: 14,
    fontFamily: "TitilliumWeb_600SemiBold",
    color: Colors.primary,
    textDecorationLine: "underline",
    marginBottom: 10,
  },
  helperText: {
    fontSize: 14,
    fontFamily: "TitilliumWeb_400Regular",
    color: Colors.gray,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
    marginTop: 8,
  },
});
