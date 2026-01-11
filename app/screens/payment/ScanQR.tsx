import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Colors } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../font';

export default function ScanQRScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission]);

    if (!permission) {
        // Camera permissions are still loading.
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={styles.message}>Nous avons besoin de votre permission pour utiliser la caméra</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.button}>
                    <Text style={styles.buttonText}>Accorder la permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
        setScanned(true);
        // Le QR contient l'URL de paiement Moneroo
        Alert.alert(
            "Code Scanné !",
            "Redirection vers le paiement...",
            [
                {
                    text: "Ouvrir",
                    onPress: () => {
                        Linking.canOpenURL(data).then(supported => {
                            if (supported) {
                                Linking.openURL(data);
                                router.back();
                            } else {
                                Alert.alert("Erreur", "Ce code QR n'est pas un lien valide : " + data);
                                setScanned(false);
                            }
                        });
                    }
                },
                {
                    text: "Annuler",
                    onPress: () => setScanned(false),
                    style: "cancel"
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            />
            <View style={styles.overlay}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Scanner le QR Code</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.scanFrame} />
                <Text style={styles.hint}>Placez le code QR dans le cadre</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'black',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
        color: 'white',
        fontFamily: Fonts.titilliumWeb,
    },
    button: {
        alignSelf: 'center',
        backgroundColor: Colors.primary,
        padding: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: 'white',
        fontFamily: Fonts.titilliumWebBold,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 60,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontFamily: Fonts.titilliumWebBold,
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: Colors.primary,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    hint: {
        color: 'white',
        fontSize: 14,
        fontFamily: Fonts.titilliumWeb,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    }
});
