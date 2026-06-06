export const esEmailValido = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const esTelefonoValido = (tel: string) =>
  /^[\d\s\+\-]{7,15}$/.test(tel.trim());

// Aplica la máscara DD/MM/AAAA mientras se escribe: inserta las "/" automáticamente.
// Necesario porque el teclado numérico no tiene la tecla "/".
export const formatearFechaInput = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

export const esFechaValida = (fecha: string) => {
  const match = fecha.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const anio = Number(match[3]);
  if (mes < 1 || mes > 12) return false;
  const diasEnMes = new Date(anio, mes, 0).getDate(); // día 0 del mes siguiente = último día del mes
  if (dia < 1 || dia > diasEnMes) return false;
  const ahora = new Date();
  const fechaNac = new Date(anio, mes - 1, dia);
  if (anio < 1900 || fechaNac > ahora) return false; // ni absurda ni futura
  return true;
};

export const esPasswordSegura = (pass: string) => ({
  longitud: pass.length >= 8,
  mayuscula: /[A-Z]/.test(pass),
  numero: /[0-9]/.test(pass),
  simbolo: /[^A-Za-z0-9]/.test(pass),
  valida: pass.length >= 8 && /[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass),
});
