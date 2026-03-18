'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/sidebar';
import { 
  ShieldAlert, History, Eye, X, ArrowRightRight, 
  Database, User, Clock, ShieldCheck, Lock, FileSearch
} from 'lucide-react';

export default function HistorialPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accesoAutorizado, setAccesoAutorizado] = useState(false);
  
  const [historial, setHistorial] = useState([]);
  const [modalDetalle, setModalDetalle] = useState(null);

  // =========================================================================
  // 1. EL GUARDIA DE RUTA (ROUTE GUARD)
  // =========================================================================
  useEffect(() => {
    const verificarAcceso = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = '/';
        return;
      }

      setSesion(session);

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', session.user.id)
        .single();

      if (perfil?.rol !== 'administrador') {
        router.push('/');
        return;
      }

      setAccesoAutorizado(true);
      cargarHistorial();
    };

    verificarAcceso();
  }, [router]);

  // =========================================================================
  // 2. CARGA DE DATOS DE LA BÓVEDA CON JOIN A PERFILES
  // =========================================================================
  async function cargarHistorial() {
    setLoading(true);
    try {
      // Inyectamos un JOIN para traer información del perfil asociado a ese usuario_id
      const { data, error } = await supabase
        .from('historial_movimientos')
        .select(`
          *,
          perfiles (rol, empresa_id)
        `)
        .order('fecha', { ascending: false })
        .limit(150); 

      if (error) throw error;
      setHistorial(data || []);
    } catch (err) {
      console.error("Error al cargar bóveda:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // 3. MOTOR DE TRADUCCIÓN DE EVIDENCIA (DIFF ENGINE)
  // =========================================================================
  const procesarDiferencias = (oldData, newData, accion) => {
    const cambios = [];
    const camposIgnorados = ['id', 'created_at', 'updated_at', 'usuario_id'];

    if (accion === 'INSERT') {
      for (const [key, val] of Object.entries(newData || {})) {
        if (!camposIgnorados.includes(key) && val !== null && val !== '') {
          cambios.push({ campo: key, ant: '---', nvo: String(val) });
        }
      }
    } else if (accion === 'DELETE') {
      for (const [key, val] of Object.entries(oldData || {})) {
        if (!camposIgnorados.includes(key) && val !== null && val !== '') {
          cambios.push({ campo: key, ant: String(val), nvo: 'ELIMINADO' });
        }
      }
    } else {
      // UPDATE: Comparación exacta de claves
      const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
      for (const key of keys) {
        if (camposIgnorados.includes(key)) continue;
        
        const oldVal = oldData?.[key];
        const newVal = newData?.[key];
        
        // Solo agregamos a la lista si realmente cambiaron
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          cambios.push({ 
            campo: key, 
            ant: oldVal !== null && oldVal !== undefined ? String(oldVal) : 'Vacío', 
            nvo: newVal !== null && newVal !== undefined ? String(newVal) : 'Vacío' 
          });
        }
      }
    }
    return cambios;
  };

  const formatearNombreCampo = (campo) => {
    return campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // =========================================================================
  // INTERFAZ GRÁFICA (UI)
  // =========================================================================
  const getBudgeAccion = (accion) => {
    switch(accion) {
      case 'INSERT': return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Creación' };
      case 'UPDATE': return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', label: 'Modificación' };
      case 'DELETE': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Eliminación' };
      default: return { bg: 'bg-slate-800', border: 'border-slate-700', text: 'text-slate-300', label: accion };
    }
  };

  if (!accesoAutorizado || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Lock size={40} className="text-slate-800 animate-pulse" />
        <p className="text-slate-600 font-black uppercase tracking-widest text-[10px]">Validando Credenciales de Seguridad...</p>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200 w-full">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="mb-10">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none flex items-center gap-3">
               <ShieldCheck className="text-blue-500" size={32} /> Trazabilidad <span className="text-blue-500">Operativa</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 ml-11">
              Registro inmutable de movimientos en la base de datos
            </p>
          </header>

          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-[12px] font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-8 font-normal">Fecha y Hora</th>
                    <th className="p-4 font-normal">Acción</th>
                    <th className="p-4 font-normal">Módulo</th>
                    <th className="p-4 font-normal">Autor del Movimiento</th>
                    <th className="p-4 pr-8 text-right font-normal">Evidencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {historial.map((mov) => {
                    const badge = getBudgeAccion(mov.accion);
                    const fechaLocal = new Date(mov.fecha).toLocaleString('es-MX', { 
                      year: 'numeric', month: 'short', day: '2-digit', 
                      hour: '2-digit', minute: '2-digit', second: '2-digit' 
                    });

                    // Identificación del Usuario Legible
                    const rolUsuario = mov.perfiles?.rol ? mov.perfiles.rol.toUpperCase() : 'DESCONOCIDO';
                    const idCorto = mov.usuario_id ? mov.usuario_id.split('-')[0] : 'S/I';
                    const nombreUsuario = `${rolUsuario} (${idCorto})`;

                    return (
                      <tr key={mov.id} className="hover:bg-slate-800/30 transition-colors group">
                        
                        <td className="p-4 pl-8 align-middle">
                          <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
                            <Clock size={12} className="text-slate-500" />
                            {fechaLocal}
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <span className={`inline-flex px-3 py-1 rounded-lg border uppercase tracking-widest text-[9px] font-black items-center gap-1 ${badge.bg} ${badge.border} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2 text-white font-bold uppercase text-[11px] tracking-wider">
                            <Database size={14} className="text-blue-500" />
                            {mov.tabla_afectada}
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                           <div className="flex items-center gap-2">
                             <User size={12} className="text-slate-500" />
                             <span className="text-slate-300 font-bold text-[10px] tracking-widest uppercase">
                               {nombreUsuario}
                             </span>
                           </div>
                        </td>

                        <td className="p-4 pr-8 align-middle text-right">
                          <button 
                            onClick={() => setModalDetalle(mov)} 
                            className="p-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors inline-flex"
                            title="Analizar Cambios"
                          >
                            <FileSearch size={16} />
                          </button>
                        </td>

                      </tr>
                    );
                  })}

                  {historial.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-20 text-center">
                        <History size={32} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm">No se han registrado movimientos recientes.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MODAL DE INSPECCIÓN SIMPLIFICADA (DIFF) */}
          {/* ========================================================================= */}
          {modalDetalle && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setModalDetalle(null)} />
              
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase italic flex items-center gap-2">
                      <ShieldAlert className="text-orange-500" size={20} /> 
                      Reporte de <span className="text-blue-500">Alteración</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">Ref: {modalDetalle.registro_id}</p>
                  </div>
                  <button onClick={() => setModalDetalle(null)} className="text-slate-500 hover:text-white bg-slate-900 p-2 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-slate-900">
                  
                  <div className="flex items-center gap-4 mb-6 bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <div className="flex-1">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Módulo Afectado</p>
                      <p className="text-sm font-bold text-white uppercase">{modalDetalle.tabla_afectada}</p>
                    </div>
                    <div className="flex-1 border-l border-slate-800 pl-4">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Tipo de Movimiento</p>
                      <span className={`inline-flex px-2 py-0.5 rounded uppercase tracking-widest text-[9px] font-black ${getBudgeAccion(modalDetalle.accion).bg} ${getBudgeAccion(modalDetalle.accion).text}`}>
                        {getBudgeAccion(modalDetalle.accion).label}
                      </span>
                    </div>
                    <div className="flex-1 border-l border-slate-800 pl-4">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Autor</p>
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                        {modalDetalle.perfiles?.rol ? modalDetalle.perfiles.rol : 'Desconocido'} 
                        <span className="text-[9px] font-mono text-slate-500 ml-1">({modalDetalle.usuario_id?.split('-')[0]})</span>
                      </p>
                    </div>
                  </div>

                  {/* TABLA COMPARATIVA SIMPLIFICADA */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-900 px-6 py-3 border-b border-slate-800">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Detalle de Campos Modificados</p>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800/50 text-[10px] text-slate-500 uppercase tracking-widest bg-slate-950/50">
                            <th className="p-4 font-bold">Campo Especifico</th>
                            <th className="p-4 font-bold text-orange-400/80">Valor Anterior</th>
                            <th className="p-4 font-bold text-emerald-400/80">Nuevo Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {procesarDiferencias(modalDetalle.datos_anteriores, modalDetalle.datos_nuevos, modalDetalle.accion).map((cambio, index) => (
                            <tr key={index} className="hover:bg-slate-900/50 transition-colors">
                              <td className="p-4 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                {formatearNombreCampo(cambio.campo)}
                              </td>
                              <td className="p-4 text-[12px] font-mono text-orange-200/70 max-w-[200px] truncate" title={cambio.ant}>
                                {cambio.ant}
                              </td>
                              <td className="p-4 text-[12px] font-mono text-emerald-300 max-w-[200px] truncate" title={cambio.nvo}>
                                {cambio.nvo}
                              </td>
                            </tr>
                          ))}
                          
                          {procesarDiferencias(modalDetalle.datos_anteriores, modalDetalle.datos_nuevos, modalDetalle.accion).length === 0 && (
                            <tr>
                              <td colSpan="3" className="p-8 text-center text-slate-500 text-[10px] uppercase tracking-widest italic">
                                No se detectaron alteraciones en campos de valor.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}