import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors, Fonts } from '../../theme';
import { useAuth } from '../../providers/AuthProvider';
import { Ionicons } from '@expo/vector-icons';

export default function RideConsumption() {
    const { rideId } = useLocalSearchParams<{ rideId: string }>();
    const { token } = useAuth();
    const [rideData, setRideData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    useEffect(() => {
        if (!rideId || !token || !API_URL) return;

        const fetchRide = async () => {
            try {
                const res = await fetch(`${API_URL}/passenger/rides/${rideId}`, {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (res.ok) {
                    const json = await res.json();
                    setRideData(json);
                }
            } catch (err) {
                console.error('Error fetching ride for consumption:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRide();
        // Refresh every 10 seconds to see real-time updates if backend supports it
        const interval = setInterval(fetchRide, 10000);
        return () => clearInterval(interval);
    }, [rideId, token, API_URL]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const baseFare = Number(rideData?.base_fare || 0);
    const distanceFare = Number(rideData?.distance_fare || 0);
    const timeFare = Number(rideData?.duration_fare || 0);
    const total = Number(rideData?.fare_amount || 0);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.header}>
                    <Text style={styles.title}>Détails de la course</Text>
                    <Text style={styles.subtitle}>ID: #{rideId}</Text>
                </View>

                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Montant Total</Text>
                    <Text style={styles.totalValue}>{total.toLocaleString('fr-FR')} FCFA</Text>
                </View>

                <View style={styles.detailsList}>
                    <View style={styles.detailItem}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="car-outline" size={20} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Forfait de base</Text>
                            <Text style={styles.detailSub}>Frais de prise en charge</Text>
                        </View>
                        <Text style={styles.detailValue}>{baseFare.toLocaleString('fr-FR')} FCFA</Text>
                    </View>

                    <View style={styles.detailItem}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="resize-outline" size={20} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Distance parcourue</Text>
                            <Text style={styles.detailSub}>{((rideData?.distance_m || 0) / 1000).toFixed(2)} km</Text>
                        </View>
                        <Text style={styles.detailValue}>{distanceFare.toLocaleString('fr-FR')} FCFA</Text>
                    </View>

                    {timeFare > 0 && (
                        <View style={styles.detailItem}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="time-outline" size={20} color={Colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>Temps écoulé</Text>
                                <Text style={styles.detailSub}>{Math.round((rideData?.duration_s || 0) / 60)} min</Text>
                            </View>
                            <Text style={styles.detailValue}>{timeFare.toLocaleString('fr-FR')} FCFA</Text>
                        </View>
                    )}
                </View>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color={Colors.gray} />
                    <Text style={styles.infoText}>
                        Les montants sont mis à jour en temps réel durant votre trajet.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scroll: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { marginBottom: 24 },
    title: { fontFamily: Fonts.titilliumWebBold, fontSize: 24, color: Colors.black },
    subtitle: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray },
    totalCard: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        elevation: 4,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    totalLabel: { fontFamily: Fonts.titilliumWeb, color: 'rgba(255,255,255,0.8)', fontSize: 16 },
    totalValue: { fontFamily: Fonts.titilliumWebBold, color: Colors.white, fontSize: 32, marginTop: 4 },
    detailsList: { backgroundColor: Colors.white, borderRadius: 16, padding: 16 },
    detailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.lightGray },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    detailLabel: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
    detailSub: { fontFamily: Fonts.titilliumWeb, fontSize: 12, color: Colors.gray },
    detailValue: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
    infoBox: { flexDirection: 'row', marginTop: 24, backgroundColor: 'rgba(0,0,0,0.03)', padding: 16, borderRadius: 12, alignItems: 'center', gap: 12 },
    infoText: { flex: 1, fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.gray, lineHeight: 18 },
});
