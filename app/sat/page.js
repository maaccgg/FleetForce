'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, ShieldCheck, MapPin, PlusCircle, 
  Trash2, Edit2, X, Save, Building2, Package, Truck, Users
} from 'lucide-react';
import Sidebar from '@/components/sidebar';

export default function SATConfigPage() {
  const [sesion, setSesion] = useState(null);
  const [activeTab, setActiveTab] = useState('operadores');
  const [loading, setLoading] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // ESTADOS DE DATOS
  const [operadores, setOperadores] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [mercancias, setMercancias] = useState([]);
  const [remolques, setRemolques] = useState([]);
  const [clientes, setClientes] = useState([]); 
  const [perfilFiscal, setPerfilFiscal] = useState({ razon_social: '', rfc: '', regimen_fiscal: '601', codigo_postal: '' });

  // FORMULARIOS
  const [formDataOp, setFormDataOp] = useState({ nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '' });
  const [formDataUb, setFormDataUb] = useState({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', direccion: '' });
  const [formDataMe, setFormDataMe] = useState({ descripcion: '', clave_sat: '', clave_unidad: 'KGM', peso_unitario_kg: '' });
  const [formDataRe, setFormDataRe] = useState({ numero_economico: '', placas: '', subtipo_remolque: 'CTR007' });
  const [formDataCl, setFormDataCl] = useState({ nombre: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', dias_credito: 0, uso_cfdi: 'G03' });

  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSesion(session);
        cargarDatos(session.user.id);
      }
    });
  }, [activeTab]);

  async function cargarDatos(userId) {
    setLoading(true);
    try {
      if (activeTab === 'fiscal') {
        const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', userId).single();
        if (data) setPerfilFiscal(data);
      } else {
        const { data, error } = await supabase.from(activeTab).select('*').eq('usuario_id', userId).order('created_at');
        if (error) throw error;
        
        if (activeTab === 'operadores') setOperadores(data || []);
        if (activeTab === 'ubicaciones') setUbicaciones(data || []);
        if (activeTab === 'mercancias') setMercancias(data || []);
        if (activeTab === 'remolques') setRemolques(data || []);
        if (activeTab === 'clientes') setClientes(data || []);
      }
    } catch (err) {
      console.error("Error al cargar datos:", err.message);
    }
    setLoading(false);
  }

  const guardarRegistro = async (e) => {
    e.preventDefault();
    setLoading(true);
    let payload = {};

    if (activeTab === 'operadores') payload = { ...formDataOp, usuario_id: sesion.user.id, rfc: formDataOp.rfc.toUpperCase() };
    if (activeTab === 'ubicaciones') payload = { ...formDataUb, usuario_id: sesion.user.id, rfc_ubicacion: formDataUb.rfc_ubicacion.toUpperCase() };
    if (activeTab === 'mercancias') payload = { ...formDataMe, usuario_id: sesion.user.id };
    if (activeTab === 'remolques') payload = { ...formDataRe, usuario_id: sesion.user.id, placas: formDataRe.placas.toUpperCase() };
    if (activeTab === 'clientes') payload = { ...formDataCl, usuario_id: sesion.user.id, rfc: formDataCl.rfc.toUpperCase() };

    const { error } = editandoId 
      ? await supabase.from(activeTab).update(payload).eq('id', editandoId)
      : await supabase.from(activeTab).insert([payload]);

    if (error) {
      alert("Error al guardar: " + error.message + " (Asegúrate de haber ejecutado el SQL en Supabase)");
    } else {
      cerrarModal();
      cargarDatos(sesion.user.id);
    }
    setLoading(false);
  };

  const guardarPerfilFiscal = async () => {
    setLoading(true);
    const { error } = await supabase.from('perfil_emisor').upsert({
      ...perfilFiscal,
      usuario_id: sesion.user.id,
      rfc: perfilFiscal.rfc.toUpperCase(),
      updated_at: new Date()
    });
    if (error) alert(error.message);
    else alert("Configuración Fiscal Guardada");
    setLoading(false);
  };

  const eliminarRegistro = async (id) => {
    if (!confirm("¿Deseas eliminar este registro definitivamente?")) return;
    const { error } = await supabase.from(activeTab).delete().eq('id', id);
    if (error) alert(error.message);
    else cargarDatos(sesion.user.id);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setEditandoId(null);
    setFormDataOp({ nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '' });
    setFormDataUb({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', direccion: '' });
    setFormDataMe({ descripcion: '', clave_sat: '', clave_unidad: 'KGM', peso_unitario_kg: '' });
    setFormDataRe({ numero_economico: '', placas: '', subtipo_remolque: 'CTR007' });
    setFormDataCl({ nombre: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', dias_credito: 0 });
  };

  // PREPARADORES DE EDICIÓN (Solución al error "uncontrolled input")
const editarCliente = (cl) => {
    setEditandoId(cl.id);
    setFormDataCl({
      nombre: cl.nombre || '',
      rfc: cl.rfc || '',
      regimen_fiscal: cl.regimen_fiscal || '601',
      codigo_postal: cl.codigo_postal || '',
      dias_credito: cl.dias_credito || 0,
      uso_cfdi: cl.uso_cfdi || 'G03' // <--- NUEVO
    });
    setMostrarModal(true);
  };


  const editarOperador = (op) => {
    setEditandoId(op.id);
    setFormDataOp({
      nombre_completo: op.nombre_completo || '', rfc: op.rfc || '', 
      numero_licencia: op.numero_licencia || '', vencimiento_licencia: op.vencimiento_licencia || '', telefono: op.telefono || ''
    });
    setMostrarModal(true);
  };

  const editarRemolque = (r) => {
    setEditandoId(r.id);
    setFormDataRe({ numero_economico: r.numero_economico || '', placas: r.placas || '', subtipo_remolque: r.subtipo_remolque || 'CTR007' });
    setMostrarModal(true);
  };

  const editarUbicacion = (ub) => {
    setEditandoId(ub.id);
    setFormDataUb({
      nombre_lugar: ub.nombre_lugar || '', rfc_ubicacion: ub.rfc_ubicacion || '', 
      codigo_postal: ub.codigo_postal || '', estado: ub.estado || '', municipio: ub.municipio || '', direccion: ub.direccion || ''
    });
    setMostrarModal(true);
  };

  const editarMercancia = (me) => {
    setEditandoId(me.id);
    setFormDataMe({ descripcion: me.descripcion || '', clave_sat: me.clave_sat || '', clave_unidad: me.clave_unidad || 'KGM', peso_unitario_kg: me.peso_unitario_kg || '' });
    setMostrarModal(true);
  };

  if (!sesion) return null;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-10">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">
              Cumplimiento <span className="text-blue-500">SAT</span>
            </h1>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-2">Configuración Carta Porte 3.1</p>
          </header>

          <div className="flex flex-wrap gap-2 mb-10 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 w-fit backdrop-blur-md">
            {[
              { id: 'operadores', label: 'Operadores', icon: User },
              { id: 'remolques', label: 'Remolques', icon: Truck },
              { id: 'ubicaciones', label: 'Ubicaciones', icon: MapPin },
              { id: 'mercancias', label: 'Mercancías', icon: Package },
              { id: 'clientes', label: 'Receptor (Clientes)', icon: Users },
              { id: 'fiscal', label: 'Emisor Fiscal', icon: ShieldCheck },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'
                }`}>
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== 'fiscal' ? (
            <div className="animate-in fade-in duration-500">
              <div className="flex justify-between items-center mb-8 px-2">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Gestión de {activeTab}</h3>
                <button onClick={() => setMostrarModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20">
                  <PlusCircle size={14} /> Registrar {activeTab.slice(0,-1)}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* LISTADO DE CLIENTES */}
                {activeTab === 'clientes' && clientes.map(cl => (
                  <div key={cl.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><Users size={20} /></div>
                        <div>
                          <h4 className="text-white font-black uppercase text-xs italic truncate max-w-[150px]">{cl.nombre}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{cl.rfc || 'SIN RFC'}</p>
                          <p className="text-[9px] text-slate-600 font-bold mt-1">CP: {cl.codigo_postal || '---'} | Reg: {cl.regimen_fiscal}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => editarCliente(cl)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button>
                        <button onClick={() => eliminarRegistro(cl.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* LISTADO DE OPERADORES */}
                {activeTab === 'operadores' && operadores.map(op => (
                  <div key={op.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><User size={20} /></div>
                        <div>
                          <h4 className="text-white font-black uppercase text-xs italic">{op.nombre_completo}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{op.rfc}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => editarOperador(op)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button>
                        <button onClick={() => eliminarRegistro(op.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* LISTADO DE REMOLQUES */}
                {activeTab === 'remolques' && remolques.map(r => (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><Truck size={20} /></div>
                        <div>
                          <h4 className="text-white font-black uppercase text-xs italic">{r.numero_economico}</h4>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">Placas: {r.placas}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => editarRemolque(r)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button>
                        <button onClick={() => eliminarRegistro(r.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* LISTADO DE UBICACIONES */}
                {activeTab === 'ubicaciones' && ubicaciones.map(ub => (
                  <div key={ub.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><MapPin size={20} /></div>
                        <div>
                          <h4 className="text-white font-black uppercase text-xs italic">{ub.nombre_lugar}</h4>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">CP: {ub.codigo_postal}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => editarUbicacion(ub)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button>
                        <button onClick={() => eliminarRegistro(ub.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* LISTADO DE MERCANCÍAS */}
                {activeTab === 'mercancias' && mercancias.map(me => (
                  <div key={me.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><Package size={20} /></div>
                        <div>
                          <h4 className="text-white font-black uppercase text-xs italic">{me.descripcion}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">SAT: {me.clave_sat}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => editarMercancia(me)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button>
                        <button onClick={() => eliminarRegistro(me.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // PESTAÑA EMISOR FISCAL
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] max-w-2xl animate-in fade-in slide-in-from-bottom-2">
              <Building2 className="text-blue-500 mb-6" size={40} />
              <h3 className="text-xl font-black text-white italic uppercase mb-2">Perfil del <span className="text-blue-500">Transportista</span></h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-10">Datos de Facturación Configurados</p>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="col-span-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">Razón Social</label>
                  <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none focus:border-blue-500" 
                    value={perfilFiscal.razon_social} onChange={e => setPerfilFiscal({...perfilFiscal, razon_social: e.target.value})} />
                </div>
                <div><label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">RFC</label>
                  <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white uppercase font-mono" 
                    value={perfilFiscal.rfc} onChange={e => setPerfilFiscal({...perfilFiscal, rfc: e.target.value})} /></div>
                <div><label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">CP Fiscal</label>
                  <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                    value={perfilFiscal.codigo_postal} onChange={e => setPerfilFiscal({...perfilFiscal, codigo_postal: e.target.value})} /></div>
              </div>
              <button onClick={guardarPerfilFiscal} disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex justify-center items-center gap-2 transition-all hover:bg-blue-500">
                <Save size={16}/> {loading ? "Sincronizando..." : "Actualizar Datos Maestros"}
              </button>
            </div>
            

          )}

          {/* MODAL MAESTRO */}
          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={cerrarModal} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
                <button onClick={cerrarModal} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Registrar <span className="text-blue-500">{activeTab.slice(0,-1)}</span></h2>
                
                <form onSubmit={guardarRegistro} className="space-y-6">
                  
{/* FORMULARIO CLIENTES / RECEPTORES */}
{activeTab === 'clientes' && (
  <div className="grid grid-cols-2 gap-4">
    <div className="col-span-2">
      <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Razón Social del Cliente</label>
      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formDataCl.nombre} onChange={e => setFormDataCl({...formDataCl, nombre: e.target.value})} />
    </div>
    <div>
      <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC</label>
      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase font-mono" value={formDataCl.rfc} onChange={e => setFormDataCl({...formDataCl, rfc: e.target.value})} />
    </div>
    <div>
      <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">CP Fiscal</label>
      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataCl.codigo_postal} onChange={e => setFormDataCl({...formDataCl, codigo_postal: e.target.value})} />
    </div>
    
    <div className="col-span-2">
      <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Régimen Fiscal</label>
      <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formDataCl.regimen_fiscal} onChange={e => setFormDataCl({...formDataCl, regimen_fiscal: e.target.value})}>
        <option value="601">601 - General de Ley Personas Morales</option>
        <option value="612">612 - Personas Físicas con Actividad Empresarial</option>
        <option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option>
      </select>
    </div>

    {/* AQUÍ ES EL LUGAR CORRECTO PARA EL USO DE CFDI */}
    <div className="col-span-2">
      <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Uso de CFDI (Default para este cliente)</label>
      <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" 
        value={formDataCl.uso_cfdi} onChange={e => setFormDataCl({...formDataCl, uso_cfdi: e.target.value})}>
        <option value="G03">G03 - Gastos en general</option>
        <option value="G01">G01 - Adquisición de mercancías</option>
        <option value="I04">I04 - Equipo de computo y accesorios</option>
        <option value="S01">S01 - Sin efectos fiscales</option>
      </select>
    </div>

  </div>
)}

                  {/* FORMULARIO OPERADORES */}
                  {activeTab === 'operadores' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Nombre Completo</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataOp.nombre_completo} onChange={e => setFormDataOp({...formDataOp, nombre_completo: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase" value={formDataOp.rfc} onChange={e => setFormDataOp({...formDataOp, rfc: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">No. Licencia</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataOp.numero_licencia} onChange={e => setFormDataOp({...formDataOp, numero_licencia: e.target.value})} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">Vencimiento Licencia</label>
                        <input required type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataOp.vencimiento_licencia} onChange={e => setFormDataOp({...formDataOp, vencimiento_licencia: e.target.value})} />
                      </div>
                    </div>
                  )}

                  {/* FORMULARIO REMOLQUES */}
                  {activeTab === 'remolques' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Número Económico</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataRe.numero_economico} onChange={e => setFormDataRe({...formDataRe, numero_economico: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Placas</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase" value={formDataRe.placas} onChange={e => setFormDataRe({...formDataRe, placas: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Tipo SAT</label>
                        <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataRe.subtipo_remolque} onChange={e => setFormDataRe({...formDataRe, subtipo_remolque: e.target.value})}>
                          <option value="CTR007">Caja Seca</option>
                          <option value="CTR001">Caballete</option>
                          <option value="CTR004">Cama Baja</option>
                          <option value="CTR011">Tanque</option>
                          <option value="CTR019">Plataforma</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* FORMULARIO UBICACIONES */}
                  {activeTab === 'ubicaciones' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Nombre / Alias del Lugar</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" placeholder="Ej: CEDIS Monterrey" value={formDataUb.nombre_lugar} onChange={e => setFormDataUb({...formDataUb, nombre_lugar: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">Código Postal</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataUb.codigo_postal} onChange={e => setFormDataUb({...formDataUb, codigo_postal: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC Ubicación (Opcional)</label>
                        <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase" value={formDataUb.rfc_ubicacion} onChange={e => setFormDataUb({...formDataUb, rfc_ubicacion: e.target.value})} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Dirección Completa</label>
                        <textarea className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white h-20" value={formDataUb.direccion} onChange={e => setFormDataUb({...formDataUb, direccion: e.target.value})} />
                      </div>
                    </div>
                  )}

                  {/* FORMULARIO MERCANCÍAS */}
                  {activeTab === 'mercancias' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Descripción del Bien</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataMe.descripcion} onChange={e => setFormDataMe({...formDataMe, descripcion: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">Clave SAT (Producto)</label>
                        <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" placeholder="Ej: 31181701" value={formDataMe.clave_sat} onChange={e => setFormDataMe({...formDataMe, clave_sat: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Peso Estimado (KG)</label>
                        <input required type="number" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataMe.peso_unitario_kg} onChange={e => setFormDataMe({...formDataMe, peso_unitario_kg: e.target.value})} />
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all">
                    {loading ? "Procesando..." : "Guardar Registro"}
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