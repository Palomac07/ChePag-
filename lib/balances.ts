export type MonedaBalance = {
  codigo: string;
  tasaARS: number;
};

export type MiembroBalance = {
  user_id: string;
  nombre: string;
};

export type ParticipanteBalance = string | {
  id?: string | null;
  user_id?: string | null;
  nombre?: string | null;
};

export type GastoBalance = {
  pagador?: string | null;
  pagador_nombre?: string | null;
  pagador_id?: string | null;
  monto: number;
  moneda: string;
  participantes?: ParticipanteBalance[] | null;
  participantesData?: { id?: string | null; user_id?: string | null; nombre?: string | null }[] | null;
};

export type PagoBalance = {
  de?: string | null;
  de_nombre?: string | null;
  a?: string | null;
  a_nombre?: string | null;
  monto: number;
};

export type BalancePersona = {
  nombre: string;
  monto: number;
};

export type TransferenciaMinima = {
  de: string;
  a: string;
  monto: number;
};

type IdentidadResolver = {
  idDe: (nombre?: string | null, id?: string | null) => string;
  nombreDe: (id: string) => string;
};

function crearResolutorIdentidad(gastos: GastoBalance[], miembros: MiembroBalance[]): IdentidadResolver {
  const nombreToId: Record<string, string> = {};
  const idToNombre: Record<string, string> = {};

  for (const miembro of miembros) {
    if (miembro.nombre) nombreToId[miembro.nombre] = miembro.user_id;
    if (miembro.user_id) idToNombre[miembro.user_id] = miembro.nombre;
  }

  for (const gasto of gastos) {
    const pagadorNombre = gasto.pagador_nombre ?? gasto.pagador ?? '';
    if (gasto.pagador_id && pagadorNombre && !idToNombre[gasto.pagador_id]) {
      idToNombre[gasto.pagador_id] = pagadorNombre;
    }
    if (pagadorNombre && !nombreToId[pagadorNombre]) {
      nombreToId[pagadorNombre] = gasto.pagador_id ?? '';
    }

    for (const participante of participantesConIdentidad(gasto)) {
      if (participante.id && participante.nombre && !idToNombre[participante.id]) {
        idToNombre[participante.id] = participante.nombre;
      }
      if (participante.nombre && !nombreToId[participante.nombre]) {
        nombreToId[participante.nombre] = participante.id ?? '';
      }
    }
  }

  const idDe = (nombre?: string | null, id?: string | null) => {
    if (id) return id;
    if (nombre) return nombreToId[nombre] || `nombre:${nombre}`;
    return 'desconocido';
  };

  const nombreDe = (id: string) => idToNombre[id] || (id.startsWith('nombre:') ? id.slice(7) : id);

  return { idDe, nombreDe };
}

function participantesConIdentidad(gasto: GastoBalance) {
  if (gasto.participantesData?.length) {
    return gasto.participantesData.map(p => ({ id: p.id ?? p.user_id ?? '', nombre: p.nombre ?? '' }));
  }

  return (gasto.participantes ?? []).map((p) => {
    if (typeof p === 'string') return { id: '', nombre: p };
    return { id: p.user_id ?? p.id ?? '', nombre: p.nombre ?? '' };
  });
}

function crearMapaTasas(monedas: MonedaBalance[]) {
  const tasas: Record<string, number> = {};
  for (const moneda of monedas) tasas[moneda.codigo] = moneda.tasaARS;
  return tasas;
}

export function calcularSaldosPorPersona(
  gastos: GastoBalance[],
  monedas: MonedaBalance[],
  pagos: PagoBalance[] = [],
  miembros: MiembroBalance[] = [],
) {
  const tasas = crearMapaTasas(monedas);
  const { idDe } = crearResolutorIdentidad(gastos, miembros);
  const saldos: Record<string, number> = {};
  let totalARS = 0;

  for (const gasto of gastos) {
    const montoARS = gasto.monto * (tasas[gasto.moneda] ?? 1);
    totalARS += montoARS;

    const participantes = participantesConIdentidad(gasto).map(p => idDe(p.nombre, p.id));
    const parte = participantes.length > 0 ? montoARS / participantes.length : 0;
    const pagadorId = idDe(gasto.pagador_nombre ?? gasto.pagador, gasto.pagador_id);

    saldos[pagadorId] = (saldos[pagadorId] ?? 0) + montoARS;
    for (const participanteId of participantes) {
      saldos[participanteId] = (saldos[participanteId] ?? 0) - parte;
    }
  }

  for (const pago of pagos) {
    const deId = idDe(pago.de_nombre ?? pago.de);
    const aId = idDe(pago.a_nombre ?? pago.a);
    saldos[deId] = (saldos[deId] ?? 0) + pago.monto;
    saldos[aId] = (saldos[aId] ?? 0) - pago.monto;
  }

  return { saldos, totalARS };
}

export function calcularBalanceGrupo(
  gastos: GastoBalance[],
  monedas: MonedaBalance[],
  pagos: PagoBalance[] = [],
  miembros: MiembroBalance[] = [],
): BalancePersona[] {
  const { nombreDe } = crearResolutorIdentidad(gastos, miembros);
  const { saldos } = calcularSaldosPorPersona(gastos, monedas, pagos, miembros);

  return Object.entries(saldos).map(([id, monto]) => ({
    nombre: nombreDe(id),
    monto: Math.round(monto),
  }));
}

export function calcularTransferenciasMinimas(
  gastos: GastoBalance[],
  monedas: MonedaBalance[],
  pagos: PagoBalance[] = [],
  miembros: MiembroBalance[] = [],
): TransferenciaMinima[] {
  const saldos = calcularBalanceGrupo(gastos, monedas, pagos, miembros);
  const deudores = saldos.filter(s => s.monto < 0).sort((a, b) => a.monto - b.monto).map(s => ({ ...s }));
  const acreedores = saldos.filter(s => s.monto > 0).sort((a, b) => b.monto - a.monto).map(s => ({ ...s }));
  const transferencias: TransferenciaMinima[] = [];

  let i = 0;
  let j = 0;
  while (i < deudores.length && j < acreedores.length) {
    const monto = Math.min(-deudores[i].monto, acreedores[j].monto);
    transferencias.push({ de: deudores[i].nombre, a: acreedores[j].nombre, monto: Math.round(monto) });
    deudores[i].monto += monto;
    acreedores[j].monto -= monto;
    if (Math.abs(deudores[i].monto) < 1) i++;
    if (Math.abs(acreedores[j].monto) < 1) j++;
  }

  return transferencias;
}

export function calcularResumenPersonal(
  userId: string,
  gastos: GastoBalance[],
  monedas: MonedaBalance[],
  pagos: PagoBalance[] = [],
  miembros: MiembroBalance[] = [],
) {
  const tasas = crearMapaTasas(monedas);
  const { idDe } = crearResolutorIdentidad(gastos, miembros);
  const { saldos, totalARS } = calcularSaldosPorPersona(gastos, monedas, pagos, miembros);
  let teDebenGross = 0;
  let debesGross = 0;

  for (const gasto of gastos) {
    const montoARS = gasto.monto * (tasas[gasto.moneda] ?? 1);
    const participantes = participantesConIdentidad(gasto).map(p => idDe(p.nombre, p.id));
    const parte = participantes.length > 0 ? montoARS / participantes.length : 0;
    const pagadorId = idDe(gasto.pagador_nombre ?? gasto.pagador, gasto.pagador_id);
    const yoParticipo = participantes.includes(userId);

    if (pagadorId === userId) {
      teDebenGross += montoARS - (yoParticipo ? parte : 0);
    } else if (yoParticipo) {
      debesGross += parte;
    }
  }

  for (const pago of pagos) {
    const deId = idDe(pago.de_nombre ?? pago.de);
    const aId = idDe(pago.a_nombre ?? pago.a);
    if (deId === userId) debesGross -= pago.monto;
    if (aId === userId) teDebenGross -= pago.monto;
  }

  return {
    totalARS: Math.round(totalARS),
    teDebenNum: Math.max(0, Math.round(teDebenGross)),
    debesNum: Math.max(0, Math.round(debesGross)),
    saldado: gastos.length > 0 && Object.values(saldos).every(v => Math.abs(v) <= 1),
  };
}