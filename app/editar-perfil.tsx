import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConfirmPopup from '@/components/ConfirmPopup';
import { esTelefonoValido, esFechaValida, formatearFechaInput } from '@/utils/validaciones';
import SwipeBackWrapper from '@/components/SwipeBackWrapper';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/lib/supabase';
import { firstName, firstNameOr } from '@/lib/displayName';

const BG = require('@/assets/images/bg.png');

export default function EditarPerfilScreen() {
  const router = useRouter();
  const cargarPerfil = useUserStore(s => s.cargarPerfil);
  const storeNombre = useUserStore(s => s.nombre);
  const storeUsername = useUserStore(s => s.username);
  const storeTelefono = useUserStore(s => s.telefono);
  const storeFechaNacimiento = useUserStore(s => s.fechaNacimiento);
  const storeGenero = useUserStore(s => s.genero);
  const storeEmail = useUserStore(s => s.email);

  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState('');
  const [genero, setGenero] = useState<'masculino' | 'femenino' | 'otro' | null>(null);
  const [mail, setMail] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [popupVisible, setPopupVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [mpVinculado, setMpVinculado] = useState(true);
  const [desvinculando, setDesvinculando] = useState(false);
  const [popupDesvincular, setPopupDesvincular] = useState(false);

  const aplicarDatosGuardados = useCallback((datos: {
    nombre?: string | null;
    username?: string | null;
    telefono?: string | null;
    fecha_nacimiento?: string | null;
    genero?: 'masculino' | 'femenino' | 'otro' | null;
    email?: string | null;
  }) => {
    setNombre(datos.nombre ?? '');
    setUsername(datos.username ?? '');
    setNumero(datos.telefono ?? '');
    setFecha(datos.fecha_nacimiento ?? '');
    setGenero(datos.genero ?? null);
    if (datos.email) setMail(datos.email);
  }, []);

  useEffect(() => {
    aplicarDatosGuardados({
      nombre: storeNombre,
      username: storeUsername,
      telefono: storeTelefono,
      fecha_nacimiento: storeFechaNacimiento,
      genero: storeGenero,
      email: storeEmail,
    });
  }, [aplicarDatosGuardados, storeEmail, storeFechaNacimiento, storeGenero, storeNombre, storeTelefono, storeUsername]);

  const cargarDatos = useCallback(async () => {
    setCargandoPerfil(true);
    aplicarDatosGuardados({
      nombre: storeNombre,
      username: storeUsername,
      telefono: storeTelefono,
      fecha_nacimiento: storeFechaNacimiento,
      genero: storeGenero,
      email: storeEmail,
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCargandoPerfil(false); return; }
    if (user.email) setMail(user.email);
    const { data, error } = await supabase
      .from('profiles')
      .select('nombre, username, telefono, fecha_nacimiento, genero, mp_user_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data) {
      aplicarDatosGuardados({ ...data, email: user.email });
      setMpVinculado(!!data.mp_user_id);
    }
    setCargandoPerfil(false);
  }, [aplicarDatosGuardados, storeEmail, storeFechaNacimiento, storeGenero, storeNombre, storeTelefono, storeUsername]);

  useFocusEffect(useCallback(() => { cargarDatos(); }, [cargarDatos]));

  const limpiarError = (campo: string) => setErrores(e => ({ ...e, [campo]: '' }));

  const handleActualizar = async () => {
    const nuevos: Record<string, string> = {};
    if (!nombre.trim()) nuevos.nombre = 'El nombre no puede estar vacío.';
    if (!username.trim()) nuevos.username = 'El nombre de usuario no puede estar vacío.';
    else if (!/^[a-z0-9_]{3,20}$/.test(username)) nuevos.username = 'Solo letras minúsculas, números y _ (3 a 20 caracteres).';
    if (!numero.trim()) nuevos.numero = 'Ingresá tu número.';
    else if (!esTelefonoValido(numero)) nuevos.numero = 'El número no es válido.';
    if (fecha && !esFechaValida(fecha)) nuevos.fecha = 'Usá el formato DD/MM/AAAA.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).neq('id', user.id).maybeSingle();
      if (existing) {
        setErrores({ username: 'Ese nombre de usuario ya está en uso.' });
        setGuardando(false);
        return;
      }
      const { error } = await supabase.from('profiles').update({
        nombre: nombre.trim(), username, telefono: numero,
        fecha_nacimiento: fecha || null, genero: genero || null,
      }).eq('id', user.id);

      if (!error) {
        await cargarPerfil(user.id);
        setPopupVisible(true);
      } else {
        setErrores({ general: 'No se pudo guardar. Intentá de nuevo.' });
      }
    }
    setGuardando(false);
  };

  const handleDesvincular = async () => {
    setDesvinculando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({
        mp_access_token: null, mp_refresh_token: null, mp_user_id: null,
      }).eq('id', user.id);
      setMpVinculado(false);
    }
    setDesvinculando(false);
    setPopupDesvincular(false);
  };

  const inicial = firstName(nombre)[0]?.toUpperCase() ?? '?';

  return (
    <SwipeBackWrapper>
      <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Editar Perfil</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetra}>{inicial}</Text>
              </View>
              <Text style={styles.nombre}>{firstNameOr(nombre, 'Mi perfil')}</Text>
              {username ? <Text style={styles.usernameLabel}>@{username}</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.seccionTitulo}>Información personal</Text>

              <Text style={styles.label}>Nombre completo</Text>
              <TextInput style={[styles.input, errores.nombre && styles.inputError]} value={nombre} onChangeText={v => { setNombre(v); limpiarError('nombre'); }} placeholder="Nombre completo" placeholderTextColor="rgba(255,255,255,0.35)" />
              {errores.nombre ? <Text style={styles.errorText}>{errores.nombre}</Text> : null}

              <Text style={styles.label}>Nombre de usuario</Text>
              <TextInput
                style={[styles.input, errores.username && styles.inputError]}
                value={username}
                onChangeText={v => { setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); limpiarError('username'); }}
                placeholder="mariag22"
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hint}>Letras minúsculas, números y _ · Sin espacios</Text>
              {errores.username ? <Text style={styles.errorText}>{errores.username}</Text> : null}

              <Text style={styles.label}>Teléfono</Text>
              <TextInput style={[styles.input, errores.numero && styles.inputError]} value={numero} onChangeText={v => { setNumero(v); limpiarError('numero'); }} placeholder="+54 11 1234 5678" placeholderTextColor="rgba(255,255,255,0.35)" keyboardType="phone-pad" />
              {errores.numero ? <Text style={styles.errorText}>{errores.numero}</Text> : null}

              <Text style={styles.label}>Fecha de nacimiento</Text>
              <TextInput style={[styles.input, errores.fecha && styles.inputError]} value={fecha} onChangeText={v => { setFecha(formatearFechaInput(v)); limpiarError('fecha'); }} placeholder="DD/MM/AAAA" placeholderTextColor="rgba(255,255,255,0.35)" keyboardType="numeric" maxLength={10} />
              {errores.fecha ? <Text style={styles.errorText}>{errores.fecha}</Text> : null}

              <Text style={styles.label}>Género</Text>
              <View style={styles.generoContainer}>
                {(['femenino', 'masculino', 'otro'] as const).map((g) => (
                  <TouchableOpacity key={g} style={[styles.generoBtn, genero === g && styles.generoBtnActivo]} onPress={() => setGenero(g)}>
                    <Text style={[styles.generoBtnText, genero === g && styles.generoBtnTextActivo]}>
                      {g === 'femenino' ? '👩 Mujer' : g === 'masculino' ? '👨 Hombre' : '👤 Prefiero no decir'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.seccionTitulo}>Cuenta</Text>

              <Text style={styles.label}>Mercado Pago</Text>
              {mpVinculado ? (
                <View>
                  <View style={styles.mpVinculadoBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                    <Text style={styles.mpVinculadoText}>Cuenta vinculada correctamente</Text>
                  </View>
                  <TouchableOpacity style={styles.mpDesvinculaBtn} onPress={() => setPopupDesvincular(true)}>
                    <Text style={styles.mpDesvinculaBtnText}>Desvincular cuenta</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.mpBtn} onPress={() => router.push('/vincular-mp')}>
                    <Text style={styles.mpBtnText}>💳  Vincular cuenta de Mercado Pago</Text>
                  </TouchableOpacity>
                  <Text style={styles.hint}>Necesario para recibir pagos directamente desde la app.</Text>
                </>
              )}

              <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
              <View style={styles.inputReadOnly}>
                <Text style={styles.inputReadOnlyText}>{mail || '...'}</Text>
              </View>
              <Text style={styles.hint}>El email no se puede cambiar desde aquí.</Text>
            </View>

            {errores.general ? <Text style={[styles.errorText, { textAlign: 'center', marginTop: 8 }]}>{errores.general}</Text> : null}

            <TouchableOpacity style={styles.btn} onPress={handleActualizar} disabled={cargandoPerfil || guardando}>
              {guardando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Actualizar</Text>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>

          <ConfirmPopup
            visible={popupDesvincular}
            emoji="🔗"
            titulo="¿Desvincular Mercado Pago?"
            mensaje="Ya no podrás recibir pagos directos desde la app."
            confirmText={desvinculando ? '...' : 'Desvincular'}
            cancelText="Cancelar"
            onCancel={() => setPopupDesvincular(false)}
            onClose={handleDesvincular}
          />
          <ConfirmPopup
            visible={popupVisible}
            emoji="✅"
            titulo="¡Perfil actualizado!"
            mensaje="Tus datos fueron guardados correctamente."
            onClose={() => { setPopupVisible(false); router.back(); }}
          />
        </KeyboardAvoidingView>
      </ImageBackground>
    </SwipeBackWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(74,158,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarLetra: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  nombre: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  usernameLabel: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  card: {
    backgroundColor: 'rgba(14,26,52,0.62)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 20, marginBottom: 16,
  },
  seccionTitulo: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  inputError: { borderColor: '#FF4D4D' },
  inputReadOnly: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  inputReadOnlyText: { fontSize: 15, color: 'rgba(255,255,255,0.35)' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4 },
  generoContainer: { flexDirection: 'column', gap: 8, marginVertical: 8 },
  generoBtn: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  generoBtnActivo: { backgroundColor: 'rgba(74,158,255,0.2)', borderColor: 'rgba(74,158,255,0.5)' },
  generoBtnText: { fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  generoBtnTextActivo: { color: '#FFFFFF', fontWeight: '700' },
  mpBtn: { backgroundColor: '#009EE3', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 4 },
  mpBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  mpVinculadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(52,211,153,0.12)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4, borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)' },
  mpVinculadoText: { color: '#34D399', fontSize: 14, fontWeight: '600' },
  mpDesvinculaBtn: { marginTop: 8, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', backgroundColor: 'rgba(255,77,77,0.1)', borderWidth: 1, borderColor: 'rgba(255,77,77,0.25)' },
  mpDesvinculaBtnText: { color: '#FF4D4D', fontSize: 14, fontWeight: '600' },
  btn: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
