import React, { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View, FlatList, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Colors, Fonts } from '../theme';
import { useLocationStore } from '../providers/LocationProvider';
import { useLines } from '../hooks/useLines';
import { estimateLinePrice } from '../api/lines';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../providers/AuthProvider';

export default function DeplacementSection() {
  const router = useRouter();
  const { token } = useAuth();
  const { origin, destination, setOrigin, setDestination, requestUserLocation } = useLocationStore();
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [scheduleTime, setScheduleTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<number | null>(null);

  const [showEmbarkModal, setShowEmbarkModal] = useState(false);
  const [mode, setMode] = useState<'origin' | 'destination'>('origin');

  const { lines, stops, loading: loadingData } = useLines();
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [fromStopId, setFromStopId] = useState<number | null>(null);
  const [toStopId, setToStopId] = useState<number | null>(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const isValid = origin != null && destination != null && selectedLineId != null && fromStopId != null && toStopId != null;

  const onSeePrice = async (): Promise<number | null> => {
    if (!selectedLineId || !fromStopId || !toStopId) return null;
    setQuoting(true);
    setQuote(null);
    try {
      const estimate = await estimateLinePrice(selectedLineId, fromStopId, toStopId);
      if (estimate && typeof estimate.price === 'number') {
        setQuote(estimate.price);
        return estimate.price;
      }
      return null;
    } finally {
      setQuoting(false);
    }
  };

  React.useEffect(() => {
    if (lines.length > 0) {
      if (!selectedLineId) {
        setSelectedLineId(lines[0].id);
      }
    }
  }, [lines, stops, selectedLineId]);

  const selectedLine = lines.find(l => l.id === selectedLineId);

  // Fallback: if the selected line has no stops, we can show all available stops
  const lineStops = (selectedLine?.stops && selectedLine.stops.length > 0)
    ? selectedLine.stops
    : (stops || []);

  const handleSelectPoint = (item: any) => {
    // Try to find full coordinates in the global stops list if missing
    const fullStop = stops.find(s => s.id === item.id) || item;
    const lat = typeof fullStop.lat === 'number' ? fullStop.lat : 0;
    const lng = typeof fullStop.lng === 'number' ? (fullStop.lng || fullStop.lon || 0) : 0;

    if (mode === 'origin') {
      setOrigin({ address: item.name, lat, lon: lng });
      setFromStopId(item.id);
    } else {
      setDestination({ address: item.name, lat, lon: lng });
      setToStopId(item.id);
    }
    setShowEmbarkModal(false);
  };

  const handleUseMyLocation = async () => {
    const place = await requestUserLocation(mode); // mode is 'origin' or 'destination'
    if (place) setShowEmbarkModal(false);
  };

  const handleConfirm = async () => {
    if (!isValid) {
      let missing = [];
      if (!origin) missing.push("Point d'embarquement");
      if (!destination) missing.push("Point de débarquement");
      if (!selectedLineId) missing.push("Ligne non sélectionnée");
      if (!fromStopId) missing.push("Arrêt de départ non identifié");
      if (!toStopId) missing.push("Arrêt d'arrivée non identifié");

      Alert.alert("Champs manquants", "Veuillez compléter : " + missing.join(", "));
      return;
    }

    const price = await onSeePrice();
    if (!API_URL || !origin?.address || !destination?.address || price == null) {
      Alert.alert('Erreur', "Impossible de calculer le tarif ou données de position manquantes.");
      return;
    }
    try {
      if (!token) {
        Alert.alert('Erreur', "Vous devez être connecté.");
        return;
      }
      const res = await fetch(`${API_URL}/trips/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pickup_label: origin.address,
          dropoff_label: destination.address,
          price,
          pickup_lat: origin.lat,
          pickup_lng: origin.lon,
          dropoff_lat: destination.lat,
          dropoff_lng: destination.lon,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (json) {
          const msg = json.message || json.error || 'Erreur inconnue du serveur.';
          Alert.alert('Erreur Serveur', msg);
        } else {
          Alert.alert('Erreur', `Échec de la requête (Status ${res.status}). Le serveur n'a pas renvoyé de détails.`);
        }
        return;
      }
      if (!json) {
        Alert.alert('Erreur', "Réponse du serveur vide ou malformée.");
        return;
      }
      const rideId = json?.id;
      if (rideId) {
        router.push({ pathname: '/screens/ride/SearchingDriver', params: { rideId: String(rideId) } });
      }
    } catch (e) {
      console.log('Erreur création déplacement', e);
      Alert.alert('Erreur', "Une erreur est survenue lors de la création du déplacement.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Déplacement TIC</Text>

      {/* LINE SELECTOR */}
      {lines.length > 0 && (
        <View style={styles.lineScroll}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linesRow}>
            {lines.map(line => (
              <TouchableOpacity
                key={line.id}
                activeOpacity={0.8}
                style={[
                  styles.linePill,
                  selectedLineId === line.id && styles.linePillActive
                ]}
                onPress={() => {
                  setSelectedLineId(line.id);
                  setFromStopId(null);
                  setToStopId(null);
                  setOrigin(null);
                  setDestination(null);
                  setQuote(null);
                }}
              >
                <Text style={[
                  styles.lineLabel,
                  selectedLineId === line.id && styles.lineLabelActive
                ]}>
                  {line.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* TRIP INPUTS */}
      <View style={styles.formCard}>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => { setMode('origin'); setShowEmbarkModal(true); }}
        >
          <View style={[styles.iconDot, { backgroundColor: '#E0E7FF' }]}>
            <MaterialCommunityIcons name="radiobox-marked" size={18} color={Colors.primary} />
          </View>
          <View style={styles.inputContent}>
            <Text style={styles.inputLabel}>POINT D'EMBARQUEMENT</Text>
            <Text style={[styles.inputValue, !origin && styles.placeholder]} numberOfLines={1}>
              {origin?.address || "D'où partez-vous ?"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.inputSeparator} />

        <TouchableOpacity
          style={styles.inputBox}
          onPress={() => { setMode('destination'); setShowEmbarkModal(true); }}
        >
          <View style={[styles.iconDot, { backgroundColor: '#FEE2E2' }]}>
            <MaterialCommunityIcons name="map-marker" size={18} color="#EF4444" />
          </View>
          <View style={styles.inputContent}>
            <Text style={styles.inputLabel}>POINT DE DÉBARQUEMENT</Text>
            <Text style={[styles.inputValue, !destination && styles.placeholder]} numberOfLines={1}>
              {destination?.address || "Où allez-vous ?"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* DATE & TIME ROW */}
      <View style={styles.dateTimeRow}>
        <TouchableOpacity style={styles.smallCard} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
          <Text style={styles.smallCardText}>{scheduleDate.toLocaleDateString('fr-FR')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.smallCard} onPress={() => setShowTimePicker(true)}>
          <Ionicons name="time-outline" size={20} color={Colors.primary} />
          <Text style={styles.smallCardText}>
            {scheduleTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={scheduleDate}
          mode="date"
          display="spinner"
          onChange={(event, date) => { setShowDatePicker(false); if (date) setScheduleDate(date); }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={scheduleTime}
          mode="time"
          is24Hour
          display="spinner"
          onChange={(event, time) => { setShowTimePicker(false); if (time) setScheduleTime(time); }}
        />
      )}

      {quote !== null && (
        <View style={styles.priceTag}>
          <Text style={styles.priceLabel}>Tarif estimé :</Text>
          <Text style={styles.priceValue}>{quote.toLocaleString('fr-FR')} FCFA</Text>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.confirmButton, quoting && { opacity: 0.6 }]}
        disabled={quoting}
        onPress={handleConfirm}
      >
        <Text style={styles.confirmButtonText}>
          {quoting ? 'Vérification...' : 'Confirmer le déplacement'}
        </Text>
        <Ionicons name="arrow-forward" size={20} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={showEmbarkModal} transparent animationType="slide" onRequestClose={() => setShowEmbarkModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionnez un point</Text>
              <TouchableOpacity onPress={() => setShowEmbarkModal(false)}>
                <Ionicons name="close" size={24} color={Colors.black} />
              </TouchableOpacity>
            </View>

            {loadingData && (
              <ActivityIndicator color={Colors.primary} style={{ marginBottom: 20 }} />
            )}
            <FlatList
              data={lineStops as any[]}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.stopItem}
                  onPress={() => handleSelectPoint(item)}
                >
                  <MaterialCommunityIcons name="bus-stop" size={20} color={Colors.gray} />
                  <Text style={styles.stopName}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontFamily: Fonts.titilliumWeb, color: Colors.gray }}>
                    {loadingData ? "Chargement des points..." : "Aucun point d'arrêt disponible."}
                  </Text>
                </View>
              }
            />
          </View>
        </View >
      </Modal >
    </View >
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  sectionTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: '#1A1D1E', marginBottom: 16 },

  lineScroll: { marginBottom: 20 },
  linesRow: { gap: 10, paddingRight: 20 },
  linePill: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6
  },
  linePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  lineLabel: { fontFamily: Fonts.titilliumWebBold, color: Colors.gray, fontSize: 14 },
  lineLabelActive: { color: Colors.white },

  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  inputBox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  iconDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  inputContent: { flex: 1 },
  inputLabel: { fontFamily: Fonts.titilliumWebBold, fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  inputValue: { fontFamily: Fonts.titilliumWebBold, fontSize: 15, color: '#1A1D1E' },
  placeholder: { color: '#D1D5DB' },
  inputSeparator: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10, marginLeft: 50 },

  dateTimeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  smallCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  smallCardText: { fontFamily: Fonts.titilliumWebBold, fontSize: 14, color: '#1A1D1E', marginLeft: 10 },

  priceTag: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 10
  },
  priceLabel: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.primary, marginRight: 8 },
  priceValue: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.primary },

  confirmButton: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20
  },
  confirmButtonText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 20, color: '#1A1D1E' },
  myLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F8FF',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20
  },
  myLocationText: { fontFamily: Fonts.titilliumWebBold, fontSize: 15, color: Colors.primary, marginLeft: 12 },
  stopItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  stopName: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: '#1A1D1E', marginLeft: 15 },
});
