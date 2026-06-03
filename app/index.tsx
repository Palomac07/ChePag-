import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store/useUserStore';
import { useGruposStore } from '@/store/useGruposStore';
import { useAmistadStore } from '@/store/useAmistadStore';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';

const SPLASH_BG = require('@/assets/images/splash-bg.jpeg');

export default function SplashScreen() {
  const router = useRouter();
  const cargarPerfil = useUserStore(s => s.cargarPerfil);
  const cargarGrupos = useGruposStore(s => s.cargarGrupos);
  const cargarAmigos = useAmistadStore(s => s.cargarAmigos);
  const cargarSolicitudes = useAmistadStore(s => s.cargarSolicitudes);
  const cargarSolicitudesEnviadas = useAmistadStore(s => s.cargarSolicitudesEnviadas);
  const suscribirRealtime = useAmistadStore(s => s.suscribirRealtime);
  const cargarNotificaciones = useNotificacionesStore(s => s.cargar);
  const suscribirNotificaciones = useNotificacionesStore(s => s.suscribir);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const { data: { session } } = await supabase.auth.getSession();
        setCargando(false);
        if (session?.user) {
          await Promise.all([
            cargarPerfil(session.user.id),
            cargarGrupos(session.user.id),
            cargarAmigos(session.user.id),
            cargarSolicitudes(session.user.id),
            cargarSolicitudesEnviadas(session.user.id),
          ]);
          suscribirRealtime(session.user.id);
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      } catch {
        setCargando(false);
        router.replace('/login');
      }
    };
    cargar();
  }, []);

  return (
    <ImageBackground source={SPLASH_BG} style={styles.container} resizeMode="cover">
      {cargando && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
