import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getSignedUrl } from '@/lib/ticketImage';
import { calcularResumenPersonal } from '@/lib/balances';

export type GrupoMiembro = {
  user_id: string;
  nombre: string;
  es_admin: boolean;
  color: string;
};

export type Moneda = {
  codigo: string;
  nombre: string;
  simbolo: string;
  tasaARS: number;
  tasaAuto?: boolean;
  fotoPath?: string;
};

export type Grupo = {
  id: string;
  nombre: string;
  participantes: number;
  avatares: string[];
  extras: number;
  totalGastado: string;
  totalGastadoNum: number;
  teDeben: string;
  teDebenNum: number;
  debesNum: number;
  debes: string;
  activo: boolean;
  saldado: boolean;
  colores: string[];
  categoria: 'Viaje' | 'Evento' | 'Otro';
  monedas: Moneda[];
  administradores: string[];
  creador_id: string;
  miembros: GrupoMiembro[];
  presupuesto: number | null;
  rankingActivo: boolean;
  fotoPath: string | null;
  fotoUrl: string | null;
};

export const categoriaEmoji: Record<string, string> = {
  Viaje: '✈️',
  Evento: '🎉',
  Otro: '👥',
};

const COLORES = ['#9B8EC4', '#7BC4B8', '#6BAED6', '#5BAA9F', '#C084C0', '#4A6580', '#6BAA9F'];

type GruposStore = {
  grupos: Grupo[];
  cargarGrupos: (userId: string) => Promise<void>;
  pausarGrupo: (id: string) => Promise<void>;
  reanudarGrupo: (id: string) => Promise<void>;
  salirGrupo: (id: string) => Promise<void>;
  eliminarGrupo: (id: string) => Promise<boolean>;
  actualizarMonedas: (id: string, monedas: Moneda[]) => Promise<void>;
  hacerAdmin: (grupoId: string, userId: string) => Promise<void>;
  quitarAdmin: (grupoId: string, userId: string) => Promise<void>;
  eliminarMiembro: (grupoId: string, userId: string) => Promise<boolean>;
  guardarPresupuesto: (id: string, monto: number) => Promise<void>;
  actualizarRanking: (id: string, activo: boolean) => Promise<void>;
};

export const useGruposStore = create<GruposStore>((set, get) => ({
  grupos: [],

  cargarGrupos: async (userId: string) => {
    const { data: memberships } = await supabase
      .from('grupo_miembros')
      .select('grupo_id')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      set({ grupos: [] });
      return;
    }

    const grupoIds = memberships.map((m: any) => m.grupo_id);

    const [{ data: grupos }, { data: gastosData }, { data: pagosData }] = await Promise.all([
      supabase
        .from('grupos')
        .select('id, nombre, categoria, activo, monedas, creador_id, presupuesto, ranking_activo, grupo_miembros(id, user_id, nombre, es_admin)')
        .in('id', grupoIds),
      supabase
        .from('gastos')
        .select('grupo_id, pagador_nombre, pagador_id, monto, moneda, participantes')
        .in('grupo_id', grupoIds),
      supabase
        .from('pagos')
        .select('grupo_id, de_nombre, a_nombre, monto')
        .in('grupo_id', grupoIds),
    ]);

    if (!grupos) return;

    const gastosPorGrupo: Record<string, any[]> = {};
    for (const g of gastosData ?? []) {
      if (!gastosPorGrupo[g.grupo_id]) gastosPorGrupo[g.grupo_id] = [];
      gastosPorGrupo[g.grupo_id].push(g);
    }

    const pagosPorGrupo: Record<string, any[]> = {};
    for (const p of pagosData ?? []) {
      if (!pagosPorGrupo[p.grupo_id]) pagosPorGrupo[p.grupo_id] = [];
      pagosPorGrupo[p.grupo_id].push(p);
    }

    const mapeados: Grupo[] = await Promise.all(grupos.map(async (g: any) => {
      const miembros: any[] = g.grupo_miembros || [];
      const avatares = miembros.slice(0, 3).map((m: any) => m.nombre[0].toUpperCase());
      const extras = Math.max(0, miembros.length - 3);

      const monedas: Moneda[] = Array.isArray(g.monedas)
        ? g.monedas
        : [{ codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', tasaARS: 1 }];
      const fotoPath = monedas.find(m => m.fotoPath)?.fotoPath ?? null;
      const gastos = gastosPorGrupo[g.id] ?? [];
      const resumen = calcularResumenPersonal(userId, gastos, monedas, pagosPorGrupo[g.id] ?? [], miembros);
      const { totalARS, teDebenNum, debesNum, saldado } = resumen;

      return {
        id: g.id,
        nombre: g.nombre,
        categoria: g.categoria as 'Viaje' | 'Evento' | 'Otro',
        participantes: miembros.length,
        avatares,
        extras,
        colores: COLORES.slice(0, Math.min(3, miembros.length)),
        totalGastado: totalARS > 0 ? `$${Math.round(totalARS).toLocaleString('es-AR')}` : '$0',
        totalGastadoNum: Math.round(totalARS),
        teDeben: teDebenNum > 0 ? `$${Math.round(teDebenNum).toLocaleString('es-AR')}` : '$0',
        teDebenNum: Math.round(teDebenNum),
        debesNum: Math.round(debesNum),
        debes: debesNum > 0 ? `$${Math.round(debesNum).toLocaleString('es-AR')}` : '$0',
        activo: g.activo ?? true,
        saldado,
        monedas,
        administradores: miembros.filter((m: any) => m.es_admin).map((m: any) => m.nombre),
        creador_id: g.creador_id ?? '',
        presupuesto: g.presupuesto ?? null,
        rankingActivo: g.ranking_activo ?? true,
        fotoPath,
        fotoUrl: fotoPath ? await getSignedUrl(fotoPath) : null,
        miembros: miembros.map((m: any, idx: number) => ({
          user_id: m.user_id,
          nombre: m.nombre,
          es_admin: m.es_admin,
          color: COLORES[idx % COLORES.length],
        })),
      };
    }));

    set({ grupos: mapeados });
  },

  pausarGrupo: async (id) => {
    await supabase.from('grupos').update({ activo: false }).eq('id', id);
    set(state => ({ grupos: state.grupos.map(g => g.id === id ? { ...g, activo: false } : g) }));
  },

  reanudarGrupo: async (id) => {
    await supabase.from('grupos').update({ activo: true }).eq('id', id);
    set(state => ({ grupos: state.grupos.map(g => g.id === id ? { ...g, activo: true } : g) }));
  },

  salirGrupo: async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('grupo_miembros').delete().eq('grupo_id', id).eq('user_id', user.id);
    }
    set(state => ({ grupos: state.grupos.filter(g => g.id !== id) }));
  },

  eliminarGrupo: async (id) => {
    const [{ error: pagosError }, { error: gastosError }, { error: miembrosError }] = await Promise.all([
      supabase.from('pagos').delete().eq('grupo_id', id),
      supabase.from('gastos').delete().eq('grupo_id', id),
      supabase.from('grupo_miembros').delete().eq('grupo_id', id),
    ]);
    if (pagosError || gastosError || miembrosError) return false;
    const { error } = await supabase.from('grupos').delete().eq('id', id);
    if (error) return false;
    set(state => ({ grupos: state.grupos.filter(g => g.id !== id) }));
    return true;
  },

  actualizarMonedas: async (id, monedas) => {
    await supabase.from('grupos').update({ monedas }).eq('id', id);
    const fotoPath = monedas.find(m => m.fotoPath)?.fotoPath ?? null;
    const fotoUrl = fotoPath ? await getSignedUrl(fotoPath) : null;
    set(state => ({ grupos: state.grupos.map(g => g.id === id ? { ...g, monedas, fotoPath, fotoUrl } : g) }));
  },

  hacerAdmin: async (grupoId, userId) => {
    await supabase.from('grupo_miembros').update({ es_admin: true }).eq('grupo_id', grupoId).eq('user_id', userId);
    set(state => ({
      grupos: state.grupos.map(g => {
        if (g.id !== grupoId) return g;
        const miembro = g.miembros.find(m => m.user_id === userId);
        if (!miembro) return g;
        return {
          ...g,
          administradores: [...g.administradores, miembro.nombre],
          miembros: g.miembros.map(m => m.user_id === userId ? { ...m, es_admin: true } : m),
        };
      }),
    }));
  },

  quitarAdmin: async (grupoId, userId) => {
    await supabase.from('grupo_miembros').update({ es_admin: false }).eq('grupo_id', grupoId).eq('user_id', userId);
    set(state => ({
      grupos: state.grupos.map(g => {
        if (g.id !== grupoId) return g;
        const miembro = g.miembros.find(m => m.user_id === userId);
        if (!miembro) return g;
        return {
          ...g,
          administradores: g.administradores.filter(a => a !== miembro.nombre),
          miembros: g.miembros.map(m => m.user_id === userId ? { ...m, es_admin: false } : m),
        };
      }),
    }));
  },

  eliminarMiembro: async (grupoId, userId) => {
    const { error } = await supabase.from('grupo_miembros').delete().eq('grupo_id', grupoId).eq('user_id', userId);
    if (error) return false;
    set(state => ({
      grupos: state.grupos.map(g => {
        if (g.id !== grupoId) return g;
        const miembro = g.miembros.find(m => m.user_id === userId);
        const miembros = g.miembros.filter(m => m.user_id !== userId);
        return {
          ...g,
          miembros,
          participantes: miembros.length,
          administradores: miembro ? g.administradores.filter(a => a !== miembro.nombre) : g.administradores,
        };
      }),
    }));
    return true;
  },

  guardarPresupuesto: async (id, monto) => {
    await supabase.from('grupos').update({ presupuesto: monto }).eq('id', id);
    set(state => ({ grupos: state.grupos.map(g => g.id === id ? { ...g, presupuesto: monto } : g) }));
  },

  actualizarRanking: async (id, activo) => {
    await supabase.from('grupos').update({ ranking_activo: activo }).eq('id', id);
    set(state => ({ grupos: state.grupos.map(g => g.id === id ? { ...g, rankingActivo: activo } : g) }));
  },
}));
