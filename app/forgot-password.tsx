import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { esEmailValido } from '@/utils/validaciones';
import { supabase } from '@/lib/supabase';

const BG = require('@/assets/images/bg.png');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSiguiente = async () => {
    if (!email.trim()) { setError('Ingresá tu email.'); return; }
    if (!esEmailValido(email)) { setError('El formato del email no es válido.'); return; }
    setError('');
    setEnviando(true);
    const correo = email.trim().toLowerCase();
    const { error: err } = await supabase.auth.resetPasswordForEmail(correo);
    setEnviando(false);
    if (err) {
      setError('No se pudo enviar el email. Esperá unos minutos e intentá de nuevo.');
      return;
    }
    // Por seguridad Supabase no revela si el email existe: siempre vamos al paso del código.
    router.push({ pathname: '/reset-password', params: { email: correo } });
  };

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>¿Olvidaste tu{'\n'}contraseña?</Text>
        <Text style={styles.subtitle}>Te mandamos un código de 6 dígitos a tu email para restablecerla.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholder="ejemplo@gmail.com"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={email}
            onChangeText={v => { setEmail(v); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleSiguiente} disabled={enviando}>
            {enviando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Enviar código</Text>}
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerHint}>¿No tenés una cuenta? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>Registrate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
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
  inputError: { borderColor: '#FF4D4D' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4 },
  button: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerHint: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  registerLink: { color: '#4A9EFF', fontSize: 13, fontWeight: '600' },
});
