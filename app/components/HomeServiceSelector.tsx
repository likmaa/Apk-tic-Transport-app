import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts } from '../theme';

type ServiceType = 'Course' | 'Déplacement' | 'Livraison';

type Props = {
  activeService: ServiceType;
  onChange: (s: ServiceType) => void;
};

export default function HomeServiceSelector({ activeService, onChange }: Props) {
  const services: { id: ServiceType; label: string; icon: any }[] = [
    { id: 'Course', label: 'Course', icon: 'car-sports' },
    { id: 'Déplacement', label: 'Déplacement', icon: 'walk' },
    { id: 'Livraison', label: 'Livraison', icon: 'package-variant-closed' },
  ];

  return (
    <View style={styles.container}>
      {services.map((service) => {
        const isActive = activeService === service.id;
        return (
          <TouchableOpacity
            key={service.id}
            activeOpacity={0.8}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onChange(service.id)}
          >
            <View style={[styles.iconCircle, isActive && styles.iconCircleActive]}>
              <MaterialCommunityIcons
                name={service.icon}
                size={26}
                color={isActive ? Colors.white : Colors.primary}
              />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {service.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6
  },
  iconCircleActive: {
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  label: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center'
  },
  labelActive: {
    color: Colors.white
  },
});
