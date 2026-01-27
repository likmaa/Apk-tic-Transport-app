import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, Image, Modal, StyleSheet, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../providers/LocationProvider';
import { EMBARKATION_POINTS } from '../data/embarkationPoints';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../providers/AuthProvider';

export default function CourseSection({ activeService }: { activeService?: string }) {
  const router = useRouter();
  const { origin, setOrigin, destination, requestUserLocation } = useLocationStore();
  const { token } = useAuth();
  const [showEmbarkModal, setShowEmbarkModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());
  const [scheduleTime, setScheduleTime] = useState<Date>(new Date());
  const [quoting, setQuoting] = useState(false);
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [quote, setQuote] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [homeAddress, setHomeAddress] = useState<{
    id: number;
    label: string;
    full_address: string;
    lat?: number | null;
    lng?: number | null;
    type?: string | null;
  } | null>(null);
  const [promotions, setPromotions] = useState<any[]>([]);
  const adsRef = useRef<ScrollView | null>(null);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const api = process.env.EXPO_PUBLIC_API_URL;
        if (!api) return;
        const res = await fetch(`${api}/promotions`);
        if (res.ok) {
          const data = await res.json();
          setPromotions(data);
        }
      } catch (err) {
        console.warn("Error fetching promotions:", err);
      }
    };
    fetchPromotions();
  }, []);

  useEffect(() => {
    if (promotions.length <= 1) return;
    const id = setInterval(() => {
      currentIndexRef.current = (currentIndexRef.current + 1) % promotions.length;
      adsRef.current?.scrollTo({ x: currentIndexRef.current * (280 + 16), animated: true });
    }, 4000);
    return () => clearInterval(id);
  }, [promotions]);

  const handlePromoPress = (promo: any) => {
    if (promo.link_url) {
      import('react-native').then(({ Linking }) => {
        Linking.openURL(promo.link_url).catch(err => console.error("Couldn't load page", err));
      });
    }
  };

  useEffect(() => {
    const api = process.env.EXPO_PUBLIC_API_URL;
    if (!api) return;

    (async () => {
      try {
        if (!token) return;

        const res = await fetch(`${api}/passenger/addresses`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;

        const json = await res.json();
        if (!Array.isArray(json)) return;

        const home = json.find((a: any) => a.type === 'home' || a.label === 'Domicile');
        if (home) {
          setHomeAddress(home);
        }
      } catch {
        // silencieux pour ne pas gêner l'écran principal
      }
    })();
  }, []);

  useEffect(() => {
    if (!origin) setShowEmbarkModal(true);
  }, [origin]);

  const handleSelectEmbark = (p: { id: string; name: string; lat: number; lon: number; address?: string }) => {
    setOrigin({ address: p.address || p.name, lat: p.lat, lon: p.lon });
    setShowEmbarkModal(false);
  };

  const handleUseMyLocation = async () => {
    setShowEmbarkModal(false);
    await requestUserLocation();
  };

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const distanceMeters = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const R = 6371000; const dLat = (b.lat - a.lat) * Math.PI / 180; const dLon = (b.lon - a.lon) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180; const la2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    const d = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * d;
  };

  const computeLocalQuote = () => {
    const base = 200; let surcharge = 0;
    if (origin) {
      const overlaps = EMBARKATION_POINTS.filter(ep => distanceMeters({ lat: origin.lat, lon: origin.lon }, { lat: ep.lat, lon: ep.lon }) <= (ep.radiusMeters || 300)).length;
      if (overlaps > 1) surcharge = 100;
    }
    return base + surcharge;
  };

  const onSeePrice = async () => {
    setQuoting(true); setQuote(null);
    try {
      const api = process.env.EXPO_PUBLIC_API_URL;
      if (api && origin && destination) {
        const res = await fetch(`${api}/routing/estimate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickup: { lat: origin.lat, lng: origin.lon }, dropoff: { lat: destination.lat, lng: destination.lon } }) });
        if (res.ok) { const data = await res.json(); setQuote(typeof data?.price === 'number' ? data.price : computeLocalQuote()); } else { setQuote(computeLocalQuote()); }
      } else { setQuote(computeLocalQuote()); }
    } catch { setQuote(computeLocalQuote()); } finally { setQuoting(false); }
  };

  const canStartRide = !!origin && !!destination && !creating;

  const [rideType, setRideType] = useState<'immediate' | 'scheduled' | 'intercity' | 'multi'>('immediate');
  const [showTypeModal, setShowTypeModal] = useState(false);

  const rideTypeLabels = {
    immediate: 'Course immédiate',
    scheduled: 'Course programmée',
    intercity: 'Inter-ville',
    multi: 'Multi-arrêts',
  };

  const rideTypeIcons = {
    immediate: 'flash',
    scheduled: 'calendar-clock',
    intercity: 'map-marker-distance',
    multi: 'map-marker-multiple',
  };

  return (
    <>
      {/* MODERN SEARCH BAR */}
      <View style={styles.searchContainer}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.searchLeft}
          onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'destination' } })}
        >
          <View style={[styles.searchIconBg, { backgroundColor: Colors.secondary }]}>
            <Ionicons name="search" size={20} color={Colors.white} />
          </View>
          <View style={styles.searchTextContainer}>
            <Text style={styles.searchPlaceholder}>{rideTypeLabels[rideType]}</Text>
            <Text style={styles.searchSubText}>Où allez-vous ?</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.searchFilter}
          onPress={() => setShowTypeModal(true)}
        >
          <MaterialCommunityIcons name="tune-variant" size={20} color={activeService === 'Course' ? Colors.primary : Colors.gray} />
        </TouchableOpacity>
      </View>

      {/* RIDE TYPE SELECTION MODAL */}
      <Modal visible={showTypeModal} transparent animationType="fade" onRequestClose={() => setShowTypeModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypeModal(false)}
        >
          <View style={styles.typeModalContent}>
            <Text style={styles.typeModalTitle}>Choisir le type de trajet</Text>
            {(Object.keys(rideTypeLabels) as Array<keyof typeof rideTypeLabels>).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeOption, rideType === type && styles.typeOptionActive]}
                onPress={() => {
                  setRideType(type);
                  setShowTypeModal(false);
                }}
              >
                <View style={[styles.typeIconBg, rideType === type && styles.typeIconBgActive]}>
                  <MaterialCommunityIcons
                    name={rideTypeIcons[type] as any}
                    size={22}
                    color={rideType === type ? Colors.white : Colors.gray}
                  />
                </View>
                <Text style={[styles.typeText, rideType === type && styles.typeTextActive]}>
                  {rideTypeLabels[type]}
                </Text>
                {rideType === type && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* QUICK DESTINATIONS */}
      <View style={styles.quickDestinations}>
        <TouchableOpacity
          style={styles.homeCard}
          onPress={() => router.push({ pathname: '/screens/map/PickLocation', params: { mode: 'origin' } })}
        >
          <View style={styles.homeIconBg}>
            <Ionicons name="home" size={22} color={Colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.homeTitle}>Domicile</Text>
            <Text style={styles.homeAddress} numberOfLines={1}>
              {homeAddress?.full_address || 'Définir mon domicile'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D1D1" />
        </TouchableOpacity>
      </View>

      {/* PROMO CAROUSEL */}
      {promotions.length > 0 && (
        <View style={styles.promoSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Promotions & Infos</Text>
            <TouchableOpacity onPress={() => router.push('/promos' as any)}>
              <Text style={styles.seeAll}>Tout voir</Text>
            </TouchableOpacity>
          </View>
          <View>
            <ScrollView
              ref={adsRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.adsRow}
              snapToInterval={280 + 16} // width + margin
              decelerationRate="fast"
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / (280 + 16));
                setActiveAdIndex(idx);
              }}
              scrollEventThrottle={16}
            >
              {promotions.map((promo, idx) => (
                <TouchableOpacity
                  key={promo.id || idx}
                  style={styles.adWrapper}
                  activeOpacity={0.95}
                  onPress={() => handlePromoPress(promo)}
                >
                  <Image source={{ uri: promo.image_url }} style={styles.adImage} resizeMode="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.adGradient}
                  >
                    <Text style={styles.adTag}>PROMO</Text>
                    <Text style={styles.adText}>{promo.title}</Text>
                    {promo.description ? <Text style={styles.adSubText} numberOfLines={1}>{promo.description}</Text> : null}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* DOTS INDICATOR */}
            {promotions.length > 1 && (
              <View style={styles.paginationDots}>
                {promotions.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      activeAdIndex === i && styles.dotActive
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* START RIDE ACTION (Visible when route set) */}
      {origin && destination && (
        <TouchableOpacity
          style={[styles.startRideButton, (!canStartRide) && { opacity: 0.6 }]}
          disabled={!canStartRide}
          onPress={() => router.push('/screens/ride/Confirm')}
        >
          <Text style={styles.startRideButtonText}>
            {creating ? 'Préparation...' : 'Confirmer le trajet'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.white} />
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 10,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3
  },
  searchLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  searchTextContainer: {
    flex: 1,
    marginLeft: 15
  },
  searchPlaceholder: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: '#1A1D1E'
  },
  searchSubText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2
  },
  searchFilter: {
    padding: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  typeModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  typeModalTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 20,
    color: '#1A1D1E',
    marginBottom: 24,
    textAlign: 'center'
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  typeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F5F8FF',
  },
  typeIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  typeIconBgActive: {
    backgroundColor: Colors.primary,
  },
  typeText: {
    flex: 1,
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: '#4B5563'
  },
  typeTextActive: {
    color: Colors.primary
  },

  quickDestinations: {
    marginBottom: 24
  },
  homeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  homeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  homeTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: '#1A1D1E'
  },
  homeAddress: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },

  promoSection: {
    marginBottom: 30
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  sectionTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: '#1A1D1E'
  },
  seeAll: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 13,
    color: Colors.primary
  },
  adsRow: {
    gap: 16
  },
  adWrapper: {
    width: 280,
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0'
  },
  dotActive: {
    width: 16,
    backgroundColor: Colors.secondary,
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  adGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  adTag: {
    backgroundColor: Colors.secondary,
    color: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 10,
    fontFamily: Fonts.titilliumWebBold,
    alignSelf: 'flex-start',
    marginBottom: 6
  },
  adText: {
    color: Colors.white,
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
  },
  adSubText: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    marginTop: 2,
  },

  startRideButton: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary,
    paddingVertical: 15,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 40
  },
  startRideButtonText: {
    color: Colors.white,
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16
  },
});
