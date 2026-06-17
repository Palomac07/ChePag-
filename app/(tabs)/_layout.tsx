import { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PagerView from '@/components/PagerViewCompat';
import { useRouter } from 'expo-router';
import { useAmistadStore } from '@/store/useAmistadStore';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import { useGruposStore } from '@/store/useGruposStore';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TourProvider, useTour, useTourTarget } from '@/components/tour/TourProvider';

import HomeScreen from './index';
import GruposScreen from './grupos';
import NotificacionesScreen from './notificaciones';
import PerfilScreen from './perfil';

const TOUR_SEEN_KEY = 'chepaga_tour_seen';
const RECORDATORIO_DEUDA_MS = 24 * 60 * 60 * 1000;

const PAGES = [
  { key: 'home', component: HomeScreen },
  { key: 'grupos', component: GruposScreen },
  { key: 'notificaciones', component: NotificacionesScreen },
  { key: 'perfil', component: PerfilScreen },
];

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { key: string; icon: IoniconName; iconActive: IoniconName; pageIdx: number }[] = [
  { key: 'home', icon: 'home-outline', iconActive: 'home', pageIdx: 0 },
  { key: 'grupos', icon: 'people-outline', iconActive: 'people', pageIdx: 1 },
  { key: 'agregar', icon: 'add', iconActive: 'add', pageIdx: -1 },
  { key: 'notificaciones', icon: 'notifications-outline', iconActive: 'notifications', pageIdx: 2 },
  { key: 'perfil', icon: 'person-outline', iconActive: 'person', pageIdx: 3 },
];

export default function TabLayout() {
  return (
    <TourProvider>
      <TabsContent />
    </TourProvider>
  );
}

function TabsContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [accionesVisible, setAccionesVisible] = useState(false);

  const { startTour } = useTour();
  const tourRefs = {
    home: useTourTarget('tab-home'),
    grupos: useTourTarget('tab-grupos'),
    agregar: useTourTarget('tab-add'),
    notificaciones: useTourTarget('tab-notifs'),
    perfil: useTourTarget('tab-perfil'),
  } as Record<string, (node: any) => void>;

  useEffect(() => {
    AsyncStorage.getItem(TOUR_SEEN_KEY).then(visto => {
      if (!visto) {
        startTour();
        AsyncStorage.setItem(TOUR_SEEN_KEY, '1');
      }
    });
  }, [startTour]);

  const cantidadSolicitudes = useAmistadStore(s => s.solicitudesPendientes.length);
  const cantidadNotifs = useNotificacionesStore(s => s.notificaciones.filter(n => !n.leida).length);
  const totalBadge = cantidadSolicitudes + cantidadNotifs;
  const grupos = useGruposStore(s => s.grupos);
  const userId = useUserStore(s => s.id);

  useEffect(() => {
    if (!userId || grupos.length === 0) return;

    const ahora = Date.now();
    const gruposConDeuda = grupos.filter(g => g.activo && g.debesNum > 0);
    if (gruposConDeuda.length === 0) return;

    Promise.all(gruposConDeuda.map(async (g) => {
      const key = `ultimo_recordatorio_deuda:${userId}:${g.id}`;
      const ultimo = await AsyncStorage.getItem(key);
      const ultimoMs = ultimo ? Number(ultimo) : 0;

      if (ultimoMs && ahora - ultimoMs < RECORDATORIO_DEUDA_MS) return null;

      await AsyncStorage.setItem(key, String(ahora));
      return {
        user_id: userId,
        tipo: 'recordatorio_deuda',
        titulo: 'Deuda pendiente',
        mensaje: `Todavia debes $${g.debesNum.toLocaleString('es-AR')} en ${g.nombre}. No te olvides de saldarlo.`,
        data: { grupo_id: g.id, grupo_nombre: g.nombre, monto: g.debesNum },
      };
    })).then(async (recordatorios) => {
      const nuevos = recordatorios.filter(Boolean);
      if (nuevos.length > 0) {
        await supabase.from('notificaciones').insert(nuevos);
      }
    });
  }, [userId, grupos]);

  const goTo = (idx: number) => {
    pagerRef.current?.setPage(idx);
    setActiveIdx(idx);
  };

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={e => setActiveIdx(e.nativeEvent.position)}
      >
        {PAGES.map((page) => (
          <View key={page.key} style={styles.page}>
            <page.component />
          </View>
        ))}
      </PagerView>

      <View style={[styles.tabBarWrap, { bottom: 20 + insets.bottom }]}>
        <View style={styles.tabBarInner}>
          {TABS.map(tab => {
            const isActive = tab.pageIdx === activeIdx;
            const isAdd = tab.key === 'agregar';
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                activeOpacity={0.7}
                onPress={() => {
                  if (isAdd) {
                    setAccionesVisible(true);
                    return;
                  }
                  goTo(tab.pageIdx);
                }}
              >
                {isAdd ? (
                  <View ref={tourRefs[tab.key]} style={styles.plusBtn}>
                    <Ionicons name="add" size={26} color="#FFFFFF" />
                  </View>
                ) : (
                  <View ref={tourRefs[tab.key]} style={styles.tabIconWrap}>
                    <Ionicons
                      name={isActive ? tab.iconActive : tab.icon}
                      size={24}
                      color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.38)'}
                    />
                    {tab.key === 'notificaciones' && totalBadge > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{totalBadge}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Modal transparent animationType="fade" visible={accionesVisible} onRequestClose={() => setAccionesVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAccionesVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitulo}>Que queres hacer?</Text>
            <TouchableOpacity style={styles.accionItem} onPress={() => { setAccionesVisible(false); router.push('/crear-grupo'); }}>
              <View style={styles.accionIconWrap}>
                <Ionicons name="people-outline" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.accionLabel}>Nuevo grupo</Text>
                <Text style={styles.accionDesc}>Crea un grupo para dividir gastos</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.accionSep} />
            <TouchableOpacity style={styles.accionItem} onPress={() => { setAccionesVisible(false); router.push('/agregar-gasto'); }}>
              <View style={styles.accionIconWrap}>
                <Ionicons name="card-outline" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.accionLabel}>Nuevo gasto</Text>
                <Text style={styles.accionDesc}>Registra un gasto en un grupo</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.accionSep} />
            <TouchableOpacity style={styles.accionItem} onPress={() => { setAccionesVisible(false); router.push('/amigos'); }}>
              <View style={styles.accionIconWrap}>
                <Ionicons name="person-add-outline" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.accionLabel}>Nuevo amigo</Text>
                <Text style={styles.accionDesc}>Busca y agrega amigos a ChePaga</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050816' },
  pager: { flex: 1 },
  page: { flex: 1 },

  tabBarWrap: {
    position: 'absolute', left: 20, right: 20,
    borderRadius: 30,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 20,
    overflow: 'hidden',
  },
  tabBarInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(8,16,36,0.88)',
    paddingVertical: 13, paddingHorizontal: 8,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 2 },
  tabIconWrap: { alignItems: 'center', justifyContent: 'center' },
  plusBtn: {
    backgroundColor: 'rgba(74,158,255,0.28)',
    borderRadius: 22, width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.45)',
  },
  badge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: '#FF4D4D', borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(8,18,40,0.97)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitulo: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.38)', marginBottom: 20, textAlign: 'center', letterSpacing: 0.5 },
  accionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  accionIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(74,158,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.25)',
  },
  accionLabel: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  accionDesc: { fontSize: 13, color: 'rgba(255,255,255,0.42)', marginTop: 2 },
  accionSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
});
