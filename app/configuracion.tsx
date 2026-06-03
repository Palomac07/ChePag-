import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import ConfirmPopup from '@/components/ConfirmPopup';
import SwipeBackWrapper from '@/components/SwipeBackWrapper';

export default function ConfiguracionScreen() {
  const router = useRouter();
  const [notifPagos, setNotifPagos] = useState(true);
  const [notifRecordatorios, setNotifRecordatorios] = useState(true);
  const [notifGastos, setNotifGastos] = useState(true);
  const [popupVisible, setPopupVisible] = useState(false);

  return (
    <SwipeBackWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
      </View>

      <ScrollView style={styles.body}>
        <Text style={styles.seccion}>Notificaciones</Text>

        <View style={styles.item}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemEmoji}>💳</Text>
            <View>
              <Text style={styles.itemLabel}>Pagos recibidos</Text>
              <Text style={styles.itemSub}>Avisame cuando alguien me pague</Text>
            </View>
          </View>
          <Switch value={notifPagos} onValueChange={setNotifPagos} trackColor={{ true: Colors.teal }} />
        </View>

        <View style={styles.item}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemEmoji}>🔔</Text>
            <View>
              <Text style={styles.itemLabel}>Recordatorios</Text>
              <Text style={styles.itemSub}>Recordarme deudas pendientes</Text>
            </View>
          </View>
          <Switch value={notifRecordatorios} onValueChange={setNotifRecordatorios} trackColor={{ true: Colors.teal }} />
        </View>

        <View style={styles.item}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemEmoji}>🧾</Text>
            <View>
              <Text style={styles.itemLabel}>Nuevos gastos</Text>
              <Text style={styles.itemSub}>Avisame cuando agreguen un gasto</Text>
            </View>
          </View>
          <Switch value={notifGastos} onValueChange={setNotifGastos} trackColor={{ true: Colors.teal }} />
        </View>

        <Text style={styles.seccion}>Cuenta</Text>

        <TouchableOpacity style={styles.item} onPress={() => router.push('/editar-perfil' as any)}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemEmoji}>👤</Text>
            <Text style={styles.itemLabel}>Editar perfil</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => router.push('/seguridad' as any)}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemEmoji}>🔐</Text>
            <Text style={styles.itemLabel}>Cambiar contraseña</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.item, styles.itemPeligro]} onPress={() => setPopupVisible(true)}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemEmoji}>🗑️</Text>
            <Text style={[styles.itemLabel, { color: Colors.red }]}>Eliminar cuenta</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmPopup
        visible={popupVisible}
        emoji="⚠️"
        titulo="Próximamente"
        mensaje="La eliminación de cuenta estará disponible en la próxima versión."
        onClose={() => setPopupVisible(false)}
      />
    </View>
    </SwipeBackWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.teal },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  backIcon: { fontSize: 22, color: Colors.white },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  body: { flex: 1, backgroundColor: Colors.tealLight, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 24 },
  seccion: { fontSize: 13, fontWeight: '700', color: Colors.textGray, marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10 },
  itemInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemEmoji: { fontSize: 22 },
  itemLabel: { fontSize: 15, fontWeight: '600', color: Colors.textDark },
  itemSub: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textGray },
  itemPeligro: { borderWidth: 1, borderColor: '#FFCCCC' },
});
