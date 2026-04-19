'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, PlusCircle, Trash2, X, Bell,
  ShieldCheck, Calendar, Wrench, AlertTriangle, CheckCircle, FileText, CreditCard, UploadCloud, Loader2
} from 'lucide-react';
import Sidebar from '@/components/sidebar';

// === SISTEMA DE ALERTAS ===
import { useToast } from '@/components/toastprovider';
import { fetchSafe } from '@/lib/fetchSafe';
import { notifyOffline } from '@/lib/notifyOffline';

export default function UnidadesPage() {
  const { mostrarAlerta } = useToast();
  const [dialogoConfirmacion, setDialogoConfirmacion] = useState({ visible: false, mensaje: '', accion: null });

  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  
  const [mostrarModal, setMostrarModal] = useState(false);
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [tabExpediente, setTabExpediente] = useState('tecnica'); 
  
  const [mantenimientos, setMantenimientos] = useState([]);
  const [alertas, setAlertas] = useState([]);

  const [nuevoMantenimiento, setNuevoMantenimiento] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'Preventivo', descripcion: '', costo: '' });
  const [nuevaAlerta, setNuevaAlerta] = useState({ kilometraje_meta: '', mensaje: '' });

  const [formData, setFormData] = useState({
    numero_economico: '', placas: '', tipo_placa: 'Federal', permiso_sict: 'TPAF01', num_permiso_sict: '',
    configuracion_vehicular: 'T3S1', anio_modelo: '', aseguradora_rc: '', poliza_rc: '',
    vencimiento_seguro: '', vencimiento_sct: '', vencimiento_circulacion: '',
    kilometraje_actual: 0, 
    doc_poliza: '',
    doc_tarjeta_circulacion: '' 
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
    const { data: perfilData, offline: offP } = await fetchSafe(
      supabase.from('perfiles').select('empresa_id').eq('id', userId).single(),
      `perfil_${userId}`
    );
    if (offP) notifyOffline();

    const idInstitucion = perfilData?.empresa_id || userId;
    setEmpresaId(idInstitucion);

    const { data, offline } = await fetchSafe(
      supabase.from('unidades').select('*').eq('empresa_id', idInstitucion).order('created_at', { ascending: false }),
      `unidades_${idInstitucion}`
    );
    if (offline) notifyOffline();
    setUnidades(data || []);
    setLoading(false);
  }

  async function cargarMantenimientos(unidadId) {
    const { data, offline } = await fetchSafe(
      supabase.from('mantenimientos').select('*').eq('unidad_id', unidadId).order('fecha', { ascending: false }),
      `mantenimientos_unidad_${unidadId}`
    );
    if (offline) notifyOffline();
    setMantenimientos(data || []);
  }

  async function cargarAlertas(unidadId) {
    const { data, offline } = await fetchSafe(
      supabase.from('alertas_mantenimiento').select('*').eq('unidad_id', unidadId).order('kilometraje_meta', { ascending: true }),
      `alertas_unidad_${unidadId}`
    );
    if (offline) notifyOffline();
    setAlertas(data || []);
  }

  const pedirConfirmacion = (mensaje, accion) => setDialogoConfirmacion({ visible: true, mensaje, accion });
  const ejecutarConfirmacion = async () => { if (dialogoConfirmacion.accion) await dialogoConfirmacion.accion(); setDialogoConfirmacion({ visible: false, mensaje: '', accion: null }); };

  const guardarUnidad = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = { 
      ...formData, 
      placas: formData.placas.toUpperCase(),
      vencimiento_seguro: formData.vencimiento_seguro || null,
      vencimiento_sct: formData.tipo_placa === 'Estatal' ? null : (formData.vencimiento_sct || null),
      vencimiento_circulacion: formData.vencimiento_circulacion || null
    };

    const { error } = unidadSeleccionada 
      ? await supabase.from('unidades').update(payload).eq('id', unidadSeleccionada.id)
      : await supabase.from('unidades').insert([payload]);

    if (error) {
      mostrarAlerta("Error al guardar: " + error.message, "error");
    } else {
      mostrarAlerta("Datos actualizados correctamente.", "exito");
      obtenerUnidades(sesion.user.id);
      if (unidadSeleccionada) setUnidadSeleccionada({...unidadSeleccionada, kilometraje_actual: formData.kilometraje_actual});
    }
    setLoading(false);
  };

  const eliminarUnidad = (id) => {
    pedirConfirmacion("¿Deseas eliminar esta unidad permanentemente? Esta acción es irreversible.", async () => {
      setLoading(true);
      const { error } = await supabase.from('unidades').delete().eq('id', id);
      if (error) {
        mostrarAlerta("No tienes permisos para eliminar (Solo Admins).", "error");
      } else {
        mostrarAlerta("Unidad eliminada correctamente.", "exito");
        obtenerUnidades(sesion.user.id);
      }
      setLoading(false);
    });
  };

  const registrarMantenimiento = async (e) => {
    e.preventDefault();
    if (!nuevoMantenimiento.descripcion || !nuevoMantenimiento.costo) return;
    setLoading(true);

    const { error } = await supabase.from('mantenimientos').insert([{ 
      unidad_id: unidadSeleccionada.id, 
      fecha: nuevoMantenimiento.fecha, 
      tipo: nuevoMantenimiento.tipo, 
      descripcion: nuevoMantenimiento.descripcion, 
      costo: parseFloat(nuevoMantenimiento.costo) 
    }]);

    if (error) {
      mostrarAlerta("Error: " + error.message, "error");
    } else { 
      mostrarAlerta("Mantenimiento registrado con éxito.", "exito");
      setNuevoMantenimiento({ fecha: new Date().toISOString().split('T')[0], tipo: 'Preventivo', descripcion: '', costo: '' }); 
      cargarMantenimientos(unidadSeleccionada.id); 
    }
    setLoading(false);
  };

  const registrarAlerta = async (e) => {
    e.preventDefault();
    if (!nuevaAlerta.kilometraje_meta || !nuevaAlerta.mensaje) return;
    setLoading(true);

    const { error } = await supabase.from('alertas_mantenimiento').insert([{ 
      unidad_id: unidadSeleccionada.id, 
      kilometraje_meta: parseFloat(nuevaAlerta.kilometraje_meta), 
      mensaje: nuevaAlerta.mensaje 
    }]);

    if (error) {
      mostrarAlerta("Error: " + error.message, "error");
    } else { 
      mostrarAlerta("Alerta registrada correctamente.", "exito");
      setNuevaAlerta({ kilometraje_meta: '', mensaje: '' }); 
      cargarAlertas(unidadSeleccionada.id); 
    }
    setLoading(false);
  };

  const abrirExpediente = (u) => {
    setUnidadSeleccionada(u);
    setFormData({
      numero_economico: u.numero_economico || '', placas: u.placas || '', 
      tipo_placa: u.tipo_placa || 'Federal', permiso_sict: u.permiso_sict || 'TPAF01',
      num_permiso_sict: u.num_permiso_sict || '', configuracion_vehicular: u.configuracion_vehicular || 'T3S1',
      anio_modelo: u.anio_modelo || '', aseguradora_rc: u.aseguradora_rc || '', poliza_rc: u.poliza_rc || '',
      vencimiento_seguro: u.vencimiento_seguro || '', vencimiento_sct: u.vencimiento_sct || '',
      vencimiento_circulacion: u.vencimiento_circulacion || '',
      kilometraje_actual: u.kilometraje_actual || 0,
      doc_poliza: u.doc_poliza || '',
      doc_tarjeta_circulacion: u.doc_tarjeta_circulacion || ''
    });
    setTabExpediente('tecnica');
    cargarMantenimientos(u.id);
    cargarAlertas(u.id);
    setMostrarModal(true);
  };

  const abrirNuevaUnidad = () => {
    setUnidadSeleccionada(null);
    setFormData({ 
      numero_economico: '', placas: '', tipo_placa: 'Federal', permiso_sict: 'TPAF01', 
      num_permiso_sict: '', configuracion_vehicular: 'T3S1', anio_modelo: '', aseguradora_rc: '', 
      poliza_rc: '', vencimiento_seguro: '', vencimiento_sct: '', vencimiento_circulacion: '',
      kilometraje_actual: 0, doc_poliza: '', doc_tarjeta_circulacion: ''
    });
    setTabExpediente('tecnica');
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setUnidadSeleccionada(null);
  };

  const eliminarMantenimiento = (id) => {
    pedirConfirmacion("¿Borrar registro de mantenimiento?", async () => {
      const { error } = await supabase.from('mantenimientos').delete().eq('id', id);
      if (error) mostrarAlerta("Error al borrar: " + error.message, "error");
      else {
        mostrarAlerta("Registro eliminado.", "exito");
        cargarMantenimientos(unidadSeleccionada.id);
      }
    });
  };

  const eliminarAlerta = (id) => {
    pedirConfirmacion("¿Eliminar alerta de kilometraje?", async () => {
      const { error } = await supabase.from('alertas_mantenimiento').delete().eq('id', id);
      if (error) mostrarAlerta("Error al borrar: " + error.message, "error");
      else {
        mostrarAlerta("Alerta eliminada.", "exito");
        cargarAlertas(unidadSeleccionada.id);
      }
    });
  };

  // === REFACTORIZACIÓN DUAL DE VIGENCIAS ===
  const verificarVigencia = (fecha) => {
    if (!fecha) return { texto: 'Sin registro', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
    const hoy = new Date();
    const fechaVenc = new Date(fecha + 'T23:59:59');
    const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes < 0) return { texto: 'Vencido', color: 'text-red-600 dark:text-red-500', bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' };
    if (diasRestantes <= 30) return { texto: `Vence en ${diasRestantes} días`, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30' };
    return { texto: 'Vigente', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' };
  };

  const subirDocumentoUnidad = async (e, campo) => {
    const file = e.target.files[0];
    if (!file || !unidadSeleccionada) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${unidadSeleccionada.numero_economico}/${campo}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('expedientes').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('unidades').update({ [campo]: fileName }).eq('id', unidadSeleccionada.id);
      if (updateError) throw updateError;
      setFormData({ ...formData, [campo]: fileName });
      obtenerUnidades(sesion.user.id);
      mostrarAlerta("Documento subido y guardado exitosamente.", "exito");
    } catch (error) { 
      mostrarAlerta("Error: " + error.message, "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  const verArchivoPrivado = async (path) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from('expedientes').createSignedUrl(path, 60);
    if (error) {
      mostrarAlerta("Error de acceso: " + error.message, "error");
    } else {
      window.open(data.signedUrl, '_blank');
    }
  };

  const borrarDocumentoUnidad = (campo) => {
    pedirConfirmacion("¿Eliminar documento de la bóveda? Se borrará permanentemente.", async () => {
      setLoading(true);
      try {
        const filePath = formData[campo];
        if (filePath) await supabase.storage.from('expedientes').remove([filePath]);
        await supabase.from('unidades').update({ [campo]: null }).eq('id', unidadSeleccionada.id);
        setFormData({ ...formData, [campo]: '' });
        obtenerUnidades(sesion.user.id);
        mostrarAlerta("Documento eliminado correctamente.", "exito");
      } catch (error) { 
        mostrarAlerta("Error: " + error.message, "error"); 
      } finally { 
        setLoading(false); 
      }
    });
  };

  if (!sesion) return null;

  return (
    <div className="flex bg-transparent min-h-screen text-slate-900 dark:text-slate-200 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-8 sm:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 transition-colors">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white leading-none transition-colors">Flota de <span className="text-blue-600 dark:text-blue-500">Unidades</span></h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 transition-colors">Control de Expedientes y Mantenimiento</p>
            </div>
            <button onClick={abrirNuevaUnidad} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
              <PlusCircle size={16} /> Alta de Unidad
            </button>
          </header>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl transition-colors">
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-left border-collapse text-[13px] min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[13px] font-semibold uppercase tracking-wider transition-colors">
                    <th className="p-4 pl-8 font-normal">Identificación</th>
                    <th className="p-4 font-normal">Odómetro Actual</th>
                    <th className="p-4 font-normal">Seguro RC</th>
                    <th className="p-4 font-normal">Permiso SCT</th>
                    <th className="p-4 font-normal">Tarjeta Circ.</th>
                    <th className="p-4 pr-8 text-right font-normal">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors">
                  {unidades.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <Truck size={32} className="mx-auto text-slate-400 dark:text-slate-700 mb-3" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm">No hay unidades registradas</p>
                      </td>
                    </tr>
                  )}
                  
                  {unidades.map((u) => {
                    const vigSeguro = verificarVigencia(u.vencimiento_seguro);
                    const vigCirculacion = verificarVigencia(u.vencimiento_circulacion);
                    const vigSct = u.tipo_placa === 'Estatal' 
                      ? { texto: 'No Aplica', color: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800' } 
                      : verificarVigencia(u.vencimiento_sct);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">                       
                        <td className="p-4 pl-8 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[14px] text-slate-900 dark:text-white font-mono font-medium transition-colors">ECO: {u.numero_economico}</span>
                            <span className="text-[11px] text-slate-500">Placas: <span className="text-slate-700 dark:text-slate-300 font-bold">{u.placas}</span></span>
                            <span className={`inline-flex px-2 py-0.5 rounded border uppercase tracking-widest text-[9px] items-center gap-1 ${u.tipo_placa === 'Estatal' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'}`}>
                              {u.tipo_placa || 'Federal'}
                            </span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-900 dark:text-white font-mono transition-colors">{Number(u.kilometraje_actual || 0).toLocaleString()} KM</span>
                            <span className="text-slate-500 text-[10px] uppercase tracking-widest">Registrado</span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vigSeguro.bg} w-max transition-colors`}>
                            <ShieldCheck size={14} className={vigSeguro.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${vigSeguro.color}`}>{vigSeguro.texto}</span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vigSct.bg} w-max transition-colors`}>
                            <FileText size={14} className={vigSct.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${vigSct.color}`}>{vigSct.texto}</span>
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vigCirculacion.bg} w-max transition-colors`}>
                            <CreditCard size={14} className={vigCirculacion.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${vigCirculacion.color}`}>{vigCirculacion.texto}</span>
                          </div>
                        </td>

                        <td className="p-4 pr-8 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-30 sm:opacity-20 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => abrirExpediente(u)} title="Ver Expediente" className="px-3 py-1.5 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-600 hover:text-blue-700 dark:hover:text-white border border-blue-200 dark:border-blue-500/20 rounded-lg uppercase tracking-widest text-[10px] flex items-center gap-1.5 transition-colors">
                              <Wrench size={14}/> Expediente
                            </button>
                            <button onClick={() => eliminarUnidad(u.id)} title="Eliminar Unidad" className="p-2 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors ml-2">
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

          {/* ========================================================= */}
          {/* MODAL DE CONFIRMACIÓN CUSTOM */}
          {/* ========================================================= */}
          {dialogoConfirmacion.visible && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm" onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} />
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 transition-colors">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32} /></div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 transition-colors">¿Estás Seguro?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 transition-colors">{dialogoConfirmacion.mensaje}</p>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Descartar</button>
                  <button onClick={ejecutarConfirmacion} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-red-600 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">{loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Sí, Proceder"}</button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL DEL EXPEDIENTE */}
          {/* ========================================================= */}
          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm" onClick={cerrarModal} />
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                
                <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0 transition-colors">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white italic uppercase leading-none transition-colors">
                      {unidadSeleccionada ? `Expediente: ECO ${unidadSeleccionada.numero_economico}` : 'Alta de Nueva Unidad'}
                    </h2>
                    {unidadSeleccionada && <p className="text-slate-500 dark:text-slate-400 text-[11px] font-mono mt-2 text-blue-600 dark:text-blue-400 font-bold tracking-widest transition-colors">PLACAS: {unidadSeleccionada.placas}</p>}
                  </div>
                  <button onClick={cerrarModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-950 p-2 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {unidadSeleccionada && (
                  <div className="flex px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shrink-0 overflow-x-auto scrollbar-hide transition-colors">
                    <button onClick={() => setTabExpediente('tecnica')} className={`py-4 px-3 sm:px-5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabExpediente === 'tecnica' ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                      <Truck size={14}/> Ficha Técnica
                    </button>
                    <button onClick={() => setTabExpediente('mantenimientos')} className={`py-4 px-3 sm:px-5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabExpediente === 'mantenimientos' ? 'border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                      <Wrench size={14}/> Historial Mtto
                    </button>
                    <button onClick={() => setTabExpediente('avisos')} className={`py-4 px-3 sm:px-5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabExpediente === 'avisos' ? 'border-orange-500 dark:border-orange-500 text-orange-600 dark:text-orange-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                      <Bell size={14}/> Avisos (KM)
                    </button>
                    <button onClick={() => setTabExpediente('boveda')} className={`py-4 px-3 sm:px-5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabExpediente === 'boveda' ? 'border-purple-600 dark:border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                      <UploadCloud size={14}/> Bóveda Docs
                    </button>
                  </div>
                )}

                <div className="p-4 sm:p-8 overflow-y-auto bg-white dark:bg-slate-900 flex-1 custom-scrollbar transition-colors">
                  
                  {/* --- TAB: FICHA TÉCNICA --- */}
                  {tabExpediente === 'tecnica' && (
                    <form onSubmit={guardarUnidad} className="space-y-6 animate-in fade-in">
                      <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-200 dark:border-slate-800 pb-2 transition-colors">Identificación Vehicular</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">No. Económico</label>
                            <input required  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white font-bold transition-colors" value={formData.numero_economico} onChange={e => setFormData({...formData, numero_economico: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Año Modelo</label>
                            <input  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.anio_modelo} onChange={e => setFormData({...formData, anio_modelo: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Configuración SAT</label>
                            <select required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white font-bold transition-colors" value={formData.configuracion_vehicular} onChange={e => setFormData({...formData, configuracion_vehicular: e.target.value})}>
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
                            <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white font-bold transition-colors"
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
                            <input required  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white uppercase font-mono tracking-widest transition-colors" value={formData.placas} onChange={e => setFormData({...formData, placas: e.target.value})} />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 sm:p-6 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-200 dark:border-blue-500/20 transition-colors">
                        <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4 border-b border-blue-200 dark:border-blue-500/20 pb-2 transition-colors">Seguros, Permisos y Vigencias</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2"><ShieldCheck size={14} className="text-blue-600 dark:text-blue-500"/><span className="text-[10px] font-black text-slate-900 dark:text-white uppercase transition-colors">Seguro RC</span></div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 block mb-1.5 ml-1">Aseguradora</label>
                              <input placeholder="Nombre Compañía" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.aseguradora_rc} onChange={e => setFormData({...formData, aseguradora_rc: e.target.value})} />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">No. Póliza</label>
                              <input  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-white font-mono transition-colors" value={formData.poliza_rc} onChange={e => setFormData({...formData, poliza_rc: e.target.value})} />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Vencimiento Seguro</label>
                              <input type="date" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.vencimiento_seguro} onChange={e => setFormData({...formData, vencimiento_seguro: e.target.value})} />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2"><FileText size={14} className="text-blue-600 dark:text-blue-500"/><span className="text-[10px] font-black text-slate-900 dark:text-white uppercase transition-colors">Permiso SCT</span></div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Clave Permiso</label>
                              <select 
                                className={`w-full p-3.5 rounded-xl text-sm transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'}`} 
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
                                className={`w-full p-3.5 rounded-xl text-sm font-mono transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'}`} 
                                value={formData.num_permiso_sict} 
                                readOnly={formData.tipo_placa === 'Estatal'}
                                onChange={e => setFormData({...formData, num_permiso_sict: e.target.value})} 
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Vencimiento SCT</label>
                              <input 
                                type="date" 
                                className={`w-full p-3.5 rounded-xl text-sm transition-colors ${formData.tipo_placa === 'Estatal' ? 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'}`} 
                                value={formData.vencimiento_sct} 
                                disabled={formData.tipo_placa === 'Estatal'}
                                onChange={e => setFormData({...formData, vencimiento_sct: e.target.value})} 
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2"><CreditCard size={14} className="text-blue-600 dark:text-blue-500"/><span className="text-[10px] font-black text-slate-900 dark:text-white uppercase transition-colors">Tarjeta Circulación</span></div>
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Vencimiento Tarjeta</label>
                              <input type="date" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.vencimiento_circulacion} onChange={e => setFormData({...formData, vencimiento_circulacion: e.target.value})} />
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl transition-colors">
                              <p className="text-[9px] text-slate-500 italic leading-relaxed text-center">
                                Las revisiones de Guardia Nacional requieren que la Tarjeta viaje en la unidad.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
                        <div>
                          <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1 transition-colors">Odómetro Base (Calibración)</p>
                          <p className="text-[10px] text-slate-500">Ajusta el kilometraje real de la unidad si hay desfase.</p>
                        </div>
                        <div className="relative w-full sm:w-1/3">
                          <input 
                            type="number" 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 transition-colors" 
                            value={formData.kilometraje_actual} 
                            onChange={e => setFormData({...formData, kilometraje_actual: e.target.value})} 
                          />
                          <span className="absolute right-4 top-4 text-[10px] text-slate-500 font-black">KM</span>
                        </div>
                      </div>

                      <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all flex items-center justify-center">
                        {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                        {loading ? "Guardando..." : "Guardar Ficha Técnica"}
                      </button>
                    </form>
                  )}

                  {/* --- TAB: MANTENIMIENTOS --- */}
                  {tabExpediente === 'mantenimientos' && unidadSeleccionada && (
                    <div className="space-y-8 animate-in fade-in">
                      <form onSubmit={registrarMantenimiento} className="p-4 sm:p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end transition-colors">
                        <div className="md:col-span-12 mb-2"><h3 className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2 transition-colors"><Wrench size={14}/> Registrar Servicio</h3></div>
                        <div className="md:col-span-3"><label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block mb-1 ml-1 transition-colors">Fecha</label><input type="date" required className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-xs text-slate-900 dark:text-white transition-colors" value={nuevoMantenimiento.fecha} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, fecha: e.target.value})} /></div>
                        <div className="md:col-span-3"><label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block mb-1 ml-1 transition-colors">Tipo de Tarea</label><select className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-xs text-slate-900 dark:text-white transition-colors" value={nuevoMantenimiento.tipo} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, tipo: e.target.value})}><option value="Preventivo">Preventivo</option><option value="Correctivo">Correctivo</option></select></div>
                        <div className="md:col-span-4"><label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block mb-1 ml-1 transition-colors">Descripción del Taller</label><input required placeholder="Ejemplo: Cambio de balatas" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-xs text-slate-900 dark:text-white transition-colors" value={nuevoMantenimiento.descripcion} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, descripcion: e.target.value})} /></div>
                        <div className="md:col-span-2"><label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block mb-1 ml-1 transition-colors">Costo ($)</label><input required type="number" placeholder="0.00" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-xs text-slate-900 dark:text-white text-center font-mono transition-colors" value={nuevoMantenimiento.costo} onChange={e => setNuevoMantenimiento({...nuevoMantenimiento, costo: e.target.value})} /></div>
                        <div className="md:col-span-12 mt-2"><button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg">Guardar Registro</button></div>
                      </form>
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[500px]">
                            <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 transition-colors"><tr><th className="p-4 font-black uppercase tracking-widest">Fecha</th><th className="p-4 font-black uppercase tracking-widest">Tipo</th><th className="p-4 font-black uppercase tracking-widest">Descripción</th><th className="p-4 font-black uppercase tracking-widest text-right">Costo</th><th className="p-4 font-black uppercase tracking-widest text-right">Borrar</th></tr></thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 transition-colors">
                              {mantenimientos.length === 0 && (<tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No hay registros.</td></tr>)}
                              {mantenimientos.map(m => (
                                <tr key={m.id} className="hover:bg-white dark:hover:bg-slate-900/50 transition-colors">
                                  <td className="p-4 text-slate-700 dark:text-slate-300 font-mono transition-colors">{m.fecha}</td>
                                  <td className="p-4"><span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors ${m.tipo === 'Preventivo' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-transparent' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-transparent'}`}>{m.tipo}</span></td>
                                  <td className="p-4 text-slate-700 dark:text-slate-300 max-w-xs truncate transition-colors">{m.descripcion}</td>
                                  <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium transition-colors">${Number(m.costo).toLocaleString()}</td>
                                  <td className="p-4 text-right"><button onClick={() => eliminarMantenimiento(m.id)} className="p-1.5 text-slate-400 dark:text-slate-600 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14}/></button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- TAB: AVISOS --- */}
                  {tabExpediente === 'avisos' && unidadSeleccionada && (
                    <div className="space-y-8 animate-in fade-in">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Odómetro Actual</p>
                          <p className="text-2xl font-mono font-black text-slate-900 dark:text-white transition-colors">{Number(unidadSeleccionada.kilometraje_actual || 0).toLocaleString()} <span className="text-sm text-slate-500">KM</span></p>
                        </div>
                        <AlertTriangle size={32} className="text-orange-400/20 dark:text-orange-500/20 transition-colors" />
                      </div>
                      <form onSubmit={registrarAlerta} className="p-4 sm:p-6 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-4 items-end transition-colors">
                        <div className="md:col-span-12 mb-2"><h3 className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest flex items-center gap-2 transition-colors"><Bell size={14}/> Nueva Alerta</h3></div>
                        <div className="md:col-span-4"><label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block mb-1 ml-1 transition-colors">Meta (KM)</label><input type="number" required className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white font-mono transition-colors" value={nuevaAlerta.kilometraje_meta} onChange={e => setNuevaAlerta({...nuevaAlerta, kilometraje_meta: e.target.value})} /></div>
                        <div className="md:col-span-6"><label className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold block mb-1 ml-1 transition-colors">Mensaje</label><input required placeholder="Ejemplo: Cambio Aceite" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={nuevaAlerta.mensaje} onChange={e => setNuevaAlerta({...nuevaAlerta, mensaje: e.target.value})} /></div>
                        <div className="md:col-span-2"><button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Añadir</button></div>
                      </form>
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[500px]">
                            <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 transition-colors"><tr><th className="p-4 font-black uppercase tracking-widest">Aviso</th><th className="p-4 font-black uppercase tracking-widest text-center">Meta (KM)</th><th className="p-4 font-black uppercase tracking-widest text-center">Faltan</th><th className="p-4 font-black uppercase tracking-widest text-right">Ok</th></tr></thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 transition-colors">
                              {alertas.length === 0 && (<tr><td colSpan="4" className="p-8 text-center text-slate-500 italic">Sin alertas.</td></tr>)}
                              {alertas.map(a => {
                                const kmActual = Number(unidadSeleccionada.kilometraje_actual || 0);
                                const kmMeta = Number(a.kilometraje_meta);
                                const kmFaltan = kmMeta - kmActual;
                                const estaVencida = kmFaltan <= 0;
                                return (
                                  <tr key={a.id} className="hover:bg-white dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="p-4"><span className={`font-semibold transition-colors ${estaVencida ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{a.mensaje}</span></td>
                                    <td className="p-4 text-center text-slate-700 dark:text-slate-300 font-mono transition-colors">{kmMeta.toLocaleString()}</td>
                                    <td className="p-4 text-center font-mono">
                                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${estaVencida ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-transparent' : 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'}`}>
                                        {estaVencida ? 'REBASADO' : `${kmFaltan.toLocaleString()} KM`}
                                      </span>
                                    </td>
                                    <td className="p-4 text-right"><button onClick={() => eliminarAlerta(a.id)} className="p-1.5 text-slate-400 dark:text-slate-600 hover:text-emerald-500 transition-colors"><CheckCircle size={16}/></button></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- TAB: BÓVEDA --- */}
                  {tabExpediente === 'boveda' && unidadSeleccionada && (
                    <div className="space-y-6 animate-in fade-in">
                      <div className="bg-purple-50 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20 p-6 sm:p-8 rounded-[2rem] text-center transition-colors">
                        <UploadCloud className="text-purple-600 dark:text-purple-500 mx-auto mb-4 transition-colors" size={40} />
                        <h4 className="text-slate-900 dark:text-white font-black uppercase tracking-widest mb-2 transition-colors">Bóveda Digital</h4>
                        <div className="mt-8 sm:mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-left">
                          
                          <div className="border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 flex flex-col justify-between transition-colors">
                            <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 transition-colors">Póliza de Seguro</p>
                            {formData.doc_poliza ? (
                              <div className="flex gap-2">
                                <button onClick={() => verArchivoPrivado(formData.doc_poliza)} className="flex-1 p-3 rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase transition-colors">Ver Doc</button>
                                <button onClick={() => borrarDocumentoUnidad('doc_poliza')} className="px-4 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors"><Trash2 size={14}/></button>
                              </div>
                            ) : (
                              <label className="w-full flex items-center justify-center p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer hover:border-purple-400 transition-colors">
                                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase transition-colors"><UploadCloud size={14} className="inline mr-2"/> Subir</span>
                                <input type="file" className="hidden" accept=".pdf, image/*" onChange={(e) => subirDocumentoUnidad(e, 'doc_poliza')} />
                              </label>
                            )}
                          </div>
                          
                          <div className="border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 flex flex-col justify-between transition-colors">
                            <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 transition-colors">Tarjeta Circulación</p>
                            {formData.doc_tarjeta_circulacion ? (
                              <div className="flex gap-2">
                                <button onClick={() => verArchivoPrivado(formData.doc_tarjeta_circulacion)} className="flex-1 p-3 rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase transition-colors">Ver Doc</button>
                                <button onClick={() => borrarDocumentoUnidad('doc_tarjeta_circulacion')} className="px-4 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors"><Trash2 size={14}/></button>
                              </div>
                            ) : (
                              <label className="w-full flex items-center justify-center p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer hover:border-purple-400 transition-colors">
                                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase transition-colors"><UploadCloud size={14} className="inline mr-2"/> Subir</span>
                                <input type="file" className="hidden" accept=".pdf, image/*" onChange={(e) => subirDocumentoUnidad(e, 'doc_tarjeta_circulacion')} />
                              </label>
                            )}
                          </div>

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