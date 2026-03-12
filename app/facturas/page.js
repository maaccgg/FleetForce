'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  PlusCircle, Trash2, CheckCircle, Clock, X, 
  Calendar, ChevronDown, DollarSign, Truck, FileText, ShieldCheck, Settings, FileCode
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';
import { generarFacturaPDF } from '@/utils/PdfFactura'; // IMPORTAMOS LA NUEVA FUNCIÓN

function FacturasContenido() {
  const searchParams = useSearchParams();
  const viajeIdHighlight = searchParams.get('viaje_id');

  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  
  const [metricas, setMetricas] = useState({ cobrado: 0, pendiente: 0 });
  const [historial, setHistorial] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [perfilEmisor, setPerfilEmisor] = useState(null);

  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes);

  const [formData, setFormData] = useState({ 
    cliente_id: '', monto_total: '', folio_fiscal: '', 
    ruta: 'Flete / Servicio de Transporte', fecha_viaje: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '', forma_pago: '99', metodo_pago: 'PPD'
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/";
      else {
        setSesion(session);
        obtenerDatos(session.user.id);
        obtenerClientes(session.user.id);
        obtenerPerfilEmisor(session.user.id);
      }
    });
  }, [fechaInicio, fechaFin, viajeIdHighlight]);

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

  async function obtenerPerfilEmisor(userId) {
    const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', userId).single();
    if (data) setPerfilEmisor(data);
  }

  async function obtenerClientes(userId) {
    const { data } = await supabase.from('clientes').select('*').eq('usuario_id', userId).order('nombre');
    setClientes(data || []);
  }

  async function obtenerDatos(userId) {
    setLoading(true);
    let query = supabase
      .from('facturas')
      .select('*') 
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false });

    if (viajeIdHighlight) {
       query = query.eq('viaje_id', viajeIdHighlight);
    } else {
       query = query.gte('fecha_viaje', fechaInicio).lte('fecha_viaje', fechaFin);
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
    const facturapiKey = "sk_test_sBNjdoZ5A1UcJVmQ2KUisCQBpiD8MPFecYABBhRYci"; 
    
    try {
      const response = await fetch(`https://www.facturapi.io/v2/invoices/${facturapi_id}/xml`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${facturapiKey}` }
      });

      if (!response.ok) throw new Error("No se pudo obtener el XML del SAT");

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

    const facturapiKey = "sk_test_sBNjdoZ5A1UcJVmQ2KUisCQBpiD8MPFecYABBhRYci"; 
    const apiUrl = 'https://www.facturapi.io/v2/invoices';

    const totalInput = Number(factura.monto_total);
    const subtotal = Number((totalInput / 1.16).toFixed(2));

    const invoiceData = {
      customer: {
        legal_name: clienteData.nombre,
        tax_id: clienteData.rfc,
        tax_system: clienteData.regimen_fiscal || "601",
        address: { zip: clienteData.codigo_postal }
      },
      items: [{
        quantity: 1,
        product: {
          description: factura.ruta || "Servicio de flete nacional",
          product_key: "78101802", 
          price: subtotal,
          taxes: [
            { type: "IVA", rate: 0.16 },
            { type: "IVA", rate: 0.04, withholding: true } 
          ]
        }
      }],
      payment_form: factura.forma_pago || "99",
      payment_method: factura.metodo_pago || "PPD",
      use: clienteData.uso_cfdi || "G03"
    };

    setLoading(true);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${facturapiKey}` },
        body: JSON.stringify(invoiceData)
      });

      const res = await response.json();

      if (response.ok) {
        const uuidReal = res.uuid;
        const selloEmisor = res.stamp?.signature || "SELLO_NO_ENCONTRADO";
        const selloSat = res.stamp?.sat_signature || "SELLO_SAT_NO_ENCONTRADO";
        const cadenaOriginal = res.stamp?.complement_string || "CADENA_NO_ENCONTRADA";
        
        const { error: supabaseError } = await supabase
          .from('facturas')
          .update({ 
            folio_fiscal: uuidReal,
            sello_emisor: selloEmisor,
            sello_sat: selloSat,
            cadena_original: cadenaOriginal,
            facturapi_id: res.id 
          })
          .eq('id', factura.id);

        if (supabaseError) throw supabaseError;
        
        alert(`🎉 ¡FACTURA TIMBRADA CON ÉXITO!\n\nUUID: ${uuidReal}`);
        obtenerDatos(sesion.user.id);
      } else {
        alert(`❌ Error del SAT:\n${res.message || "Error desconocido"}`);
      }
    } catch (err) {
      alert("Error de red:\n" + err.message);
    } finally {
      setLoading(false);
    }
  };

  const registrarFactura = async (e) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.monto_total) return;
    setLoading(true);

    const clienteSeleccionado = clientes.find(c => c.id === formData.cliente_id);

    const { error } = await supabase.from('facturas').insert([
      { 
        cliente: clienteSeleccionado.nombre,
        monto_total: parseFloat(formData.monto_total), 
        folio_fiscal: formData.folio_fiscal,
        ruta: formData.ruta,
        fecha_viaje: formData.fecha_viaje,
        fecha_vencimiento: formData.fecha_vencimiento,
        forma_pago: formData.forma_pago,
        metodo_pago: formData.metodo_pago,
        estatus_pago: 'Pendiente',
        usuario_id: sesion.user.id 
      }
    ]);

    if (error) {
      alert("Fallo al guardar: " + error.message);
    } else {
      setFormData({ cliente_id: '', monto_total: '', folio_fiscal: '', ruta: 'Flete / Servicio de Transporte', fecha_viaje: new Date().toISOString().split('T')[0], fecha_vencimiento: '', forma_pago: '99', metodo_pago: 'PPD' });
      setMostrarFormulario(false);
      obtenerDatos(sesion.user.id);
    }
    setLoading(false);
  };

  const alternarEstatus = async (id, estatusActual) => {
    const nuevoEstatus = estatusActual === 'Pendiente' ? 'Pagado' : 'Pendiente';
    await supabase.from('facturas').update({ estatus_pago: nuevoEstatus }).eq('id', id);
    obtenerDatos(sesion.user.id);
  };

  const eliminarFactura = async (id, tieneViajeAsociado) => {
    if (tieneViajeAsociado) {
       alert("No puedes borrar esta factura desde aquí porque está asociada a un Viaje. Debes borrar el Viaje desde la pestaña de viajes");
       return;
    }
    if (!confirm("¿Eliminar registro manual?")) return;
    await supabase.from('facturas').delete().eq('id', id);
    obtenerDatos(sesion.user.id);
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
                Control de <span className="text-green-600">Ingresos</span>
              </h1>
              {viajeIdHighlight ? (
                 <p className="text-blue-500 text-[10px] font-black uppercase mt-1 tracking-widest flex items-center gap-1">
                   <Truck size={12}/> Mostrando factura del viaje seleccionado
                 </p>
              ) : (
                 <p className="text-slate-500 text-[10px] font-black uppercase mt-1 tracking-widest">Facturación y Cobranza</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setMostrarFiltro(!mostrarFiltro)}
                  className={`flex items-center gap-3 bg-slate-900 border ${viajeIdHighlight ? 'border-orange-500/50 text-orange-400' : 'border-slate-800 text-slate-400'} px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all`}
                >
                  <Calendar size={14} className={viajeIdHighlight ? 'text-orange-500' : 'text-blue-400'} />
                  {viajeIdHighlight ? 'Limpiar Filtro URL' : 'Periodo'}
                  <ChevronDown size={14} />
                </button>

                {mostrarFiltro && (
                  <div className="absolute right-0 mt-3 w-72 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                    <div className="space-y-4">
                      {viajeIdHighlight && (
                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-4">
                           <p className="text-[9px] text-orange-400 font-bold uppercase text-center">Estás viendo una factura específica. Aplica el filtro para ver todo el mes.</p>
                        </div>
                      )}
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Desde (Fecha Viaje)</label>
                        <input type="date" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" 
                          value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Hasta (Fecha Viaje)</label>
                        <input type="date" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" 
                          value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                      </div>
                      <button onClick={() => {
                        setMostrarFiltro(false);
                        if(viajeIdHighlight) window.location.href = '/facturas'; 
                      }} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[9px] font-black uppercase">
                        Aplicar Filtro Mensual
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setMostrarFormulario(true)} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
                <PlusCircle size={14} /> Ingreso Manual
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <TarjetaDato titulo="Cobrado en Vista" valor={`$${metricas.cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} color="green" />
            <TarjetaDato titulo="Por Cobrar en Vista" valor={`$${metricas.pendiente.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} color="blue" />
          </div>

          {mostrarFormulario && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setMostrarFormulario(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                <button onClick={() => setMostrarFormulario(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Registrar <span className="text-green-500">Ingreso Manual</span></h2>
                
                <form onSubmit={registrarFactura} className="space-y-6">
                  {/* SECCIÓN 1: DATOS BÁSICOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente Receptor</label>
                      </div>
                      <select required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none focus:border-green-500"
                        value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}>
                        <option value="">-- Seleccionar de Catálogo SAT --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.dias_credito} días crédito)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Monto Total con IVA ($)</label>
                      <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white font-mono" 
                        value={formData.monto_total} onChange={e => setFormData({...formData, monto_total: e.target.value})} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Concepto / Referencia</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none" 
                        value={formData.ruta} onChange={e => setFormData({...formData, ruta: e.target.value})} placeholder="Ej. Flete Extra" />
                    </div>
                  </div>

                  {/* SECCIÓN 2: OPCIONES FISCALES */}
                  <div className="p-6 bg-blue-900/10 border border-blue-500/20 rounded-2xl">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Settings size={12}/> Configuración SAT (CFDI 4.0)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-1">Método de Pago</label>
                        <select className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white font-bold"
                          value={formData.metodo_pago} onChange={e => setFormData({...formData, metodo_pago: e.target.value})}>
                          <option value="PPD">PPD - Pago en Parcialidades o Diferido</option>
                          <option value="PUE">PUE - Pago en una Sola Exhibición</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-1">Forma de Pago</label>
                        <select className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white font-bold"
                          value={formData.forma_pago} onChange={e => setFormData({...formData, forma_pago: e.target.value})} disabled={formData.metodo_pago === 'PPD'}>
                          <option value="99">99 - Por Definir (Obligatorio en PPD)</option>
                          <option value="03">03 - Transferencia Electrónica</option>
                          <option value="01">01 - Efectivo</option>
                          <option value="02">02 - Cheque Nominativo</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 3: FECHAS */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block ml-1">Fecha de Servicio</label>
                      <input type="date" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                        value={formData.fecha_viaje} onChange={e => setFormData({...formData, fecha_viaje: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2 block ml-1">Vencimiento Cobro</label>
                      <input type="date" readOnly className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-sm text-slate-400 outline-none" 
                        value={formData.fecha_vencimiento} />
                    </div>
                  </div>

                  <button type="submit" disabled={loading || clientes.length === 0} className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all mt-4">
                    {loading ? "Sincronizando..." : "Confirmar Factura Libre"}
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-4">
                    <th className="pl-4">Cobro</th>
                    <th>Receptor</th>
                    <th>Concepto / Ruta</th>
                    <th>Vencimiento</th>
                    <th>Monto Total</th>
                    <th className="text-right pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => {
                    const esVencida = new Date(item.fecha_vencimiento + 'T23:59:59') < new Date() && item.estatus_pago !== 'Pagado';
                    const vieneDeViaje = item.viaje_id !== null;
                    const sinTimbrar = !item.folio_fiscal || item.folio_fiscal === '';
                    
                    // Buscamos la info completa del cliente para el PDF
                    const clienteCompleto = clientes.find(c => c.nombre === item.cliente) || {};

                    return (
                      <tr key={item.id} className="bg-slate-950 border border-slate-800 group hover:border-blue-500/30 transition-all">
                        <td className="py-4 pl-4 rounded-l-2xl border-y border-l border-slate-800">
                          <button onClick={() => alternarEstatus(item.id, item.estatus_pago)}
                            title="Marcar como Pagado/Pendiente"
                            className={`p-2 rounded-lg transition-all ${item.estatus_pago === 'Pagado' ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                            {item.estatus_pago === 'Pagado' ? <CheckCircle size={16} /> : <Clock size={16} />}
                          </button>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <h4 className="text-[11px] font-bold text-white uppercase leading-none">{item.cliente}</h4>
                          <p className="text-[9px] text-slate-500 mt-1 uppercase font-mono flex items-center gap-1">
                            <FileText size={10} className={sinTimbrar ? "text-orange-500" : "text-purple-500"}/>
                            {sinTimbrar ? 'BORRADOR' : item.folio_fiscal.slice(0,18) + '...'}
                          </p>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <p className={`text-[10px] font-bold uppercase flex items-center gap-2 ${vieneDeViaje ? 'text-blue-400' : 'text-slate-400'}`}>
                            {vieneDeViaje ? <Truck size={12}/> : <DollarSign size={12}/>}
                            {item.ruta || '---'}
                          </p>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          {item.estatus_pago === 'Pagado' ? <span className="text-[9px] font-black text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-1 rounded-md">Liquidada</span> :
                          <span className={`text-[10px] font-black bg-slate-900 px-2 py-1 rounded-md ${esVencida ? 'text-red-500 border border-red-500/30' : 'text-orange-500 border border-orange-500/30'}`}>
                            {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString() : 'S/V'} {esVencida ? '(VENCIDA)' : ''}
                          </span>}
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <span className={`text-[11px] font-mono font-black ${item.estatus_pago === 'Pagado' ? 'text-green-400' : 'text-white'}`}>
                            ${Number(item.monto_total).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </span>
                        </td>
                        
                        <td className="py-4 pr-4 rounded-r-2xl border-y border-r border-slate-800 text-right flex justify-end gap-2">
                          
                          {sinTimbrar ? (
                            <button onClick={() => timbrarFactura(item)} 
                              title="Timbrar Factura ante el SAT"
                              className="p-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                              <ShieldCheck size={14}/>
                            </button>
                          ) : (
                            <>
                              {/* AQUÍ LLAMAMOS A LA NUEVA FUNCIÓN EXTERNA */}
                              <button onClick={() => generarFacturaPDF(item, clienteCompleto, perfilEmisor)} 
                                title="Descargar PDF"
                                className="p-2 bg-purple-900/20 text-purple-400 hover:bg-purple-600 hover:text-white border border-purple-500/20 rounded-lg transition-colors">
                                <FileText size={14}/>
                              </button>

                              {item.facturapi_id && (
                                <button onClick={() => descargarXML(item.facturapi_id, item.cliente)} 
                                  title="Descargar XML"
                                  className="p-2 bg-purple-900/20 text-purple-400 hover:bg-purple-600 hover:text-white border border-purple-500/20 rounded-lg transition-colors">
                                  <FileCode size={14}/>
                                </button>
                              )}
                            </>
                          )}

                          <button onClick={() => eliminarFactura(item.id, vieneDeViaje)} 
                            title={vieneDeViaje ? "Las facturas de viaje se borran desde la Bitácora" : "Eliminar ingreso manual"}
                            className={`p-2 transition-colors rounded-lg ${vieneDeViaje ? 'text-slate-700 cursor-not-allowed' : 'text-slate-600 hover:text-red-500 hover:bg-red-500/10'}`}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {historial.length === 0 && (
                <div className="text-center py-20 bg-slate-950/50 rounded-2xl border border-slate-800 mt-4">
                   <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No hay facturas o ingresos en esta vista.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function FacturasPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-blue-500">Cargando Módulo Financiero...</p></div>}>
      <FacturasContenido />
    </Suspense>
  );
}