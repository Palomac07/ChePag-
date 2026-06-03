import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store/useUserStore';
import { useGruposStore } from '@/store/useGruposStore';
import { setPendingJoinId } from '@/lib/pendingJoin';

export default function JoinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useUserStore(s => s.id);
  const nombreUsuario = useUserStore(s => s.nombre);
  const cargarGrupos = useGruposStore(s => s.cargarGrupos);

  const [grupo, setGrupo] = useState<{ nombre: string; categoria: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [uniendose, setUniendose] = useState(false);
  const [yaEsMiembro, setYaEsMiembro] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      if (!userId) {
        setPendingJoinId(id);
        router.replace('/login');
        return;
      }

      const { data: grupoData } = await supabase
        .from('grupos')
        .select('nombre, categoria')
        .eq('id', id)
        .maybeSingle();

      if (!grupoData) {
        setNoEncontrado(true);
        setCargando(false);
        return;
      }

      setGrupo(grupoData);

      const { data: membership } = await supabase
        .from('grupo_miembros')
        .select('id')
        .eq('grupo_id', id)
        .eq('user_id', userId)
        .maybeSingle();

      setYaEsMiembro(!!membership);
      setCargando(false);
    };

    cargar();
  }, [id, userId]);

  const handleUnirse = async () => {
    setUniendose(true);
    await supabase.from('grupo_miembros').insert({
      grupo_id: id,
      user_id: userId,
      nombre: nombreUsuario,
      es_admin: false,
    });
    await cargarGrupos(userId);
    setUniendose(false);
    router.replace({ pathname: '/detalle-grupo', params: { nombre: grupo?.nombre, id } });
  };

  if (cargando) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.white} size="large" />
      </View>
    );
  }

  if (noEncontrado) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>❌</Text>
          <Text style={styles.titulo}>Grupo no encontrado</Text>
          <Text style={styles.desc}>Este link de invitación no es válido o el grupo fue eliminado.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.btnText}>Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (yaEsMiembro) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>✅</Text>
          <Text style={styles.titulo}>Ya sos miembro</Text>
          <Text style={styles.desc}>Ya sos parte del grupo "{grupo?.nombre}".</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace({ pathname: '/detalle-grupo', params: { nombre: grupo?.nombre, id } })}>
            <Text style={styles.btnText}>Ver grupo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.subtitulo}>Fuiste invitado a</Text>
        <Text style={styles.nombreGrupo}>{grupo?.nombre}</Text>
        <TouchableOpacity style={styles.btn} onPress={handleUnirse} disabled={uniendose}>
          {uniendose
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>Unirme al grupo</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancelar} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.btnCancelarText}>Ahora no</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.teal, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.white, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%' },
  emoji: { fontSize: 52, marginBottom: 12 },
  subtitulo: { fontSize: 15, color: Colors.textGray, marginBottom: 6 },
  titulo: { fontSize: 20, fontWeight: '700', color: Colors.textDark, marginBottom: 8, textAlign: 'center' },
  nombreGrupo: { fontSize: 24, fontWeight: '700', color: Colors.tealDark, marginBottom: 28, textAlign: 'center' },
  desc: { fontSize: 14, color: Colors.textGray, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  btn: { backgroundColor: Colors.teal, borderRadius: 50, paddingVertical: 16, alignItems: 'center', width: '100%', marginBottom: 12 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  btnCancelar: { paddingVertical: 10 },
  btnCancelarText: { color: Colors.textGray, fontSize: 14 },
});
