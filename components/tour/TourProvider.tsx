import React, { createContext, useContext, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image, Pressable } from 'react-native';

const LOGO = require('@/assets/images/chepaga-logo.jpeg');

// Pasos del tour. `target` null => tarjeta de bienvenida centrada (sin spotlight).
type Step = { target: string | null; titulo: string; texto: string };
const STEPS: Step[] = [
  { target: null, titulo: '¡Bienvenido a ChePagá!', texto: 'Te muestro los botones principales en unos segundos. Tocá "Siguiente".' },
  { target: 'tab-home', titulo: 'Inicio', texto: 'Acá ves tu balance: cuánto te deben, cuánto debés y la actividad reciente.' },
  { target: 'tab-grupos', titulo: 'Grupos', texto: 'Todos tus grupos en un solo lugar. Entrá para ver gastos y saldos.' },
  { target: 'tab-add', titulo: 'El botón +', texto: 'Desde acá creás un grupo, cargás un gasto o sumás un amigo.' },
  { target: 'tab-notifs', titulo: 'Notificaciones', texto: 'Pagos, recordatorios de deudas y solicitudes de amistad.' },
  { target: 'tab-perfil', titulo: 'Perfil', texto: 'Editá tus datos y volvé a ver este tutorial cuando quieras.' },
];

type Rect = { x: number; y: number; width: number; height: number };
type Ctx = { registerTarget: (key: string, node: any) => void; startTour: () => void };

const TourContext = createContext<Ctx>({ registerTarget: () => {}, startTour: () => {} });
export const useTour = () => useContext(TourContext);

/** Devuelve un callback-ref para marcar un elemento como objetivo del tour. */
export function useTourTarget(key: string) {
  const { registerTarget } = useTour();
  return useCallback((node: any) => registerTarget(key, node), [key, registerTarget]);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const targets = useRef<Record<string, any>>({});
  const registerTarget = useCallback((key: string, node: any) => { targets.current[key] = node; }, []);

  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const show = useCallback((idx: number) => {
    if (idx < 0 || idx >= STEPS.length) { setRunning(false); setRect(null); setStepIdx(0); return; }
    setStepIdx(idx);
    setRect(null);

    const step = STEPS[idx];
    if (!step.target) return; // bienvenida: tarjeta centrada, sin medir

    const tryMeasure = (attempt: number) => {
      const node = targets.current[step.target as string];
      if (!node || typeof node.measureInWindow !== 'function') {
        if (attempt < 8) setTimeout(() => tryMeasure(attempt + 1), 130);
        else show(idx + 1); // no se pudo ubicar: saltar
        return;
      }
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        if ((!width || !height) && attempt < 8) { setTimeout(() => tryMeasure(attempt + 1), 130); return; }
        setRect({ x, y, width, height });
      });
    };
    tryMeasure(0);
  }, []);

  const startTour = useCallback(() => {
    setRunning(true);
    setStepIdx(0);
    setRect(null);
    setTimeout(() => show(0), 300);
  }, [show]);

  const stop = useCallback(() => { setRunning(false); setRect(null); setStepIdx(0); }, []);
  const next = useCallback(() => show(stepIdx + 1), [show, stepIdx]);

  const ctxValue = useMemo<Ctx>(() => ({ registerTarget, startTour }), [registerTarget, startTour]);

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const { width: SW, height: SH } = Dimensions.get('window');

  return (
    <TourContext.Provider value={ctxValue}>
      {children}

      {running && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {step?.target == null ? (
            // Tarjeta de bienvenida centrada
            <View style={styles.dimFull}>
              <View style={styles.welcome}>
                <Image source={LOGO} style={styles.logo} resizeMode="cover" />
                <Text style={styles.titulo}>{step.titulo}</Text>
                <Text style={styles.texto}>{step.texto}</Text>
                <Dots total={STEPS.length} active={stepIdx} />
                <View style={styles.row}>
                  <TouchableOpacity onPress={stop} hitSlop={10}><Text style={styles.saltar}>Saltar</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.boton} onPress={next} activeOpacity={0.85}>
                    <Text style={styles.botonText}>Siguiente</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : rect ? (
            <Spotlight
              rect={rect} SW={SW} SH={SH}
              titulo={step.titulo} texto={step.texto}
              stepIdx={stepIdx} total={STEPS.length} isLast={isLast}
              onNext={next} onSkip={stop}
            />
          ) : (
            // Midiendo: dim completo para bloquear toques un instante
            <View style={styles.dimFull} />
          )}
        </View>
      )}
    </TourContext.Provider>
  );
}

function Dots({ total, active }: { total: number; active: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.dotActivo]} />
      ))}
    </View>
  );
}

function Spotlight({
  rect, SW, SH, titulo, texto, stepIdx, total, isLast, onNext, onSkip,
}: {
  rect: Rect; SW: number; SH: number; titulo: string; texto: string;
  stepIdx: number; total: number; isLast: boolean; onNext: () => void; onSkip: () => void;
}) {
  const pad = 10;
  const hx = Math.max(0, rect.x - pad);
  const hy = Math.max(0, rect.y - pad);
  const hw = rect.width + pad * 2;
  const hh = rect.height + pad * 2;
  const enMitadInferior = rect.y > SH / 2;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Cuatro rectángulos oscuros alrededor del objetivo (dejan el botón visible) */}
      <View style={[styles.dim, { left: 0, top: 0, width: SW, height: hy }]} />
      <View style={[styles.dim, { left: 0, top: hy + hh, width: SW, height: Math.max(0, SH - (hy + hh)) }]} />
      <View style={[styles.dim, { left: 0, top: hy, width: hx, height: hh }]} />
      <View style={[styles.dim, { left: hx + hw, top: hy, width: Math.max(0, SW - (hx + hw)), height: hh }]} />

      {/* Borde resaltado + captura de toque sobre el objetivo (avanza el tour) */}
      <Pressable onPress={onNext} style={[styles.highlight, { left: hx, top: hy, width: hw, height: hh }]} />

      {/* Tooltip */}
      <View style={[styles.tooltip, enMitadInferior ? { bottom: SH - hy + 14 } : { top: hy + hh + 14 }]}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.texto}>{texto}</Text>
        <Dots total={total} active={stepIdx} />
        <View style={styles.row}>
          <TouchableOpacity onPress={onSkip} hitSlop={10}><Text style={styles.saltar}>Saltar</Text></TouchableOpacity>
          <TouchableOpacity style={styles.boton} onPress={onNext} activeOpacity={0.85}>
            <Text style={styles.botonText}>{isLast ? '¡Listo!' : 'Siguiente'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const DIM = 'rgba(3,7,17,0.84)';
const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: DIM },
  dimFull: { ...StyleSheet.absoluteFillObject, backgroundColor: DIM, alignItems: 'center', justifyContent: 'center', padding: 28 },
  highlight: {
    position: 'absolute', borderRadius: 18,
    borderWidth: 2, borderColor: '#4A9EFF',
    backgroundColor: 'rgba(74,158,255,0.08)',
  },
  tooltip: {
    position: 'absolute', left: 20, right: 20,
    backgroundColor: 'rgba(14,26,52,0.98)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 20,
  },
  welcome: {
    width: '100%', maxWidth: 360, alignItems: 'center',
    backgroundColor: 'rgba(14,26,52,0.98)',
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 26, paddingTop: 36, paddingBottom: 22,
  },
  logo: { width: 96, height: 96, borderRadius: 20, marginBottom: 20 },
  titulo: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 8, letterSpacing: -0.3, textAlign: 'center' },
  texto: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.62)', marginBottom: 16, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 16, alignSelf: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotActivo: { backgroundColor: '#4A9EFF', width: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  saltar: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600', paddingVertical: 8, paddingRight: 12 },
  boton: { backgroundColor: '#4A9EFF', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 26 },
  botonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
