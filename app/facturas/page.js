'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  PlusCircle, Trash2, CheckCircle, Clock, X, 
  Calendar, ChevronDown, DollarSign, Truck, FileText, ShieldCheck, Settings, FileCode, Receipt, Loader2,
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';
import { generarFacturaPDF } from '@/utils/PdfFactura'; 
import { z } from 'zod';

// === ESCUDO DE VALIDACIÓN ZOD ===
const facturaSchema = z.object({
  cliente: z.string().min(2, "El nombre del cliente es obligatorio."),
  monto_total: z.number().positive("El monto total debe ser estrictamente mayor a $0."),
  metodo_pago: z.enum(["PUE", "PPD"], { errorMap: () => ({ message: "Método de pago inválido detectado." }) }),
  forma_pago: z.string().min(2, "La forma de pago es obligatoria."),
  fecha_viaje: z.string().min(10, "La fecha de emisión es obligatoria o tiene un formato incorrecto."),
  referencia: z.string().optional() // <--- NUEVO: Permitimos la referencia opcional
});

function FacturasContenido() {
  const searchParams = useSearchParams();
  const viajeIdHighlight = searchParams.get('viaje_id');

  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroActivo, setFiltroActivo] = useState(false);
  
  const [metricas, setMetricas] = useState({ cobrado: 0, pendiente: 0 });
  const [historial, setHistorial] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [perfilEmisor, setPerfilEmisor] = useState(null);
  
  const [empresaId, setEmpresaId] = useState(null);
  const [rolUsuario, setRolUsuario] = useState('miembro');

  const [formData, setFormData] = useState({ 
    cliente_id: '', monto_total: '', folio_fiscal: '', 
    ruta: '', fecha_viaje: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '', forma_pago: '99', metodo_pago: 'PPD',
    referencia: '' // <--- NUEVO: Estado inicial
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
  }, [fechaInicio, fechaFin, filtroActivo, viajeIdHighlight]);

  useEffect(() => {
    if (formData.cliente_id && formData.fecha_viaje) {
      const cliente = clientes.find(c => c.id === formData.cliente_id);
      if (cliente) {
        const fechaBase = new Date(formData.fecha_viaje + 'T00:00:00');
        fechaBase.setDate(fechaBase.getDate() + (cliente.dias_credito || 0));
        setFormData(prev => ({ ...prev, fecha_vencimiento: fechaBase.toISOString().split('T')[0] }));
      }
    }
  }, [formData.cliente_id, formData.fecha_viaje, clientes]);

  useEffect(() => {
    if (formData.metodo_pago === 'PUE' && formData.forma_pago === '99') {
      setFormData(prev => ({ ...prev, forma_pago: '03' })); 
    } else if (formData.metodo_pago === 'PPD') {
      setFormData(prev => ({ ...prev, forma_pago: '99' })); 
    }
  }, [formData.metodo_pago]);

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

    await Promise.all([
      obtenerDatos(idMaestro),
      obtenerClientes(idMaestro),
      obtenerPerfilEmisor(idMaestro)
    ]);
    setLoading(false);
  }

  async function obtenerPerfilEmisor(idMaestro) {
    const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', idMaestro).single();
    if (data) setPerfilEmisor(data);
  }

  async function obtenerClientes(idMaestro) {
    const { data } = await supabase.from('clientes')
      .select('*')
      .eq('usuario_id', idMaestro)
      .eq('activo', true)
      .order('nombre');
    setClientes(data || []);
  }

  async function obtenerDatos(idMaestro) {
    setLoading(true);
    let query = supabase
      .from('facturas')
      .select('*') 
      .eq('usuario_id', idMaestro)
      .order('folio_interno', { ascending: false })
      .order('created_at', { ascending: false });

    if (viajeIdHighlight) {
       query = query.eq('viaje_id', viajeIdHighlight);
    } else if (filtroActivo) {
       if (fechaInicio) query = query.gte('fecha_viaje', fechaInicio);
       if (fechaFin) query = query.lte('fecha_viaje', fechaFin);
    }

    const { data: facturasBD, error } = await query;
    if (error) console.error("Error cargando facturas:", error.message);

    const cobrado = facturasBD?.filter(f => f.estatus_pago === 'Pagado')
      .reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;
    const pendiente = facturasBD?.filter(f => f.estatus_pago === 'Pendiente')
      .reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;

    setMetricas({ cobrado, pendiente });
    setHistorial(facturasBD || []);
    setLoading(false);
  }

const descargarXML = async (facturapi_id, cliente_nombre) => {
    if (!facturapi_id) return alert("Esta factura aún no está timbrada en el SAT.");
    
    try {
      // 1. OBTENEMOS EL GAFETE DEL USUARIO
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("Sesión expirada o inválida. Vuelve a iniciar sesión.");

      // 2. DISPARAMOS AL TÚNEL PIDIENDO EL XML (MÉTODO GET, SIN PAYLOAD)
      const response = await fetch('/api/facturapi', { 
        method: 'POST', // Sigue siendo POST hacia nuestro propio túnel
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        }, 
        body: JSON.stringify({
          endpoint: `invoices/${facturapi_id}/xml`, // <--- RUTA CORRECTA PARA DESCARGAR
          method: 'GET' // <--- MÉTODO CORRECTO PARA CONSULTA
          // Eliminamos el payload por completo
        }) 
      });

      if (!response.ok) throw new Error("No se pudo obtener el XML del SAT");

      // 3. RECIBIMOS EL ARCHIVO (BLOB) DIRECTAMENTE, SIN PARSEAR JSON
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Factura_XML_${cliente_nombre.replace(/\s+/g, '_')}.xml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      alert("Error al descargar XML: " + err.message);
    }
  };

const timbrarFactura = async (factura) => {
    const clienteData = clientes.find(c => c.nombre === factura.cliente);
    if (!clienteData) {
      alert("⚠️ Error: No se encontró la información fiscal del cliente. Verifica tu catálogo de clientes.");
      return;
    }

    const totalInput = Number(factura.monto_total);
    const subtotal = Number((totalInput / 1.16).toFixed(2));

    const invoiceData = {
      customer: {
        legal_name: clienteData.nombre, tax_id: clienteData.rfc, tax_system: clienteData.regimen_fiscal || "601", address: { zip: clienteData.codigo_postal }
      },
      items: [{
        quantity: 1, product: {
          description: factura.ruta || "Servicio de flete nacional", product_key: "78101802", price: subtotal,
          taxes: [{ type: "IVA", rate: 0.16 }, { type: "IVA", rate: 0.04, withholding: true }]
        }
      }],
      payment_form: factura.forma_pago || "99", payment_method: factura.metodo_pago || "PPD", use: clienteData.uso_cfdi || "G03"
    };

    setLoading(true);
    try {

      // 1. OBTENEMOS EL GAFETE DEL USUARIO
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("Sesión expirada o inválida. Vuelve a iniciar sesión.");

      // 2. DISPARAMOS AL TÚNEL CON LA CABECERA DE AUTORIZACIÓN
      const response = await fetch('/api/facturapi', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // <--- EL GAFETE
        }, 
        body: JSON.stringify({
          endpoint: 'invoices',
          method: 'POST',
          payload: invoiceData // Asegúrate de que tu variable se llame así o cámbiala por la tuya
        }) 
      });
      const res = await response.json();

      if (response.ok) {
        const uuidReal = res.uuid;
        const selloEmisor = res.stamp?.signature || "SELLO_NO_ENCONTRADO";
        const selloSat = res.stamp?.sat_signature || "SELLO_SAT_NO_ENCONTRADO";
        const cadenaOriginal = res.stamp?.complement_string || "CADENA_NO_ENCONTRADA";
        const certSat = res.stamp?.sat_cert_number || null;
        
        const { error: supabaseError } = await supabase.from('facturas').update({ 
            folio_fiscal: uuidReal, 
            sello_emisor: selloEmisor, 
            sello_sat: selloSat, 
            cadena_original: cadenaOriginal, 
            facturapi_id: res.id,
            no_certificado_sat: certSat
          }).eq('id', factura.id);

        if (supabaseError) throw supabaseError;
        alert(`🎉 ¡FACTURA TIMBRADA CON ÉXITO!\n\nUUID: ${uuidReal}`);
        obtenerDatos(empresaId); 
      } else {
        alert(`❌ Error del SAT:\n${res.message || "Error desconocido"}`);
      }
    } catch (err) { alert("Error de red:\n" + err.message); } finally { setLoading(false); }
  };

const registrarFactura = async (e) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.monto_total) return;
    setLoading(true);

    try {
      const clienteSeleccionado = clientes.find(c => c.id === formData.cliente_id);

      // 1. Preparamos los datos crudos (lo que el usuario escribió)
      const datosCrudos = {
        cliente: clienteSeleccionado?.nombre || "",
        monto_total: parseFloat(formData.monto_total),
        metodo_pago: formData.metodo_pago,
        forma_pago: formData.forma_pago,
        fecha_viaje: formData.fecha_viaje,
        referencia: formData.referencia, // <--- NUEVO
      };

      // 2. PASAMOS POR EL DETECTOR DE METALES (SAFE PARSE)
      // Esto no rompe la app, solo nos devuelve un reporte de inspección
      const validacion = facturaSchema.safeParse(datosCrudos);

      if (!validacion.success) {
        setLoading(false);
        // Mostramos el primer error que Zod haya encontrado
        const mensajeError = validacion.error.issues[0]?.message || "🛑 Revisa los datos ingresados.";
        return alert(mensajeError);
      }

      // 3. Si Zod aprueba (success: true), insertamos en Supabase con los datos ultra-limpios
      const { error } = await supabase.from('facturas').insert([{ 
          cliente: validacion.data.cliente,
          monto_total: validacion.data.monto_total, 
          folio_fiscal: formData.folio_fiscal,
          ruta: formData.ruta,
          fecha_viaje: validacion.data.fecha_viaje,
          fecha_vencimiento: formData.fecha_vencimiento,
          forma_pago: validacion.data.forma_pago,
          metodo_pago: validacion.data.metodo_pago,
          estatus_pago: 'Pendiente',
          usuario_id: empresaId,
          referencia: validacion.data.referencia
        }]);

      if (error) throw error;
      
      setFormData({ cliente_id: '', monto_total: '', folio_fiscal: '', ruta: 'Ingreso Extraordinario', fecha_viaje: new Date().toISOString().split('T')[0], fecha_vencimiento: '', forma_pago: '99', metodo_pago: 'PPD', referencia:'' });
      setMostrarFormulario(false);
      obtenerDatos(empresaId);
    } catch (error) {
      alert("Fallo al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const alternarEstatus = async (id, estatusActual) => {
    const nuevoEstatus = estatusActual === 'Pendiente' ? 'Pagado' : 'Pendiente';
    await supabase.from('facturas').update({ estatus_pago: nuevoEstatus }).eq('id', id);
    obtenerDatos(empresaId);
  };

  const eliminarFactura = async (id, tieneViajeAsociado) => {
    if (tieneViajeAsociado) {
       alert("No puedes borrar esta factura desde aquí porque está asociada a un Viaje. Debes borrar el Viaje desde la pestaña de viajes");
       return;
    }
    if (!confirm("¿Eliminar registro manual?")) return;
    await supabase.from('facturas').delete().eq('id', id);
    obtenerDatos(empresaId);
  };

  if (!sesion) return <div className="min-h-screen bg-slate-950"></div>;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200 w-full">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">Control de <span className="text-emerald-500">Ingresos</span></h1>
              {viajeIdHighlight ? (
                 <p className="text-orange-500 text-[10px] font-bold uppercase mt-2 tracking-widest flex items-center gap-1"><Truck size={12}/> Mostrando factura del viaje seleccionado</p>
              ) : (
                 <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Facturación y Cobranza</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <button 
                  onClick={() => {
                    if (viajeIdHighlight) window.location.href = '/facturas'; 
                    else setMostrarFiltro(!mostrarFiltro);
                  }}
                  className={`flex items-center gap-3 border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                    ${filtroActivo ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}
                    ${viajeIdHighlight ? 'border-orange-500/50 text-orange-400 hover:bg-orange-500/10' : ''}`}
                >
                  <Calendar size={14} className={filtroActivo ? 'text-emerald-500' : (viajeIdHighlight ? 'text-orange-500' : 'text-slate-500')} />
                  {viajeIdHighlight ? 'Ver Todo el Historial' : (filtroActivo ? 'Filtro Activo' : 'Periodo')}
                  {!viajeIdHighlight && <ChevronDown size={14} className={`transition-transform duration-200 ${mostrarFiltro ? 'rotate-180' : ''}`} />}
                </button>

                {mostrarFiltro && !viajeIdHighlight && (
                  <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-20 p-5">
                    <div className="mb-4">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Desde (Fecha Viaje)</label>
                      <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl p-3 outline-none focus:border-emerald-500" />
                    </div>
                    <div className="mb-6">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Hasta (Fecha Viaje)</label>
                      <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl p-3 outline-none focus:border-emerald-500" />
                    </div>
                    <button onClick={() => { setFiltroActivo(true); setMostrarFiltro(false); }}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-colors mb-2">
                      Aplicar Filtro
                    </button>
                    {filtroActivo && (
                      <button onClick={() => { setFiltroActivo(false); setFechaInicio(''); setFechaFin(''); setMostrarFiltro(false); }}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest py-2.5 rounded-xl transition-colors">
                        Limpiar
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => setMostrarFormulario(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all border border-emerald-500/50">
                <PlusCircle size={16} /> Registrar Factura 
              </button>
            </div>
          </header>

          {rolUsuario === 'administrador' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 animate-in fade-in">
              <TarjetaDato 
                titulo="Ingreso Cobrado" 
                valor={`$${metricas.cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} 
                color="emerald" 
              />
              <TarjetaDato 
                titulo="Por Cobrar" 
                valor={`$${metricas.pendiente.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} 
                color="blue" 
              />
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-4xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-[12px] font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-8 font-normal w-12">Pago</th>
                    <th className="p-4 font-normal">Folio y Origen</th>
                    <th className="p-4 font-normal">Cliente Receptor</th>
                    <th className="p-4 font-normal">Concepto</th>
                    <th className="p-4 font-normal">Vencimiento</th>
                    <th className="p-4 font-normal">Monto Total</th>
                    <th className="p-4 pr-8 text-right font-normal">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {historial.map((item) => {
                    const esVencida = new Date(item.fecha_vencimiento + 'T23:59:59') < new Date() && item.estatus_pago !== 'Pagado';
                    const vieneDeViaje = item.viaje_id !== null;
                    const sinTimbrar = !item.folio_fiscal || item.folio_fiscal === '';
                    const clienteCompleto = clientes.find(c => c.nombre === item.cliente) || {};

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                        
                        <td className="p-4 pl-8 align-middle">
                          <button onClick={() => alternarEstatus(item.id, item.estatus_pago)} title="Marcar como Pagado/Pendiente"
                            className={`p-2 rounded-lg transition-all ${item.estatus_pago === 'Pagado' ? 'bg-emerald-600/20 text-emerald-500' : 'bg-slate-800 text-slate-500 hover:text-emerald-400'}`}>
                            {item.estatus_pago === 'Pagado' ? <CheckCircle size={18} /> : <Clock size={18} />}
                          </button>
                        </td>

                        <td className="p-4 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[14px] text-white font-mono font-medium">
                              {item.folio_interno ? `F-${String(item.folio_interno).padStart(4, '0')}` : 'F-S/N'}
                            </span>
                            
                            {vieneDeViaje ? (
                              <span className="inline-flex px-2 py-0.5 rounded bg-blue-900/30 border border-blue-500/30 text-blue-400 uppercase tracking-widest text-[9px] items-center gap-1 mt-0.5">
                                <Truck size={8}/> VIAJE: {item.folio_viaje ? `V-${String(item.folio_viaje).padStart(4, '0')}` : 'V-S/N'}
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 uppercase tracking-widest text-[9px] items-center gap-1 mt-0.5">
                                Libre
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white truncate max-w-[200px]" title={item.cliente}>{item.cliente}</span>
                            <span className="text-slate-500 text-[11px] font-mono flex items-center gap-1">
                              <FileText size={10} className={sinTimbrar ? "text-orange-500" : "text-purple-500"}/>
                              {sinTimbrar ? 'Borrador sin SAT' : item.folio_fiscal.slice(0,18) + '...'}
                            </span>
                          </div>
                        </td>

<td className="p-4 align-middle max-w-[200px]">
                          <span className="text-slate-300 text-[12px] truncate block" title={item.ruta}>{item.ruta || '---'}</span>
                          {/* NUEVO: Mostramos la referencia debajo del concepto si existe */}
                          {item.referencia && (
                            <span className="text-emerald-500/80 text-[10px] uppercase font-bold tracking-widest truncate block mt-1" title={item.referencia}>
                              REF: {item.referencia}
                            </span>
                          )}
                        </td>

                        <td className="p-4 align-middle">
                           {item.estatus_pago === 'Pagado' ? (
                             <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Liquidada</span>
                           ) : (
                             <div className="flex flex-col gap-0.5">
                               <span className={`text-[12px] ${esVencida ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                                 {item.fecha_vencimiento?.slice(0, 10) || 'S/V'}
                               </span>
                               {esVencida && <span className="text-[9px] font-black text-red-500 uppercase">Vencida</span>}
                             </div>
                           )}
                        </td>

                        <td className="p-4 align-middle">
                          <span className={`text-[14px] font-mono font-medium ${item.estatus_pago === 'Pagado' ? 'text-emerald-400' : 'text-white'}`}>
                            ${Number(item.monto_total).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </span>
                        </td>

                        <td className="p-4 pr-8 align-middle">
                          <div className="flex items-center justify-end gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                            
                            {sinTimbrar ? (
                              <button onClick={() => timbrarFactura(item)} title="Timbrar Factura" className="px-3 py-1.5 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/20 rounded-lg uppercase tracking-widest text-[10px] flex items-center gap-1.5 transition-colors">
                                {loading ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>} Timbrar
                              </button>
                            ) : (
                              <>
                                <button onClick={() => generarFacturaPDF(item, clienteCompleto, perfilEmisor)} title="Descargar Factura PDF" className="p-2 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors"><Receipt size={16}/></button>
                                {item.facturapi_id && (
                                  <button onClick={() => descargarXML(item.facturapi_id, item.cliente)} title="Descargar XML" className="p-2 bg-purple-600/10 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg transition-colors"><FileCode size={16}/></button>
                                )}
                              </>
                            )}

                            <button onClick={() => eliminarFactura(item.id, vieneDeViaje)} title={vieneDeViaje ? "Borrar desde Viajes" : "Eliminar"} className={`p-2 transition-colors rounded-lg ${vieneDeViaje ? 'text-slate-700 cursor-not-allowed' : 'text-slate-600 hover:text-red-500 hover:bg-red-500/10'}`}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-16 text-center">
                        <DollarSign size={32} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm">No hay facturas en este periodo</p>
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
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                <button onClick={() => setMostrarFormulario(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Registrar <span className="text-emerald-500">Factura</span></h2>
                
                <form onSubmit={registrarFactura} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente Receptor</label>
                      </div>
                      <select required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none focus:border-emerald-500"
                        value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}>
                        <option value="">-- Seleccionar de Catálogo SAT --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.dias_credito} días crédito)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Monto Total con IVA ($)</label>
                      <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white font-mono outline-none focus:border-emerald-500" 
                        value={formData.monto_total} onChange={e => setFormData({...formData, monto_total: e.target.value})} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Concepto / Referencia</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none focus:border-emerald-500" 
                        value={formData.ruta} onChange={e => setFormData({...formData, ruta: e.target.value})} placeholder="Ej. Flete Extra" />
                    </div>
                  </div>
{/* NUEVO CAMPO: Referencia del Cliente */}
                  <div className="md:col-span-2">
                     <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Referencia del Cliente (Opcional)</label>
                     <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none focus:border-emerald-500" 
                        value={formData.referencia} onChange={e => setFormData({...formData, referencia: e.target.value})} placeholder="Ej. Orden de Compra 4920-A" />
                  </div>

                  <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl">
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Settings size={12}/> Configuración SAT (CFDI 4.0)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[12px] font-black text-slate-500 uppercase mb-2 block ml-1">Método de Pago</label>
                        <select className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-white"
                          value={formData.metodo_pago} onChange={e => setFormData({...formData, metodo_pago: e.target.value})}>
                          <option value="PPD">PPD - Pago en Parcialidades o Diferido</option>
                          <option value="PUE">PUE - Pago en una Sola Exhibición</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[12px] font-black text-slate-500 uppercase mb-2 block ml-1">Forma de Pago</label>
                        <select className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-white"
                          value={formData.forma_pago} onChange={e => setFormData({...formData, forma_pago: e.target.value})} disabled={formData.metodo_pago === 'PPD'}>
                          <option value="99">99 - Por Definir (Obligatorio en PPD)</option>
                          <option value="03">03 - Transferencia Electrónica</option>
                          <option value="01">01 - Efectivo</option>
                          <option value="02">02 - Cheque Nominativo</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Fecha de Emisión</label>
                      <input type="date" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                        value={formData.fecha_viaje} onChange={e => setFormData({...formData, fecha_viaje: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[12px] font-black text-orange-500 uppercase tracking-widest mb-2 block ml-1">Vencimiento Cobro</label>
                      <input type="date" readOnly className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-sm text-slate-400 outline-none" 
                        value={formData.fecha_vencimiento} />
                    </div>
                  </div>

                  <button type="submit" disabled={loading || clientes.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all mt-4">
                    {loading ? "Generando..." : "Registrar Factura"}
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

export default function FacturasPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-emerald-500">Cargando Módulo Financiero...</p></div>}>
      <FacturasContenido />
    </Suspense>
  );
}