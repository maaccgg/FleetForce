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

  // Estados para el rango de fechas (Default: mes actual)
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
        obtenerDatos(session.user.id);
      }
    });
  }, [fechaInicio, fechaFin]); // Se dispara al cambiar cualquier fecha

  async function obtenerDatos(userId) {
    setLoading(true);
    
    // 1. Cargar catálogo de unidades
    const { data: unidadesBD } = await supabase.from('unidades').select('id, numero_economico').eq('usuario_id', userId);
    setUnidades(unidadesBD || []);

    // 2. Consulta con Rango de Fechas
    const { data: gastosBD, error } = await supabase
      .from('mantenimientos')
      .select(`*, unidades(numero_economico)`)
      .eq('usuario_id', userId)
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
      { ...formData, costo: parseFloat(formData.costo), usuario_id: sesion.user.id }
    ]);

    if (!error) {
      setFormData({ unidad_id: '', descripcion: '', costo: '', tipo: 'Preventivo', fecha: new Date().toISOString().split('T')[0] });
      setMostrarFormulario(false);
      obtenerDatos(sesion.user.id);
    }
    setLoading(false);
  };

  const eliminarGasto = async (id) => {
    if (!confirm("¿Eliminar registro de gasto?")) return;
    await supabase.from('mantenimientos').delete().eq('id', id);
    obtenerDatos(sesion.user.id);
  };

  if (!sesion) return <div className="min-h-screen bg-slate-950"></div>;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
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
              {/* SELECTOR DE PERIODO TÉCNICO */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <TarjetaDato titulo="Egreso en Rango" valor={`$${metricas.totalPeriodo.toLocaleString()}`} color="blue" />
            <TarjetaDato titulo="Registros" valor={metricas.conteo.toString()} color="blue" />
          </div>

          {/* MODAL DE REGISTRO */}
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
                    <input required type="number" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white font-mono" 
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

          {/* TABLA DE HISTORIAL */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-4">
                    <th className="pl-4">Tipo</th>
                    <th>Unidad</th>
                    <th>Descripción</th>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th className="text-right pr-4">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => (
                    <tr key={item.id} className="bg-slate-950 border border-slate-800 group hover:border-blue-500/30 transition-all">
                      <td className="py-4 pl-4 rounded-l-2xl border-y border-l border-slate-800">
                        <div className={`p-2 w-fit rounded-lg ${item.tipo === 'Correctivo' ? 'bg-blue-600' : 'bg-slate-800'} text-white`}>
                          {item.tipo === 'Combustible' ? <Fuel size={14}/> : <Wrench size={14} />}
                        </div>
                      </td>
                      <td className="py-4 border-y border-slate-800 font-black text-white italic text-[11px]">
                        {item.unidades?.numero_economico || 'S/U'}
                      </td>
                      <td className="py-4 border-y border-slate-800">
                        <h4 className="text-[11px] font-bold text-white uppercase">{item.descripcion}</h4>
                        <p className="text-[9px] text-slate-500 uppercase">{item.tipo}</p>
                      </td>
                      <td className="py-4 border-y border-slate-800 text-[10px] text-slate-300 font-bold">
                        {item.fecha}
                      </td>
                      <td className="py-4 border-y border-slate-800 text-[11px] font-mono font-black text-white">
                        ${Number(item.costo).toLocaleString()}
                      </td>
                      <td className="py-4 pr-4 rounded-r-2xl border-y border-r border-slate-800 text-right">
                        <button onClick={() => eliminarGasto(item.id)} className="text-slate-800 hover:text-red-500 p-2"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historial.length === 0 && (
                <p className="text-slate-600 text-[10px] font-black uppercase italic text-center py-20">Sin registros en este rango de fechas.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}