// screens/wallet/WalletScreen.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchWithRetry } from '../utils/networkHandler';

type TxType = 'ride' | 'topup' | 'delivery';
type Tx = {
    id: string;
    description: string;
    type: TxType;
    amount: number;
    detail: string;
};

// Composant pour chaque ligne de transaction
const TransactionItem = ({ item, isLast }: { item: Tx, isLast: boolean }) => {
    const isPositive = item.amount > 0;
    let iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'] = 'car';
    if (isPositive) iconName = 'arrow-down-bold-circle';
    else if (item.type === 'delivery') iconName = 'package-variant-closed';

    return (
        <View style={[styles.transactionItem, isLast && { borderBottomWidth: 0 }]}>
            <View style={[styles.transactionIcon, { backgroundColor: isPositive ? '#E8F5E9' : Colors.lightGray }]}>
                <MaterialCommunityIcons
                    name={iconName}
                    size={24}
                    color={isPositive ? '#4CAF50' : Colors.black}
                />
            </View>
            <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>{item.description}</Text>
                <Text style={styles.transactionDate}>{item.detail}</Text>
            </View>
            <Text style={[styles.transactionAmount, { color: isPositive ? '#4CAF50' : Colors.black }]}>
                {isPositive ? '+' : '-'} {Math.abs(item.amount).toLocaleString('fr-FR')} FCFA
            </Text>
        </View>
    );
};

export default function WalletScreen() {
    const navigation = useNavigation();
    const [currentBalance, setCurrentBalance] = useState<number>(0);
    const [transactions, setTransactions] = useState<Tx[]>([]);
    const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;

    useEffect(() => {
        const loadWallet = async () => {
            try {
                if (!API_URL) return;

                const token = await AsyncStorage.getItem('authToken');
                if (!token) return;

                const res = await fetchWithRetry(`${API_URL}/passenger/wallet`, {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) {
                    setCurrentBalance(0);
                    return;
                }

                const json = await res.json();
                const balance = Number(json.balance);
                setCurrentBalance(Number.isFinite(balance) ? balance : 0);
            } catch {
                setCurrentBalance(0);
            }
        };

        loadWallet();
    }, [API_URL]);

    useEffect(() => {
        const loadTransactions = async () => {
            try {
                if (!API_URL) return;

                const token = await AsyncStorage.getItem('authToken');
                if (!token) return;

                const res = await fetchWithRetry(`${API_URL}/passenger/wallet/transactions`, {
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

                const mapped: Tx[] = json.map((t: any, idx: number) => {
                    const dateStr = typeof t.date === 'string' ? t.date : (t.created_at ?? new Date().toISOString());
                    const d = new Date(dateStr);
                    const detail = isNaN(d.getTime())
                        ? ''
                        : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

                    const rawType = String(t.type ?? 'ride');
                    const type: TxType = (rawType === 'ride' || rawType === 'topup' || rawType === 'delivery') ? rawType : 'ride';

                    return {
                        id: String(t.id ?? idx),
                        description: String(t.description ?? 'Transaction portefeuille'),
                        type,
                        amount: Number(t.amount ?? 0),
                        detail,
                    };
                });

                // On garde seulement les quelques dernières transactions
                setTransactions(mapped.slice(0, 5));
            } catch {
                setTransactions([]);
            }
        };

        loadTransactions();
    }, [API_URL]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.black} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mon Portefeuille</Text>
                <View style={{ width: 44 }} />
            </View>

            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollContent}
                ListHeaderComponent={() => (
                    <>
                        {/* Carte du Solde */}
                        <View style={styles.balanceCard}>
                            <Text style={styles.balanceLabel}>Solde disponible</Text>
                            <Text style={styles.balanceAmount}>{currentBalance.toLocaleString('fr-FR')} FCFA</Text>
                        </View>

                        {/* Boutons d'action */}
                        <View style={styles.actionsContainer}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('screens/wallet/AddFunds' as never)}>
                                <View style={[styles.actionIcon, { backgroundColor: Colors.primary }]}>
                                    <Ionicons name="add" size={24} color="white" />
                                </View>
                                <Text style={styles.actionLabel}>Recharger</Text>
                            </TouchableOpacity>


                        </View>

                        {/* Titre de l'historique */}
                        <View style={styles.historyHeader}>
                            <Text style={styles.historyTitle}>Transactions Récentes</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('screens/wallet/Transactions' as never)}>
                                <Text style={styles.seeAllText}>Tout voir</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
                renderItem={({ item, index }) => (
                    <TransactionItem item={item} isLast={index === transactions.length - 1} />
                )}
                ListEmptyComponent={
                    <View style={{ marginTop: 24, alignItems: 'center' }}>
                        <Text style={styles.transactionDate}>Aucune transaction récente.</Text>
                    </View>
                }
                // Le conteneur de la liste est maintenant une carte
                style={styles.historyListContainer}
            />
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
        marginTop: 30
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
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 40,
    },
    balanceCard: {
        backgroundColor: Colors.primary,
        borderRadius: 10,
        padding: 20,
        marginBottom: 24,
    },
    balanceLabel: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 15,
        color: 'white',
    },
    balanceAmount: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 36,
        color: 'white',
        marginTop: 8,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 32,
    },
    actionButton: {
        alignItems: 'center',
    },
    actionIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionLabel: {
        fontFamily: Fonts.titilliumWebSemiBold,
        fontSize: 14,
        color: Colors.black,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    historyTitle: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 20,
        color: Colors.black,
    },
    seeAllText: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 14,
        color: Colors.primary,
    },
    historyListContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        paddingHorizontal: 16,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.lightGray,
    },
    transactionIcon: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionDescription: {
        fontFamily: Fonts.titilliumWebSemiBold,
        fontSize: 16,
        color: Colors.black,
    },
    transactionDate: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 14,
        color: Colors.gray,
        marginTop: 4,
    },
    transactionAmount: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 15,
    },
});
