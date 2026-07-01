import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

let _canal: ReturnType<typeof supabase.channel> | null = null;

export type Notificacion = {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  data: Record<string, any>;
  created_at: string;
};

type NotificacionesStore = {
  notificaciones: Notificacion[];
  cargar: (userId: string) => Promise<void>;
  suscribir: (userId: string) => void;
  desuscribir: () => void;
  confirmarPago: (notifId: string, data: any) => Promise<void>;
  rechazarPago: (notifId: string) => Promise<void>;
  marcarLeida: (id: string) => Promise<void>;
  marcarTodasLeidas: (userId: string) => Promise<void>;
  reset: () => void;
};

export const useNotificacionesStore = create<NotificacionesStore>((set) => ({
  notificaciones: [],

  cargar: async (userId: string) => {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) set({ notificaciones: data });
  },

  suscribir: (userId: string) => {
    if (_canal) supabase.removeChannel(_canal);
    _canal = supabase
      .channel(`notificaciones-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          set(state => ({
            notificaciones: [payload.new as Notificacion, ...state.notificaciones],
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

  confirmarPago: async (notifId: string, data: any) => {
    const monto = Number(data.monto);
    if (!monto || monto <= 0) {
      throw new Error('Monto de pago invalido');
    }

    await supabase.from('pagos').insert({
      grupo_id: data.grupo_id,
      de_nombre: data.de_nombre,
      a_nombre: data.a_nombre,
      monto,
    });
    if (data.debtor_user_id) {
      await supabase.from('notificaciones').insert({
        user_id: data.debtor_user_id,
        tipo: 'pago_confirmado',
        titulo: '¡Pago confirmado!',
        mensaje: `${data.a_nombre} confirmó que le pagaste $${Number(data.monto).toLocaleString('es-AR')} en ${data.grupo_nombre ?? 'el grupo'}.`,
        data: { grupo_id: data.grupo_id },
      });
    }
    await supabase.from('notificaciones').update({ leida: true }).eq('id', notifId);
    set(state => ({
      notificaciones: state.notificaciones.map(n => n.id === notifId ? { ...n, leida: true } : n),
    }));
  },

  rechazarPago: async (notifId: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', notifId);
    set(state => ({
      notificaciones: state.notificaciones.map(n => n.id === notifId ? { ...n, leida: true } : n),
    }));
  },

  marcarLeida: async (id: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    set(state => ({
      notificaciones: state.notificaciones.map(n => n.id === id ? { ...n, leida: true } : n),
    }));
  },

  marcarTodasLeidas: async (userId: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('user_id', userId).eq('leida', false).neq('tipo', 'pago_pendiente');
    set(state => ({
      notificaciones: state.notificaciones.map(n => n.tipo === 'pago_pendiente' ? n : { ...n, leida: true }),
    }));
  },

  reset: () => set({ notificaciones: [] }),
}));
