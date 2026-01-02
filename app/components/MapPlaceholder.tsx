import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme';
import { Fonts } from '../font';

interface MapPlaceholderProps {
    height?: number | string;
    style?: any;
}

export function MapPlaceholder({ height = '100%', style }: MapPlaceholderProps) {
    return (
        <View style={[styles.container, { height }, style]}>
            <Image
                source={require('../../assets/images/LOGO_OR.png')} // Fallback image if map-placeholder missing
                style={styles.mapImage}
                resizeMode="contain"
            />
            <View style={styles.overlay}>
                <Text style={styles.text}>Aperçu de la carte indisponible en mode Expo Go</Text>
            </View>
            <LinearGradient
                colors={['rgba(0,0,0,0.05)', 'transparent', 'rgba(0,0,0,0.1)']}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapImage: {
        width: '40%',
        height: '40%',
        opacity: 0.2,
    },
    overlay: {
        position: 'absolute',
        bottom: 100,
        backgroundColor: 'rgba(255,255,255,0.8)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    text: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 12,
        color: Colors.gray,
    }
});
