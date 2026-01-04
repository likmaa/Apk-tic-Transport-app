// providers/FontProvider.tsx
import { useFonts } from "expo-font";
import React from "react";
import { Text, View } from "react-native";

export default function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontsLoaded] = useFonts({
    "Unbounded-Regular": require("../../assets/fonts/Unbounded-Regular.ttf"),
    "Unbounded-Bold": require("../../assets/fonts/Unbounded-Bold.ttf"),
    "Titillium-Regular": require("../../assets/fonts/TitilliumWeb-Regular.ttf"),
    "Titillium-SemiBold": require("../../assets/fonts/TitilliumWeb-SemiBold.ttf"),
    "Titillium-Bold": require("../../assets/fonts/TitilliumWeb-Bold.ttf"),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Chargement des polices...</Text>
      </View>
    );
  }

  return <>{children}</>;
}
