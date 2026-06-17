import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BG = require('@/assets/images/bg.png');

const SELLER_USER_ID = '3293275618';
const BUYER_USER_ID = '3293418914';
const BUYER_USERNAME = 'TESTUSER8912732514848919820';

export default function VincularMPScreen() {
  const router = useRouter();

  return (
    <ImageBackground source={BG} style={styles.root} resizeMode="cover" imageStyle={{ transform: [{ scale: 1.08 }] }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.title}>Mercado Pago Sandbox</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Ionicons name="card-outline" size={44} color="#4A9EFF" style={{ marginBottom: 12 }} />
          <Text style={styles.cardTitulo}>Cuenta fija de ChePaga</Text>
          <Text style={styles.cardDesc}>
            En modo prueba todos los cobros se crean con una unica cuenta vendedora sandbox configurada en Supabase.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.pasosTitulo}>Para cobrar</Text>
          <Text style={styles.cardDescLeft}>
            No hace falta vincular Mercado Pago por usuario. La app usa la cuenta vendedora sandbox de ChePaga.
          </Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vendedor user id</Text>
            <Text style={styles.infoValue}>{SELLER_USER_ID}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.pasosTitulo}>Para pagar</Text>
          {[
            'Cerrá sesión de Mercado Pago y Mercado Libre en el navegador del celular.',
            'Abrí el pago desde ChePaga.',
            'En el checkout sandbox, iniciá sesión con la cuenta compradora de prueba.',
            'No uses la cuenta vendedora para confirmar pagos.',
          ].map((paso, i) => (
            <View key={i} style={styles.pasoRow}>
              <View style={styles.pasoNum}><Text style={styles.pasoNumText}>{i + 1}</Text></View>
              <Text style={styles.paso}>{paso}</Text>
            </View>
          ))}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Comprador user id</Text>
            <Text style={styles.infoValue}>{BUYER_USER_ID}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Usuario comprador</Text>
            <Text style={styles.infoValue}>{BUYER_USERNAME}</Text>
          </View>
        </View>

        <Text style={styles.nota}>
          La contraseña y el codigo de verificacion de las cuentas de prueba se comparten por fuera del codigo para no dejarlos publicados en GitHub.
        </Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(14,26,52,0.62)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    marginBottom: 16,
  },
  cardTitulo: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
  cardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20 },
  cardDescLeft: { fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 20, marginBottom: 16 },
  pasosTitulo: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  pasoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  pasoNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(74,158,255,0.25)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pasoNumText: { color: '#4A9EFF', fontSize: 12, fontWeight: '700' },
  paso: { fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 20, flex: 1 },
  infoRow: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 4 },
  infoValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  nota: { fontSize: 12, color: 'rgba(255,255,255,0.42)', textAlign: 'center', lineHeight: 18 },
});
