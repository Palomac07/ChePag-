import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  title: string;
  disabled?: boolean;
  onClose: () => void;
  onPick: (source: 'camara' | 'galeria') => void;
};

export default function ImageSourceModal({ visible, title, disabled, onClose, onPick }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity style={styles.option} onPress={() => onPick('camara')} disabled={disabled}>
            <View style={styles.optionIcon}><Ionicons name="camera-outline" size={22} color="#FFFFFF" /></View>
            <Text style={styles.optionText}>Tomar foto</Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.option} onPress={() => onPick('galeria')} disabled={disabled}>
            <View style={styles.optionIcon}><Ionicons name="image-outline" size={22} color="#FFFFFF" /></View>
            <Text style={styles.optionText}>Elegir de galería</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'rgba(8,18,40,0.97)', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  title: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.38)', marginBottom: 12, textAlign: 'center', letterSpacing: 0.5 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  optionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(74,158,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(74,158,255,0.25)' },
  optionText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
});
