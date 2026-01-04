import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';

interface Transaction {
  id: number;
  type: 'credit' | 'debit';
  label: string;
  amount: number;
  time: string;
}

export default function WalletTab() {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token || !API_URL) return;

      const [walletRes, transRes] = await Promise.all([
        fetch(`${API_URL}/passenger/wallet`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        }),
        fetch(`${API_URL}/passenger/wallet/transactions`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        })
      ]);

      if (walletRes.ok) {
        const data = await walletRes.json();
        setBalance(data.balance);
      }
      if (transRes.ok) {
        const data = await transRes.json();
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.log('Error fetching wallet data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
      >
        <Text style={styles.title}>Mon Portefeuille</Text>

        {/* BALANCE CARD */}
        <LinearGradient
          colors={[Colors.secondary, '#FF9D42']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Solde actuel</Text>
            <Ionicons name="shield-checkmark" size={20} color="rgba(255,255,255,0.6)" />
          </View>
          <Text style={styles.balanceValue}>{balance.toLocaleString()} FCFA</Text>
          <TouchableOpacity style={styles.rechargeBtn}>
            <Ionicons name="add-circle" size={20} color={Colors.secondary} />
            <Text style={styles.rechargeText}>Recharger le compte</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ACTIONS */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="send" size={22} color="#15803D" />
            </View>
            <Text style={styles.actionLabel}>Transférer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="receipt" size={22} color="#1D4ED8" />
            </View>
            <Text style={styles.actionLabel}>Factures</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="qr-code" size={22} color="#B91C1C" />
            </View>
            <Text style={styles.actionLabel}>Scanner</Text>
          </TouchableOpacity>
        </View>

        {/* TRANSACTIONS */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Activités récentes</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={Colors.lightGray} />
              <Text style={styles.emptyText}>Aucune transaction aujourd'hui</Text>
            </View>
          ) : (
            transactions.map((item) => (
              <View key={item.id} style={styles.transactionCard}>
                <View style={[styles.transIcon, { backgroundColor: item.type === 'credit' ? '#F0FDF4' : '#F8F9FD' }]}>
                  <Ionicons
                    name={item.type === 'credit' ? 'arrow-down' : 'car-outline'}
                    size={20}
                    color={item.type === 'credit' ? '#15803D' : Colors.primary}
                  />
                </View>
                <View style={styles.transInfo}>
                  <Text style={styles.transLabel}>{item.label}</Text>
                  <Text style={styles.transTime}>{item.time}</Text>
                </View>
                <Text style={[styles.transAmount, { color: item.type === 'credit' ? '#15803D' : Colors.black }]}>
                  {item.type === 'credit' ? '+' : '-'}{item.amount}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FD' },
  scrollContent: { padding: 20 },
  title: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 28,
    color: Colors.black,
    marginBottom: 20,
    marginTop: 10
  },
  balanceCard: {
    borderRadius: 32,
    padding: 24,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 24
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  balanceLabel: {
    fontFamily: Fonts.titilliumWeb,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16
  },
  balanceValue: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.white,
    fontSize: 36,
    marginBottom: 20
  },
  rechargeBtn: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8
  },
  rechargeText: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.secondary,
    fontSize: 15
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32
  },
  actionItem: {
    alignItems: 'center',
    flex: 1
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  actionLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray
  },
  transactionsSection: {
    flex: 1
  },
  sectionTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
    marginBottom: 16
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  transIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  transInfo: {
    flex: 1
  },
  transLabel: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black
  },
  transTime: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2
  },
  transAmount: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontFamily: Fonts.titilliumWeb,
    color: Colors.mediumGray,
    marginTop: 12
  }
});
