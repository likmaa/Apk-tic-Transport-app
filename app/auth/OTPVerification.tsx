import React, { useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "../theme";
import { useAuth } from "../providers/AuthProvider";

export default function OTPVerification() {
  const { phone, otp_key } = useLocalSearchParams();
  const router = useRouter();
  const { signIn } = useAuth();

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
    // Paste logic (if text is > 1 char)
    if (text.length > 1) {
      const sanitized = text.replace(/[^0-9]/g, '');
      const newOtp = [...otp];
      for (let i = 0; i < Math.min(sanitized.length, 6 - index); i++) {
        newOtp[index + i] = sanitized[i];
      }
      setOtp(newOtp);
      // Focus the next empty field or the last one
      const nextIndex = Math.min(index + sanitized.length, 5);
      if (nextIndex < 6) {
        inputs.current[nextIndex]?.focus();
      }
      return;
    }

    if (/^[0-9]$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      if (index < 5 && text) {
        inputs.current[index + 1]?.focus();
      }
    } else if (text === "") {
      const newOtp = [...otp];
      // If we are deleting and the current box is empty, don't do anything (handled by onKeyPress)
      // but if it has a value, clear it.
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
        setLoading(false);
        return;
      }

      if (!json?.token) {
        const msg = json?.message || "Token manquant dans la réponse";
        setError(msg);
        Alert.alert("Erreur", msg);
        setLoading(false);
        return;
      }

      // Verify user role
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
          Alert.alert(
            "Compte chauffeur",
            "Ce compte est un compte chauffeur. Veuillez vous connecter avec l'application chauffeur."
          );
          setLoading(false);
          return;
        }

        // Success: Sign in via provider
        await signIn(token, user || json.user);

        // Navigation is handled by AuthProvider's useEffect or we can force it
        router.replace('/(tabs)');
      } else {
        // Fallback: trust the initial user object if /me failed but token is valid
        await signIn(token, json.user);
        router.replace('/(tabs)');
      }

    } catch (e: any) {
      console.warn("Erreur verifyOTP", e);
      const msg = e?.message || "Erreur réseau lors de la vérification";
      setError(msg);
      Alert.alert("Erreur", msg);
    } finally {
      // If we are signed in, the component might unmount due to navigation, 
      // but if we are here (error or logic end), stop loading.
      if (loading) setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!canResend || loading) return;
    setError(null);
    setOtp(["", "", "", "", "", ""]);
    setTimeLeft(30);
    setCanResend(false);
    inputs.current[0]?.focus();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}> Retour</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Vérification OTP</Text>

      <Text style={styles.desc}>
        Un code de 6 chiffres a été envoyé à {phone}. Entrez-le ci-dessous.
      </Text>

      {error ? (
        <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
      ) : null}

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { inputs.current[index] = ref; }}
            style={[
              styles.otpInput,
              focusedIndex === index && styles.otpInputFocused,
            ]}
            keyboardType="numeric"
            // iOS
            textContentType={index === 0 ? "oneTimeCode" : "none"}
            // Android
            autoComplete={index === 0 ? "sms-otp" : undefined}
            maxLength={index === 0 ? 6 : 1} // Allow paste on first field
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

      <TouchableOpacity style={styles.button} onPress={verifyOTP} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Vérification...' : 'Vérifier le code'}</Text>
      </TouchableOpacity>

      {canResend ? (
        <TouchableOpacity onPress={resendCode} disabled={loading}>
          <Text style={styles.resendText}>Renvoyer le code</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.timerText}>Renvoyer dans {timeLeft}s</Text>
      )}

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
