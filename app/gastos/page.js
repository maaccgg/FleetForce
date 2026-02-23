'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Wrench, PlusCircle, History, Trash2, Fuel, X, ArrowDownCircle, Truck, TrendingDown } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';

export default function GastosOperativosPage() {
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [metricas, setMetricas] = useState({ totalMes: 0, preventivos: 0 });
  
  const [formData, setFormData] = useState({ 
    unidad_id: '', 
    descripcion: '', 
    costo: '', 
    tipo: 'Preventivo',
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
  }, []);

  async function obtenerDatos(userId) {
    setLoading(true);
    const { data: unidadesBD } = await supabase.from('unidades').select('id, numero_economico').eq('usuario_id', userId);
    setUnidades(unidadesBD || []);

    const { data: gastosBD } = await supabase
      .from('mantenimientos')
      .select(`*, unidades(numero_economico)`)
      .eq('usuario_id', userId)
      .order('fecha', { ascending: false });

    const total = gastosBD?.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0) || 0;
    const preventivos = gastosBD?.filter(g => g.tipo === 'Preventivo').length || 0;

    setMetricas({ totalMes: total, preventivos });
    setHistorial(gastosBD || []);
    setLoading(false);
  }

  const registrarGasto = async (e) => {
    e.preventDefault();
    if (!formData.unidad_id || !formData.costo) return;
    setLoading(true);

    const { error } = await supabase.from('mantenimientos').insert([
      { 
        unidad_id: formData.unidad_id,
        descripcion: formData.descripcion,
        costo: parseFloat(formData.costo),
        tipo: formData.tipo,
        fecha: formData.fecha,
        usuario_id: sesion.user.id 
      }
    ]);

    if (!error) {
      setFormData({ unidad_id: '', descripcion: '', costo: '', tipo: 'Preventivo', fecha: new Date().toISOString().split('T')[0] });
      setMostrarFormulario(false);
      obtenerDatos(sesion.user.id);
    }
    setLoading(false);
  };

  const eliminarGasto = async (id) => {
    if (!confirm("¿Deseas eliminar este registro de egreso de la Institución?")) return;
    await supabase.from('mantenimientos').delete().eq('id', id);
    obtenerDatos(sesion.user.id);
  };

  if (!sesion) return <div className="min-h-screen bg-slate-950"></div>;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="flex justify-between items-start mb-10">
            <div>
              <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                Gastos <span className="text-blue-600">Operativos</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                Institución - Egreso y Mantenimiento de Flota
              </p>
            </div>
            
            <button 
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all shadow-md ${
                mostrarFormulario ? 'bg-slate-800 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
              }`}
            >
              {mostrarFormulario ? <><X size={12} /> Cancelar</> : <><PlusCircle size={12} /> Registrar Gasto</>}
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <TarjetaDato titulo="Egreso Total" valor={`$${metricas.totalMes.toLocaleString()}`} color="blue" />
          </div>

          {/* FORMULARIO DESPLEGABLE TÉCNICO */}
          {mostrarFormulario && (
            <div className="mb-12 bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-blue-500/50 to-transparent"></div>
              <form onSubmit={registrarGasto} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-600 uppercase ml-1 mb-2 block tracking-widest">Unidad</label>
                    <select 
                      value={formData.unidad_id}
                      onChange={(e) => setFormData({...formData, unidad_id: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:border-blue-500 transition-all text-xs font-bold"
                    >
                      <option value="">Seleccionar...</option>
                      {unidades.map(u => <option key={u.id} value={u.id}>{u.numero_economico}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase ml-1 mb-2 block tracking-widest">Descripción</label>
                    <input 
                      value={formData.descripcion}
                      onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:border-blue-500 transition-all text-xs" 
                      placeholder="Concepto del gasto"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-600 uppercase ml-1 mb-2 block tracking-widest">Monto ($)</label>
                    <input 
                      type="number"
                      value={formData.costo}
                      onChange={(e) => setFormData({...formData, costo: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:border-blue-500 font-mono text-xs" 
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-600 uppercase ml-1 mb-2 block tracking-widest">Categoría</label>
                    <select 
                      value={formData.tipo}
                      onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:border-blue-500 transition-all text-xs"
                    >
                      <option value="Preventivo">Preventivo</option>
                      <option value="Correctivo">Correctivo</option>
                      <option value="Combustible">Combustible / Diesel</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-600 uppercase ml-1 mb-2 block tracking-widest">Fecha Registro</label>
                    <input 
                      type="date"
                      value={formData.fecha}
                      onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:border-blue-500 transition-all text-[11px] uppercase" 
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <button 
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3.5 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      {loading ? "..." : <><PlusCircle size={14} /> Guardar Egreso</>}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TABLA DE GASTOS TÉCNICA */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Bitácora de Egresos</h2>
                <p className="text-[9px] text-slate-600 uppercase font-bold mt-1">Control histórico de la operación</p>
              </div>
              <History size={16} className="text-slate-600" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-4">
                    <th className="pb-2 pl-4">Tipo</th>
                    <th className="pb-2">Unidad</th>
                    <th className="pb-2">Descripción / Categoría</th>
                    <th className="pb-2">Fecha</th>
                    <th className="pb-2">Monto</th>
                    <th className="pb-2 text-right pr-4">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => (
                    <tr key={item.id} className="bg-slate-950 border border-slate-800 group hover:border-blue-500/30 transition-all">
                      <td className="py-4 pl-4 rounded-l-2xl border-y border-l border-slate-800">
                        <div className={`p-2 w-fit rounded-lg ${item.tipo === 'Correctivo' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                          {item.tipo === 'Combustible' ? <Fuel size={16}/> : <Wrench size={16} />}
                        </div>
                      </td>
                      <td className="py-4 border-y border-slate-800">
                        <div className="flex items-center gap-2">
                          <Truck size={14} className="text-blue-500" />
                          <span className="text-[11px] font-black text-white italic uppercase tracking-tighter">
                            {item.unidades?.numero_economico || 'S/U'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 border-y border-slate-800">
                        <h4 className="text-[11px] font-bold text-white uppercase leading-none">{item.descripcion}</h4>
                        <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">{item.tipo}</p>
                      </td>
                      <td className="py-4 border-y border-slate-800">
                        <p className="text-[10px] text-slate-300 font-bold">{new Date(item.fecha).toLocaleDateString()}</p>
                      </td>
                      <td className="py-4 border-y border-slate-800">
                        <span className="text-[11px] font-mono font-black text-white">
                          ${Number(item.costo).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 pr-4 rounded-r-2xl border-y border-r border-slate-800 text-right">
                        <button onClick={() => eliminarGasto(item.id)} className="text-slate-800 hover:text-red-500 transition-colors p-2">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historial.length === 0 && (
                <p className="text-slate-600 text-[10px] italic text-center py-10 uppercase tracking-widest">No hay registros de gastos operativos.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}