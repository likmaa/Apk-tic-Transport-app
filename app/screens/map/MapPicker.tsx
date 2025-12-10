// screens/map/MapPicker.tsx
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Dimensions, TextInput, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Region } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLocationStore } from '../../providers/LocationProvider';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function reverseBackend(lat: number, lon: number): Promise<string | null> {
  try {
    if (!API_URL) return null;
    const res = await fetch(`${API_URL}/geocoding/reverse?lat=${lat}&lon=${lon}&language=fr`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.address === 'string' ? data.address : null;
  } catch (e) {
    return null;
  }
}


export default function MapPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: 'origin' | 'destination' }>();
  const mode = (params.mode as 'origin' | 'destination') || 'destination';
  const { origin, destination, setOrigin, setDestination } = useLocationStore();

  const [initialRegion, setInitialRegion] = useState<Region>({ latitude: 6.3702931, longitude: 2.3912362, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const [revLoading, setRevLoading] = useState(true);
  const [selected, setSelected] = useState<{ address: string; lat: number; lon: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const SHEET_MAX_DRAG = 180;

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
      onPanResponderMove: (_, gesture) => {
        const y = Math.min(Math.max(gesture.dy, -SHEET_MAX_DRAG), SHEET_MAX_DRAG);
        sheetTranslateY.setValue(y);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldOpen = gesture.dy < 0;
        Animated.spring(sheetTranslateY, {
          toValue: shouldOpen ? -SHEET_MAX_DRAG : 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Centre la carte sur la position de l'utilisateur au montage
  useEffect(() => {
    const locateUser = async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert("Permission requise", "La localisation est nécessaire pour utiliser cette fonctionnalité.");
          setRevLoading(false);
          return;
        }
        const location = await ExpoLocation.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        const region = { latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
        setInitialRegion(region);
        mapRef.current?.animateToRegion(region, 500);
        
        // On fait le premier géocodage inverse
        const addr = await reverseBackend(latitude, longitude);
        setSelected({ address: addr || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, lat: latitude, lon: longitude });
      } catch (e) {
        console.error("Erreur de localisation initiale:", e);
      } finally {
        setRevLoading(false);
      }
    };
    locateUser();
  }, []);

  // Met à jour l'adresse lorsque l'utilisateur déplace la carte
  const onRegionChangeComplete = async (r: Region) => {
    setRevLoading(true);
    try {
      const addr = await reverseBackend(r.latitude, r.longitude);
      setSelected({ address: addr || `📍 Point sur la carte`, lat: r.latitude, lon: r.longitude });
    } finally {
      setRevLoading(false);
    }
  };

  // Logique de confirmation
  const handleConfirm = () => {
    if (!selected) return;
    if (mode === 'origin') {
      setOrigin(selected);
    } else {
      setDestination(selected);
    }
    // Si les deux points sont maintenant définis, on va à la confirmation, sinon on revient en arrière.
    if ((mode === 'origin' && destination) || (mode === 'destination' && origin)) {
      router.push('/screens/ride/Confirm');
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Carte avec une hauteur définie */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation={false} // On utilise notre propre indicateur de position
          showsMyLocationButton={false}
        />
        {/* Pin central */}
        <View style={styles.pinOverlay} pointerEvents="none">
          <View style={styles.pinShadow} />
          <Ionicons name="location" size={40} color={Colors.primary} style={styles.pinIcon} />
        </View>

        {/* Boutons flottants sur la carte */}
        <TouchableOpacity style={[styles.mapButton, styles.backButton]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.mapButton, styles.locateButton]} onPress={() => { /* Logique pour recentrer */ }}>
          <Ionicons name="locate" size={22} color={Colors.black} />
        </TouchableOpacity>
      </View>

      {/* Panneau d'information inférieur */}
      <Animated.View
        style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}
        {...sheetPanResponder.panHandlers}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Déplacer la carte pour choisir</Text>
        <Text style={styles.sheetSubtitle}>{mode === 'origin' ? 'le point de départ' : 'la destination'}</Text>

        <View style={styles.addressBox}>
          {revLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <TextInput
              style={styles.addressText}
              value={selected?.address || ''}
              onChangeText={(text) =>
                setSelected((prev) => (prev ? { ...prev, address: text } : prev))
              }
              placeholder="Définition de l'adresse..."
              placeholderTextColor={Colors.gray}
              multiline
              textAlign="center"
            />
          )}
        </View>

        <TouchableOpacity 
          style={[styles.confirmButton, !selected && { opacity: 0.5 }]} 
          onPress={handleConfirm}
          disabled={!selected}
        >
          <Text style={styles.confirmButtonText}>Confirmer l'emplacement</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  mapContainer: {
    height: height * 0.6, // La carte prend 60% de la hauteur de l'écran
    backgroundColor: Colors.lightGray,
  },
  pinOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    // Décalage vers le haut pour que la pointe du pin soit au centre
    marginBottom: 40, 
  },
  pinIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pinShadow: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    bottom: -2, // Juste en dessous de l'icône
    transform: [{ scaleX: 2 }],
  },
  mapButton: {
    position: 'absolute',
    backgroundColor: 'white',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    top: 40,
    left: 20,
  },
  locateButton: {
    top: 40,
    right: 20,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 16,
    marginTop: -20, // Pour chevaucher légèrement la carte
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.lightGray,
    marginBottom: 10,
  },
  sheetTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 17,
    color: Colors.black,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
    color: Colors.gray,
    textAlign: 'center',
    marginBottom: 20,
  },
  addressBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    minHeight: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  addressText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
  },
});
