export const esEmailValido = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const esTelefonoValido = (tel: string) =>
  /^[\d\s\+\-]{7,15}$/.test(tel.trim());

export const esFechaValida = (fecha: string) => {
  const regex = /^(\d{2})[\/-](\d{2})[\/-](\d{2,4})$/;
  if (!regex.test(fecha.trim())) return false;
  const [, dia, mes] = fecha.trim().match(regex)!;
  return Number(dia) >= 1 && Number(dia) <= 31 && Number(mes) >= 1 && Number(mes) <= 12;
};

export const esPasswordSegura = (pass: string) => ({
  longitud: pass.length >= 8,
  mayuscula: /[A-Z]/.test(pass),
  numero: /[0-9]/.test(pass),
  simbolo: /[^A-Za-z0-9]/.test(pass),
  valida: pass.length >= 8 && /[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass),
});
