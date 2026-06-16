import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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
  actualizarMonedas: (id: string, monedas: Moneda[]) => Promise<void>;
  hacerAdmin: (grupoId: string, userId: string) => Promise<void>;
  quitarAdmin: (grupoId: string, userId: string) => Promise<void>;
  guardarPresupuesto: (id: string, monto: number) => Promise<void>;
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
        .select('id, nombre, categoria, activo, monedas, creador_id, presupuesto, grupo_miembros(id, user_id, nombre, es_admin)')
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

    const mapeados: Grupo[] = grupos.map((g: any) => {
      const miembros: any[] = g.grupo_miembros || [];
      const avatares = miembros.slice(0, 3).map((m: any) => m.nombre[0].toUpperCase());
      const extras = Math.max(0, miembros.length - 3);

      const monedas: Moneda[] = Array.isArray(g.monedas)
        ? g.monedas
        : [{ codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', tasaARS: 1 }];
      const monedasMap: Record<string, number> = {};
      for (const m of monedas) monedasMap[m.codigo] = m.tasaARS;

      // Saldos por identidad estable (user_id). Antes se calculaba por nombre, pero
      // el nombre no siempre coincide entre grupo_miembros, el pagador y los
      // participantes (al editar el perfil no se actualiza grupo_miembros), y por eso
      // "Debes" quedaba en 0. Colapsamos a user_id cuando existe; si no, al nombre.
      const nombreToId: Record<string, string> = {};
      for (const m of miembros) if (m?.nombre) nombreToId[m.nombre] = m.user_id;
      const idDe = (nombre?: string | null, id?: string | null) =>
        id || (nombre ? (nombreToId[nombre] ?? `nombre:${nombre}`) : 'desconocido');

      const gastos = gastosPorGrupo[g.id] ?? [];
      const saldos: Record<string, number> = {}; // neto por persona, solo para detectar "saldado"
      let totalARS = 0;
      // Importes BRUTOS (no se compensan entre sí, igual que la Actividad Reciente):
      //  - teDebenGross: lo que otros me deben en gastos que pagué yo
      //  - debesGross:  mi parte en gastos que pagó otro
      let teDebenGross = 0;
      let debesGross = 0;

      for (const gasto of gastos) {
        const tasa = monedasMap[gasto.moneda] ?? 1;
        const montoARS = gasto.monto * tasa;
        totalARS += montoARS;
        const participantes = (gasto.participantes as any[] ?? []);
        const partIds = participantes.map((p: any) =>
          typeof p === 'string' ? idDe(p) : idDe(p?.nombre, p?.user_id));
        const parte = partIds.length > 0 ? montoARS / partIds.length : 0;
        const payerId = idDe(gasto.pagador_nombre, gasto.pagador_id);

        saldos[payerId] = (saldos[payerId] ?? 0) + montoARS;
        for (const pid of partIds) saldos[pid] = (saldos[pid] ?? 0) - parte;

        const yoParticipo = partIds.includes(userId);
        if (payerId === userId) {
          teDebenGross += montoARS - (yoParticipo ? parte : 0); // el resto me debe su parte
        } else if (yoParticipo) {
          debesGross += parte; // pagó otro y yo participo: debo mi parte
        }
      }

      for (const pago of pagosPorGrupo[g.id] ?? []) {
        const deId = idDe(pago.de_nombre);
        const aId = idDe(pago.a_nombre);
        saldos[deId] = (saldos[deId] ?? 0) + pago.monto;
        saldos[aId] = (saldos[aId] ?? 0) - pago.monto;
        if (deId === userId) debesGross -= pago.monto;   // salde una deuda
        if (aId === userId) teDebenGross -= pago.monto;   // me pagaron lo que me debían
      }

      const teDebenNum = Math.max(0, Math.round(teDebenGross));
      const debesNum = Math.max(0, Math.round(debesGross));

      const saldado = gastos.length > 0 && Object.values(saldos).every(v => Math.abs(v) <= 1);

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
        miembros: miembros.map((m: any, idx: number) => ({
          user_id: m.user_id,
          nombre: m.nombre,
          es_admin: m.es_admin,
          color: COLORES[idx % COLORES.length],
        })),
      };
    });

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

  actualizarMonedas: async (id, monedas) => {
    await supabase.from('grupos').update({ monedas }).eq('id', id);
    set(state => ({ grupos: state.grupos.map(g => g.id === id ? { ...g, monedas } : g) }));
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

  guardarPresupuesto: async (id, monto) => {
    await supabase.from('grupos').update({ presupuesto: monto }).eq('id', id);
    set(state => ({ grupos: state.grupos.map(g => g.id === id ? { ...g, presupuesto: monto } : g) }));
  },
}));
