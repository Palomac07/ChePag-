import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

let _canal: ReturnType<typeof supabase.channel> | null = null;

export type Amigo = {
  id: string;
  nombre: string;
  username?: string;
  amistad_id: string;
};

export type SolicitudPendiente = {
  id: string;
  solicitante_id: string;
  nombre_solicitante: string;
};

export type SolicitudEnviada = {
  id: string;
  receptor_id: string;
  nombre_receptor: string;
};

type AmistadStore = {
  amigos: Amigo[];
  solicitudesPendientes: SolicitudPendiente[];
  solicitudesEnviadas: SolicitudEnviada[];
  cargarAmigos: (userId: string) => Promise<void>;
  cargarSolicitudes: (userId: string) => Promise<void>;
  cargarSolicitudesEnviadas: (userId: string) => Promise<void>;
  enviarSolicitud: (miId: string, receptorId: string) => Promise<{ error?: string }>;
  responderSolicitud: (solicitudId: string, aceptar: boolean, userId: string) => Promise<void>;
  eliminarAmigo: (amistadId: string, amigoId: string) => Promise<void>;
  suscribirRealtime: (userId: string) => void;
  desuscribir: () => void;
  reset: () => void;
};

export const useAmistadStore = create<AmistadStore>((set) => ({
  amigos: [],
  solicitudesPendientes: [],
  solicitudesEnviadas: [],

  cargarAmigos: async (userId: string) => {
    const { data } = await supabase
      .from('amistades')
      .select('id, solicitante_id, receptor_id')
      .eq('estado', 'aceptada')
      .or(`solicitante_id.eq.${userId},receptor_id.eq.${userId}`);

    if (!data || data.length === 0) {
      set({ amigos: [] });
      return;
    }

    const otrosIds = data.map((a: any) =>
      a.solicitante_id === userId ? a.receptor_id : a.solicitante_id
    );
    const amistadMap: Record<string, string> = {};
    data.forEach((a: any) => {
      const otroId = a.solicitante_id === userId ? a.receptor_id : a.solicitante_id;
      amistadMap[otroId] = a.id;
    });

    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre, username')
      .in('id', otrosIds);

    const amigos: Amigo[] = (perfiles ?? []).map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      username: p.username,
      amistad_id: amistadMap[p.id],
    }));

    set({ amigos });
  },

  cargarSolicitudes: async (userId: string) => {
    const { data } = await supabase
      .from('amistades')
      .select('id, solicitante_id')
      .eq('receptor_id', userId)
      .eq('estado', 'pendiente');

    if (!data || data.length === 0) {
      set({ solicitudesPendientes: [] });
      return;
    }

    const solicitanteIds = data.map((s: any) => s.solicitante_id);
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre')
      .in('id', solicitanteIds);

    const perfilMap: Record<string, string> = Object.fromEntries(
      (perfiles ?? []).map((p: any) => [p.id, p.nombre])
    );

    const solicitudesPendientes: SolicitudPendiente[] = data.map((s: any) => ({
      id: s.id,
      solicitante_id: s.solicitante_id,
      nombre_solicitante: perfilMap[s.solicitante_id] ?? 'Usuario',
    }));

    set({ solicitudesPendientes });
  },

  cargarSolicitudesEnviadas: async (userId: string) => {
    const { data } = await supabase
      .from('amistades')
      .select('id, receptor_id')
      .eq('solicitante_id', userId)
      .eq('estado', 'pendiente');

    if (!data || data.length === 0) {
      set({ solicitudesEnviadas: [] });
      return;
    }

    const receptorIds = data.map((s: any) => s.receptor_id);
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre')
      .in('id', receptorIds);

    const perfilMap: Record<string, string> = Object.fromEntries(
      (perfiles ?? []).map((p: any) => [p.id, p.nombre])
    );

    const solicitudesEnviadas: SolicitudEnviada[] = data.map((s: any) => ({
      id: s.id,
      receptor_id: s.receptor_id,
      nombre_receptor: perfilMap[s.receptor_id] ?? 'Usuario',
    }));

    set({ solicitudesEnviadas });
  },

  enviarSolicitud: async (miId: string, receptorId: string) => {
    const { error } = await supabase
      .from('amistades')
      .insert({ solicitante_id: miId, receptor_id: receptorId, estado: 'pendiente' });

    if (error) {
      if (error.code === '23505') return { error: 'Ya enviaste una solicitud a este usuario.' };
      return { error: 'No se pudo enviar la solicitud.' };
    }
    return {};
  },

  responderSolicitud: async (solicitudId: string, aceptar: boolean, userId: string, miNombre?: string) => {
    const estado = aceptar ? 'aceptada' : 'rechazada';

    // Get solicitante before updating state
    const solicitudActual = useAmistadStore.getState().solicitudesPendientes.find(s => s.id === solicitudId);

    await supabase.from('amistades').update({ estado }).eq('id', solicitudId);

    set(state => ({
      solicitudesPendientes: state.solicitudesPendientes.filter(s => s.id !== solicitudId),
    }));

    if (aceptar && solicitudActual && miNombre) {
      await supabase.from('notificaciones').insert({
        user_id: solicitudActual.solicitante_id,
        tipo: 'amistad_aceptada',
        titulo: '¡Solicitud aceptada!',
        mensaje: `${miNombre} aceptó tu solicitud de amistad.`,
        data: {},
      });
    }

    if (aceptar) {
      const { data } = await supabase
        .from('amistades')
        .select('id, solicitante_id, receptor_id')
        .eq('estado', 'aceptada')
        .or(`solicitante_id.eq.${userId},receptor_id.eq.${userId}`);

      if (!data || data.length === 0) return;

      const otrosIds = data.map((a: any) =>
        a.solicitante_id === userId ? a.receptor_id : a.solicitante_id
      );
      const amistadMap: Record<string, string> = {};
      data.forEach((a: any) => {
        const otroId = a.solicitante_id === userId ? a.receptor_id : a.solicitante_id;
        amistadMap[otroId] = a.id;
      });

      const { data: perfiles } = await supabase
        .from('profiles')
        .select('id, nombre, username')
        .in('id', otrosIds);

      const amigos: Amigo[] = (perfiles ?? []).map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        username: p.username,
        amistad_id: amistadMap[p.id],
      }));

      set({ amigos });
    }
  },

  eliminarAmigo: async (amistadId: string, amigoId: string) => {
    await supabase.from('amistades').delete().eq('id', amistadId);
    set(state => ({
      amigos: state.amigos.filter(a => a.id !== amigoId),
    }));
  },

  suscribirRealtime: (userId: string) => {
    if (_canal) supabase.removeChannel(_canal);

    _canal = supabase
      .channel(`solicitudes-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'amistades', filter: `receptor_id=eq.${userId}` },
        async (payload: any) => {
          const nueva = payload.new;
          const { data: perfil } = await supabase
            .from('profiles')
            .select('nombre')
            .eq('id', nueva.solicitante_id)
            .maybeSingle();

          set(state => ({
            solicitudesPendientes: [
              ...state.solicitudesPendientes,
              {
                id: nueva.id,
                solicitante_id: nueva.solicitante_id,
                nombre_solicitante: perfil?.nombre ?? 'Usuario',
              },
            ],
          }));
        }
      )
      .subscribe();
  },

  desuscribir: () => {
    if (_canal) {
      supabase.removeChannel(_canal);
      _canal = null;
    }
  },

  reset: () => set({ amigos: [], solicitudesPendientes: [], solicitudesEnviadas: [] }),
}));
