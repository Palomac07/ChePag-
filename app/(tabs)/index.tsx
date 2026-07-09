import { useRef, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Animated, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGruposStore } from '@/store/useGruposStore';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/lib/supabase';

type ActividadItem = {
  id: string;
  nombre: string;
  fecha: string;
  monto: number;
  tipo: 'teDeben' | 'debes';
  montoUsuario: number;
  grupoId: string;
  grupoNombre: string;
};

const BG = require('@/assets/images/bg.png');

function formatFecha(iso: string): string {
  const d = new Date(iso);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${meses[d.getMonth()]} ${d.getDate()}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const grupos = useGruposStore(s => s.grupos);
  const nombre = useUserStore(s => s.nombre);
  const gruposActivos = grupos.filter(g => g.activo);
  const totalTeDeben = gruposActivos.reduce((sum, g) => sum + g.teDebenNum, 0);
  const totalDebes = gruposActivos.reduce((sum, g) => sum + g.debesNum, 0);
  const balanceTotal = totalTeDeben - totalDebes;

  const [actividad, setActividad] = useState<ActividadItem[]>([]);
  const userId = useUserStore(s => s.id);

  useEffect(() => {
    if (!grupos.length || !userId) return;
    const grupoIds = grupos.map(g => g.id);
    supabase
      .from('gastos')
      .select('*')
      .in('grupo_id', grupoIds)
      .order('fecha', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!data) return;
        const items: ActividadItem[] = [];
        for (const g of data) {
          const participantes: string[] = Array.isArray(g.participantes)
            ? g.participantes.map((p: any) => (typeof p === 'string' ? p : p.nombre))
            : [];
          const esPagador = g.pagador_id === userId || g.pagador === nombre || g.pagador_nombre === nombre;
          const esParticipante = nombre ? participantes.includes(nombre) : false;
          if (!esPagador && !esParticipante) continue;
          const parte = participantes.length > 0 ? g.monto / participantes.length : g.monto;
          const grupoNombre = grupos.find(gr => gr.id === g.grupo_id)?.nombre ?? 'Grupo';
          if (esPagador && participantes.length > 1) {
            items.push({ id: g.id, nombre: g.nombre, fecha: g.fecha, monto: g.monto, tipo: 'teDeben', montoUsuario: Math.round(g.monto - parte), grupoId: g.grupo_id, grupoNombre });
          } else if (!esPagador && esParticipante) {
            items.push({ id: g.id, nombre: g.nombre, fecha: g.fecha, monto: g.monto, tipo: 'debes', montoUsuario: Math.round(parte), grupoId: g.grupo_id, grupoNombre });
          }
          if (items.length >= 5) break;
        }
        setActividad(items);
      });
  }, [grupos, userId, nombre]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  return (
    <ImageBackground
      source={BG}
      style={styles.root}
      resizeMode="cover"
      imageStyle={{ transform: [{ scale: 1.08 }] }}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.bienvenido}>Bienvenido</Text>
          <Text style={styles.nombre}>Hola, {nombre.split(' ')[0] || '...'}</Text>
        </View>

        {/* Balance */}
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Balance Total</Text>
          <Text style={[styles.balanceMonto, balanceTotal < 0 && { color: '#FF4D4D' }]}>
            ${Math.abs(balanceTotal).toLocaleString('es-AR')}
          </Text>
        </View>

        {/* Metrics card */}
        <View style={styles.card}>
          <View style={styles.metricsInner}>
            <View style={styles.metricsLeft}>
              <Ionicons name="people-outline" size={30} color="rgba(255,255,255,0.65)" />
              <Text style={styles.metricsCount}>{gruposActivos.length}</Text>
              <Text style={styles.metricsLabel}>{'Grupos\nActivos'}</Text>
            </View>
            <View style={styles.metricsDivider} />
            <View style={styles.metricsRight}>
              <View style={styles.metricsRow}>
                <Ionicons name="trending-up-outline" size={16} color="rgba(255,255,255,0.5)" />
                <View style={styles.metricsRowTexts}>
                  <Text style={styles.metricsRowLabel}>Te deben</Text>
                  <Text style={styles.metricsRowMonto}>
                    ${totalTeDeben.toLocaleString('es-AR')}
                  </Text>
                </View>
              </View>
              <View style={styles.metricsRowSep} />
              <View style={styles.metricsRow}>
                <Ionicons name="trending-down-outline" size={16} color="rgba(255,255,255,0.5)" />
                <View style={styles.metricsRowTexts}>
                  <Text style={styles.metricsRowLabel}>Debes</Text>
                  <Text style={[styles.metricsRowMonto, { color: '#FF4D4D' }]}>
                    -${totalDebes.toLocaleString('es-AR')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Actividad Reciente */}
        <View style={styles.actividadSection}>
          <Text style={styles.sectionTitle}>Actividad Reciente</Text>
          <ScrollView
            style={styles.actividadScroll}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            endFillColor="transparent"
            contentContainerStyle={styles.actividadScrollContent}
          >
            {actividad.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Ionicons name="receipt-outline" size={28} color="rgba(255,255,255,0.25)" />
                <Text style={styles.emptyText}>Sin actividad reciente</Text>
              </View>
            ) : (
              actividad.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.actividadCard}
                  activeOpacity={0.75}
                  onPress={() => router.push({ pathname: '/detalle-grupo', params: { id: item.grupoId, nombre: item.grupoNombre } })}
                >
                  <View style={styles.actividadIcono}>
                    <Ionicons name="receipt-outline" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.actividadInfo}>
                    <Text style={styles.actividadNombre}>{item.nombre}</Text>
                    <Text style={styles.actividadGrupo}>{item.grupoNombre}</Text>
                    <Text style={styles.actividadFecha}>{formatFecha(item.fecha)}</Text>
                  </View>
                  <View style={styles.actividadDerecha}>
                    <Text style={[styles.actividadTipo, item.tipo === 'teDeben' ? styles.tipoTeDeben : styles.tipoDebes]}>
                      {item.tipo === 'teDeben' ? 'Te deben' : 'Debes'}
                    </Text>
                    <Text style={[styles.actividadMonto, item.tipo === 'debes' && { color: '#FF4D4D' }]}>
                      {item.tipo === 'debes' ? '-' : ''}${item.montoUsuario.toLocaleString('es-AR')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

      </Animated.View>
    </ImageBackground>
  );
}

const GLASS = {
  backgroundColor: 'rgba(14,26,52,0.62)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.45,
  shadowRadius: 18,
} as const;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingTop: 72, paddingHorizontal: 24, paddingBottom: 115 },
  actividadSection: { flex: 1, minHeight: 0 },
  actividadScroll: { flex: 1 },
  actividadScrollContent: { paddingBottom: 24 },
  chipsScroll: { marginBottom: 0 },

  header: { marginBottom: 28 },
  bienvenido: { fontSize: 34, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  nombre: { fontSize: 16, color: 'rgba(255,255,255,0.52)', marginTop: 4 },

  balanceRow: { alignItems: 'center', marginBottom: 28 },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.48)', marginBottom: 6 },
  balanceMonto: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },

  card: { ...GLASS, marginBottom: 28 },
  metricsInner: { flexDirection: 'row', alignItems: 'center', padding: 22 },
  metricsLeft: { flex: 1, alignItems: 'center', gap: 6 },
  metricsCount: { fontSize: 30, fontWeight: '700', color: '#FFFFFF' },
  metricsLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 18 },
  metricsDivider: { width: 1, height: 68, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 22 },
  metricsRight: { flex: 2 },
  metricsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  metricsRowTexts: { flex: 1 },
  metricsRowLabel: { fontSize: 12, color: 'rgba(255,255,255,0.48)' },
  metricsRowMonto: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  metricsRowSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.09)' },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 12 },
  verTodos: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },

  emptyCard: { flexDirection: 'column', alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.32)' },

  actividadCard: {
    ...GLASS,
    flexDirection: 'row', alignItems: 'center',
    padding: 14, marginBottom: 10, borderRadius: 16,
  },
  actividadIcono: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(74,158,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.25)',
  },
  actividadInfo: { flex: 1 },
  actividadNombre: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  actividadGrupo: { fontSize: 11, color: '#4A9EFF', marginTop: 1, fontWeight: '500' },
  actividadFecha: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  actividadDerecha: { alignItems: 'flex-end' },
  actividadTipo: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  tipoTeDeben: { color: 'rgba(255,255,255,0.55)' },
  tipoDebes: { color: 'rgba(255,100,100,0.8)' },
  actividadMonto: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  chip: {
    ...GLASS,
    borderRadius: 50,
    paddingHorizontal: 20, paddingVertical: 11,
    marginRight: 10, marginBottom: 0,
    shadowOpacity: 0.2,
  },
  chipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  emptyChips: { color: 'rgba(255,255,255,0.3)', fontSize: 14, paddingVertical: 10 },
});
