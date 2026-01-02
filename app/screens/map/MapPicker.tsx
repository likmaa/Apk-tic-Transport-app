// screens/map/MapPicker.tsx
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapPlaceholder } from '../../components/MapPlaceholder';

// Tentative d'importation sécurisée de Mapbox
let Mapbox: any = null;
let MapView: any = View;
let Camera: any = View;
let PointAnnotation: any = View;

try {
  const MB = require('@rnmapbox/maps');
  Mapbox = MB.default || MB;
  MapView = MB.MapView;
  Camera = MB.Camera;
  PointAnnotation = MB.PointAnnotation;

  if (Mapbox && typeof Mapbox.setAccessToken === 'function') {
    Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
  }
} catch (e) {
  Mapbox = null;
}
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLocationStore } from '../../providers/LocationProvider';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { SERVICE_AREA } from '../../config';

// --- CONFIGURATION MAPBOX ---
// Le token public doit être défini. Idéalement via app.json / info.plist, mais on peut le set ici.
if (Mapbox && typeof Mapbox.setAccessToken === 'function') {
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
}

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
  const { origin, destination, setOrigin, setDestination, requestUserLocation } = useLocationStore();

  // Coordonnées par défaut (Cotonou)
  const [centerCoordinate, setCenterCoordinate] = useState<[number, number]>([2.3912362, 6.3702931]);
  const [revLoading, setRevLoading] = useState(true);
  const [selected, setSelected] = useState<{ address: string; lat: number; lon: number } | null>(null);

  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const SHEET_MAX_DRAG = 180;

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: any, gesture: any) => Math.abs(gesture.dy) > 8,
      onPanResponderMove: (_: any, gesture: any) => {
        const y = Math.min(Math.max(gesture.dy, -SHEET_MAX_DRAG), SHEET_MAX_DRAG);
        sheetTranslateY.setValue(y);
      },
      onPanResponderRelease: (_: any, gesture: any) => {
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
        const place = await requestUserLocation('none');
        if (!place) {
          setRevLoading(false);
          return;
        }

        const { lat, lon } = place;
        setCenterCoordinate([lon, lat]); // Mapbox prend [lon, lat]

        // Animation caméra
        cameraRef.current?.setCamera({
          centerCoordinate: [lon, lat],
          zoomLevel: 15,
          animationDuration: 1000,
        });

        // Géocodage
        const addr = await reverseBackend(lat, lon);
        setSelected({ address: addr || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon });
      } catch (e) {
        console.error("Erreur de localisation:", e);
      } finally {
        setRevLoading(false);
      }
    };
    locateUser();
  }, []);

  // Met à jour l'adresse lorsque l'utilisateur déplace la carte (fin du drag)
  const onRegionDidChange = async (feature: any) => {
    if (!feature?.properties?.visibleBounds) return;

    // Pour trouver le centre, Mapbox retourne bounds, pas direct center dans l'event simple
    // Une astuce est d'utiliser getCenter() sur la mapRef, ou de tracker via onCameraChanged
    // Mais ici 'feature' contient souvent geometry type Point si c'est 'regionDidChange'

    const center = feature.geometry.coordinates; // [lon, lat]
    if (!center) return;

    setRevLoading(true);
    try {
      const [lon, lat] = center;
      const addr = await reverseBackend(lat, lon);
      setSelected({ address: addr || `📍 Point sur la carte`, lat: lat, lon: lon });
    } finally {
      setRevLoading(false);
    }
  };


  const handleConfirm = () => {
    if (!selected) return;
    if (mode === 'origin') {
      setOrigin(selected);
    } else {
      setDestination(selected);
    }
    if ((mode === 'origin' && destination) || (mode === 'destination' && origin)) {
      router.push('/screens/ride/Confirm');
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        {Mapbox ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            maxBounds={{
              ne: [SERVICE_AREA.BOUNDS[2], SERVICE_AREA.BOUNDS[3]],
              sw: [SERVICE_AREA.BOUNDS[0], SERVICE_AREA.BOUNDS[1]],
            }}
            // styleURL={Mapbox.StyleURL.Street}
            onCameraChanged={(state: any) => {
              // Optional: Track live movement
            }}
            onMapIdle={(state: any) => {
              // C'est l'équivalent de onRegionChangeComplete
              // state.properties.center est [lon, lat]
              const { center } = state.properties;
              const [lon, lat] = center;
              // On déclenche le reverse géocodage
              setRevLoading(true);
              reverseBackend(lat, lon).then(addr => {
                setSelected({ address: addr || `📍 Point sur la carte`, lat, lon });
                setRevLoading(false);
              });
            }}
          >
            <Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: centerCoordinate,
                zoomLevel: 12,
              }}
            />
          </MapView>
        ) : (
          <MapPlaceholder style={StyleSheet.absoluteFill} />
        )}

        {/* Pin central fixe (Design UI) */}
        <View style={styles.pinOverlay} pointerEvents="none">
          <View style={styles.pinShadow} />
          <Ionicons name="location" size={40} color={Colors.primary} style={styles.pinIcon} />
        </View>

        <TouchableOpacity style={[styles.mapButton, styles.backButton]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.mapButton, styles.locateButton]} onPress={async () => {
          const place = await requestUserLocation('none');
          if (place) {
            cameraRef.current?.setCamera({
              centerCoordinate: [place.lon, place.lat],
              zoomLevel: 15,
              animationDuration: 500
            })
          }
        }}>
          <Ionicons name="locate" size={22} color={Colors.black} />
        </TouchableOpacity>
      </View>

      {/* Panneau inférieur */}
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
              onChangeText={(text) => setSelected((prev) => (prev ? { ...prev, address: text } : prev))}
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
  container: { flex: 1, backgroundColor: 'white' },
  mapContainer: { height: height * 0.6, backgroundColor: Colors.lightGray },
  pinOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  pinIcon: { textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  pinShadow: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.2)', bottom: -2, transform: [{ scaleX: 2 }] },
  mapButton: { position: 'absolute', backgroundColor: 'white', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5 },
  backButton: { top: 40, left: 20 },
  locateButton: { top: 40, right: 20 },
  bottomSheet: { flex: 1, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 16, marginTop: -20 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.lightGray, marginBottom: 10 },
  sheetTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 17, color: Colors.black, textAlign: 'center' },
  sheetSubtitle: { fontFamily: Fonts.titilliumWeb, fontSize: 15, color: Colors.gray, textAlign: 'center', marginBottom: 20 },
  addressBox: { backgroundColor: Colors.background, borderRadius: 12, padding: 16, minHeight: 70, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  addressText: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 16, color: Colors.black, textAlign: 'center' },
  confirmButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: 'white', fontFamily: Fonts.titilliumWebBold, fontSize: 18 },
});
