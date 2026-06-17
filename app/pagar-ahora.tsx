import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Keyboard, TouchableWithoutFeedback, ActivityIndicator, ImageBackground } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store/useUserStore';

const BG = require('@/assets/images/bg.png');

const GLASS = {
  backgroundColor: 'rgba(14,26,52,0.62)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: 16,
} as const;

export default function PagarAhoraScreen() {
  const router = useRouter();
  const { total = '0', acreedorId = '', acreedorNombre = '', deudorNombre = '', grupoId = '', grupoNombre = '' } =
    useLocalSearchParams<{ total: string; acreedorId: string; acreedorNombre: string; deudorNombre: string; grupoId: string; grupoNombre: string }>();
  const totalDeuda = Number(total);
  const userId = useUserStore(s => s.id);

  const [tipoMonto, setTipoMonto] = useState<'total' | 'eleccion' | ''>('');
  const [montoIngresado, setMontoIngresado] = useState('');
  const [error, setError] = useState('');
  const [mpVinculado, setMpVinculado] = useState<boolean | undefined>(undefined);
  const [cargando, setCargando] = useState(true);
  const [pagando, setPagando] = useState(false);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    setMpVinculado(true);
    setCargando(false);
  }, []);

  const montoFinal = tipoMonto === 'total' ? totalDeuda : Number(montoIngresado.replace(/\D/g, ''));

  const handlePagar = async () => {
    if (tipoMonto === 'eleccion') {
      if (!montoFinal || montoFinal <= 0) { setError('Ingresá un monto mayor a $0.'); return; }
      if (montoFinal > totalDeuda) { setError(`El monto no puede superar $${totalDeuda.toLocaleString('es-AR')}.`); return; }
    }
    setError('');
    setPagando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://kzbzyfdvncufrmcavtlx.supabase.co/functions/v1/mp-create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ acreedor_id: acreedorId, monto: montoFinal, descripcion: `Pago a ${acreedorNombre} - ChePaga` }),
      });
      const data = await res.json();
      if (!data.init_point) { setError(data.error ?? 'No se pudo crear el pago.'); setPagando(false); return; }

      await WebBrowser.openBrowserAsync(data.init_point);

      // Browser cerrado — esperar que MP indexe el pago y verificar
      setPagando(false);
      setVerificando(true);
      await new Promise(resolve => setTimeout(resolve, 20000));
      try {
        const verRes = await fetch('https://kzbzyfdvncufrmcavtlx.supabase.co/functions/v1/mp-verificar-pago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ preference_id: data.preference_id, acreedor_id: acreedorId }),
        });
        const verData = await verRes.json();
        if (verData.aprobado) {
          await supabase.from('notificaciones').insert({
            user_id: acreedorId,
            sender_id: userId,
            tipo: 'pago_pendiente',
            titulo: 'Confirmación de pago',
            mensaje: `${deudorNombre} dice que te pagó $${montoFinal.toLocaleString('es-AR')} en ${grupoNombre}. ¿Confirmás?`,
            data: {
              grupo_id: grupoId,
              grupo_nombre: grupoNombre,
              de_nombre: deudorNombre,
              a_nombre: acreedorNombre,
              monto: montoFinal,
              debtor_user_id: userId,
            },
          });
          router.back();
        } else {
          setError('El pago no se completó. Podés intentarlo de nuevo.');
        }
      } catch {
        setError('No se pudo verificar el pago. Revisá tu conexión.');
      }
      setVerificando(false);
    } catch {
      setError('Error al conectar. Revisá tu conexión.');
      setPagando(false);
    }
  };

  const letraAcreedor = acreedorNombre ? acreedorNombre[0].toUpperCase() : '?';
  const letraDeudor = deudorNombre ? deudorNombre[0].toUpperCase() : '?';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <Text style={styles.title}>Pagar Ahora</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.avatarRow}>
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.avatar, { backgroundColor: 'rgba(74,158,255,0.3)' }]}>
              <Text style={styles.avatarLetra}>{letraDeudor}</Text>
            </View>
            <Text style={styles.avatarNombre}>{deudorNombre}</Text>
          </View>
          <View style={styles.arrowCircle}>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.avatar, { backgroundColor: 'rgba(52,211,153,0.25)' }]}>
              <Text style={styles.avatarLetra}>{letraAcreedor}</Text>
            </View>
            <Text style={styles.avatarNombre}>{acreedorNombre}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {cargando ? (
            <ActivityIndicator color="#4A9EFF" style={{ marginTop: 40 }} />
          ) : !mpVinculado ? (
            <View style={[GLASS, { padding: 28, alignItems: 'center', marginTop: 20 }]}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>📵</Text>
              <Text style={styles.sinMPTitulo}>{acreedorNombre} no tiene Mercado Pago vinculado</Text>
              <Text style={styles.sinMPDesc}>Pedile que vincule su cuenta de MP desde su perfil en ChePaga.</Text>
            </View>
          ) : (
            <>
              <View style={[GLASS, styles.deudaCard]}>
                <Text style={styles.deudaLabel}>Total que debés</Text>
                <Text style={styles.deudaMonto}>${totalDeuda.toLocaleString('es-AR')}</Text>
              </View>

              <Text style={styles.label}>¿Cuánto pagás?</Text>

              <View style={styles.opcionesRow}>
                <TouchableOpacity
                  style={[styles.opcionBtn, tipoMonto === 'total' && styles.opcionBtnActivo]}
                  onPress={() => { setTipoMonto('total'); setError(''); }}
                >
                  <Text style={[styles.opcionBtnText, tipoMonto === 'total' && styles.opcionBtnTextActivo]}>Total de la deuda</Text>
                  <Text style={[styles.opcionBtnMonto, tipoMonto === 'total' && styles.opcionBtnTextActivo]}>${totalDeuda.toLocaleString('es-AR')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.opcionBtn, tipoMonto === 'eleccion' && styles.opcionBtnActivo]}
                  onPress={() => { setTipoMonto('eleccion'); setError(''); }}
                >
                  <Text style={[styles.opcionBtnText, tipoMonto === 'eleccion' && styles.opcionBtnTextActivo]}>Monto a elección</Text>
                  <Text style={[styles.opcionBtnMonto, tipoMonto === 'eleccion' && styles.opcionBtnTextActivo]}>Ingresá el monto</Text>
                </TouchableOpacity>
              </View>

              {tipoMonto === 'eleccion' && (
                <View style={styles.montoEleccionContainer}>
                  <TextInput
                    style={[styles.montoInput, error ? styles.montoInputError : null]}
                    placeholder="$0"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    value={montoIngresado}
                    onChangeText={(v) => { setMontoIngresado(v); setError(''); }}
                  />
                  <Text style={styles.montoHint}>Máximo: ${totalDeuda.toLocaleString('es-AR')}</Text>
                </View>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {verificando ? (
                <View style={{ alignItems: 'center', marginTop: 20, gap: 8 }}>
                  <ActivityIndicator color="#4A9EFF" />
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Verificando pago...</Text>
                </View>
              ) : tipoMonto !== '' ? (
                <TouchableOpacity style={styles.pagarBtn} onPress={handlePagar} disabled={pagando}>
                  {pagando
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.pagarText}>Pagar con Mercado Pago →</Text>
                  }
                </TouchableOpacity>
              ) : null}

              <Text style={styles.nota}>
                Se va a abrir Mercado Pago con el monto ya cargado. Confirmá el pago desde MP y después volvé acá para marcar como pagado.
              </Text>
            </>
          )}
        </View>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 24, gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarLetra: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  avatarNombre: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6, fontWeight: '500' },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 20 },
  deudaCard: { padding: 18, marginBottom: 20, alignItems: 'center' },
  deudaLabel: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 4 },
  deudaMonto: { fontSize: 32, fontWeight: '700', color: '#FF4D4D' },
  label: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 },
  opcionesRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  opcionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  opcionBtnActivo: { borderColor: 'rgba(74,158,255,0.6)', backgroundColor: 'rgba(74,158,255,0.15)' },
  opcionBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textAlign: 'center' },
  opcionBtnTextActivo: { color: '#FFFFFF' },
  opcionBtnMonto: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'center' },
  montoEleccionContainer: { marginBottom: 8 },
  montoInput: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, fontWeight: '700', color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', textAlign: 'center',
  },
  montoInputError: { borderColor: '#FF4D4D' },
  errorText: { color: '#FF4D4D', fontSize: 13, marginTop: 6, textAlign: 'center' },
  montoHint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6, textAlign: 'center' },
  pagarBtn: { backgroundColor: '#009EE3', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  pagarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  nota: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 16, lineHeight: 18 },
  sinMPTitulo: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  sinMPDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
});
