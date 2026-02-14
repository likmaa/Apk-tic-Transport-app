import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View, Image, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImageUrl } from '../../utils/images';

export default function EditProfile() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;


  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('authUser');
        console.log('[PHOTO DEBUG] 1. AsyncStorage authUser:', storedUser ? JSON.parse(storedUser) : null);
        if (storedUser) {
          const user = JSON.parse(storedUser);
          if (user.name) setName(String(user.name));
          if (user.email) setEmail(user.email);
          if (user.phone) setPhone(user.phone);
          const storedAvatar = user.photo || user.avatar;
          console.log('[PHOTO DEBUG] 2. storedAvatar brut:', storedAvatar);
          if (storedAvatar) {
            const resolved = getImageUrl(storedAvatar);
            console.log('[PHOTO DEBUG] 3. getImageUrl(storedAvatar):', resolved);
            setAvatarUri(resolved);
          }
        }

        if (!API_URL) {
          console.log('[PHOTO DEBUG] API_URL manquant, arrêt');
          return;
        }

        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          console.log('[PHOTO DEBUG] Token manquant, arrêt');
          return;
        }

        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json().catch(() => null);
        console.log('[PHOTO DEBUG] 4. API /auth/me status:', res.status, 'photo field:', json?.photo);
        if (!res.ok || !json) {
          console.log('[PHOTO DEBUG] API /auth/profile échoué');
          return;
        }

        if (json.name) setName(String(json.name));
        if (json.email) setEmail(json.email);
        if (json.phone) setPhone(json.phone);
        const apiAvatar = json.photo;
        console.log('[PHOTO DEBUG] 5. apiAvatar brut depuis API:', apiAvatar);
        if (apiAvatar) {
          const resolved = getImageUrl(apiAvatar);
          console.log('[PHOTO DEBUG] 6. getImageUrl(apiAvatar):', resolved);
          setAvatarUri(resolved);
        } else {
          console.log('[PHOTO DEBUG] 5b. PAS de photo dans la réponse API !');
        }

        await AsyncStorage.setItem('authUser', JSON.stringify({ ...json }));
      } catch (e) {
        console.warn('[PHOTO DEBUG] Erreur chargement profil', e);
      }
    };

    loadProfile();
  }, [API_URL]);

  const handleSave = async () => {
    if (!API_URL) {
      Alert.alert('Erreur', 'API_URL non configurée');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Erreur', 'Utilisateur non connecté');
        return;
      }

      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('_method', 'PUT'); // Spoofing PUT because multipart/form-data works best with POST

      console.log('[PHOTO DEBUG] 7. handleSave - avatarUri actuel:', avatarUri);
      if (avatarUri && !avatarUri.startsWith('http')) {
        // C'est un fichier local à envoyer
        const filename = avatarUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        console.log('[PHOTO DEBUG] 8. Upload photo locale:', { uri: avatarUri, name: filename, type });

        formData.append('photo', {
          uri: avatarUri,
          name: filename,
          type,
        } as any);
      } else {
        console.log('[PHOTO DEBUG] 8b. Pas d\'upload photo (commence par http ou null)');
      }

      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'POST', // On utilise POST avec _method: PUT
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          // Note: Ne pas mettre Content-Type, fetch le fera avec le boundary
        },
        body: formData,
      });

      const json = await res.json().catch(() => null);
      console.log('[PHOTO DEBUG] 9. Réponse save - status:', res.status, 'json:', JSON.stringify(json));
      if (!res.ok || !json) {
        const msg = (json && (json.message || json.error)) || 'Impossible de mettre à jour le profil.';
        Alert.alert('Erreur', msg);
        return;
      }

      // Mettre à jour le user local avec les données serveur (qui incluent le nouvel URL de la photo)
      const updatedPhoto = json.photo;
      console.log('[PHOTO DEBUG] 10. updatedPhoto brut du serveur:', updatedPhoto);
      if (updatedPhoto) {
        const resolved = getImageUrl(updatedPhoto);
        console.log('[PHOTO DEBUG] 11. getImageUrl(updatedPhoto):', resolved);
        setAvatarUri(resolved);
      } else {
        console.log('[PHOTO DEBUG] 10b. PAS de photo dans réponse save !');
      }

      await AsyncStorage.setItem('authUser', JSON.stringify({ ...json }));
      Alert.alert('Succès', 'Profil mis à jour.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Erreur réseau lors de la mise à jour du profil");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l’accès à vos photos pour changer votre photo de profil.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      console.log('[PHOTO DEBUG] 12. Photo sélectionnée URI:', uri);
      if (!uri) return;

      setAvatarUri(uri);
      console.log('[PHOTO DEBUG] 13. avatarUri mis à jour avec URI locale');

      const storedUser = await AsyncStorage.getItem('authUser');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        await AsyncStorage.setItem('authUser', JSON.stringify({ ...user, avatar: uri, photo: uri }));
      } else {
        await AsyncStorage.setItem('authUser', JSON.stringify({ avatar: uri, photo: uri }));
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de changer la photo pour le moment.');
    }
  };

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

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    if (formatted.length <= 14) { // 10 digits + 4 spaces
      setPhone(formatted);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          {(() => { console.log('[PHOTO DEBUG] 14. RENDER avatarUri:', avatarUri); return null; })()}
          <Image
            source={avatarUri ? { uri: avatarUri } : require('../../../assets/images/LOGO_OR.png')}
            style={[styles.avatar, { backgroundColor: '#E2E8F0' }]}
            resizeMode="cover"
            onError={(e) => console.log('[PHOTO DEBUG] 15. Image onError:', e.nativeEvent.error, 'URI was:', avatarUri)}
            onLoad={() => console.log('[PHOTO DEBUG] 16. Image chargée OK')}
          />
          <TouchableOpacity style={styles.changePhotoBtn} onPress={handleChangePhoto}>
            <Text style={styles.changePhotoText}>Changer la photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Nom complet"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="Email" keyboardType="email-address" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            style={styles.input}
            placeholder="97 23 45 67"
            keyboardType="phone-pad"
            maxLength={14}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          <Text style={styles.saveText}>{loading ? 'Enregistrement...' : 'Enregistrer'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.driverBtn}
          onPress={() => router.push('/screens/settings/BecomeDriverScreen')}
        >
          <Text style={styles.driverText}>Devenir chauffeur TIC MITON</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  avatarContainer: { alignItems: 'center', marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  changePhotoBtn: { marginTop: 8, backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.lightGray },
  changePhotoText: { fontFamily: Fonts.titilliumWebBold, color: Colors.primary },
  inputGroup: { marginBottom: 12 },
  label: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, marginBottom: 6 },
  input: { backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: Colors.lightGray, fontFamily: Fonts.titilliumWeb },
  saveBtn: { marginTop: 12, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold, fontSize: 16 },
  driverBtn: { marginTop: 16, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.white },
  driverText: { color: Colors.primary, fontFamily: Fonts.titilliumWebBold, fontSize: 15 },
});
