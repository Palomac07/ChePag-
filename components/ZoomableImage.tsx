import { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_DELAY = 280; // ms entre toques para contar como doble tap

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const distancia = (touches: { pageX: number; pageY: number }[]) => {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

// Imagen con zoom por pellizco (pinch), arrastre cuando está ampliada y doble tap
// para ampliar/restaurar. Usa PanResponder + Animated para mantener el mismo
// enfoque que el resto de la app (sin gesture-handler/reanimated).
export default function ZoomableImage({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Valores ya confirmados (al soltar) y lecturas en vivo de los Animated.Value.
  const lastScale = useRef(1);
  const lastTranslate = useRef({ x: 0, y: 0 });
  const curScale = useRef(1);
  const curTranslate = useRef({ x: 0, y: 0 });

  // Estado del gesto en curso.
  const startScale = useRef(1);
  const startDistance = useRef(0);
  const lastTap = useRef(0);
  const modo = useRef<'none' | 'pan' | 'pinch'>('none');
  const size = useRef({ w: 0, h: 0 });

  // Mantenemos las lecturas en vivo: al soltar, los touches ya no están disponibles.
  scale.addListener(({ value }) => { curScale.current = value; });
  translateX.addListener(({ value }) => { curTranslate.current.x = value; });
  translateY.addListener(({ value }) => { curTranslate.current.y = value; });

  const animarA = (s: number, x: number, y: number) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, bounciness: 0, speed: 18 }),
      Animated.spring(translateX, { toValue: x, useNativeDriver: true, bounciness: 0, speed: 18 }),
      Animated.spring(translateY, { toValue: y, useNativeDriver: true, bounciness: 0, speed: 18 }),
    ]).start();
    lastScale.current = s;
    lastTranslate.current = { x, y };
  };

  // Mantiene la imagen dentro de los límites visibles según la escala actual.
  const limitarTraslacion = (s: number, x: number, y: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const maxX = ((s - 1) * size.current.w) / 2;
    const maxY = ((s - 1) * size.current.h) / 2;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2 || modo.current !== 'none',
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 1) {
          const ahora = Date.now();
          if (ahora - lastTap.current < DOUBLE_TAP_DELAY) {
            // Doble tap: alterna entre tamaño normal y ampliado.
            if (lastScale.current > 1) animarA(1, 0, 0);
            else animarA(DOUBLE_TAP_SCALE, 0, 0);
            lastTap.current = 0;
          } else {
            lastTap.current = ahora;
          }
        }
        startScale.current = lastScale.current;
        startDistance.current = 0;
        modo.current = 'none';
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          modo.current = 'pinch';
          const d = distancia(touches);
          if (startDistance.current === 0) { startDistance.current = d; return; }
          const next = clamp(startScale.current * (d / startDistance.current), MIN_SCALE, MAX_SCALE);
          scale.setValue(next);
        } else if (touches.length === 1 && lastScale.current > 1) {
          modo.current = 'pan';
          translateX.setValue(lastTranslate.current.x + g.dx);
          translateY.setValue(lastTranslate.current.y + g.dy);
        }
      },
      onPanResponderRelease: () => {
        const s = clamp(curScale.current, MIN_SCALE, MAX_SCALE);
        const { x, y } = limitarTraslacion(s, curTranslate.current.x, curTranslate.current.y);
        animarA(s, x, y);
        modo.current = 'none';
        startDistance.current = 0;
      },
      onPanResponderTerminate: () => {
        const s = clamp(curScale.current, MIN_SCALE, MAX_SCALE);
        const { x, y } = limitarTraslacion(s, curTranslate.current.x, curTranslate.current.y);
        animarA(s, x, y);
        modo.current = 'none';
        startDistance.current = 0;
      },
    })
  ).current;

  return (
    <View style={[styles.container, style]} onLayout={onLayout} {...panResponder.panHandlers}>
      <Animated.View style={[styles.fill, { transform: [{ scale }, { translateX }, { translateY }] }]}>
        <Image source={{ uri }} style={styles.fill} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
