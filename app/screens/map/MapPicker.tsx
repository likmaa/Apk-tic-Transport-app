// screens/map/MapPicker.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, Animated, PanResponder, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MapPlaceholder } from '../../components/MapPlaceholder';

// Tentative d'importation sécurisée de Mapbox
let Mapbox: any = null;
let MapView: any = View;
let Camera: any = View;
let PointAnnotation: any = View;
let LocationPuck: any = null;

try {
  const MB = require('@rnmapbox/maps');
  Mapbox = MB.default || MB;
  MapView = MB.MapView;
  Camera = MB.Camera;
  PointAnnotation = MB.PointAnnotation;
  LocationPuck = MB.LocationPuck;

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

  const [centerCoordinate, setCenterCoordinate] = useState<[number, number]>([2.3912362, 6.3702931]);
  const [revLoading, setRevLoading] = useState(true);
  const [selected, setSelected] = useState<{ address: string; lat: number; lon: number } | null>(null);

  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const SHEET_PEEK_HEIGHT = 240;
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  // Pin bounce animation
  const pinBounceAnim = useRef(new Animated.Value(0)).current;
  const pinShadowAnim = useRef(new Animated.Value(0.4)).current;
  const pinShadowScaleAnim = useRef(new Animated.Value(3)).current;
  useEffect(() => {
    const bounce = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pinBounceAnim, { toValue: -6, duration: 1200, useNativeDriver: true }),
          Animated.timing(pinBounceAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pinShadowAnim, { toValue: 0.2, duration: 1200, useNativeDriver: true }),
          Animated.timing(pinShadowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pinShadowScaleAnim, { toValue: 4, duration: 1200, useNativeDriver: true }),
          Animated.timing(pinShadowScaleAnim, { toValue: 3, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, []);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: any, gesture: any) => Math.abs(gesture.dy) > 8,
      onPanResponderMove: (_: any, gesture: any) => {
        const y = Math.max(gesture.dy, -100); // Limit upward drag
        sheetTranslateY.setValue(y > 0 ? y : y * 0.2); // Resistance when dragging up
      },
      onPanResponderRelease: (_: any, gesture: any) => {
        if (gesture.dy > 100) {
          // Could implement "close" or "minimize" logic here
        }
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    const locateUser = async () => {
      try {
        const place = await requestUserLocation('none');
        if (!place) {
          setRevLoading(false);
          return;
        }

        const { lat, lon } = place;
        setCenterCoordinate([lon, lat]);

        cameraRef.current?.setCamera({
          centerCoordinate: [lon, lat],
          zoomLevel: 16,
          animationDuration: 1000,
        });

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
    <View style={styles.container}>
      {/* Full Background Map */}
      <View style={styles.mapContainer}>
        {Mapbox ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            attributionEnabled={false}
            logoEnabled={false}
            maxBounds={{
              ne: [SERVICE_AREA.BOUNDS[2], SERVICE_AREA.BOUNDS[3]],
              sw: [SERVICE_AREA.BOUNDS[0], SERVICE_AREA.BOUNDS[1]],
            }}
            onMapIdle={(state: any) => {
              const { center } = state.properties;
              const [lon, lat] = center;
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
                zoomLevel: 15,
              }}
            />
            {LocationPuck && (
              <LocationPuck
                puckBearingEnabled
                puckBearing="heading"
                pulsing={{
                  isEnabled: true,
                  color: '#4285F4',
                  radius: 70,
                }}
              />
            )}
          </MapView>
        ) : (
          <MapPlaceholder style={StyleSheet.absoluteFill} />
        )}

        {/* Floating Controls */}
        <SafeAreaView style={styles.controlsLayer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.black} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.floatingButton, styles.locateButton]}
            onPress={async () => {
              const place = await requestUserLocation('none');
              if (place) {
                cameraRef.current?.setCamera({
                  centerCoordinate: [place.lon, place.lat],
                  zoomLevel: 16,
                  animationDuration: 500
                });
              }
            }}
          >
            <Ionicons name="locate" size={24} color={Colors.black} />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Center Pin Overlay */}
        <View style={styles.pinOverlay} pointerEvents="none">
          <View style={styles.pinWrapper}>
            {/* Tooltip indication */}
            <View style={styles.selectionTooltip}>
              <Text style={styles.selectionTooltipText}>{revLoading ? 'Chargement...' : 'Position choisie'}</Text>
              <View style={styles.selectionTooltipArrow} />
            </View>
            <Animated.View style={{ transform: [{ translateY: pinBounceAnim }] }}>
              <MaterialCommunityIcons name="map-marker" size={52} color="#E53935" style={styles.pinIcon} />
            </Animated.View>
            <Animated.View style={[styles.pinShadow, { opacity: pinShadowAnim, transform: [{ scaleX: pinShadowScaleAnim }] }]} />
          </View>
        </View>
      </View>

      {/* Premium Panel */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: sheetTranslateY }] }
        ]}
        {...sheetPanResponder.panHandlers}
      >
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Choisir sur la carte</Text>
          <Text style={styles.sheetSubtitle}>
            Déplacez la carte pour choisir précisément {mode === 'origin' ? 'le départ' : 'la destination'}
          </Text>
        </View>

        <View style={styles.addressCard}>
          <View style={styles.addressIconCircle}>
            <Ionicons
              name={mode === 'origin' ? "pin" : "location-sharp"}
              size={20}
              color={mode === 'origin' ? "#10b981" : "#ef4444"}
            />
          </View>
          <View style={styles.addressContent}>
            <Text style={styles.addressLabel}>
              {mode === 'origin' ? 'Point de départ' : 'Destination'}
            </Text>
            {revLoading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Recherche de l'adresse...</Text>
              </View>
            ) : (
              <TextInput
                style={styles.addressInput}
                value={selected?.address || ''}
                onChangeText={(text) => setSelected((prev) => (prev ? { ...prev, address: text } : prev))}
                placeholder="Indiquez l'adresse précise..."
                placeholderTextColor={Colors.gray}
                multiline
              />
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, !selected && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!selected || revLoading}
        >
          <Text style={styles.confirmButtonText}>Confirmer cet emplacement</Text>
          <Ionicons name="chevron-forward" size={20} color="white" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        <SafeAreaView edges={['bottom']} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6'
  },
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
  },
  floatingButton: {
    backgroundColor: 'white',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  locateButton: {
    position: 'absolute',
    top: 60, // Standard offset for back button
    right: 20,
  },
  pinOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -48, // Adjust for icon height to center point
  },
  pinIcon: {
    zIndex: 2,
  },
  pinShadow: {
    width: 8,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -4,
  },
  selectionTooltip: {
    backgroundColor: Colors.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  selectionTooltipText: {
    color: 'white',
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 12,
  },
  selectionTooltipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.black,
    position: 'absolute',
    bottom: -6,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E5E7EB',
    marginBottom: 20,
  },
  sheetHeader: {
    marginBottom: 24,
  },
  sheetTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 22,
    color: Colors.black,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
  },
  addressCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 24,
  },
  addressIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 16,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 12,
    color: Colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressInput: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
    padding: 0,
    minHeight: 24,
  },
  loadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  loadingText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginLeft: 8,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: {
    color: 'white',
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
  },
});
