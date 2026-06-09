import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#050816' }, gestureEnabled: true, gestureResponseDistance: { start: 999 } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="mis-grupos" />
        <Stack.Screen name="crear-grupo" />
        <Stack.Screen name="agregar-participantes" />
        <Stack.Screen name="detalle-grupo" />
        <Stack.Screen name="pagar-ahora" />
        <Stack.Screen name="agregar-gasto" />
        <Stack.Screen name="categorias" />
        <Stack.Screen name="editar-perfil" />
        <Stack.Screen name="seguridad" />
        <Stack.Screen name="amigos" />
        <Stack.Screen name="join/[id]" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
