import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ImageBackground, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store/useUserStore';
import ConfirmPopup from '@/components/ConfirmPopup';

const BG = require('@/assets/images/bg.png');
const MP_CLIENT_ID = '5984405886470464';
const SUPABASE_URL = 'https://kzbzyfdvncufrmcavtlx.supabase.co';
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/mp-callback`;

const SELLER = {
  title: 'Cuenta vendedora',
  use: 'Para revisar cobros / plata recibida',
  username: 'TESTUSER2549126361532013130',
  password: 'MXaPfGaTGb',
};

const BUYER = {
  title: 'Cuenta compradora',
  use: 'Para pagar en el checkout sandbox',
  username: 'TESTUSER8912732514848919820',
  password: 'BoBTDsaSlK',
};

export default function VincularMPScreen() {
  const router = useRouter();
  const userId = useUserStore(s => s.id);
  const cargarPerfil = useUserStore(s => s.cargarPerfil);
  const [cargando, setCargando] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; titulo: string; mensaje: string }>({
    visible: false,
    titulo: '',
    mensaje: '',
  });

  const showPopup = (titulo: string, mensaje: string) => {
    setPopup({ visible: true, titulo, mensaje });
  };

  const copiar = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    showPopup('Copiado', `${label} copiado al portapapeles.`);
  };

  const vincular = async () => {
    setCargando(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const currentUserId = authUser?.id || userId;
      if (!currentUserId) {
        showPopup('Error', 'No se pudo identificar tu cuenta. Cerra sesion e intenta de nuevo.');
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
        showPopup('Cancelado', `El proceso fue cancelado (tipo: ${result.type}).`);
        setCargando(false);
        return;
      }

      const url = new URL(result.url);
      const errorParam = url.searchParams.get('error');
      const success = url.searchParams.get('success');

      if (errorParam) {
        showPopup('Error de MP', decodeURIComponent(errorParam));
        setCargando(false);
        return;
      }

      if (success === 'true') {
        await cargarPerfil(currentUserId);
        showPopup('Cuenta vinculada', 'Tu cuenta de Mercado Pago quedo conectada a ChePaga.');
      } else {
        showPopup('Error', `Respuesta inesperada: ${result.url}`);
      }
    } catch (e) {
      showPopup('Error', String(e));
    }
    setCargando(false);
  };

  const CredentialCard = ({ account }: { account: typeof SELLER }) => (
    <View style={styles.card}>
      <Text style={styles.pasosTitulo}>{account.title}</Text>
      <Text style={styles.cardDescLeft}>{account.use}</Text>
      <CopyRow label="Usuario" value={account.username} onCopy={copiar} />
      <CopyRow label="Contrasena" value={account.password} onCopy={copiar} />
    </View>
  );

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.title}>Mercado Pago Sandbox</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Ionicons name="card-outline" size={44} color="#4A9EFF" style={{ marginBottom: 12 }} />
          <Text style={styles.cardTitulo}>Cuentas de prueba</Text>
          <Text style={styles.cardDesc}>
            Usa comprador para pagar. Usa vendedor para revisar la plata recibida. Podes copiar cada dato y pegarlo en Mercado Pago.
          </Text>
        </View>

        <CredentialCard account={BUYER} />
        <CredentialCard account={SELLER} />

        <View style={styles.card}>
          <Text style={styles.pasosTitulo}>Vincular Mercado Pago</Text>
          <Text style={styles.cardDescLeft}>
            Si queres probar el flujo anterior de vinculacion por usuario, toca el boton e inicia sesion en Mercado Pago.
          </Text>
          <TouchableOpacity style={styles.mpBtn} onPress={vincular} disabled={cargando}>
            {cargando
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.mpBtnText}>Vincular con Mercado Pago</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.nota}>
          En el flujo sandbox compartido, los pagos de ChePaga se crean con la cuenta vendedora fija configurada en Supabase.
        </Text>
      </ScrollView>

      <ConfirmPopup
        visible={popup.visible}
        emoji=""
        titulo={popup.titulo}
        mensaje={popup.mensaje}
        onClose={() => {
          const wasLinked = popup.titulo === 'Cuenta vinculada';
          setPopup(p => ({ ...p, visible: false }));
          if (wasLinked) router.back();
        }}
      />
    </ImageBackground>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: (label: string, value: string) => void }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} selectable>{value}</Text>
      </View>
      <TouchableOpacity style={styles.copyBtn} onPress={() => onCopy(label, value)}>
        <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    marginBottom: 16,
  },
  cardTitulo: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
  cardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20 },
  cardDescLeft: { fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 20, marginBottom: 16 },
  pasosTitulo: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  infoRow: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: { flex: 1 },
  infoLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 4 },
  infoValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  copyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74,158,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mpBtn: { backgroundColor: '#009EE3', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  mpBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  nota: { fontSize: 12, color: 'rgba(255,255,255,0.42)', textAlign: 'center', lineHeight: 18 },
});
