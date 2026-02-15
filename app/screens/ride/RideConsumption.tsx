import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Fonts } from '../../theme';
import { useAuth } from '../../providers/AuthProvider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function RideConsumption() {
    const router = useRouter();
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
    const luggageFare = Number(rideData?.luggage_fare || 0);
    const pickupWaitFare = Number(rideData?.pickup_waiting_fare || 0);
    const stopWaitFare = Number(rideData?.stop_waiting_fare || 0);
    const total = Number(rideData?.fare_amount || 0);
    const currency = rideData?.currency || 'FCFA';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topNav}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.black} />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Consommation</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Estimation en temps réel</Text>
                    <Text style={styles.totalValue}>{total.toLocaleString('fr-FR')} {currency}</Text>
                    <View style={styles.rideIdBadge}>
                        <Text style={styles.rideIdText}>Course #{rideId}</Text>
                    </View>
                </View>

                <Text style={styles.sectionHeader}>DÉTAILS DU PRIX</Text>
                <View style={styles.detailsList}>
                    <View style={styles.detailItem}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="car-outline" size={20} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Prise en charge</Text>
                            <Text style={styles.detailSub}>Forfait de base</Text>
                        </View>
                        <Text style={styles.detailValue}>{baseFare.toLocaleString('fr-FR')} {currency}</Text>
                    </View>

                    <View style={styles.detailItem}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="resize-outline" size={20} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Trajet parcouru</Text>
                            <Text style={styles.detailSub}>{((rideData?.distance_m || 0) / 1000).toFixed(2)} km</Text>
                        </View>
                        <Text style={styles.detailValue}>{distanceFare.toLocaleString('fr-FR')} {currency}</Text>
                    </View>

                    {luggageFare > 0 && (
                        <View style={styles.detailItem}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="briefcase-outline" size={20} color={Colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>Bagages / Colis</Text>
                                <Text style={styles.detailSub}>{rideData?.luggage_count || 1} unité(s)</Text>
                            </View>
                            <Text style={styles.detailValue}>{luggageFare.toLocaleString('fr-FR')} {currency}</Text>
                        </View>
                    )}

                    {pickupWaitFare > 0 && (
                        <View style={styles.detailItem}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="hourglass-outline" size={20} color={Colors.orange || '#F59E0B'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>Attente de départ</Text>
                                <Text style={styles.detailSub}>Temps d'attente initial</Text>
                            </View>
                            <Text style={styles.detailValue}>{pickupWaitFare.toLocaleString('fr-FR')} {currency}</Text>
                        </View>
                    )}

                    {stopWaitFare > 0 && (
                        <View style={styles.detailItem}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="pause-circle-outline" size={20} color={Colors.orange || '#F59E0B'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>Frais d'arrêt</Text>
                                <Text style={styles.detailSub}>Pause(s) demandée(s)</Text>
                            </View>
                            <Text style={styles.detailValue}>{stopWaitFare.toLocaleString('fr-FR')} {currency}</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.infoBox, { marginTop: 32 }]}>
                    <Ionicons name="information-circle-outline" size={20} color={Colors.gray} />
                    <Text style={styles.infoText}>
                        Ces montants sont calculés selon nos grilles tarifaires en vigueur et peuvent évoluer jusqu'à la fin de la course.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FD' },
    scroll: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 65 : 40,
        paddingBottom: 15,
        backgroundColor: Colors.white,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navTitle: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 18,
        color: Colors.black,
    },
    totalCard: {
        backgroundColor: Colors.secondary,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginBottom: 32,
        elevation: 8,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    totalLabel: { fontFamily: Fonts.titilliumWeb, color: 'rgba(255,255,255,0.7)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
    totalValue: { fontFamily: Fonts.titilliumWebBold, color: Colors.white, fontSize: 34, marginTop: 8 },
    rideIdBadge: {
        marginTop: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    rideIdText: {
        fontFamily: Fonts.titilliumWebSemiBold,
        color: Colors.white,
        fontSize: 11,
    },
    sectionHeader: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 12,
        color: Colors.gray,
        marginBottom: 16,
        letterSpacing: 1,
    },
    detailsList: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    detailLabel: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
    detailSub: { fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.gray, marginTop: 2 },
    detailValue: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        gap: 16,
    },
    infoText: {
        flex: 1,
        fontFamily: Fonts.titilliumWeb,
        fontSize: 13,
        color: Colors.gray,
        lineHeight: 18,
    },
});
