'use client';
import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Clock } from 'lucide-react';
import { getLastSync } from '@/lib/fetchSafe';

/**
 * Banner global que aparece cuando Supabase no está disponible.
 * Muestra: aviso de modo offline + hora del último caché + botón de reintento.
 *
 * Se monta en layout.js y escucha el evento personalizado 'fleetforce:offline'
 * que lanzan las páginas cuando detectan que fetchSafe devolvió offline:true.
 */

export default function OfflineBanner() {
  const [visible, setVisible] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // Escuchar evento que lanzan las páginas al detectar modo offline
    const handleOffline = async () => {
      const ts = await getLastSync();
      setLastSync(ts);
      setVisible(true);
    };

    // También escuchar los eventos nativos del navegador
    const handleOnline  = () => setVisible(false);
    const handleBrowserOffline = async () => {
      const ts = await getLastSync();
      setLastSync(ts);
      setVisible(true);
    };

    window.addEventListener('fleetforce:offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleBrowserOffline);

    return () => {
      window.removeEventListener('fleetforce:offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleBrowserOffline);
    };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    // Recargar la página para reintentar conexión con Supabase
    window.location.reload();
  };

  const formatLastSync = (isoString) => {
    if (!isoString) return 'sin datos en caché';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('es-MX', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] flex justify-center p-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-4 bg-amber-950 border border-amber-500/40 text-amber-200 px-5 py-3 rounded-2xl shadow-2xl shadow-amber-900/30 max-w-xl w-full animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Ícono */}
        <div className="shrink-0 w-9 h-9 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/30">
          <WifiOff size={16} className="text-amber-400" />
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">
            Modo Sin Conexión
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock size={10} className="text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-500 truncate">
              Datos al: <span className="text-amber-400 font-semibold">{formatLastSync(lastSync)}</span>
            </p>
          </div>
        </div>

        {/* Botón reintentar */}
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="shrink-0 flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-100 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
          Reintentar
        </button>

      </div>
    </div>
  );
}
