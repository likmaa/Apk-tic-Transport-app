// app/screens/ActivityScreen.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useEffect, useMemo, useState } from "react";
import {
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    Image,
} from "react-native";
import { Colors, Fonts } from "../theme"; // Assurez-vous que vos polices sont bien importées
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationCount } from '../hooks/useNotificationCount';

// ----------------------------------------------------------------
// 1. TYPES (Renforcés et Nettoyés)
// ----------------------------------------------------------------

type RootStackParamList = {
    "(tabs)": undefined;
    "screens/ActivityDetailScreen": { activity: ActivityItem };
};

type TabParamList = {
    Home: undefined; Portefeuille: undefined; Activité: undefined; Compte: undefined;
};

type ActivityScreenNavigationProp = CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Activité'>,
    StackNavigationProp<RootStackParamList>
>;

type ActivityStatus = "upcoming" | "past" | "ongoing" | "pending" | "cancelled";
type ServiceType = "deplacement" | "course" | "livraison";

type ActivityItem = {
    id: string;
    serviceType: ServiceType;
    status: ActivityStatus;
    date: string;
    time: string;
    from: string;
    to: string;
    price: string;
};

// Données de test (vous les chargerez depuis AsyncStorage)
const sampleData: ActivityItem[] = [
    { id: "1", serviceType: "deplacement", status: "ongoing", date: "28 Jun", time: "10:05", from: "Parc Pendrikan Kidul", to: "Villas Semarang Indah", price: "12 500 FCFA" },
    { id: "2", serviceType: "course", status: "past", date: "27 Jun", time: "15:30", from: "Super U", to: "Domicile", price: "3 500 FCFA" },
    { id: "3", serviceType: "livraison", status: "upcoming", date: "30 Jun", time: "09:00", from: "Bureau", to: "Client X", price: "2 000 FCFA" },
    { id: "4", serviceType: "deplacement", status: "cancelled", date: "25 Jun", time: "11:00", from: "Aéroport", to: "Hôtel du Lac", price: "8 000 FCFA" },
];

// ----------------------------------------------------------------
// 2. COMPOSANTS UI (pour un code plus propre)
// ----------------------------------------------------------------

// Dictionnaire pour les icônes et couleurs, pour éviter les switch/case répétitifs
type MDIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const serviceVisuals: Record<ServiceType, { icon: MDIName; color: string }> = {
    deplacement: { icon: 'car-outline', color: Colors.primary },
    course: { icon: 'basket-outline', color: Colors.secondary },
    livraison: { icon: 'package-variant-closed', color: Colors.secondary },
};

// La nouvelle carte d'activité, plus visuelle et épurée
const ActivityCard = ({ item, onPress }: { item: ActivityItem; onPress: () => void }) => {
    const visuals = serviceVisuals[item.serviceType];

    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={styles.cardHeader}>
                <View style={[styles.cardIconContainer, { backgroundColor: visuals.color + '20' }]}>
                    <MaterialCommunityIcons name={visuals.icon} size={24} color={visuals.color} />
                </View>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{item.serviceType.charAt(0).toUpperCase() + item.serviceType.slice(1)}</Text>
                    <Text style={styles.cardSubtitle}>{item.date} à {item.time}</Text>
                </View>
                <Text style={styles.cardPrice}>{item.price}</Text>
            </View>
            <View style={styles.cardBody}>
                <View style={styles.locationRow}>
                    <Ionicons name="radio-button-off-outline" size={16} color={Colors.gray} />
                    <Text style={styles.locationText} numberOfLines={1}>{item.from}</Text>
                </View>
                <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={16} color={Colors.primary} />
                    <Text style={styles.locationText} numberOfLines={1}>{item.to}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// ----------------------------------------------------------------
// 3. COMPOSANT PRINCIPAL DE L'ÉCRAN
// ----------------------------------------------------------------

export default function ActivityScreen() {
    const router = useRouter();
    const [statusFilter, setStatusFilter] = useState<ActivityStatus | 'all'>('ongoing');
    const [activities, setActivities] = useState<ActivityItem[]>([]); // Données réelles chargées depuis l'API
    const notificationCount = useNotificationCount();
    const navigation = useNavigation<ActivityScreenNavigationProp>();
    const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;

    useEffect(() => {
        const loadActivities = async () => {
            try {
                if (!API_URL) return;

                const token = await AsyncStorage.getItem('authToken');
                if (!token) return;

                const res = await fetch(`${API_URL}/passenger/rides`, {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) {
                    setActivities([]);
                    return;
                }

                const json = await res.json().catch(() => null);
                const dataArray = Array.isArray(json) ? json : (json?.data || []);

                if (!Array.isArray(dataArray)) {
                    setActivities([]);
                    return;
                }

                const mapped: ActivityItem[] = dataArray.map((ride: any, idx: number) => {
                    const rawStatus = String(ride.status ?? '').toLowerCase();
                    let status: ActivityStatus = 'pending';
                    if (['pending', 'requested'].includes(rawStatus)) status = 'pending';
                    else if (['accepted', 'arrived', 'started', 'ongoing'].includes(rawStatus)) status = 'ongoing';
                    else if (['completed', 'done', 'finished'].includes(rawStatus)) status = 'past';
                    else if (['cancelled', 'canceled'].includes(rawStatus)) status = 'cancelled';

                    const rawType = String(ride.service_type ?? ride.category ?? 'deplacement').toLowerCase();
                    let serviceType: ServiceType = 'deplacement';
                    if (rawType.includes('course') || rawType.includes('shopping')) serviceType = 'course';
                    else if (rawType.includes('livraison') || rawType.includes('delivery')) serviceType = 'livraison';

                    const dateSource = ride.scheduled_at ?? ride.created_at ?? new Date().toISOString();
                    const d = new Date(dateSource);
                    const date = isNaN(d.getTime())
                        ? ''
                        : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                    const time = isNaN(d.getTime())
                        ? ''
                        : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                    const from = String(ride.pickup_address ?? ride.origin_address ?? 'Adresse de départ');
                    const to = String(ride.dropoff_address ?? ride.destination_address ?? 'Adresse d’arrivée');

                    const priceNumber = Number(ride.fare_amount ?? ride.total_amount ?? ride.price ?? 0);
                    const price = `${priceNumber.toLocaleString('fr-FR')} FCFA`;

                    return {
                        id: String(ride.id ?? idx),
                        serviceType,
                        status,
                        date,
                        time,
                        from,
                        to,
                        price,
                    };
                });

                setActivities(mapped);
            } catch {
                setActivities([]);
            }
        };

        loadActivities();
    }, [API_URL]);

    // Utilisation de useMemo pour optimiser le filtrage.
    // La liste ne sera recalculée que si les filtres ou les activités changent.
    const filteredActivities = useMemo(() => {
        return activities.filter(item => {
            if (statusFilter === 'all') return true;
            if (statusFilter === 'ongoing') return ['ongoing', 'pending', 'upcoming'].includes(item.status);
            return item.status === statusFilter;
        });
    }, [activities, statusFilter]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header avec logo à gauche et cloche à droite */}
            <View style={styles.header}>
                <Image source={require('../../assets/images/LOGO_OR.png')} style={styles.logo} resizeMode="contain" />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Notifications" style={styles.bellBtn} onPress={() => router.push('/screens/Notifications')}>
                    <Ionicons name="notifications-outline" size={24} color={Colors.black} />
                    {notificationCount > 0 && (
                        <View style={styles.bellBadge}>
                            <Text style={styles.bellBadgeText}>{notificationCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredActivities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ActivityCard
                        item={item}
                        onPress={() => {
                            if (item.status === 'pending') {
                                router.push({
                                    pathname: '/screens/ride/SearchingDriver',
                                    params: { rideId: item.id }
                                });
                            } else if (item.status === 'ongoing') {
                                router.push({
                                    pathname: '/screens/ride/DriverTracking',
                                    params: { rideId: item.id }
                                });
                            } else {
                                navigation.navigate("screens/ActivityDetailScreen", { activity: item });
                            }
                        }}
                    />
                )}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <View style={styles.filterContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollView}>
                            <TouchableOpacity onPress={() => setStatusFilter('ongoing')} style={[styles.chip, statusFilter === 'ongoing' && styles.chipActive]}>
                                <Text style={[styles.chipText, statusFilter === 'ongoing' && styles.chipTextActive]}>En cours</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setStatusFilter('past')} style={[styles.chip, statusFilter === 'past' && styles.chipActive]}>
                                <Text style={[styles.chipText, statusFilter === 'past' && styles.chipTextActive]}>Terminées</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setStatusFilter('cancelled')} style={[styles.chip, statusFilter === 'cancelled' && styles.chipActive]}>
                                <Text style={[styles.chipText, statusFilter === 'cancelled' && styles.chipTextActive]}>Annulées</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="file-tray-outline" size={60} color={Colors.mediumGray} />
                        <Text style={styles.emptyText}>Aucune activité à afficher</Text>
                        <Text style={styles.emptySubtext}>Vos courses et livraisons apparaîtront ici.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

// ----------------------------------------------------------------
// 4. NOUVEAUX STYLES (Épurés et Modernes)
// ----------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 10 },
    logo: { width: 110, height: 28 },
    bellBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, position: 'relative', borderWidth: 1, borderColor: Colors.lightGray },
    bellBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.white },
    bellBadgeText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 11, lineHeight: 12 },
    filterContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    filterScrollView: {
        flexDirection: 'row',
        gap: 10,
    },
    chip: {
        backgroundColor: Colors.white,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.lightGray,
    },
    chipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontFamily: Fonts.titilliumWebSemiBold,
        fontSize: 14,
        color: Colors.black,
    },
    chipTextActive: {
        color: Colors.white,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardIconContainer: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 16,
        color: Colors.black,
    },
    cardSubtitle: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 13,
        color: Colors.gray,
    },
    cardPrice: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 16,
        color: Colors.black,
    },
    cardBody: {
        borderTopWidth: 1,
        borderTopColor: Colors.lightGray,
        paddingTop: 16,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationText: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 14,
        color: Colors.black,
        marginLeft: 10,
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: 'center',
        marginTop: 80,
        padding: 20,
    },
    emptyText: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 18,
        color: Colors.black,
        marginTop: 16,
    },
    emptySubtext: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 15,
        color: Colors.gray,
        textAlign: 'center',
        marginTop: 8,
    },
});
