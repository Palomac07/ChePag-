import { useCallback, useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Keyboard, TouchableWithoutFeedback, ImageBackground } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConfirmPopup from '@/components/ConfirmPopup';
import { useGastoStore } from '@/store/useGastoStore';
import { useGruposStore } from '@/store/useGruposStore';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/lib/supabase';
import { needsRatesFetch, fetchRatesMap } from '@/lib/ratesCache';
import { uploadTicket, getSignedUrl, deleteTicket, type ImagenElegida } from '@/lib/ticketImage';
import ImageSourceModal from '@/components/ImageSourceModal';
import { useImagePicker } from '@/hooks/useImagePicker';
import { firstNameOr } from '@/lib/displayName';

const BG = require('@/assets/images/bg.png');

const INPUT = {
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 13,
  fontSize: 15,
  color: '#FFFFFF' as const,
  borderWidth: 1.5,
  borderColor: 'rgba(255,255,255,0.12)' as const,
};

export default function AgregarGastoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    grupoId?: string; modo?: string; gastoId?: string;
    nombreGasto?: string; monto?: string; moneda?: string; categoria?: string;
    pagadorId?: string; pagadorNombre?: string; participantes?: string; fotoPath?: string;
  }>();
  const grupoIdParam = params.grupoId;
  const esEdicion = params.modo === 'editar';
  const gastoId = params.gastoId;
  const categoriaStore = useGastoStore(s => s.categoriaSeleccionada);
  const resetCategoria = useGastoStore(s => s.resetCategoria);
  const grupos = useGruposStore(s => s.grupos);
  const actualizarMonedas = useGruposStore(s => s.actualizarMonedas);
  const userId = useUserStore(s => s.id);
  const nombreUsuario = useUserStore(s => s.nombre);

  useEffect(() => {
    if (categoriaStore) { setCategoria(categoriaStore); setErrores(e => ({ ...e, categoria: '' })); }
  }, [categoriaStore]);
  useEffect(() => { return () => { resetCategoria(); }; }, []);
  useEffect(() => {
    if (grupoIdParam) {
      const g = grupos.find(gr => gr.id === grupoIdParam);
      // En edición no pisamos la moneda elegida del gasto con la moneda por defecto del grupo.
      if (g) { setGrupoSeleccionado(g.nombre); if (!esEdicion) setMonedaSeleccionada(g.monedas[0]?.codigo ?? 'ARS'); }
    }
  }, [grupoIdParam, grupos, esEdicion]);

  // Precarga los datos del gasto cuando entramos en modo edición (una sola vez).
  const [prefillHecho, setPrefillHecho] = useState(false);
  useEffect(() => {
    if (!esEdicion || prefillHecho) return;
    setNombreGasto(params.nombreGasto ?? '');
    setMonto(params.monto ?? '');
    setMonedaSeleccionada(params.moneda ?? 'ARS');
    setCategoria(params.categoria ?? '');
    if (params.pagadorId) setPagadorId(params.pagadorId);
    if (params.pagadorNombre) setPagadorNombre(params.pagadorNombre);
    try {
      const parts = JSON.parse(params.participantes ?? '[]');
      if (Array.isArray(parts)) setMiembrosSeleccionados(parts);
    } catch { /* participantes inválidos: se dejan vacíos */ }
    if (params.fotoPath) {
      setFotoPathExistente(params.fotoPath);
      getSignedUrl(params.fotoPath).then(u => setFotoExistenteUrl(u));
    }
    setPrefillHecho(true);
  }, [esEdicion, prefillHecho]);

  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');
  const [grupoDropdown, setGrupoDropdown] = useState(false);
  const [nombreGasto, setNombreGasto] = useState('');
  const [monto, setMonto] = useState('');
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('ARS');
  const [pagadorId, setPagadorId] = useState(userId);
  const [pagadorNombre, setPagadorNombre] = useState(nombreUsuario);
  const [pagadorDropdown, setPagadorDropdown] = useState(false);
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<{ user_id: string; nombre: string }[]>([]);
  const [miembrosDropdown, setMiembrosDropdown] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [foto, setFoto] = useState<ImagenElegida | null>(null);
  const [fotoPathExistente, setFotoPathExistente] = useState<string | null>(null);
  const [fotoExistenteUrl, setFotoExistenteUrl] = useState<string | null>(null);
  const handleFotoElegida = useCallback((imagen: ImagenElegida) => setFoto(imagen), []);
  const {
    sourceModalVisible: fotoSourceModal,
    setSourceModalVisible: setFotoSourceModal,
    pedirImagen: pedirFoto,
    pickerActivo,
    permisoDenegado,
    setPermisoDenegado,
  } = useImagePicker(handleFotoElegida);

  const grupoActual = grupos.find(g => g.nombre === grupoSeleccionado);
  const monedasGrupo = grupoActual?.monedas ?? [];
  const tieneVariasMonedas = monedasGrupo.length > 1;
  const miembrosGrupo = grupoActual?.miembros ?? [];
  const presupuestoAlcanzado = !!(grupoActual?.presupuesto && grupoActual.totalGastadoNum >= grupoActual.presupuesto);

  useEffect(() => {
    if (!grupoActual || !grupoActual.monedas.some(m => m.codigo !== 'ARS')) return;
    if (!needsRatesFetch()) return;
    fetchRatesMap().then(mapa => {
      if (!mapa) return;
      const actualizadas = grupoActual.monedas.map(m => m.codigo === 'ARS' ? m : { ...m, tasaARS: mapa[m.codigo] ?? m.tasaARS });
      actualizarMonedas(grupoActual.id, actualizadas);
    });
  }, [grupoActual?.id]);

  const handleSeleccionarGrupo = (nombre: string) => {
    setGrupoSeleccionado(nombre);
    setGrupoDropdown(false);
    setErrores(e => ({ ...e, grupo: '' }));
    const g = grupos.find(gr => gr.nombre === nombre);
    setMonedaSeleccionada(g?.monedas[0]?.codigo ?? 'ARS');
    setMiembrosSeleccionados(g?.miembros ?? []);
    const yo = g?.miembros.find(m => m.user_id === userId);
    if (yo) { setPagadorId(yo.user_id); setPagadorNombre(yo.nombre); }
  };

  const toggleMiembro = (m: { user_id: string; nombre: string }) => {
    setMiembrosSeleccionados(prev =>
      prev.find(x => x.user_id === m.user_id) ? prev.filter(x => x.user_id !== m.user_id) : [...prev, m]
    );
  };

  const validarYGuardar = async () => {
    const nuevosErrores: Record<string, string> = {};
    if (!grupoSeleccionado) nuevosErrores.grupo = 'Seleccioná un grupo.';
    if (presupuestoAlcanzado && !esEdicion) nuevosErrores.grupo = `El grupo alcanzó su presupuesto de $${grupoActual!.presupuesto!.toLocaleString('es-AR')}.`;
    if (!nombreGasto.trim()) nuevosErrores.nombre = 'Ingresá el nombre del gasto.';
    if (!monto || Number(monto) <= 0) nuevosErrores.monto = 'Ingresá un monto mayor a $0.';
    if (miembrosSeleccionados.length === 0) nuevosErrores.miembros = 'Seleccioná al menos un participante.';
    if (!categoria) nuevosErrores.categoria = 'Seleccioná una categoría.';
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return;

    setGuardando(true);
    const grupoId = grupoActual!.id;

    // Path del comprobante: si se eligió una foto nueva la subimos; si no,
    // conservamos la existente (puede ser null si se quitó en edición).
    let fotoPath: string | null = fotoPathExistente;
    if (foto) {
      const subido = await uploadTicket(userId, grupoId, foto.base64);
      if (!subido) {
        setGuardando(false);
        setErrores({ general: 'No se pudo subir la imagen del ticket. Intentá de nuevo.' });
        return;
      }
      fotoPath = subido;
    }

    const datosGasto = {
      grupo_id: grupoId, nombre: nombreGasto.trim(),
      pagador_id: pagadorId, pagador_nombre: pagadorNombre,
      monto: Number(monto), moneda: monedaSeleccionada,
      participantes: miembrosSeleccionados.map(m => ({ user_id: m.user_id, nombre: m.nombre })),
      categoria, foto_path: fotoPath,
    };

    if (esEdicion) {
      const { error } = await supabase.from('gastos').update(datosGasto).eq('id', gastoId);
      setGuardando(false);
      if (error) { setErrores({ general: 'No se pudo guardar el gasto. Intentá de nuevo.' }); return; }
      // Si el comprobante original cambió o se quitó, borramos el viejo del storage.
      const original = params.fotoPath || null;
      if (original && original !== fotoPath) deleteTicket(original);
      setPopupVisible(true);
      return;
    }

    const { error } = await supabase.from('gastos').insert(datosGasto);
    setGuardando(false);
    if (error) { setErrores({ general: 'No se pudo guardar el gasto. Intentá de nuevo.' }); return; }

    const notifs = miembrosSeleccionados.map(m => ({
      user_id: m.user_id, tipo: 'gasto_nuevo',
      titulo: m.user_id === userId ? '✅ Gasto registrado' : 'Nuevo gasto en el grupo',
      mensaje: m.user_id === userId
        ? `Registraste "${nombreGasto.trim()}" por $${Number(monto).toLocaleString('es-AR')} en ${grupoSeleccionado}.`
        : `${firstNameOr(pagadorNombre)} agregó "${nombreGasto.trim()}" por $${Number(monto).toLocaleString('es-AR')} en ${grupoSeleccionado}.`,
      data: { grupo_id: grupoActual?.id, grupo_nombre: grupoSeleccionado },
    }));
    if (notifs.length > 0) await supabase.from('notificaciones').insert(notifs);

    if (grupoActual?.presupuesto) {
      const tasa = monedasGrupo.find(m => m.codigo === monedaSeleccionada)?.tasaARS ?? 1;
      const montoARS = Number(monto) * tasa;
      const totalAntes = grupoActual.totalGastadoNum;
      const totalDespues = totalAntes + montoARS;
      if (totalAntes < grupoActual.presupuesto && totalDespues >= grupoActual.presupuesto) {
        const notifsPresupuesto = grupoActual.miembros.map(m => ({
          user_id: m.user_id, tipo: 'presupuesto_alcanzado',
          titulo: '🚨 Presupuesto alcanzado',
          mensaje: `El grupo "${grupoSeleccionado}" alcanzó su presupuesto de $${grupoActual.presupuesto!.toLocaleString('es-AR')}.`,
          data: { grupo_id: grupoActual.id, grupo_nombre: grupoSeleccionado },
        }));
        await supabase.from('notificaciones').insert(notifsPresupuesto);
      }
    }
    setPopupVisible(true);
  };

  const monedaActual = monedasGrupo.find(m => m.codigo === monedaSeleccionada);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <Text style={styles.title}>{esEdicion ? 'Editar Gasto' : 'Agregar Gasto'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>

          <View style={styles.row}>
            <Text style={styles.label}>Nombre del gasto</Text>
            <TextInput style={[styles.input, errores.nombre && styles.inputError]} placeholder="Ej: Cena, Hotel, Taxi..." placeholderTextColor="rgba(255,255,255,0.35)" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} value={nombreGasto} onChangeText={v => { setNombreGasto(v); setErrores(e => ({ ...e, nombre: '' })); }} />
            {errores.nombre ? <Text style={styles.errorText}>{errores.nombre}</Text> : null}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Grupo</Text>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity style={[styles.dropdown, errores.grupo && styles.inputError]} onPress={() => { setGrupoDropdown(!grupoDropdown); setErrores(e => ({ ...e, grupo: '' })); }}>
                <Text style={[styles.dropdownText, grupoSeleccionado && { color: '#FFFFFF' }]}>{grupoSeleccionado || 'Seleccioná un grupo'}</Text>
                <Ionicons name={grupoDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
              {grupoDropdown && (
                <View style={styles.dropdownMenu}>
                  {grupos.filter(g => g.activo).map(g => (
                    <TouchableOpacity key={g.id} style={styles.dropdownItem} onPress={() => handleSeleccionarGrupo(g.nombre)}>
                      <Text style={styles.dropdownItemText}>{g.nombre}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {errores.grupo ? <Text style={styles.errorText}>{errores.grupo}</Text> : null}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Monto</Text>
            <View style={styles.montoRow}>
              <TextInput style={[styles.input, styles.montoInput, errores.monto && styles.inputError]} placeholder="0" placeholderTextColor="rgba(255,255,255,0.35)" keyboardType="numeric" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} value={monto} onChangeText={v => { setMonto(v); setErrores(e => ({ ...e, monto: '' })); }} />
              {monedaActual && (
                <View style={styles.monedaBadge}>
                  <Text style={styles.monedaBadgeText}>{monedaActual.simbolo} {monedaActual.codigo}</Text>
                </View>
              )}
            </View>
            {errores.monto ? <Text style={styles.errorText}>{errores.monto}</Text> : null}
          </View>

          {tieneVariasMonedas && (
            <View style={styles.row}>
              <Text style={styles.label}>Moneda del pago</Text>
              <View style={styles.monedasChips}>
                {monedasGrupo.map(m => (
                  <TouchableOpacity key={m.codigo} style={[styles.monedaChip, monedaSeleccionada === m.codigo && styles.monedaChipActivo]} onPress={() => setMonedaSeleccionada(m.codigo)}>
                    <Text style={[styles.monedaChipText, monedaSeleccionada === m.codigo && styles.monedaChipTextActivo]}>{m.simbolo} {m.codigo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {monedaSeleccionada !== 'ARS' && monedaActual && (
                <Text style={styles.tasaNota}>Tasa actual: 1 {monedaActual.codigo} = ${monedaActual.tasaARS.toLocaleString('es-AR')} ARS</Text>
              )}
            </View>
          )}

          {miembrosGrupo.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>¿Quién pagó?</Text>
              <View style={styles.dropdownWrapper}>
                <TouchableOpacity style={styles.dropdown} onPress={() => setPagadorDropdown(!pagadorDropdown)}>
                  <Text style={[styles.dropdownText, { color: '#FFFFFF' }]}>{pagadorNombre ? firstNameOr(pagadorNombre) : 'Seleccioná quién pagó'}</Text>
                  <Ionicons name={pagadorDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
                {pagadorDropdown && (
                  <View style={styles.dropdownMenu}>
                    {miembrosGrupo.map(m => (
                      <TouchableOpacity key={m.user_id} style={styles.dropdownItem} onPress={() => { setPagadorId(m.user_id); setPagadorNombre(m.nombre); setPagadorDropdown(false); }}>
                        <Text style={styles.dropdownItemText}>{firstNameOr(m.nombre)}{m.user_id === userId ? ' (vos)' : ''}</Text>
                        {pagadorId === m.user_id && <Ionicons name="checkmark" size={16} color="#4A9EFF" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>Dividido entre</Text>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity style={[styles.dropdown, errores.miembros && styles.inputError]} onPress={() => { setMiembrosDropdown(!miembrosDropdown); setErrores(e => ({ ...e, miembros: '' })); }}>
                <Text style={[styles.dropdownText, miembrosSeleccionados.length > 0 && { color: '#FFFFFF' }]}>
                  {miembrosSeleccionados.length > 0 ? miembrosSeleccionados.map(m => firstNameOr(m.nombre)).join(', ') : 'Seleccioná participantes'}
                </Text>
              </TouchableOpacity>
              {miembrosDropdown && (
                <View style={styles.dropdownMenu}>
                  {miembrosGrupo.map(m => (
                    <TouchableOpacity key={m.user_id} style={styles.dropdownItem} onPress={() => toggleMiembro(m)}>
                      <Text style={styles.dropdownItemText}>{firstNameOr(m.nombre)}{m.user_id === userId ? ' (vos)' : ''}</Text>
                      {miembrosSeleccionados.find(x => x.user_id === m.user_id) && <Ionicons name="checkmark" size={16} color="#4A9EFF" />}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.cerrarBtn} onPress={() => setMiembrosDropdown(false)}>
                    <Text style={styles.cerrarText}>Listo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {errores.miembros ? <Text style={styles.errorText}>{errores.miembros}</Text> : null}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Categoría del gasto</Text>
            <TouchableOpacity
              style={[styles.categoriaBtn, errores.categoria && styles.categoriaBtnError]}
              onPress={() => { router.push({ pathname: '/categorias', params: { callback: '1' } }); setErrores(e => ({ ...e, categoria: '' })); }}
            >
              <Text style={styles.categoriaBtnText}>{categoria || 'Seleccioná categoría'}</Text>
            </TouchableOpacity>
            {errores.categoria ? <Text style={styles.errorText}>{errores.categoria}</Text> : null}
          </View>

          {foto || fotoPathExistente ? (
            <View style={styles.ticketPreviewWrap}>
              {(foto?.uri || fotoExistenteUrl) && (
                <Image source={{ uri: foto?.uri ?? fotoExistenteUrl! }} style={styles.ticketPreview} contentFit="cover" />
              )}
              <View style={styles.ticketPreviewInfo}>
                <Text style={styles.ticketPreviewLabel}>Comprobante adjunto</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                  <TouchableOpacity onPress={() => setFotoSourceModal(true)}>
                    <Text style={styles.ticketPreviewAction}>Cambiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setFoto(null); setFotoPathExistente(null); setFotoExistenteUrl(null); }}>
                    <Text style={[styles.ticketPreviewAction, { color: '#FF4D4D' }]}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.ticketRow} onPress={() => setFotoSourceModal(true)}>
              <Text style={styles.label}>Agregar imagen de ticket</Text>
              <Text style={{ fontSize: 22 }}>📎</Text>
            </TouchableOpacity>
          )}

          {errores.general ? <Text style={[styles.errorText, { textAlign: 'center', marginBottom: 12 }]}>{errores.general}</Text> : null}

          <TouchableOpacity style={styles.guardarBtn} onPress={validarYGuardar} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.guardarText}>{esEdicion ? 'Guardar cambios' : 'Guardar Gasto'}</Text>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        <ConfirmPopup visible={popupVisible} emoji="✅" titulo={esEdicion ? '¡Gasto actualizado!' : '¡Gasto agregado!'} mensaje={esEdicion ? 'Los cambios se guardaron y los balances del grupo se actualizaron.' : 'El gasto fue registrado y los balances del grupo se actualizaron.'} onClose={() => { setPopupVisible(false); router.back(); }} />
        <ConfirmPopup visible={permisoDenegado} emoji="🔒" titulo="Permiso necesario" mensaje="Para adjuntar el comprobante, habilitá el acceso a la cámara o las fotos desde la configuración de tu teléfono." onClose={() => setPermisoDenegado(false)} />
        <ImageSourceModal
          visible={fotoSourceModal}
          title="Adjuntar comprobante"
          disabled={pickerActivo}
          onClose={() => setFotoSourceModal(false)}
          onPick={pedirFoto}
        />
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  row: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  inputError: { borderColor: '#FF4D4D' },
  montoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  montoInput: { flex: 1 },
  monedaBadge: { backgroundColor: 'rgba(74,158,255,0.25)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(74,158,255,0.4)' },
  monedaBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  monedasChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  monedaChip: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  monedaChipActivo: { backgroundColor: 'rgba(74,158,255,0.2)', borderColor: 'rgba(74,158,255,0.5)' },
  monedaChipText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  monedaChipTextActivo: { color: '#FFFFFF' },
  tasaNota: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 },
  dropdownWrapper: { position: 'relative' },
  dropdown: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  dropdownText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', flex: 1 },
  dropdownMenu: {
    backgroundColor: 'rgba(8,18,40,0.97)', borderRadius: 12, marginTop: 4, zIndex: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', justifyContent: 'space-between' },
  dropdownItemText: { fontSize: 14, color: '#FFFFFF' },
  cerrarBtn: { paddingVertical: 12, alignItems: 'center' },
  cerrarText: { fontSize: 14, color: '#4A9EFF', fontWeight: '700' },
  categoriaBtn: { backgroundColor: 'rgba(74,158,255,0.2)', borderRadius: 50, paddingHorizontal: 20, paddingVertical: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(74,158,255,0.4)' },
  categoriaBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  categoriaBtnError: { backgroundColor: 'rgba(255,77,77,0.2)', borderColor: 'rgba(255,77,77,0.5)' },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  ticketPreviewWrap: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  ticketPreview: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  ticketPreviewInfo: { flex: 1 },
  ticketPreviewLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  ticketPreviewAction: { fontSize: 13, color: '#4A9EFF', fontWeight: '700' },
  guardarBtn: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  guardarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4 },
});
