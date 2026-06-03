let _lastUpdate = 0;
const TTL = 24 * 60 * 60 * 1000;

export const needsRatesFetch = () => Date.now() - _lastUpdate > TTL;
export const markRatesFetched = () => { _lastUpdate = Date.now(); };

export async function fetchRatesMap(): Promise<Record<string, number> | null> {
  try {
    const [resBlue, resCotizaciones] = await Promise.all([
      fetch('https://dolarapi.com/v1/dolares/blue'),
      fetch('https://dolarapi.com/v1/cotizaciones'),
    ]);
    const blue = await resBlue.json();
    const cotizaciones: { moneda: string; venta: number }[] = await resCotizaciones.json();
    const mapa: Record<string, number> = { USD: blue.venta };
    for (const c of cotizaciones) mapa[c.moneda.toUpperCase()] = c.venta;
    markRatesFetched();
    return mapa;
  } catch {
    return null;
  }
}
