import React from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Linking,
    StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

export default function HelpCenter() {
    const router = useRouter();

    const openWhatsApp = () => {
        Linking.openURL('https://wa.me/2290157792662');
    };

    const openEmail = () => {
        Linking.openURL('mailto:support@ticmiton.com');
    };

    const HelpItem = ({ icon, title, description, onPress }: any) => (
        <TouchableOpacity style={styles.helpItem} onPress={onPress}>
            <View style={styles.helpIcon}>
                <Ionicons name={icon} size={24} color={Colors.primary} />
            </View>
            <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>{title}</Text>
                <Text style={styles.helpDescription}>{description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.black} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Centre d'aide</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.subtitle}>
                    Besoin d'aide ? Notre équipe est disponible 24h/24 pour vous assister.
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Nous contacter</Text>

                    <HelpItem
                        icon="logo-whatsapp"
                        title="WhatsApp"
                        description="Réponse rapide via WhatsApp"
                        onPress={openWhatsApp}
                    />

                    <HelpItem
                        icon="mail-outline"
                        title="Email"
                        description="support@ticmiton.com"
                        onPress={openEmail}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Questions fréquentes</Text>

                    <View style={styles.faqItem}>
                        <Text style={styles.faqQuestion}>Comment annuler une course ?</Text>
                        <Text style={styles.faqAnswer}>
                            Vous pouvez annuler une course en cours depuis l'écran de suivi en appuyant sur le bouton "Annuler".
                        </Text>
                    </View>

                    <View style={styles.faqItem}>
                        <Text style={styles.faqQuestion}>Comment modifier mon profil ?</Text>
                        <Text style={styles.faqAnswer}>
                            Allez dans Compte → Modifier mon profil pour changer vos informations personnelles.
                        </Text>
                    </View>

                    <View style={styles.faqItem}>
                        <Text style={styles.faqQuestion}>Comment recharger mon portefeuille ?</Text>
                        <Text style={styles.faqAnswer}>
                            Dans l'onglet Portefeuille, appuyez sur "Recharger" et suivez les instructions de paiement.
                        </Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>TIC Miton v1.0.3</Text>
                    <Text style={styles.footerText}>© 2026 TIC Miton. Tous droits réservés.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FD' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 18,
        color: Colors.black
    },
    scrollContent: { padding: 20 },
    subtitle: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 16,
        color: Colors.gray,
        textAlign: 'center',
        marginBottom: 24
    },
    section: { marginBottom: 24 },
    sectionTitle: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 16,
        color: Colors.black,
        marginBottom: 12
    },
    helpItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    helpIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F0F9FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16
    },
    helpContent: { flex: 1 },
    helpTitle: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 16,
        color: Colors.black
    },
    helpDescription: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 14,
        color: Colors.gray,
        marginTop: 2
    },
    faqItem: {
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    faqQuestion: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 15,
        color: Colors.black,
        marginBottom: 8
    },
    faqAnswer: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 14,
        color: Colors.gray,
        lineHeight: 20
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40
    },
    footerText: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 12,
        color: Colors.mediumGray,
        marginTop: 4
    }
});
