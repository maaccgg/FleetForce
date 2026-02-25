'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, User, MapPin, Package, PlusCircle, 
  Trash2, FileText, X, Navigation, Calendar, 
  Download, Info, DollarSign
} from 'lucide-react';
import Sidebar from '@/components/sidebar';

// Importaciones para PDF (Corregidas para evitar errores de función)
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ViajesPage() {
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viajes, setViajes] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // Catálogos
  const [catalogos, setCatalogos] = useState({ 
    unidades: [], operadores: [], ubicaciones: [], mercancias: [] 
  });
  const [clientes, setClientes] = useState([]);
  const [perfilEmisor, setPerfilEmisor] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    unidad_id: '', 
    operador_id: '', 
    origen_id: '', 
    destino_id: '', 
    mercancia_id: '', 
    cantidad_mercancia: 1, 
    fecha_salida: new Date().toISOString().split('T')[0],
    cliente_id: '', // Para factura automática
    monto_flete: ''  // Para factura automática
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSesion(session);
        cargarCatalogos(session.user.id);
        obtenerViajes(session.user.id);
        obtenerPerfilFiscal(session.user.id);
      }
    });
  }, []);

  // --- OBTENCIÓN DE DATOS ---

  async function obtenerPerfilFiscal(userId) {
    const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', userId).single();
    if (data) setPerfilEmisor(data);
  }

  async function cargarCatalogos(userId) {
    const [u, o, ub, m, cl] = await Promise.all([
      supabase.from('unidades').select('id, numero_economico').eq('usuario_id', userId),
      supabase.from('operadores').select('id, nombre_completo').eq('usuario_id', userId),
      supabase.from('ubicaciones').select('id, nombre_lugar, codigo_postal').eq('usuario_id', userId),
      supabase.from('mercancias').select('id, descripcion, peso_unitario_kg').eq('usuario_id', userId),
      supabase.from('clientes').select('id, nombre, dias_credito').eq('usuario_id', userId)
    ]);
    
    setCatalogos({ 
      unidades: u.data || [], 
      operadores: o.data || [], 
      ubicaciones: ub.data || [], 
      mercancias: m.data || [] 
    });
    setClientes(cl.data || []);
  }

  async function obtenerViajes(userId) {
    const { data } = await supabase.from('viajes').select(`
        *,
        unidades(numero_economico),
        operadores(nombre_completo, rfc, numero_licencia),
        origen:ubicaciones!viajes_origen_id_fkey(nombre_lugar, codigo_postal),
        destino:ubicaciones!viajes_destino_id_fkey(nombre_lugar, codigo_postal),
        mercancias(descripcion, clave_sat)
      `).eq('usuario_id', userId).order('created_at', { ascending: false });
    setViajes(data || []);
  }

  // --- GENERACIÓN DE PDF ---

  const generarPDF = (viaje) => {
    const doc = new jsPDF();
    const azul = [37, 99, 235];

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("MANIFIESTO DE CARGA", 14, 22);
    doc.setFontSize(8);
    doc.text(`FOLIO: #000${viaje.folio_interno} | FECHA: ${viaje.fecha_salida}`, 14, 30);

    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EMISOR FISCAL", 14, 50);
    doc.setFont("helvetica", "normal");
    doc.text(perfilEmisor?.razon_social || "EMPRESA NO CONFIGURADA", 14, 56);
    doc.text(`RFC: ${perfilEmisor?.rfc || "---"}`, 14, 61);

    autoTable(doc, {
      startY: 70,
      head: [['ORIGEN', 'DESTINO', 'OPERADOR', 'UNIDAD']],
      body: [[
        viaje.origen?.nombre_lugar, 
        viaje.destino?.nombre_lugar, 
        viaje.operadores?.nombre_completo, 
        viaje.unidades?.numero_economico
      ]],
      theme: 'grid',
      headStyles: { fillColor: azul }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['CANTIDAD', 'DESCRIPCIÓN', 'CLAVE SAT', 'PESO TOTAL']],
      body: [[
        viaje.cantidad_mercancia,
        viaje.mercancias?.descripcion,
        viaje.mercancias?.clave_sat,
        `${viaje.peso_total_kg} KG`
      ]],
      theme: 'striped',
      headStyles: { fillColor: [51, 51, 51] }
    });

    doc.save(`Manifiesto_#${viaje.folio_interno}.pdf`);
  };

  // --- LÓGICA DE REGISTRO INTEGRADO ---
  const registrarViaje = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const m = catalogos.mercancias.find(x => x.id === formData.mercancia_id);
      const clienteObj = clientes.find(c => c.id === formData.cliente_id);
      const pesoCalc = m ? m.peso_unitario_kg * formData.cantidad_mercancia : 0;

      // 1. Crear el Viaje
      const { data: nuevoViaje, error: errViaje } = await supabase.from('viajes').insert([{
        unidad_id: formData.unidad_id,
        operador_id: formData.operador_id,
        origen_id: formData.origen_id,
        destino_id: formData.destino_id,
        mercancia_id: formData.mercancia_id,
        cantidad_mercancia: parseFloat(formData.cantidad_mercancia),
        peso_total_kg: pesoCalc,
        fecha_salida: formData.fecha_salida,
        usuario_id: sesion.user.id,
        estatus: 'Borrador'
      }]).select().single();

      if (errViaje) throw errViaje;

      // 2. Crear Factura Automática (Si se ingresó monto)
      if (formData.monto_flete > 0 && formData.cliente_id) {
        const fechaVenc = new Date(formData.fecha_salida);
        fechaVenc.setDate(fechaVenc.getDate() + (clienteObj?.dias_credito || 0));

        await supabase.from('facturas').insert([{
          usuario_id: sesion.user.id,
          viaje_id: nuevoViaje.id,
          cliente: clienteObj.nombre,
          monto_total: parseFloat(formData.monto_flete),
          fecha_viaje: formData.fecha_salida,
          fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
          estatus_pago: 'Pendiente',
          ruta: `${nuevoViaje.id}` // Referencia cruzada
        }]);
      }

      setMostrarModal(false);
      setFormData({ unidad_id: '', operador_id: '', origen_id: '', destino_id: '', mercancia_id: '', cantidad_mercancia: 1, fecha_salida: new Date().toISOString().split('T')[0], cliente_id: '', monto_flete: '' });
      await obtenerViajes(sesion.user.id);
      alert("Viaje y Factura consolidados exitosamente.");

    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarViaje = async (id) => {
    if (!confirm("¿Deseas eliminar este viaje?")) return;
    await supabase.from('viajes').delete().eq('id', id);
    obtenerViajes(sesion.user.id);
  };

  if (!sesion) return null;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-10 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">
                Logística <span className="text-blue-500">Operativa</span>
              </h1>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-2">Bitácora de Manifiestos</p>
            </div>
            <button onClick={() => setMostrarModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
              <PlusCircle size={16} /> Programar Viaje
            </button>
          </header>

          <div className="grid grid-cols-1 gap-4">
            {viajes.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-[2.5rem]">
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Sin registros activos</p>
              </div>
            ) : (
              viajes.map((v) => (
                <div key={v.id} className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] hover:border-blue-500/30 transition-all group backdrop-blur-sm">
                  <div className="flex items-center gap-8">
                    <div className="min-w-[100px]">
                      <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Folio</p>
                      <h4 className="text-xl font-black text-white font-mono leading-none">#{String(v.folio_interno).padStart(4, '0')}</h4>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[11px] font-black text-white uppercase italic">{v.origen?.nombre_lugar}</span>
                        <Navigation size={12} className="text-blue-500 rotate-90" />
                        <span className="text-[11px] font-black text-white uppercase italic">{v.destino?.nombre_lugar}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">{v.unidades?.numero_economico} | {v.operadores?.nombre_completo}</p>
                    </div>
                    <div className="flex gap-2 ml-auto opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => generarPDF(v)} className="p-3 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-colors"><FileText size={18}/></button>
                      <button onClick={() => eliminarViaje(v.id)} className="p-3 bg-slate-950 text-slate-600 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={18}/></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* MODAL AJUSTADO (MAX-W-3XL) */}
          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setMostrarModal(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
                <button onClick={() => setMostrarModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8 text-center lg:text-left tracking-tighter">Programar <span className="text-blue-500">Operación</span></h2>
                
                <form onSubmit={registrarViaje} className="space-y-6">
                  {/* Bloque Logístico */}
                  <div className="grid grid-cols-2 gap-4">
                    <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.unidad_id} onChange={e => setFormData({...formData, unidad_id: e.target.value})}>
                      <option value="">Unidad...</option>
                      {catalogos.unidades.map(u => <option key={u.id} value={u.id}>{u.numero_economico}</option>)}
                    </select>
                    <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.operador_id} onChange={e => setFormData({...formData, operador_id: e.target.value})}>
                      <option value="">Operador...</option>
                      {catalogos.operadores.map(o => <option key={o.id} value={o.id}>{o.nombre_completo}</option>)}
                    </select>
                    <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.origen_id} onChange={e => setFormData({...formData, origen_id: e.target.value})}>
                      <option value="">Punto A (Origen)...</option>
                      {catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}
                    </select>
                    <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.destino_id} onChange={e => setFormData({...formData, destino_id: e.target.value})}>
                      <option value="">Punto B (Destino)...</option>
                      {catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}
                    </select>
                  </div>

                  {/* Bloque Carga */}
                  <div className="grid grid-cols-3 gap-4">
                    <select required className="col-span-2 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.mercancia_id} onChange={e => setFormData({...formData, mercancia_id: e.target.value})}>
                      <option value="">Bienes / Mercancía...</option>
                      {catalogos.mercancias.map(m => <option key={m.id} value={m.id}>{m.descripcion}</option>)}
                    </select>
                    <input required type="number" placeholder="Cant." className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.cantidad_mercancia} onChange={e => setFormData({...formData, cantidad_mercancia: e.target.value})} />
                  </div>

                  {/* Bloque Cobranza (Nuevo) */}
                  <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl space-y-4">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                      <DollarSign size={12} /> Facturación Automática
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                        value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value})}>
                        <option value="">Cliente flete...</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <input required type="number" placeholder="Monto flete $" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-mono"
                        value={formData.monto_flete} onChange={e => setFormData({...formData, monto_flete: e.target.value})} />
                    </div>
                  </div>

                  <input type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                    value={formData.fecha_salida} onChange={e => setFormData({...formData, fecha_salida: e.target.value})} />

                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-blue-500 transition-all">
                    {loading ? "Sincronizando..." : "Consolidar Viaje y Factura"}
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