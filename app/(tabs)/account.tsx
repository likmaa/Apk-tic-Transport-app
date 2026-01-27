import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '../theme';
import { Fonts } from '../font';

interface UserInfo {
  name: string;
  phone: string;
  email: string;
  photo?: string;
}

export default function AccountTab() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (!token || !API_URL) return;

        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        });

        if (res.ok) {
          const data = await res.json();
          setUser({
            name: data.name,
            phone: data.phone,
            email: data.email,
            photo: data.photo
          });
        }
      } catch (e) {
        console.log('Error fetching user info', e);
      }
    };
    fetchUser();
  }, [API_URL]);

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove(["authToken", "authUser"]);
            // Redirect to index (which acts as onboarding/login router)
            router.replace('/');
          }
        }
      ]
    );
  };

  const MenuItem = ({ icon, label, onPress, color = Colors.black, rightElement }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: '#F8F9FD' }]}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      {rightElement || <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* PROFILE HEADER */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{user?.name?.charAt(0) || 'U'}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => router.push('/screens/account/EditProfile' as any)}
            >
              <Ionicons name="camera" size={16} color={Colors.white} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push('/screens/account/EditProfile' as any)}>
            <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
          </TouchableOpacity>
          <Text style={styles.userPhone}>{user?.phone || 'Chargement...'}</Text>
        </View>

        {/* MENU GROUPS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Général</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              label="Modifier mon profil"
              onPress={() => router.push('/screens/account/EditProfile' as any)}
            />
            <View style={styles.separator} />
            <MenuItem
              icon="location-outline"
              label="Mes Adresses"
              onPress={() => router.push('/screens/account/Addresses' as any)}
            />
            <View style={styles.separator} />
            <MenuItem
              icon="time-outline"
              label="Historique des courses"
              onPress={() => router.push('/(tabs)/activity')}
            />
            <View style={styles.separator} />
            <MenuItem
              icon="card-outline"
              label="Modes de paiement"
              onPress={() => router.push('/(tabs)/wallet')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Sécurité</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="help-circle-outline"
              label="Centre d'aide"
              onPress={() => router.push('/screens/settings/HelpCenter' as any)}
            />
            <View style={styles.separator} />
            <MenuItem
              icon="shield-outline"
              label="Confidentialité"
              onPress={() => router.push('/screens/settings/HelpCenter' as any)}
            />
            <View style={styles.separator} />
            <MenuItem
              icon="settings-outline"
              label="Paramètres"
              onPress={() => router.push('/screens/account/NotificationPreferences' as any)}
            />
          </View>
        </View>


        {/* LOGOUT */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.2.0 • TIC Miton</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FD' },
  scrollContent: { padding: 20 },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.white,
  },
  avatarInitial: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 40,
    color: Colors.white
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.secondary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white
  },
  userName: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 24,
    color: Colors.black,
    marginBottom: 4
  },
  userPhone: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.gray
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.gray,
    marginBottom: 12,
    marginLeft: 4
  },
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  menuLabel: {
    flex: 1,
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 18,
    borderRadius: 24,
    marginTop: 10,
    gap: 10
  },
  logoutText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: '#EF4444'
  },
  versionText: {
    textAlign: 'center',
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 32,
    marginBottom: 20
  }
});
