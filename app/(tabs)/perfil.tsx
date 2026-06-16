import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConfirmPopup from '@/components/ConfirmPopup';
import { useState } from 'react';
import { useUserStore, getGeneroText } from '@/store/useUserStore';
import { useAmistadStore } from '@/store/useAmistadStore';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import { supabase } from '@/lib/supabase';
import OnboardingTour from '@/components/OnboardingTour';

const BG = require('@/assets/images/bg.png');

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const opciones: { label: string; emoji: string; icon: IoniconName; ruta: string }[] = [
  { label: 'Editar Perfil', emoji: '👤', icon: 'person-outline', ruta: '/editar-perfil' },
  { label: 'Cómo usar ChePagá', emoji: '✨', icon: 'sparkles-outline', ruta: 'tour' },
  { label: 'Seguridad', emoji: '🛡️', icon: 'shield-outline', ruta: '/seguridad' },
  { label: 'Cerrar Sesión', emoji: '🚪', icon: 'log-out-outline', ruta: 'logout' },
];

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

export default function PerfilScreen() {
  const router = useRouter();
  const nombre = useUserStore(s => s.nombre);
  const genero = useUserStore(s => s.genero);
  const reset = useUserStore(s => s.reset);
  const resetAmistades = useAmistadStore(s => s.reset);
  const desuscribir = useAmistadStore(s => s.desuscribir);
  const desuscribirNotifs = useNotificacionesStore(s => s.desuscribir);
  const resetNotifs = useNotificacionesStore(s => s.reset);
  const [popupVisible, setPopupVisible] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);

  const handleOpcion = (ruta: string | null) => {
    if (ruta === 'logout') { setPopupVisible(true); return; }
    if (ruta === 'tour') { setTourVisible(true); return; }
    if (ruta) router.push(ruta as any);
  };

  const handleLogout = async () => {
    setPopupVisible(false);
    desuscribir();
    desuscribirNotifs();
    await supabase.auth.signOut();
    reset();
    resetAmistades();
    resetNotifs();
    router.replace('/login');
  };

  const inicial = nombre ? nombre[0].toUpperCase() : '?';

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetra}>{inicial}</Text>
        </View>
        <Text style={styles.nombre}>{nombre || 'Mi perfil'}</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.menuCard}>
          {opciones.map((op, i) => (
            <View key={op.label}>
              <TouchableOpacity style={styles.opcionItem} onPress={() => handleOpcion(op.ruta)} activeOpacity={0.7}>
                <View style={styles.opcionIcono}>
                  <Ionicons name={op.icon} size={20} color="rgba(255,255,255,0.8)" />
                </View>
                <Text style={styles.opcionLabel}>{op.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
              {i < opciones.length - 1 && <View style={styles.sep} />}
            </View>
          ))}
        </View>
      </ScrollView>

      <ConfirmPopup
        visible={popupVisible}
        emoji="👋"
        titulo="¿Cerrar sesión?"
        mensaje={`¿${getGeneroText(genero, 'Segur')} que querés salir de tu cuenta?`}
        confirmText="Cerrar sesión"
        onClose={handleLogout}
        onCancel={() => setPopupVisible(false)}
      />

      <OnboardingTour visible={tourVisible} onClose={() => setTourVisible(false)} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 72, paddingHorizontal: 24, paddingBottom: 32, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 20, letterSpacing: 0.5 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(74,158,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2, borderColor: 'rgba(74,158,255,0.4)',
  },
  avatarLetra: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
  nombre: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  menuCard: {
    ...GLASS,
    overflow: 'hidden',
  },
  opcionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20 },
  opcionIcono: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(74,158,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.25)',
  },
  opcionLabel: { flex: 1, fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 16 },
});
