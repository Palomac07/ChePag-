import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConfirmPopup from '@/components/ConfirmPopup';
import SwipeBackWrapper from '@/components/SwipeBackWrapper';
import { esPasswordSegura } from '@/utils/validaciones';

const BG = require('@/assets/images/bg.png');

export default function SeguridadScreen() {
  const router = useRouter();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [popupVisible, setPopupVisible] = useState(false);

  const passCheck = esPasswordSegura(nueva);
  const limpiarError = (campo: string) => setErrores(e => ({ ...e, [campo]: '' }));

  const handleCambiar = () => {
    const nuevos: Record<string, string> = {};
    if (!actual) nuevos.actual = 'Ingresá tu contraseña actual.';
    if (!nueva) nuevos.nueva = 'Ingresá la nueva contraseña.';
    else if (!passCheck.valida) nuevos.nueva = 'La contraseña no cumple los requisitos.';
    if (!confirmar) nuevos.confirmar = 'Confirmá la nueva contraseña.';
    else if (nueva !== confirmar) nuevos.confirmar = 'Las contraseñas no coinciden.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length === 0) setPopupVisible(true);
  };

  return (
    <SwipeBackWrapper>
      <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cambiar Contraseña</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>Contraseña Actual</Text>
            <View style={[styles.passContainer, errores.actual && styles.inputError]}>
              <TextInput style={styles.passInput} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry={!showActual} value={actual} onChangeText={v => { setActual(v); limpiarError('actual'); }} />
              <TouchableOpacity onPress={() => setShowActual(!showActual)}>
                <Ionicons name={showActual ? 'eye-outline' : 'eye-off-outline'} size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {errores.actual ? <Text style={styles.errorText}>{errores.actual}</Text> : null}

            <Text style={[styles.label, { marginTop: 16 }]}>Nueva Contraseña</Text>
            <View style={[styles.passContainer, errores.nueva && styles.inputError]}>
              <TextInput style={styles.passInput} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry={!showNueva} value={nueva} onChangeText={v => { setNueva(v); limpiarError('nueva'); }} />
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

            <Text style={[styles.label, { marginTop: 16 }]}>Confirmar Contraseña</Text>
            <View style={[styles.passContainer, errores.confirmar && styles.inputError]}>
              <TextInput style={styles.passInput} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry={!showConfirmar} value={confirmar} onChangeText={v => { setConfirmar(v); limpiarError('confirmar'); }} />
              <TouchableOpacity onPress={() => setShowConfirmar(!showConfirmar)}>
                <Ionicons name={showConfirmar ? 'eye-outline' : 'eye-off-outline'} size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {errores.confirmar ? <Text style={styles.errorText}>{errores.confirmar}</Text> : null}
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleCambiar}>
            <Text style={styles.btnText}>Cambiar Contraseña</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        <ConfirmPopup
          visible={popupVisible}
          emoji="🔐"
          titulo="¡Contraseña actualizada!"
          mensaje="Tu contraseña fue cambiada correctamente."
          onClose={() => { setPopupVisible(false); router.back(); }}
        />
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  card: {
    backgroundColor: 'rgba(14,26,52,0.62)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 20, marginBottom: 20,
  },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 8 },
  passContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  passInput: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  inputError: { borderColor: '#FF4D4D' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4 },
  passRequisitos: { marginTop: 8, gap: 2 },
  passReq: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  passReqOk: { color: '#34D399', fontWeight: '600' },
  btn: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
