'use client';
import { db } from './db';

/**
 * Ejecuta una query de Supabase y cachea el resultado en Dexie.
 * Si Supabase no responde (caída, sin internet), sirve desde caché local.
 *
 * USO:
 *   const { data, offline } = await fetchSafe(
 *     supabase.from('viajes').select('*').eq('empresa_id', id),
 *     `viajes_${id}`
 *   );
 *
 * @param {PromiseLike}  queryPromise  Query de Supabase sin await
 * @param {string}       cacheKey      Clave única para esta query (ej: 'viajes_abc123')
 * @returns {{ data: any, offline: boolean }}
 */
export async function fetchSafe(queryPromise, cacheKey) {
  try {
    const result = await queryPromise;

    // Supabase devuelve { data, error } — si hay error de negocio lo propagamos normal
    if (result.error) throw result.error;

    const data = result.data;

    // Guardar resultado en Dexie (best-effort: si IndexedDB falla no bloqueamos)
    try {
      await db.cache.put({
        key: cacheKey,
        data: JSON.stringify(data),
        ts: Date.now(),
      });
      await db.meta.put({ key: 'lastSync', value: new Date().toISOString() });
    } catch {
      // IndexedDB no disponible (SSR, modo privado extremo, etc.) — continuar igual
    }

    return { data, offline: false };

  } catch {
    // Supabase falló → intentar caché local
    try {
      const cached = await db.cache.get(cacheKey);
      if (cached?.data) {
        return { data: JSON.parse(cached.data), offline: true };
      }
    } catch {
      // Dexie también falló (primera carga sin caché)
    }

    // Sin datos en ningún lado
    return { data: null, offline: true };
  }
}

/**
 * Obtiene el timestamp ISO de la última sincronización exitosa con Supabase.
 * @returns {string|null}
 */
export async function getLastSync() {
  try {
    const meta = await db.meta.get('lastSync');
    return meta?.value || null;
  } catch {
    return null;
  }
}