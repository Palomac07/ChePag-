import { Share, Linking } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';

// Genera el link de invitación correcto según el entorno:
// - Expo Go: exp://<dev-server>/--/join/<id>
// - Build dev/prod: chepaga://join/<id>
// En ambos casos expo-router enruta a app/join/[id].
export function buildInviteUrl(grupoId: string): string {
  return ExpoLinking.createURL(`/join/${grupoId}`);
}

export function buildInviteMessage(nombreGrupo: string, url: string): string {
  return `¡Te invito a unirte al grupo "${nombreGrupo}" en ChePaga! 🎉\n\nTocá el link para unirte:\n${url}`;
}

// Compartir por el sheet genérico del SO (WhatsApp, mail, etc.).
export async function shareInvite(nombreGrupo: string, grupoId: string): Promise<void> {
  const url = buildInviteUrl(grupoId);
  try {
    await Share.share({ message: buildInviteMessage(nombreGrupo, url) });
  } catch {
    // El usuario canceló el share; no es un error.
  }
}

// Abrir WhatsApp directo con el mensaje precargado. Si no está instalado,
// cae a wa.me (web/app), y si tampoco, al sheet genérico.
export async function shareViaWhatsApp(nombreGrupo: string, grupoId: string): Promise<void> {
  const mensaje = buildInviteMessage(nombreGrupo, buildInviteUrl(grupoId));
  const texto = encodeURIComponent(mensaje);
  const appUrl = `whatsapp://send?text=${texto}`;
  const webUrl = `https://wa.me/?text=${texto}`;
  try {
    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return;
    }
    await Linking.openURL(webUrl);
  } catch {
    await shareInvite(nombreGrupo, grupoId);
  }
}

// Copia el link al portapapeles y lo devuelve para feedback.
export async function copyInviteLink(grupoId: string): Promise<string> {
  const url = buildInviteUrl(grupoId);
  await Clipboard.setStringAsync(url);
  return url;
}
