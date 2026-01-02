import React, { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View, FlatList, StyleSheet, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Colors, Fonts } from '../theme';
import { useLocationStore } from '../providers/LocationProvider';
import { useLines } from '../hooks/useLines';
import { estimateLinePrice } from '../api/lines';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../providers/AuthProvider';

export default function ShoppingSection() {
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

  const { lines } = useLines();
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [fromStopId, setFromStopId] = useState<number | null>(null);
  const [toStopId, setToStopId] = useState<number | null>(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const isValid = !!origin && !!destination && !!selectedLineId && !!fromStopId && !!toStopId;

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

  const selectedLine = selectedLineId
    ? lines.find(l => l.id === selectedLineId)
    : (lines.length > 0 ? lines[0] : undefined);

  if (!selectedLineId && selectedLine) {
    setSelectedLineId(selectedLine.id);
  }

  const lineStops = selectedLine?.stops ?? [];

  const handleSelectPoint = (item: { id: number; name: string; lat?: number | null; lng?: number | null }) => {
    const lat = typeof item.lat === 'number' ? item.lat : 0;
    const lng = typeof item.lng === 'number' ? item.lng : 0;

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

  return (
    <>
      <View style={styles.deliveryForm}>
        {/* Sélecteur de ligne TIC */}
        {lines.length > 0 && (
          <View style={{ marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap' }}>
            {lines.map(line => (
              <TouchableOpacity
                key={line.id}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  marginRight: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: selectedLineId === line.id ? Colors.primary : Colors.lightGray,
                  backgroundColor: selectedLineId === line.id ? Colors.primary + '15' : 'white',
                }}
                onPress={() => {
                  setSelectedLineId(line.id);
                  setFromStopId(null);
                  setToStopId(null);
                  setQuote(null);
                }}
              >
                <Text style={{ fontFamily: Fonts.titilliumWebSemiBold, color: Colors.black }}>{line.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.deliveryInputBox} onPress={() => { setMode('origin'); setShowEmbarkModal(true); }}>
          <MaterialCommunityIcons name="arrow-up-circle-outline" size={24} color={Colors.gray} style={styles.deliveryIcon} />
          <TextInput style={styles.searchInput} placeholder="Point d'embarquement" value={origin?.address || ''} editable={false} pointerEvents="none" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deliveryInputBox} onPress={() => { setMode('destination'); setShowEmbarkModal(true); }}>
          <MaterialCommunityIcons name="map-marker-outline" size={24} color={Colors.primary} style={styles.deliveryIcon} />
          <TextInput style={styles.searchInput} placeholder="Point de débarquement" value={destination?.address || ''} editable={false} pointerEvents="none" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.deliveryInputBox} onPress={() => setShowDatePicker(true)}>
          <MaterialCommunityIcons name="calendar-month-outline" size={24} color={Colors.primary} style={styles.deliveryIcon} />
          <Text style={styles.searchInput}>{scheduleDate.toLocaleDateString('fr-FR')}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker value={scheduleDate} mode="date" display="spinner" onChange={(event, date) => { setShowDatePicker(false); if (date) setScheduleDate(date); }} />
        )}

        <TouchableOpacity style={styles.deliveryInputBox} onPress={() => setShowTimePicker(true)}>
          <MaterialCommunityIcons name="clock-outline" size={24} color={Colors.primary} style={styles.deliveryIcon} />
          <Text style={styles.searchInput}>
            {scheduleTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>
        {showTimePicker && (
          <DateTimePicker value={scheduleTime} mode="time" is24Hour display="spinner" onChange={(event, time) => { setShowTimePicker(false); if (time) setScheduleTime(time); }} />
        )}

        {quote !== null && (
          <Text style={{ textAlign: 'center', marginBottom: 8, fontFamily: Fonts.titilliumWebBold }}>
            Tarif estimé TIC : {quote.toLocaleString('fr-FR')} FCFA
          </Text>
        )}

        <TouchableOpacity
          style={[styles.confirmButton, !isValid && { opacity: 0.6 }]}
          disabled={!isValid || quoting}
          onPress={async () => {
            const price = await onSeePrice();

            if (!API_URL || !origin?.address || !destination?.address || price == null) {
              Alert.alert('Erreur', "Impossible de créer la course TIC (données incomplètes).");
              return;
            }

            try {
              if (!token) return;

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
              if (!res.ok || !json) {
                const msg = (json && (json.message || json.error)) || 'Création de course TIC impossible.';
                Alert.alert('Erreur', msg);
                return;
              }
              const rideId = json?.id;
              if (!rideId) {
                Alert.alert('Erreur', 'Réponse API invalide: id de course manquant.');
                return;
              }

              router.push({ pathname: '/screens/ride/SearchingDriverScreen', params: { rideId: String(rideId) } });
            } catch (e) {
              console.log('Erreur création ride TIC', e);
            }
          }}
        >
          <Text style={styles.confirmButtonText}>{quoting ? 'Calcul...' : 'Demarrer'}</Text>
        </TouchableOpacity>

        <Modal visible={showEmbarkModal} transparent animationType="slide" onRequestClose={() => setShowEmbarkModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, maxHeight: '70%' }}>
              <Text style={{ fontFamily: Fonts.titilliumWebBold, fontSize: 18, marginBottom: 12 }}>Sélectionnez un point</Text>
              <TouchableOpacity style={{ padding: 12, marginBottom: 12, backgroundColor: Colors.lightGray, borderRadius: 8 }} onPress={handleUseMyLocation}>
                <Text style={{ fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.primary }}>Ma position</Text>
              </TouchableOpacity>
              <FlatList
                data={lineStops}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.lightGray }}
                    onPress={() => handleSelectPoint(item)}
                  >
                    <Text style={{ fontFamily: Fonts.titilliumWebBold, fontSize: 16 }}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={{ marginTop: 12, alignSelf: 'flex-end' }} onPress={() => setShowEmbarkModal(false)}>
                <Text style={{ color: Colors.primary, fontFamily: Fonts.titilliumWebBold }}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  deliveryForm: { paddingVertical: 10 },
  deliveryInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.lightGray },
  deliveryIcon: { marginHorizontal: 16 },
  searchInput: { flex: 1, height: 50, fontSize: 16, fontFamily: Fonts.titilliumWeb, color: Colors.black, marginLeft: 10, paddingTop: 13 },
  confirmButton: { backgroundColor: Colors.secondary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  confirmButtonText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },
});
