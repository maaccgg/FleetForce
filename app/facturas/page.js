'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  PlusCircle, Trash2, CheckCircle, Clock, X, 
  UserPlus, Edit2, Save, Calendar, ChevronDown, DollarSign 
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';

export default function FacturasPage() {
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarGestionClientes, setMostrarGestionClientes] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  
  const [metricas, setMetricas] = useState({ cobrado: 0, pendiente: 0 });
  const [historial, setHistorial] = useState([]);
  const [clientes, setClientes] = useState([]);

  // --- LÓGICA DE RANGO DE FECHAS ---
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes);

  // Estado Factura
  const [formData, setFormData] = useState({ 
    cliente_id: '', monto_total: '', folio_fiscal: '', 
    ruta: '', fecha_viaje: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '' 
  });

  // Estado Gestión Clientes
  const [clientData, setClientData] = useState({ nombre: '', dias_credito: 30 });
  const [editandoClienteId, setEditandoClienteId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/";
      else {
        setSesion(session);
        obtenerDatos(session.user.id);
        obtenerClientes(session.user.id);
      }
    });
  }, [fechaInicio, fechaFin]); // Se recarga al cambiar el rango

  // Cálculo automático de vencimiento
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

  async function obtenerClientes(userId) {
    const { data } = await supabase.from('clientes').select('*').eq('usuario_id', userId).order('nombre');
    setClientes(data || []);
  }

  async function obtenerDatos(userId) {
    setLoading(true);
    const { data: facturasBD, error } = await supabase
      .from('facturas')
      .select('*')
      .eq('usuario_id', userId)
      .gte('fecha_viaje', fechaInicio) // Filtro desde
      .lte('fecha_viaje', fechaFin)    // Filtro hasta
      .order('fecha_viaje', { ascending: false });

    if (error) console.error("Error cargando facturas:", error.message);

    const cobrado = facturasBD?.filter(f => f.estatus_pago === 'Pagado')
      .reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;
    const pendiente = facturasBD?.filter(f => f.estatus_pago === 'Pendiente')
      .reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;

    setMetricas({ cobrado, pendiente });
    setHistorial(facturasBD || []);
    setLoading(false);
  }

  const guardarOEditarCliente = async (e) => {
    e.preventDefault();
    if (editandoClienteId) {
      await supabase.from('clientes').update(clientData).eq('id', editandoClienteId);
    } else {
      await supabase.from('clientes').insert([{ ...clientData, usuario_id: sesion.user.id }]);
    }
    setEditandoClienteId(null);
    setClientData({ nombre: '', dias_credito: 30 });
    obtenerClientes(sesion.user.id);
  };

  const prepararEdicionCliente = (c) => {
    setEditandoClienteId(c.id);
    setClientData({ nombre: c.nombre, dias_credito: c.dias_credito });
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
        estatus_pago: 'Pendiente',
        usuario_id: sesion.user.id 
      }
    ]);

    if (error) {
      alert("Fallo al guardar: " + error.message);
    } else {
      setFormData({ cliente_id: '', monto_total: '', folio_fiscal: '', ruta: '', fecha_viaje: new Date().toISOString().split('T')[0], fecha_vencimiento: '' });
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

  const eliminarFactura = async (id) => {
    if (!confirm("¿Eliminar registro?")) return;
    await supabase.from('facturas').delete().eq('id', id);
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
                Control de <span className="text-green-600">Ingresos</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-black uppercase mt-1 tracking-widest">Facturación y Cobranza</p>
            </div>

            <div className="flex items-center gap-3">
              {/* SELECTOR DE PERIODO */}
              <div className="relative">
                <button 
                  onClick={() => setMostrarFiltro(!mostrarFiltro)}
                  className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                >
                  <Calendar size={14} className="text-blue-400" />
                  Periodo
                  <ChevronDown size={14} />
                </button>

                {mostrarFiltro && (
                  <div className="absolute right-0 mt-3 w-72 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                    <div className="space-y-4">
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
                      <button onClick={() => setMostrarFiltro(false)} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[9px] font-black uppercase">Aplicar Filtro</button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setMostrarFormulario(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
                <PlusCircle size={14} /> Nueva Factura
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <TarjetaDato titulo="Cobrado en Periodo" valor={`$${metricas.cobrado.toLocaleString()}`} color="green" />
            <TarjetaDato titulo="Por Cobrar en Periodo" valor={`$${metricas.pendiente.toLocaleString()}`} color="blue" />
          </div>

          {/* MODAL FACTURA */}
          {mostrarFormulario && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setMostrarFormulario(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                <button onClick={() => setMostrarFormulario(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Registrar <span className="text-green-500">Ingreso</span></h2>
                
                <form onSubmit={registrarFactura} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente</label>
                        <button type="button" onClick={() => setMostrarGestionClientes(true)} className="text-blue-500 hover:text-blue-400 text-[9px] font-black uppercase flex items-center gap-1">
                          <UserPlus size={10} /> Gestionar Clientes
                        </button>
                      </div>
                      <select required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none focus:border-green-500"
                        value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}>
                        <option value="">-- Seleccionar --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.dias_credito} días)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Monto Total ($)</label>
                      <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white font-mono" 
                        value={formData.monto_total} onChange={e => setFormData({...formData, monto_total: e.target.value})} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Folio Fiscal</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none font-mono" 
                        value={formData.folio_fiscal} onChange={e => setFormData({...formData, folio_fiscal: e.target.value})} placeholder="ID Factura" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block ml-1">Fecha de Viaje</label>
                      <input type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                        value={formData.fecha_viaje} onChange={e => setFormData({...formData, fecha_viaje: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2 block ml-1">Vencimiento Cobro</label>
                      <input type="date" readOnly className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-sm text-slate-400 outline-none" 
                        value={formData.fecha_vencimiento} />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-500 text-white p-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">
                    {loading ? "Sincronizando..." : "Confirmar Factura"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* MODAL GESTIÓN DE CLIENTES */}
          {mostrarGestionClientes && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setMostrarGestionClientes(false)} />
              <div className="relative bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-[3rem] p-10 shadow-3xl flex flex-col max-h-[80vh]">
                <button onClick={() => setMostrarGestionClientes(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-xl font-black text-white italic uppercase mb-6">{editandoClienteId ? 'Editar' : 'Nuevo'} <span className="text-blue-500">Cliente</span></h2>
                
                <form onSubmit={guardarOEditarCliente} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-slate-950 p-6 rounded-3xl border border-slate-800">
                  <div className="md:col-span-1">
                    <input required className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white text-xs" 
                      placeholder="Nombre Cliente" value={clientData.nombre} onChange={e => setClientData({...clientData, nombre: e.target.value})} />
                  </div>
                  <div>
                    <input required type="number" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-white text-xs" 
                      placeholder="Días Crédito" value={clientData.dias_credito} onChange={e => setClientData({...clientData, dias_credito: e.target.value})} />
                  </div>
                  <button className="bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2">
                    {editandoClienteId ? <><Save size={14}/> Guardar</> : <><PlusCircle size={14}/> Agregar</>}
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto space-y-2">
                  <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Catálogo de Clientes</h3>
                  {clientes.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-4 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-slate-600 transition-all">
                      <div>
                        <p className="text-xs font-bold text-white uppercase">{c.nombre}</p>
                        <p className="text-[9px] text-slate-500 font-black">{c.dias_credito} DÍAS DE CRÉDITO</p>
                      </div>
                      <button onClick={() => prepararEdicionCliente(c)} className="p-2 text-slate-500 hover:text-blue-500 transition-colors">
                        <Edit2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TABLA DE REGISTROS */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-4">
                    <th className="pl-4">Status</th>
                    <th>Cliente</th>
                    <th>Viaje</th>
                    <th>Vencimiento</th>
                    <th>Monto</th>
                    <th className="text-right pr-4">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => {
                    const esVencida = new Date(item.fecha_vencimiento + 'T23:59:59') < new Date() && item.estatus_pago !== 'Pagado';
                    return (
                      <tr key={item.id} className="bg-slate-950 border border-slate-800 group hover:border-blue-500/30 transition-all">
                        <td className="py-4 pl-4 rounded-l-2xl border-y border-l border-slate-800">
                          <button onClick={() => alternarEstatus(item.id, item.estatus_pago)}
                            className={`p-2 rounded-lg transition-all ${item.estatus_pago === 'Pagado' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                            {item.estatus_pago === 'Pagado' ? <CheckCircle size={16} /> : <Clock size={16} />}
                          </button>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <h4 className="text-[11px] font-bold text-white uppercase leading-none">{item.cliente}</h4>
                          <p className="text-[9px] text-slate-500 mt-1 uppercase font-mono">{item.folio_fiscal || 'S/F'}</p>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <p className="text-[10px] text-slate-300 font-bold">{item.fecha_viaje || '---'}</p>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          {item.estatus_pago === 'Pagado' ? <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Liquidada</span> :
                          <span className={`text-[10px] font-black ${esVencida ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
                            {item.fecha_vencimiento || 'S/V'} {esVencida ? '(VENCIDA)' : ''}
                          </span>}
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <span className="text-[11px] font-mono font-black text-white">${Number(item.monto_total).toLocaleString()}</span>
                        </td>
                        <td className="py-4 pr-4 rounded-r-2xl border-y border-r border-slate-800 text-right">
                          <button onClick={() => eliminarFactura(item.id)} className="text-slate-800 hover:text-red-500 p-2 transition-colors"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {historial.length === 0 && (
                <div className="text-center py-20">
                   <p className="text-slate-600 text-[10px] font-black uppercase italic tracking-widest">Sin registros en este rango de fechas.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}