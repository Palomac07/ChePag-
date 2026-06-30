import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

export type ImagenElegida = { uri: string; base64: string };
// 'denied' = el usuario no dio permiso; null = canceló o no se obtuvo imagen.
export type ResultadoImagen = ImagenElegida | 'denied' | null;

const PICKER_OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.6,
  base64: true,
};

const aImagen = (resultado: ImagePicker.ImagePickerResult): ImagenElegida | null => {
  if (resultado.canceled) return null;
  const asset = resultado.assets?.[0];
  if (!asset?.base64) return null;
  return { uri: asset.uri, base64: asset.base64 };
};

// Toma una foto con la cámara. 'denied' si no hay permiso, null si se cancela.
export async function pickFromCamera(): Promise<ResultadoImagen> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) return 'denied';
  return aImagen(await ImagePicker.launchCameraAsync(PICKER_OPTS));
}

// Elige una imagen de la galería. 'denied' si no hay permiso, null si se cancela.
export async function pickFromGallery(): Promise<ResultadoImagen> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return 'denied';
  return aImagen(await ImagePicker.launchImageLibraryAsync(PICKER_OPTS));
}

// Sube la imagen (en base64) al bucket privado y devuelve el path guardado, o null si falla.
export async function uploadTicket(
  userId: string,
  grupoId: string,
  base64: string,
  bucket = 'tickets',
): Promise<string | null> {
  const path = `${userId}/${grupoId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) return null;
  return path;
}

// Borra una imagen del bucket privado. Devuelve true si se borró (o no había nada que borrar).
export async function deleteTicket(path: string, bucket = 'tickets'): Promise<boolean> {
  if (!path) return true;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
}

// Genera una URL firmada temporal para mostrar una imagen privada, o null si falla.
export async function getSignedUrl(
  path: string,
  expiresInSec = 3600,
  bucket = 'tickets',
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error || !data) return null;
  return data.signedUrl;
}
