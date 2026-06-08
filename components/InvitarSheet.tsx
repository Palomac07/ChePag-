import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildInviteUrl, shareInvite, shareViaWhatsApp, copyInviteLink } from '@/lib/invite';

type Props = {
  visible: boolean;
  grupoId: string;
  nombreGrupo: string;
  onClose: () => void;
};

export default function InvitarSheet({ visible, grupoId, nombreGrupo, onClose }: Props) {
  const [copiado, setCopiado] = useState(false);
  const url = grupoId ? buildInviteUrl(grupoId) : '';

  useEffect(() => { if (!visible) setCopiado(false); }, [visible]);

  const handleCopiar = async () => {
    await copyInviteLink(grupoId);
    setCopiado(true);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.titulo}>Invitar al grupo</Text>
          <Text style={styles.subtitulo}>{`Compartí este link para que se unan a "${nombreGrupo}"`}</Text>

          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{url}</Text>
          </View>

          <TouchableOpacity style={[styles.opcion, styles.opcionWhatsapp]} onPress={() => shareViaWhatsApp(nombreGrupo, grupoId)}>
            <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
            <Text style={styles.opcionText}>Invitar por WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcion} onPress={handleCopiar}>
            <View style={styles.opcionIcon}><Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={20} color="#FFFFFF" /></View>
            <Text style={styles.opcionText}>{copiado ? '¡Link copiado!' : 'Copiar link'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcion} onPress={() => shareInvite(nombreGrupo, grupoId)}>
            <View style={styles.opcionIcon}><Ionicons name="share-social-outline" size={20} color="#FFFFFF" /></View>
            <Text style={styles.opcionText}>Compartir por otro medio</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(8,18,40,0.97)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  titulo: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  subtitulo: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  linkBox: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  linkText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  opcionWhatsapp: { backgroundColor: '#25D366', justifyContent: 'center' },
  opcionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(74,158,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(74,158,255,0.3)' },
  opcionText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
