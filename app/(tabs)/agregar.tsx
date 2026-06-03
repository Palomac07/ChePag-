import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Colors } from '@/constants/theme';

export default function AgregarTab() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/crear-grupo');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return <View style={{ flex: 1, backgroundColor: Colors.teal }} />;
}
