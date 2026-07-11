import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Keyboard, ImageBackground } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Moneda } from '@/store/useGruposStore';
import ConfirmPopup from '@/components/ConfirmPopup';
import { fetchRatesMap } from '@/lib/ratesCache';
import { ImagenElegida } from '@/lib/ticketImage';
import ImageSourceModal from '@/components/ImageSourceModal';
import { useImagePicker } from '@/hooks/useImagePicker';
import { usePendingGroupPhotoStore } from '@/store/usePendingGroupPhotoStore';

const BG = require('@/assets/images/bg.png');
const categorias = ['Viaje', 'Evento', 'Otro'];

const BUBBLE = {
  backgroundColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.18)',
} as const;

const BUBBLE_SELECTED = {
  backgroundColor: 'rgba(255,255,255,0.22)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.35)',
} as const;

const MONEDAS_DISPONIBLES: Moneda[] = [
  { codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', tasaARS: 1 },
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'U$S', tasaARS: 1050 },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€', tasaARS: 1200 },
  { codigo: 'GBP', nombre: 'Libra esterlina', simbolo: '£', tasaARS: 1350 },
  { codigo: 'BRL', nombre: 'Real brasileño', simbolo: 'R$', tasaARS: 210 },
  { codigo: 'UYU', nombre: 'Peso uruguayo', simbolo: '$U', tasaARS: 26 },
  { codigo: 'CLP', nombre: 'Peso chileno', simbolo: 'CL$', tasaARS: 1.1 },
];

export default function CrearGrupoScreen() {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Viaje');
  const [error, setError] = useState('');
  const [monedasSeleccionadas, setMonedasSeleccionadas] = useState<string[]>(['ARS']);
  const [tasasInput, setTasasInput] = useState<Record<string, string>>({ ARS: '1' });
  const [tasasModo, setTasasModo] = useState<Record<string, 'auto' | 'manual'>>({});
  const [errorMonedas, setErrorMonedas] = useState('');
  const [tipoOtro, setTipoOtro] = useState('');
  const [errorOtro, setErrorOtro] = useState('');
  const [foto, setFoto] = useState<ImagenElegida | null>(null);
  const setPendingGroupPhoto = usePendingGroupPhotoStore(s => s.setFoto);
  const handleFotoElegida = useCallback((imagen: ImagenElegida) => setFoto(imagen), []);
  const {
    sourceModalVisible: fotoSourceModal,
    setSourceModalVisible: setFotoSourceModal,
    pedirImagen: pedirFoto,
    pickerActivo,
    permisoDenegado,
    setPermisoDenegado,
  } = useImagePicker(handleFotoElegida);

  const fetchTasaParaCodigo = (codigo: string) => {
    fetchRatesMap().then(mapa => {
      if (!mapa?.[codigo]) return;
      setTasasInput(prev => ({ ...prev, [codigo]: String(mapa[codigo]) }));
    });
  };

  const handleContinuarPaso1 = () => {
    if (!nombre.trim()) { setError('El nombre del grupo es obligatorio.'); return; }
    if (categoria === 'Otro' && !tipoOtro.trim()) { setErrorOtro('Especificá el tipo de grupo.'); return; }
    setError(''); setErrorOtro(''); setPaso(2);
  };

  const toggleMoneda = (codigo: string) => {
    if (codigo === 'ARS') return;
    setErrorMonedas('');
    if (monedasSeleccionadas.includes(codigo)) {
      setMonedasSeleccionadas(prev => prev.filter(m => m !== codigo));
    } else {
      setMonedasSeleccionadas(prev => [...prev, codigo]);
      setTasasModo(prev => ({ ...prev, [codigo]: 'auto' }));
      fetchTasaParaCodigo(codigo);
    }
  };

  const handleContinuarPaso2 = () => {
    for (const codigo of monedasSeleccionadas) {
      if (codigo === 'ARS') continue;
      if (tasasModo[codigo] === 'manual') {
        const tasa = Number(tasasInput[codigo]);
        if (!tasa || tasa <= 0) { setErrorMonedas(`Ingresá un valor de conversión válido para ${codigo}.`); return; }
      }
    }
    setErrorMonedas('');
    const monedasConTasas = monedasSeleccionadas.map(codigo => {
      const moneda = MONEDAS_DISPONIBLES.find(m => m.codigo === codigo)!;
      return { ...moneda, tasaARS: Number(tasasInput[codigo]), tasaAuto: codigo !== 'ARS' ? tasasModo[codigo] !== 'manual' : undefined };
    });
    setPendingGroupPhoto(foto);
    router.push({ pathname: '/agregar-participantes', params: { nombreGrupo: nombre.trim(), categoria: categoria === 'Otro' ? tipoOtro.trim() : categoria, monedas: JSON.stringify(monedasConTasas) } });
  };

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        {paso === 2 ? (
          <TouchableOpacity onPress={() => setPaso(1)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.title}>{paso === 1 ? 'Nuevo Grupo' : 'Monedas del grupo'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.pasoIndicador}>
        <View style={[styles.pasoPunto, paso >= 1 && styles.pasoPuntoActivo]} />
        <View style={styles.pasoLinea} />
        <View style={[styles.pasoPunto, paso >= 2 && styles.pasoPuntoActivo]} />
      </View>

      {paso === 1 ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.paso1Content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.label}>Nombre del grupo</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="Nombre Del Grupo"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={nombre}
              onChangeText={(v) => { setNombre(v); setError(''); }}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {foto ? (
              <View style={styles.fotoPreviewWrap}>
                <Image source={{ uri: foto.uri }} style={styles.fotoPreview} contentFit="cover" />
                <View style={styles.fotoPreviewInfo}>
                  <Text style={styles.fotoPreviewTitle}>Foto del grupo</Text>
                  <View style={styles.fotoActions}>
                    <TouchableOpacity onPress={() => setFotoSourceModal(true)}>
                      <Text style={styles.fotoActionText}>Cambiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setFoto(null)}>
                      <Text style={[styles.fotoActionText, { color: '#FF4D4D' }]}>Quitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.fotoBox} onPress={() => setFotoSourceModal(true)}>
                <Ionicons name="camera-outline" size={28} color="rgba(255,255,255,0.3)" />
                <Text style={styles.fotoText}>Agregar Foto</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Tipo de grupo</Text>
            <View style={styles.categoriasRow}>
              {categorias.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoriaChip, categoria === cat && styles.categoriaChipActivo]}
                  onPress={() => { setCategoria(cat); setErrorOtro(''); setTipoOtro(''); }}
                >
                  <Text style={[styles.categoriaText, categoria === cat && styles.categoriaTextActivo]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {categoria === 'Otro' && (
              <View style={{ marginTop: 16 }}>
                <TextInput
                  style={[styles.input, errorOtro ? styles.inputError : null]}
                  placeholder="¿Qué tipo de grupo es?"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={tipoOtro}
                  onChangeText={(v) => { setTipoOtro(v); setErrorOtro(''); }}
                />
                {errorOtro ? <Text style={styles.errorText}>{errorOtro}</Text> : null}
              </View>
            )}
          </View>

          <View style={styles.botonesRow}>
            <TouchableOpacity style={styles.cancelarBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.cancelarText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continuarBtn} onPress={handleContinuarPaso1}>
              <Text style={styles.continuarText}>Continuar</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.paso2Content}>
          <Text style={styles.paso2Descripcion}>
            Elegí las monedas que el grupo va a usar. El peso argentino siempre está incluido.
          </Text>

          {MONEDAS_DISPONIBLES.map((m) => {
            const seleccionada = monedasSeleccionadas.includes(m.codigo);
            const esARS = m.codigo === 'ARS';
            return (
              <View key={m.codigo}>
                <TouchableOpacity
                  style={[styles.monedaChip, seleccionada && styles.monedaChipActivo, esARS && styles.monedaChipBase]}
                  onPress={() => toggleMoneda(m.codigo)}
                  disabled={esARS}
                >
                  <View style={styles.monedaChipLeft}>
                    <View style={[styles.monedaCheckbox, seleccionada && styles.monedaCheckboxActivo]}>
                      {seleccionada && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.monedaSimbolo}>{m.simbolo}</Text>
                    <View>
                      <Text style={styles.monedaCodigo}>{m.codigo}</Text>
                      <Text style={styles.monedaNombre}>{m.nombre}</Text>
                    </View>
                  </View>
                  {esARS && <Text style={styles.monedaBaseLabel}>Base</Text>}
                </TouchableOpacity>

                {seleccionada && !esARS && (
                  <View style={styles.tasaExpandida}>
                    <View style={styles.tasaModoRow}>
                      <TouchableOpacity
                        style={[styles.tasaModoBtn, tasasModo[m.codigo] !== 'manual' && styles.tasaModoBtnActivo]}
                        onPress={() => { setTasasModo(prev => ({ ...prev, [m.codigo]: 'auto' })); fetchTasaParaCodigo(m.codigo); }}
                      >
                        <Text style={[styles.tasaModoBtnText, tasasModo[m.codigo] !== 'manual' && styles.tasaModoBtnTextActivo]}>🔄 Tasa ChePaga</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tasaModoBtn, tasasModo[m.codigo] === 'manual' && styles.tasaModoBtnActivo]}
                        onPress={() => setTasasModo(prev => ({ ...prev, [m.codigo]: 'manual' }))}
                      >
                        <Text style={[styles.tasaModoBtnText, tasasModo[m.codigo] === 'manual' && styles.tasaModoBtnTextActivo]}>✏️ Manual</Text>
                      </TouchableOpacity>
                    </View>
                    {tasasModo[m.codigo] === 'manual' ? (
                      <View style={styles.tasaContainer}>
                        <Text style={styles.tasaLabel}>1 {m.codigo} equivale a</Text>
                        <TextInput
                          style={styles.tasaInput}
                          keyboardType="numeric"
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          placeholder="0"
                          placeholderTextColor="rgba(255,255,255,0.35)"
                          value={tasasInput[m.codigo] ?? ''}
                          onChangeText={v => { setTasasInput(prev => ({ ...prev, [m.codigo]: v })); setErrorMonedas(''); }}
                        />
                        <Text style={styles.tasaLabel}>ARS</Text>
                      </View>
                    ) : (
                      <Text style={styles.tasaAutoValor}>
                        1 {m.codigo} = ${Number(tasasInput[m.codigo] || 0).toLocaleString('es-AR')} ARS
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {errorMonedas ? <Text style={styles.errorText}>{errorMonedas}</Text> : null}
          <Text style={styles.paso2Nota}>Podés cambiar las monedas y las tasas en cualquier momento desde la configuración del grupo.</Text>

          <View style={styles.botonesRow}>
            <TouchableOpacity style={styles.cancelarBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.cancelarText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continuarBtn} onPress={handleContinuarPaso2}>
              <Text style={styles.continuarText}>Continuar</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <ConfirmPopup visible={permisoDenegado} emoji="🔒" titulo="Permiso necesario" mensaje="Para agregar una foto al grupo, habilitá el acceso a la cámara o las fotos desde la configuración de tu teléfono." onClose={() => setPermisoDenegado(false)} />
      <ImageSourceModal
        visible={fotoSourceModal}
        title="Foto del grupo"
        disabled={pickerActivo}
        onClose={() => setFotoSourceModal(false)}
        onPick={pedirFoto}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  pasoIndicador: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 16 },
  pasoPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.25)' },
  pasoPuntoActivo: { backgroundColor: '#FFFFFF' },
  pasoLinea: { width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 6 },
  body: { flex: 1 },
  paso1Content: { paddingHorizontal: 20, paddingTop: 4, flexGrow: 1 },
  paso2Content: { paddingHorizontal: 20, paddingTop: 4 },

  card: {
    backgroundColor: 'rgba(14,26,52,0.62)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 20, marginBottom: 20,
  },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  inputError: { borderColor: '#FF4D4D' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 4 },
  fotoBox: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed',
    height: 100, backgroundColor: 'rgba(255,255,255,0.04)', marginVertical: 16,
  },
  fotoText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  fotoPreviewWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(74,158,255,0.28)',
    backgroundColor: 'rgba(74,158,255,0.1)', padding: 10, marginVertical: 16,
  },
  fotoPreview: { width: 78, height: 78, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  fotoPreviewInfo: { flex: 1 },
  fotoPreviewTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  fotoActions: { flexDirection: 'row', gap: 18, marginTop: 8 },
  fotoActionText: { color: '#4A9EFF', fontSize: 14, fontWeight: '700' },
  categoriasRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 4 },
  categoriaChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    ...BUBBLE,
  },
  categoriaChipActivo: BUBBLE_SELECTED,
  categoriaText: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },
  categoriaTextActivo: { fontWeight: '700', color: '#FFFFFF' },
  botonesRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 20 },
  cancelarBtn: { flex: 1, backgroundColor: 'rgba(255,77,77,0.2)', borderRadius: 50, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,77,77,0.4)' },
  cancelarText: { color: '#FF4D4D', fontSize: 16, fontWeight: '700' },
  continuarBtn: { flex: 1, backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  continuarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  paso2Descripcion: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 16, lineHeight: 20 },
  monedaChip: {
    backgroundColor: 'rgba(14,26,52,0.62)', borderRadius: 14, padding: 14,
    marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  monedaChipActivo: BUBBLE_SELECTED,
  monedaChipBase: { opacity: 0.7 },
  monedaChipLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monedaCheckbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  monedaCheckboxActivo: { backgroundColor: '#4A9EFF', borderColor: '#4A9EFF' },
  monedaSimbolo: { fontSize: 20, width: 28, textAlign: 'center', color: '#FFFFFF' },
  monedaCodigo: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  monedaNombre: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  monedaBaseLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  tasaExpandida: { backgroundColor: 'rgba(74,158,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)' },
  tasaModoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tasaModoBtn: { flex: 1, ...BUBBLE, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  tasaModoBtnActivo: BUBBLE_SELECTED,
  tasaModoBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  tasaModoBtnTextActivo: { color: '#FFFFFF' },
  tasaAutoValor: { fontSize: 13, color: '#4A9EFF', fontWeight: '600', paddingVertical: 4 },
  tasaContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tasaLabel: { fontSize: 13, color: 'rgba(255,255,255,0.55)', flex: 1 },
  tasaInput: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: '#FFFFFF', width: 80, textAlign: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  paso2Nota: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 16, lineHeight: 18, fontStyle: 'italic', marginBottom: 20 },
});
