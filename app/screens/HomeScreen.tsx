// app/screens/HomeScreen.tsx (restored full version)
 
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors, Fonts } from "../theme";
import { useNotificationCount } from '../hooks/useNotificationCount';
 
import HomeHeader from "../components/HomeHeader";
import HomeServiceSelector from "../components/HomeServiceSelector";
import HomeWalletCard from "../components/HomeWalletCard";
import DisplacementSection from "../components/DisplacementSection";
import ShoppingSection from "../components/ShoppingSection";
import DeliverySection from "../components/DeliverySection";

type ServiceType = "Déplacement" | "Courses" | "Livraison";

export default function HomeScreen() {
  const router = useRouter();
  const [activeService, setActiveService] = useState<ServiceType>("Déplacement");
  const notificationCount = useNotificationCount();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletCurrency, setWalletCurrency] = useState<string>('FCFA');
  const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    const checkRole = async () => {
      try {
        if (!API_URL) return;

        const token = await AsyncStorage.getItem("authToken");
        if (!token) return;

        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const user = await res.json();

        if (user?.role === "driver") {
          await AsyncStorage.removeItem("authToken");
          await AsyncStorage.removeItem("authUser");
          Alert.alert(
            "Compte chauffeur",
            "Ce compte est un compte chauffeur. Veuillez vous connecter avec l'application chauffeur."
          );
          router.replace("/auth/LoginPhone");
        }
      } catch {
        // En cas d'erreur réseau, on laisse l'utilisateur sur l'écran courant
      }
    };

    checkRole();
  }, [API_URL, router]);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        if (!API_URL) return;

        const token = await AsyncStorage.getItem("authToken");
        if (!token) return;

        const res = await fetch(`${API_URL}/passenger/wallet`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const json = await res.json();
        if (typeof json.balance === 'number') {
          setWalletBalance(json.balance);
        }
        if (typeof json.currency === 'string') {
          setWalletCurrency(json.currency);
        }
      } catch {
        // en cas d'erreur réseau on laisse la valeur par défaut
      }
    };

    loadWallet();
  }, [API_URL]);

  const renderServiceContent = () => {
    if (activeService === "Courses") return <ShoppingSection />;
    if (activeService === "Livraison") return <DeliverySection />;
    return <DisplacementSection />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <HomeHeader
        logoSource={require('../../assets/images/LOGO_OR.png')}
        notificationCount={notificationCount}
        onPressNotifications={() => router.push({ pathname: '/screens/Notifications' })}
      />

      <HomeServiceSelector activeService={activeService} onChange={setActiveService} />

      <HomeWalletCard
        balance={walletBalance}
        currency={walletCurrency}
        onPress={() => router.push({ pathname: '/screens/wallet/AddFunds' })}
      />

      {/* Contenu dynamique */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 20 }}>
        {renderServiceContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 6 },
  logo: { width: 110, height: 28 },
  bellBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, position: 'relative', borderWidth: 1, borderColor: Colors.lightGray },
  bellBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.white },
  bellBadgeText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 11, lineHeight: 12 },
  // Service selector styles
  serviceSelector: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', borderRadius: 0, paddingVertical: 0, marginHorizontal: 20, marginTop: 6, marginBottom: 10 },
  serviceButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginHorizontal: 4, fontFamily: 'Titillium-SemiBold' },
  serviceButtonActive: {},
  serviceButtonText: { fontFamily: 'Titillium-SemiBold', fontSize: 13, color: Colors.gray, marginTop: 4 },
  serviceButtonTextActive: { color: Colors.primary, fontFamily: 'Titillium-SemiBold', },
  activeUnderline: { width: 28, height: 4, backgroundColor: Colors.primary, borderRadius: 2, marginTop: 6 },
  // Common search input styles
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.lightGray },
  searchInput: { flex: 1, height: 50, fontSize: 16, fontFamily: Fonts.titilliumWeb, color: Colors.black, marginLeft: 10,paddingTop:13 },
  adsRow: { paddingRight: 20 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.lightGray, marginTop: -20 },
  suggestionIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: Colors.lightGray, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  suggestionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
  suggestionDesc: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray },
  sectionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black, marginBottom: 16 },
  adImage: { width: 220, height: 110, borderRadius: 10, marginRight: 12, backgroundColor: Colors.lightGray },
  // Wallet card styles
  walletCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, padding: 16, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.lightGray },
  walletLabel: { fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.white, marginBottom: 4 },
  walletBalance: { fontFamily: Fonts.titilliumWebBold, fontSize: 20, color: Colors.white },
  addButton: { backgroundColor: Colors.primary, width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 20 },
  categoryCard: { width: '48%', backgroundColor: Colors.white, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: Colors.lightGray },
  categoryImage: { width: 60, height: 60, marginBottom: 8 },
  categoryTitle: { fontFamily: "Titillium-SemiBold", fontSize: 14, color: Colors.black, textAlign: 'center' },
  promoBanner: { backgroundColor: Colors.secondary, borderRadius: 12, padding: 20, alignItems: 'center' },
  promoText: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.white },
  deliveryForm: { paddingVertical: 10 },
  deliveryInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.lightGray },
  deliveryIcon: { marginHorizontal: 16 },
  packageSizeTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.gray, marginBottom: 12, marginTop: 8 },
  packageSizeSelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  packageOption: { alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.lightGray, width: 90 },
  packageOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  packageText: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray, marginTop: 4 },
  packageTextActive: { color: Colors.primary, fontFamily: Fonts.titilliumWebBold },
  confirmButton: { backgroundColor: Colors.secondary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  confirmButtonText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },
  fragileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.lightGray, marginBottom: 12 },
  fragileText: { marginLeft: 8, color: Colors.gray, fontFamily: Fonts.titilliumWeb },
  notesBox: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.lightGray, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, marginBottom: 12 },
  notesLabel: { fontFamily: Fonts.titilliumWebBold, color: Colors.gray, marginBottom: 6 },
  notesInput: { minHeight: 70, textAlignVertical: 'top', fontFamily: Fonts.titilliumWeb, color: Colors.black },
  estimateBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.lightGray, marginBottom: 6 },
  estimateText: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
});
