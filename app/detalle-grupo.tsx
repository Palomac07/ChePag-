import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, PanResponder, Animated, Dimensions, Alert, RefreshControl, ActivityIndicator, Keyboard, ImageBackground, Platform,
} from 'react-native';
import PagerView from '@/components/PagerViewCompat';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import ConfirmPopup from '@/components/ConfirmPopup';
import { useGruposStore, Moneda } from '@/store/useGruposStore';
import { useUserStore } from '@/store/useUserStore';
import GraficoCircular from '@/components/GraficoCircular';
import { StorageAccessFramework, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { supabase } from '@/lib/supabase';
import { needsRatesFetch, fetchRatesMap } from '@/lib/ratesCache';
import { useAmistadStore } from '@/store/useAmistadStore';
import { getSignedUrl, deleteTicket, uploadTicket, type ImagenElegida } from '@/lib/ticketImage';
import ZoomableImage from '@/components/ZoomableImage';
import InvitarSheet from '@/components/InvitarSheet';
import { CHEPAGA_LOGO_DATA_URI } from '@/constants/logoBase64';
import ImageSourceModal from '@/components/ImageSourceModal';
import { useImagePicker } from '@/hooks/useImagePicker';
import { firstName, firstNameOr } from '@/lib/displayName';

const BG = require('@/assets/images/bg.png');

// Carpeta de descargas elegida una sola vez (SAF). Se recuerda para descargar directo después.
const DOWNLOAD_DIR_KEY = 'chepaga_download_dir_uri';

const TABS = ['A Pagar', 'Gastos', 'Balance', 'Ranking', 'Miembros', 'Presupuesto'];

const MONEDAS_DISPONIBLES: Moneda[] = [
  { codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', tasaARS: 1 },
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'U$S', tasaARS: 1050 },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€', tasaARS: 1200 },
  { codigo: 'GBP', nombre: 'Libra esterlina', simbolo: '£', tasaARS: 1350 },
  { codigo: 'BRL', nombre: 'Real brasileño', simbolo: 'R$', tasaARS: 210 },
  { codigo: 'UYU', nombre: 'Peso uruguayo', simbolo: '$U', tasaARS: 26 },
  { codigo: 'CLP', nombre: 'Peso chileno', simbolo: 'CL$', tasaARS: 1.1 },
];


type Gasto = { id: string; nombre: string; pagador: string; pagador_id: string; fecha: string; monto: number; participantes: string[]; participantesData: { id: string; nombre: string }[]; moneda: string; fotoPath: string | null; categoria: string };

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d.getDate()} ${meses[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type MiembroRef = { user_id: string; nombre: string };

// Saldos por identidad estable (user_id) para que un cambio de nombre no parta a
// una persona en dos. Se devuelve igual { nombre, monto } con el nombre canónico
// del miembro, así el resto de la pantalla (que matchea por nombre) no cambia.
function calcularBalance(gastos: Gasto[], monedas: Moneda[], pagos: { de: string; a: string; monto: number }[] = [], miembros: MiembroRef[] = []) {
  const monedasMap: Record<string, Moneda> = {};
  for (const m of monedas) monedasMap[m.codigo] = m;

  const nombreToId: Record<string, string> = {};
  const idToNombre: Record<string, string> = {};
  for (const m of miembros) { if (m.nombre) nombreToId[m.nombre] = m.user_id; if (m.user_id) idToNombre[m.user_id] = m.nombre; }
  for (const g of gastos) {
    if (g.pagador_id && g.pagador && !idToNombre[g.pagador_id]) idToNombre[g.pagador_id] = g.pagador;
    if (g.pagador && !nombreToId[g.pagador]) nombreToId[g.pagador] = g.pagador_id || '';
    for (const p of g.participantesData ?? []) {
      if (p.id && p.nombre && !idToNombre[p.id]) idToNombre[p.id] = p.nombre;
      if (p.nombre && !nombreToId[p.nombre]) nombreToId[p.nombre] = p.id || '';
    }
  }
  const idDe = (nombre?: string, id?: string) =>
    (id && id.length ? id : (nombre ? (nombreToId[nombre] || `n:${nombre}`) : 'desconocido'));
  const nombreDe = (id: string) => idToNombre[id] || (id.startsWith('n:') ? id.slice(2) : id);

  const saldos: Record<string, number> = {};
  for (const g of gastos) {
    const tasa = monedasMap[g.moneda]?.tasaARS ?? 1;
    const montoARS = g.monto * tasa;
    const partIds = (g.participantesData?.length ? g.participantesData.map(p => idDe(p.nombre, p.id)) : g.participantes.map(n => idDe(n)));
    const parte = partIds.length ? montoARS / partIds.length : 0;
    const payerId = idDe(g.pagador, g.pagador_id);
    saldos[payerId] = (saldos[payerId] ?? 0) + montoARS;
    for (const pid of partIds) saldos[pid] = (saldos[pid] ?? 0) - parte;
  }
  for (const p of pagos) {
    const deId = idDe(p.de);
    const aId = idDe(p.a);
    saldos[deId] = (saldos[deId] ?? 0) + p.monto;
    saldos[aId] = (saldos[aId] ?? 0) - p.monto;
  }
  return Object.entries(saldos).map(([id, monto]) => ({ nombre: nombreDe(id), monto: Math.round(monto) }));
}

function calcularDeudas(gastos: Gasto[], monedas: Moneda[], pagos: { de: string; a: string; monto: number }[] = [], miembros: MiembroRef[] = []) {
  const saldos = calcularBalance(gastos, monedas, pagos, miembros);
  const deudores = saldos.filter(s => s.monto < 0).sort((a, b) => a.monto - b.monto);
  const acreedores = saldos.filter(s => s.monto > 0).sort((a, b) => b.monto - a.monto);
  const deudas: { de: string; a: string; monto: number }[] = [];
  const d = deudores.map(x => ({ ...x }));
  const a = acreedores.map(x => ({ ...x }));
  let i = 0, j = 0;
  while (i < d.length && j < a.length) {
    const pago = Math.min(-d[i].monto, a[j].monto);
    deudas.push({ de: d[i].nombre, a: a[j].nombre, monto: Math.round(pago) });
    d[i].monto += pago;
    a[j].monto -= pago;
    if (Math.abs(d[i].monto) < 1) i++;
    if (Math.abs(a[j].monto) < 1) j++;
  }
  return deudas;
}

const titulos = [
  'El que siempre invita',
  'El más equilibrado',
  'Casi equilibrado',
  'Zafa bastante',
  'Va quedando atrás',
  'El más colgado',
  'El más rata',
];

export default function DetalleGrupoScreen() {
  const router = useRouter();
  const { nombre, id } = useLocalSearchParams<{ nombre: string; id: string }>();
  const grupo = useGruposStore(s => s.grupos.find(g => g.id === id));
  const emoji = grupo ? (grupo.categoria === 'Viaje' ? '✈️' : grupo.categoria === 'Evento' ? '🎉' : '👥') : '👥';
  const pausarGrupo = useGruposStore(s => s.pausarGrupo);
  const reanudarGrupo = useGruposStore(s => s.reanudarGrupo);
  const salirGrupo = useGruposStore(s => s.salirGrupo);
  const eliminarGrupo = useGruposStore(s => s.eliminarGrupo);
  const actualizarMonedas = useGruposStore(s => s.actualizarMonedas);
  const hacerAdmin = useGruposStore(s => s.hacerAdmin);
  const quitarAdmin = useGruposStore(s => s.quitarAdmin);
  const eliminarMiembro = useGruposStore(s => s.eliminarMiembro);
  const actualizarRanking = useGruposStore(s => s.actualizarRanking);
  const grupoPausado = useGruposStore(s => s.grupos.find(g => g.id === id)?.activo === false);

  const userId = useUserStore(s => s.id);
  const miNombre = useUserStore(s => s.nombre);
  const guardarPresupuestoDB = useGruposStore(s => s.guardarPresupuesto);
  const miembrosGrupo = grupo?.miembros ?? [];
  const monedas = grupo?.monedas ?? [{ codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', tasaARS: 1 }];
  const administradores = grupo?.administradores ?? [];
  const esAdmin = miembrosGrupo.some(m => m.user_id === userId && m.es_admin) || (!!miNombre && administradores.includes(miNombre));
  const esCreador = grupo?.creador_id === userId;
  const rankingActivo = grupo?.rankingActivo !== false;

  const amigosStore = useAmistadStore(s => s.amigos);
  const solicitudesEnviadasStore = useAmistadStore(s => s.solicitudesEnviadas);
  const cargarAmigos = useAmistadStore(s => s.cargarAmigos);
  const cargarSolicitudesEnviadas = useAmistadStore(s => s.cargarSolicitudesEnviadas);
  const enviarSolicitud = useAmistadStore(s => s.enviarSolicitud);
  const eliminarAmigo = useAmistadStore(s => s.eliminarAmigo);

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ticketUrl, setTicketUrl] = useState<string | null>(null);
  const [ticketVisible, setTicketVisible] = useState(false);
  const [ticketCargando, setTicketCargando] = useState(false);
  const [invitarVisible, setInvitarVisible] = useState(false);
  const [pagosDB, setPagosDB] = useState<{ de: string; a: string; monto: number }[]>([]);

  const abrirTicket = async (path: string) => {
    setTicketUrl(null);
    setTicketCargando(true);
    setTicketVisible(true);
    const url = await getSignedUrl(path);
    setTicketUrl(url);
    setTicketCargando(false);
  };
  const [pagosPendientesLocal, setPagosPendientesLocal] = useState<{ de: string; a: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [gastoDetalle, setGastoDetalle] = useState<Gasto | null>(null);
  const [gastoAEliminar, setGastoAEliminar] = useState<Gasto | null>(null);
  const [eliminandoGasto, setEliminandoGasto] = useState(false);
  const [miembroAEliminar, setMiembroAEliminar] = useState<MiembroRef | null>(null);
  const [eliminandoMiembro, setEliminandoMiembro] = useState(false);

  const abrirTicketDesdeDetalle = (path: string) => {
    setGastoDetalle(null);
    setTimeout(() => {
      abrirTicket(path);
    }, 350);
  };

  const cargarDatos = useCallback(async (esRefresh = false) => {
    if (!id) return;
    if (esRefresh) setRefrescando(true); else setCargando(true);
    const [{ data: gastosData }, { data: pagosData }, { data: pendientesData }] = await Promise.all([
      supabase.from('gastos').select('*').eq('grupo_id', id).order('fecha', { ascending: false }),
      supabase.from('pagos').select('de_nombre, a_nombre, monto').eq('grupo_id', id),
      supabase.from('notificaciones').select('data').eq('tipo', 'pago_pendiente').eq('sender_id', userId ?? '').eq('leida', false),
    ]);
    if (gastosData) setGastos(gastosData.map((g: any) => ({
      id: g.id,
      nombre: g.nombre,
      pagador: g.pagador_nombre,
      pagador_id: g.pagador_id,
      fecha: formatearFecha(g.fecha ?? g.created_at),
      monto: g.monto,
      participantes: (g.participantes as any[] ?? []).map((p: any) => p.nombre ?? p),
      participantesData: (g.participantes as any[] ?? []).map((p: any) =>
        typeof p === 'string' ? { id: '', nombre: p } : { id: p.user_id ?? '', nombre: p.nombre ?? '' }),
      moneda: g.moneda,
      fotoPath: g.foto_path ?? null,
      categoria: g.categoria ?? '',
    })));
    if (pagosData) setPagosDB(pagosData.map((p: any) => ({ de: p.de_nombre, a: p.a_nombre, monto: p.monto })));
    if (pendientesData) {
      const pendientes = pendientesData
        .filter((n: any) => n.data?.grupo_id === id)
        .map((n: any) => ({ de: n.data.de_nombre, a: n.data.a_nombre }));
      setPagosPendientesLocal(pendientes);
    }
    if (esRefresh) setRefrescando(false); else setCargando(false);
  }, [id, userId]);

  useFocusEffect(useCallback(() => {
    cargarDatos();
    if (userId) {
      cargarAmigos(userId);
      cargarSolicitudesEnviadas(userId);
    }
  }, [cargarDatos, userId]));

  useEffect(() => {
    if (grupo?.presupuesto != null) setPresupuesto(grupo.presupuesto);
  }, [grupo?.presupuesto]);

  const monedasMap: Record<string, Moneda> = {};
  for (const m of monedas) monedasMap[m.codigo] = m;
  const tieneVariasMonedas = monedas.length > 1;

  const [tabActivo, setTabActivo] = useState('Gastos');
  const pagerRef = useRef<PagerView>(null);
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const backTranslateX = useRef(new Animated.Value(0)).current;
  const backPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => { if (g.dx > 0) backTranslateX.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SCREEN_WIDTH * 0.3 || g.vx > 0.5) {
        Animated.timing(backTranslateX, { toValue: SCREEN_WIDTH, duration: 180, useNativeDriver: true }).start(() => {
          if (router.canGoBack()) router.back(); else router.replace('/(tabs)/grupos');
          backTranslateX.setValue(0);
        });
      } else {
        Animated.spring(backTranslateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(backTranslateX, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  const [popup, setPopup] = useState<{ visible: boolean; emoji: string; titulo: string; mensaje: string }>({
    visible: false, emoji: '', titulo: '', mensaje: '',
  });
  const [popupEliminarAmigo, setPopupEliminarAmigo] = useState<{ visible: boolean; amistadId: string; amigoUserId: string; amigoNombre: string } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [popupConfirm, setPopupConfirm] = useState<{ visible: boolean; accion: 'salir' | 'pausar' | 'eliminarGrupo' | null }>({ visible: false, accion: null });
  const [presupuesto, setPresupuesto] = useState<number | null>(grupo?.presupuesto ?? null);
  const [inputPresupuesto, setInputPresupuesto] = useState('');
  const [editandoPresupuesto, setEditandoPresupuesto] = useState(false);
  const [popupSobrePresupuesto, setPopupSobrePresupuesto] = useState(false);
  const [errorPresupuesto, setErrorPresupuesto] = useState('');
  const [conversionAbierta, setConversionAbierta] = useState<number | null>(null);
  const [configVisible, setConfigVisible] = useState(false);
  const [monedasEditando, setMonedasEditando] = useState<Moneda[]>([]);
  const [rankingEditando, setRankingEditando] = useState(true);
  const [tasasInput, setTasasInput] = useState<Record<string, string>>({});
  const [agregarMonedaOpen, setAgregarMonedaOpen] = useState(false);
  const [errorConfig, setErrorConfig] = useState('');
  const [tasasModo, setTasasModo] = useState<Record<string, 'auto' | 'manual'>>({});
  const [monedaHistorial, setMonedaHistorial] = useState('ARS');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [configFoto, setConfigFoto] = useState<ImagenElegida | null>(null);
  const [configFotoUrl, setConfigFotoUrl] = useState<string | null>(null);
  const [configFotoPath, setConfigFotoPath] = useState<string | null>(null);
  const [configFotoQuitada, setConfigFotoQuitada] = useState(false);
  const [configFotoPickerEnCurso, setConfigFotoPickerEnCurso] = useState(false);

  const handleConfigFotoElegida = useCallback((imagen: ImagenElegida) => {
    setConfigFoto(imagen);
    setConfigFotoUrl(imagen.uri);
    setConfigFotoQuitada(false);
    setErrorConfig('');
  }, []);

  const {
    sourceModalVisible: configFotoSourceModalVisible,
    setSourceModalVisible: setConfigFotoSourceModalVisible,
    pedirImagen: pedirConfigFoto,
    pickerActivo: configFotoPickerActivo,
    permisoDenegado: configFotoPermisoDenegado,
    setPermisoDenegado: setConfigFotoPermisoDenegado,
  } = useImagePicker(handleConfigFotoElegida);

  const abrirConfigFotoOpciones = () => {
    setConfigVisible(false);
    setTimeout(() => setConfigFotoSourceModalVisible(true), 350);
  };

  const cerrarConfigFotoOpciones = () => {
    setConfigFotoSourceModalVisible(false);
    setTimeout(() => setConfigVisible(true), 350);
  };

  const pedirConfigFotoDesdeConfig = (origen: 'camara' | 'galeria') => {
    setConfigFotoPickerEnCurso(true);
    pedirConfigFoto(origen);
  };

  useEffect(() => {
    if (!configFotoPickerEnCurso || configFotoSourceModalVisible || configFotoPickerActivo) return;
    const timer = setTimeout(() => {
      setConfigVisible(true);
      setConfigFotoPickerEnCurso(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [configFotoPickerEnCurso, configFotoPickerActivo, configFotoSourceModalVisible]);

  // En Android guarda el archivo en la carpeta que elija el usuario (descarga real).
  // En iOS abre la hoja de compartir, cuyo "Guardar en Archivos" es la descarga nativa.
  const guardarArchivo = async (
    fileUri: string,
    fileName: string,
    mimeType: string,
    contents: string,
    encoding: 'utf8' | 'base64',
  ) => {
    if (Platform.OS === 'android') {
      try {
        // Pedimos la carpeta una sola vez; después descargamos directo sin volver a preguntar.
        let dirUri = await AsyncStorage.getItem(DOWNLOAD_DIR_KEY);
        if (!dirUri) {
          const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (perm.granted) {
            dirUri = perm.directoryUri;
            await AsyncStorage.setItem(DOWNLOAD_DIR_KEY, dirUri);
          }
        }
        if (dirUri) {
          const destUri = await StorageAccessFramework.createFileAsync(dirUri, fileName, mimeType);
          await writeAsStringAsync(destUri, contents, { encoding });
          mostrarPopup('✅', 'Descargado', `"${fileName}" se guardó en tu carpeta de descargas.`);
          return;
        }
      } catch {
        // La carpeta guardada ya no es válida (borrada o revocada): la olvidamos y compartimos.
        await AsyncStorage.removeItem(DOWNLOAD_DIR_KEY);
      }
    }
    // iOS: esperar a que el modal de exportar termine de cerrarse antes de presentar
    // la hoja de compartir. Si se presenta mientras el modal se está cerrando, iOS
    // puede descartar la presentación.
    if (Platform.OS === 'ios') await new Promise(r => setTimeout(r, 500));
    await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: 'Guardar o compartir' });
  };

  const exportarPDF = async () => {
    setExportModalVisible(false);
    if (Platform.OS !== 'android' && !(await Sharing.isAvailableAsync())) {
      mostrarPopup('ℹ️', 'No disponible', 'La exportación está disponible en la app móvil.');
      return;
    }
    try {
      const gastosGrupo = gastos;
      const balancePDF = calcularBalance(gastosGrupo, monedas, [], miembrosGrupo);
      const deudasPDF = calcularDeudas(gastosGrupo, monedas, [], miembrosGrupo);
      const totalARS = gastosGrupo.reduce((acc, g) => acc + g.monto * (monedasMap[g.moneda]?.tasaARS ?? 1), 0);
      const filasGastos = gastosGrupo.map(g => `<tr><td>${g.nombre}</td><td>${firstNameOr(g.pagador)}</td><td>${g.fecha}</td><td class="amount">${g.moneda !== 'ARS' ? `${g.moneda} ${g.monto.toLocaleString('es-AR')}` : `$${g.monto.toLocaleString('es-AR')}`}</td><td>${g.participantes.map(p => firstNameOr(p)).join(', ')}</td></tr>`).join('');
      const filasBalance = balancePDF.map(b => `<tr><td>${firstNameOr(b.nombre)}</td><td style="text-align:right"><span class="pill ${b.monto >= 0 ? 'pos' : 'neg'}">${b.monto >= 0 ? '+' : '−'}$${Math.abs(b.monto).toLocaleString('es-AR')}</span></td></tr>`).join('');
      const filasDeudas = deudasPDF.map(d => `<tr><td><strong>${firstNameOr(d.de)}</strong></td><td class="arrow">→</td><td><strong>${firstNameOr(d.a)}</strong></td><td class="amount">$${d.monto.toLocaleString('es-AR')}</td></tr>`).join('');
      const seccionDeudas = deudasPDF.length > 0
        ? `<div class="card"><table><thead><tr><th>De</th><th></th><th>A</th><th style="text-align:right">Monto</th></tr></thead><tbody>${filasDeudas}</tbody></table></div>`
        : `<div class="saldado">✅ ¡Todo saldado! No hay deudas pendientes.</div>`;
      const fechaReporte = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
      const totalFmt = `$${Math.round(totalARS).toLocaleString('es-AR')}`;
      const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box;}body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:28px 26px 36px;color:#1F2A44;background:#fff;}.header{background:#E8F1FB;border:1px solid #D3E2F2;border-radius:18px;padding:22px 18px 20px;text-align:center;}.header img{width:96px;height:96px;display:block;margin:0 auto 6px;border-radius:14px;}.header h1{color:#2B4C8C;font-size:24px;margin:2px 0;font-weight:800;letter-spacing:-0.3px;}.header .sub{color:#6B7A99;font-size:12.5px;margin:0;}.chips{width:100%;border-collapse:separate;border-spacing:10px 0;margin:14px 0 2px;}.chips td{width:33.33%;padding:0;}.chip{background:#F6F9FD;border:1px solid #E6ECF5;border-radius:14px;padding:12px 8px;text-align:center;}.chip .v{font-size:18px;font-weight:800;color:#2B4C8C;}.chip .l{font-size:10px;color:#7385A8;text-transform:uppercase;letter-spacing:0.6px;margin-top:3px;}h2{color:#2B4C8C;font-size:12.5px;text-transform:uppercase;letter-spacing:0.8px;margin:26px 0 10px;padding-left:10px;border-left:4px solid #F5A623;page-break-after:avoid;}.card{border:1px solid #E6ECF5;border-radius:14px;overflow:hidden;}table{width:100%;border-collapse:collapse;font-size:12.5px;}th{background:#E8F1FB;color:#2B4C8C;padding:9px 12px;text-align:left;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:0.4px;}td{padding:9px 12px;border-top:1px solid #EEF2F8;color:#27324D;}tbody tr:nth-child(even){background:#FAFCFE;}tr{page-break-inside:avoid;}.amount{text-align:right;font-weight:600;white-space:nowrap;}.pill{display:inline-block;padding:3px 11px;border-radius:999px;font-weight:700;font-size:12px;}.pill.pos{background:#E7F6EC;color:#1E7A37;}.pill.neg{background:#FCE9E9;color:#C0392B;}.arrow{color:#F5A623;font-weight:800;text-align:center;}.total{font-weight:800;font-size:14px;margin:10px 4px 0;text-align:right;color:#2B4C8C;}.saldado{background:#E7F6EC;color:#1E7A37;border:1px solid #BFE6CB;border-radius:14px;padding:16px;text-align:center;font-weight:700;font-size:13px;}.footer{margin-top:30px;text-align:center;color:#9AA7C2;font-size:10px;border-top:1px solid #EEF2F8;padding-top:12px;}</style></head><body><div class="header"><img src="${CHEPAGA_LOGO_DATA_URI}" alt="ChePagá" /><h1>${nombre ?? 'Grupo'}</h1><p class="sub">Reporte generado el ${fechaReporte}</p></div><table class="chips"><tr><td><div class="chip"><div class="v">${totalFmt}</div><div class="l">Total ARS</div></div></td><td><div class="chip"><div class="v">${gastosGrupo.length}</div><div class="l">Gastos</div></div></td><td><div class="chip"><div class="v">${balancePDF.length}</div><div class="l">Personas</div></div></td></tr></table><h2>Gastos</h2><div class="card"><table><thead><tr><th>Nombre</th><th>Pagador</th><th>Fecha</th><th style="text-align:right">Monto</th><th>Participantes</th></tr></thead><tbody>${filasGastos}</tbody></table></div><p class="total">Total: ${totalFmt} ARS</p><h2>Balance</h2><div class="card"><table><thead><tr><th>Miembro</th><th style="text-align:right">Balance</th></tr></thead><tbody>${filasBalance}</tbody></table></div><h2>A pagar</h2>${seccionDeudas}<div class="footer">Generado con ChePagá · chepaga.app</div></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
      await guardarArchivo(uri, `${nombre ?? 'grupo'}_reporte.pdf`, 'application/pdf', base64, 'base64');
    } catch (e) {
      Alert.alert('Error PDF', String(e));
    }
  };

  const handleEnviarSolicitud = async (receptorId: string) => {
    if (!userId) return;
    const result = await enviarSolicitud(userId, receptorId);
    if (result.error) {
      mostrarPopup('❌', 'Error', result.error);
    } else {
      await cargarSolicitudesEnviadas(userId);
      mostrarPopup('👋', '¡Solicitud enviada!', 'El usuario recibió tu solicitud de amistad.');
    }
  };

  const mostrarPopup = (emoji: string, titulo: string, mensaje: string) => {
    setPopup({ visible: true, emoji, titulo, mensaje });
  };

  const abrirConfig = () => {
    const copia = grupo?.monedas ?? [{ codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', tasaARS: 1 }];
    setMonedasEditando([...copia]);
    const inputs: Record<string, string> = {};
    const modos: Record<string, 'auto' | 'manual'> = {};
    for (const m of copia) {
      inputs[m.codigo] = String(m.tasaARS);
      if (m.codigo !== 'ARS') modos[m.codigo] = m.tasaAuto === false ? 'manual' : 'auto';
    }
    setTasasInput(inputs);
    setTasasModo(modos);
    setRankingEditando(rankingActivo);
    setConfigFoto(null);
    setConfigFotoPath(grupo?.fotoPath ?? null);
    setConfigFotoUrl(grupo?.fotoUrl ?? null);
    setConfigFotoQuitada(false);
    setAgregarMonedaOpen(false);
    setErrorConfig('');
    setMenuVisible(false);
    setConfigVisible(true);
    const autoCodigos = Object.entries(modos).filter(([, v]) => v === 'auto').map(([k]) => k);
    if (autoCodigos.length > 0) {
      fetchRatesMap().then(mapa => {
        if (!mapa) return;
        setTasasInput(prev => {
          const u = { ...prev };
          for (const codigo of autoCodigos) { if (mapa[codigo]) u[codigo] = String(mapa[codigo]); }
          return u;
        });
        setMonedasEditando(prev => prev.map(m =>
          m.codigo === 'ARS' || modos[m.codigo] === 'manual' ? m : { ...m, tasaARS: mapa[m.codigo] ?? m.tasaARS }
        ));
      });
    }
  };

  const agregarMonedaAConfig = (m: Moneda) => {
    setMonedasEditando(prev => [...prev, m]);
    setTasasInput(prev => ({ ...prev, [m.codigo]: String(m.tasaARS) }));
    setTasasModo(prev => ({ ...prev, [m.codigo]: 'auto' }));
    setAgregarMonedaOpen(false);
    fetchRatesMap().then(mapa => {
      if (!mapa?.[m.codigo]) return;
      setTasasInput(prev => ({ ...prev, [m.codigo]: String(mapa[m.codigo]) }));
      setMonedasEditando(prev => prev.map(mon => mon.codigo === m.codigo ? { ...mon, tasaARS: mapa[m.codigo] } : mon));
    });
  };

  const eliminarMonedaDeConfig = (codigo: string) => {
    setMonedasEditando(prev => prev.filter(m => m.codigo !== codigo));
  };

  const quitarConfigFoto = () => {
    setConfigFoto(null);
    setConfigFotoUrl(null);
    setConfigFotoQuitada(true);
    setErrorConfig('');
  };

  const guardarConfig = async () => {
    for (const m of monedasEditando) {
      if (m.codigo !== 'ARS' && tasasModo[m.codigo] === 'manual') {
        const tasa = Number(tasasInput[m.codigo]);
        if (!tasa || tasa <= 0) {
          setErrorConfig(`Ingresá un valor válido para ${m.nombre}.`);
          return;
        }
      }
    }
    if (configFoto && (!id || !userId)) {
      setErrorConfig('No se pudo guardar la foto del grupo. Volve a iniciar sesion e intentalo de nuevo.');
      return;
    }
    const guardadas = monedasEditando.map(m => ({
      ...m,
      tasaARS: m.codigo === 'ARS' ? 1 : Number(tasasInput[m.codigo]),
      tasaAuto: m.codigo !== 'ARS' ? tasasModo[m.codigo] !== 'manual' : undefined,
    }));
    let fotoPathFinal = configFotoQuitada ? null : configFotoPath;
    if (configFoto && id && userId) {
      const subida = await uploadTicket(userId, id, configFoto.base64);
      if (!subida) {
        setErrorConfig('No se pudo subir la foto del grupo. Intentalo de nuevo.');
        return;
      }
      fotoPathFinal = subida;
    }
    const guardadasConFoto = guardadas.map((m, index) => {
      const { fotoPath: _fotoPath, ...monedaSinFoto } = m;
      return index === 0 && fotoPathFinal ? { ...monedaSinFoto, fotoPath: fotoPathFinal } : monedaSinFoto;
    });
    if (id) {
      await actualizarMonedas(id, guardadasConFoto);
      actualizarRanking(id, rankingEditando);
    }
    if (configFotoPath && configFotoPath !== fotoPathFinal) {
      deleteTicket(configFotoPath);
    }
    if (!rankingEditando && tabActivo === 'Ranking') {
      setTabActivo(TABS[balanceIndex]);
      pagerRef.current?.setPage(balanceIndex);
    }
    setConfigVisible(false);
    mostrarPopup('✅', '¡Configuración guardada!', 'Los cambios fueron aplicados al grupo.');
  };

  const balance = calcularBalance(gastos, monedas, pagosDB, miembrosGrupo);
  const deudas = calcularDeudas(gastos, monedas, pagosDB, miembrosGrupo);
  const rankingIndex = TABS.indexOf('Ranking');
  const balanceIndex = TABS.indexOf('Balance');

  const avisarRankingDesactivado = () => {
    mostrarPopup('', 'Ranking desactivado', 'El ranking esta desactivado para este grupo. Podes activarlo desde la configuracion del grupo.');
  };

  const irATab = (tab: string) => {
    const index = TABS.indexOf(tab);
    if (tab === 'Ranking' && !rankingActivo) {
      avisarRankingDesactivado();
      return;
    }
    setTabActivo(tab);
    pagerRef.current?.setPage(index);
  };

  const maxMonto = Math.max(...balance.map(b => Math.abs(b.monto)), 1);
  const totalGastado = gastos.reduce((sum: number, g: Gasto) => sum + g.monto * (monedasMap[g.moneda]?.tasaARS ?? 1), 0);
  const porcentajeGastado = presupuesto ? Math.min((totalGastado / presupuesto) * 100, 100) : 0;
  const sobrepasa = presupuesto ? totalGastado > presupuesto : false;

  const guardarPresupuesto = () => {
    const valor = Number(inputPresupuesto.replace(/\D/g, ''));
    if (!valor || valor <= 0) { setErrorPresupuesto('Ingresá un monto válido mayor a $0.'); return; }
    if (valor < totalGastado) {
      setPopupSobrePresupuesto(true);
      return;
    }
    setPresupuesto(valor);
    setEditandoPresupuesto(false);
    setErrorPresupuesto('');
    if (id) guardarPresupuestoDB(id, valor);
    mostrarPopup('✅', '¡Presupuesto guardado!', `El presupuesto del grupo es $${valor.toLocaleString('es-AR')}.`);
  };

  const actualizarTasas = useCallback(async () => {
    const monedasActuales = grupo?.monedas ?? [];
    if (!id || !monedasActuales.some(m => m.codigo !== 'ARS' && m.tasaAuto !== false)) return;
    const mapa = await fetchRatesMap();
    if (!mapa) return;
    const actualizadas = monedasActuales.map(m =>
      m.codigo === 'ARS' || m.tasaAuto === false ? m : { ...m, tasaARS: mapa[m.codigo] ?? m.tasaARS }
    );
    actualizarMonedas(id, actualizadas);
  }, [id, grupo?.monedas, actualizarMonedas]);

  useEffect(() => {
    if (needsRatesFetch()) actualizarTasas();
  }, [actualizarTasas]);

  const monedasDisponiblesParaAgregar = MONEDAS_DISPONIBLES.filter(
    m => !monedasEditando.some(e => e.codigo === m.codigo)
  );

  // Solo el pagador del gasto o un admin del grupo pueden editar/eliminar.
  const puedeModificarGasto = (g: Gasto) => !grupoPausado && (g.pagador_id === userId || esAdmin);

  const handleEditarGasto = (g: Gasto) => {
    router.push({
      pathname: '/agregar-gasto',
      params: {
        modo: 'editar',
        gastoId: g.id,
        grupoId: id ?? '',
        nombreGasto: g.nombre,
        monto: String(g.monto),
        moneda: g.moneda,
        categoria: g.categoria,
        pagadorId: g.pagador_id,
        pagadorNombre: g.pagador,
        participantes: JSON.stringify(g.participantesData.map(p => ({ user_id: p.id, nombre: p.nombre }))),
        fotoPath: g.fotoPath ?? '',
      },
    });
  };

  const handleEliminarGasto = async () => {
    const g = gastoAEliminar;
    if (!g || eliminandoGasto) return;
    setEliminandoGasto(true);
    const { error } = await supabase.from('gastos').delete().eq('id', g.id);
    setEliminandoGasto(false);
    if (error) {
      setGastoAEliminar(null);
      mostrarPopup('❌', 'Error', 'No se pudo eliminar el gasto. Intentá de nuevo.');
      return;
    }
    if (g.fotoPath) deleteTicket(g.fotoPath); // borrado del comprobante en segundo plano
    setGastos(prev => prev.filter(x => x.id !== g.id));
    setGastoAEliminar(null);
    mostrarPopup('🗑️', 'Gasto eliminado', `"${g.nombre}" fue eliminado y los balances se actualizaron.`);
  };

  // Un admin puede expulsar a cualquier miembro (incluido otro admin), menos al
  // creador del grupo y menos a sí mismo (para eso está "Salir del grupo").
  const puedeEliminarMiembro = (m: MiembroRef) =>
    esAdmin && !grupoPausado && m.user_id !== userId && m.user_id !== grupo?.creador_id;

  const handleEliminarMiembro = async () => {
    const m = miembroAEliminar;
    if (!m || eliminandoMiembro || !id) return;
    setEliminandoMiembro(true);
    const ok = await eliminarMiembro(id, m.user_id);
    if (ok) {
      await supabase.from('notificaciones').insert({
        user_id: m.user_id,
        sender_id: userId,
        tipo: 'removido_grupo',
        titulo: 'Te quitaron de un grupo',
        mensaje: `Un administrador te quitó del grupo "${nombre ?? ''}".`,
        data: { grupo_id: id, grupo_nombre: nombre },
      });
    }
    setEliminandoMiembro(false);
    setMiembroAEliminar(null);
    if (ok) mostrarPopup('👋', 'Miembro eliminado', `${firstNameOr(m.nombre)} ya no forma parte del grupo.`);
    else mostrarPopup('❌', 'Error', 'No se pudo eliminar al miembro. Intentá de nuevo.');
  };

  const handleMarcarPagado = async (item: { de: string; a: string; monto: number }) => {
    const acreedorMiembro = miembrosGrupo.find(m => m.nombre === item.a);
    const deudorMiembro = miembrosGrupo.find(m => m.nombre === item.de);
    if (!acreedorMiembro) return;
    const { error } = await supabase.from('notificaciones').insert({
      user_id: acreedorMiembro.user_id,
      sender_id: userId,
      tipo: 'pago_pendiente',
      titulo: 'Confirmación de pago',
      mensaje: `${firstNameOr(item.de)} dice que te pagó $${item.monto.toLocaleString('es-AR')} en ${nombre ?? 'el grupo'}. ¿Confirmás?`,
      data: {
        grupo_id: id,
        grupo_nombre: nombre,
        de_nombre: item.de,
        a_nombre: item.a,
        monto: item.monto,
        debtor_user_id: deudorMiembro?.user_id ?? null,
      },
    });
    if (error) { mostrarPopup('❌', 'Error', 'No se pudo enviar el aviso. Asegurate de tener conexión.'); return; }
    setPagosPendientesLocal(prev => [...prev, { de: item.de, a: item.a }]);
    mostrarPopup('⏳', 'Pago enviado', `Le avisamos a ${firstNameOr(item.a)} que ${firstNameOr(item.de)} le pagó. Esperá su confirmación.`);
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: backTranslateX }] }}>
      <ImageBackground source={BG} style={styles.container} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
        <View style={styles.backEdgeZone} {...backPanResponder.panHandlers} />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/grupos')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            {grupo?.fotoUrl ? (
              <Image source={{ uri: grupo.fotoUrl }} style={styles.headerPhoto} contentFit="cover" />
            ) : (
              <Text style={styles.titleEmoji}>{emoji}</Text>
            )}
            <Text style={styles.title} numberOfLines={1}>{nombre ?? 'Grupo'}</Text>
          </View>
          <TouchableOpacity onPress={() => setMenuVisible(!menuVisible)} style={styles.menuBtn}>
            <Text style={styles.menuIcon}>⋯</Text>
          </TouchableOpacity>
        </View>

        {menuVisible && (
          <>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setMenuVisible(false)} activeOpacity={1} />
            <View style={styles.menuDesplegable}>
              {esAdmin && (
                <>
                  {!grupoPausado && (
                    <>
                      <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push({ pathname: '/agregar-participantes', params: { modo: 'agregar', grupoId: id } }); }}>
                        <Text style={styles.menuItemEmoji}>👤</Text>
                        <Text style={styles.menuItemText}>Agregar miembro</Text>
                      </TouchableOpacity>
                      <View style={styles.menuSeparador} />
                    </>
                  )}
                  <TouchableOpacity style={styles.menuItem} onPress={abrirConfig}>
                    <Text style={styles.menuItemEmoji}>⚙️</Text>
                    <Text style={styles.menuItemText}>Configuración</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparador} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setPopupConfirm({ visible: true, accion: 'pausar' }); }}>
                    <Text style={styles.menuItemEmoji}>{grupoPausado ? '▶️' : '⏸️'}</Text>
                    <Text style={styles.menuItemText}>{grupoPausado ? 'Reanudar grupo' : 'Pausar grupo'}</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparador} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setPopupConfirm({ visible: true, accion: 'eliminarGrupo' }); }}>
                    <Text style={styles.menuItemEmoji}>🗑️</Text>
                    <Text style={[styles.menuItemText, { color: '#FF4D4D' }]}>Eliminar grupo</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparador} />
                </>
              )}
              {!esAdmin && (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={abrirConfig}>
                    <Text style={styles.menuItemEmoji}>⚙️</Text>
                    <Text style={styles.menuItemText}>Ver configuración</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparador} />
                </>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setPopupConfirm({ visible: true, accion: 'salir' }); }}>
                <Text style={styles.menuItemEmoji}>🚪</Text>
                <Text style={[styles.menuItemText, { color: '#FF4D4D' }]}>Salir del grupo</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {grupoPausado && (
          <View style={styles.pausadoBanner}>
            <Text style={styles.pausadoBannerText}>⏸️  Grupo pausado · Solo lectura</Text>
          </View>
        )}

        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((tab) => {
              const desactivado = tab === 'Ranking' && !rankingActivo;
              return (
              <TouchableOpacity key={tab} onPress={() => irATab(tab)} style={styles.tabBtn}>
                <Text style={[styles.tabText, tabActivo === tab && styles.tabTextActivo, desactivado && styles.tabTextDesactivado]}>{tab}</Text>
                {tabActivo === tab && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={1}
          onPageSelected={e => {
            const index = e.nativeEvent.position;
            if (index === rankingIndex && !rankingActivo) {
              avisarRankingDesactivado();
              setTabActivo(TABS[balanceIndex]);
              pagerRef.current?.setPage(balanceIndex);
              return;
            }
            setTabActivo(TABS[index]);
          }}
        >

          {/* A Pagar */}
          <ScrollView key="0" style={styles.body} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargarDatos(true)} tintColor="#4A9EFF" />}
            onScrollBeginDrag={Keyboard.dismiss}
          >
            {deudas.length === 0
              ? <View style={styles.card}><Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>¡Todo saldado! 🎉</Text></View>
              : deudas.map((item, i) => {
                const miNombreLocal = miembrosGrupo.find(m => m.user_id === userId)?.nombre ?? miNombre;
                const esMio = item.de === miNombreLocal;
                const esAcreedor = item.a === miNombreLocal;
                const convAbierta = conversionAbierta === i;
                return (
                  <View key={i} style={styles.card}>
                    <View style={styles.cardRow}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarLetra}>{item.de[0]}</Text>
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitulo}>{firstNameOr(item.de)} → {firstNameOr(item.a)}</Text>
                        <View style={styles.debeRow}>
                          <Text style={styles.debeText}>
                            {firstNameOr(item.de)} debe transferirle ${item.monto.toLocaleString('es-AR')} a {firstNameOr(item.a)}
                          </Text>
                        </View>
                        {tieneVariasMonedas && (
                          <TouchableOpacity style={styles.conversionBtn} onPress={() => setConversionAbierta(convAbierta ? null : i)}>
                            <Text style={styles.conversionBtnText}>
                              {convAbierta ? '▲ Ocultar conversión' : '💱 Ver en otras monedas'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {convAbierta && (
                          <View style={styles.conversionPanel}>
                            {monedas.filter(m => m.codigo !== 'ARS').map(m => (
                              <View key={m.codigo} style={styles.conversionRow}>
                                <Text style={styles.conversionCodigo}>{m.simbolo} {m.codigo}</Text>
                                <Text style={styles.conversionMonto}>
                                  {(item.monto / m.tasaARS).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                                </Text>
                              </View>
                            ))}
                            <Text style={styles.conversionNota}>
                              Tasas: {monedas.filter(m => m.codigo !== 'ARS').map(m => `1 ${m.codigo} = $${m.tasaARS.toLocaleString('es-AR')}`).join(' · ')}
                            </Text>
                          </View>
                        )}
                        {esAcreedor && (
                          <TouchableOpacity style={styles.recordatorioBtn} onPress={() => mostrarPopup('🔔', '¡Recordatorio enviado!', `Le avisamos a ${firstNameOr(item.de)} que te debe $${item.monto.toLocaleString('es-AR')}.`)}>
                            <Text style={styles.recordatorioText}>🔔  Enviar Recordatorio</Text>
                          </TouchableOpacity>
                        )}
                        {esMio && (
                          <TouchableOpacity style={styles.pagarBtn} onPress={() => {
                            const acreedorMiembro = miembrosGrupo.find(m => m.nombre === item.a);
                            router.push({
                              pathname: '/pagar-ahora',
                              params: {
                                total: String(item.monto),
                                acreedorId: acreedorMiembro?.user_id ?? '',
                                acreedorNombre: item.a,
                                deudorNombre: item.de,
                                grupoId: id ?? '',
                                grupoNombre: nombre ?? '',
                              },
                            });
                          }}>
                            <Text style={styles.pagarText}>💰  Pagar ahora</Text>
                          </TouchableOpacity>
                        )}
                        {esMio && (pagosPendientesLocal.some(p => p.de === item.de && p.a === item.a) ? (
                          <View style={[styles.marcarPagadoBtn, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' }]}>
                            <Text style={[styles.marcarPagadoText, { color: '#F5A623' }]}>⏳ Esperando confirmación</Text>
                          </View>
                        ) : (
                          <TouchableOpacity style={styles.marcarPagadoBtn} onPress={() => handleMarcarPagado(item)}>
                            <Text style={styles.marcarPagadoText}>✓  Marcar como pagado</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.cardMontoRojo}>${item.monto.toLocaleString('es-AR')}</Text>
                    </View>
                  </View>
                );
              })
            }
            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Gastos */}
          <ScrollView key="1" style={styles.body} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargarDatos(true)} tintColor="#4A9EFF" />}
            onScrollBeginDrag={Keyboard.dismiss}
          >
            {tieneVariasMonedas && (
              <View style={styles.historialMonedaSelector}>
                {monedas.map(m => (
                  <TouchableOpacity
                    key={m.codigo}
                    style={[styles.historialMonedaChip, monedaHistorial === m.codigo && styles.historialMonedaChipActivo]}
                    onPress={() => setMonedaHistorial(m.codigo)}
                  >
                    <Text style={[styles.historialMonedaChipText, monedaHistorial === m.codigo && styles.historialMonedaChipTextActivo]}>
                      {m.simbolo} {m.codigo}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {cargando
              ? <ActivityIndicator color="#4A9EFF" style={{ marginTop: 40 }} />
              : gastos.length === 0
                ? <View style={styles.card}><Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>No hay gastos todavía.</Text></View>
                : null}
            {gastos.map((g) => {
              const monedaOrigen = monedasMap[g.moneda] ?? { simbolo: '$', tasaARS: 1 };
              const monedaDestino = monedasMap[monedaHistorial] ?? { simbolo: '$', tasaARS: 1 };
              const montoMostrado = (g.monto * monedaOrigen.tasaARS) / monedaDestino.tasaARS;
              return (
                <View key={g.id} style={styles.card}>
                  <TouchableOpacity style={styles.cardRow} activeOpacity={0.82} onPress={() => setGastoDetalle(g)}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitulo}>{g.nombre}</Text>
                      <Text style={styles.cardSub}>{firstNameOr(g.pagador)} pagó</Text>
                      <Text style={styles.cardFecha}>{g.fecha}. Dividido entre {g.participantes.length}</Text>
                      <View style={styles.chips}>
                        {g.participantes.map((p) => (
                          <View key={p} style={styles.chip}><Text style={styles.chipText}>{firstNameOr(p)}</Text></View>
                        ))}
                      </View>
                      {g.fotoPath && (
                        <View style={styles.ticketLink}>
                          <Ionicons name="receipt-outline" size={14} color="#4A9EFF" />
                          <Text style={styles.ticketLinkText}>Con comprobante</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardMonto}>
                        {monedaDestino.simbolo} {montoMostrado.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                      </Text>
                      {g.moneda !== monedaHistorial && (
                        <View style={styles.monedaBadge}>
                          <Text style={styles.monedaBadgeText}>orig. {g.moneda}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  {puedeModificarGasto(g) && (
                    <View style={styles.gastoAcciones}>
                      <TouchableOpacity style={styles.gastoAccionBtn} onPress={() => handleEditarGasto(g)}>
                        <Ionicons name="create-outline" size={15} color="#4A9EFF" />
                        <Text style={styles.gastoAccionText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.gastoAccionBtn} onPress={() => setGastoAEliminar(g)}>
                        <Ionicons name="trash-outline" size={15} color="#FF6B6B" />
                        <Text style={[styles.gastoAccionText, { color: '#FF6B6B' }]}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
            <TouchableOpacity style={styles.exportarBtn} onPress={() => setExportModalVisible(true)}>
              <Text style={styles.exportarText}>Exportar</Text>
            </TouchableOpacity>
            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Balance */}
          <ScrollView key="2" style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.balanceTitulo}>Balance De Pagos</Text>
              <View style={styles.barChart}>
                {balance.map((b) => (
                  <View key={b.nombre} style={styles.barItem}>
                    <View style={styles.barWrapper}>
                      <View style={[
                        styles.bar,
                        { height: Math.max(8, (Math.abs(b.monto) / maxMonto) * 80) },
                        b.monto > 0 ? styles.barPositivo : styles.barNegativo
                      ]} />
                    </View>
                    <Text style={styles.barLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                      {firstNameOr(b.nombre)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.porPersonaContainer}>
                <Text style={styles.porPersonaTitulo}>Por Persona</Text>
                {balance.map((b) => (
                  <View key={b.nombre} style={styles.porPersonaRow}>
                    <Text style={styles.porPersonaNombre} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                      {firstNameOr(b.nombre)}
                    </Text>
                    <View style={styles.porPersonaBarBg}>
                      <View style={[
                        styles.porPersonaBarFill,
                        { width: `${(Math.abs(b.monto) / maxMonto) * 100}%` },
                        b.monto > 0 ? styles.barPositivo : styles.barNegativo
                      ]} />
                    </View>
                    <Text style={[styles.porPersonaMonto, b.monto > 0 ? styles.montoPos : styles.montoNeg]}>
                      {b.monto > 0 ? '+' : ''} ${Math.abs(b.monto).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Ranking */}
          <ScrollView key="3" style={styles.body} showsVerticalScrollIndicator={false}>
            {balance.length < 2 ? (
              <View style={styles.card}>
                <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', paddingVertical: 20 }}>
                  Agregá gastos para ver el ranking del grupo.
                </Text>
              </View>
            ) : (() => {
              const ordenado = [...balance].sort((a, b) => b.monto - a.monto);
              const primero = ordenado[0];
              const segundo = ordenado[1] ?? ordenado[0];
              const ultimo = ordenado[ordenado.length - 1];
              const anteultimo = ordenado[Math.max(0, ordenado.length - 2)];
              return (
                <>
                  <View style={styles.destacadosGrid}>
                    {[
                      { persona: primero, emoji: '🎉', titulo: 'La más generosa' },
                      { persona: segundo, emoji: '⚖️', titulo: 'La más equilibrada' },
                      { persona: anteultimo, emoji: '📉', titulo: 'La colgada' },
                      { persona: ultimo, emoji: '🐭', titulo: 'La más rata' },
                    ].map((d, i) => (
                      <View key={i} style={styles.destacadoCard}>
                        <Text style={styles.destacadoEmoji}>{d.emoji}</Text>
                        <Text style={styles.destacadoNombre}>{firstNameOr(d.persona.nombre)}</Text>
                        <Text style={styles.destacadoTitulo}>{d.titulo}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.rankingCompletTitulo}>Ranking Completo</Text>
                    {ordenado.map((r, i) => {
                      const colores = ['#C084C0', '#7BC4B8', '#5BAA9F', '#4A6580', '#6BAA9F', '#8B7BB8', '#B07BAA'];
                      return (
                        <View key={r.nombre} style={styles.rankingRow}>
                          <View style={[styles.rankingBadge, { backgroundColor: colores[i] }]}>
                            <Text style={styles.rankingPos}>{i + 1}</Text>
                          </View>
                          <Text style={styles.rankingNombre}>{firstNameOr(r.nombre)}</Text>
                          <Text style={styles.rankingTitulo}>{titulos[i]}</Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              );
            })()}
            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Miembros */}
          <ScrollView key="4" style={styles.body} showsVerticalScrollIndicator={false}>
            {esAdmin && !grupoPausado && (
              <TouchableOpacity style={styles.agregarMiembroBtn} onPress={() => router.push({ pathname: '/agregar-participantes', params: { modo: 'agregar', grupoId: id } })}>
                <Text style={styles.agregarMiembroText}>+ Agregar miembro</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.invitarBtn} onPress={() => setInvitarVisible(true)}>
              <Ionicons name="share-social-outline" size={18} color="#4A9EFF" />
              <Text style={styles.invitarBtnText}>Invitar gente con un link</Text>
            </TouchableOpacity>
            {miembrosGrupo.map((m) => {
              const esAdminMiembro = administradores.includes(m.nombre);
              const esSelf = m.user_id === userId || (!!miNombre && m.nombre === miNombre);
              const amigoData = amigosStore.find(a => a.id === m.user_id);
              const esAmigo = !!amigoData;
              const esPendiente = solicitudesEnviadasStore.some(s => s.receptor_id === m.user_id);
              return (
                <View key={m.user_id} style={styles.miembroCard}>
                  <View style={[styles.miembroAvatar, { backgroundColor: m.color }]}>
                    <Text style={styles.miembroInicial}>{firstName(m.nombre)[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.miembroNombreRow}>
                      <Text style={styles.miembroNombre}>{firstNameOr(m.nombre)}{esSelf ? ' (vos)' : ''}</Text>
                      {esAdminMiembro && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>👑 Admin</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {esAdmin && !esSelf && !esAdminMiembro && (
                      <TouchableOpacity
                        style={styles.agregarAmigoBtn}
                        onPress={() => { hacerAdmin(id!, m.user_id); mostrarPopup('👑', '¡Admin asignado!', `${firstNameOr(m.nombre)} ahora es administrador del grupo.`); }}
                      >
                        <Text style={styles.agregarAmigoText}>+ Admin</Text>
                      </TouchableOpacity>
                    )}
                    {esCreador && !esSelf && esAdminMiembro && (
                      <TouchableOpacity
                        style={[styles.agregarAmigoBtn, styles.agregarAmigoBtnActivo]}
                        onPress={() => { quitarAdmin(id!, m.user_id); mostrarPopup('👤', 'Admin removido', `${firstNameOr(m.nombre)} ya no es administrador.`); }}
                      >
                        <Text style={[styles.agregarAmigoText, styles.agregarAmigoTextActivo]}>✓ Admin</Text>
                      </TouchableOpacity>
                    )}
                    {esAdminMiembro && !esCreador && !esSelf && (
                      <View style={[styles.agregarAmigoBtn, styles.agregarAmigoBtnActivo]}>
                        <Text style={[styles.agregarAmigoText, styles.agregarAmigoTextActivo]}>✓ Admin</Text>
                      </View>
                    )}
                    {!esSelf && (
                      esAmigo ? (
                        <TouchableOpacity
                          style={[styles.agregarAmigoBtn, styles.agregarAmigoBtnActivo]}
                          onPress={() => setPopupEliminarAmigo({ visible: true, amistadId: amigoData.amistad_id, amigoUserId: m.user_id, amigoNombre: firstNameOr(m.nombre) })}
                        >
                          <Text style={[styles.agregarAmigoText, styles.agregarAmigoTextActivo]}>✓ Amigo</Text>
                        </TouchableOpacity>
                      ) : esPendiente ? (
                        <View style={[styles.agregarAmigoBtn, { borderColor: 'rgba(245,158,11,0.5)', backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                          <Text style={[styles.agregarAmigoText, { color: '#F5A623' }]}>⏳ Pendiente</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.agregarAmigoBtn} onPress={() => handleEnviarSolicitud(m.user_id)}>
                          <Text style={styles.agregarAmigoText}>+ Amigo</Text>
                        </TouchableOpacity>
                      )
                    )}
                    {puedeEliminarMiembro(m) && (
                      <TouchableOpacity style={styles.expulsarBtn} onPress={() => setMiembroAEliminar({ user_id: m.user_id, nombre: m.nombre })}>
                        <Ionicons name="person-remove-outline" size={13} color="#FF6B6B" />
                        <Text style={styles.expulsarText}>Expulsar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Presupuesto */}
          <ScrollView key="5" style={styles.body} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss} keyboardShouldPersistTaps="handled">
            <View>
              {presupuesto && (
                <View style={styles.presupuestoCard}>
                  <Text style={styles.presupuestoTitulo}>Gasto del presupuesto</Text>
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <GraficoCircular porcentaje={porcentajeGastado} sobrepasa={sobrepasa} />
                  </View>
                  <View style={styles.presupuestoStats}>
                    <View style={styles.presupuestoStatItem}>
                      <Text style={styles.presupuestoStatLabel}>Presupuesto</Text>
                      <Text style={styles.presupuestoStatValor}>${presupuesto.toLocaleString('es-AR')}</Text>
                    </View>
                    <View style={styles.presupuestoStatItem}>
                      <Text style={styles.presupuestoStatLabel}>Gastado</Text>
                      <Text style={[styles.presupuestoStatValor, sobrepasa && { color: '#FF4D4D' }]}>${totalGastado.toLocaleString('es-AR')}</Text>
                    </View>
                    <View style={styles.presupuestoStatItem}>
                      <Text style={styles.presupuestoStatLabel}>Disponible</Text>
                      <Text style={[styles.presupuestoStatValor, sobrepasa && { color: '#FF4D4D' }]}>
                        {sobrepasa ? `-$${(totalGastado - presupuesto).toLocaleString('es-AR')}` : `$${(presupuesto - totalGastado).toLocaleString('es-AR')}`}
                      </Text>
                    </View>
                  </View>
                  {sobrepasa && (
                    <View style={styles.alertaSobrepasa}>
                      <Text style={styles.alertaTexto}>⚠️ El grupo superó el presupuesto por ${(totalGastado - presupuesto).toLocaleString('es-AR')}</Text>
                    </View>
                  )}
                  <View style={styles.barraPresupuestoBg}>
                    <View style={[styles.barraPresupuestoFill, { width: `${porcentajeGastado}%` as any, backgroundColor: sobrepasa ? '#FF4D4D' : '#4A9EFF' }]} />
                  </View>
                </View>
              )}
              {esAdmin && (!presupuesto || editandoPresupuesto) && !grupoPausado && (
                <View style={styles.presupuestoFormCard}>
                  <Text style={styles.presupuestoFormTitulo}>
                    {editandoPresupuesto ? 'Editar presupuesto' : 'Agregar presupuesto'}
                  </Text>
                  <Text style={styles.presupuestoFormSub}>
                    {editandoPresupuesto
                      ? `Presupuesto actual: $${presupuesto?.toLocaleString('es-AR')}`
                      : 'Establecé un límite de gasto para este grupo'}
                  </Text>
                  <TextInput
                    style={[styles.presupuestoInput, errorPresupuesto && styles.inputError]}
                    placeholder="$0"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    value={inputPresupuesto}
                    onChangeText={v => { setInputPresupuesto(v); setErrorPresupuesto(''); }}
                  />
                  {errorPresupuesto ? <Text style={styles.errorText}>{errorPresupuesto}</Text> : null}
                  <View style={styles.presupuestoBotones}>
                    {editandoPresupuesto && (
                      <TouchableOpacity style={styles.presupuestoCancelarBtn} onPress={() => { setEditandoPresupuesto(false); setInputPresupuesto(''); setErrorPresupuesto(''); }}>
                        <Text style={styles.presupuestoCancelarText}>Cancelar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.presupuestoGuardarBtn} onPress={guardarPresupuesto}>
                      <Text style={styles.presupuestoGuardarText}>Guardar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {!esAdmin && !presupuesto && (
                <View style={styles.presupuestoFormCard}>
                  <Text style={[styles.presupuestoFormTitulo, { textAlign: 'center' }]}>Sin presupuesto</Text>
                  <Text style={[styles.presupuestoFormSub, { textAlign: 'center' }]}>El administrador del grupo todavía no definió un presupuesto.</Text>
                </View>
              )}
              {presupuesto && !editandoPresupuesto && esAdmin && !grupoPausado && (
                <TouchableOpacity style={styles.editarPresupuestoBtn} onPress={() => { setEditandoPresupuesto(true); setInputPresupuesto(String(presupuesto)); }}>
                  <Text style={styles.editarPresupuestoText}>✏️  Editar presupuesto</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 30 }} />
          </ScrollView>

        </PagerView>

        {tabActivo === 'Gastos' && !grupoPausado && (
          <TouchableOpacity style={styles.fab} onPress={() => router.push({ pathname: '/agregar-gasto', params: { grupoId: id } })}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}

        {/* Modal de Configuración */}
        <Modal transparent animationType="slide" visible={configVisible} onRequestClose={() => setConfigVisible(false)}>
          <View style={styles.configOverlay}>
            <View style={styles.configModal}>
              <View style={styles.configHeader}>
                <Text style={styles.configTitulo}>⚙️  Configuración del grupo</Text>
                <TouchableOpacity onPress={() => setConfigVisible(false)}>
                  <Text style={styles.configCerrar}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss} keyboardShouldPersistTaps="handled">
                <Text style={styles.configSeccionTitulo}>Foto del grupo</Text>
                {!esAdmin && (
                  <Text style={styles.configNota}>Solo los administradores pueden cambiar la foto.</Text>
                )}
                <View style={styles.configFotoCard}>
                  {configFotoUrl ? (
                    <Image source={{ uri: configFotoUrl }} style={styles.configFotoPreview} contentFit="cover" />
                  ) : (
                    <View style={styles.configFotoPlaceholder}>
                      <Ionicons name="people-outline" size={28} color="rgba(255,255,255,0.55)" />
                    </View>
                  )}
                  <View style={styles.configFotoInfo}>
                    <Text style={styles.configFotoTitulo}>
                      {configFotoUrl ? 'Foto seleccionada' : 'Sin foto personalizada'}
                    </Text>
                    <Text style={styles.configFotoDesc}>
                      Esta imagen aparece en Grupos, Mis grupos y el detalle del grupo.
                    </Text>
                    {esAdmin && (
                      <View style={styles.configFotoActions}>
                        <TouchableOpacity
                          style={styles.configFotoAction}
                          onPress={abrirConfigFotoOpciones}
                          disabled={configFotoPickerActivo}
                        >
                          <Text style={styles.configFotoActionText}>{configFotoUrl ? 'Cambiar' : 'Agregar foto'}</Text>
                        </TouchableOpacity>
                        {configFotoUrl && (
                          <TouchableOpacity style={styles.configFotoRemove} onPress={quitarConfigFoto}>
                            <Text style={styles.configFotoRemoveText}>Quitar</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.configSeccionTitulo}>Monedas del grupo</Text>
                {!esAdmin && (
                  <Text style={styles.configNota}>Solo los administradores pueden editar monedas.</Text>
                )}

                {monedasEditando.map((m) => (
                  <View key={m.codigo} style={styles.configMonedaCard}>
                    <View style={styles.configMonedaCardHeader}>
                      <View style={styles.configMonedaBadge}>
                        <Text style={styles.configMonedaCodigo}>{m.simbolo} {m.codigo}</Text>
                      </View>
                      <Text style={styles.configMonedaNombreCard}>{m.nombre}</Text>
                      {m.codigo !== 'ARS' && esAdmin && (
                        <TouchableOpacity onPress={() => eliminarMonedaDeConfig(m.codigo)} style={styles.configEliminarBtn}>
                          <Text style={styles.configEliminarText}>🗑</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {m.codigo === 'ARS' ? (
                      <Text style={styles.configMonedaBase}>Moneda base</Text>
                    ) : esAdmin ? (
                      <>
                        <View style={styles.tasaModoRow}>
                          <TouchableOpacity
                            style={[styles.tasaModoBtn, tasasModo[m.codigo] !== 'manual' && styles.tasaModoBtnActivo]}
                            onPress={() => {
                              setTasasModo(prev => ({ ...prev, [m.codigo]: 'auto' }));
                              fetchRatesMap().then(mapa => {
                                if (mapa?.[m.codigo]) setTasasInput(prev => ({ ...prev, [m.codigo]: String(mapa[m.codigo]) }));
                              });
                            }}
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
                          <View style={styles.configTasaRow}>
                            <Text style={styles.configTasaLabel}>1 {m.codigo} =</Text>
                            <TextInput
                              style={styles.configTasaInput}
                              keyboardType="numeric"
                              returnKeyType="done"
                              onSubmitEditing={Keyboard.dismiss}
                              value={tasasInput[m.codigo] ?? ''}
                              onChangeText={v => { setTasasInput(prev => ({ ...prev, [m.codigo]: v })); setErrorConfig(''); }}
                              placeholder="0"
                              placeholderTextColor="rgba(255,255,255,0.35)"
                            />
                            <Text style={styles.configTasaLabel}>ARS</Text>
                          </View>
                        ) : (
                          <Text style={styles.configTasaAutoValor}>
                            1 {m.codigo} = ${Number(tasasInput[m.codigo] || 0).toLocaleString('es-AR')} ARS
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.configMonedaBase}>
                        1 {m.codigo} = ${m.tasaARS.toLocaleString('es-AR')} ARS{m.tasaAuto !== false ? ' · ChePaga' : ''}
                      </Text>
                    )}
                  </View>
                ))}

                {errorConfig ? <Text style={styles.errorText}>{errorConfig}</Text> : null}

                {esAdmin && monedasDisponiblesParaAgregar.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.agregarMonedaBtn}
                      onPress={() => setAgregarMonedaOpen(!agregarMonedaOpen)}
                    >
                      <Text style={styles.agregarMonedaText}>
                        {agregarMonedaOpen ? '▲ Cerrar' : '+ Agregar moneda'}
                      </Text>
                    </TouchableOpacity>
                    {agregarMonedaOpen && (
                      <View style={styles.monedasDisponiblesContainer}>
                        {monedasDisponiblesParaAgregar.map(m => (
                          <TouchableOpacity
                            key={m.codigo}
                            style={styles.monedaDisponibleChip}
                            onPress={() => agregarMonedaAConfig(m)}
                          >
                            <Text style={styles.monedaDisponibleText}>{m.simbolo} {m.codigo} — {m.nombre}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <Text style={[styles.configSeccionTitulo, { marginTop: 28 }]}>Ranking del grupo</Text>
                <View style={styles.configSwitchRow}>
                  <View style={styles.configSwitchTextWrap}>
                    <Text style={styles.configSwitchTitulo}>Mostrar ranking</Text>
                    <Text style={styles.configSwitchDesc}>
                      Si esta desactivado, nadie puede entrar al ranking de este grupo.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.configSwitch,
                      rankingEditando && styles.configSwitchActivo,
                      !esAdmin && styles.configSwitchDisabled,
                    ]}
                    onPress={() => esAdmin && setRankingEditando(prev => !prev)}
                    disabled={!esAdmin}
                  >
                    <View style={[styles.configSwitchThumb, rankingEditando && styles.configSwitchThumbActivo]} />
                  </TouchableOpacity>
                </View>
                {!esAdmin && (
                  <Text style={styles.configNota}>Solo los administradores pueden cambiar el ranking.</Text>
                )}

                <Text style={[styles.configSeccionTitulo, { marginTop: 28 }]}>Administradores</Text>
                {!esAdmin && (
                  <Text style={styles.configNota}>Solo los administradores pueden gestionar roles.</Text>
                )}
                {miembrosGrupo.map((m) => {
                  const esAdminMiembro = administradores.includes(m.nombre);
                  const esSelf = m.user_id === userId;
                  return (
                    <View key={m.user_id} style={styles.configMiembroRow}>
                      <View style={[styles.miembroAvatar, { backgroundColor: m.color, width: 36, height: 36, borderRadius: 18 }]}>
                        <Text style={styles.miembroInicial}>{firstName(m.nombre)[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                      <Text style={styles.configMiembroNombre}>{firstNameOr(m.nombre)}{esSelf ? ' (vos)' : ''}</Text>
                      {esAdminMiembro && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>👑 Admin</Text>
                        </View>
                      )}
                      {esAdmin && !esSelf && !esAdminMiembro && (
                        <TouchableOpacity style={styles.configAdminBtn} onPress={() => hacerAdmin(id!, m.user_id)}>
                          <Text style={styles.configAdminBtnText}>Hacer admin</Text>
                        </TouchableOpacity>
                      )}
                      {esCreador && !esSelf && esAdminMiembro && (
                        <TouchableOpacity style={[styles.configAdminBtn, styles.configAdminBtnActivo]} onPress={() => quitarAdmin(id!, m.user_id)}>
                          <Text style={[styles.configAdminBtnText, { color: '#FFFFFF' }]}>Quitar admin</Text>
                        </TouchableOpacity>
                      )}
                      {!esCreador && esAdminMiembro && !esSelf && (
                        <View style={[styles.configAdminBtn, styles.configAdminBtnActivo]}>
                          <Text style={[styles.configAdminBtnText, { color: '#FFFFFF' }]}>Admin</Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                {esAdmin && (
                  <TouchableOpacity style={styles.configGuardarBtn} onPress={guardarConfig}>
                    <Text style={styles.configGuardarText}>Guardar cambios</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        <ImageSourceModal
          visible={configFotoSourceModalVisible}
          title="Foto del grupo"
          disabled={configFotoPickerActivo}
          onClose={cerrarConfigFotoOpciones}
          onPick={pedirConfigFotoDesdeConfig}
        />

        <Modal transparent animationType="fade" visible={exportModalVisible} onRequestClose={() => setExportModalVisible(false)}>
          <View style={styles.overlayModal}>
            <View style={styles.popupModal}>
              <Text style={styles.popupModalEmoji}>📤</Text>
              <Text style={styles.popupModalTitulo}>Exportar gastos</Text>
              <Text style={styles.popupModalMensaje}>¿En qué formato querés exportar?</Text>
              <View style={{ width: '100%', gap: 10 }}>
                <TouchableOpacity style={[styles.exportOpcionBtn, { backgroundColor: '#4A9EFF' }]} onPress={exportarPDF}>
                  <Text style={styles.exportOpcionText}>📄 Exportar como PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.popupModalCancelar, { flex: 0, width: '100%' }]} onPress={() => setExportModalVisible(false)}>
                  <Text style={styles.popupModalCancelarText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ConfirmPopup
          visible={configFotoPermisoDenegado}
          emoji="🔒"
          titulo="Permiso necesario"
          mensaje="Necesitamos permiso para acceder a la camara o galeria."
          onClose={() => setConfigFotoPermisoDenegado(false)}
        />

        <ConfirmPopup
          visible={popup.visible}
          emoji={popup.emoji}
          titulo={popup.titulo}
          mensaje={popup.mensaje}
          onClose={() => setPopup(p => ({ ...p, visible: false }))}
        />

        <Modal transparent animationType="fade" visible={popupSobrePresupuesto} onRequestClose={() => setPopupSobrePresupuesto(false)}>
          <View style={styles.overlayModal}>
            <View style={styles.popupModal}>
              <Text style={styles.popupModalEmoji}>⚠️</Text>
              <Text style={styles.popupModalTitulo}>El presupuesto es menor al gasto actual</Text>
              <Text style={styles.popupModalMensaje}>
                Ya gastaron ${totalGastado.toLocaleString('es-AR')} y el presupuesto que ingresaste es menor. ¿Querés guardarlo igual?
              </Text>
              <View style={styles.popupModalBotones}>
                <TouchableOpacity style={styles.popupModalCancelar} onPress={() => setPopupSobrePresupuesto(false)}>
                  <Text style={styles.popupModalCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.popupModalConfirmar} onPress={() => {
                  const valor = Number(inputPresupuesto.replace(/\D/g, ''));
                  setPresupuesto(valor);
                  setEditandoPresupuesto(false);
                  setErrorPresupuesto('');
                  setPopupSobrePresupuesto(false);
                  if (id) guardarPresupuestoDB(id, valor);
                  mostrarPopup('⚠️', 'Presupuesto superado', `El grupo ya superó el presupuesto de $${valor.toLocaleString('es-AR')}.`);
                }}>
                  <Text style={styles.popupModalConfirmarText}>Guardar igual</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {(() => {
          const deudaspendientes = deudas.length;
          const hayDeudas = !grupoPausado && deudaspendientes > 0;
          return (
            <ConfirmPopup
              visible={popupConfirm.visible && popupConfirm.accion === 'pausar'}
              emoji={grupoPausado ? '▶️' : hayDeudas ? '⚠️' : '⏸️'}
              titulo={grupoPausado ? '¿Reanudar grupo?' : hayDeudas ? 'Hay deudas pendientes' : '¿Pausar grupo?'}
              mensaje={
                grupoPausado
                  ? 'El grupo volverá a estar activo.'
                  : hayDeudas
                    ? `${deudaspendientes} deuda${deudaspendientes > 1 ? 's' : ''} sin saldar. ¿Querés pausar el grupo igual?`
                    : 'El grupo quedará en pausa. Podés reanudarlo cuando quieras.'
              }
              confirmText={hayDeudas ? 'Pausar igual' : 'Aceptar'}
              onCancel={() => setPopupConfirm({ visible: false, accion: null })}
              onClose={() => {
                if (id) grupoPausado ? reanudarGrupo(id) : pausarGrupo(id);
                setPopupConfirm({ visible: false, accion: null });
              }}
            />
          );
        })()}

        <ConfirmPopup
          visible={popupConfirm.visible && popupConfirm.accion === 'salir'}
          emoji="🚪"
          titulo="¿Salir del grupo?"
          mensaje="Ya no verás este grupo ni sus gastos. Esta acción no se puede deshacer."
          confirmText="Salir"
          onCancel={() => setPopupConfirm({ visible: false, accion: null })}
          onClose={() => { if (id) salirGrupo(id); setPopupConfirm({ visible: false, accion: null }); router.replace('/(tabs)/grupos'); }}
        />

        <ConfirmPopup
          visible={popupConfirm.visible && popupConfirm.accion === 'eliminarGrupo'}
          emoji="🗑️"
          titulo="¿Eliminar grupo?"
          mensaje={`Se borrará "${nombre ?? 'este grupo'}" con sus gastos, pagos y miembros. Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          onCancel={() => setPopupConfirm({ visible: false, accion: null })}
          onClose={async () => {
            if (!id) return;
            const ok = await eliminarGrupo(id);
            setPopupConfirm({ visible: false, accion: null });
            if (ok) router.replace('/(tabs)/grupos');
            else mostrarPopup('❌', 'No se pudo eliminar', 'Intentá de nuevo o revisá tu conexión.');
          }}
        />

        <ConfirmPopup
          visible={popupEliminarAmigo?.visible ?? false}
          emoji="👤"
          titulo="¿Eliminar amigo?"
          mensaje={`¿Querés eliminar a ${popupEliminarAmigo?.amigoNombre} de tus amigos?`}
          confirmText="Eliminar"
          onCancel={() => setPopupEliminarAmigo(null)}
          onClose={async () => {
            if (popupEliminarAmigo) {
              await eliminarAmigo(popupEliminarAmigo.amistadId, popupEliminarAmigo.amigoUserId);
            }
            setPopupEliminarAmigo(null);
          }}
        />

        <InvitarSheet visible={invitarVisible} grupoId={id ?? ''} nombreGrupo={nombre ?? 'el grupo'} onClose={() => setInvitarVisible(false)} />

        <ConfirmPopup
          visible={!!gastoAEliminar}
          emoji="🗑️"
          titulo="¿Eliminar gasto?"
          mensaje={`Se eliminará "${gastoAEliminar?.nombre ?? ''}" y los balances del grupo se recalcularán. Esta acción no se puede deshacer.`}
          confirmText={eliminandoGasto ? 'Eliminando...' : 'Eliminar'}
          onCancel={() => { if (!eliminandoGasto) setGastoAEliminar(null); }}
          onClose={handleEliminarGasto}
        />

        <ConfirmPopup
          visible={!!miembroAEliminar}
          emoji="👋"
          titulo="¿Eliminar miembro?"
          mensaje={`${firstNameOr(miembroAEliminar?.nombre, '')} dejará de formar parte del grupo. Sus gastos registrados se mantienen en el historial.`}
          confirmText={eliminandoMiembro ? 'Eliminando...' : 'Expulsar'}
          onCancel={() => { if (!eliminandoMiembro) setMiembroAEliminar(null); }}
          onClose={handleEliminarMiembro}
        />

        <Modal transparent animationType="fade" visible={!!gastoDetalle} onRequestClose={() => setGastoDetalle(null)}>
          <View style={styles.overlayModal}>
            {gastoDetalle && (() => {
              const monedaOrigen = monedasMap[gastoDetalle.moneda] ?? { simbolo: '$', tasaARS: 1 };
              const montoARS = gastoDetalle.monto * monedaOrigen.tasaARS;
              const parteARS = gastoDetalle.participantes.length ? montoARS / gastoDetalle.participantes.length : 0;
              return (
                <View style={styles.gastoDetalleModal}>
                  <View style={styles.gastoDetalleHeader}>
                    <View style={styles.gastoDetalleIcon}>
                      <Ionicons name="receipt-outline" size={24} color="#FFFFFF" />
                    </View>
                    <TouchableOpacity style={styles.gastoDetalleCerrar} onPress={() => setGastoDetalle(null)}>
                      <Ionicons name="close" size={22} color="rgba(255,255,255,0.75)" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.gastoDetalleTitulo}>{gastoDetalle.nombre}</Text>
                  <Text style={styles.gastoDetalleMonto}>
                    {monedaOrigen.simbolo} {gastoDetalle.monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {gastoDetalle.moneda}
                  </Text>
                  {gastoDetalle.moneda !== 'ARS' && (
                    <Text style={styles.gastoDetalleSubMonto}>Equivale a ${Math.round(montoARS).toLocaleString('es-AR')} ARS</Text>
                  )}

                  <View style={styles.gastoDetalleGrid}>
                    <View style={styles.gastoDetalleItem}>
                      <Text style={styles.gastoDetalleLabel}>Lo pago</Text>
                      <Text style={styles.gastoDetalleValor}>{firstNameOr(gastoDetalle.pagador)}</Text>
                    </View>
                    <View style={styles.gastoDetalleItem}>
                      <Text style={styles.gastoDetalleLabel}>Fecha</Text>
                      <Text style={styles.gastoDetalleValor}>{gastoDetalle.fecha}</Text>
                    </View>
                    <View style={styles.gastoDetalleItem}>
                      <Text style={styles.gastoDetalleLabel}>Categoria</Text>
                      <Text style={styles.gastoDetalleValor}>{gastoDetalle.categoria || 'Sin categoria'}</Text>
                    </View>
                    <View style={styles.gastoDetalleItem}>
                      <Text style={styles.gastoDetalleLabel}>Parte por persona</Text>
                      <Text style={styles.gastoDetalleValor}>${Math.round(parteARS).toLocaleString('es-AR')} ARS</Text>
                    </View>
                  </View>

                  <Text style={styles.gastoDetalleSeccion}>Participantes</Text>
                  <View style={styles.gastoDetalleParticipantes}>
                    {gastoDetalle.participantes.map(p => (
                      <View key={p} style={styles.chip}><Text style={styles.chipText}>{firstNameOr(p)}</Text></View>
                    ))}
                  </View>

                  {gastoDetalle.fotoPath ? (
                    <TouchableOpacity
                      style={styles.gastoDetalleComprobanteBtn}
                      onPress={() => abrirTicketDesdeDetalle(gastoDetalle.fotoPath!)}
                    >
                      <Ionicons name="image-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.gastoDetalleComprobanteText}>Ver comprobante</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.gastoDetalleSinComprobante}>
                      <Ionicons name="document-outline" size={18} color="rgba(255,255,255,0.45)" />
                      <Text style={styles.gastoDetalleSinComprobanteText}>Este gasto no tiene comprobante cargado.</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        </Modal>

        <Modal transparent animationType="fade" visible={ticketVisible} onRequestClose={() => setTicketVisible(false)}>
          <View style={styles.ticketModalOverlay}>
            <TouchableOpacity style={styles.ticketCerrar} onPress={() => setTicketVisible(false)}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            {ticketCargando ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : ticketUrl ? (
              <>
                <ZoomableImage uri={ticketUrl} style={styles.ticketModalImg} />
                <Text style={styles.ticketModalHint}>Pellizcá o tocá dos veces para hacer zoom</Text>
              </>
            ) : (
              <Text style={styles.ticketModalError}>No se pudo cargar el comprobante.</Text>
            )}
          </View>
        </Modal>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backEdgeZone: { position: 'absolute', left: 0, top: 130, bottom: 0, width: 40, zIndex: 50 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  headerPhoto: { width: 36, height: 36, borderRadius: 12, marginRight: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  titleEmoji: { fontSize: 20, marginRight: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  tabsContainer: { paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tabs: { paddingHorizontal: 16, gap: 4 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  tabTextActivo: { color: '#FFFFFF', fontWeight: '700' },
  tabTextDesactivado: { color: 'rgba(255,255,255,0.24)' },
  tabUnderline: { height: 2, width: '100%', backgroundColor: '#4A9EFF', marginTop: 4, borderRadius: 2 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: {
    backgroundColor: 'rgba(14,26,52,0.62)',
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: 8 },
  cardTitulo: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  cardFecha: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  cardMonto: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  cardMontoRojo: { fontSize: 15, fontWeight: '700', color: '#FF4D4D' },
  monedaBadge: { backgroundColor: 'rgba(74,158,255,0.15)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  monedaBadgeText: { fontSize: 11, color: '#4A9EFF', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: 'rgba(74,158,255,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  ticketLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  ticketLinkText: { fontSize: 13, color: '#4A9EFF', fontWeight: '600' },
  gastoAcciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  gastoAccionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gastoAccionText: { fontSize: 13, color: '#4A9EFF', fontWeight: '600' },
  gastoDetalleModal: {
    width: '90%', maxWidth: 430, maxHeight: '86%',
    backgroundColor: 'rgba(8,18,40,0.98)', borderRadius: 26,
    padding: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  gastoDetalleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  gastoDetalleIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#4A9EFF', alignItems: 'center', justifyContent: 'center' },
  gastoDetalleCerrar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  gastoDetalleTitulo: { fontSize: 22, color: '#FFFFFF', fontWeight: '800', marginBottom: 6 },
  gastoDetalleMonto: { fontSize: 24, color: '#FFFFFF', fontWeight: '800' },
  gastoDetalleSubMonto: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  gastoDetalleGrid: { marginTop: 18, gap: 10 },
  gastoDetalleItem: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  gastoDetalleLabel: { fontSize: 11, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  gastoDetalleValor: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  gastoDetalleSeccion: { fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: '700', marginTop: 18, marginBottom: 10 },
  gastoDetalleParticipantes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gastoDetalleComprobanteBtn: { marginTop: 20, backgroundColor: '#4A9EFF', borderRadius: 18, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  gastoDetalleComprobanteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  gastoDetalleSinComprobante: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  gastoDetalleSinComprobanteText: { flex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  expulsarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,107,107,0.4)', backgroundColor: 'rgba(255,107,107,0.12)' },
  expulsarText: { fontSize: 13, color: '#FF6B6B', fontWeight: '600' },
  ticketModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  ticketCerrar: { position: 'absolute', top: 56, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  ticketModalImg: { width: '100%', height: '80%' },
  ticketModalHint: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 14, textAlign: 'center' },
  ticketModalError: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  exportarBtn: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 14, paddingHorizontal: 28, alignSelf: 'flex-start', marginTop: 8, marginBottom: 8 },
  exportarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  exportOpcionBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 50, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', width: '100%' },
  exportOpcionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(74,158,255,0.25)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarLetra: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  debeRow: { backgroundColor: 'rgba(255,77,77,0.1)', borderRadius: 8, padding: 8, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,77,77,0.2)' },
  debeText: { fontSize: 12, color: '#FF8080' },
  conversionBtn: { marginTop: 8, alignSelf: 'flex-start' },
  conversionBtnText: { fontSize: 12, color: '#4A9EFF', fontWeight: '600' },
  conversionPanel: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, marginTop: 6 },
  conversionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  conversionCodigo: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  conversionMonto: { fontSize: 13, fontWeight: '600', color: '#4A9EFF' },
  conversionNota: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 6 },
  recordatorioBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 50, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  recordatorioText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  pagarBtn: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  pagarText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  marcarPagadoBtn: { backgroundColor: 'rgba(74,158,255,0.12)', borderRadius: 50, paddingVertical: 10, alignItems: 'center', marginTop: 6, borderWidth: 1, borderColor: 'rgba(74,158,255,0.3)' },
  marcarPagadoText: { fontSize: 13, color: '#4A9EFF', fontWeight: '600' },
  balanceTitulo: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, marginBottom: 24 },
  barItem: { alignItems: 'center', flex: 1 },
  barWrapper: { height: 80, justifyContent: 'flex-end' },
  bar: { width: 18, borderRadius: 4 },
  barPositivo: { backgroundColor: '#34D399' },
  barNegativo: { backgroundColor: '#FF4D4D' },
  barLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4, width: 58, textAlign: 'center' },
  porPersonaContainer: { marginTop: 8 },
  porPersonaTitulo: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  porPersonaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  porPersonaNombre: { fontSize: 13, color: 'rgba(255,255,255,0.8)', width: 78, flexShrink: 0 },
  porPersonaBarBg: { flex: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, marginHorizontal: 8, overflow: 'hidden' },
  porPersonaBarFill: { height: '100%', borderRadius: 5 },
  porPersonaMonto: { fontSize: 12, fontWeight: '600', width: 82, textAlign: 'right' },
  montoPos: { color: '#34D399' },
  montoNeg: { color: '#FF4D4D' },
  destacadosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  destacadoCard: {
    backgroundColor: 'rgba(14,26,52,0.62)', borderRadius: 16, padding: 16, alignItems: 'center', width: '47%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  destacadoEmoji: { fontSize: 32, marginBottom: 6 },
  destacadoNombre: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  destacadoTitulo: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2, textAlign: 'center' },
  rankingCompletTitulo: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  rankingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rankingBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankingPos: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  rankingNombre: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', width: 60 },
  rankingTitulo: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'right' },
  fab: { position: 'absolute', bottom: 90, right: 24, width: 52, height: 52, borderRadius: 26, backgroundColor: '#4A9EFF', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: '#FFFFFF', fontWeight: '700' },
  invitarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 50, marginBottom: 16, backgroundColor: 'rgba(74,158,255,0.12)', borderWidth: 1, borderColor: 'rgba(74,158,255,0.35)' },
  invitarBtnText: { color: '#4A9EFF', fontSize: 15, fontWeight: '700' },
  miembroCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(14,26,52,0.62)', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  miembroAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  miembroInicial: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  miembroNombreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miembroNombre: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  adminBadge: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  adminBadgeText: { fontSize: 11, color: '#F5A623', fontWeight: '600' },
  agregarAmigoBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(74,158,255,0.4)' },
  agregarAmigoBtnActivo: { backgroundColor: 'rgba(74,158,255,0.2)', borderColor: 'rgba(74,158,255,0.6)' },
  agregarAmigoText: { fontSize: 13, color: '#4A9EFF', fontWeight: '600' },
  agregarAmigoTextActivo: { color: '#FFFFFF' },
  agregarMiembroBtn: {
    borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(74,158,255,0.4)', borderStyle: 'dashed',
    backgroundColor: 'rgba(74,158,255,0.05)',
  },
  agregarMiembroText: { fontSize: 15, color: '#4A9EFF', fontWeight: '600' },
  presupuestoCard: {
    backgroundColor: 'rgba(14,26,52,0.62)', borderRadius: 16, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  presupuestoTitulo: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 16, textAlign: 'center' },
  presupuestoStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  presupuestoStatItem: { alignItems: 'center', flex: 1 },
  presupuestoStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 },
  presupuestoStatValor: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  alertaSobrepasa: { backgroundColor: 'rgba(255,77,77,0.12)', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,77,77,0.25)' },
  alertaTexto: { fontSize: 13, color: '#FF8080', textAlign: 'center' },
  barraPresupuestoBg: { height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' },
  barraPresupuestoFill: { height: '100%', borderRadius: 5 },
  presupuestoFormCard: {
    backgroundColor: 'rgba(14,26,52,0.62)', borderRadius: 16, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  presupuestoFormTitulo: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  presupuestoFormSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16 },
  presupuestoInput: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 18, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 8,
  },
  inputError: { borderColor: '#FF4D4D' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginBottom: 8 },
  presupuestoBotones: { flexDirection: 'row', gap: 10, marginTop: 8 },
  presupuestoCancelarBtn: { flex: 1, backgroundColor: 'rgba(255,77,77,0.15)', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  presupuestoCancelarText: { fontSize: 14, color: '#FF4D4D', fontWeight: '600' },
  presupuestoGuardarBtn: { flex: 1, backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  presupuestoGuardarText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  editarPresupuestoBtn: {
    borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(74,158,255,0.4)',
    backgroundColor: 'rgba(74,158,255,0.08)',
  },
  editarPresupuestoText: { fontSize: 15, color: '#4A9EFF', fontWeight: '600' },
  overlayModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  popupModal: {
    backgroundColor: 'rgba(8,18,40,0.97)', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 32,
    alignItems: 'center', width: '85%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  popupModalEmoji: { fontSize: 40, marginBottom: 10 },
  popupModalTitulo: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
  popupModalMensaje: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  popupModalBotones: { flexDirection: 'row', gap: 12, width: '100%' },
  popupModalCancelar: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  popupModalCancelarText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  popupModalConfirmar: { flex: 1, backgroundColor: '#FF4D4D', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  popupModalConfirmarText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  menuBtn: { marginLeft: 'auto', padding: 4, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 22, color: '#FFFFFF', fontWeight: '700' },
  menuDesplegable: {
    position: 'absolute', top: 110, right: 16,
    backgroundColor: 'rgba(8,18,40,0.97)', borderRadius: 14, paddingVertical: 4, zIndex: 100,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    minWidth: 200, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  menuItemEmoji: { fontSize: 18, marginRight: 12 },
  menuItemText: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  menuSeparador: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 12 },
  configOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  configModal: {
    backgroundColor: 'rgba(8,18,40,0.98)', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 24, maxHeight: '90%',
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  configHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  configTitulo: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  configCerrar: { fontSize: 18, color: 'rgba(255,255,255,0.5)', padding: 4 },
  configSeccionTitulo: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  configNota: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12, fontStyle: 'italic' },
  configFotoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  configFotoPreview: { width: 76, height: 76, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)' },
  configFotoPlaceholder: {
    width: 76, height: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(74,158,255,0.14)', borderWidth: 1, borderColor: 'rgba(74,158,255,0.22)',
  },
  configFotoInfo: { flex: 1, minWidth: 0 },
  configFotoTitulo: { fontSize: 14, color: '#FFFFFF', fontWeight: '700', marginBottom: 3 },
  configFotoDesc: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
  configFotoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  configFotoAction: { backgroundColor: '#4A9EFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  configFotoActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  configFotoRemove: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,77,77,0.12)', borderWidth: 1, borderColor: 'rgba(255,77,77,0.25)' },
  configFotoRemoveText: { color: '#FF6B6B', fontSize: 12, fontWeight: '700' },
  configMonedaCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  configMonedaCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  configMonedaBadge: { backgroundColor: '#4A9EFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  configMonedaCodigo: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },
  configMonedaNombreCard: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  configMonedaNombre: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  configMonedaBase: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  tasaModoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tasaModoBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  tasaModoBtnActivo: { backgroundColor: 'rgba(74,158,255,0.2)', borderColor: 'rgba(74,158,255,0.5)' },
  tasaModoBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  tasaModoBtnTextActivo: { color: '#FFFFFF' },
  configTasaAutoValor: { fontSize: 13, color: '#4A9EFF', fontWeight: '600', paddingVertical: 4 },
  configTasaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  configTasaLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  configTasaInput: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 13, color: '#FFFFFF', width: 70, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  configEliminarBtn: { padding: 4 },
  configEliminarText: { fontSize: 16 },
  agregarMonedaBtn: {
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.4)', borderStyle: 'dashed',
    borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 4,
  },
  agregarMonedaText: { fontSize: 14, color: '#4A9EFF', fontWeight: '600' },
  monedasDisponiblesContainer: { marginTop: 8, gap: 8 },
  monedaDisponibleChip: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  monedaDisponibleText: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  configSwitchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  configSwitchTextWrap: { flex: 1 },
  configSwitchTitulo: { fontSize: 14, color: '#FFFFFF', fontWeight: '700', marginBottom: 3 },
  configSwitchDesc: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 17 },
  configSwitch: {
    width: 50, height: 28, borderRadius: 14, padding: 3,
    backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center',
  },
  configSwitchActivo: { backgroundColor: '#4A9EFF' },
  configSwitchDisabled: { opacity: 0.55 },
  configSwitchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  configSwitchThumbActivo: { alignSelf: 'flex-end' },
  configMiembroRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  configMiembroNombre: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  configAdminBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(74,158,255,0.4)' },
  configAdminBtnActivo: { backgroundColor: '#4A9EFF', borderColor: '#4A9EFF' },
  configAdminBtnText: { fontSize: 12, color: '#4A9EFF', fontWeight: '600' },
  configGuardarBtn: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  configGuardarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pausadoBanner: { backgroundColor: 'rgba(245,158,11,0.12)', borderBottomWidth: 1, borderBottomColor: 'rgba(245,158,11,0.25)', paddingVertical: 8, alignItems: 'center' },
  pausadoBannerText: { fontSize: 13, color: '#F5A623', fontWeight: '600' },
  historialMonedaSelector: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  historialMonedaChip: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  historialMonedaChipActivo: { backgroundColor: 'rgba(74,158,255,0.2)', borderColor: 'rgba(74,158,255,0.5)' },
  historialMonedaChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  historialMonedaChipTextActivo: { color: '#FFFFFF' },
});
