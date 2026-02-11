import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Alert,
} from "react-native";
import { Colors, Fonts } from "../theme";
import { useAuth } from "../providers/AuthProvider";

export default function LoginPhone() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { signIn } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    let formatted = "";
    for (let i = 0; i < cleaned.length; i++) {
      if (i > 0 && i % 2 === 0) {
        formatted += " ";
      }
      formatted += cleaned[i];
    }
    return formatted;
  };

  const handlePhoneChange = (text: string) => {
    const formattedText = formatPhoneNumber(text);
    if (formattedText.length <= 14) { // 10 digits + 4 spaces
      setPhone(formattedText);

      const digits = formattedText.replace(/\s/g, "");
      if (digits.length === 0) {
        setError(null);
      } else if (digits.length !== 8 && digits.length !== 10) {
        setError("Le numéro doit contenir 8 ou 10 chiffres.");
      } else {
        setError(null);
      }
    }
  };

  const isPhoneValid = [8, 10].includes(phone.replace(/\s/g, "").length);

  const sendOTP = async () => {
    if (!isPhoneValid || loading) {
      if (!isPhoneValid) {
        setError("Le numéro doit contenir 8 chiffres.");
      }
      return;
    }
    setError(null);

    const cleanedPhone = phone.replace(/\s/g, "");
    const e164 = `+229${cleanedPhone}`;

    if (!API_URL) {
      setError("API_URL non configurée");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/auth/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ phone: e164 }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        setError(json?.message || json?.error || "Erreur serveur.");
        return;
      }

      if (json.status === "already_verified" && json.token) {
        // await AsyncStorage.setItem("authToken", json.token);
        // if (json.user) {
        //   await AsyncStorage.setItem("authUser", JSON.stringify(json.user));
        // }

        if (json.user?.role === "driver") {
          // await AsyncStorage.clear();
          Alert.alert(
            "Compte chauffeur",
            "Ce compte est réservé aux chauffeurs. Utilisez l’application conducteur."
          );
          return;
        }

        await signIn(json.token, json.user);
        // router.push({ pathname: "/", params: { phone: e164 } });
        return;
      }

      if (json.status !== "otp_sent") {
        setError(json?.message || "Impossible d’envoyer l’OTP.");
        return;
      }
      // Récupérer la clé OTP renvoyée par le backend (clé KYA)
      const otpKey = json.otp_key ?? json.provider?.key;

      if (!otpKey) {
        setError("Clé OTP manquante dans la réponse du serveur.");
        return;
      }

      router.push({
        pathname: "/auth/OTPVerification",
        params: { phone: e164, otp_key: otpKey },
      });
    } catch (e: any) {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            <View style={styles.backRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="chevron-back" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Bloc central avec icône + titre + champ */}
            <View style={styles.centerBlock}>
              {/* Icône voiture dans un cercle */}
              <View style={styles.flagCircle}>
                <Ionicons name="car-outline" size={40} color={Colors.primary} />
              </View>

              <View style={styles.headerSection}>
                <Text style={styles.title}>Connexion avec votre numéro</Text>
                <Text style={styles.subtitle}>
                  Entrez votre numéro de téléphone béninois pour recevoir un code de validation.
                </Text>
              </View>

              {/* INPUT avec drapeau + indicatif pré-rempli +229 */}
              <View style={styles.inputContainer}>
                <View style={styles.inputFlagCircle}>
                  <Text style={styles.flagEmoji}>🇧🇯</Text>
                </View>
                <Text style={styles.countryCode}>+229</Text>
                <TextInput
                  placeholder="97 23 45 67"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="number-pad"
                  style={styles.input}
                  placeholderTextColor="#999"
                  maxLength={14}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* BUTTON */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    (!isPhoneValid || loading) && styles.buttonDisabled,
                  ]}
                  onPress={sendOTP}
                  disabled={!isPhoneValid || loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.buttonText}>
                    {loading ? "Envoi..." : "Continuer"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  backRow: {
    position: "absolute",
    top: 50,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "flex-start",
  },

  /* --- HEADER --- */
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
  },
  flagCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FFF7E6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  flagEmoji: {
    fontSize: 40,
  },
  headerSection: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: "#111",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
  },

  /* --- INPUT --- */
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 60,
  },
  inputFlagCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 10
  },
  countryCode: {
    fontSize: 18,
    fontFamily: Fonts.titilliumWebBold,
    color: "#111",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: Fonts.titilliumWeb,
    color: "#111",
    letterSpacing: 2,
  },
  error: {
    color: "red",
    marginTop: 10,
    fontSize: 14,
  },

  /* --- FOOTER --- */
  footer: {
    marginTop: 40,
    width: "100%",
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: "#D0D0D0",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "#FFF",
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 17,
  },
});
