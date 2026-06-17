import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  emoji: string;
  titulo: string;
  mensaje: string;
  onClose: () => void;
  onCancel?: () => void;
  cancelText?: string;
  confirmText?: string;
};

export default function ConfirmPopup({ visible, emoji, titulo, mensaje, onClose, onCancel, cancelText = 'Cancelar', confirmText = 'Aceptar' }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel ?? onClose}>
      <View style={styles.overlay}>
        <View style={styles.popup}>
          {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.mensaje}>{mensaje}</Text>
          <View style={onCancel ? styles.botones : styles.botonesUnico}>
            {onCancel && (
              <TouchableOpacity style={styles.btnCancelar} onPress={onCancel}>
                <Text style={styles.btnCancelarText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, onCancel && styles.btnFlex]} onPress={onClose}>
              <Text style={styles.btnText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  popup: {
    backgroundColor: 'rgba(8,18,40,0.97)',
    borderRadius: 24, paddingHorizontal: 32, paddingVertical: 36,
    alignItems: 'center', width: '80%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  titulo: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  mensaje: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  botones: { flexDirection: 'row', gap: 12, width: '100%' },
  botonesUnico: { alignItems: 'center' },
  btn: { backgroundColor: '#4A9EFF', borderRadius: 50, paddingVertical: 14, paddingHorizontal: 40 },
  btnFlex: { flex: 1, paddingHorizontal: 0, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnCancelar: { flex: 1, backgroundColor: 'rgba(255,77,77,0.15)', borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  btnCancelarText: { color: '#FF4D4D', fontSize: 15, fontWeight: '600' },
});
