import React, { useState, useEffect } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView,
    Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    FadeInDown,
    FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts } from '../../theme';
import { useLocationStore } from '../../providers/LocationProvider';

const { width, height } = Dimensions.get('window');

const REASONS = [
    { id: 'driver_asked', label: "Le chauffeur m'a demandé d'annuler", icon: "account-cancel-outline" },
    { id: 'too_far', label: "Le chauffeur est trop loin", icon: "map-marker-distance" },
    { id: 'wait_time', label: "Temps d'attente trop long", icon: "clock-alert-outline" },
    { id: 'change_mind', label: "Changement d'avis", icon: "refresh" },
    { id: 'mod_dest', label: "Besoin de modifier la destination", icon: "map-marker-edit-outline" },
    { id: 'price', label: "Prix trop élevé", icon: "cash-remove" },
    { id: 'other', label: "Autre raison", icon: "dots-horizontal-circle-outline" }
];

const ReasonCard = ({ reason, selected, onSelect, index }: { reason: typeof REASONS[0]; selected: boolean; onSelect: () => void; index: number }) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(selected ? 1.02 : 1) }],
        borderColor: withTiming(selected ? Colors.secondary : 'rgba(0,0,0,0.05)'),
        backgroundColor: withTiming(selected ? '#FFF9F4' : Colors.white),
        elevation: withTiming(selected ? 4 : 0),
        shadowOpacity: withTiming(selected ? 0.1 : 0),
    }));

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50).duration(400)}
            style={[styles.reasonCard, animatedStyle]}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onSelect}
                style={styles.reasonCardContent}
            >
                <View style={[styles.iconContainer, selected && styles.iconContainerSelected]}>
                    <MaterialCommunityIcons
                        name={reason.icon as any}
                        size={20}
                        color={selected ? Colors.secondary : Colors.gray}
                    />
                </View>
                <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                    {reason.label}
                </Text>
                <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
                    {selected && <View style={styles.radioInner} />}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function CancelReason() {
    const router = useRouter();
    const { rideId } = useLocalSearchParams<{ rideId: string }>();
    const { reset } = useLocationStore();
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    const handleConfirmCancel = async () => {
        if (!selectedReason) {
            Alert.alert('Attention', 'Veuillez sélectionner une raison avant d\'annuler.');
            return;
        }

        if (!rideId) {
            router.replace('/(tabs)');
            return;
        }

        try {
            setCancelling(true);
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${API_URL}/passenger/rides/${rideId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ reason: selectedReason }),
            });

            if (res.ok) {
                reset();
                router.replace('/(tabs)');
            } else {
                const err = await res.json().catch(() => ({}));
                Alert.alert('Erreur', err.message || 'Impossible d\'annuler la course.');
                router.back();
            }
        } catch (e) {
            console.error('Cancellation error:', e);
            Alert.alert('Erreur', 'Une erreur est survenue lors de l\'annulation.');
        } finally {
            setCancelling(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#FFFFFF', '#F9FAFB']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Custom Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={Colors.black} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Annulation</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View entering={FadeIn.duration(600)} style={styles.topSection}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>FEEDBACK</Text>
                        </View>
                        <Text style={styles.title}>Dites-nous pourquoi</Text>
                        <Text style={styles.subtitle}>Votre retour nous aide à améliorer la qualité de nos services TIC.</Text>
                    </Animated.View>

                    <View style={styles.reasonsContainer}>
                        {REASONS.map((r, i) => (
                            <ReasonCard
                                key={r.id}
                                index={i}
                                reason={r}
                                selected={selectedReason === r.label}
                                onSelect={() => setSelectedReason(r.label)}
                            />
                        ))}
                    </View>
                </ScrollView>

                {/* Vertical Action Stack */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.keepButton, cancelling && { opacity: 0.7 }]}
                        onPress={() => router.back()}
                        disabled={cancelling}
                    >
                        <LinearGradient
                            colors={[Colors.secondary, '#FF9D00']}
                            style={styles.keepButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.keepButtonText}>Conserver ma course</Text>
                            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelLink}
                        onPress={handleConfirmCancel}
                        disabled={cancelling || !selectedReason}
                    >
                        {cancelling ? (
                            <ActivityIndicator size="small" color={Colors.gray} />
                        ) : (
                            <Text style={[styles.cancelLinkText, !selectedReason && styles.cancelLinkDisabled]}>
                                Confirmer l'annulation
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 17,
        color: Colors.black,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    topSection: {
        alignItems: 'flex-start',
        marginTop: 10,
        marginBottom: 20,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 123, 0, 0.1)',
        marginBottom: 10,
    },
    badgeText: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 10,
        color: Colors.secondary,
        letterSpacing: 1,
    },
    title: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 26,
        color: Colors.black,
        marginBottom: 6,
    },
    subtitle: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 14,
        color: Colors.gray,
        lineHeight: 20,
        maxWidth: '90%',
    },
    reasonsContainer: {
        gap: 10,
    },
    reasonCard: {
        borderRadius: 14,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
    },
    reasonCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    iconContainerSelected: {
        backgroundColor: 'rgba(255, 123, 0, 0.12)',
    },
    reasonText: {
        flex: 1,
        fontFamily: Fonts.titilliumWebSemiBold,
        fontSize: 15,
        color: '#4B5563',
    },
    reasonTextSelected: {
        color: Colors.black,
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    radioCircleSelected: {
        borderColor: Colors.secondary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.secondary,
    },
    footer: {
        padding: 20,
        paddingBottom: 30,
        backgroundColor: Colors.white,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    keepButton: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: Colors.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    keepButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    keepButtonText: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 16,
        color: Colors.white,
    },
    cancelLink: {
        alignItems: 'center',
        paddingVertical: 14,
        marginTop: 6,
    },
    cancelLinkText: {
        fontFamily: Fonts.titilliumWebSemiBold,
        fontSize: 14,
        color: '#9CA3AF',
        textDecorationLine: 'underline',
    },
    cancelLinkDisabled: {
        opacity: 0.5,
    },
});
