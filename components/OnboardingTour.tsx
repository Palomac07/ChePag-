import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LOGO = require('@/assets/images/chepaga-logo.jpeg');

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Slide = { icon?: IoniconName; logo?: boolean; titulo: string; texto: string };

const SLIDES: Slide[] = [
  { logo: true, titulo: '¡Bienvenido a ChePagá!', texto: 'Dividí gastos con amigos sin dramas. Te mostramos lo básico en 30 segundos.' },
  { icon: 'people-outline', titulo: 'Creá grupos', texto: 'Armá un grupo para tu viaje, salida o evento e invitá a tus amigos con un link.' },
  { icon: 'receipt-outline', titulo: 'Cargá los gastos', texto: 'Anotá quién pagó y entre quiénes se divide. Podés adjuntar la foto del ticket.' },
  { icon: 'swap-horizontal-outline', titulo: '¿Quién le debe a quién?', texto: 'ChePagá calcula los saldos solo: cuánto te deben y cuánto debés en cada grupo.' },
  { icon: 'cloud-download-outline', titulo: 'Saldá y exportá', texto: 'Pagá con MercadoPago o marcá como saldado, y exportá el resumen en PDF o CSV.' },
];

export default function OnboardingTour({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;

  const cerrar = () => { setStep(0); onClose(); };
  const siguiente = () => { if (last) cerrar(); else setStep(s => s + 1); };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={cerrar}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {!last && (
            <TouchableOpacity style={styles.saltar} onPress={cerrar} hitSlop={10}>
              <Text style={styles.saltarText}>Saltar</Text>
            </TouchableOpacity>
          )}

          <View style={styles.visual}>
            {slide.logo ? (
              <Image source={LOGO} style={styles.logo} resizeMode="cover" />
            ) : (
              <View style={styles.iconCircle}>
                <Ionicons name={slide.icon} size={44} color="#4A9EFF" />
              </View>
            )}
          </View>

          <Text style={styles.titulo}>{slide.titulo}</Text>
          <Text style={styles.texto}>{slide.texto}</Text>

          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActivo]} />
            ))}
          </View>

          <TouchableOpacity style={styles.boton} onPress={siguiente} activeOpacity={0.85}>
            <Text style={styles.botonText}>{last ? '¡Empezar!' : 'Siguiente'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(3,7,17,0.82)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 360,
    backgroundColor: 'rgba(14,26,52,0.96)',
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 26, paddingTop: 40, paddingBottom: 26,
    alignItems: 'center',
  },
  saltar: { position: 'absolute', top: 16, right: 18, padding: 4 },
  saltarText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  visual: { marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 110, height: 110, borderRadius: 22 },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(74,158,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  titulo: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 },
  texto: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 24 },
  dots: { flexDirection: 'row', gap: 7, marginBottom: 24 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotActivo: { backgroundColor: '#4A9EFF', width: 20 },
  boton: {
    width: '100%', backgroundColor: '#4A9EFF',
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  botonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
