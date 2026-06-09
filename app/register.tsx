import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { esEmailValido, esTelefonoValido, esFechaValida, esPasswordSegura, formatearFechaInput } from '@/utils/validaciones';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/lib/supabase';
import { getPendingJoinId, setPendingJoinId } from '@/lib/pendingJoin';

const BG = require('@/assets/images/bg.png');

export default function RegisterScreen() {
  const router = useRouter();
  const setUserGenero = useUserStore(s => s.setGenero);
  const setUserNombre = useUserStore(s => s.setNombre);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fecha, setFecha] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [genero, setGenero] = useState<'masculino' | 'femenino' | 'otro' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);

  const limpiarError = (campo: string) => setErrores(e => ({ ...e, [campo]: '' }));
  const passCheck = esPasswordSegura(password);

  const validarYRegistrar = async () => {
    const nuevos: Record<string, string> = {};
    if (!nombre.trim()) nuevos.nombre = 'Ingresá tu nombre completo.';
    if (!username.trim()) nuevos.username = 'Ingresá un nombre de usuario.';
    else if (!/^[a-z0-9_]{3,20}$/.test(username)) nuevos.username = 'Solo letras minúsculas, números y _ (3 a 20 caracteres).';
    if (!email.trim()) nuevos.email = 'Ingresá tu email.';
    else if (!esEmailValido(email)) nuevos.email = 'El formato del email no es válido.';
    if (!telefono.trim()) nuevos.telefono = 'Ingresá tu número telefónico.';
    else if (!esTelefonoValido(telefono)) nuevos.telefono = 'El número no es válido.';
    if (!fecha.trim()) nuevos.fecha = 'Ingresá tu fecha de nacimiento.';
    else if (!esFechaValida(fecha)) nuevos.fecha = 'Usá el formato DD/MM/AAAA.';
    if (!password) nuevos.password = 'Ingresá una contraseña.';
    else if (!passCheck.valida) nuevos.password = 'La contraseña no cumple los requisitos.';
    if (!confirmar) nuevos.confirmar = 'Confirmá tu contraseña.';
    else if (password !== confirmar) nuevos.confirmar = 'Las contraseñas no coinciden.';
    if (!genero) nuevos.genero = 'Seleccioná tu género.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setCargando(true);
    const { data: existingUser } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
    if (existingUser) {
      setErrores({ username: 'Ese nombre de usuario ya está en uso.' });
      setCargando(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { nombre: nombre.trim(), username, telefono, fecha_nacimiento: fecha, genero } },
    });
    setCargando(false);
    if (error) { setErrores({ general: error.message }); return; }
    if (data.user) { setUserNombre(nombre.trim()); setUserGenero(genero!); }
    const pendingId = getPendingJoinId();
    if (pendingId) {
      setPendingJoinId(null);
      router.replace({ pathname: '/join/[id]', params: { id: pendingId } });
    } else {
      router.replace('/login');
    }
  };

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Crear Cuenta</Text>
            <Text style={styles.subtitle}>Completá tus datos para registrarte</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Nombre Completo</Text>
            <TextInput style={[styles.input, errores.nombre && styles.inputError]} placeholder="María González" placeholderTextColor="rgba(255,255,255,0.35)" value={nombre} onChangeText={v => { setNombre(v); limpiarError('nombre'); }} />
            {errores.nombre ? <Text style={styles.errorText}>{errores.nombre}</Text> : null}

            <Text style={styles.label}>Nombre de Usuario</Text>
            <TextInput
              style={[styles.input, errores.username && styles.inputError]}
              placeholder="mariag22"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={username}
              onChangeText={v => { setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); limpiarError('username'); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Letras minúsculas, números y _ · Sin espacios</Text>
            {errores.username ? <Text style={styles.errorText}>{errores.username}</Text> : null}

            <Text style={styles.label}>Email</Text>
            <TextInput style={[styles.input, errores.email && styles.inputError]} placeholder="ejemplo@gmail.com" placeholderTextColor="rgba(255,255,255,0.35)" value={email} onChangeText={v => { setEmail(v); limpiarError('email'); }} keyboardType="email-address" autoCapitalize="none" />
            {errores.email ? <Text style={styles.errorText}>{errores.email}</Text> : null}

            <Text style={styles.label}>Número Telefónico</Text>
            <TextInput style={[styles.input, errores.telefono && styles.inputError]} placeholder="+ 54 2154 2172" placeholderTextColor="rgba(255,255,255,0.35)" value={telefono} onChangeText={v => { setTelefono(v); limpiarError('telefono'); }} keyboardType="phone-pad" />
            {errores.telefono ? <Text style={styles.errorText}>{errores.telefono}</Text> : null}

            <Text style={styles.label}>Fecha De Nacimiento</Text>
            <TextInput style={[styles.input, errores.fecha && styles.inputError]} placeholder="DD/MM/AAAA" placeholderTextColor="rgba(255,255,255,0.35)" value={fecha} onChangeText={v => { setFecha(formatearFechaInput(v)); limpiarError('fecha'); }} keyboardType="numeric" maxLength={10} />
            {errores.fecha ? <Text style={styles.errorText}>{errores.fecha}</Text> : null}

            <Text style={styles.label}>Contraseña</Text>
            <View style={[styles.passwordContainer, errores.password && styles.inputError]}>
              <TextInput style={styles.passwordInput} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.35)" value={password} onChangeText={v => { setPassword(v); limpiarError('password'); }} secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View style={styles.passRequisitos}>
                <Text style={[styles.passReq, passCheck.longitud && styles.passReqOk]}>• Mínimo 8 caracteres</Text>
                <Text style={[styles.passReq, passCheck.mayuscula && styles.passReqOk]}>• Al menos una mayúscula</Text>
                <Text style={[styles.passReq, passCheck.numero && styles.passReqOk]}>• Al menos un número</Text>
                <Text style={[styles.passReq, passCheck.simbolo && styles.passReqOk]}>• Al menos un símbolo (!@#$...)</Text>
              </View>
            )}
            {errores.password ? <Text style={styles.errorText}>{errores.password}</Text> : null}

            <Text style={styles.label}>Confirmar Contraseña</Text>
            <View style={[styles.passwordContainer, errores.confirmar && styles.inputError]}>
              <TextInput style={styles.passwordInput} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.35)" value={confirmar} onChangeText={v => { setConfirmar(v); limpiarError('confirmar'); }} secureTextEntry={!showConfirm} />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons name={showConfirm ? 'eye-outline' : 'eye-off-outline'} size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {errores.confirmar ? <Text style={styles.errorText}>{errores.confirmar}</Text> : null}

            <Text style={styles.label}>Género</Text>
            <View style={styles.generoContainer}>
              {(['femenino', 'masculino', 'otro'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.generoBtn, genero === g && styles.generoBtnActivo]}
                  onPress={() => { setGenero(g); limpiarError('genero'); }}
                >
                  <Text style={[styles.generoBtnText, genero === g && styles.generoBtnTextActivo]}>
                    {g === 'femenino' ? '👩 Mujer' : g === 'masculino' ? '👨 Hombre' : '👤 Prefiero no decir'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errores.genero ? <Text style={styles.errorText}>{errores.genero}</Text> : null}

            {errores.general ? <Text style={[styles.errorText, { textAlign: 'center', marginTop: 8 }]}>{errores.general}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={validarYRegistrar} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Registrate</Text>}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginHint}>¿Ya tenés una cuenta? </Text>
              <TouchableOpacity onPress={() => router.replace('/login')}>
                <Text style={styles.loginLink}>Iniciá Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: { paddingTop: 70, paddingBottom: 28, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 6 },

  card: {
    backgroundColor: 'rgba(14,26,52,0.72)',
    borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32,
  },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  inputError: { borderColor: '#FF4D4D' },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  passwordInput: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
  generoContainer: { flexDirection: 'column', gap: 8, marginVertical: 8 },
  generoBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center',
  },
  generoBtnActivo: { backgroundColor: 'rgba(74,158,255,0.2)', borderColor: 'rgba(74,158,255,0.5)' },
  generoBtnText: { fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  generoBtnTextActivo: { color: '#FFFFFF', fontWeight: '700' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4 },
  passRequisitos: { marginTop: 8, gap: 2 },
  passReq: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  passReqOk: { color: '#34D399', fontWeight: '600' },
  button: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginHint: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  loginLink: { color: '#4A9EFF', fontSize: 13, fontWeight: '600' },
});
