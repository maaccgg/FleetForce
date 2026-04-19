/**
 * Dispara el evento global que activa el OfflineBanner.
 * Llamar desde cualquier página cuando fetchSafe devuelva offline: true.
 *
 * Ejemplo:
 *   const { data, offline } = await fetchSafe(query, 'cacheKey');
 *   if (offline) notifyOffline();
 */
export function notifyOffline() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fleetforce:offline'));
  }
}
