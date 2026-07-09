import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGruposStore } from '@/store/useGruposStore';
import GroupCard from '@/components/GroupCard';

const BG = require('@/assets/images/bg.png');

export default function MisGruposScreen() {
  const router = useRouter();
  const grupos = useGruposStore(s => s.grupos);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.title}>Mis Grupos</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {grupos.map((grupo) => (
          <GroupCard
            key={grupo.id}
            grupo={grupo}
            onPress={() => router.push({ pathname: '/detalle-grupo', params: { nombre: grupo.nombre, id: grupo.id } })}
          />
        ))}
        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: 62, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
});
