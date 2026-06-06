import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConfirmPopup from '@/components/ConfirmPopup';
import { esPasswordSegura } from '@/utils/validaciones';
import { supabase } from '@/lib/supabase';

const BG = require('@/assets/images/bg.png');

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showNueva, setShowNueva] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);

  const passCheck = esPasswordSegura(nueva);
  const limpiarError = (campo: string) => setErrores(e => ({ ...e, [campo]: '' }));

  const handleRestablecer = async () => {
    const nuevos: Record<string, string> = {};
    if (!/^\d{6}$/.test(codigo)) nuevos.codigo = 'Ingresá el código de 6 dígitos.';
    if (!nueva) nuevos.nueva = 'Ingresá la nueva contraseña.';
    else if (!passCheck.valida) nuevos.nueva = 'La contraseña no cumple los requisitos.';
    if (!confirmar) nuevos.confirmar = 'Confirmá la nueva contraseña.';
    else if (nueva !== confirmar) nuevos.confirmar = 'Las contraseñas no coinciden.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    if (!email) { setErrores({ general: 'Falta el email. Volvé al paso anterior.' }); return; }

    setGuardando(true);
    // El código de recuperación valida al usuario y abre una sesión temporal.
    const { error: otpErr } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'recovery' });
    if (otpErr) {
      setErrores({ codigo: 'El código es incorrecto o expiró. Pedí uno nuevo.' });
      setGuardando(false);
      return;
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: nueva });
    if (updErr) {
      setErrores({ general: 'No se pudo actualizar la contraseña. Intentá de nuevo.' });
      setGuardando(false);
      return;
    }
    // Cerramos la sesión temporal para que inicie sesión con la nueva contraseña.
    await supabase.auth.signOut();
    setGuardando(false);
    setPopupVisible(true);
  };

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Nueva contraseña</Text>
        <Text style={styles.subtitle}>
          Ingresá el código que te mandamos{email ? ` a ${email}` : ''} y elegí tu nueva contraseña.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Código de verificación</Text>
          <TextInput
            style={[styles.input, errores.codigo && styles.inputError, styles.codigoInput]}
            placeholder="______"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={codigo}
            onChangeText={v => { setCodigo(v.replace(/\D/g, '').slice(0, 6)); limpiarError('codigo'); }}
            keyboardType="number-pad"
            maxLength={6}
          />
          {errores.codigo ? <Text style={styles.errorText}>{errores.codigo}</Text> : null}

          <Text style={[styles.label, { marginTop: 16 }]}>Nueva contraseña</Text>
          <View style={[styles.passwordContainer, errores.nueva && styles.inputError]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={nueva}
              onChangeText={v => { setNueva(v); limpiarError('nueva'); }}
              secureTextEntry={!showNueva}
            />
            <TouchableOpacity onPress={() => setShowNueva(!showNueva)}>
              <Ionicons name={showNueva ? 'eye-outline' : 'eye-off-outline'} size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
          {nueva.length > 0 && (
            <View style={styles.passRequisitos}>
              <Text style={[styles.passReq, passCheck.longitud && styles.passReqOk]}>• Mínimo 8 caracteres</Text>
              <Text style={[styles.passReq, passCheck.mayuscula && styles.passReqOk]}>• Al menos una mayúscula</Text>
              <Text style={[styles.passReq, passCheck.numero && styles.passReqOk]}>• Al menos un número</Text>
              <Text style={[styles.passReq, passCheck.simbolo && styles.passReqOk]}>• Al menos un símbolo (!@#$...)</Text>
            </View>
          )}
          {errores.nueva ? <Text style={styles.errorText}>{errores.nueva}</Text> : null}

          <Text style={[styles.label, { marginTop: 16 }]}>Confirmar contraseña</Text>
          <TextInput
            style={[styles.input, errores.confirmar && styles.inputError]}
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={confirmar}
            onChangeText={v => { setConfirmar(v); limpiarError('confirmar'); }}
            secureTextEntry
          />
          {errores.confirmar ? <Text style={styles.errorText}>{errores.confirmar}</Text> : null}

          {errores.general ? <Text style={[styles.errorText, { textAlign: 'center', marginTop: 8 }]}>{errores.general}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleRestablecer} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Restablecer contraseña</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmPopup
        visible={popupVisible}
        emoji="🔐"
        titulo="¡Contraseña restablecida!"
        mensaje="Ya podés iniciar sesión con tu nueva contraseña."
        onClose={() => { setPopupVisible(false); router.replace('/login'); }}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 10 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 20 },

  card: {
    backgroundColor: 'rgba(14,26,52,0.72)',
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
  },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  codigoInput: { letterSpacing: 8, fontSize: 22, textAlign: 'center', fontWeight: '700' },
  inputError: { borderColor: '#FF4D4D' },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  passwordInput: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4 },
  passRequisitos: { marginTop: 8, gap: 2 },
  passReq: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  passReqOk: { color: '#34D399', fontWeight: '600' },
  button: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
