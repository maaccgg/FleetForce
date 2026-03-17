'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Wrench, PlusCircle, History, Trash2, Fuel, X, 
  Truck, TrendingDown, Calendar, Search, ChevronDown 
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';

export default function GastosOperativosPage() {
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  
  const [unidades, setUnidades] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [metricas, setMetricas] = useState({ totalPeriodo: 0, conteo: 0 });
  
  const [empresaId, setEmpresaId] = useState(null);
  const [rolUsuario, setRolUsuario] = useState('miembro');

  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes);

  const [formData, setFormData] = useState({ 
    unidad_id: '', descripcion: '', costo: '', tipo: 'Preventivo',
    fecha: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/";
      else {
        setSesion(session);
        inicializarDatos(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (empresaId) obtenerDatos(empresaId);
  }, [fechaInicio, fechaFin]);

  async function inicializarDatos(userId) {
    setLoading(true);
    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('empresa_id, rol')
      .eq('id', userId)
      .single();

    const idMaestro = perfilData?.empresa_id || userId;
    setEmpresaId(idMaestro);
    if (perfilData?.rol) setRolUsuario(perfilData.rol);

    await obtenerDatos(idMaestro);
  }

async function obtenerDatos(idMaestro) {
    setLoading(true);
    
    // 1. Cargar catálogo de unidades (SOLO ACTIVAS)
    const { data: unidadesBD } = await supabase
      .from('unidades')
      .select('id, numero_economico')
      .eq('usuario_id', idMaestro)
      .eq('activo', true);
    setUnidades(unidadesBD || []);

    // 2. Consulta con Rango de Fechas (CON ID DE LA EMPRESA)
    const { data: gastosBD, error } = await supabase
      .from('mantenimientos')
      .select(`*, unidades(numero_economico)`)
      .eq('usuario_id', idMaestro)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false });

    if (error) console.error(error);

    const total = gastosBD?.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0) || 0;

    setMetricas({ totalPeriodo: total, conteo: gastosBD?.length || 0 });
    setHistorial(gastosBD || []);
    setLoading(false);
  }

  const registrarGasto = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('mantenimientos').insert([
      { ...formData, costo: parseFloat(formData.costo), usuario_id: empresaId } 
    ]);

    if (!error) {
      setFormData({ unidad_id: '', descripcion: '', costo: '', tipo: 'Preventivo', fecha: new Date().toISOString().split('T')[0] });
      setMostrarFormulario(false);
      obtenerDatos(empresaId);
    }
    setLoading(false);
  };

  const eliminarGasto = async (id) => {
    if (!confirm("¿Eliminar registro de gasto?")) return;
    await supabase.from('mantenimientos').delete().eq('id', id);
    obtenerDatos(empresaId);
  };

  if (!sesion) return <div className="min-h-screen bg-slate-950"></div>;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200 w-full">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                Gastos <span className="text-blue-600">Operativos</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Control de Egresos por Periodo</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setMostrarFiltro(!mostrarFiltro)}
                  className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                >
                  <Calendar size={14} className="text-blue-300" />
                  Periodo
                  <ChevronDown size={14} />
                </button>

                {mostrarFiltro && (
                  <div className="absolute right-0 mt-3 w-72 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Desde</label>
                        <input type="date" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" 
                          value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Hasta</label>
                        <input type="date" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" 
                          value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                      </div>
                      <button onClick={() => setMostrarFiltro(false)} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[9px] font-black uppercase">Aplicar</button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setMostrarFormulario(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
                <PlusCircle size={14} /> Registrar
              </button>
            </div>
          </header>

          {rolUsuario === 'administrador' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 animate-in fade-in">
              <TarjetaDato 
                titulo="Egreso en Rango" 
                valor={`$${metricas.totalPeriodo.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} 
                color="blue" 
              />
              <TarjetaDato 
                titulo="Registros" 
                valor={metricas.conteo.toString()} 
                color="blue" 
              />
            </div>
          )}

          {/* TABLA DE HISTORIAL ESTANDARIZADA */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-[12px] font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-8 font-normal w-16">Tipo</th>
                    <th className="p-4 font-normal">Detalle del Gasto</th>
                    <th className="p-4 font-normal">Unidad</th>
                    <th className="p-4 font-normal">Fecha</th>
                    <th className="p-4 font-normal">Monto</th>
                    <th className="p-4 pr-8 text-right font-normal">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {historial.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                      
                      <td className="p-4 pl-8 align-middle">
                        <div className={`p-2.5 w-fit rounded-xl border ${item.tipo === 'Correctivo' ? 'bg-red-500/10 border-red-500/30 text-red-400' : (item.tipo === 'Combustible' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400')}`}>
                          {item.tipo === 'Combustible' ? <Fuel size={16}/> : <Wrench size={16} />}
                        </div>
                      </td>

                      <td className="p-4 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white font-bold uppercase truncate max-w-[250px]">{item.descripcion}</span>
                          <span className="text-slate-500 text-[10px] uppercase tracking-widest">{item.tipo}</span>
                        </div>
                      </td>

                      <td className="p-4 align-middle">
                        <span className="text-[12px] font-mono font-medium text-slate-300 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-2 w-fit">
                          <Truck size={12} className="text-slate-500"/>
                          {item.unidades?.numero_economico || 'S/U'}
                        </span>
                      </td>

                      <td className="p-4 align-middle">
                        <span className="text-slate-400 text-[12px]">{item.fecha}</span>
                      </td>

                      <td className="p-4 align-middle">
                        <span className="text-[14px] font-mono font-medium text-white">
                          ${Number(item.costo).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                        </span>
                      </td>

                      <td className="p-4 pr-8 align-middle">
                        <div className="flex items-center justify-end gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => eliminarGasto(item.id)} title="Eliminar Gasto" className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                      
                    </tr>
                  ))}
                  
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <Wrench size={32} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm">Sin registros en este rango de fechas.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {mostrarFormulario && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setMostrarFormulario(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
                <button onClick={() => setMostrarFormulario(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Nuevo <span className="text-blue-500">Egreso</span></h2>
                <form onSubmit={registrarGasto} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <select required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white"
                      value={formData.unidad_id} onChange={e => setFormData({...formData, unidad_id: e.target.value})}>
                      <option value="">Unidad...</option>
                      {unidades.map(u => <option key={u.id} value={u.id}>{u.numero_economico}</option>)}
                    </select>
                    <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white"
                      value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                      <option value="Preventivo">Preventivo</option>
                      <option value="Correctivo">Correctivo</option>
                      <option value="Combustible">Combustible</option>
                      <option value="Otros">Otros</option>
                    </select>
                    <input required className="md:col-span-2 w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                      value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Descripción" />
                    <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white font-mono" 
                      value={formData.costo} onChange={e => setFormData({...formData, costo: e.target.value})} placeholder="0.00" />
                    <input type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                      value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">
                    {loading ? "Sincronizando..." : "Confirmar Egreso"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}