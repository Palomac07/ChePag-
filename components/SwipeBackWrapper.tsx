import { useRef } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SwipeBackWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => {
      if (g.dx > 0) translateX.setValue(g.dx);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SCREEN_WIDTH * 0.3 || g.vx > 0.5) {
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }).start(() => {
          if (router.canGoBack()) router.back();
          translateX.setValue(0);
        });
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateX }] }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}
