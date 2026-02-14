// screens/map/PickLocation.tsx
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate } from 'react-native-reanimated';
import { FlatList } from 'react-native-gesture-handler';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../../providers/LocationProvider';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import BottomSheet, { BottomSheetView, BottomSheetTextInput, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useAuth } from '../../providers/AuthProvider';

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

  if (Mapbox) {
    Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
  }
} catch (e) {
  Mapbox = null;
}

// --- TYPES ET FONCTIONS DE RECHERCHE (INCHANGÉS) ---
type Suggestion = { place_id: string; display_name: string; lat: string; lon: string; };
// ... (vos fonctions fetchNominatim et reverseNominatim restent ici)

const NOMINATIM_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'PortoTransportApp/1.0 (contact: support@example.com)',
};
const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function fetchMapbox(query: string, lat?: number, lon?: number, signal?: AbortSignal): Promise<Suggestion[]> {
  if (!query) return [];
  if (!API_URL) return [];
  let url = `${API_URL}/geocoding/search?query=${encodeURIComponent(query)}&language=fr&limit=8`;
  if (lat && lon) {
    url += `&lat=${lat}&lon=${lon}`;
  }
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const json = await res.json();
    const items = Array.isArray(json?.results) ? json.results : [];
    return items.map((item: any) => ({
      place_id: String(item.place_id ?? ''),
      display_name: String(item.display_name ?? ''),
      lat: String(item.lat ?? ''),
      lon: String(item.lon ?? ''),
    }));
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
    return [];
  }
}

async function reverseMapbox(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  if (!API_URL) return null;
  const url = `${API_URL}/geocoding/reverse?lat=${lat}&lon=${lon}&language=fr`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = await res.json();
    return (json && typeof json.address === 'string') ? json.address : null;
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
    return null;
  }
}


const UserLocationMarker = () => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000 }),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.5]) }],
      opacity: interpolate(pulse.value, [0, 1], [0.6, 0]),
    };
  });

  return (
    <View style={styles.originMarkerContainer}>
      <Animated.View style={[styles.pulseRing, pulseStyle]} />
      <View style={styles.originMarkerIconContainer}>
        <MaterialCommunityIcons name="map-marker" size={36} color="#E53935" />
      </View>
    </View>
  );
};

export default function PickLocationScreen() {
  const router = useRouter();
  const { origin, destination, setOrigin, setDestination, home, work, requestUserLocation } = useLocationStore();
  const cameraRef = useRef<any>(null);

  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [orderMode, setOrderMode] = useState<'distance' | 'duration'>('distance');
  const [passengerType, setPassengerType] = useState<'self' | 'other'>('self');
  const [assignmentReceived, setAssignmentReceived] = useState(false);
  const [isDriverAssigned, setIsDriverAssigned] = useState(false);

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

  const handlePassengerPhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    if (formatted.length <= 14) { // 10 digits + 4 spaces
      setPassengerPhone(formatted);
    }
  };
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [isPassengerModalVisible, setIsPassengerModalVisible] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = ['35%', '60%', '95%'];

  const quickDestinations = [
    'Pharmacie',
    'Supermarché',
    'Travail',
    'École des enfants',
    'Hôpital',
  ];

  // Assure que le point de départ est défini au montage
  useEffect(() => {
    let isMounted = true;

    const initLocation = async () => {
      try {
        // Use centralized provider
        const place = await requestUserLocation('origin');
        // requestUserLocation already handles permissions, existing location check, and setsOrigin
        // It also returns the place so we can log it if needed
        if (place) {
          console.log("✅ Position initiale définie !", place);
          // We can optionally try to refine the label if needed, but the provider's 'Ma position' is safe fallback
          // To match previous logic (reverse geocoding backend), we could do it here or improve provider.
          // For now, let's trust the provider to be simple and robust.
          // If we really want the address label from backend, we can do it:
          if (API_URL) {
            // optional: fetch address label
          }
        }
      } catch (error) {
        // Provider handles errors visually with Alert
      }
    };

    initLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const MAP_BOTTOM_PADDING = SCREEN_HEIGHT * 0.55;

  const handleRecenter = () => {
    if (origin && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [origin.lon, origin.lat],
        zoomLevel: 16,
        padding: { paddingBottom: MAP_BOTTOM_PADDING },
        animationDuration: 1000,
      });
    }
  };

  // Recenter map when origin updates
  useEffect(() => {
    if (origin && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [origin.lon, origin.lat],
        zoomLevel: 16,
        padding: { paddingBottom: MAP_BOTTOM_PADDING },
        animationDuration: 1000,
      });
    }
  }, [origin]);


  // Logique de recherche avec debounce
  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetchMapbox(search.trim(), origin?.lat, origin?.lon, controller.signal);
        setSuggestions(res);
      } catch (e) {
        console.error("Erreur de recherche d'adresse:", e);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [search, origin]);

  // Fetch nearby drivers
  useEffect(() => {
    if (!origin || !API_URL) return;

    const fetchDrivers = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetch(`${API_URL}/passenger/drivers/nearby?lat=${origin.lat}&lng=${origin.lon}&radius=5`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          setNearbyDrivers(json.drivers || []);
        }
      } catch (err) {
        console.warn('Error fetching nearby drivers:', err);
      }
    };

    fetchDrivers();
    const interval = setInterval(fetchDrivers, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [origin, API_URL]);

  // Fonction pour gérer la sélection d'une destination
  const handleSelectDestination = (location: { address: string; lat: number; lon: number; }) => {
    setDestination(location);
    router.push({
      pathname: '/screens/ride/Confirm',
      params: {
        passengerType,
        passengerName,
        passengerPhone,
      }
    });
  };

  const sendAudioToBackend = async (uri: string) => {
    if (!API_URL) return;
    const form = new FormData();
    form.append('audio', {
      uri,
      name: 'voice.m4a',
      type: 'audio/m4a',
    } as any);

    try {
      const res = await fetch(`${API_URL}/voice/search`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: form,
      });
      const json = await res.json();
      console.log('voice search json', json);
      if (json?.text && typeof json.text === 'string') {
        setSearch(json.text);
      } else {
        Alert.alert('Recherche vocale', "Impossible de comprendre la commande vocale.");
      }
    } catch (e) {
      console.warn('Erreur voice search', e);
      Alert.alert('Recherche vocale', "Erreur lors de l'envoi de l'audio.");
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Micro', 'Permission micro refusée');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
    } catch (e) {
      console.warn('Erreur startRecording', e);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setIsRecording(false);
      setRecording(null);
      if (uri) {
        await sendAudioToBackend(uri);
      }
    } catch (e) {
      console.warn('Erreur stopRecording', e);
      setIsRecording(false);
    }
  };

  const handleVoiceSearch = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  console.log('Origin dans PickLocationScreen:', origin);

  return (
    <View style={styles.container}>
      {/* Map Section - Background */}
      <View style={styles.mapBackground}>
        {Mapbox ? (
          <MapView
            style={StyleSheet.absoluteFill}
            attributionEnabled={false}
            logoEnabled={false}
            showUserLocation={true}
          >
            <Camera
              ref={cameraRef}
              centerCoordinate={origin ? [Number(origin.lon), Number(origin.lat)] : [2.3912, 6.3703]}
              zoomLevel={16}
              padding={{ paddingBottom: MAP_BOTTOM_PADDING }}
              animationMode="flyTo"
              animationDuration={2000}
            />
            {origin && (
              <PointAnnotation id="origin" coordinate={[origin.lon, origin.lat]}>
                <View style={styles.markerWrapper}>
                  {/* Tooltip */}
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipText} numberOfLines={2}>
                      {origin.address}
                    </Text>
                    <View style={styles.tooltipArrow} />
                  </View>
                  <UserLocationMarker />
                </View>
              </PointAnnotation>
            )}

            {nearbyDrivers.map((driver) => (
              <PointAnnotation
                key={driver.id}
                id={`driver-${driver.id}`}
                coordinate={[Number(driver.lng), Number(driver.lat)]}
              >
                <View style={styles.nearbyDriverMarker}>
                  <MaterialCommunityIcons name="car-side" size={16} color={Colors.black} />
                </View>
              </PointAnnotation>
            ))}
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ fontFamily: Fonts.titilliumWebBold }}>Carte non disponible</Text>
          </View>
        )}

        <TouchableOpacity style={styles.floatingBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
          <MaterialCommunityIcons name="crosshairs-gps" size={24} color={Colors.black} />
        </TouchableOpacity>
      </View>

      {/* Modal de sélection de passager */}
      <Modal
        visible={isPassengerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPassengerModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Passager de la course</Text>
              <TouchableOpacity onPress={() => setIsPassengerModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.black} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={[styles.modalOption, passengerType === 'self' && styles.modalOptionActive]}
                onPress={() => setPassengerType('self')}
              >
                <Ionicons
                  name="person"
                  size={20}
                  color={passengerType === 'self' ? Colors.primary : Colors.gray}
                />
                <Text style={[styles.modalOptionText, passengerType === 'self' && styles.modalOptionTextActive]}>
                  Moi-même
                </Text>
                {passengerType === 'self' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOption, passengerType === 'other' && styles.modalOptionActive]}
                onPress={() => setPassengerType('other')}
              >
                <Ionicons
                  name="people"
                  size={20}
                  color={passengerType === 'other' ? Colors.primary : Colors.gray}
                />
                <Text style={[styles.modalOptionText, passengerType === 'other' && styles.modalOptionTextActive]}>
                  Proche
                </Text>
                {passengerType === 'other' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            </View>

            {passengerType === 'other' && (
              <View style={styles.modalInputs}>
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Nom du proche</Text>
                  <TextInput
                    style={styles.modalInputField}
                    placeholder="Ex: Jean Kouassi"
                    placeholderTextColor="#999"
                    value={passengerName}
                    onChangeText={setPassengerName}
                  />
                </View>
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Numéro de téléphone</Text>
                  <TextInput
                    style={styles.modalInputField}
                    placeholder="97 23 45 67"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    value={passengerPhone}
                    onChangeText={handlePassengerPhoneChange}
                    maxLength={14}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => {
                const digits = passengerPhone.replace(/\s/g, "");
                if (passengerType === 'other' && (!passengerName || ![8, 10].includes(digits.length))) {
                  Alert.alert("Information manquante ou invalide", "Veuillez saisir le nom et un numéro de téléphone béninois (8 ou 10 chiffres).");
                  return;
                }
                setIsPassengerModalVisible(false);
              }}
            >
              <Text style={styles.modalConfirmButtonText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        handleIndicatorStyle={styles.sheetIndicator}
        backgroundStyle={styles.sheetBackground}
        keyboardBehavior="fillParent"
        keyboardBlurBehavior="restore"
      >
        <View style={styles.sheetContent}>
          {/* Static Header Section (Sticky) */}
          <View>
            {/* Mode Switcher */}
            <View style={styles.modeSwitcherContainer}>
              <View style={styles.modeSwitcherBackground}>
                <TouchableOpacity
                  style={[styles.modeButton, orderMode === 'distance' && styles.modeButtonActive]}
                  onPress={() => setOrderMode('distance')}
                >
                  <Text style={[styles.modeButtonText, orderMode === 'distance' && styles.modeButtonTextActive]}>
                    A la distance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, orderMode === 'duration' && styles.modeButtonActive]}
                  onPress={() => {
                    setOrderMode('duration');
                    Alert.alert("Info", "Le mode 'A la durée' est en cours de développement.");
                  }}
                >
                  <Text style={[styles.modeButtonText, orderMode === 'duration' && styles.modeButtonTextActive]}>
                    A la durée
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Header & Passenger */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Où allez-vous ?</Text>
              </View>
              <TouchableOpacity
                style={styles.passengerSelector}
                onPress={() => setIsPassengerModalVisible(true)}
              >
                <View style={{ marginRight: 10, alignItems: 'flex-end' }}>
                  <Text style={styles.passengerLabel}>Commande pour</Text>
                  <Text style={styles.passengerValue}>
                    {passengerType === 'self' ? "Moi-même" : (passengerName || "Un proche")}
                  </Text>
                </View>
                <View style={styles.passengerAvatar}>
                  <Ionicons
                    name={passengerType === 'self' ? "person" : "people"}
                    size={18}
                    color="white"
                  />
                  <View style={styles.passengerBadge}>
                    <Ionicons name="chevron-down" size={10} color={Colors.black} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Location Inputs Block */}
            <View style={styles.inputsCard}>
              {/* Departure */}
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => router.push({ pathname: '/screens/map/MapPicker', params: { mode: 'origin' } })}
              >
                <View style={styles.dotContainer}>
                  <View style={[styles.dot, styles.originDot]} />
                  <View style={styles.verticalLineDashed} />
                </View>
                <View style={styles.inputInner}>
                  <Text style={styles.inputLabel}>Adresse de départ</Text>
                  <Text style={styles.inputText} numberOfLines={1}>
                    {origin ? origin.address : 'Chargement position...'}
                  </Text>
                </View>
                <Ionicons name="create-outline" size={20} color={Colors.black} />
              </TouchableOpacity>

              {/* Destination */}
              <View style={[styles.inputRow, { marginTop: 10 }]}>
                <View style={styles.dotContainer}>
                  <View style={[styles.dot, styles.destinationDot]} />
                </View>
                <View style={styles.inputInner}>
                  <Text style={styles.inputLabel}>Adresse de destination</Text>
                  <BottomSheetTextInput
                    style={styles.inputField}
                    placeholder="Rechercher une destination"
                    placeholderTextColor={Colors.gray}
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>
                <TouchableOpacity onPress={handleVoiceSearch}>
                  <Ionicons
                    name={isRecording ? "mic" : "mic-outline"}
                    size={24}
                    color={isRecording ? Colors.primary : Colors.gray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Title for Results (Sticky) */}
            <Text style={styles.recentTitle}>
              {search.length === 0 ? "Destinations suggérées" : (suggestions.length > 0 ? "Suggestions d'adresses" : "")}
            </Text>
          </View>

          {/* Scrollable Result List */}
          <BottomSheetFlatList
            data={search.length === 0 ? quickDestinations : suggestions}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.flatListContent}
            keyExtractor={(item: any, index: number) => (typeof item === 'string' ? `quick-${index}` : item.place_id)}
            renderItem={({ item }: { item: any }) => {
              const label = typeof item === 'string' ? item : item.display_name;
              const isSuggestion = typeof item !== 'string';

              return (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => {
                    if (isSuggestion) {
                      handleSelectDestination({
                        address: item.display_name,
                        lat: Number(item.lat),
                        lon: Number(item.lon),
                      });
                    } else {
                      setSearch(item);
                    }
                  }}
                >
                  <View style={styles.suggestionIconWrapper}>
                    <Ionicons
                      name={isSuggestion ? "location-sharp" : "time-outline"}
                      size={18}
                      color={isSuggestion ? Colors.primary : Colors.gray}
                    />
                  </View>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={styles.suggestionMainText} numberOfLines={1}>
                      {isSuggestion ? label.split(',')[0] : label}
                    </Text>
                    {isSuggestion && label.includes(',') && (
                      <Text style={styles.suggestionSubText} numberOfLines={1}>
                        {label.split(',').slice(1).join(',').trim()}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#E5E7EB" />
                </TouchableOpacity>
              );
            }}
            ListHeaderComponent={
              search.length === 0 ? (
                <TouchableOpacity
                  style={styles.mapPickerButton}
                  onPress={() => router.push({ pathname: '/screens/map/MapPicker', params: { mode: 'destination' } })}
                >
                  <View style={styles.mapIconCircle}>
                    <Ionicons name="map-outline" size={18} color={Colors.secondary} />
                  </View>
                  <Text style={styles.mapPickerText}>Choisir sur la carte</Text>
                  <Ionicons name="chevron-forward" size={16} color="#E5E7EB" />
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              search.length >= 3 && !loading ? (
                <View style={styles.emptyResults}>
                  <MaterialCommunityIcons name="map-marker-off-outline" size={40} color="#E5E7EB" />
                  <Text style={styles.emptyText}>Aucune adresse trouvée</Text>
                </View>
              ) : null
            }
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltip: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 5,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: Colors.black,
    textAlign: 'center',
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'white',
    transform: [{ rotate: '180deg' }],
    position: 'absolute',
    bottom: -9,
    alignSelf: 'center',
  },
  nearbyDriverMarker: {
    padding: 3,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#eee',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  originMarkerInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  originMarkerContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  originMarkerIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    textShadowColor: 'white',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  mapBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3F4F6',
  },
  recenterButton: {
    position: 'absolute',
    bottom: '62%',
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
  },
  sheetBackground: {
    backgroundColor: 'white',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetIndicator: {
    backgroundColor: '#e5e7eb',
    width: 40,
  },
  sheetContent: {
    flex: 1,
    // Suppression du paddingHorizontal ici pour permettre à la liste de scroller jusqu'au bord
  },
  modeSwitcherContainer: {
    alignItems: 'center',
    marginVertical: 5,
    paddingHorizontal: 20, // Remis ici
  },
  modeSwitcherBackground: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 30,
    padding: 5,
    width: '100%',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 22,
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modeButtonText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: '#6b7280',
  },
  modeButtonTextActive: {
    color: 'white',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 20, // Remis ici pour les titres
  },
  sheetTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
    lineHeight: 22,
  },
  passengerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  passengerLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 10,
    color: '#9ca3af',
  },
  passengerValue: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.black,
  },
  passengerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputsCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 16,
    paddingVertical: 20,
    marginBottom: 15,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  originDot: {
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#d1fae5',
  },
  destinationDot: {
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fee2e2',
  },
  verticalLineDashed: {
    height: 34,
    width: 1.5,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    marginVertical: 4,
  },
  inputInner: {
    flex: 1,
  },
  inputLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  inputText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: Colors.black,
  },
  inputField: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: Colors.black,
    padding: 0,
  },
  recentSection: {
    flex: 1,
    marginTop: 10,
  },
  recentTitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  flatListContent: {
    paddingBottom: 40,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    paddingHorizontal: 20,
  },
  suggestionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
  },
  suggestionSubText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  mapIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 123, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mapPickerText: {
    flex: 1,
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 20,
    color: Colors.black,
  },
  modalOptions: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  modalOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  modalOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#eff6ff',
    borderWidth: 2,
  },
  modalOptionText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 14,
    color: '#6b7280',
    marginHorizontal: 8,
  },
  modalOptionTextActive: {
    color: Colors.primary,
  },
  modalInputs: {
    marginBottom: 20,
  },
  modalInputGroup: {
    marginBottom: 15,
  },
  modalInputLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: '#374151',
    marginBottom: 5,
  },
  modalInputField: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.black,
  },
  modalConfirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: 'white',
  },
});
