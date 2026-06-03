import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGastoStore } from '@/store/useGastoStore';

const BG = require('@/assets/images/bg.png');

const categorias = [
  { nombre: 'Comida', emoji: '🍴', color: 'rgba(255,200,100,0.2)' },
  { nombre: 'Transporte', emoji: '🚌', color: 'rgba(100,180,255,0.2)' },
  { nombre: 'Medicina', emoji: '💊', color: 'rgba(180,100,255,0.2)' },
  { nombre: 'Productos', emoji: '🛍️', color: 'rgba(255,100,180,0.2)' },
  { nombre: 'Renta', emoji: '🔑', color: 'rgba(100,255,160,0.2)' },
  { nombre: 'Regalo', emoji: '🎁', color: 'rgba(255,220,100,0.2)' },
  { nombre: 'Entretenimiento', emoji: '🎟️', color: 'rgba(200,100,255,0.2)' },
  { nombre: 'Otro', emoji: '💰', color: 'rgba(150,150,150,0.2)' },
];

export default function CategoriasScreen() {
  const router = useRouter();
  const setCategoria = useGastoStore(s => s.setCategoria);
  const [modalVisible, setModalVisible] = useState(false);
  const [otraCategoria, setOtraCategoria] = useState('');
  const [error, setError] = useState('');

  const handleSeleccionar = (cat: { nombre: string }) => {
    if (cat.nombre === 'Otro') {
      setModalVisible(true);
    } else {
      setCategoria(cat.nombre);
      router.back();
    }
  };

  const confirmarOtra = () => {
    if (!otraCategoria.trim()) { setError('Escribí el nombre de la categoría.'); return; }
    setCategoria(otraCategoria.trim());
    setModalVisible(false);
    router.back();
  };

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.title}>Categorías</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.grid}>
          {categorias.map((cat) => (
            <TouchableOpacity key={cat.nombre} style={styles.catItem} onPress={() => handleSeleccionar(cat)} activeOpacity={0.7}>
              <View style={[styles.catIcono, { backgroundColor: cat.color }]}>
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
              </View>
              <Text style={styles.catNombre}>{cat.nombre}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Modal transparent animationType="fade" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.popup}>
            <Text style={styles.popupEmoji}>💰</Text>
            <Text style={styles.popupTitulo}>¿Cuál es la categoría?</Text>
            <TextInput
              style={[styles.popupInput, error ? styles.popupInputError : null]}
              placeholder="Ej: Vacaciones, Mascota..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={otraCategoria}
              onChangeText={(v) => { setOtraCategoria(v); setError(''); }}
              autoFocus
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.popupBotones}>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => { setModalVisible(false); setOtraCategoria(''); setError(''); }}>
                <Text style={styles.cancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmarBtn} onPress={confirmarOtra}>
                <Text style={styles.confirmarText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
  catItem: { width: '29%', alignItems: 'center', marginBottom: 8 },
  catIcono: {
    width: 80, height: 80, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  catEmoji: { fontSize: 34 },
  catNombre: { fontSize: 13, color: '#FFFFFF', textAlign: 'center', fontWeight: '500' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  popup: {
    backgroundColor: 'rgba(8,18,40,0.97)',
    borderRadius: 24, paddingHorizontal: 28, paddingVertical: 32,
    alignItems: 'center', width: '85%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  popupEmoji: { fontSize: 40, marginBottom: 10 },
  popupTitulo: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  popupInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  popupInputError: { borderColor: '#FF4D4D' },
  errorText: { color: '#FF4D4D', fontSize: 12, marginTop: 6, alignSelf: 'flex-start' },
  popupBotones: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  cancelarBtn: { flex: 1, backgroundColor: 'rgba(255,77,77,0.2)', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  cancelarText: { color: '#FF4D4D', fontSize: 14, fontWeight: '600' },
  confirmarBtn: { flex: 1, backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  confirmarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
