import { useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

const TABS = ['/', '/grupos', '/agregar', '/notificaciones', '/perfil'];

// Pantallas que actúan como un tab pero son stack screens
const ALIAS: Record<string, number> = { '/crear-grupo': 2 };

export default function SwipeTabWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const startX = useRef(0);
  const startY = useRef(0);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: (_, g) => {
      startX.current = g.x0;
      startY.current = g.y0;
    },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) < 50) return;
      const idx = ALIAS[pathname] ?? TABS.findIndex(t => t === pathname);
      if (idx === -1) return;
      if (g.dx < 0 && idx < TABS.length - 1) {
        router.replace(TABS[idx + 1] as any);
      } else if (g.dx > 0 && idx > 0) {
        router.replace(TABS[idx - 1] as any);
      }
    },
  });

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
