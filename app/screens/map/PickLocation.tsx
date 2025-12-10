// screens/map/PickLocation.tsx
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, FlatList } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../../providers/LocationProvider';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

// --- TYPES ET FONCTIONS DE RECHERCHE (INCHANGÉS) ---
type Suggestion = { place_id: string; display_name: string; lat: string; lon: string; };
// ... (vos fonctions fetchNominatim et reverseNominatim restent ici)

const NOMINATIM_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'PortoTransportApp/1.0 (contact: support@example.com)',
};
const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function fetchMapbox(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  if (!query) return [];
  if (!API_URL) return [];
  const url = `${API_URL}/geocoding/search?query=${encodeURIComponent(query)}&language=fr&limit=8`;
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


export default function PickLocationScreen() {
  const router = useRouter();
  const { origin, destination, setOrigin, setDestination, home, work } = useLocationStore();

  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

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
        // 1️⃣ Demande de permission
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        console.log("Permission GPS:", status);
        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "La localisation est nécessaire pour définir votre position actuelle."
          );
          return;
        }

        // 2️⃣ Récupère la position GPS
        const servicesEnabled = await ExpoLocation.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          Alert.alert(
            "Localisation inactive",
            "Activez le GPS ou vérifiez votre connexion internet."
          );
          return;
        }
        let location = await ExpoLocation.getLastKnownPositionAsync();
        if (!location) {
          location = await ExpoLocation.getCurrentPositionAsync({
            accuracy: ExpoLocation.Accuracy.Balanced,
          });
        }
        if (!location) {
          throw new Error("No location available");
        }

        if (!isMounted) return;
        console.log("Coordonnées actuelles:", location.coords);

        // 3️⃣ Essaie de récupérer un nom lisible pour la position actuelle via le backend
        let label = "Ma position";
        try {
          if (API_URL) {
            const res = await fetch(
              `${API_URL}/geocoding/reverse?lat=${location.coords.latitude}&lon=${location.coords.longitude}&language=fr`
            );
            if (res.ok) {
              const json = await res.json();
              if (json) {
                if (typeof json.label === "string" && json.label.length > 0) {
                  label = json.label;
                } else if (typeof json.address === "string" && json.address.length > 0) {
                  label = json.address;
                }
              }
            }
          }
        } catch (e) {
          console.warn("Erreur reverse geocoding backend:", e);
        }

        // 4️⃣ Définit l’origine dans le store avec la position actuelle et un nom plus précis
        setOrigin({
          address: label,
          lat: location.coords.latitude,
          lon: location.coords.longitude,
        });

        console.log("✅ Position initiale définie !");
      } catch (error: any) {
        console.error("Erreur de localisation:", error);

        if (error.message?.includes("Location provider is unavailable")) {
          Alert.alert(
            "Localisation inactive",
            "Activez le GPS ou vérifiez votre connexion internet."
          );
        } else {
          Alert.alert(
            "Erreur de localisation",
            "Impossible d'obtenir votre position. Réessayez plus tard."
          );
        }
      }
    };

    initLocation();

    return () => {
      isMounted = false;
    };
  }, []);


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
        const res = await fetchMapbox(search.trim(), controller.signal);
        setSuggestions(res);
      } catch (e) {
        console.error("Erreur de recherche d'adresse:", e);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [search]);

  // Fonction pour gérer la sélection d'une destination
  const handleSelectDestination = (location: { address: string; lat: number; lon: number; }) => {
    setDestination(location);
    router.push('/screens/ride/Confirm');
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {/* <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planifier un trajet</Text>
      </View> */}

      {/* Carte visuelle du trajet */}
      <View style={styles.routeVisualizer}>
        <TouchableOpacity
          style={styles.locationRow}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/screens/map/MapPicker', params: { mode: 'origin' } })}
        >
          <View style={[styles.dot, styles.originDot]} />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.locationText]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {origin ? origin.address : 'Définition du départ...'}
            </Text>
          </View>
          <Ionicons name="create-outline" size={18} color={Colors.gray} />
        </TouchableOpacity>
        <View style={styles.line} />
        <View style={[styles.locationRow, { marginTop: 8 }] }>
          <View style={[styles.dot, styles.destinationDot]} />
          <View style={styles.destinationInputRow}>
            <TextInput
              style={[styles.locationText, styles.input, { flex: 1 }]}
              placeholder="Où allez-vous ?"
              placeholderTextColor={Colors.gray}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            <TouchableOpacity style={styles.voiceButton} onPress={handleVoiceSearch}>
              <Ionicons
                name={isRecording ? 'mic' : 'mic-outline'}
                size={20}
                color={isRecording ? Colors.primary : Colors.black}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Indicateur de chargement */}
      {loading && <ActivityIndicator style={styles.loader} size="small" color={Colors.primary} />}

      {/* Liste des suggestions */}
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.place_id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          // Affiche les raccourcis uniquement si aucune recherche n'est active
          search.trim().length < 3 ? (
            <>
              <TouchableOpacity style={styles.suggestionRow} onPress={() => router.push({ pathname: '/screens/map/MapPicker', params: { mode: 'destination' } })}>
                <View style={styles.suggestionIcon}><MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={Colors.primary} /></View>
                <Text style={styles.suggestionText}>Choisir sur la carte</Text>
              </TouchableOpacity>
              {quickDestinations.map((label) => (
                <TouchableOpacity
                  key={label}
                  style={styles.suggestionRow}
                  onPress={() => setSearch(label)}
                >
                  <View style={styles.suggestionIcon}>
                    <Ionicons name="location-outline" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.suggestionText}>{label}</Text>
                </TouchableOpacity>
              ))}
              {home && (
                <TouchableOpacity style={styles.suggestionRow} onPress={() => handleSelectDestination(home)}>
                  <View style={styles.suggestionIcon}><Ionicons name="home-outline" size={20} color={Colors.primary} /></View>
                  <Text style={styles.suggestionText}>Domicile</Text>
                </TouchableOpacity>
              )}
              {work && (
                <TouchableOpacity style={styles.suggestionRow} onPress={() => handleSelectDestination(work)}>
                  <View style={styles.suggestionIcon}><Ionicons name="briefcase-outline" size={20} color={Colors.primary} /></View>
                  <Text style={styles.suggestionText}>Bureau</Text>
                </TouchableOpacity>
              )}
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.suggestionRow}
            onPress={() => handleSelectDestination({ address: item.display_name, lat: Number(item.lat), lon: Number(item.lon) })}
          >
            <View style={styles.suggestionIcon}><Ionicons name="location-outline" size={20} color={Colors.primary} /></View>
            <Text style={styles.suggestionText} numberOfLines={1}>{item.display_name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          search.trim().length >= 3 && !loading ? (
            <Text style={styles.emptyText}>Aucun résultat trouvé pour "{search}"</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 20,
    color: Colors.black,
    marginLeft: 16,
  },
  routeVisualizer: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  originDot: {
    backgroundColor: Colors.gray,
  },
  destinationDot: {
    backgroundColor: Colors.primary,
  },
  line: {
    height: 30,
    width: 2,
    backgroundColor: Colors.lightGray,
    marginLeft: 4,
    marginVertical: 6,
  },
  locationText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
    marginLeft: 16,
  },
  input: {
    paddingVertical: 0, // Important pour TextInput sur Android
  },
  loader: {
    marginTop: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  suggestionText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.black,
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
    fontSize: 15,
  },
  destinationInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
