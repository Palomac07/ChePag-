import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useGruposStore } from '@/store/useGruposStore';
import { useUserStore } from '@/store/useUserStore';

const BG = require('@/assets/images/bg.png');

const GLASS = {
  backgroundColor: 'rgba(14,26,52,0.62)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 16,
} as const;

export default function GruposScreen() {
  const router = useRouter();
  const grupos = useGruposStore(s => s.grupos);
  const cargarGrupos = useGruposStore(s => s.cargarGrupos);
  const userId = useUserStore(s => s.id);

  useFocusEffect(useCallback(() => {
    if (userId) cargarGrupos(userId);
  }, [userId]));

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Grupos</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {grupos.map((grupo) => (
          <TouchableOpacity
            key={grupo.id}
            style={[styles.card, !grupo.activo && styles.cardPausado]}
            onPress={() => router.push({ pathname: '/detalle-grupo', params: { nombre: grupo.nombre, id: grupo.id } })}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              {grupo.fotoUrl ? <Image source={{ uri: grupo.fotoUrl }} style={styles.cardPhoto} contentFit="cover" /> : null}
              <View style={{ flex: 1 }}>
                <Text style={[styles.grupoNombre, !grupo.activo && styles.textMuted]}>{grupo.nombre}</Text>
                <Text style={styles.grupoParticipantes}>{grupo.participantes} participantes</Text>
                <View style={styles.avatarRow}>
                  {grupo.avatares.map((letra, i) => (
                    <View key={i} style={[styles.avatar, { backgroundColor: grupo.colores[i], marginLeft: i > 0 ? -8 : 0 }]}>
                      <Text style={styles.avatarText}>{letra}</Text>
                    </View>
                  ))}
                  {grupo.extras > 0 && (
                    <View style={[styles.avatar, { backgroundColor: 'rgba(74,158,255,0.55)', marginLeft: -8 }]}>
                      <Text style={styles.avatarText}>+{grupo.extras}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.badgesCol}>
                <View style={[styles.badge, grupo.activo ? styles.badgeActivo : styles.badgePausado]}>
                  <Text style={[styles.badgeText, grupo.activo ? styles.badgeTextActivo : styles.badgeTextPausado]}>
                    {grupo.activo ? 'Activo' : 'Pausado'}
                  </Text>
                </View>
                {grupo.saldado && (
                  <View style={[styles.badge, styles.badgeActivo]}>
                    <Text style={[styles.badgeText, styles.badgeTextActivo]}>Saldado</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total gastado</Text>
                <Text style={[styles.statValor, !grupo.activo && styles.textMuted]}>{grupo.totalGastado}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Te deben</Text>
                <Text style={[styles.statValor, !grupo.activo && styles.textMuted]}>{grupo.teDeben}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Debes</Text>
                <Text style={[styles.statValor, !grupo.activo && styles.textMuted]}>{grupo.debes}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 72, paddingHorizontal: 24, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  card: { ...GLASS, padding: 20, marginBottom: 16 },
  cardPausado: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  cardPhoto: { width: 58, height: 58, borderRadius: 16, marginRight: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },

  grupoNombre: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  grupoParticipantes: { fontSize: 13, color: 'rgba(255,255,255,0.42)', marginTop: 3 },
  textMuted: { color: 'rgba(255,255,255,0.35)' },

  avatarRow: { flexDirection: 'row', marginTop: 12 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(5,8,22,0.8)' },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  badgesCol: { flexDirection: 'column', gap: 6, alignItems: 'flex-end' },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeActivo: { backgroundColor: 'rgba(52,211,153,0.18)' },
  badgePausado: { backgroundColor: 'rgba(180,120,20,0.22)' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextActivo: { color: '#34D399' },
  badgeTextPausado: { color: '#F59E0B' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 14 },
  statItem: {},
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.38)' },
  statValor: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginTop: 3 },
});
