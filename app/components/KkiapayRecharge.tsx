import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { useAuth } from '../providers/AuthProvider';
import { useKkiapay } from '@kkiapay-org/react-native-sdk';

interface KkiapayRechargeProps {
    amount: number;
    onSuccess: (data: any) => void;
    disabled?: boolean;
}

export default function KkiapayRecharge({ amount, onSuccess, disabled }: KkiapayRechargeProps) {
    const { user } = useAuth();
    const { openKkiapayWidget, addSuccessListener } = useKkiapay();

    useEffect(() => {
        // Register success listener
        const removeListener = addSuccessListener((response) => {
            console.log('KKiaPay Payment Success:', response);
            onSuccess(response);
        });

        return () => {
            // SDK might not return a direct remove function, check typings or common patterns
            // Use removeKkiapayListener if available
        };
    }, [onSuccess]);

    const handlePress = () => {
        if (amount <= 0) {
            Alert.alert("Erreur", "Le montant doit être supérieur à 0");
            return;
        }

        openKkiapayWidget({
            amount: amount,
            key: "8eb49b50fade11f0bc5529a7bfe203c1", // Public Key (In production, use Env variable)
            sandbox: true,
            reason: "Rechargement portefeuille APK TIC",
            phone: user?.phone || "",
            data: "topup_" + user?.id, // Metadata passed to webhook as externalId
        });
    };

    return (
        <TouchableOpacity
            style={[styles.button, disabled && styles.disabled]}
            onPress={handlePress}
            disabled={disabled}
        >
            <Text style={styles.text}>Payer avec KKiaPay</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabled: {
        backgroundColor: Colors.mediumGray,
    },
    text: {
        color: 'white',
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 18,
    },
});
