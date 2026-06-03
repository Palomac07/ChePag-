import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ImageBackground, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store/useUserStore';
import ConfirmPopup from '@/components/ConfirmPopup';

const BG = require('@/assets/images/bg.png');
const MP_CLIENT_ID = '5984405886470464';
const SUPABASE_URL = 'https://kzbzyfdvncufrmcavtlx.supabase.co';
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/mp-callback`;

const GLASS = {
  backgroundColor: 'rgba(14,26,52,0.62)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: 20,
} as const;

export default function VincularMPScreen() {
  const router = useRouter();
  const userId = useUserStore(s => s.id);
  const cargarPerfil = useUserStore(s => s.cargarPerfil);
  const [cargando, setCargando] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; emoji: string; titulo: string; mensaje: string }>({
    visible: false, emoji: '', titulo: '', mensaje: '',
  });

  const vincular = async () => {
    setCargando(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const currentUserId = authUser?.id || userId;
      if (!currentUserId) {
        setPopup({ visible: true, emoji: '❌', titulo: 'Error', mensaje: 'No se pudo identificar tu cuenta. Cerrá sesión e intentá de nuevo.' });
        setCargando(false);
        return;
      }
      const authUrl =
        `https://auth.mercadopago.com/authorization` +
        `?client_id=${MP_CLIENT_ID}` +
        `&response_type=code` +
        `&platform_id=mp` +
        `&state=${currentUserId}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'chepaga://mp-callback');
      if (result.type !== 'success') {
        setPopup({ visible: true, emoji: '❌', titulo: 'Cancelado', mensaje: `El proceso fue cancelado (tipo: ${result.type}).` });
        setCargando(false);
        return;
      }
      const url = new URL(result.url);
      const errorParam = url.searchParams.get('error');
      const success = url.searchParams.get('success');

      if (errorParam) {
        setPopup({ visible: true, emoji: '❌', titulo: 'Error de MP', mensaje: decodeURIComponent(errorParam) });
        setCargando(false);
        return;
      }
      if (success === 'true') {
        await cargarPerfil(currentUserId);
        setPopup({ visible: true, emoji: '✅', titulo: '¡Cuenta vinculada!', mensaje: 'Tu cuenta de Mercado Pago quedó conectada a ChePaga.' });
      } else {
        setPopup({ visible: true, emoji: '❌', titulo: 'Error', mensaje: `Respuesta inesperada: ${result.url}` });
      }
    } catch (e) {
      setPopup({ visible: true, emoji: '❌', titulo: 'Error', mensaje: String(e) });
    }
    setCargando(false);
  };

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.title}>Vincular Mercado Pago</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>💳</Text>
          <Text style={styles.cardTitulo}>Conectá tu cuenta de MP</Text>
          <Text style={styles.cardDesc}>
            Al vincular tu cuenta, tus compañeros de grupo podrán pagarte directamente desde ChePaga con el monto ya cargado en Mercado Pago.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.pasosTitulo}>¿Cómo funciona?</Text>
          {['Tocás el botón de abajo', 'Iniciás sesión en Mercado Pago', 'Autorizás a ChePaga', '¡Listo! Tus compañeros ya pueden pagarte'].map((paso, i) => (
            <View key={i} style={styles.pasoRow}>
              <View style={styles.pasoNum}><Text style={styles.pasoNumText}>{i + 1}</Text></View>
              <Text style={styles.paso}>{paso}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.mpBtn} onPress={vincular} disabled={cargando}>
          {cargando
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.mpBtnText}>Vincular con Mercado Pago</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      <ConfirmPopup
        visible={popup.visible}
        emoji={popup.emoji}
        titulo={popup.titulo}
        mensaje={popup.mensaje}
        onClose={() => { setPopup(p => ({ ...p, visible: false })); if (popup.emoji === '✅') router.back(); }}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },

  card: {
    backgroundColor: 'rgba(14,26,52,0.62)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 20, marginBottom: 16,
  },
  cardTitulo: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
  cardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
  pasosTitulo: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  pasoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  pasoNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(74,158,255,0.25)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pasoNumText: { color: '#4A9EFF', fontSize: 12, fontWeight: '700' },
  paso: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20, flex: 1 },
  mpBtn: { backgroundColor: '#009EE3', borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  mpBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
