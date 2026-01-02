import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
    Alert,
} from "react-native";
import CustomHeader from "../components/CustomHeader";
import { Colors } from "../theme"; // Assurez-vous que le chemin est correct vers votre fichier Colors.js
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AccountScreen() {
    const navigation = useNavigation();
    const [user, setUser] = useState<{
        id: number;
        name: string;
        email: string | null;
        phone: string | null;
        created_at?: string;
        photo?: string | null;
        avatar?: string | null;
        avatar_url?: string | null;
        photoUrl?: string | null;
    } | null>(null);
    const [addresses, setAddresses] = useState<
        { id: number; label: string; full_address: string; type?: string | null }[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
    const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    useEffect(() => {
        const loadUser = async () => {
            try {
                if (!API_URL) {
                    setError("API_URL non configurée");
                    setLoading(false);
                    return;
                }

                const token = await AsyncStorage.getItem("authToken");
                if (!token) {
                    // Pas de token : on renvoie l'utilisateur vers le login
                    navigation.navigate('auth/LoginPhone' as never);
                    return;
                }

                const res = await fetch(`${API_URL}/auth/me`, {
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) {
                    // Token invalide / expiré : on nettoie et on renvoie au login
                    await AsyncStorage.removeItem("authToken");
                    await AsyncStorage.removeItem("authUser");
                    navigation.navigate('auth/LoginPhone' as never);
                    return;
                }

                const json = await res.json();

                // Vérifier le rôle côté client : bloquer l'utilisation de l'app passager pour les comptes chauffeur
                if (json?.role === "driver") {
                    await AsyncStorage.removeItem("authToken");
                    await AsyncStorage.removeItem("authUser");
                    Alert.alert(
                        "Compte chauffeur",
                        "Ce compte est un compte chauffeur. Veuillez vous connecter avec l'application chauffeur."
                    );
                    navigation.navigate('auth/LoginPhone' as never);
                    return;
                }

                setUser(json);

                const fromApiAvatar = json.photo || json.avatar || json.avatar_url || json.photoUrl || null;
                setAvatarUri(fromApiAvatar ? String(fromApiAvatar) : null);

                // Charger les adresses enregistrées du passager
                try {
                    const addrRes = await fetch(`${API_URL}/passenger/addresses`, {
                        headers: {
                            Accept: "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                    });

                    if (addrRes.ok) {
                        const addrJson = await addrRes.json();
                        setAddresses(Array.isArray(addrJson) ? addrJson : []);
                    }
                } catch (e) {
                    console.warn('Erreur chargement adresses', e);
                }
            } catch (e: any) {
                setError(e?.message || "Erreur réseau");
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, [API_URL, navigation]);

    const fullName = user?.name || "Compte utilisateur";
    const email = user?.email || "Email non renseigné";
    const phone = user?.phone || "Téléphone non renseigné";
    const joinedDate = user?.created_at
        ? new Date(user.created_at).toLocaleDateString("fr-FR")
        : "Date d'inscription inconnue";

    const sections = {
        personalInfo: [
            { icon: "person-outline", label: "Nom", value: fullName },
            { icon: "call-outline", label: "Téléphone", value: phone },
            { icon: "mail-outline", label: "Email", value: email },
        ],
        savedAddresses:
            addresses.length > 0
                ? addresses.map((addr) => ({
                    icon:
                        addr.type === 'work'
                            ? 'briefcase-outline'
                            : addr.type === 'home'
                                ? 'home-outline'
                                : 'location-outline',
                    label: addr.label,
                    value: addr.full_address,
                }))
                : [
                    {
                        icon: 'location-outline',
                        label: "Aucune adresse enregistrée",
                        value: "Ajoutez vos adresses depuis l'écran dédié.",
                    },
                ],
        security: [
            { icon: "lock-closed-outline", label: "Changer le mot de passe" },
            {
                icon: "shield-checkmark-outline",
                label: "Authentification à deux facteurs",
                isSwitch: true,
                value: isTwoFactorEnabled,
                onToggle: () => setIsTwoFactorEnabled(!isTwoFactorEnabled),
            },
        ],
        appPreferences: [
            {
                icon: "notifications-outline",
                label: "Notifications",
                isSwitch: true,
                value: isNotificationsEnabled,
                onToggle: () => setIsNotificationsEnabled(!isNotificationsEnabled),
            },
            { icon: "notifications-outline", label: "Préférences de notification" },
        ],
    };

    const handleBack = () => {
        alert("Retour à l'écran précédent");
        // Ajoutez votre logique de navigation ici (ex: navigation.goBack())
    };

    const handleLogout = async () => {
        try {
            if (!API_URL) {
                alert("API_URL non configurée");
                return;
            }

            const token = await AsyncStorage.getItem("authToken");

            if (token) {
                try {
                    await fetch(`${API_URL}/auth/logout`, {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                    });
                } catch (e) {
                    // On ignore les erreurs réseau ici, la priorité est de nettoyer le client
                    console.warn("Erreur lors de l'appel logout", e);
                }
            }

            // Nettoyer le stockage local
            await AsyncStorage.removeItem("authToken");
            await AsyncStorage.removeItem("authUser");

            // Rediriger vers l'écran de login téléphone
            // Ajuste la route si ton routing expo-router est différent
            navigation.navigate('auth/LoginPhone' as never);
        } catch (e: any) {
            alert(e?.message || "Erreur lors de la déconnexion");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* CustomHeader should handle its own back button or be passed a prop to show one */}
            <CustomHeader />

            {/* If CustomHeader doesn't include a back button, you can add one like this: */}
            {/* <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                <Ionicons name="arrow-back-outline" size={28} color={Colors.black} />
            </TouchableOpacity> */}


            <ScrollView contentContainerStyle={styles.content} style={styles.scrollViewFlex}>
                {loading ? (
                    <View style={styles.profile}>
                        <Text style={styles.name}>Chargement du profil...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.profile}>
                        <Text style={styles.name}>{error}</Text>
                    </View>
                ) : (
                    <View style={styles.profile}>
                        <Image
                            source={avatarUri
                                ? { uri: avatarUri }
                                : require("../../assets/images/LOGO_OR.png")}
                            style={styles.avatar}
                        />
                        <Text style={styles.name}>{fullName}</Text>
                        <Text style={styles.joined}>Inscrit le {joinedDate}</Text>
                        <TouchableOpacity
                            style={styles.editProfileBtn}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('screens/account/EditProfile' as never)}
                        >
                            <Ionicons name="create-outline" size={18} color={Colors.white} />
                            <Text style={styles.editProfileText}>Modifier le profil</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.becomeDriverBtn}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('screens/settings/BecomeDriverScreen' as never)}
                        >
                            <Text style={styles.becomeDriverText}>Devenir chauffeur TIC MITON</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Informations personnelles */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Informations personnelles</Text>
                    {sections.personalInfo.map(({ icon, label, value }, index) => (
                        <View
                            key={index}
                            style={[
                                styles.sectionItem,
                                index === sections.personalInfo.length - 1 && styles.lastSectionItem,
                            ]}
                        >
                            <Ionicons name={icon as any} size={22} color={Colors.primary} />
                            <View style={styles.sectionItemContent}>
                                <Text style={styles.sectionLabel}>{label}</Text>
                                <Text style={styles.sectionValue}>{value}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Adresses enregistrées */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Adresses enregistrées</Text>
                    {sections.savedAddresses.map(({ icon, label, value }, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.sectionItem,
                                index === sections.savedAddresses.length - 1 && styles.lastSectionItem,
                            ]}
                            onPress={() => navigation.navigate('screens/account/Addresses' as never)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name={icon as any} size={22} color={Colors.primary} />
                            <View style={styles.sectionItemContent}>
                                <Text style={styles.sectionLabel}>{label}</Text>
                                <Text style={styles.sectionValue}>{value}</Text>
                            </View>
                            <Ionicons name="chevron-forward-outline" size={20} color={Colors.mediumGray} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Sécurité */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Sécurité</Text>
                    {sections.security.map(({ icon, label, isSwitch, value, onToggle }, index) => (
                        <TouchableOpacity // Changed to TouchableOpacity for items without switch
                            key={index}
                            style={[
                                styles.sectionItem,
                                index === sections.security.length - 1 && styles.lastSectionItem,
                            ]}
                            onPress={isSwitch ? undefined : () => {
                                if (label === 'Changer le mot de passe') {
                                    navigation.navigate('screens/account/ChangePassword' as never);
                                }
                            }}
                            activeOpacity={isSwitch ? 1 : 0.7} // Only show active opacity for clickable items
                        >
                            <Ionicons name={icon as any} size={22} color={Colors.primary} />
                            <View style={styles.sectionItemContent}>
                                <Text style={styles.sectionLabel}>{label}</Text>
                            </View>
                            {isSwitch ? (
                                <Switch
                                    value={value}
                                    onValueChange={onToggle}
                                    trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                                    thumbColor={Colors.white}
                                />
                            ) : (
                                <Ionicons name="chevron-forward-outline" size={20} color={Colors.mediumGray} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Préférences de l'application */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Préférences de l'application</Text>
                    {sections.appPreferences.map(({ icon, label, value, isSwitch, onToggle }, index) => (
                        <TouchableOpacity // Changed to TouchableOpacity for items without switch
                            key={index}
                            style={[
                                styles.sectionItem,
                                index === sections.appPreferences.length - 1 && styles.lastSectionItem,
                            ]}
                            onPress={isSwitch ? undefined : () => {
                                if (label === 'Préférences de notification') {
                                    navigation.navigate('screens/account/NotificationPreferences' as never);
                                }
                            }} // Navigate for non-switch items
                            activeOpacity={isSwitch ? 1 : 0.7} // Only show active opacity for clickable items
                        >
                            <Ionicons name={icon as any} size={22} color={Colors.primary} />
                            <View style={styles.sectionItemContent}>
                                <Text style={styles.sectionLabel}>{label}</Text>
                                {value && <Text style={styles.sectionValue}>{value}</Text>}
                            </View>
                            {isSwitch ? (
                                <Switch
                                    value={value}
                                    onValueChange={onToggle}
                                    trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                                    thumbColor={Colors.white}
                                />
                            ) : (
                                <Ionicons name="chevron-forward-outline" size={20} color={Colors.mediumGray} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Déconnexion */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                >
                    <Ionicons name="log-out-outline" size={22} color={Colors.error} />
                    <Text style={styles.logoutText}>Déconnexion</Text>
                </TouchableOpacity>

                {/* Add some bottom padding to the scroll view content */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    // The scrollViewFlex is important to allow the ScrollView to take available space
    scrollViewFlex: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 20, // Added padding to the bottom of the content
    },
    profile: {
        alignItems: "center",
        marginBottom: 30,
        backgroundColor: Colors.white,
        paddingVertical: 25,
        paddingHorizontal: 20,
        marginTop: 20, // Adjusted top margin to look better under header
        borderRadius: 15, // Make profile section also rounded
    },
    editProfileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        backgroundColor: Colors.primary,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    editProfileText: {
        marginLeft: 8,
        color: Colors.white,
        fontFamily: 'Titillium-SemiBold',
        fontSize: 14,
    },
    becomeDriverBtn: {
        marginTop: 12,
        backgroundColor: Colors.secondary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    becomeDriverText: {
        color: Colors.white,
        fontFamily: 'Titillium-SemiBold',
        fontSize: 14,
    },
    backButton: {
        position: "absolute",
        top: 40, // Adjust based on your header height
        left: 20,
        zIndex: 1,
        padding: 5, // Add padding for easier tapping
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        marginBottom: 15,
        borderWidth: 2,
        borderColor: Colors.lightGray,
    },
    name: {
        fontSize: 22,
        fontFamily: "Titillium-Bold",
        color: Colors.primary,
        textAlign: "center",
    },
    joined: {
        fontSize: 14,
        fontFamily: "Titillium-Regular",
        color: Colors.gray,
        marginTop: 8,
        textAlign: "center",
    },
    sectionContainer: {
        backgroundColor: Colors.white,
        borderRadius: 15,
        marginBottom: 25,
        overflow: "hidden", // Important for borderRadius to work with children
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: "Titillium-Bold",
        color: Colors.black,
        paddingVertical: 18,
        paddingHorizontal: 20,
        backgroundColor: Colors.white,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.lightGray,
    },
    sectionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.lightGray,
    },
    lastSectionItem: {
        borderBottomWidth: 0,
    },
    sectionItemContent: {
        flex: 1,
        marginLeft: 15,
    },
    sectionLabel: {
        fontSize: 16,
        fontFamily: "Titillium-SemiBold",
        color: Colors.black,
    },
    sectionValue: {
        fontSize: 14,
        fontFamily: "Titillium-Regular",
        color: Colors.gray,
        marginTop: 5,
    },
    logoutButton: {
        marginTop: 30,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 15,
        borderRadius: 15,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.error,
        marginBottom: 20, // Add bottom margin for the logout button
    },
    logoutText: {
        fontSize: 16,
        fontFamily: "Titillium-SemiBold",
        color: Colors.error,
        marginLeft: 10,
    },
});