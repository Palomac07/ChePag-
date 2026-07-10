import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Keyboard, TouchableWithoutFeedback, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAmistadStore } from '@/store/useAmistadStore';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/lib/supabase';
import { firstName, firstNameOr } from '@/lib/displayName';

const BG = require('@/assets/images/bg.png');
const COLORES = ['#9B8EC4', '#7BC4B8', '#6BAED6', '#5BAA9F', '#C084C0', '#4A6580', '#6BAA9F'];

type UsuarioResultado = { id: string; nombre: string; username?: string };

const GLASS = {
  backgroundColor: 'rgba(14,26,52,0.62)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: 14,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
} as const;

export default function AmigosScreen() {
  const router = useRouter();
  const userId = useUserStore(s => s.id);
  const { amigos, solicitudesEnviadas, cargarAmigos, cargarSolicitudesEnviadas, enviarSolicitud } = useAmistadStore();

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => {
    if (userId) {
      cargarAmigos(userId);
      cargarSolicitudesEnviadas(userId);
    }
  }, [userId]));

  const buscarUsuarios = async (texto: string) => {
    setBusqueda(texto);
    if (texto.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    const t = texto.trim();
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre, username')
      .or(`nombre.ilike.%${t}%,username.ilike.%${t}%`)
      .neq('id', userId ?? '')
      .limit(10);
    setResultados(data ?? []);
    setBuscando(false);
  };

  const handleEnviarSolicitud = async (receptor: UsuarioResultado) => {
    if (!userId) return;
    setEnviando(receptor.id);
    const { error } = await enviarSolicitud(userId, receptor.id);
    if (error) {
      setMensajes(prev => ({ ...prev, [receptor.id]: error }));
    } else {
      setMensajes(prev => ({ ...prev, [receptor.id]: '✅ Solicitud enviada' }));
      cargarSolicitudesEnviadas(userId);
    }
    setEnviando(null);
  };

  const yaEsAmigo = (id: string) => amigos.some(a => a.id === id);
  const solicitudEnviada = (id: string) => solicitudesEnviadas.some(s => s.receptor_id === id);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <Text style={styles.title}>Amigos</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

          <Text style={styles.seccionLabel}>Buscar usuario</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Nombre de usuario..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              returnKeyType="search"
              value={busqueda}
              onChangeText={buscarUsuarios}
            />
            {buscando && <ActivityIndicator color="#4A9EFF" style={{ marginLeft: 8 }} />}
          </View>

          {resultados.length > 0 && (
            <View style={styles.resultadosContainer}>
              {resultados.map((u, i) => {
                const esAmigo = yaEsAmigo(u.id);
                const enviada = solicitudEnviada(u.id);
                const mensaje = mensajes[u.id];
                return (
                  <View key={u.id} style={styles.card}>
                    <View style={[styles.avatar, { backgroundColor: COLORES[i % COLORES.length] }]}>
                      <Text style={styles.avatarLetra}>{(firstName(u.nombre) || u.username || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardNombre}>{firstNameOr(u.nombre)}</Text>
                      {u.username ? <Text style={styles.cardUsername}>@{u.username}</Text> : null}
                    </View>
                    {esAmigo ? (
                      <View style={styles.amigoTag}>
                        <Text style={styles.amigoTagText}>✓ Amigo</Text>
                      </View>
                    ) : enviada || mensaje?.startsWith('✅') ? (
                      <View style={styles.pendienteTag}>
                        <Text style={styles.pendienteTagText}>⏳ Pendiente</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.agregarBtn}
                        onPress={() => handleEnviarSolicitud(u)}
                        disabled={enviando === u.id}
                      >
                        {enviando === u.id
                          ? <ActivityIndicator color="#FFFFFF" size="small" />
                          : <Text style={styles.agregarBtnText}>+ Agregar</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {busqueda.length >= 2 && !buscando && resultados.length === 0 && (
            <Text style={styles.sinResultados}>No se encontraron usuarios con ese nombre o @usuario.</Text>
          )}

          {amigos.length > 0 && (
            <>
              <Text style={[styles.seccionLabel, { marginTop: 24 }]}>Mis amigos ({amigos.length})</Text>
              {amigos.map((a, i) => (
                <View key={a.id} style={styles.card}>
                  <View style={[styles.avatar, { backgroundColor: COLORES[i % COLORES.length] }]}>
                    <Text style={styles.avatarLetra}>{firstName(a.nombre)[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <Text style={styles.cardNombre}>{firstNameOr(a.nombre)}</Text>
                  <View style={styles.amigoTag}>
                    <Text style={styles.amigoTagText}>✓ Amigo</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {amigos.length === 0 && busqueda.length < 2 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🤝</Text>
              <Text style={styles.emptyTitulo}>Todavía no tenés amigos</Text>
              <Text style={styles.emptyDesc}>Buscá a alguien por nombre para enviarle una solicitud.</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  seccionLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  resultadosContainer: { marginBottom: 8 },
  card: { ...GLASS, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarLetra: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  cardNombre: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  cardUsername: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  agregarBtn: { backgroundColor: '#4A9EFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  agregarBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  amigoTag: { backgroundColor: 'rgba(52,211,153,0.15)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)' },
  amigoTagText: { fontSize: 12, color: '#34D399', fontWeight: '600' },
  pendienteTag: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' },
  pendienteTagText: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  sinResultados: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitulo: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },
});
