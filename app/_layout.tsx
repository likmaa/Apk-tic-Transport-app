// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import FontProvider from "../providers/FontProvider"; // ajuste le chemin si besoin
import { AuthProvider } from "./providers/AuthProvider";
import { LocationProvider } from "./providers/LocationProvider";
import { PaymentProvider } from "./providers/PaymentProvider";
import { ServiceProvider } from "./providers/ServiceProvider";

type ActivityStatus = "upcoming" | "past" | "ongoing" | "pending" | "cancelled";
type ActivityItem = {
  id: string;
  type: "Rent" | "Taxi";
  status: ActivityStatus;
  date: string;
  time: string;
  from: string;
  to: string;
  price: string;
  driverName?: string;
  vehiclePlate?: string;
  notes?: string;
  driverImage?: any;
  mapImage?: any;
};

// Inline nav types used by some screens
type NavPlace = { address: string; lat: number; lon: number };
type NavPaymentMethod = 'cash' | 'mobile_money' | 'card' | 'wallet' | 'qr';

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      Home: undefined;
      Portefeuille: undefined;
      Activité: undefined;
      Compte: undefined;
      "screens/ActivityDetailScreen": { activity: ActivityItem }; // Match file path for Expo Router
      "screens/Notifications": undefined;
      "screens/account/EditProfile": undefined;
      "screens/account/Addresses": undefined;
      "screens/account/AddressForm": undefined;
      "screens/account/ChangePassword": undefined;
      "screens/account/Language": undefined;
      "screens/account/TwoFactorSetup": undefined;
      "screens/account/NotificationPreferences": undefined;
      "screens/wallet/AddFunds": undefined;
      "screens/wallet/Withdraw": undefined;
      "screens/wallet/Transactions": undefined;
      // Allow optional mode to specify origin/destination when picking
      "screens/map/PickLocation": { mode?: 'origin' | 'destination' } | undefined;
      "screens/ride/RideSummary": { vehicleId: string; vehicleName: string; price: number; distanceKm: number };
      "screens/payment/PaymentOptions": undefined;
      "screens/ride/SearchingDriver": {
        origin: NavPlace;
        destination: NavPlace;
        priceEstimate: number | null;
        method: NavPaymentMethod;
        serviceType?: string | null;
        rideId?: number;
      } | undefined;
      "screens/ride/OngoingRide": { vehicleName: string } | undefined;
      "screens/ride/RideReceipt": { amount: number; distanceKm: number; vehicleName: string } | undefined;
      "screens/ride/History": undefined;
      "screens/ride/ContactDriver": { driverName?: string; vehicleName?: string } | undefined;
      Splash: undefined;
      "walkthrough/Walkthrough1": undefined;
      "walkthrough/Walkthrough2": undefined;
      "walkthrough/Walkthrough3": undefined;
      "auth/LoginPhone": undefined;
      "auth/OTPVerification": undefined;
      "(tabs)": undefined;
    }
  }
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FontProvider>
        <AuthProvider>
          <ServiceProvider>
            <PaymentProvider>
              <LocationProvider>
                <Stack
                  initialRouteName="Splash"
                  screenOptions={{
                    headerShown: false,
                    animation: "fade_from_bottom",
                  }}
                >
                  <Stack.Screen name="Splash" />
                  <Stack.Screen name="walkthrough/Walkthrough1" />
                  <Stack.Screen name="walkthrough/Walkthrough2" />
                  <Stack.Screen name="walkthrough/Walkthrough3" />
                  <Stack.Screen name="auth/LoginPhone" />
                  <Stack.Screen name="auth/OTPVerification" />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  {/* Route name must match the file path under app/ */}
                  <Stack.Screen
                    name="screens/ActivityDetailScreen"
                    options={{
                      headerShown: true,
                      title: "Détail de l’activité",
                    }}
                  />
                  <Stack.Screen
                    name="screens/Notifications"
                    options={{
                      headerShown: true,
                      title: "Notifications",
                    }}
                  />
                  <Stack.Screen name="screens/account/EditProfile" options={{ headerShown: true, title: "Modifier le profil" }} />
                  <Stack.Screen name="screens/account/Addresses" options={{ headerShown: true, title: "Adresses" }} />
                  <Stack.Screen name="screens/account/AddressForm" options={{ headerShown: true, title: "Ajouter / Modifier l’adresse" }} />
                  <Stack.Screen name="screens/account/ChangePassword" options={{ headerShown: true, title: "Changer le mot de passe" }} />
                  <Stack.Screen name="screens/account/Language" options={{ headerShown: true, title: "Langue" }} />
                  <Stack.Screen name="screens/account/TwoFactorSetup" options={{ headerShown: true, title: "Vérification en 2 étapes" }} />
                  <Stack.Screen name="screens/account/NotificationPreferences" options={{ headerShown: true, title: "Préférences de notification" }} />
                  <Stack.Screen name="screens/wallet/AddFunds" options={{ headerShown: true, title: "Ajouter des fonds" }} />
                  <Stack.Screen name="screens/wallet/Withdraw" options={{ headerShown: true, title: "Retirer" }} />
                  <Stack.Screen name="screens/wallet/Transactions" options={{ headerShown: true, title: "Historique" }} />
                  <Stack.Screen name="screens/map/PickLocation" options={{ headerShown: true, title: "Choisir une adresse" }} />
                  <Stack.Screen name="screens/delivery/PackageDetails" options={{ headerShown: true, title: "Détails du colis" }} />
                  <Stack.Screen name="screens/payment/PaymentOptions" options={{ headerShown: true, title: "Paiement" }} />
                  <Stack.Screen name="screens/ride/RideSummary" options={{ headerShown: false }} />
                  <Stack.Screen name="screens/ride/SearchingDriver" options={{ headerShown: false }} />
                  <Stack.Screen name="screens/ride/OngoingRide" options={{ headerShown: false }} />
                  <Stack.Screen name="screens/ride/RideReceipt" options={{ headerShown: false }} />
                  <Stack.Screen name="screens/ride/History" options={{ headerShown: true, title: "Historique des courses" }} />
                  <Stack.Screen name="screens/ride/ContactDriver" options={{ headerShown: true, title: "Contacter le chauffeur" }} />
                </Stack>
              </LocationProvider>
            </PaymentProvider>
          </ServiceProvider>
        </AuthProvider>
      </FontProvider>
    </GestureHandlerRootView>
  );
}
