// screens/Notifications.tsx
import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, SectionList, TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';
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
const initialNotifications: NotificationItem[] = [
  { id: '1', type: 'ride', title: 'Chauffeur en route', message: 'Votre chauffeur arrive dans 5 minutes.', date: 'Aujourd\'hui, 09:45', read: false },
  { id: '2', type: 'promo', title: '20% de réduction !', message: 'Utilisez le code PROMO20 pour votre prochaine course.', date: 'Aujourd\'hui, 09:15', read: false },
  { id: '3', type: 'ride', title: 'Reçu de course', message: 'Votre reçu pour la course vers le centre-ville est disponible.', date: 'Hier, 18:22', read: true },
  { id: '4', type: 'system', title: 'Mise à jour des conditions', message: 'Nos conditions d\'utilisation ont été mises à jour.', date: '20 Sep, 10:00', read: true },
];

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
  const [items, setItems] = useState<NotificationItem[]>(initialNotifications);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);
  const groupedData = useMemo(() => groupNotificationsByDate(items), [items]);

  const toggleRead = (id: string) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read: !n.read } : n)));
  };

  const markAllRead = () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
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

      {items.length === 0 ? (
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
