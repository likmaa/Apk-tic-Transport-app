import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Alert, Switch } from 'react-native';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useNavigation } from 'expo-router';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useServiceStore } from '../../providers/ServiceProvider';
import { usePaymentStore } from '../../providers/PaymentProvider';

 type RootParams = {
  'screens/ride/RideReceipt': { amount: number; distanceKm: number; vehicleName: string } | undefined;
 };

export default function RideReceipt() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootParams, 'screens/ride/RideReceipt'>>();
  const amount = route.params?.amount ?? 2500;
  const distanceKm = route.params?.distanceKm ?? 5;
  const vehicleName = route.params?.vehicleName ?? 'Standard';
  const { serviceType, packageDetails } = useServiceStore();
  const { method } = usePaymentStore();

  // Mock breakdown
  const [night, setNight] = React.useState(false);
  const base = 800;
  const distanceFee = Math.round(distanceKm * 500);
  const surcharge = night ? 200 : 0; // night mode adds 200
  const durationMin = 14; // mock duration
  const total = base + distanceFee + surcharge;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reçu</Text>
        {serviceType && (
          <Text style={styles.typeBadge}>
            {serviceType === 'deplacement' ? 'Déplacement' : serviceType === 'course' ? 'Course' : 'Livraison'}
          </Text>
        )}
        <View style={styles.row}><Text style={styles.label}>Véhicule</Text><Text style={styles.value}>{vehicleName}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Distance</Text><Text style={styles.value}>{distanceKm.toFixed(1)} km</Text></View>
        <View style={styles.row}><Text style={styles.label}>Durée</Text><Text style={styles.value}>{durationMin} min</Text></View>
        <View style={styles.row}><Text style={styles.label}>Payé via</Text><Text style={styles.value}>{labelFor(method)}</Text></View>
        <View style={styles.sep} />
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Mode nuit</Text>
          <Switch value={night} onValueChange={setNight} />
        </View>
        <View style={styles.sep} />
        <View style={styles.row}><Text style={styles.label}>Base</Text><Text style={styles.value}>FCFA {base.toLocaleString('fr-FR')}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Distance</Text><Text style={styles.value}>FCFA {distanceFee.toLocaleString('fr-FR')}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Surcharge</Text><Text style={styles.value}>FCFA {surcharge.toLocaleString('fr-FR')}</Text></View>
        <View style={styles.sep} />
        <View style={styles.row}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>FCFA {total.toLocaleString('fr-FR')}</Text></View>
        {serviceType === 'livraison' && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.subTitle}>Infos colis</Text>
            <View style={styles.row}><Text style={styles.label}>Destinataire</Text><Text style={styles.value}>{packageDetails?.recipientName || '-'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Téléphone</Text><Text style={styles.value}>{packageDetails?.recipientPhone || '-'}</Text></View>
            {!!packageDetails?.description && (
              <View style={styles.row}><Text style={styles.label}>Description</Text><Text style={styles.value}>{packageDetails?.description}</Text></View>
            )}
            <View style={styles.row}><Text style={styles.label}>Poids</Text><Text style={styles.value}>{packageDetails?.weightKg || '-'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Fragile</Text><Text style={styles.value}>{packageDetails?.fragile ? 'Oui' : 'Non'}</Text></View>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Envoyé', 'Reçu envoyé par email (mock)')}>
        <Text style={styles.secondaryText}>Envoyer par email</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => (navigation as any).navigate('(tabs)', { screen: 'Home' })}>
        <Text style={styles.primaryText}>Fermer</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  title: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, fontSize: 18, marginBottom: 10 },
  typeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.background, color: Colors.black, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontFamily: Fonts.titilliumWebBold, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontFamily: Fonts.titilliumWeb, color: Colors.gray },
  value: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  totalValue: { fontFamily: Fonts.titilliumWebBold, color: Colors.black },
  sep: { height: 1, backgroundColor: Colors.background, marginVertical: 8 },
  secondaryBtn: { marginTop: 12, backgroundColor: Colors.white, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.lightGray },
  secondaryText: { color: Colors.black, fontFamily: Fonts.titilliumWebBold },
  primaryBtn: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: Colors.white, fontFamily: Fonts.titilliumWebBold },
  subTitle: { fontFamily: Fonts.titilliumWebBold, color: Colors.black, marginBottom: 6 },
});

function labelFor(m: ReturnType<typeof usePaymentStore>['method']) {
  switch (m) {
    case 'cash': return 'Espèces';
    case 'mobile_money': return 'Mobile Money';
    case 'card': return 'Carte bancaire';
    case 'wallet': return 'Portefeuille';
    case 'qr': return 'QR Code';
    default: return String(m);
  }
}
