export function firstName(nombre?: string | null): string {
  const limpio = String(nombre ?? '').trim();
  if (!limpio) return '';
  return limpio.split(/\s+/)[0];
}

export function firstNameOr(nombre: string | null | undefined, fallback = 'Usuario'): string {
  return firstName(nombre) || fallback;
}
