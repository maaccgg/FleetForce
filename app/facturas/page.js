'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  PlusCircle, Trash2, CheckCircle, Clock, X, 
  Calendar, ChevronDown, DollarSign, Truck, FileText, ShieldCheck, Settings, FileCode, Receipt, Loader2, CalendarCheck, AlertTriangle
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';
import { generarFacturaPDF } from '@/utils/PdfFactura'; 
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/toastprovider'; 

// === ESCUDO DE VALIDACIÓN ZOD ===
const facturaSchema = z.object({
  cliente: z.string().min(2, "El nombre del cliente es obligatorio."),
  metodo_pago: z.enum(["PUE", "PPD"], { errorMap: () => ({ message: "Método de pago inválido detectado." }) }),
  forma_pago: z.string().min(2, "La forma de pago es obligatoria."),
  fecha_viaje: z.string().min(10, "La fecha de emisión es obligatoria o tiene un formato incorrecto."),
  referencia: z.string().optional()
});

function FacturasContenido() {
  const searchParams = useSearchParams();
  const viajeIdHighlight = searchParams.get('viaje_id');

  const { mostrarAlerta } = useToast(); 
  const [dialogoConfirmacion, setDialogoConfirmacion] = useState({ visible: false, mensaje: '', accion: null });

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

  const esAdmin = rolUsuario === 'administrador' || rolUsuario === 'admin';

  // === ESTADO INICIAL MULTI-CONCEPTO CON IMPUESTOS INDIVIDUALES ===
  const formInicial = { 
    cliente_id: '', folio_fiscal: '', 
    fecha_viaje: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '', forma_pago: '99', metodo_pago: 'PPD', referencia: '', folio_viaje_manual: '',
    conceptos: [{ descripcion: 'Flete Nacional', monto: '', clave_sat: '78101802', aplica_iva: true, aplica_retencion: true }] 
  };

  const [formData, setFormData] = useState(formInicial);

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
  }, [fechaInicio, fechaFin, filtroActivo, viajeIdHighlight, empresaId]);

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
    const { data: perfilData } = await supabase.from('perfiles').select('empresa_id, rol').eq('id', userId).single();
    const idMaestro = perfilData?.empresa_id || userId;
    setEmpresaId(idMaestro);
    if (perfilData?.rol) setRolUsuario(perfilData.rol);

    await Promise.all([obtenerDatos(idMaestro), obtenerClientes(idMaestro), obtenerPerfilEmisor(idMaestro)]);
    setLoading(false);
  }

  async function obtenerPerfilEmisor(idMaestro) {
    const { data } = await supabase.from('perfil_emisor').select('*').eq('empresa_id', idMaestro).single();
    if (data) setPerfilEmisor(data);
  }

  async function obtenerClientes(idMaestro) {
    const { data } = await supabase.from('clientes').select('*').eq('empresa_id', idMaestro).eq('activo', true).order('nombre');
    setClientes(data || []);
  }

  async function obtenerDatos(idMaestro) {
    setLoading(true);
    let query = supabase.from('facturas').select('*').eq('empresa_id', idMaestro).order('folio_interno', { ascending: false }).order('created_at', { ascending: false });

    if (viajeIdHighlight) {
       query = query.eq('viaje_id', viajeIdHighlight);
    } else if (filtroActivo) {
       if (fechaInicio) query = query.gte('fecha_viaje', fechaInicio);
       if (fechaFin) query = query.lte('fecha_viaje', fechaFin);
    }

    const { data: facturasBD, error } = await query;
    if (error) console.error("Error cargando facturas:", error.message);

    const cobrado = facturasBD?.filter(f => f.estatus_pago === 'Pagado').reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;
    const pendiente = facturasBD?.filter(f => f.estatus_pago === 'Pendiente').reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;

    setMetricas({ cobrado, pendiente });
    setHistorial(facturasBD || []);
    setLoading(false);
  }

  const pedirConfirmacion = (mensaje, accion) => setDialogoConfirmacion({ visible: true, mensaje, accion });
  const ejecutarConfirmacion = async () => { if (dialogoConfirmacion.accion) await dialogoConfirmacion.accion(); setDialogoConfirmacion({ visible: false, mensaje: '', accion: null }); };

  // === FUNCIONES MULTI-CONCEPTO CON IMPUESTOS ===
  const agregarConcepto = () => setFormData({ ...formData, conceptos: [...formData.conceptos, { descripcion: '', monto: '', clave_sat: '78101802', aplica_iva: true, aplica_retencion: false }] });
  const actualizarConcepto = (index, campo, valor) => { const nuevos = [...formData.conceptos]; nuevos[index][campo] = valor; setFormData({ ...formData, conceptos: nuevos }); };
  const eliminarConcepto = (index) => setFormData({ ...formData, conceptos: formData.conceptos.filter((_, i) => i !== index) });

  const calcularSubtotalBase = () => formData.conceptos.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);

  const calcularTotalEnTiempoReal = () => {
    return formData.conceptos.reduce((acc, c) => {
      let base = parseFloat(c.monto) || 0;
      if (c.aplica_iva) base += (parseFloat(c.monto) || 0) * 0.16;
      if (c.aplica_retencion) base -= (parseFloat(c.monto) || 0) * 0.04;
      return acc + base;
    }, 0);
  };

  const descargarXML = async (facturapi_id, cliente_nombre, folio_interno) => {
    if (!facturapi_id) return mostrarAlerta("Esta factura aún no está timbrada en el SAT.", "error");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      const response = await fetch('/api/facturapi', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ endpoint: `invoices/${facturapi_id}/xml`, method: 'GET' }) });
      if (!response.ok) throw new Error("No se pudo obtener el XML del SAT");
      
      const blob = await response.blob(); 
      const url = window.URL.createObjectURL(blob);
      
      const folioStr = folio_interno ? `F-${String(folio_interno).padStart(4, '0')}` : 'F-SN';
      const link = document.createElement('a'); 
      link.href = url; 
      link.download = `Factura_XML_${folioStr}_${cliente_nombre.replace(/\s+/g, '_')}.xml`;
      
      document.body.appendChild(link); 
      link.click(); 
      link.remove(); 
      window.URL.revokeObjectURL(url);
    } catch (err) { mostrarAlerta("Error al descargar XML: " + err.message, "error"); }
  };

  const timbrarFactura = async (factura) => {
    const clienteData = clientes.find(c => c.nombre === factura.cliente);
    if (!clienteData) return mostrarAlerta("Error: No se encontró la información fiscal del cliente.", "error");

    // Armado dinámico de partidas con impuestos individuales
    const arregloItemsFacturapi = (factura.conceptos_detalle && factura.conceptos_detalle.length > 0) 
      ? factura.conceptos_detalle.map(c => {
          let impuestosItem = [];
          // Aseguramos compatibilidad si no existía el booleano antes (fallback a true)
          if (c.aplica_iva !== false) impuestosItem.push({ type: "IVA", rate: 0.16 });
          if (c.aplica_retencion === true || factura.aplica_retencion === true) impuestosItem.push({ type: "IVA", rate: 0.04, withholding: true });
          
          return {
            quantity: 1,
            product: {
              description: c.descripcion,
              product_key: String(c.clave_sat).replace(/[^0-9]/g, '') || "78101802",
              price: Number(c.monto),
              taxes: impuestosItem
            }
          };
        })
      : [{ // Fallback de seguridad para facturas súper antiguas
          quantity: 1,
          product: {
            description: factura.ruta || "Servicio de flete nacional",
            product_key: "78101802",
            price: Number(factura.monto_total),
            taxes: [] // Si es viejo, asume que el monto total ya no se puede desglosar bien sin saber su factor original
          }
        }];

    const invoiceData = { 
      customer: { legal_name: clienteData.nombre, tax_id: clienteData.rfc, tax_system: clienteData.regimen_fiscal || "601", address: { zip: clienteData.codigo_postal } }, 
      items: arregloItemsFacturapi, 
      payment_form: factura.forma_pago || "99", payment_method: factura.metodo_pago || "PPD", use: clienteData.uso_cfdi || "G03" 
    };

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      const response = await fetch('/api/facturapi', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ endpoint: 'invoices', method: 'POST', payload: invoiceData }) });
      const res = await response.json();

      if (response.ok) {
        const { error: supabaseError } = await supabase.from('facturas').update({ folio_fiscal: res.uuid, sello_emisor: res.stamp?.signature || "SELLO_NO_ENCONTRADO", sello_sat: res.stamp?.sat_signature || "SELLO_SAT_NO_ENCONTRADO", cadena_original: res.stamp?.complement_string || "CADENA_NO_ENCONTRADA", facturapi_id: res.id, no_certificado_sat: res.stamp?.sat_cert_number || null }).eq('id', factura.id);
        if (supabaseError) throw supabaseError;
        mostrarAlerta(`¡FACTURA TIMBRADA CON ÉXITO!🎉🎉`, "exito");
        obtenerDatos(empresaId); 
      } else { mostrarAlerta(`Error del SAT:\n${res.message || "Error desconocido"}`, "error"); }
    } catch (err) { mostrarAlerta("Error de red:\n" + err.message, "error"); } finally { setLoading(false); }
  };

  const registrarFactura = async (e) => {
    e.preventDefault();
    if (!formData.cliente_id) return mostrarAlerta("Selecciona un cliente.", "error");
    
    const subtotalValidado = calcularSubtotalBase();
    if (subtotalValidado <= 0) return mostrarAlerta("El total de los conceptos debe ser mayor a $0.", "error");

    setLoading(true);
    try {
      const clienteSeleccionado = clientes.find(c => c.id === formData.cliente_id);
      const datosCrudos = { cliente: clienteSeleccionado?.nombre || "", metodo_pago: formData.metodo_pago, forma_pago: formData.forma_pago, fecha_viaje: formData.fecha_viaje, referencia: formData.referencia };
      const validacion = facturaSchema.safeParse(datosCrudos);

      if (!validacion.success) { setLoading(false); return mostrarAlerta(validacion.error.issues[0]?.message || "🛑 Revisa los datos ingresados.", "error"); }

      // Total acumulado individual
      let montoCalculado = formData.conceptos.reduce((acc, c) => {
        let base = parseFloat(c.monto) || 0;
        if (c.aplica_iva) base += (parseFloat(c.monto) || 0) * 0.16;
        if (c.aplica_retencion) base -= (parseFloat(c.monto) || 0) * 0.04;
        return acc + base;
      }, 0);
      montoCalculado = Number(montoCalculado.toFixed(2));

      // Resumen para la vista y extracción de folio
      const resumenRuta = formData.conceptos.map(c => c.descripcion).join(' + ');
      let folioViajeLimpio = formData.folio_viaje_manual ? parseInt(String(formData.folio_viaje_manual).replace(/[^0-9]/g, ''), 10) : null;
      if (isNaN(folioViajeLimpio)) folioViajeLimpio = null;

      const { error } = await supabase.from('facturas').insert([{ 
        cliente: validacion.data.cliente, 
        monto_total: montoCalculado, 
        ruta: resumenRuta, 
        conceptos_detalle: formData.conceptos,
        folio_viaje: folioViajeLimpio,
        fecha_viaje: validacion.data.fecha_viaje, 
        fecha_vencimiento: formData.fecha_vencimiento, 
        forma_pago: validacion.data.forma_pago, 
        metodo_pago: validacion.data.metodo_pago, 
        estatus_pago: 'Pendiente', 
        referencia: validacion.data.referencia, 
        empresa_id: empresaId 
      }]);
      if (error) throw error;
      
      setFormData(formInicial);
      setMostrarFormulario(false); 
      mostrarAlerta("Ingreso registrado exitosamente.", "exito"); 
      obtenerDatos(empresaId);
    } catch (error) { mostrarAlerta("Fallo al guardar: " + error.message, "error"); } finally { setLoading(false); }
  };

  const alternarEstatus = async (id, estatusActual) => {
    if (estatusActual === 'Cancelada') {
      return mostrarAlerta("Una factura cancelada ante el SAT no puede cambiar de estatus de cobro.", "error");
    }

    const esPendiente = estatusActual === 'Pendiente';
    const nuevoEstatus = esPendiente ? 'Pagado' : 'Pendiente';
    const fechaDePago = esPendiente ? new Date().toISOString().split('T')[0] : null;

    const { error } = await supabase.from('facturas').update({ estatus_pago: nuevoEstatus, fecha_pago: fechaDePago }).eq('id', id);
    if (error) { mostrarAlerta("Error al actualizar estatus: " + error.message, "error"); return; }
    mostrarAlerta(`Estatus actualizado a ${nuevoEstatus}.`, "exito"); obtenerDatos(empresaId);
  };

  const procesarCancelacion = (factura, tieneViajeAsociado) => {
    if (tieneViajeAsociado) {
       return mostrarAlerta("Acción denegada. Esta factura está asociada a un Viaje Operativo. Debes cancelarla desde la pestaña de Logística.", "error");
    }

    if (factura.estatus_pago === 'Cancelada') {
      pedirConfirmacion("¿Eliminar registro histórico? La factura ya está anulada en el SAT, pero esta acción la borrará permanentemente de tu panel de FleetForce.", async () => {
        const { error } = await supabase.from('facturas').delete().eq('id', factura.id);
        if (error) { mostrarAlerta("Error al eliminar: " + error.message, "error"); } 
        else { mostrarAlerta("Registro eliminado de FleetForce.", "exito"); obtenerDatos(empresaId); }
      });
      return;
    }

    const estaTimbrada = factura.facturapi_id && factura.folio_fiscal;

    if (estaTimbrada) {
      pedirConfirmacion("¿Deseas CANCELAR esta factura ante el SAT? Esta acción es irreversible y el folio fiscal quedará invalidado.", async () => {
        setLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");

          const response = await fetch('/api/facturapi', { 
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, 
            body: JSON.stringify({ endpoint: `invoices/${factura.facturapi_id}?motive=02`, method: 'DELETE' }) 
          });

          if (!response.ok) throw new Error("El SAT rechazó la petición de cancelación.");

          await supabase.from('facturas').update({ estatus_pago: 'Cancelada' }).eq('id', factura.id);
          mostrarAlerta("Factura CANCELADA exitosamente en el SAT.", "exito");
          obtenerDatos(empresaId);
        } catch (error) { mostrarAlerta("Error al cancelar en SAT: " + error.message, "error"); } finally { setLoading(false); }
      });
    } else {
      pedirConfirmacion("¿Eliminar registro manual de ingreso? Al no estar timbrada en el SAT, se borrará definitivamente de tu historial.", async () => {
        const { error } = await supabase.from('facturas').delete().eq('id', factura.id);
        if (error) { mostrarAlerta("Error al eliminar: " + error.message, "error"); } else { mostrarAlerta("Borrador eliminado correctamente.", "exito"); obtenerDatos(empresaId); }
      });
    }
  };

  const exportarExcelFacturas = () => {
    const datosParaExcel = historial.map(f => ({ Folio_Interno: f.folio_interno ? `F-${String(f.folio_interno).padStart(4, '0')}` : 'F-S/N', Folio_Viaje: f.viaje_id || f.folio_viaje ? `V-${String(f.folio_viaje || 0).padStart(4, '0')}` : 'N/A', Fecha_Emision: f.fecha_viaje, Fecha_Vencimiento: f.fecha_vencimiento || 'S/V', Estatus_Pago: f.estatus_pago, Fecha_Pago_Real: f.fecha_pago || 'Pendiente', Cliente: f.cliente, Concepto: f.ruta || '', Referencia: f.referencia || '', Monto_Total: f.monto_total, Metodo_Pago: f.metodo_pago, Forma_Pago: f.forma_pago, UUID_SAT: f.folio_fiscal || 'Sin Timbrar' }));
    const ws = XLSX.utils.json_to_sheet(datosParaExcel); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Facturas"); XLSX.writeFile(wb, `Reporte_Facturas_FleetForce_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!sesion) return null;

  return (
    <div className="flex bg-transparent min-h-screen text-slate-900 dark:text-slate-200 w-full transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 transition-colors">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white leading-none transition-colors">Control de <span className="text-emerald-600 dark:text-emerald-500">Ingresos</span></h1>
              {viajeIdHighlight ? ( <p className="text-orange-600 dark:text-orange-500 text-[10px] font-bold uppercase mt-2 tracking-widest flex items-center gap-1"><Truck size={12}/> Factura de viaje seleccionado</p> ) : ( <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Facturación y Cobranza</p> )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative shrink-0 w-full md:w-auto">
                <button onClick={() => { if (viajeIdHighlight) window.location.href = '/facturas'; else setMostrarFiltro(!mostrarFiltro); }} className={`w-full md:w-auto flex items-center justify-center gap-3 border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${filtroActivo ? 'bg-emerald-50 dark:bg-emerald-600/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'} ${viajeIdHighlight ? 'border-orange-200 dark:border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10' : ''}`}>
                  <Calendar size={14} className={filtroActivo ? 'text-emerald-600 dark:text-emerald-500' : (viajeIdHighlight ? 'text-orange-600 dark:text-orange-500' : 'text-slate-500')} /><span>{viajeIdHighlight ? 'Ver Todo el Historial' : (filtroActivo ? 'Filtros Activos' : 'Filtros y Reportes')}</span>{!viajeIdHighlight && <ChevronDown size={14} className={`transition-transform duration-300 ${mostrarFiltro ? 'rotate-180' : ''}`} />}
                </button>

                {mostrarFiltro && !viajeIdHighlight && (
                  <div className="absolute right-0 md:left-0 md:right-auto mt-2 w-full md:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] shadow-xl dark:shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200 z-[60] transition-colors">
                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-5 border-b border-slate-100 dark:border-slate-800 pb-3 text-center transition-colors">Parámetros de Búsqueda</p>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Desde</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-[11px] rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors cursor-pointer" /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Hasta</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-[11px] rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors cursor-pointer" /></div>
                    </div>
                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800 transition-colors">
                      <button onClick={() => { setFiltroActivo(true); setMostrarFiltro(false); }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20">Aplicar Filtros</button>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {filtroActivo && (<button onClick={() => { setFiltroActivo(false); setFechaInicio(''); setFechaFin(''); setMostrarFiltro(false); }} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl transition-colors">Limpiar</button>)}
                        {esAdmin && (<button onClick={exportarExcelFacturas} className={`${filtroActivo ? '' : 'col-span-2'} flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-600/10 hover:bg-emerald-100 dark:hover:bg-emerald-600 text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-white border border-emerald-200 dark:border-emerald-500/20 font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl transition-colors`}><FileText size={12} /> Excel</button>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setMostrarFormulario(true)} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all border border-emerald-500/50"><PlusCircle size={16} /> Registrar Factura</button>
            </div>
          </header>

          {esAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12 animate-in fade-in transition-colors">
              <TarjetaDato titulo="Ingreso Cobrado" valor={`$${metricas.cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} color="emerald" />
              <TarjetaDato titulo="Por Cobrar" valor={`$${metricas.pendiente.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} color="blue" />
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-4xl overflow-hidden shadow-sm dark:shadow-2xl transition-colors">
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-left border-collapse text-[13px] min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[12px] font-semibold uppercase tracking-wider transition-colors">
                    <th className="p-4 pl-8 font-normal w-12 text-center">Pago</th><th className="p-4 font-normal">Folio y Origen</th><th className="p-4 font-normal min-w-[200px]">Cliente Receptor</th><th className="p-4 font-normal min-w-[180px]">Concepto</th><th className="p-4 font-normal w-32">Vencimiento</th><th className="p-4 font-normal w-32">Fecha Pago</th><th className="p-4 font-normal">Monto Total</th><th className="p-4 pr-8 text-right font-normal">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors">
                  {historial.map((item) => {
                    const esCancelada = item.estatus_pago === 'Cancelada';
                    const esVencida = new Date(item.fecha_vencimiento + 'T23:59:59') < new Date() && item.estatus_pago !== 'Pagado' && !esCancelada;
                    const vieneDeViaje = item.viaje_id !== null || item.folio_viaje !== null;
                    const sinTimbrar = !item.folio_fiscal || item.folio_fiscal === '';
                    const clienteCompleto = clientes.find(c => c.nombre === item.cliente) || {};

                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${esCancelada ? 'opacity-40 grayscale' : ''}`}>
                        
                        <td className="p-4 pl-8 align-middle text-center">
                          <button onClick={() => alternarEstatus(item.id, item.estatus_pago)} title={esCancelada ? "Factura Anulada" : "Marcar como Pagado/Pendiente"} disabled={esCancelada} className={`p-2 rounded-lg transition-all ${item.estatus_pago === 'Pagado' ? 'bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-500' : (esCancelada ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400')}`}>
                            {item.estatus_pago === 'Pagado' ? <CheckCircle size={18} /> : (esCancelada ? <X size={18} /> : <Clock size={18} />)}
                          </button>
                        </td>

                        <td className="p-4 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[14px] text-slate-900 dark:text-white font-mono font-medium transition-colors">{item.folio_interno ? `F-${String(item.folio_interno).padStart(4, '0')}` : 'F-S/N'}</span>
                            {vieneDeViaje ? ( <span className="inline-flex px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 uppercase tracking-widest text-[9px] items-center gap-1 mt-0.5 transition-colors"><Truck size={8}/> VIAJE: {item.folio_viaje ? `V-${String(item.folio_viaje).padStart(4, '0')}` : 'V-S/N'}</span> ) : ( <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[9px] items-center gap-1 mt-0.5 transition-colors">Libre</span> )}
                          </div>
                        </td>

                        <td className="p-4 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-900 dark:text-white font-bold truncate max-w-[200px] transition-colors" title={item.cliente}>{item.cliente}</span>
                            <span className="text-slate-500 text-[11px] font-mono flex items-center gap-1 transition-colors">
                              <FileText size={10} className={sinTimbrar ? "text-orange-500" : "text-purple-600 dark:text-purple-500"}/>
                              {sinTimbrar ? 'Borrador sin SAT' : item.folio_fiscal.slice(0,18) + '...'}
                            </span>
                          </div>
                        </td>

                        <td className="p-4 align-middle max-w-[180px]">
                          <span className="text-slate-600 dark:text-slate-300 text-[12px] truncate block transition-colors" title={item.ruta}>{item.ruta || '---'}</span>
                          {item.referencia && ( <span className="text-emerald-600 dark:text-emerald-500/80 text-[10px] uppercase font-bold tracking-widest truncate block mt-1 transition-colors" title={item.referencia}>REF: {item.referencia}</span> )}
                        </td>

                        <td className="p-4 align-middle">
                           {item.estatus_pago === 'Pagado' ? (
                             <span className="text-[10px] font-black text-emerald-500/40 uppercase tracking-widest line-through transition-colors">Saldado</span>
                           ) : esCancelada ? (
                             <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Anulada</span>
                           ) : (
                             <div className="flex flex-col gap-0.5">
                               <span className={`text-[12px] ${esVencida ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-300'} transition-colors`}>{item.fecha_vencimiento?.slice(0, 10) || 'S/V'}</span>
                               {esVencida && <span className="text-[9px] font-black text-red-600 dark:text-red-500 uppercase transition-colors">Vencida</span>}
                             </div>
                           )}
                        </td>

                        <td className="p-4 align-middle">
                          {item.estatus_pago === 'Pagado' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-bold font-mono transition-colors">{item.fecha_pago?.slice(0, 10) || 'S/D'}</span>
                              <span className="text-[9px] font-black text-emerald-500/60 dark:text-emerald-500/70 uppercase tracking-widest flex items-center gap-1 transition-colors"><CalendarCheck size={10} /> Ingresado</span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-slate-300 dark:text-slate-600 font-mono transition-colors">---</span>
                          )}
                        </td>

                        <td className="p-4 align-middle">
                          <span className={`text-[14px] font-mono font-black ${item.estatus_pago === 'Pagado' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'} ${esCancelada ? 'line-through opacity-50' : ''} transition-colors`}>
                            ${Number(item.monto_total).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </span>
                        </td>

                        <td className="p-4 pr-8 align-middle">
                          <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-30 group-hover:opacity-100 transition-opacity">
                            {esCancelada ? (
                              <button onClick={() => generarFacturaPDF(item, clienteCompleto, perfilEmisor)} title="PDF Cancelado" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"><FileText size={16}/></button>
                            ) : sinTimbrar ? (
                              <button onClick={() => timbrarFactura(item)} title="Timbrar Factura" className="px-3 py-1.5 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-200 dark:border-blue-500/20 rounded-lg uppercase tracking-widest text-[10px] flex items-center gap-1.5 transition-colors">
                                {loading ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>} Timbrar
                              </button>
                            ) : (
                              <>
                                <button onClick={() => generarFacturaPDF(item, clienteCompleto, perfilEmisor)} title="Descargar PDF" className="p-2 bg-emerald-50 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors transition-colors"><Receipt size={16}/></button>
                                {item.facturapi_id && ( <button onClick={() => descargarXML(item.facturapi_id, item.cliente, item.folio_interno)} title="Descargar XML" className="p-2 bg-purple-50 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg transition-colors transition-colors"><FileCode size={16}/></button> )}
                              </>
                            )}
                            <button onClick={() => procesarCancelacion(item, item.viaje_id !== null)} title="Borrar/Cancelar" className={`p-2 transition-colors rounded-lg ${item.viaje_id !== null ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed' : 'text-slate-400 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'}`}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-20 text-center transition-colors">
                        <DollarSign size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-3 transition-colors" />
                        <p className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-sm font-black transition-colors">No hay facturas en este periodo</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* MODAL DE CONFIRMACIÓN CUSTOM */}
          {/* ========================================================= */}
          {dialogoConfirmacion.visible && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm transition-colors" onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} />
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 transition-colors">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-6 transition-colors transition-colors transition-colors"><AlertTriangle size={32} /></div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 transition-colors">¿Estás Seguro?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 transition-colors">{dialogoConfirmacion.mensaje}</p>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors transition-colors">Descartar</button>
                  <button onClick={ejecutarConfirmacion} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-red-600 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20 transition-colors">{loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Sí, Proceder"}</button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL DE REGISTRO */}
          {/* ========================================================= */}
          {mostrarFormulario && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm transition-colors" onClick={() => setMostrarFormulario(false)} />
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-[3rem] p-6 sm:p-10 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] transition-colors">
                <button onClick={() => setMostrarFormulario(false)} className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white transition-colors"><X size={24} /></button>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white italic uppercase mb-8 shrink-0 transition-colors">Registrar <span className="text-emerald-600 dark:text-emerald-500">Factura</span></h2>
                
                <form onSubmit={registrarFactura} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <div className="md:col-span-1">
                      <div className="flex justify-between items-center mb-2"><label className="text-[12px] font-black text-slate-500 uppercase tracking-widest ml-1 transition-colors">Cliente Receptor</label></div>
                      <select required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}>
                        <option value="">-- Seleccionar de Catálogo SAT --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.dias_credito} días crédito)</option>)}
                      </select>
                    </div>

                    <div className="md:col-span-1">
                      <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Folio de Viaje (Opcional)</label>
                      <input type="text" placeholder="Ejemplo: V-0015" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" value={formData.folio_viaje_manual} onChange={e => setFormData({...formData, folio_viaje_manual: e.target.value})} />
                    </div>

                    {/* SECCIÓN DE CONCEPTOS DINÁMICOS */}
                    <div className="md:col-span-2 p-4 sm:p-5 border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl transition-colors space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                        <label className="text-[12px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest ml-1 transition-colors">Conceptos a Facturar</label>
                        <button type="button" onClick={agregarConcepto} className="w-full sm:w-auto text-[9px] font-black tracking-widest bg-emerald-600 text-white px-3 py-2 sm:py-1.5 rounded-lg uppercase hover:bg-emerald-500 transition-colors shadow-sm">+ Añadir Concepto</button>
                      </div>

                      {formData.conceptos.map((item, index) => (
                        <div key={index} className="flex flex-col gap-3 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                          <div className="flex flex-col sm:flex-row gap-3 items-center">
                            <input required type="text" placeholder="Ej: Flete, Maniobras..." className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" value={item.descripcion} onChange={e => actualizarConcepto(index, 'descripcion', e.target.value)} />
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                              <select required className="w-32 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-[11px] text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" value={item.clave_sat} onChange={e => actualizarConcepto(index, 'clave_sat', e.target.value)}>
                                <option value="78101802">Flete (78101802)</option>
                                <option value="78121603">Maniobras/Carga (78121603)</option>
                                <option value="78101800">Transporte Gen. (78101800)</option>
                              </select>
                              
                              <input required type="number" step="0.01" placeholder="Costo $" className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-xs text-slate-900 dark:text-white font-mono text-center outline-none focus:border-emerald-500 transition-colors" value={item.monto} onChange={e => actualizarConcepto(index, 'monto', e.target.value)} />
                              
                              <button type="button" onClick={() => eliminarConcepto(index)} disabled={formData.conceptos.length === 1} className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-2 transition-colors"><Trash2 size={16}/></button>
                            </div>
                          </div>
                          
                          {/* Impuestos individuales */}
                          <div className="flex gap-4 px-1 pt-2 sm:pt-0 sm:justify-end border-t border-slate-100 dark:border-slate-800 sm:border-0 mt-1 sm:mt-0">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input type="checkbox" className="w-3.5 h-3.5 accent-emerald-600 rounded bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer" checked={item.aplica_iva} onChange={e => actualizarConcepto(index, 'aplica_iva', e.target.checked)} />
                              <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">+ IVA (16%)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input type="checkbox" className="w-3.5 h-3.5 accent-emerald-600 rounded bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer" checked={item.aplica_retencion} onChange={e => actualizarConcepto(index, 'aplica_retencion', e.target.checked)} />
                              <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">- Ret. (4%)</span>
                            </label>
                          </div>
                        </div>
                      ))}

                      {/* Total Acumulado */}
                      <div className="flex justify-end items-center pt-3 border-t border-emerald-200 dark:border-emerald-800/50 mt-2">
                        <p className="text-[12px] font-black tracking-widest uppercase text-emerald-700 dark:text-emerald-400 transition-colors bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800 shadow-sm">
                          Neto Total a Cobrar: <span className="font-mono text-sm ml-1">${calcularTotalEnTiempoReal().toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                       <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Referencia del Cliente (Opcional)</label>
                       <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors transition-colors" value={formData.referencia} onChange={e => setFormData({...formData, referencia: e.target.value})} />
                    </div>

                  </div>

                  <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl transition-colors">
                    <p className="text-[12px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 transition-colors"><Settings size={12}/> Configuración SAT (CFDI 4.0)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[12px] font-black text-slate-500 uppercase mb-2 block ml-1 transition-colors">Método de Pago</label>
                        <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors" value={formData.metodo_pago} onChange={e => setFormData({...formData, metodo_pago: e.target.value})}><option value="PPD">PPD - Pago en Parcialidades</option><option value="PUE">PUE - Pago en una Exhibición</option></select>
                      </div>
                      <div>
                        <label className="text-[12px] font-black text-slate-500 uppercase mb-2 block ml-1 transition-colors transition-colors">Forma de Pago</label>
                        <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors transition-colors" value={formData.forma_pago} onChange={e => setFormData({...formData, forma_pago: e.target.value})} disabled={formData.metodo_pago === 'PPD'}><option value="99">99 - Por Definir</option><option value="03">03 - Transferencia</option><option value="01">01 - Efectivo</option><option value="02">02 - Cheque</option></select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 transition-colors transition-colors">
                    <div>
                      <label className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors transition-colors">Fecha de Emisión</label>
                      <input type="date" required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors cursor-pointer" value={formData.fecha_viaje} onChange={e => setFormData({...formData, fecha_viaje: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[12px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest mb-2 block ml-1 transition-colors transition-colors transition-colors">Vencimiento Cobro</label>
                      <input type="date" readOnly className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-sm text-slate-500 dark:text-slate-500 outline-none transition-colors cursor-not-allowed" value={formData.fecha_vencimiento} />
                    </div>
                  </div>

                  <button type="submit" disabled={loading || clientes.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white p-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all mt-4 shadow-emerald-900/10">
                    {loading ? "Procesando..." : "Registrar Factura"}
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
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors"><p className="text-emerald-600 dark:text-emerald-500 font-black animate-pulse uppercase tracking-widest">Cargando Módulo Financiero...</p></div>}>
      <FacturasContenido />
    </Suspense>
  );
}