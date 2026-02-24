'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, Plus, PenTool, Trash2, X, List, Edit3, 
  Calendar, Gauge, AlertTriangle, MoreVertical 
} from 'lucide-react';
import Sidebar from '@/components/sidebar';

export default function UnidadesPage() {
  const [sesion, setSesion] = useState(null);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  
  // Nuevo estado para controlar el menú desplegable de cada fila
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);

  const [mostrarManto, setMostrarManto] = useState(false);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [mantenimientos, setMantenimientos] = useState([]);

  const [nuevoManto, setNuevoManto] = useState({ 
    descripcion: '', 
    tipo: 'Preventivo', 
    fecha: new Date().toISOString().split('T')[0], 
    costo: '' 
  });

  const [formData, setFormData] = useState({
    numero_economico: '', placas: '', modelo: '', vencimiento_seguro: '', vencimiento_sct: ''
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSesion(session);
        obtenerUnidades(session.user.id);
      }
    };
    checkSession();
  }, []);

  async function obtenerUnidades(userId) {
    const { data, error } = await supabase
      .from('unidades')
      .select('*')
      .eq('usuario_id', userId)
      .order('numero_economico', { ascending: true });

    if (error) {
      console.error("Error al obtener datos:", error.message);
      return;
    }
    setUnidades(data || []);
  }

  const abrirMantenimiento = async (unidad) => {
    setUnidadSeleccionada(unidad);
    setMostrarManto(true);
    const { data, error } = await supabase
      .from('mantenimientos')
      .select('*')
      .eq('unidad_id', unidad.id)
      .order('fecha', { ascending: false });

    if (error) console.error("Error al cargar mantenimientos:", error.message);
    setMantenimientos(data || []);
    setMenuAbiertoId(null); // Cerrar menú al abrir modal
  };

  const agregarMantenimiento = async (e) => {
    e.preventDefault();
    const registroParaInsertar = { 
      descripcion: nuevoManto.descripcion,
      tipo: nuevoManto.tipo,
      fecha: nuevoManto.fecha,
      costo: Number(nuevoManto.costo),
      unidad_id: unidadSeleccionada.id,
      usuario_id: sesion.user.id 
    };

    const { error } = await supabase.from('mantenimientos').insert([registroParaInsertar]);
    if (!error) {
      setNuevoManto({ descripcion: '', tipo: 'Preventivo', fecha: new Date().toISOString().split('T')[0], costo: 0 });
      abrirMantenimiento(unidadSeleccionada);
    }
  };

  const eliminarManto = async (id) => {
    await supabase.from('mantenimientos').delete().eq('id', id);
    await obtenerUnidades(sesion.user.id);
    abrirMantenimiento(unidadSeleccionada);
  };

  const abrirModalEditar = (unidad) => {
    setEditandoId(unidad.id);
    setFormData({
      numero_economico: unidad.numero_economico,
      placas: unidad.placas || '',
      modelo: unidad.modelo || '',
      vencimiento_seguro: unidad.vencimiento_seguro || '',
      vencimiento_sct: unidad.vencimiento_sct || ''
    });
    setMostrarForm(true);
    setMenuAbiertoId(null); // Cerrar menú al abrir modal
  };

  const cerrarModal = () => {
    setMostrarForm(false);
    setEditandoId(null);
    setFormData({ numero_economico: '', placas: '', modelo: '', vencimiento_seguro: '', vencimiento_sct: '' });
  };

  const guardarUnidad = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editandoId) {
        await supabase.from('unidades').update(formData).eq('id', editandoId);
      } else {
        await supabase.from('unidades').insert([{ ...formData, usuario_id: sesion.user.id, estatus: 'Activo' }]);
      }
      cerrarModal();
      await obtenerUnidades(sesion.user.id); 
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarUnidad = async (id) => {
    if (!confirm("¿Eliminar este activo?")) return;
    await supabase.from('unidades').delete().eq('id', id);
    obtenerUnidades(sesion.user.id);
    setMenuAbiertoId(null);
  };

  const calcularStatusVencimiento = (fecha) => {
    if (!fecha) return { color: 'text-slate-600' };
    const hoy = new Date();
    const venci = new Date(fecha);
    const dias = Math.floor((venci - hoy) / (1000 * 60 * 60 * 24));
    if (dias < 0) return { color: 'text-red-500 font-black' };
    if (dias < 15) return { color: 'text-orange-500 font-bold' };
    return { color: 'text-green-500' };
  };

  const tieneMantoVencido = (mantos) => {
    if (!mantos || mantos.length === 0) return false;
    const hoy = new Date();
    return mantos.some(m => m.fecha_sugerida && new Date(m.fecha_sugerida) <= hoy);
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
                Control de <span className="text-blue-500">Unidades</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                Gestión de Activos
              </p>
            </div>
            <button 
              onClick={() => setMostrarForm(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-blue-900/20"
            >
              <Plus size={14} /> Nueva Unidad
            </button>
          </header>

          {/* MODAL MAESTRO UNIDADES */}
          {mostrarForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={cerrarModal} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                <button onClick={cerrarModal} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                    {editandoId ? 'Editar' : 'Consolidar'} <span className="text-blue-500">Activo</span>
                  </h2>
                </div>
                <form onSubmit={guardarUnidad} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Eco / ID Unidad</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 transition-all font-bold text-white" 
                        value={formData.numero_economico} onChange={e => setFormData({...formData, numero_economico: e.target.value})} placeholder="Ej. T-01" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Placas</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm uppercase outline-none focus:border-blue-500 transition-all text-white" 
                        value={formData.placas} onChange={e => setFormData({...formData, placas: e.target.value})} placeholder="00-AA-00" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Modelo / Marca</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 transition-all text-white" 
                        value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} placeholder="Modelo de unidad" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block ml-1">Vencimiento Seguro</label>
                      <input type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 text-white" 
                        value={formData.vencimiento_seguro} onChange={e => setFormData({...formData, vencimiento_seguro: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2 block ml-1">Vencimiento SCT</label>
                      <input type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 text-white" 
                        value={formData.vencimiento_sct} onChange={e => setFormData({...formData, vencimiento_sct: e.target.value})} />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] hover:bg-blue-500 transition-all">
                    {loading ? "Sincronizando..." : editandoId ? "Actualizar Activo" : "Registrar Activo"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* MODAL MANTENIMIENTO */}
          {mostrarManto && unidadSeleccionada && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setMostrarManto(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-10 border-b border-slate-800 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Bitácora: <span className="text-orange-500">Mantenimiento</span></h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase mt-1">Unidad: {unidadSeleccionada.numero_economico}</p>
                  </div>
                  <button onClick={() => setMostrarManto(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="md:col-span-1 border-r border-slate-800 pr-8">
                    <h3 className="text-[9px] font-black text-blue-500 uppercase mb-6 tracking-widest">Programar Servicio</h3>
                    <form onSubmit={agregarMantenimiento} className="space-y-4">
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-white outline-none focus:border-orange-500" placeholder="Descripción" value={nuevoManto.descripcion} onChange={e => setNuevoManto({...nuevoManto, descripcion: e.target.value})} />
                      <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-white outline-none focus:border-orange-500" value={nuevoManto.tipo} onChange={e => setNuevoManto({...nuevoManto, tipo: e.target.value})}>
                        <option value="Preventivo">Preventivo</option>
                        <option value="Correctivo">Correctivo</option>
                      </select>
                      <input type="number" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-white outline-none focus:border-orange-500" placeholder="Costo $" value={nuevoManto.costo} onChange={e => setNuevoManto({...nuevoManto, costo: e.target.value})} />
                      <input type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-white outline-none" value={nuevoManto.fecha} onChange={e => setNuevoManto({...nuevoManto, fecha: e.target.value})} />
                      <button className="w-full bg-orange-600 text-white p-4 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-orange-500 transition-all">Registrar</button>
                    </form>
                  </div>
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase mb-6 tracking-widest">Historial</h3>
                    {mantenimientos.map(m => (
                      <div key={m.id} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex justify-between items-center group">
                        <div>
                          <p className="text-xs font-black text-white uppercase italic">{m.descripcion}</p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-[9px] text-orange-500 font-bold uppercase">{m.tipo}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">${m.costo}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">{m.fecha}</span>
                          </div>
                        </div>
                        <button onClick={() => eliminarManto(m.id)} className="text-slate-800 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABLA DE CONTROL */}
          <div className="p-2 border-slate-800 flex justify-center items-center gap-3">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Inventario de Activos</h2>
          </div>
            
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-visible shadow-2xl">
            <div className="p-4">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    <th className="px-4 pb-4">Unidad</th>
                    <th className="pb-4">Detalles</th>
                    <th className="pb-4">Seguro</th>
                    <th className="pb-4">SCT</th>
                    <th className="px-4 pb-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {unidades.map((u) => (
                    <tr key={u.id} className="bg-slate-950 border border-slate-800 group hover:border-blue-500/30 transition-all">
                      <td className="py-4 px-4 rounded-l-2xl border-y border-l border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-900 p-2 rounded-lg text-blue-500"><Truck size={16}/></div>
                          <div>
                            <span className="text-sm font-black text-white italic">{u.numero_economico}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 border-y border-slate-800">
                        <p className="text-[10px] text-slate-200 font-bold uppercase">{u.modelo || '---'}</p>
                        <p className="text-[9px] text-slate-500 font-mono">{u.placas || 'SIN PLACAS'}</p>
                      </td>
                      <td className="py-4 border-y border-slate-800">
                        <p className={`text-[10px] font-bold ${calcularStatusVencimiento(u.vencimiento_seguro).color}`}>
                          {u.vencimiento_seguro || 'NO REGISTRADO'}
                        </p>
                      </td>
                      <td className="py-4 border-y border-slate-800">
                        <p className={`text-[10px] font-bold ${calcularStatusVencimiento(u.vencimiento_sct).color}`}>
                          {u.vencimiento_sct || 'NO REGISTRADO'}
                        </p>
                      </td>
                      <td className="py-4 px-4 rounded-r-2xl border-y border-r border-slate-800 text-right relative">
                        {/* BOTÓN ÚNICO DE ACCIONES */}
                        <div className="flex justify-end">
                          <button 
                            onClick={() => setMenuAbiertoId(menuAbiertoId === u.id ? null : u.id)}
                            className="p-2 text-slate-500 hover:text-white transition-colors"
                          >
                            <MoreVertical size={20} />
                          </button>

                          {/* LISTADO DESPLEGABLE */}
                          {menuAbiertoId === u.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setMenuAbiertoId(null)} 
                              />
                              <div className="absolute right-12 top-4 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <button 
                                  onClick={() => abrirMantenimiento(u)}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase text-slate-300 hover:bg-slate-800 hover:text-orange-500 transition-all"
                                >
                                  <PenTool size={14} /> Mantenimiento
                                </button>
                                <button 
                                  onClick={() => abrirModalEditar(u)}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase text-slate-300 hover:bg-slate-800 hover:text-blue-500 transition-all border-y border-slate-800/50"
                                >
                                  <Edit3 size={14} /> Editar
                                </button>
                                <button 
                                  onClick={() => eliminarUnidad(u.id)}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase text-slate-300 hover:bg-slate-800 hover:text-red-500 transition-all"
                                >
                                  <Trash2 size={14} /> Eliminar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}