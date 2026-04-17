'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  ArrowLeft, Calendar, Truck, MapPin, Package, ShieldCheck, 
  Clock, FileText, UploadCloud, Edit2, CheckCircle, X, Save, Trash2, DollarSign 
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { useToast } from '@/components/toastprovider'; 

export default function DetalleViajePage() {
  const { id } = useParams();
  const router = useRouter();
  const { mostrarAlerta } = useToast();

  const [sesion, setSesion] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  
  const [viaje, setViaje] = useState(null);
  const [catalogos, setCatalogos] = useState({ unidades: [], operadores: [], remolques: [], ubicaciones: [], clientes: [], mercancias: [] });

  // Estados de Control de UI
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modoEdicionFecha, setModoEdicionFecha] = useState(false);
  
  // Estado para el formulario de edición
  const [formData, setFormData] = useState(null);
  const [nuevaFechaSalida, setNuevaFechaSalida] = useState('');
  const [subiendoPod, setSubiendoPod] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSesion(session);
        inicializarDatos(session.user.id);
      } else {
        router.push('/');
      }
    });
  }, [id]);

  async function inicializarDatos(userId) {
    try {
      const { data: perfilData } = await supabase.from('perfiles').select('empresa_id').eq('id', userId).single();
      const idMaestro = perfilData?.empresa_id || userId;
      setEmpresaId(idMaestro);

      await Promise.all([
        cargarCatalogos(idMaestro),
        obtenerDetalleViaje(idMaestro)
      ]);
    } catch (error) {
      mostrarAlerta("Error de inicialización: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function cargarCatalogos(idMaestro) {
    const [u, o, r, ub, cl, m] = await Promise.all([
      supabase.from('unidades').select('*').eq('empresa_id', idMaestro).eq('activo', true),
      supabase.from('operadores').select('*').eq('empresa_id', idMaestro).eq('activo', true),
      supabase.from('remolques').select('*').eq('empresa_id', idMaestro).eq('activo', true),
      supabase.from('ubicaciones').select('*').eq('empresa_id', idMaestro).eq('activo', true),
      supabase.from('clientes').select('*').eq('empresa_id', idMaestro).eq('activo', true),
      supabase.from('mercancias').select('*').eq('empresa_id', idMaestro).eq('activo', true)
    ]);
    setCatalogos({ unidades: u.data || [], operadores: o.data || [], remolques: r.data || [], ubicaciones: ub.data || [], clientes: cl.data || [], mercancias: m.data || [] });
  }

  async function obtenerDetalleViaje(idMaestro) {
    const { data, error } = await supabase.from('viajes').select(`
      *, unidades(*), operadores(*), remolques(*), clientes(*),
      origen:ubicaciones!viajes_origen_id_fkey(*), destino:ubicaciones!viajes_destino_id_fkey(*)
    `).eq('id', id).eq('empresa_id', idMaestro).single();

    if (error) throw error;
    setViaje(data);
    setNuevaFechaSalida(data.fecha_salida || '');
  }

  const activarModoEdicion = () => {
    let detalle = viaje.mercancias_detalle || [];
    if (detalle.length === 0 && viaje.mercancia_id) detalle = [{ mercancia_id: viaje.mercancia_id, cantidad: viaje.cantidad_mercancia || 1, peso_kg: viaje.peso_total_kg || '', valor: '', moneda: 'MXN' }];
    if (detalle.length === 0) detalle = [{ mercancia_id: '', cantidad: 1, peso_kg: '', valor: '', moneda: 'MXN' }];

    setFormData({
      unidad_id: viaje.unidad_id || '', remolque_id: viaje.remolque_id || '', operador_id: viaje.operador_id || '', origen_id: viaje.origen_id || '', destino_id: viaje.destino_id || '',
      cliente_id: viaje.cliente_id || '', 
      monto_flete: viaje.monto_flete || '', 
      moneda: viaje.moneda || 'MXN', // <-- INICIALIZACIÓN DE DIVISA
      aplica_iva: viaje.aplica_iva !== false, aplica_retencion: viaje.aplica_retencion !== false, 
      distancia_km: viaje.distancia_km || '', referencia: viaje.referencia || '',
      mercancias_detalle: detalle, tag_casetas: viaje.tag_casetas || '', tarjeta_gasolina: viaje.tarjeta_gasolina || ''
    });
    setModoEdicion(true);
  };

  // --- Funciones del Formulario de Mercancías ---
  const agregarFilaMercancia = () => setFormData({ ...formData, mercancias_detalle: [...formData.mercancias_detalle, { mercancia_id: '', cantidad: 1, peso_kg: '', valor: '', moneda: 'MXN' }] });
  const actualizarFilaMercancia = (index, campo, valor) => { const nuevas = [...formData.mercancias_detalle]; nuevas[index][campo] = valor; setFormData({ ...formData, mercancias_detalle: nuevas }); };
  const eliminarFilaMercancia = (index) => setFormData({ ...formData, mercancias_detalle: formData.mercancias_detalle.filter((_, i) => i !== index) });
  const calcularPesoTotal = () => formData.mercancias_detalle.reduce((acc, curr) => acc + (Number(curr.peso_kg) || 0), 0);

  const guardarCambiosViaje = async (e) => {
    e.preventDefault();
    if (formData.mercancias_detalle.length === 0) return mostrarAlerta("Debes agregar al menos una mercancía.", "error");
    
    setGuardando(true);
    try {
      const clienteObj = catalogos.clientes.find(c => c.id === formData.cliente_id);
      const mercanciasEnriquecidas = formData.mercancias_detalle.map(item => {
        const cat = catalogos.mercancias.find(m => m.id === item.mercancia_id);
        return { ...item, clave_sat: cat?.clave_sat, descripcion: cat?.descripcion, embalaje: cat?.clave_embalaje || '4G', material_peligroso: cat?.material_peligroso || false };
      });

      const unidadSeleccionadaObj = catalogos.unidades.find(u => u.id === formData.unidad_id);
      const configSAT = unidadSeleccionadaObj?.configuracion_vehicular || '';
      const esArticulado = configSAT.includes('T') || configSAT.includes('R');
      const remolqueLimpio = esArticulado ? formData.remolque_id : null;

      const payload = {
        distancia_km: parseFloat(formData.distancia_km || 0), unidad_id: formData.unidad_id, remolque_id: remolqueLimpio, operador_id: formData.operador_id, origen_id: formData.origen_id, destino_id: formData.destino_id,
        mercancia_id: formData.mercancias_detalle[0].mercancia_id, mercancias_detalle: mercanciasEnriquecidas, peso_total_kg: calcularPesoTotal(), cliente_id: formData.cliente_id || null, 
        monto_flete: parseFloat(formData.monto_flete || 0), 
        moneda: formData.moneda, // <-- SE GUARDA LA DIVISA EN VIAJES
        aplica_iva: formData.aplica_iva, aplica_retencion: formData.aplica_retencion, 
        referencia: formData.referencia || '', tag_casetas: formData.tag_casetas, tarjeta_gasolina: formData.tarjeta_gasolina
      };

      await supabase.from('viajes').update(payload).eq('id', id);

      // Sincronización de Factura
      if (formData.monto_flete > 0 && formData.cliente_id) {
        let fleteBase = payload.monto_flete;
        let montoCalculado = fleteBase;
        if (payload.aplica_iva) montoCalculado += (fleteBase * 0.16);
        if (payload.aplica_retencion) montoCalculado -= (fleteBase * 0.04);
        montoCalculado = Number(montoCalculado.toFixed(2));

        const fechaVenc = new Date(viaje.fecha_salida); fechaVenc.setDate(fechaVenc.getDate() + (clienteObj?.dias_credito || 0));
        
        const { data: facExistente } = await supabase.from('facturas').select('id').eq('viaje_id', id).single();
        if (facExistente) {
          await supabase.from('facturas').update({ 
            cliente: clienteObj.nombre, 
            monto_total: montoCalculado, 
            moneda: formData.moneda, // <-- SE ACTUALIZA DIVISA EN FACTURA EXISTENTE
            fecha_vencimiento: fechaVenc.toISOString().split('T')[0], 
            ruta: `Flete CCP${formData.referencia ? ' - Ref: '+formData.referencia : ''}` 
          }).eq('id', facExistente.id);
        } else {
          await supabase.from('facturas').insert([{ 
            viaje_id: id, 
            folio_viaje: viaje.folio_interno, 
            empresa_id: empresaId, 
            cliente: clienteObj.nombre, 
            monto_total: montoCalculado, 
            moneda: formData.moneda, // <-- SE GUARDA DIVISA EN FACTURA NUEVA
            fecha_viaje: viaje.fecha_salida, 
            fecha_vencimiento: fechaVenc.toISOString().split('T')[0], 
            estatus_pago: 'Pendiente', 
            ruta: `Flete CCP${formData.referencia ? ' - Ref: '+formData.referencia : ''}` 
          }]);
        }
      }

      await obtenerDetalleViaje(empresaId);
      setModoEdicion(false);
      mostrarAlerta("Operación actualizada correctamente.", "exito");
    } catch (error) {
      mostrarAlerta("Error al guardar: " + error.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const guardarNuevaFecha = async () => {
    if (estaTimbrado) return mostrarAlerta("Protección Activa: No puedes alterar la fecha de un viaje ya timbrado.", "error");
    setGuardando(true);
    try {
      await supabase.from('viajes').update({ fecha_salida: nuevaFechaSalida }).eq('id', id);
      // Actualizamos también la fecha de la factura si existe
      await supabase.from('facturas').update({ fecha_viaje: nuevaFechaSalida }).eq('viaje_id', id);
      
      setViaje(prev => ({ ...prev, fecha_salida: nuevaFechaSalida }));
      setModoEdicionFecha(false);
      mostrarAlerta("Fecha operativa actualizada.", "exito");
    } catch (error) { mostrarAlerta("Error: " + error.message, "error"); } finally { setGuardando(false); }
  };

const subirPOD = async (event) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return mostrarAlerta("El archivo supera los 5MB permitidos.", "error");
      }

      setSubiendoPod(true);

      // 1. Crear un nombre único para el archivo para evitar sobreescrituras
      const fileExt = file.name.split('.').pop();
      const fileName = `pod_v${viaje.folio_interno}_${Date.now()}.${fileExt}`;
      const filePath = `${empresaId}/${fileName}`; // Agrupamos por empresa por orden

      // 2. Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('evidencias_viajes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. Obtener la URL pública del archivo recién subido
      const { data: { publicUrl } } = supabase.storage
        .from('evidencias_viajes')
        .getPublicUrl(filePath);

      // 4. Actualizar la base de datos con la URL Y el nuevo Estatus
      const { error: dbError } = await supabase.from('viajes')
        .update({ 
            url_pod: publicUrl,
            estatus: 'Cerrado' 
        })
        .eq('id', viaje.id);

      if (dbError) throw dbError;

      // 5. Actualizar el estado visual de React
      setViaje(prev => ({ 
          ...prev, 
          url_pod: publicUrl,
          estatus: 'Cerrado' 
      }));
      mostrarAlerta("Evidencia cargada exitosamente.", "exito");
      
    } catch (error) {
      mostrarAlerta("Error al subir archivo: " + error.message, "error");
    } finally {
      setSubiendoPod(false);
      // Limpiar el input para permitir subir el mismo archivo si se borró
      event.target.value = null; 
    }
  };

const eliminarPOD = async () => {
    if (!viaje.url_pod) return;
    
    setSubiendoPod(true); 
    try {
      // 1. Extraer la ruta exacta del archivo a partir de la URL pública
      const rutaArchivo = viaje.url_pod.split('/evidencias_viajes/')[1];
      
      // 2. Eliminar físicamente del Bucket de Supabase
      if (rutaArchivo) {
        const { error: storageError } = await supabase.storage
          .from('evidencias_viajes')
          .remove([rutaArchivo]);
          
        if (storageError) throw storageError;
      }

      // 3. Borrar la referencia en la base de datos Y regresar estatus
      const { error: dbError } = await supabase.from('viajes')
        .update({ 
          url_pod: null,
          estatus: 'Emitido (Timbrado)' 
        })
        .eq('id', viaje.id);

      if (dbError) throw dbError;

      // 4. Actualizar la vista de React
      setViaje(prev => ({ ...prev, url_pod: null, estatus: 'Emitido (Timbrado)' }));
      mostrarAlerta("Evidencia eliminada. El viaje ha regresado a estatus Emitido.", "exito");
      
    } catch (error) {
      mostrarAlerta("Error al eliminar archivo: " + error.message, "error");
    } finally {
      setSubiendoPod(false);
    }
  };

const getBadgeColor = (estatus) => {
    switch(estatus) { 
      case 'Cerrado': return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
      case 'Emitido (Timbrado)': return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'; 
      case 'Cancelado': return 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'; 
      default: return 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20'; 
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors"><p className="text-blue-600 dark:text-blue-500 font-black animate-pulse uppercase tracking-widest">Cargando Centro de Control...</p></div>;
  if (!viaje) return null;

  const estaTimbrado = viaje.folio_fiscal || viaje.estatus === 'Emitido (Timbrado)';
  const unidadFormObj = formData?.unidad_id ? catalogos.unidades.find(u => u.id === formData.unidad_id) : null;
  const esCamionArticulado = unidadFormObj?.configuracion_vehicular.includes('T') || unidadFormObj?.configuracion_vehicular.includes('R');

  return (
    <div className="flex bg-transparent min-h-screen text-slate-900 dark:text-slate-200 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/viajes')} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm"><ArrowLeft size={18} /></button>
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white leading-none transition-colors">Viaje <span className="text-blue-600 dark:text-blue-500">V-{String(viaje.folio_interno).padStart(4, '0')}</span></h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex px-2 py-0.5 rounded border uppercase tracking-widest text-[9px] font-black items-center gap-1 ${getBadgeColor(viaje.estatus)}`}>{viaje.estatus}</span>
                  {viaje.id_ccp && <span className="text-slate-500 text-[10px] font-mono tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">CCP: {viaje.id_ccp}</span>}
                </div>
              </div>
            </div>
            
            {!estaTimbrado && !modoEdicion && (
              <button onClick={activarModoEdicion} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-lg">
                <Edit2 size={14} /> Editar Operación
              </button>
            )}
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMNA IZQUIERDA: Detalles Operativos o Formulario */}
            <div className="lg:col-span-2 space-y-6">
              
              {modoEdicion ? (
                /* --- MODO EDICIÓN --- */
                <form onSubmit={guardarCambiosViaje} className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-[2rem] p-6 shadow-2xl animate-in fade-in transition-colors space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[12px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2"><Edit2 size={16}/> Editando Parámetros</p>
                    <button type="button" onClick={() => setModoEdicion(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20}/></button>
                  </div>

                  {/* Asignación */}
                  <div className={`grid gap-4 ${esCamionArticulado ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    <select required className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.unidad_id} onChange={e => setFormData({...formData, unidad_id: e.target.value, remolque_id: catalogos.unidades.find(u => u.id === e.target.value)?.configuracion_vehicular.match(/[TR]/) ? formData.remolque_id : ''})}><option value="">Unidad...</option>{catalogos.unidades.map(u => <option key={u.id} value={u.id}>{u.numero_economico}</option>)}</select>
                    {esCamionArticulado && <select required className="bg-orange-50 dark:bg-slate-950 border border-orange-200 dark:border-orange-500/50 p-3 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.remolque_id} onChange={e => setFormData({...formData, remolque_id: e.target.value})}><option value="">Remolque (OBLIGATORIO)...</option>{catalogos.remolques.map(r => <option key={r.id} value={r.id}>{r.placas}</option>)}</select>}
                    <select required className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.operador_id} onChange={e => setFormData({...formData, operador_id: e.target.value})}><option value="">Operador...</option>{catalogos.operadores.map(o => <option key={o.id} value={o.id}>{o.nombre_completo}</option>)}</select>
                  </div>

                  {/* Ruta */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                    <select required className="col-span-1 sm:col-span-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.origen_id} onChange={e => setFormData({...formData, origen_id: e.target.value})}><option value="">Origen...</option>{catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}</select>
                    <select required className="col-span-1 sm:col-span-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white transition-colors" value={formData.destino_id} onChange={e => setFormData({...formData, destino_id: e.target.value})}><option value="">Destino...</option>{catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}</select>
                    <input required type="number" placeholder="KM Total" className="col-span-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white text-center transition-colors" value={formData.distancia_km} onChange={e => setFormData({...formData, distancia_km: e.target.value})} />
                  </div>

                  {/* Mercancías */}
                  <div className="p-4 border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-900/10 rounded-2xl space-y-4 transition-colors">
                    <div className="flex justify-between items-center"><p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-black tracking-widest">Carga</p><button type="button" onClick={agregarFilaMercancia} className="text-[9px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg uppercase hover:bg-blue-500">+ Producto</button></div>
                    {formData.mercancias_detalle.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                        <select required className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white outline-none" value={item.mercancia_id} onChange={e => actualizarFilaMercancia(index, 'mercancia_id', e.target.value)}><option value="">Producto...</option>{catalogos.mercancias.map(m => <option key={m.id} value={m.id}>{m.descripcion}</option>)}</select>
                        <input required type="number" placeholder="Cant." className="w-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg text-xs text-center" value={item.cantidad} onChange={e => actualizarFilaMercancia(index, 'cantidad', e.target.value)} />
                        <input required type="number" step="0.01" placeholder="KG" className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg text-xs text-center" value={item.peso_kg} onChange={e => actualizarFilaMercancia(index, 'peso_kg', e.target.value)} />
                        <button type="button" onClick={() => eliminarFilaMercancia(index)} disabled={formData.mercancias_detalle.length === 1} className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>

                  {/* Facturación y Extras */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm" value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value})}><option value="">Cliente Factura (Opcional)...</option>{catalogos.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                    <input type="text" placeholder="Orden de Compra / Referencia" className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm" value={formData.referencia} onChange={e => setFormData({...formData, referencia: e.target.value})} />
                    
                    <div className="flex gap-2">
                      <input type="number" placeholder="Monto Flete Base ($)" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-mono" value={formData.monto_flete} onChange={e => setFormData({...formData, monto_flete: e.target.value})} />
                      <select className="w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold" value={formData.moneda} onChange={e => setFormData({...formData, moneda: e.target.value})}>
                        <option value="MXN">MXN</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>

                    <div className="flex gap-4 items-center pl-2">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500"><input type="checkbox" className="accent-blue-600 w-4 h-4" checked={formData.aplica_iva} onChange={e => setFormData({...formData, aplica_iva: e.target.checked})} /> + IVA</label>
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500"><input type="checkbox" className="accent-blue-600 w-4 h-4" checked={formData.aplica_retencion} onChange={e => setFormData({...formData, aplica_retencion: e.target.checked})} /> - RET</label>
                    </div>
                  </div>

                  <button type="submit" disabled={guardando} className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl flex justify-center items-center gap-2">
                    {guardando ? <Clock className="animate-spin" size={16} /> : <Save size={16} />} {guardando ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </form>
              ) : (
                /* --- MODO LECTURA (Tarjetas Originales) --- */
                <>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm transition-colors animate-in fade-in">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin size={14}/> Ruta y Cliente</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="border-l-2 border-emerald-500 pl-4">
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Origen</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{viaje.origen?.nombre_lugar || 'N/A'}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{viaje.origen?.estado}</p>
                      </div>
                      <div className="border-l-2 border-blue-500 pl-4">
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Destino</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{viaje.destino?.nombre_lugar || 'N/A'}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{viaje.destino?.estado}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Cliente Receptor</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{viaje.clientes?.nombre || 'Sin facturación asociada'}</p>
                        {viaje.referencia && <p className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 mt-1">PO: {viaje.referencia}</p>}
                      </div>
                      
                      {viaje.monto_flete > 0 && (
                        <div className="text-left sm:text-right bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
                          <p className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-0.5">Flete Acordado</p>
                          <p className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-500">
                            ${Number(viaje.monto_flete).toLocaleString('es-MX', {minimumFractionDigits: 2})} <span className="text-[10px] text-slate-500 tracking-widest ml-1">{viaje.moneda || 'MXN'}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm transition-colors animate-in fade-in">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><Truck size={14}/> Asignación de Recursos</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] uppercase text-slate-400 font-black tracking-widest mb-1">Operador</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={viaje.operadores?.nombre_completo}>{viaje.operadores?.nombre_completo}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] uppercase text-slate-400 font-black tracking-widest mb-1">Tracto</p>
                        <p className="text-xs font-mono text-slate-900 dark:text-white">{viaje.unidades?.numero_economico}</p>
                      </div>
                      {viaje.remolques && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[9px] uppercase text-slate-400 font-black tracking-widest mb-1">Remolque</p>
                          <p className="text-xs font-mono text-slate-900 dark:text-white">{viaje.remolques?.placas}</p>
                        </div>
                      )}
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] uppercase text-slate-400 font-black tracking-widest mb-1">Distancia</p>
                        <p className="text-xs font-mono text-slate-900 dark:text-white">{viaje.distancia_km} KM</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* COLUMNA DERECHA: Auditoría y Evidencia */}
            <div className="space-y-6">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock size={14}/> Auditoría de Tiempos</p>
                <div className="space-y-5">
                  <div>
                    <p className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1">Alta en Sistema (Inmutable)</p>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-400">{new Date(viaje.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-end mb-2">
                      <p className="text-[9px] uppercase text-blue-600 dark:text-blue-500 font-black tracking-widest">Fecha Operativa</p>
                      {!estaTimbrado && !modoEdicionFecha && !modoEdicion && (
                        <button onClick={() => setModoEdicionFecha(true)} className="text-[9px] text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 uppercase font-bold tracking-widest"><Edit2 size={10}/> Editar</button>
                      )}
                    </div>
                    {modoEdicionFecha ? (
                      <div className="flex gap-2">
                        <input type="date" className="flex-1 bg-slate-50 dark:bg-slate-950 border border-blue-200 dark:border-blue-800 text-xs text-slate-900 dark:text-white p-2.5 rounded-lg outline-none" value={nuevaFechaSalida} onChange={(e) => setNuevaFechaSalida(e.target.value)} />
                        <button onClick={guardarNuevaFecha} disabled={guardando} className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-lg">{guardando ? <Clock size={16} className="animate-spin" /> : <CheckCircle size={16} />}</button>
                        <button onClick={() => { setModoEdicionFecha(false); setNuevaFechaSalida(viaje.fecha_salida); }} className="bg-slate-100 dark:bg-slate-800 text-slate-500 p-2.5 rounded-lg hover:text-slate-900"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2"><Calendar size={14} className="text-slate-400" /><p className="text-sm font-semibold text-slate-900 dark:text-white">
  {viaje.fecha_salida ? viaje.fecha_salida.split('T')[0] : 'Sin asignar'}
</p></div>
                    )}
                    {estaTimbrado && <p className="text-[8px] uppercase text-orange-500 font-bold tracking-widest mt-2 flex items-center gap-1"><ShieldCheck size={10}/> Bloqueado por SAT</p>}
                  </div>
                </div>
              </div>

<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <FileText size={14}/> Evidencia (POD)
                </p>
                
                {viaje.url_pod ? (
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate">Documento Cargado</p>
                        <a href={viaje.url_pod} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 dark:text-emerald-500 hover:underline">
                          Abrir archivo en nueva pestaña
                        </a>
                      </div>
                    </div>
                    <button 
                      onClick={eliminarPOD} 
                      disabled={subiendoPod}
                      className="text-slate-400 hover:text-red-500 p-2 disabled:opacity-50 transition-colors"
                      title="Eliminar archivo"
                    >
                      {subiendoPod ? <Clock size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                ) : (
                  <label className={`border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-950 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${subiendoPod ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}`}>
                    <input 
                      type="file" 
                      accept=".pdf, image/jpeg, image/png" 
                      className="hidden" 
                      onChange={subirPOD}
                      disabled={subiendoPod}
                    />
                    <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-3 shadow-sm text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                      {subiendoPod ? <Clock size={20} className="animate-spin text-blue-500" /> : <UploadCloud size={20} />}
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {subiendoPod ? 'Subiendo archivo...' : 'Cargar Prueba de Entrega (POD)'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">PDF, JPG o PNG (Max. 5MB)</p>
                    
                    {!subiendoPod && (
                      <div className="mt-4 text-[9px] uppercase font-black tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        Seleccionar Archivo
                      </div>
                    )}
                  </label>
                )}
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}