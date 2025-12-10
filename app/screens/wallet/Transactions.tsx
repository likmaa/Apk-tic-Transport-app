// screens/wallet/Transactions.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, SectionList, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type TxType = 'ride' | 'topup' | 'delivery';
type Tx = {
  id: string;
  type: TxType;
  description: string;
  amount: number;
  date: string; // Format ISO: 'YYYY-MM-DDTHH:mm:ss'
};

// Données mock plus réalistes
const initialTx: Tx[] = [];

// Helper pour regrouper par mois
const groupTxByMonth = (transactions: Tx[]) => {
  const groups = transactions.reduce((acc, tx) => {
    const month = new Date(tx.date).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(tx);
    return acc;
  }, {} as Record<string, Tx[]>);

  return Object.keys(groups).map(month => ({
    title: month.charAt(0).toUpperCase() + month.slice(1),
    data: groups[month],
  }));
};

// Helper pour le style des icônes
const getTxStyle = (type: TxType) => {
  switch (type) {
    case 'ride': return { icon: 'car-clock', color: Colors.black };
    case 'topup': return { icon: 'arrow-down-bold-circle', color: '#4CAF50' };
    case 'delivery': return { icon: 'package-variant-closed', color: Colors.black };
    default: return { icon: 'help-circle', color: Colors.gray };
  }
};

export default function TransactionsScreen() {
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState<Tx[]>(initialTx);
  const [filter, setFilter] = useState<'all' | 'ride' | 'topup' | 'delivery'>('all');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        if (!API_URL) return;

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const res = await fetch(`${API_URL}/passenger/wallet/transactions`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setTransactions([]);
          return;
        }

        const json = await res.json().catch(() => null);
        if (!Array.isArray(json)) {
          setTransactions([]);
          return;
        }

        const mapped: Tx[] = json.map((t: any, idx: number) => ({
          id: String(t.id ?? idx),
          type: (t.type === 'ride' || t.type === 'topup' || t.type === 'delivery') ? t.type : 'ride',
          description: String(t.description ?? 'Transaction portefeuille'),
          amount: Number(t.amount ?? 0),
          date: typeof t.date === 'string' ? t.date : new Date().toISOString(),
        }));

        setTransactions(mapped);
      } catch {
        setTransactions([]);
      }
    };

    loadTransactions();
  }, [API_URL]);

  const filteredData = useMemo(() => {
    const grouped = groupTxByMonth(transactions);
    if (filter === 'all') return grouped;
    return grouped.map(group => ({
      ...group,
      data: group.data.filter(tx => tx.type === filter),
    })).filter(group => group.data.length > 0);
  }, [filter]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
       
        <TouchableOpacity style={styles.filterButton} onPress={() => setSortModalVisible(true)}>
          <Ionicons name="filter" size={24} color={Colors.black} />
        </TouchableOpacity>
      </View>

      {/* Filtres par type */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity style={[styles.chip, filter === 'all' && styles.chipActive]} onPress={() => setFilter('all')}>
            <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>Toutes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, filter === 'ride' && styles.chipActive]} onPress={() => setFilter('ride')}>
            <Text style={[styles.chipText, filter === 'ride' && styles.chipTextActive]}>Courses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, filter === 'topup' && styles.chipActive]} onPress={() => setFilter('topup')}>
            <Text style={[styles.chipText, filter === 'topup' && styles.chipTextActive]}>Recharges</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, filter === 'delivery' && styles.chipActive]} onPress={() => setFilter('delivery')}>
            <Text style={[styles.chipText, filter === 'delivery' && styles.chipTextActive]}>Livraisons</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <SectionList
        sections={filteredData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        renderItem={({ item }) => {
          const { icon, color } = getTxStyle(item.type);
          const isPositive = item.amount > 0;
          return (
            <View style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: color + '1A' }]}>
                <MaterialCommunityIcons name={icon as any} size={24} color={color} />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txDescription}>{item.description}</Text>
                <Text style={styles.txDate}>{new Date(item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={[styles.txAmount, { color: isPositive ? '#4CAF50' : Colors.black }]}>
                {isPositive ? '+' : ''}{item.amount.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          );
        }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune transaction récente.</Text>
        </View>
      }
      />

      {/* Modal pour le tri (simplifié) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sortModalVisible}
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setSortModalVisible(false)} />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Trier par</Text>
          {/* Ici, vous ajouteriez les options de tri */}
          <TouchableOpacity style={styles.modalOption} onPress={() => { /* setSort('newest'); */ setSortModalVisible(false); }}>
            <Text style={styles.modalOptionText}>Plus récent</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalOption} onPress={() => { /* setSort('amount_desc'); */ setSortModalVisible(false); }}>
            <Text style={styles.modalOptionText}>Montant (décroissant)</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 18, color: Colors.black },
  filterButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  filterContainer: { paddingVertical: 12, backgroundColor: 'white' },
  filterScroll: { paddingHorizontal: 16, gap: 10 },
  chip: { backgroundColor: Colors.background, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 14, color: Colors.black },
  chipTextActive: { color: 'white' },
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  sectionHeader: { fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.gray, marginTop: 24, marginBottom: 8 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.lightGray },
  txIcon: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  txDetails: { flex: 1 },
  txDescription: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 16, color: Colors.black },
  txDate: { fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray, marginTop: 4 },
  txAmount: { fontFamily: Fonts.titilliumWebBold, fontSize: 15 },
  emptyContainer: { marginTop: 40, alignItems: 'center' },
  emptyText: { fontFamily: Fonts.titilliumWeb, fontSize: 16, color: Colors.gray },
  // Styles du Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontFamily: Fonts.titilliumWebBold, fontSize: 20, marginBottom: 20, textAlign: 'center' },
  modalOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.lightGray },
  modalOptionText: { fontFamily: Fonts.titilliumWebSemiBold, fontSize: 16 },
});
