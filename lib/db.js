import Dexie from 'dexie';

/**
 * Base de datos local IndexedDB para FleetForce.
 * Guarda el resultado de cada query de Supabase como JSON
 * bajo una clave única, permitiendo navegación sin conexión.
 *
 * Estructura:
 *  cache  → resultados de queries (key, data JSON, timestamp)
 *  meta   → metadatos generales (última sync, empresa activa, etc.)
 */
const db = new Dexie('FleetForceOffline');

db.version(1).stores({
  cache: 'key, ts',   // key = 'tabla_empresaId[_extra]', ts = Date.now()
  meta:  'key'        // key/value genérico para metadatos
});

export { db };
