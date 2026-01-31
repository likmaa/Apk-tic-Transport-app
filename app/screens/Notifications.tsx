// screens/Notifications.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View, SectionList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Type de notification étendu avec une catégorie
type NotificationType = 'ride' | 'promo' | 'system';
type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  date: string;
  read: boolean;
};

// Données mock avec des types différents

// Helper pour regrouper les notifications par date
const groupNotificationsByDate = (notifications: NotificationItem[]) => {
  const groups: { [key: string]: NotificationItem[] } = {};
  notifications.forEach(notif => {
    const dateKey = notif.date.split(',')[0]; // 'Aujourd'hui', 'Hier', '20 Sep'
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(notif);
  });
  return Object.keys(groups).map(key => ({
    title: key,
    data: groups[key],
  }));
};

// Helper pour obtenir l'icône et la couleur en fonction du type
const getNotificationStyle = (type: NotificationType) => {
  switch (type) {
    case 'ride':
      return { icon: 'car-clock', color: Colors.primary };
    case 'promo':
      return { icon: 'gift', color: '#FF8C42' }; // Orange
    case 'system':
      return { icon: 'cog', color: Colors.gray };
    default:
      return { icon: 'bell', color: Colors.gray };
  }
};

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token || !API_URL) return;

      const response = await fetch(`${API_URL}/passenger/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Assuming data is an array of notifications from backend
        // Transform backend data to NotificationItem if needed
        const mappedData: NotificationItem[] = (data || []).map((n: any) => ({
          id: String(n.id),
          type: n.type || 'system',
          title: n.title,
          message: n.message,
          date: n.created_at ? new Date(n.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          }) : '',
          read: !!n.read_at
        }));
        setItems(mappedData);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);
  const groupedData = useMemo(() => groupNotificationsByDate(items), [items]);

  const toggleRead = async (id: string) => {
    // Optimistic UI update
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || !API_URL) return;

      await fetch(`${API_URL}/passenger/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
    } catch (e) {
      console.warn("Error marking notification as read:", e);
    }
  };

  const markAllRead = async () => {
    // Optimistic UI update
    setItems(prev => prev.map(n => ({ ...n, read: true })));

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || !API_URL) return;

      await fetch(`${API_URL}/passenger/notifications/read-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
    } catch (e) {
      console.warn("Error marking all notifications as read:", e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={64} color={Colors.mediumGray} />
          </View>
          <Text style={styles.emptyTitle}>Boîte de réception vide</Text>
          <Text style={styles.emptySubtitle}>
            Les mises à jour de vos courses, les promotions et les actualités importantes apparaîtront ici.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={groupedData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={({ item }) => {
            const { icon, color } = getNotificationStyle(item.type);
            return (
              <TouchableOpacity
                onPress={() => toggleRead(item.id)}
                activeOpacity={0.7}
                style={[styles.card, !item.read && styles.cardUnread]}
              >
                <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                  <MaterialCommunityIcons name={icon as any} size={24} color={color} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>
                  <Text style={styles.cardDate}>{item.date.split(', ')[1]}</Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,

    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
  },
  markAllText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.primary,
    paddingHorizontal: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  sectionHeader: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.gray,
    marginTop: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  cardUnread: {
    backgroundColor: Colors.primary + '0A', // Fond très léger pour les non-lus
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
    marginBottom: 4,
  },
  cardMessage: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  cardDate: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: Colors.gray,
    marginTop: 6,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 22,
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.gray,
    textAlign: 'center',
    lineHeight: 24,
  },
});
