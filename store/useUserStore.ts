import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

type Genero = 'masculino' | 'femenino' | 'otro';

type UserStore = {
  id: string;
  genero: Genero | null;
  nombre: string;
  username: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  mpAlias: string;
  setGenero: (genero: Genero) => void;
  setNombre: (nombre: string) => void;
  cargarPerfil: (userId: string) => Promise<void>;
  reset: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  id: '',
  genero: null,
  nombre: '',
  username: '',
  email: '',
  telefono: '',
  fechaNacimiento: '',
  setGenero: (genero) => set({ genero }),
  setNombre: (nombre) => set({ nombre }),
  cargarPerfil: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('nombre, username, telefono, fecha_nacimiento, genero, mp_alias')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      set({
        id: userId,
        nombre: data.nombre ?? '',
        username: data.username ?? '',
        telefono: data.telefono ?? '',
        fechaNacimiento: data.fecha_nacimiento ?? '',
        genero: data.genero ?? null,
        mpAlias: data.mp_alias ?? '',
      });
    } else {
      // Profile row doesn't exist — fall back to auth metadata
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata ?? {};
      set({
        id: userId,
        nombre: meta.nombre ?? '',
        username: meta.username ?? '',
        telefono: meta.telefono ?? '',
        fechaNacimiento: meta.fecha_nacimiento ?? '',
        genero: meta.genero ?? null,
        mpAlias: '',
      });
      // Create the missing profile row — ignoreDuplicates prevents overwriting existing data
      if (meta.nombre) {
        await supabase.from('profiles').upsert({
          id: userId,
          nombre: meta.nombre,
          username: meta.username ?? null,
          telefono: meta.telefono ?? null,
          fecha_nacimiento: meta.fecha_nacimiento ?? null,
          genero: meta.genero ?? null,
        }, { onConflict: 'id', ignoreDuplicates: true });
      }
    }
  },
  reset: () => set({ id: '', genero: null, nombre: '', username: '', email: '', telefono: '', fechaNacimiento: '', mpAlias: '' }),
}));

export const getGeneroText = (genero: Genero | null, palabra: string): string => {
  if (!genero) return palabra;
  if (genero === 'femenino') return `${palabra}a`;
  if (genero === 'otro') return `${palabra}@`;
  return palabra;
};
