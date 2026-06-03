import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { esEmailValido } from '@/utils/validaciones';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store/useUserStore';
import { useGruposStore } from '@/store/useGruposStore';
import { useAmistadStore } from '@/store/useAmistadStore';
import { useNotificacionesStore } from '@/store/useNotificacionesStore';
import { getPendingJoinId, setPendingJoinId } from '@/lib/pendingJoin';

const BG = require('@/assets/images/bg.png');

export default function LoginScreen() {
  const router = useRouter();
  const cargarPerfil = useUserStore(s => s.cargarPerfil);
  const cargarGrupos = useGruposStore(s => s.cargarGrupos);
  const cargarAmigos = useAmistadStore(s => s.cargarAmigos);
  const cargarSolicitudes = useAmistadStore(s => s.cargarSolicitudes);
  const cargarSolicitudesEnviadas = useAmistadStore(s => s.cargarSolicitudesEnviadas);
  const suscribirRealtime = useAmistadStore(s => s.suscribirRealtime);
  const cargarNotificaciones = useNotificacionesStore(s => s.cargar);
  const suscribirNotificaciones = useNotificacionesStore(s => s.suscribir);
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);

  const resolverEmail = async (input: string): Promise<string | null> => {
    if (esEmailValido(input)) return input;
    const { data } = await supabase.rpc('get_email_by_username', { p_username: input.toLowerCase() });
    return data ?? null;
  };

  const validarYEntrar = async () => {
    const nuevos: Record<string, string> = {};
    if (!identificador.trim()) nuevos.identificador = 'Ingresá tu email o nombre de usuario.';
    if (!password) nuevos.password = 'Ingresá tu contraseña.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setCargando(true);
    try {
      const email = await resolverEmail(identificador.trim());
      if (!email) {
        setErrores({ identificador: 'No se encontró ningún usuario con ese nombre.' });
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        setErrores({ general: 'Email, usuario o contraseña incorrectos.' });
        return;
      }
      await Promise.all([
        cargarPerfil(data.session.user.id),
        cargarGrupos(data.session.user.id),
        cargarAmigos(data.session.user.id),
        cargarSolicitudes(data.session.user.id),
        cargarSolicitudesEnviadas(data.session.user.id),
      ]);
      suscribirRealtime(data.session.user.id);
      cargarNotificaciones(data.session.user.id);
      suscribirNotificaciones(data.session.user.id);
      const pendingId = getPendingJoinId();
      if (pendingId) {
        setPendingJoinId(null);
        router.replace({ pathname: '/join/[id]', params: { id: pendingId } });
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      setErrores({ general: 'No se pudo conectar. Verificá tu conexión.' });
    } finally {
      setCargando(false);
    }
  };

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.appName}>ChePagá</Text>
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Iniciá sesión para continuar</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email o nombre de usuario</Text>
            <TextInput
              style={[styles.input, errores.identificador && styles.inputError]}
              placeholder="ejemplo@gmail.com o username"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={identificador}
              onChangeText={(v) => { setIdentificador(v); setErrores(e => ({ ...e, identificador: '' })); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errores.identificador ? <Text style={styles.errorText}>{errores.identificador}</Text> : null}

            <Text style={styles.label}>Contraseña</Text>
            <View style={[styles.passwordContainer, errores.password && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrores(e => ({ ...e, password: '' })); }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {errores.password ? <Text style={styles.errorText}>{errores.password}</Text> : null}

            {errores.general ? <Text style={[styles.errorText, { textAlign: 'center', marginTop: 8 }]}>{errores.general}</Text> : null}

            <TouchableOpacity style={styles.loginButton} onPress={validarYEntrar} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Iniciar Sesión</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/forgot-password')}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerHint}>¿No tenés una cuenta? </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.registerLink}>Registrate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 40 },
  header: { paddingTop: 80, paddingBottom: 40, alignItems: 'center' },
  appName: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.45)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 },
  title: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.45)', marginTop: 6 },

  card: {
    backgroundColor: 'rgba(14,26,52,0.72)',
    borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32,
  },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  inputError: { borderColor: '#FF4D4D' },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  passwordInput: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4 },
  loginButton: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  forgotText: { textAlign: 'center', color: 'rgba(255,255,255,0.45)', marginTop: 16, fontSize: 14 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerHint: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  registerLink: { color: '#4A9EFF', fontSize: 13, fontWeight: '600' },
});
