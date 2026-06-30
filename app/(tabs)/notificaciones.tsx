import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, ImageBackground } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAmistadStore } from '@/store/useAmistadStore';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/lib/supabase';

const BG = require('@/assets/images/bg.png');

const COLORES = ['#9B8EC4', '#7BC4B8', '#6BAED6', '#5BAA9F', '#C084C0', '#4A6580', '#6BAA9F'];

const iconoPorTipo: Record<string, string> = {
  amistad_aceptada: '🤝',
  gasto_nuevo: '💸',
  pago_pendiente: '💰',
  pago_confirmado: '✅',
  recordatorio_deuda: '⏰',
  presupuesto_alcanzado: '🚨',
  removido_grupo: '👋',
};

const GLASS = {
  backgroundColor: 'rgba(14,26,52,0.62)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
} as const;

export default function NotificacionesScreen() {
  const { solicitudesPendientes, solicitudesEnviadas, responderSolicitud, cargarSolicitudes, cargarSolicitudesEnviadas } = useAmistadStore();
  const { notificaciones, cargar, confirmarPago, rechazarPago, marcarTodasLeidas } = useNotificacionesStore();
  const userId = useUserStore(s => s.id);
  const miNombre = useUserStore(s => s.nombre);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (userId) {
      cargarSolicitudes(userId);
      cargarSolicitudesEnviadas(userId);
      cargar(userId).then(() => marcarTodasLeidas(userId));
    }
  }, [userId]));

  const handleResponderSolicitud = async (solicitudId: string, aceptar: boolean) => {
    setRespondiendo(solicitudId);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await responderSolicitud(solicitudId, aceptar, user.id, miNombre ?? undefined);
    setRespondiendo(null);
  };

  const handleConfirmarPago = async (notifId: string, data: any) => {
    setRespondiendo(notifId);
    await confirmarPago(notifId, data);
    setRespondiendo(null);
  };

  const handleRechazarPago = async (notifId: string) => {
    setRespondiendo(notifId);
    await rechazarPago(notifId);
    setRespondiendo(null);
  };

  const hayContenido = solicitudesPendientes.length > 0 || solicitudesEnviadas.length > 0 || notificaciones.length > 0;

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <Text style={styles.title}>Notificaciones</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!hayContenido ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitulo}>Sin notificaciones</Text>
            <Text style={styles.emptyDesc}>Acá vas a ver cuando alguien te mande una solicitud, agregue un gasto o te pague.</Text>
          </View>
        ) : (
          <>
            {solicitudesPendientes.length > 0 && (
              <>
                <Text style={styles.seccionLabel}>Solicitudes de amistad ({solicitudesPendientes.length})</Text>
                {solicitudesPendientes.map((s, i) => (
                  <View key={s.id} style={styles.card}>
                    <View style={[styles.avatarCircle, { backgroundColor: COLORES[i % COLORES.length] }]}>
                      <Text style={styles.avatarLetra}>{s.nombre_solicitante[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitulo}>{s.nombre_solicitante}</Text>
                      <Text style={styles.cardMensaje}>quiere ser tu amigo/a en ChePaga</Text>
                    </View>
                    <View style={styles.botonesRow}>
                      {respondiendo === s.id ? (
                        <ActivityIndicator color="#4A9EFF" />
                      ) : (
                        <>
                          <TouchableOpacity style={styles.btnAceptar} onPress={() => handleResponderSolicitud(s.id, true)}>
                            <Text style={styles.btnAceptarText}>✓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.btnRechazar} onPress={() => handleResponderSolicitud(s.id, false)}>
                            <Text style={styles.btnRechazarText}>✕</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            {solicitudesEnviadas.length > 0 && (
              <>
                <Text style={[styles.seccionLabel, { marginTop: 16 }]}>Solicitudes enviadas</Text>
                {solicitudesEnviadas.map((s, i) => (
                  <View key={s.id} style={styles.card}>
                    <View style={[styles.avatarCircle, { backgroundColor: COLORES[i % COLORES.length] }]}>
                      <Text style={styles.avatarLetra}>{s.nombre_receptor[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitulo}>{s.nombre_receptor}</Text>
                      <Text style={styles.cardMensaje}>Solicitud pendiente</Text>
                    </View>
                    <View style={styles.pendienteBadge}>
                      <Text style={styles.pendienteText}>⏳</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {notificaciones.length > 0 && (
              <>
                <Text style={[styles.seccionLabel, { marginTop: 16 }]}>Actividad reciente</Text>
                {notificaciones.map((n) => (
                  <View key={n.id} style={[styles.card, !n.leida && styles.cardNoLeida]}>
                    <View style={styles.iconoCircle}>
                      <Text style={styles.iconoEmoji}>{iconoPorTipo[n.tipo] ?? '🔔'}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitulo}>{n.titulo}</Text>
                      <Text style={styles.cardMensaje}>{n.mensaje}</Text>
                    </View>
                    {n.tipo === 'pago_pendiente' && !n.leida && (
                      <View style={styles.botonesRow}>
                        {respondiendo === n.id ? (
                          <ActivityIndicator color="#4A9EFF" />
                        ) : (
                          <>
                            <TouchableOpacity style={styles.btnAceptar} onPress={() => handleConfirmarPago(n.id, n.data)}>
                              <Text style={styles.btnAceptarText}>✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnRechazar} onPress={() => handleRechazarPago(n.id)}>
                              <Text style={styles.btnRechazarText}>✕</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 72, paddingHorizontal: 24, paddingBottom: 20, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitulo: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },

  seccionLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },

  card: { ...GLASS, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10 },
  cardNoLeida: { borderLeftWidth: 3, borderLeftColor: '#4A9EFF' },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarLetra: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  iconoCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(74,158,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconoEmoji: { fontSize: 22 },
  cardInfo: { flex: 1, marginRight: 8 },
  cardTitulo: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  cardMensaje: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 18 },

  botonesRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnAceptar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(52,211,153,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(52,211,153,0.5)' },
  btnAceptarText: { color: '#34D399', fontSize: 16, fontWeight: '700' },
  btnRechazar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,77,77,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,77,77,0.4)' },
  btnRechazarText: { color: '#FF4D4D', fontSize: 14, fontWeight: '700' },

  pendienteBadge: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' },
  pendienteText: { fontSize: 16 },
});
