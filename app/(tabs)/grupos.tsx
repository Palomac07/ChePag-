import { ScrollView, View, Text, StyleSheet, ImageBackground } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useGruposStore } from '@/store/useGruposStore';
import { useUserStore } from '@/store/useUserStore';
import GroupCard from '@/components/GroupCard';

const BG = require('@/assets/images/bg.png');

export default function GruposScreen() {
  const router = useRouter();
  const grupos = useGruposStore(s => s.grupos);
  const cargarGrupos = useGruposStore(s => s.cargarGrupos);
  const userId = useUserStore(s => s.id);

  useFocusEffect(useCallback(() => {
    if (userId) cargarGrupos(userId);
  }, [cargarGrupos, userId]));

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Grupos</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {grupos.map((grupo) => (
          <GroupCard
            key={grupo.id}
            grupo={grupo}
            onPress={() => router.push({ pathname: '/detalle-grupo', params: { nombre: grupo.nombre, id: grupo.id } })}
          />
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 72, paddingHorizontal: 24, paddingBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
});
