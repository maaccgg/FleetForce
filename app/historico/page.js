'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/sidebar';
import { 
  ShieldAlert, History, Eye, X, ArrowRightRight, 
  Database, User, Clock, ShieldCheck, Lock, FileSearch, Layers, Tag, Calendar, Search
} from 'lucide-react';

const TABS_CONFIG = [
  { id: 'todos', label: 'Todos los Movimientos', tablas: [] },
  { id: 'unidades', label: 'Unidades', tablas: ['unidades', 'operadores'] },
  { id: 'facturas', label: 'Facturas', tablas: ['facturas'] },
  { id: 'gastos', label: 'Gasto Operativo', tablas: ['mantenimientos'] },
  { id: 'viajes', label: 'Viajes', tablas: ['viajes', 'mercancias', 'remolques', 'ubicaciones'] },
  { id: 'sat', label: 'Info SAT (Carta Porte)', tablas: ['perfil_emisor', 'rutas', 'clientes'] }
];

// === NUEVO: Componente para renderizar valores complejos (JSON/Arrays) ===
const RenderValor = ({ valor }) => {
  if (valor === null || valor === undefined) return <span className="text-slate-400 italic">Vacío</span>;
  if (typeof valor === 'boolean') return valor ? 'SÍ' : 'NO';
  
  if (typeof valor === 'object') {
    return (
      <pre className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] sm:text-[11px] overflow-x-auto text-blue-600 dark:text-blue-300 max-h-40 custom-scrollbar transition-colors">
        {JSON.stringify(valor, null, 2)}
      </pre>
    );
  }
  
  return <span className="block whitespace-pre-wrap">{String(valor)}</span>;
};

export default function HistorialPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState(null);
  const [empresaId, setEmpresaId] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [accesoAutorizado, setAccesoAutorizado] = useState(false);
  
  const [activeTab, setActiveTab] = useState('todos');
  const [historial, setHistorial] = useState([]);
  const [modalDetalle, setModalDetalle] = useState(null);

  // === NUEVO: Estados para Rango de Fechas (Por defecto últimos 30 días) ===
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    const verificarAcceso = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return window.location.href = '/';
      setSesion(session);

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol, empresa_id')
        .eq('id', session.user.id)
        .single();

      if (perfil?.rol !== 'administrador') return router.push('/');

      const idMaestro = perfil?.empresa_id || session.user.id;
      setEmpresaId(idMaestro);

      setAccesoAutorizado(true);
      cargarHistorial('todos', idMaestro); 
    };
    verificarAcceso();
  }, [router]);

  async function cargarHistorial(tabId, currentEmpresaId = empresaId) {
    if (!currentEmpresaId) return; 
    
    setLoadingTabla(true);
    try {
      // === NUEVO: Implementación de Filtro por Fechas ===
      let query = supabase
        .from('historial_movimientos')
        .select(`*, perfiles (rol, empresa_id, nombre_completo, email)`)
        .eq('empresa_id', currentEmpresaId)
        .gte('fecha', `${fechaInicio}T00:00:00`)
        .lte('fecha', `${fechaFin}T23:59:59`)
        .order('fecha', { ascending: false })
        .limit(500); // Límite de seguridad extendido ya que ahora filtramos por fecha

      const selectedTab = TABS_CONFIG.find(t => t.id === tabId);
      if (selectedTab && selectedTab.tablas.length > 0) {
        query = query.in('tabla_afectada', selectedTab.tablas);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistorial(data || []);
    } catch (err) {
      console.error("Error al cargar bóveda:", err.message);
    } finally {
      setLoading(false);
      setLoadingTabla(false);
    }
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    cargarHistorial(tabId, empresaId);
  };

  const ejecutarFiltro = () => {
    cargarHistorial(activeTab, empresaId);
  };

  const procesarDiferencias = (oldData, newData, accion) => {
    const cambios = [];
    const camposIgnorados = ['id', 'created_at', 'updated_at', 'usuario_id', 'empresa_id'];

    if (accion === 'INSERT') {
      for (const [key, val] of Object.entries(newData || {})) {
        if (!camposIgnorados.includes(key) && val !== null && val !== '') {
          cambios.push({ campo: key, ant: null, nvo: val }); // Mantenemos el objeto original
        }
      }
    } else if (accion === 'DELETE') {
      for (const [key, val] of Object.entries(oldData || {})) {
        if (!camposIgnorados.includes(key) && val !== null && val !== '') {
          cambios.push({ campo: key, ant: val, nvo: 'ELIMINADO' }); // Mantenemos el objeto original
        }
      }
    } else {
      const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
      for (const key of keys) {
        if (camposIgnorados.includes(key)) continue;
        const oldVal = oldData?.[key];
        const newVal = newData?.[key];
        
        // Comparamos los valores como cadenas JSON para ver si cambiaron
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          cambios.push({ 
            campo: key, 
            ant: oldVal, 
            nvo: newVal 
          });
        }
      }
    }
    return cambios;
  };

  const identificarRegistro = (datos) => {
    if (!datos) return 'REGISTRO DESCONOCIDO';
    const descriptor = datos.folio_interno || datos.folio_viaje || datos.folio || datos.num_viaje || datos.descripcion || datos.nombre || datos.nombre_completo || datos.cliente || datos.numero_economico || datos.placas || datos.razon_social;
    return descriptor ? String(descriptor).toUpperCase() : 'DATOS INTERNOS (ID)';
  };

  const formatearNombreCampo = (campo) => {
    return campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getBudgeAccion = (accion) => {
    switch(accion) {
      case 'INSERT': return { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Creación' };
      case 'UPDATE': return { bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30', text: 'text-orange-700 dark:text-orange-400', label: 'Modificación' };
      case 'DELETE': return { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', text: 'text-red-700 dark:text-red-400', label: 'Eliminación' };
      default: return { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-300', label: accion };
    }
  };

  if (!accesoAutorizado || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 transition-colors">
        <Lock size={40} className="text-slate-300 dark:text-slate-800 animate-pulse transition-colors" />
        <p className="text-slate-500 dark:text-slate-600 font-black uppercase tracking-widest text-[10px] transition-colors">Validando Credenciales...</p>
      </div>
    );
  }

  return (
    <div className="flex bg-transparent min-h-screen text-slate-900 dark:text-slate-200 w-full transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="mb-8 transition-colors">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white leading-none flex items-center gap-3 transition-colors">
               <ShieldCheck className="text-blue-600 dark:text-blue-500" size={32} /> Trazabilidad <span className="text-blue-600 dark:text-blue-500">Operativa</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 sm:ml-11 transition-colors">
              Registro inmutable de movimientos en la base de datos
            </p>
          </header>

          {/* ========================================================= */}
          {/* BARRA DE CONTROLES: TABS Y FILTRO DE FECHAS */}
          {/* ========================================================= */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
            
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide w-full lg:w-auto pb-2">
              {TABS_CONFIG.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shrink-0
                  ${activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-md border-transparent' 
                    : 'bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-500 border-slate-200 dark:border-transparent hover:bg-slate-200 dark:hover:bg-slate-800/50'}`}
                >
                  {activeTab === tab.id && <Layers size={14} />}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selector de Rango de Fechas */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-sm transition-colors w-full lg:w-auto">
              <div className="flex items-center gap-2 px-3">
                <Calendar size={14} className="text-slate-400" />
                <input 
                  type="date" 
                  className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none uppercase cursor-pointer"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <span className="text-slate-300 dark:text-slate-700 font-bold">-</span>
              <div className="flex items-center gap-2 px-3">
                <input 
                  type="date" 
                  className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none uppercase cursor-pointer"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>
              <button 
                onClick={ejecutarFiltro}
                disabled={loadingTabla}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-xl transition-colors ml-1"
                title="Aplicar Filtro"
              >
                <Search size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl relative transition-colors">
            {loadingTabla && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/50 backdrop-blur-sm z-10 flex items-center justify-center transition-colors">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-500 font-black uppercase tracking-widest text-xs">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent animate-spin" />
                  Filtrando Evidencia...
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px] min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[12px] font-semibold uppercase tracking-wider transition-colors">
                    <th className="p-4 pl-8 font-normal">Fecha y Hora</th>
                    <th className="p-4 font-normal">Acción</th>
                    <th className="p-4 font-normal">Módulo / Elemento</th>
                    <th className="p-4 font-normal">Autor del Movimiento</th>
                    <th className="p-4 pr-8 text-right font-normal">Evidencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors">
                  {historial.map((mov) => {
                    const badge = getBudgeAccion(mov.accion);
                    const fechaLocal = new Date(mov.fecha).toLocaleString('es-MX', { 
                      year: 'numeric', month: 'short', day: '2-digit', 
                      hour: '2-digit', minute: '2-digit', second: '2-digit' 
                    });
                    
                    const datosReferencia = mov.datos_nuevos || mov.datos_anteriores;
                    const descriptorAbreviado = identificarRegistro(datosReferencia);

                    const nombreUsuario = mov.perfiles?.nombre_completo ? mov.perfiles.nombre_completo : 'Usuario Eliminado/Sistema';
                    const emailUsuario = mov.perfiles?.email ? mov.perfiles.email : 'N/A';
                    const rolUsuario = mov.perfiles?.rol ? mov.perfiles.rol : 'SISTEMA';

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="p-4 pl-8 align-middle">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono text-[11px] transition-colors">
                            <Clock size={12} className="text-slate-400 dark:text-slate-500" />
                            {fechaLocal}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <span className={`inline-flex px-3 py-1 rounded-lg border uppercase tracking-widest text-[9px] font-black items-center gap-1 transition-colors ${badge.bg} ${badge.border} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold uppercase text-[11px] tracking-wider transition-colors">
                              <Database size={12} className="text-blue-600 dark:text-blue-500" />
                              {mov.tabla_afectada}
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate max-w-[200px]" title={descriptorAbreviado}>
                              Ref: {descriptorAbreviado}
                            </span>
                          </div>
                        </td>
                        
                        <td className="p-4 align-middle">
                           <div className="flex flex-col">
                             <span className="text-slate-900 dark:text-white font-bold capitalize text-[11px] truncate max-w-[150px] transition-colors" title={nombreUsuario}>
                               {nombreUsuario}
                             </span>
                             <span className="text-slate-500 font-mono text-[9px] lowercase truncate max-w-[150px]">
                               {emailUsuario}
                             </span>
                             <span className="text-blue-600 dark:text-blue-400 font-black text-[8px] uppercase tracking-widest mt-0.5 transition-colors">
                               {rolUsuario}
                             </span>
                           </div>
                        </td>
                        
                        <td className="p-4 pr-8 align-middle text-right">
                          <button 
                            onClick={() => setModalDetalle(mov)} 
                            className="p-2 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors inline-flex"
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
                        <History size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3 transition-colors" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm font-bold transition-colors">Sin evidencia registrada</p>
                        <p className="text-slate-400 dark:text-slate-600 uppercase tracking-widest text-[10px] mt-1 transition-colors">Intenta ampliar el rango de fechas de tu búsqueda.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {modalDetalle && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm transition-colors" onClick={() => setModalDetalle(null)} />
              
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 transition-colors">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 transition-colors">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic flex items-center gap-2 transition-colors">
                      <ShieldAlert className="text-orange-500" size={20} /> 
                      Reporte de <span className="text-blue-600 dark:text-blue-500">Alteración</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">Ref UUID: {modalDetalle.registro_id}</p>
                  </div>
                  <button onClick={() => setModalDetalle(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-900 p-2 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900 transition-colors">
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl transition-colors">
                    <div>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Database size={10}/> Módulo</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white uppercase transition-colors">{modalDetalle.tabla_afectada}</p>
                    </div>
                    <div className="border-l border-slate-200 dark:border-slate-800 pl-4 transition-colors">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Tag size={10}/> Registro Exacto</p>
                      <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest truncate transition-colors" title={identificarRegistro(modalDetalle.datos_nuevos || modalDetalle.datos_anteriores)}>
                        {identificarRegistro(modalDetalle.datos_nuevos || modalDetalle.datos_anteriores)}
                      </p>
                    </div>
                    <div className="border-l border-slate-200 dark:border-slate-800 pl-4 transition-colors">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Tipo de Movimiento</p>
                      <span className={`inline-flex px-2 py-0.5 rounded uppercase tracking-widest text-[9px] font-black transition-colors ${getBudgeAccion(modalDetalle.accion).bg} ${getBudgeAccion(modalDetalle.accion).text}`}>
                        {getBudgeAccion(modalDetalle.accion).label}
                      </span>
                    </div>
                    <div className="border-l border-slate-200 dark:border-slate-800 pl-4 transition-colors">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Autor</p>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest truncate transition-colors">
                        {modalDetalle.perfiles?.nombre_completo || 'Sistema'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-colors">
                    <div className="bg-white dark:bg-slate-900 px-6 py-3 border-b border-slate-200 dark:border-slate-800 transition-colors">
                      <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest transition-colors">Detalle de Campos Modificados</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800/50 text-[10px] text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950/50 transition-colors">
                            <th className="p-4 font-bold w-1/4">Campo Específico</th>
                            <th className="p-4 font-bold text-orange-600 dark:text-orange-400/80 w-3/8">Valor Anterior</th>
                            <th className="p-4 font-bold text-emerald-600 dark:text-emerald-400/80 w-3/8">Nuevo Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/30 transition-colors">
                          {procesarDiferencias(modalDetalle.datos_anteriores, modalDetalle.datos_nuevos, modalDetalle.accion).map((cambio, index) => (
                            <tr key={index} className="hover:bg-white dark:hover:bg-slate-900/50 transition-colors">
                              <td className="p-4 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider align-top transition-colors">{formatearNombreCampo(cambio.campo)}</td>
                              <td className="p-4 align-top">
                                <div className="text-[12px] font-mono text-orange-600 dark:text-orange-200/70 max-w-sm">
                                  <RenderValor valor={cambio.ant} />
                                </div>
                              </td>
                              <td className="p-4 align-top">
                                <div className="text-[12px] font-mono text-emerald-600 dark:text-emerald-300 max-w-sm">
                                  <RenderValor valor={cambio.nvo} />
                                </div>
                              </td>
                            </tr>
                          ))}
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