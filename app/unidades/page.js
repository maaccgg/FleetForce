'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, PlusCircle, Trash2, Edit2, X, 
  ShieldCheck, Calendar, Wrench, AlertTriangle, CheckCircle, DollarSign, FileText, CreditCard, UploadCloud
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
    vencimiento_seguro: '', vencimiento_sct: '', vencimiento_circulacion: '',
    kilometraje_actual: 0, 
    alerta_aviso: '',
    doc_poliza: '',             // Para la bóveda
    doc_tarjeta_circulacion: '' // Para la bóveda
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

    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('empresa_id, rol')
      .eq('id', userId)
      .single();

    const idInstitucion = perfilData?.empresa_id || userId; 
    setEmpresaId(idInstitucion);

    try {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('usuario_id', idInstitucion) 
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
      vencimiento_sct: formData.tipo_placa === 'Estatal' ? null : (formData.vencimiento_sct || null),
      vencimiento_circulacion: formData.vencimiento_circulacion || null
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
      vencimiento_seguro: u.vencimiento_seguro || '', vencimiento_sct: u.vencimiento_sct || '',
      vencimiento_circulacion: u.vencimiento_circulacion || '',
      kilometraje_actual: u.kilometraje_actual || 0,
      alerta_aviso: u.alerta_aviso || '',
      doc_poliza: u.doc_poliza || '',
      doc_tarjeta_circulacion: u.doc_tarjeta_circulacion || ''
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
      poliza_rc: '', vencimiento_seguro: '', vencimiento_sct: '', vencimiento_circulacion: '',
      kilometraje_actual: 0,
      alerta_aviso: '',
      doc_poliza: '',
      doc_tarjeta_circulacion: ''
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

 // 1. MODIFICACIÓN: Guardamos el PATH (la ruta), no la URL pública
  const subirDocumentoUnidad = async (e, campo) => {
    const file = e.target.files[0];
    if (!file || !unidadSeleccionada) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${unidadSeleccionada.numero_economico}/${campo}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`; // Ruta limpia

      // Subir al bucket privado
      const { error: uploadError } = await supabase.storage
        .from('expedientes')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // ACTUALIZAMOS LA DB CON EL PATH (Ej: "ECO-01/doc_poliza_123.pdf")
      const { error: updateError } = await supabase
        .from('unidades')
        .update({ [campo]: filePath })
        .eq('id', unidadSeleccionada.id);

      if (updateError) throw updateError;

      setFormData({ ...formData, [campo]: filePath });
      obtenerUnidades(sesion.user.id);
      alert("✅ Guardado en búnker privado.");

    } catch (error) {
      alert("❌ Error de seguridad/subida: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. NUEVA FUNCIÓN: Para generar el link temporal al hacer clic en "Ver"
  const verArchivoPrivado = async (path) => {
    if (!path) return;
    
    const { data, error } = await supabase.storage
      .from('expedientes')
      .createSignedUrl(path, 60); // El link solo dura 60 segundos

    if (error) {
      alert("Error al generar acceso: " + error.message);
    } else {
      window.open(data.signedUrl, '_blank');
    }
  };

const borrarDocumentoUnidad = async (campo) => {
    if (!confirm("¿Seguro que deseas eliminar este documento? El archivo será borrado de la nube.")) return;
    
    setLoading(true);
    try {
      const filePath = formData[campo];
      
      // 1. Borrar el archivo físico del Storage
      if (filePath) {
        const { error: removeError } = await supabase.storage
          .from('expedientes')
          .remove([filePath]);
          
        if (removeError) console.warn("Aviso al borrar de storage:", removeError.message);
      }

      // 2. Actualizar la base de datos (dejar el campo vacío)
      const { error: updateError } = await supabase
        .from('unidades')
        .update({ [campo]: null })
        .eq('id', unidadSeleccionada.id);

      if (updateError) throw updateError;

      // 3. Reflejar cambios en la interfaz
      setFormData({ ...formData, [campo]: '' });
      obtenerUnidades(sesion.user.id);
      
    } catch (error) {
      alert("❌ Error al eliminar documento: " + error.message);
    } finally {
      setLoading(false);
    }
  };

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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-[13px] font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-8 font-normal">Identificación</th>
                    <th className="p-4 font-normal">Configuración</th>
                    <th className="p-4 font-normal">Seguro RC</th>
                    <th className="p-4 font-normal">Permiso SCT</th>
                    <th className="p-4 font-normal">Tarjeta Circ.</th>
                    <th className="p-4 pr-8 text-right font-normal">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {unidades.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <Truck size={32} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm">No hay unidades registradas</p>
                      </td>
                    </tr>
                  )}
                  
                  {unidades.map((u) => {
                    const vigSeguro = verificarVigencia(u.vencimiento_seguro);
                    const vigCirculacion = verificarVigencia(u.vencimiento_circulacion);
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
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vigSeguro.bg} w-max`}>
                            <ShieldCheck size={14} className={vigSeguro.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${vigSeguro.color}`}>{vigSeguro.texto}</span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vigSct.bg} w-max`}>
                            <FileText size={14} className={vigSct.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${vigSct.color}`}>{vigSct.texto}</span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vigCirculacion.bg} w-max`}>
                            <CreditCard size={14} className={vigCirculacion.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${vigCirculacion.color}`}>{vigCirculacion.texto}</span>
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
                    {unidadSeleccionada && <p className="text-slate-400 text-[11px] font-mono mt-2 text-blue-400 font-bold tracking-widest">PLACAS: {unidadSeleccionada.placas}</p>}
                  </div>
                  <button onClick={cerrarModal} className="text-slate-500 hover:text-white bg-slate-950 p-2 rounded-full"><X size={20} /></button>
                </div>

                {unidadSeleccionada && (
                  <div className="flex px-8 border-b border-slate-800 bg-slate-950 shrink-0 overflow-x-auto">
                    <button onClick={() => setTabExpediente('tecnica')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabExpediente === 'tecnica' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <Truck size={14}/> Ficha Técnica
                    </button>
                    <button onClick={() => setTabExpediente('mantenimientos')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabExpediente === 'mantenimientos' ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <Wrench size={14}/> Mantenimiento
                    </button>
                    <button onClick={() => setTabExpediente('boveda')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabExpediente === 'boveda' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <UploadCloud size={14}/> Documentos (Bóveda)
                    </button>
                  </div>
                )}

                <div className="p-8 overflow-y-auto bg-slate-900 flex-1">
                  
                  {/* TAB 1: FICHA TÉCNICA */}
                  {tabExpediente === 'tecnica' && (
                    <form onSubmit={guardarUnidad} className="space-y-6">
                      
                      {/* Bloque 1: Identificación Vehicular */}
                      <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Identificación Vehicular</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">No. Económico</label>
                            <input required placeholder="Ej. CAJA-01" className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formData.numero_economico} onChange={e => setFormData({...formData, numero_economico: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Año Modelo</label>
                            <input placeholder="Ej. 2021" className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.anio_modelo} onChange={e => setFormData({...formData, anio_modelo: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Configuración SAT</label>
                            <select required className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formData.configuracion_vehicular} onChange={e => setFormData({...formData, configuracion_vehicular: e.target.value})}>
                              <option value="">-- Seleccionar --</option>
                              <option value="VL">VL (Ligero / Pick-up)</option>
                              <option value="C2">C2 (Rabón / 2 ejes)</option>
                              <option value="C3">C3 (Torton / 3 ejes)</option>
                              <option value="T2S1">T2S1 (Tracto / 3 ejes)</option>
                              <option value="T3S1">T3S1 (Tracto / 4 ejes)</option>
                              <option value="T3S2">T3S2 (Tráiler / 5 ejes)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Jurisdicción (Tipo Placa)</label>
                            <select className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold"
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
                              <option value="Federal">Federal (SCT)</option>
                              <option value="Estatal">Estatal / Local</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Número de Placas</label>
                            <input required placeholder="Ej. 123-AB-4" className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase font-mono tracking-widest" value={formData.placas} onChange={e => setFormData({...formData, placas: e.target.value})} />
                          </div>
                        </div>
                      </div>

                      {/* Bloque 2: Permisos, Seguros y Vigencias */}
                      <div className="p-6 bg-blue-900/10 rounded-2xl border border-blue-500/20">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-4 border-b border-blue-500/20 pb-2">Seguros, Permisos y Vigencias</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2"><ShieldCheck size={14} className="text-blue-500"/><span className="text-[10px] font-black text-white uppercase">Seguro RC</span></div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 block mb-1.5 ml-1">Aseguradora</label>
                              <input placeholder="Nombre Compañía" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm text-white " value={formData.aseguradora_rc} onChange={e => setFormData({...formData, aseguradora_rc: e.target.value})} />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">No. Póliza</label>
                              <input placeholder="00000000" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm text-white font-mono" value={formData.poliza_rc} onChange={e => setFormData({...formData, poliza_rc: e.target.value})} />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Vencimiento Seguro</label>
                              <input type="date" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm text-white" value={formData.vencimiento_seguro} onChange={e => setFormData({...formData, vencimiento_seguro: e.target.value})} />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2"><FileText size={14} className="text-blue-500"/><span className="text-[10px] font-black text-white uppercase">Permiso SCT</span></div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Clave Permiso</label>
                              <select 
                                className={`w-full p-3.5 rounded-xl text-sm text-white transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-950 border border-slate-800'}`} 
                                value={formData.permiso_sict} 
                                disabled={formData.tipo_placa === 'Estatal'}
                                onChange={e => setFormData({...formData, permiso_sict: e.target.value})}>
                                <option value="TPAF01">TPAF01 - Autotransporte Federal</option>
                                <option value="TPXX00">TPXX00 - No Requerido (Estatal)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Número de Permiso</label>
                              <input 
                                placeholder="S/N" 
                                className={`w-full p-3.5 rounded-xl text-sm text-white font-mono transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-950 border border-slate-800'}`} 
                                value={formData.num_permiso_sict} 
                                readOnly={formData.tipo_placa === 'Estatal'}
                                onChange={e => setFormData({...formData, num_permiso_sict: e.target.value})} 
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Vencimiento SCT</label>
                              <input 
                                type="date" 
                                className={`w-full p-3.5 rounded-xl text-sm text-white transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-900 border border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-950 border border-slate-800'}`} 
                                value={formData.vencimiento_sct} 
                                disabled={formData.tipo_placa === 'Estatal'}
                                onChange={e => setFormData({...formData, vencimiento_sct: e.target.value})} 
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2"><CreditCard size={14} className="text-blue-500"/><span className="text-[10px] font-black text-white uppercase">Tarjeta Circulación</span></div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Vencimiento Tarjeta</label>
                              <input type="date" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-sm text-white" value={formData.vencimiento_circulacion} onChange={e => setFormData({...formData, vencimiento_circulacion: e.target.value})} />
                            </div>
                            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                              <p className="text-[9px] text-slate-500 italic leading-relaxed text-center">
                                Las revisiones de Guardia Nacional requieren que la Tarjeta de Circulación original o copia certificada viaje siempre en la unidad.
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Bloque 3: Kilometraje y Alertas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-orange-500/5 border border-orange-500/20 rounded-2xl">
                        <div className="col-span-1 md:col-span-2 text-[9px] font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-2 border-b border-orange-500/20 pb-2">
                          <AlertTriangle size={14}/> Estado de Operación y Desgaste
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Kilometraje Actual</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              placeholder="0" 
                              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-mono" 
                              value={formData.kilometraje_actual} 
                              onChange={e => setFormData({...formData, kilometraje_actual: e.target.value})} 
                            />
                            <span className="absolute right-4 top-4 text-[10px] text-slate-600 font-black">KM</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Aviso Crítico (Dashboard)</label>
                          <input 
                            placeholder="Ej: Revisar sistema de frenos" 
                            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white focus:border-orange-500 transition-colors" 
                            value={formData.alerta_aviso} 
                            onChange={e => setFormData({...formData, alerta_aviso: e.target.value})} 
                          />
                        </div>
                      </div>

                      <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all flex justify-center items-center gap-2">
                        {loading ? "Guardando..." : "Guardar Ficha Técnica"}
                      </button>
                    </form>
                  )}

                  {/* TAB 2: BÓVEDA DOCUMENTAL */}
{/* TAB 3: BÓVEDA DOCUMENTAL */}
{tabExpediente === 'boveda' && unidadSeleccionada && (
  <div className="space-y-6 animate-in fade-in">
    <div className="bg-purple-500/5 border border-purple-500/20 p-8 rounded-[2rem] text-center">
      <UploadCloud className="text-purple-500 mx-auto mb-4" size={40} />
      <h4 className="text-white font-black uppercase tracking-widest mb-2">Bóveda Digital del Activo</h4>
      <p className="text-[11px] text-slate-400 leading-relaxed max-w-lg mx-auto">
        Respaldo en la nube de la documentación oficial de la unidad ECO-{unidadSeleccionada.numero_economico}.
      </p>
      
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        
{/* DOCUMENTO: PÓLIZA */}
        <div className="border border-dashed border-slate-700 bg-slate-950 rounded-2xl p-6 hover:border-purple-500/50 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-1">
              <p className="text-[11px] font-black text-white uppercase tracking-widest">Póliza de Seguro RC</p>
              {formData.doc_poliza && <CheckCircle size={14} className="text-emerald-500" />}
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-6">Formato PDF o Imagen</p>
          </div>
          
          <div className="space-y-3">
            {formData.doc_poliza ? (
              <div className="flex gap-2">
                <button onClick={() => verArchivoPrivado(formData.doc_poliza)} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase hover:bg-purple-500 hover:text-white transition-all">
                  <FileText size={14}/> Ver Seguro
                </button>
                <button onClick={() => borrarDocumentoUnidad('doc_poliza')} disabled={loading} title="Eliminar Documento" className="px-4 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all">
                  <Trash2 size={14}/>
                </button>
              </div>
            ) : (
              <label className="w-full flex items-center justify-center p-3.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 cursor-pointer transition-all">
                <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <UploadCloud size={14} /> Subir Archivo
                </span>
                <input type="file" className="hidden" accept=".pdf, image/*" onChange={(e) => subirDocumentoUnidad(e, 'doc_poliza')} disabled={loading} />
              </label>
            )}
          </div>
        </div>

        {/* DOCUMENTO: TARJETA CIRCULACIÓN */}
        <div className="border border-dashed border-slate-700 bg-slate-950 rounded-2xl p-6 hover:border-purple-500/50 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-1">
              <p className="text-[11px] font-black text-white uppercase tracking-widest">Tarjeta de Circulación</p>
              {formData.doc_tarjeta_circulacion && <CheckCircle size={14} className="text-emerald-500" />}
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-6">Formato PDF o Imagen</p>
          </div>
          
          <div className="space-y-3">
            {formData.doc_tarjeta_circulacion ? (
              <div className="flex gap-2">
                <button onClick={() => verArchivoPrivado(formData.doc_tarjeta_circulacion)} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase hover:bg-purple-500 hover:text-white transition-all">
                  <FileText size={14}/> Ver Tarjeta
                </button>
                <button onClick={() => borrarDocumentoUnidad('doc_tarjeta_circulacion')} disabled={loading} title="Eliminar Documento" className="px-4 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all">
                  <Trash2 size={14}/>
                </button>
              </div>
            ) : (
              <label className="w-full flex items-center justify-center p-3.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 cursor-pointer transition-all">
                <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <UploadCloud size={14} /> Subir Archivo
                </span>
                <input type="file" className="hidden" accept=".pdf, image/*" onChange={(e) => subirDocumentoUnidad(e, 'doc_tarjeta_circulacion')} disabled={loading} />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)}


                  {/* TAB 3: MANTENIMIENTOS */}
                  {tabExpediente === 'mantenimientos' && unidadSeleccionada && (
                    <div className="space-y-8">
                      <form onSubmit={registrarMantenimiento} className="p-6 bg-orange-500/10 border border-orange-500/20 rounded-2xl grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-12 mb-2"><h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2"><PlusCircle size={14}/> Registrar Servicio</h3></div>
                        <div className="col-span-12 md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold block mb-1 ml-1">Fecha</label><input type="date" required className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs text-white" value={nuevoMantenimiento.fecha} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, fecha: e.target.value})} /></div>
                        <div className="col-span-12 md:col-span-3"><label className="text-[9px] text-slate-400 uppercase font-bold block mb-1 ml-1">Tipo de Tarea</label><select className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs text-white" value={nuevoMantenimiento.tipo} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, tipo: e.target.value})}><option value="Preventivo">Preventivo (Afinación)</option><option value="Correctivo">Correctivo (Falla)</option></select></div>
                        <div className="col-span-12 md:col-span-4"><label className="text-[9px] text-slate-400 uppercase font-bold block mb-1 ml-1">Descripción del Taller</label><input required placeholder="Ej. Cambio de balatas" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs text-white" value={nuevoMantenimiento.descripcion} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, descripcion: e.target.value})} /></div>
                        <div className="col-span-12 md:col-span-2"><label className="text-[9px] text-slate-400 uppercase font-bold block mb-1 ml-1">Costo ($)</label><input required type="number" placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs text-white text-center font-mono" value={nuevoMantenimiento.costo} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, costo: e.target.value})} /></div>
                        <div className="col-span-12 mt-2"><button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-orange-900/20">Guardar Registro</button></div>
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
                         <div className="bg-slate-950 border border-slate-800 px-6 py-4 rounded-2xl text-right">
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