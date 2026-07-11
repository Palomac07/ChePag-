import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConfirmPopup from '@/components/ConfirmPopup';
import { supabase } from '@/lib/supabase';
import { shareViaWhatsApp, shareInvite, copyInviteLink } from '@/lib/invite';
import { useUserStore } from '@/store/useUserStore';
import { useGruposStore } from '@/store/useGruposStore';
import { useAmistadStore } from '@/store/useAmistadStore';
import { uploadTicket } from '@/lib/ticketImage';
import { usePendingGroupPhotoStore } from '@/store/usePendingGroupPhotoStore';
import { firstName, firstNameOr } from '@/lib/displayName';

const BG = require('@/assets/images/bg.png');
const COLORES = ['#9B8EC4', '#7BC4B8', '#6BAED6', '#5BAA9F', '#C084C0', '#4A6580', '#6BAA9F'];
type UsuarioBusqueda = { id: string; nombre: string; username: string };

const GLASS = {
  backgroundColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.18)',
  borderRadius: 14,
} as const;

export default function AgregarParticipantesScreen() {
  const router = useRouter();
  const { nombreGrupo, categoria, monedas, modo, grupoId: grupoIdParam } = useLocalSearchParams<{
    nombreGrupo: string; categoria: string; monedas: string; modo: string; grupoId: string;
  }>();

  const userId = useUserStore(s => s.id);
  const nombreUsuario = useUserStore(s => s.nombre);
  const cargarGrupos = useGruposStore(s => s.cargarGrupos);
  const { amigos, enviarSolicitud, solicitudesEnviadas: enviadas } = useAmistadStore();
  const fotoGrupo = usePendingGroupPhotoStore(s => s.foto);
  const clearFotoGrupo = usePendingGroupPhotoStore(s => s.clearFoto);

  const [grupoId, setGrupoId] = useState<string | null>(grupoIdParam ?? null);
  const [creandoGrupo, setCreandoGrupo] = useState(modo !== 'agregar');
  const [miembrosExistentes, setMiembrosExistentes] = useState<string[]>([]);
  const [seleccionados, setSeleccionados] = useState<{ id: string; nombre: string }[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [usernameBusqueda, setUsernameBusqueda] = useState('');
  const [resultado, setResultado] = useState<UsuarioBusqueda | null | undefined>(undefined);
  const [buscando, setBuscando] = useState(false);
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);

  useEffect(() => {
    if (modo === 'agregar') {
      if (grupoIdParam) {
        supabase.from('grupo_miembros').select('user_id').eq('grupo_id', grupoIdParam)
          .then(({ data }) => { if (data) setMiembrosExistentes(data.map((m: any) => m.user_id)); });
      }
      return;
    }
    const crearGrupo = async () => {
      if (!userId) return;
      const monedaParseada = monedas ? JSON.parse(monedas) : [{ codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', tasaARS: 1 }];
      const nuevoId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      const { error: insertErr } = await supabase.from('grupos').insert({ id: nuevoId, nombre: nombreGrupo, categoria, monedas: monedaParseada, creador_id: userId });
      if (insertErr) { setError('No se pudo crear el grupo. Volvé e intentá de nuevo.'); setCreandoGrupo(false); return; }
      await supabase.from('grupo_miembros').insert({ grupo_id: nuevoId, user_id: userId, nombre: nombreUsuario, es_admin: true });
      if (fotoGrupo) {
        try {
          const fotoPath = await uploadTicket(userId, nuevoId, fotoGrupo.base64);
          if (fotoPath) {
            const monedasConFoto = monedaParseada.map((m: any, idx: number) => idx === 0 ? { ...m, fotoPath } : m);
            await supabase.from('grupos').update({ monedas: monedasConFoto }).eq('id', nuevoId);
          }
        } catch {
          // Si la foto falla, el grupo se crea igual para no bloquear el flujo principal.
        }
      }
      clearFotoGrupo();
      setGrupoId(nuevoId);
      setCreandoGrupo(false);
    };
    crearGrupo();
  }, []);

  const [linkCopiado, setLinkCopiado] = useState(false);

  const buscarPorUsername = async () => {
    const u = usernameBusqueda.trim().toLowerCase();
    if (!u) return;
    setBuscando(true);
    setResultado(undefined);
    const { data } = await supabase.from('profiles').select('id, nombre, username').eq('username', u).neq('id', userId ?? '').maybeSingle();
    setResultado(data ?? null);
    setBuscando(false);
  };

  const handleEnviarSolicitud = async (usuarioId: string) => {
    if (!userId) return;
    const { error: err } = await enviarSolicitud(userId, usuarioId);
    if (err) Alert.alert('', err);
    else setSolicitudesEnviadas(prev => new Set(prev).add(usuarioId));
  };

  const handleInvitarWhatsApp = () => {
    if (grupoId) shareViaWhatsApp(nombreGrupo, grupoId);
  };

  const handleCompartir = () => {
    if (grupoId) shareInvite(nombreGrupo, grupoId);
  };

  const handleCopiarLink = async () => {
    if (!grupoId) return;
    await copyInviteLink(grupoId);
    setLinkCopiado(true);
  };

  const toggleSeleccionado = (usuario: { id: string; nombre: string }) => {
    setSeleccionados(prev => prev.find(u => u.id === usuario.id) ? prev.filter(u => u.id !== usuario.id) : [...prev, usuario]);
  };

  const handleFinalizar = async () => {
    if (!grupoId || !userId) return;
    setGuardando(true);
    if (seleccionados.length > 0) {
      const miembros = seleccionados.map(u => ({ grupo_id: grupoId, user_id: u.id, nombre: u.nombre, es_admin: false }));
      await supabase.from('grupo_miembros').insert(miembros);
    }
    await cargarGrupos(userId);
    setGuardando(false);
    setPopupVisible(true);
  };

  const amigosFiltrados = amigos.filter(a => a.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !miembrosExistentes.includes(a.id));
  const yaEsAmigo = resultado ? !!amigos.find(a => a.id === resultado.id) : false;
  const solicitudEnviada = resultado ? solicitudesEnviadas.has(resultado.id) || enviadas.some(s => s.receptor_id === resultado.id) : false;

  if (creandoGrupo) {
    return (
      <ImageBackground source={BG} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} resizeMode="cover">
        <ActivityIndicator color="#4A9EFF" size="large" />
        <Text style={{ color: '#FFFFFF', marginTop: 16 }}>Creando grupo...</Text>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.title}>Agregar Participantes</Text>
        <View style={{ width: 40 }} />
      </View>

      <TextInput
        style={styles.search}
        placeholder="🔍  Buscar entre mis amigos"
        placeholderTextColor="rgba(255,255,255,0.35)"
        value={busqueda}
        onChangeText={setBusqueda}
      />

      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <Text style={styles.seccionLabel}>Buscar usuario</Text>
        <View style={styles.usernameRow}>
          <TextInput
            style={styles.usernameInput}
            placeholder="Nombre de usuario exacto"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={usernameBusqueda}
            onChangeText={v => { setUsernameBusqueda(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setResultado(undefined); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.buscarBtn} onPress={buscarPorUsername} disabled={buscando || !usernameBusqueda.trim()}>
            {buscando ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.buscarBtnText}>Buscar</Text>}
          </TouchableOpacity>
        </View>

        {resultado === null && <Text style={styles.noEncontradoText}>No se encontró ningún usuario con ese nombre.</Text>}
        {resultado && !yaEsAmigo && (
          <View style={styles.amigoItem}>
            <View style={[styles.avatarCircle, { backgroundColor: COLORES[0] }]}>
              <Text style={styles.avatarLetra}>{firstName(resultado.nombre)[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.amigoNombre}>{firstNameOr(resultado.nombre)}</Text>
              <Text style={styles.usernameTag}>@{resultado.username}</Text>
            </View>
            <TouchableOpacity
              style={[styles.solicitudBtn, solicitudEnviada && styles.solicitudBtnEnviada]}
              onPress={() => !solicitudEnviada && handleEnviarSolicitud(resultado!.id)}
              disabled={solicitudEnviada}
            >
              <Text style={[styles.solicitudBtnText, solicitudEnviada && styles.solicitudBtnTextEnviada]}>
                {solicitudEnviada ? '✓ Enviada' : '+ Solicitud'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {resultado && yaEsAmigo && (
          <View style={styles.amigoItem}>
            <View style={[styles.avatarCircle, { backgroundColor: COLORES[0] }]}>
              <Text style={styles.avatarLetra}>{firstName(resultado.nombre)[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.amigoNombre}>{firstNameOr(resultado.nombre)}</Text>
              <Text style={styles.usernameTag}>@{resultado.username}</Text>
            </View>
            <View style={styles.yaAmigoTag}>
              <Text style={styles.yaAmigoText}>Ya son amigos</Text>
            </View>
          </View>
        )}

        <Text style={[styles.seccionLabel, { marginTop: 20 }]}>Invitar al grupo con un link</Text>
        <TouchableOpacity style={styles.opcionItem} onPress={handleInvitarWhatsApp} disabled={!grupoId}>
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={styles.opcionText}>Invitar por WhatsApp</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.opcionItem} onPress={handleCopiarLink} disabled={!grupoId}>
          <Ionicons name={linkCopiado ? 'checkmark' : 'copy-outline'} size={20} color="rgba(255,255,255,0.6)" />
          <Text style={styles.opcionText}>{linkCopiado ? '¡Link copiado!' : 'Copiar link'}</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.opcionItem} onPress={handleCompartir} disabled={!grupoId}>
          <Ionicons name="share-social-outline" size={20} color="rgba(255,255,255,0.6)" />
          <Text style={styles.opcionText}>Compartir por otro medio</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>

        <Text style={[styles.seccionLabel, { marginTop: 20 }]}>Mis amigos</Text>
        {amigosFiltrados.length === 0 ? (
          <Text style={styles.emptyText}>
            {busqueda ? 'No se encontraron amigos.' : 'Todavía no tenés amigos en ChePaga. ¡Invitá a alguien!'}
          </Text>
        ) : (
          amigosFiltrados.map((amigo, i) => {
            const seleccionado = !!seleccionados.find(u => u.id === amigo.id);
            return (
              <TouchableOpacity key={amigo.id} style={[styles.amigoItem, seleccionado && styles.amigoItemActivo]} onPress={() => toggleSeleccionado(amigo)}>
                <View style={[styles.avatarCircle, { backgroundColor: COLORES[i % COLORES.length] }]}>
                  <Text style={styles.avatarLetra}>{firstName(amigo.nombre)[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amigoNombre}>{firstNameOr(amigo.nombre)}</Text>
                  {amigo.username ? <Text style={styles.usernameTag}>@{amigo.username}</Text> : null}
                </View>
                <View style={[styles.checkbox, seleccionado && styles.checkboxActivo]}>
                  {seleccionado && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {seleccionados.length > 0 && (
          <>
            <Text style={[styles.seccionLabel, { marginTop: 16 }]}>Seleccionados ({seleccionados.length})</Text>
            <View style={styles.seleccionadosRow}>
              {seleccionados.map((u, i) => (
                <View key={u.id} style={styles.seleccionadoChip}>
                  <View style={[styles.chipAvatar, { backgroundColor: COLORES[i % COLORES.length] }]}>
                    <Text style={styles.chipLetra}>{firstName(u.nombre)[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <Text style={styles.chipNombre}>{firstNameOr(u.nombre)}</Text>
                  <TouchableOpacity onPress={() => toggleSeleccionado(u)}>
                    <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.finalizarBtn} onPress={handleFinalizar} disabled={guardando || !grupoId}>
        {guardando
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.finalizarText}>
              {seleccionados.length > 0 ? `Finalizar (${seleccionados.length + 1} miembros)` : 'Continuar sin agregar'}
            </Text>
        }
      </TouchableOpacity>

      <ConfirmPopup
        visible={popupVisible}
        emoji="🎉"
        titulo={modo === 'agregar' ? '¡Miembros agregados!' : '¡Grupo creado!'}
        mensaje={
          modo === 'agregar'
            ? `Se agregaron ${seleccionados.length} miembro${seleccionados.length !== 1 ? 's' : ''} al grupo.`
            : `"${nombreGrupo}" fue creado con ${seleccionados.length + 1} participante${seleccionados.length + 1 !== 1 ? 's' : ''}.`
        }
        onClose={() => { setPopupVisible(false); modo === 'agregar' ? router.back() : router.replace('/(tabs)'); }}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  search: {
    backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: '#FFFFFF', marginBottom: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },
  seccionLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  usernameRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  usernameInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  buscarBtn: { backgroundColor: '#4A9EFF', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  buscarBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  noEncontradoText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
  opcionItem: { ...GLASS, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8 },
  opcionText: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  amigoItem: { ...GLASS, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8 },
  amigoItemActivo: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.22)' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarLetra: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  amigoNombre: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  usernameTag: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkboxActivo: { backgroundColor: '#4A9EFF', borderColor: '#4A9EFF' },
  solicitudBtn: { backgroundColor: '#4A9EFF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  solicitudBtnEnviada: { backgroundColor: 'rgba(74,158,255,0.15)', borderWidth: 1, borderColor: 'rgba(74,158,255,0.4)' },
  solicitudBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  solicitudBtnTextEnviada: { color: '#4A9EFF' },
  yaAmigoTag: { backgroundColor: 'rgba(52,211,153,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)' },
  yaAmigoText: { color: '#34D399', fontSize: 13, fontWeight: '600' },
  seleccionadosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  seleccionadoChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  chipAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipLetra: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  chipNombre: { fontSize: 13, color: '#FFFFFF' },
  errorText: { color: '#FF4D4D', fontSize: 13, marginTop: 8 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8, marginBottom: 12 },
  finalizarBtn: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', position: 'absolute', bottom: 40, left: 24, right: 24 },
  finalizarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
