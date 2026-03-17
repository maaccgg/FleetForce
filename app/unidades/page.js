'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, PlusCircle, Trash2, Edit2, X, 
  ShieldCheck, Calendar, Wrench, AlertTriangle, CheckCircle, DollarSign, FileText
} from 'lucide-react';
import Sidebar from '@/components/sidebar';

export default function UnidadesPage() {
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  
  const [mostrarModal, setMostrarModal] = useState(false);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [tabExpediente, setTabExpediente] = useState('tecnica'); 
  
  const [mantenimientos, setMantenimientos] = useState([]);
  const [nuevoMantenimiento, setNuevoMantenimiento] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'Preventivo', descripcion: '', costo: '' });

  const [formData, setFormData] = useState({
    numero_economico: '', placas: '', tipo_placa: 'Federal', permiso_sict: 'TPAF01', num_permiso_sict: '',
    configuracion_vehicular: 'T3S1', anio_modelo: '', aseguradora_rc: '', poliza_rc: '',
    vencimiento_seguro: '', vencimiento_sct: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSesion(session);
        obtenerUnidades(session.user.id);
      }
    });
  }, []);

async function obtenerUnidades(userId) {
    setLoading(true);

    // 1. OBTENER EL ID DE LA INSTITUCIÓN
    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('empresa_id, rol')
      .eq('id', userId)
      .single();

    // Si es admin, su empresa_id podría ser nulo, así que usa su propio ID. 
    // Si es miembro, usará el ID del administrador.
    const idInstitucion = perfilData?.empresa_id || userId; 
    setEmpresaId(idInstitucion);

    // 2. CARGAR EL CATÁLOGO COMPARTIDO
    try {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('usuario_id', idInstitucion) // <--- ESTA ES LA CLAVE
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUnidades(data || []);
    } catch (err) {
      console.error("Error cargando unidades:", err.message);
    }
    
    setLoading(false);
  }

  async function cargarMantenimientos(unidadId) {
    const { data } = await supabase.from('mantenimientos').select('*').eq('unidad_id', unidadId).order('fecha', { ascending: false });
    setMantenimientos(data || []);
  }

  const guardarUnidad = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { 
      ...formData, 
      usuario_id: empresaId,
      placas: formData.placas.toUpperCase(),
      vencimiento_seguro: formData.vencimiento_seguro || null,
      vencimiento_sct: formData.tipo_placa === 'Estatal' ? null : (formData.vencimiento_sct || null)
    };

    const { error } = unidadSeleccionada 
      ? await supabase.from('unidades').update(payload).eq('id', unidadSeleccionada.id)
      : await supabase.from('unidades').insert([payload]);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      cerrarModal();
      obtenerUnidades(sesion.user.id);
    }
    setLoading(false);
  };

  const eliminarUnidad = async (id) => {
    if (!confirm("¿Deseas eliminar esta unidad permanentemente?")) return;
    await supabase.from('unidades').delete().eq('id', id);
    obtenerUnidades(sesion.user.id);
  };

  const abrirExpediente = (u) => {
    setUnidadSeleccionada(u);
    setFormData({
      numero_economico: u.numero_economico || '', placas: u.placas || '', 
      tipo_placa: u.tipo_placa || 'Federal', 
      permiso_sict: u.permiso_sict || 'TPAF01',
      num_permiso_sict: u.num_permiso_sict || '', configuracion_vehicular: u.configuracion_vehicular || 'T3S1',
      anio_modelo: u.anio_modelo || '', aseguradora_rc: u.aseguradora_rc || '', poliza_rc: u.poliza_rc || '',
      vencimiento_seguro: u.vencimiento_seguro || '', vencimiento_sct: u.vencimiento_sct || ''
    });
    setTabExpediente('tecnica');
    cargarMantenimientos(u.id);
    setMostrarModal(true);
  };

  const abrirNuevaUnidad = () => {
    setUnidadSeleccionada(null);
    setFormData({ 
      numero_economico: '', placas: '', tipo_placa: 'Federal', permiso_sict: 'TPAF01', 
      num_permiso_sict: '', configuracion_vehicular: 'T3S1', anio_modelo: '', aseguradora_rc: '', 
      poliza_rc: '', vencimiento_seguro: '', vencimiento_sct: '' 
    });
    setTabExpediente('tecnica');
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setUnidadSeleccionada(null);
  };

  const registrarMantenimiento = async (e) => {
    e.preventDefault();
    if (!nuevoMantenimiento.descripcion || !nuevoMantenimiento.costo) return;
    setLoading(true);
    const { error } = await supabase.from('mantenimientos').insert([{ usuario_id: sesion.user.id, unidad_id: unidadSeleccionada.id, fecha: nuevoMantenimiento.fecha, tipo: nuevoMantenimiento.tipo, descripcion: nuevoMantenimiento.descripcion, costo: parseFloat(nuevoMantenimiento.costo) }]);
    if (error) alert("Error: " + error.message);
    else { setNuevoMantenimiento({ fecha: new Date().toISOString().split('T')[0], tipo: 'Preventivo', descripcion: '', costo: '' }); cargarMantenimientos(unidadSeleccionada.id); }
    setLoading(false);
  };

  const eliminarMantenimiento = async (id) => {
    if (!confirm("¿Borrar registro de mantenimiento?")) return;
    await supabase.from('mantenimientos').delete().eq('id', id);
    cargarMantenimientos(unidadSeleccionada.id);
  };

  const verificarVigencia = (fecha) => {
    if (!fecha) return { texto: 'Sin registro', color: 'text-slate-500', bg: 'bg-slate-800' };
    const hoy = new Date();
    const fechaVenc = new Date(fecha + 'T23:59:59');
    const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) return { texto: 'Vencido', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' };
    if (diasRestantes <= 30) return { texto: `Vence en ${diasRestantes} días`, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
    return { texto: 'Vigente', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  };

  if (!sesion) return null;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-10 flex justify-between items-end border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">Flota de <span className="text-blue-500">Unidades</span></h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Control de Expedientes y Mantenimiento</p>
            </div>
            <button onClick={abrirNuevaUnidad} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
              <PlusCircle size={16} /> Alta de Unidad
            </button>
          </header>
<div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">

  {unidades.length === 0 && <p className="text-slate-500 text-sm">No hay unidades registradas.</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-[13px] font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-8 font-normal">Identificación</th>
                    <th className="p-4 font-normal">Configuración</th>
                    <th className="p-4 font-normal">Seguro RC</th>
                    <th className="p-4 font-normal">Permiso SCT</th>
                    <th className="p-4 pr-8 text-right font-normal">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {unidades.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-16 text-center">
                        <Truck size={32} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm">No hay unidades registradas</p>
                      </td>
                    </tr>
                  )}
                  
                  {unidades.map((u) => {
                    const vigSeguro = verificarVigencia(u.vencimiento_seguro);
                    const vigSct = u.tipo_placa === 'Estatal' 
                      ? { texto: 'No Aplica', color: 'text-slate-400', bg: 'bg-slate-900 border-slate-800' } 
                      : verificarVigencia(u.vencimiento_sct);

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                        
                        <td className="p-4 pl-8 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[14px] text-white font-mono font-medium">ECO: {u.numero_economico}</span>
                            <span className="text-[11px] text-slate-500">Placas: <span className="text-slate-300">{u.placas}</span></span>
                            <span className={`inline-flex px-2 py-0.5 rounded border uppercase tracking-widest text-[9px] items-center gap-1 ${u.tipo_placa === 'Estatal' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                              {u.tipo_placa || 'Federal'}
                            </span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white truncate">{u.configuracion_vehicular || 'N/A'}</span>
                            <span className="text-slate-500 text-[11px]">Mod: {u.anio_modelo || 'N/A'}</span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vigSeguro.bg}`}>
                            <ShieldCheck size={14} className={vigSeguro.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${vigSeguro.color}`}>{vigSeguro.texto}</span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vigSct.bg}`}>
                            <FileText size={14} className={vigSct.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${vigSct.color}`}>{vigSct.texto}</span>
                          </div>
                        </td>

                        <td className="p-4 pr-8 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => abrirExpediente(u)} title="Ver Expediente" className="px-3 py-1.5 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/20 rounded-lg uppercase tracking-widest text-[10px] flex items-center gap-1.5 transition-colors">
                              <Wrench size={14}/> Expediente
                            </button>
                            <button onClick={() => eliminarUnidad(u.id)} title="Eliminar Unidad" className="p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors ml-2">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>
                        
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={cerrarModal} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                  <div>
                    <h2 className="text-2xl font-black text-white italic uppercase leading-none">
                      {unidadSeleccionada ? `Expediente: ECO ${unidadSeleccionada.numero_economico}` : 'Alta de Nueva Unidad'}
                    </h2>
                    {unidadSeleccionada && <p className="text-slate-400 text-[11px] font-mono mt-2">PLACAS: {unidadSeleccionada.placas}</p>}
                  </div>
                  <button onClick={cerrarModal} className="text-slate-500 hover:text-white bg-slate-950 p-2 rounded-full"><X size={20} /></button>
                </div>

                {unidadSeleccionada && (
                  <div className="flex px-8 border-b border-slate-800 bg-slate-950 shrink-0">
                    <button onClick={() => setTabExpediente('tecnica')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${tabExpediente === 'tecnica' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <Truck size={14}/> Ficha Técnica
                    </button>
                    <button onClick={() => setTabExpediente('mantenimientos')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${tabExpediente === 'mantenimientos' ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <Wrench size={14}/> Historial de Mantenimiento
                    </button>
                  </div>
                )}

                <div className="p-8 overflow-y-auto bg-slate-900 flex-1">
                  
                  {tabExpediente === 'tecnica' && (
                    <form onSubmit={guardarUnidad} className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-950 rounded-2xl border border-slate-800">
                        <div className="col-span-2 md:col-span-4 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Identificación Vehicular</div>
                        <input required placeholder="Número Económico" className="col-span-2 bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formData.numero_economico} onChange={e => setFormData({...formData, numero_economico: e.target.value})} />
                        
                        <div className="col-span-2 flex gap-2">
                          <select className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold w-1/3"
                            value={formData.tipo_placa} 
                            onChange={e => {
                               const val = e.target.value;
                               setFormData({
                                 ...formData, 
                                 tipo_placa: val,
                                 permiso_sict: val === 'Estatal' ? 'TPXX00' : 'TPAF01',
                                 num_permiso_sict: val === 'Estatal' ? 'N/A' : (formData.num_permiso_sict === 'N/A' ? '' : formData.num_permiso_sict),
                                 vencimiento_sct: val === 'Estatal' ? '' : formData.vencimiento_sct
                               });
                            }}>
                            <option value="Federal">Placa Federal</option>
                            <option value="Estatal">Placa Estatal</option>
                          </select>
                          <input required placeholder="Número de Placas" className="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase font-mono" value={formData.placas} onChange={e => setFormData({...formData, placas: e.target.value})} />
                        </div>

                        <input placeholder="Año Modelo" className="col-span-2 bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.anio_modelo} onChange={e => setFormData({...formData, anio_modelo: e.target.value})} />
                        <select required className="col-span-2 bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formData.configuracion_vehicular} onChange={e => setFormData({...formData, configuracion_vehicular: e.target.value})}>
                          <option value="">-- Configuración SAT --</option>
                          <option value="VL">VL (Ligero / Pick-up)</option>
                          <option value="C2">C2 (Rabón / 2 ejes)</option>
                          <option value="C3">C3 (Torton / 3 ejes)</option>
                          <option value="T2S1">T2S1 (Tracto / 3 ejes)</option>
                          <option value="T3S1">T3S1 (Tracto / 4 ejes)</option>
                          <option value="T3S2">T3S2 (Tráiler / 5 ejes)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4 p-6 bg-blue-900/10 rounded-2xl border border-blue-500/20">
                        <div className="col-span-2 text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Permisos, Seguros y Vigencias</div>
                        
                        <div className="space-y-3">
                          <label className="text-[9px] text-slate-500 uppercase font-black ml-1">Seguro de Resp. Civil</label>
                          <input placeholder="Aseguradora" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase" value={formData.aseguradora_rc} onChange={e => setFormData({...formData, aseguradora_rc: e.target.value})} />
                          <input placeholder="Número de Póliza" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.poliza_rc} onChange={e => setFormData({...formData, poliza_rc: e.target.value})} />
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 font-bold mb-1">Vencimiento Póliza:</span>
                            <input type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.vencimiento_seguro} onChange={e => setFormData({...formData, vencimiento_seguro: e.target.value})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[9px] text-slate-500 uppercase font-black ml-1">Permiso SCT (Federal)</label>
                          <select 
                            className={`w-full p-4 rounded-xl text-sm text-white transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-950 border border-slate-800'}`} 
                            value={formData.permiso_sict} 
                            disabled={formData.tipo_placa === 'Estatal'}
                            onChange={e => setFormData({...formData, permiso_sict: e.target.value})}>
                            <option value="TPAF01">Autotransporte Federal Carga</option>
                            <option value="TPXX00">Permiso No Requerido (Estatal / Local)</option>
                          </select>
                          <input 
                            placeholder="Núm. Permiso SCT" 
                            className={`w-full p-4 rounded-xl text-sm text-white transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-950 border border-slate-800'}`} 
                            value={formData.num_permiso_sict} 
                            readOnly={formData.tipo_placa === 'Estatal'}
                            onChange={e => setFormData({...formData, num_permiso_sict: e.target.value})} 
                          />
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 font-bold mb-1">Vigencia Permiso:</span>
                            <input 
                              type="date" 
                              className={`w-full p-4 rounded-xl text-sm text-white transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-950 border border-slate-800'}`} 
                              value={formData.vencimiento_sct} 
                              disabled={formData.tipo_placa === 'Estatal'}
                              onChange={e => setFormData({...formData, vencimiento_sct: e.target.value})} 
                            />
                          </div>
                        </div>
                      </div>

                      <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all flex justify-center items-center gap-2">
                        {loading ? "Guardando..." : "Guardar Ficha Técnica"}
                      </button>
                    </form>
                  )}

                  {/* TAB 2: HISTORIAL DE MANTENIMIENTO */}
                  {tabExpediente === 'mantenimientos' && unidadSeleccionada && (
                    <div className="space-y-8">
                      <form onSubmit={registrarMantenimiento} className="p-6 bg-orange-500/10 border border-orange-500/20 rounded-2xl grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-12 mb-2"><h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2"><PlusCircle size={14}/> Registrar Servicio</h3></div>
                        <div className="col-span-12 md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Fecha</label><input type="date" required className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" value={nuevoMantenimiento.fecha} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, fecha: e.target.value})} /></div>
                        <div className="col-span-12 md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Tipo</label><select className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" value={nuevoMantenimiento.tipo} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, tipo: e.target.value})}><option value="Preventivo">Preventivo (Afinación, Llantas)</option><option value="Correctivo">Correctivo (Falla, Choque)</option></select></div>
                        <div className="col-span-12 md:col-span-4"><label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Descripción del Taller</label><input required placeholder="Ej. Cambio de aceite" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" value={nuevoMantenimiento.descripcion} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, descripcion: e.target.value})} /></div>
                        <div className="col-span-12 md:col-span-2"><label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Costo ($)</label><input required type="number" placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white text-center font-mono" value={nuevoMantenimiento.costo} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, costo: e.target.value})} /></div>
                        <div className="col-span-12 mt-2"><button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Guardar Registro</button></div>
                      </form>

                      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-900 border-b border-slate-800 text-slate-500"><tr><th className="p-4 font-black uppercase tracking-widest">Fecha</th><th className="p-4 font-black uppercase tracking-widest">Tipo</th><th className="p-4 font-black uppercase tracking-widest">Descripción Técnica</th><th className="p-4 font-black uppercase tracking-widest text-right">Inversión</th><th className="p-4 font-black uppercase tracking-widest text-right">Borrar</th></tr></thead>
                          <tbody className="divide-y divide-slate-800">
                            {mantenimientos.length === 0 && (<tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No hay registros de mantenimiento.</td></tr>)}
                            {mantenimientos.map(m => (
                              <tr key={m.id} className="hover:bg-slate-900/50 transition-colors">
                                <td className="p-4 text-slate-300 font-mono">{m.fecha}</td>
                                <td className="p-4"><span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${m.tipo === 'Preventivo' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>{m.tipo}</span></td>
                                <td className="p-4 text-slate-300 max-w-xs truncate" title={m.descripcion}>{m.descripcion}</td>
                                <td className="p-4 text-right font-mono text-emerald-400 font-medium">${Number(m.costo).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                                <td className="p-4 text-right"><button onClick={() => eliminarMantenimiento(m.id)} className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={14}/></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex justify-end">
                         <div className="bg-slate-950 border border-slate-800 px-6 py-4 rounded-2xl">
                           <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Gasto Total Histórico</p>
                           <p className="text-xl font-mono font-black text-white">${mantenimientos.reduce((sum, m) => sum + Number(m.costo), 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}