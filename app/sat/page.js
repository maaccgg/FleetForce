'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, ShieldCheck, MapPin, PlusCircle, 
  Trash2, Edit2, X, Save, Building2, Package, Check 
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
  const [perfilFiscal, setPerfilFiscal] = useState({ razon_social: '', rfc: '', regimen_fiscal: '601', codigo_postal: '' });

  // FORMULARIOS
  const [formDataOp, setFormDataOp] = useState({ nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '' });
  const [formDataUb, setFormDataUb] = useState({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', direccion: '' });
  const [formDataMe, setFormDataMe] = useState({ descripcion: '', clave_sat: '', clave_unidad: 'KGM', peso_unitario_kg: '' });

  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSesion(session);
        cargarDatosGlobales(session.user.id);
      }
    });
  }, [activeTab]);

  async function cargarDatosGlobales(userId) {
    setLoading(true);
    try {
      if (activeTab === 'operadores') {
        const { data, error } = await supabase.from('operadores').select('*').eq('usuario_id', userId).order('nombre_completo');
        if (error) throw error;
        setOperadores(data || []);
      } else if (activeTab === 'ubicaciones') {
        const { data, error } = await supabase.from('ubicaciones').select('*').eq('usuario_id', userId).order('nombre_lugar');
        if (error) throw error;
        setUbicaciones(data || []);
      } else if (activeTab === 'mercancias') {
        const { data, error } = await supabase.from('mercancias').select('*').eq('usuario_id', userId).order('descripcion');
        if (error) throw error;
        setMercancias(data || []);
      } else if (activeTab === 'fiscal') {
        const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', userId).single();
        if (data) setPerfilFiscal(data);
      }
    } catch (err) {
      console.error("Error cargando datos:", err.message);
    }
    setLoading(false);
  }

  // --- ACCIONES DE GUARDADO CON REPORTE DE ERROR ---

  const guardarOperador = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...formDataOp, usuario_id: sesion.user.id, rfc: formDataOp.rfc.toUpperCase() };
    
    const { error } = editandoId 
      ? await supabase.from('operadores').update(payload).eq('id', editandoId)
      : await supabase.from('operadores').insert([payload]);

    if (error) {
      alert("Error en Supabase: " + error.message);
    } else {
      cerrarModal();
      cargarDatosGlobales(sesion.user.id);
    }
    setLoading(false);
  };

  const guardarUbicacion = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...formDataUb, usuario_id: sesion.user.id, rfc_ubicacion: formDataUb.rfc_ubicacion.toUpperCase() };
    
    const { error } = editandoId 
      ? await supabase.from('ubicaciones').update(payload).eq('id', editandoId)
      : await supabase.from('ubicaciones').insert([payload]);

    if (error) {
      alert("Error en Supabase: " + error.message);
    } else {
      cerrarModal();
      cargarDatosGlobales(sesion.user.id);
    }
    setLoading(false);
  };

  const guardarMercancia = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...formDataMe, usuario_id: sesion.user.id, peso_unitario_kg: parseFloat(formDataMe.peso_unitario_kg) };
    
    const { error } = editandoId 
      ? await supabase.from('mercancias').update(payload).eq('id', editandoId)
      : await supabase.from('mercancias').insert([payload]);

    if (error) {
      alert("Error en Supabase: " + error.message);
    } else {
      cerrarModal();
      cargarDatosGlobales(sesion.user.id);
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
    if (error) alert("Error: " + error.message);
    else alert("Configuración Maestra Actualizada");
    setLoading(false);
  };

  const eliminarRegistro = async (id, tabla) => {
    if (!confirm("¿Deseas eliminar este registro?")) return;
    const { error } = await supabase.from(tabla).delete().eq('id', id);
    if (error) alert(error.message);
    else cargarDatosGlobales(sesion.user.id);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setEditandoId(null);
    setFormDataOp({ nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '' });
    setFormDataUb({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', direccion: '' });
    setFormDataMe({ descripcion: '', clave_sat: '', clave_unidad: 'KGM', peso_unitario_kg: '' });
  };

  if (!sesion) return <div className="min-h-screen bg-slate-950"></div>;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-10">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">
              Cumplimiento <span className="text-blue-500">SAT</span>
            </h1>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-2">Configuración Carta Porte 3.1</p>
          </header>

          {/* MENÚ TABS */}
          <div className="flex gap-2 mb-10 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 w-fit backdrop-blur-md">
            {[
              { id: 'operadores', label: 'Operadores', icon: User },
              { id: 'ubicaciones', label: 'Ubicaciones', icon: MapPin },
              { id: 'mercancias', label: 'Mercancías', icon: Package },
              { id: 'fiscal', label: 'Emisor Fiscal', icon: ShieldCheck },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'
                }`}>
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {/* CONTENIDO OPERADORES, UBICACIONES, MERCANCIAS */}
          {activeTab !== 'fiscal' ? (
            <div className="animate-in fade-in duration-500">
              <div className="flex justify-between items-center mb-8 px-2">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Listado de {activeTab}</h3>
                <button onClick={() => setMostrarModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20">
                  <PlusCircle size={14} /> Registrar {activeTab.slice(0,-1)}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTab === 'operadores' && operadores.map(op => (
                  <div key={op.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><User size={20} /></div>
                        <div><h4 className="text-white font-black uppercase text-xs italic">{op.nombre_completo}</h4><p className="text-[10px] text-slate-500 font-mono mt-0.5">{op.rfc}</p></div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => {setEditandoId(op.id); setFormDataOp(op); setMostrarModal(true);}} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button>
                        <button onClick={() => eliminarRegistro(op.id, 'operadores')} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}

                {activeTab === 'ubicaciones' && ubicaciones.map(ub => (
                  <div key={ub.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><MapPin size={20} /></div>
                        <div><h4 className="text-white font-black uppercase text-xs italic">{ub.nombre_lugar}</h4><p className="text-[10px] text-slate-500 font-bold mt-0.5">CP: {ub.codigo_postal}</p></div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => {setEditandoId(ub.id); setFormDataUb(ub); setMostrarModal(true);}} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button>
                        <button onClick={() => eliminarRegistro(ub.id, 'ubicaciones')} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}

                {activeTab === 'mercancias' && mercancias.map(me => (
                  <div key={me.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><Package size={20} /></div>
                        <div><h4 className="text-white font-black uppercase text-xs italic">{me.descripcion}</h4><p className="text-[10px] text-slate-500 font-mono mt-0.5">Clave: {me.clave_sat}</p></div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => {setEditandoId(me.id); setFormDataMe(me); setMostrarModal(true);}} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button>
                        <button onClick={() => eliminarRegistro(me.id, 'mercancias')} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // TAB EMISOR FISCAL
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] max-w-2xl animate-in fade-in slide-in-from-bottom-2">
              <Building2 className="text-blue-500 mb-6" size={40} />
              <h3 className="text-xl font-black text-white italic uppercase mb-2">Perfil del <span className="text-blue-500">Transportista</span></h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-10">Configuración Única de Facturación</p>
              
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
                <div className="col-span-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">Régimen Fiscal</label>
                  <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white"
                    value={perfilFiscal.regimen_fiscal} onChange={e => setPerfilFiscal({...perfilFiscal, regimen_fiscal: e.target.value})}>
                    <option value="601">601 - General de Ley Personas Morales</option>
                    <option value="612">612 - Personas Físicas con Actividades Empresariales</option>
                    <option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option>
                  </select>
                </div>
              </div>
              <button onClick={guardarPerfilFiscal} disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex justify-center items-center gap-2 transition-all hover:bg-blue-500">
                <Save size={16}/> {loading ? "Sincronizando..." : "Actualizar Datos Maestros"}
              </button>
            </div>
          )}

          {/* MODAL MAESTRO ÚNICO */}
          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={cerrarModal} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
                <button onClick={cerrarModal} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                
                {activeTab === 'operadores' && (
                  <form onSubmit={guardarOperador} className="space-y-6">
                    <h2 className="text-2xl font-black text-white italic uppercase mb-8">{editandoId ? 'Editar' : 'Nuevo'} <span className="text-blue-500">Operador</span></h2>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Nombre Completo</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" value={formDataOp.nombre_completo} onChange={e => setFormDataOp({...formDataOp, nombre_completo: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white uppercase" value={formDataOp.rfc} onChange={e => setFormDataOp({...formDataOp, rfc: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">No. Licencia</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" value={formDataOp.numero_licencia} onChange={e => setFormDataOp({...formDataOp, numero_licencia: e.target.value})} /></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">Vencimiento Licencia</label>
                      <input required type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" value={formDataOp.vencimiento_licencia} onChange={e => setFormDataOp({...formDataOp, vencimiento_licencia: e.target.value})} /></div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-blue-500">
                      {loading ? "Procesando..." : "Guardar Registro"}
                    </button>
                  </form>
                )}

                {activeTab === 'ubicaciones' && (
                  <form onSubmit={guardarUbicacion} className="space-y-6">
                    <h2 className="text-2xl font-black text-white italic uppercase mb-8">{editandoId ? 'Editar' : 'Nueva'} <span className="text-blue-500">Ubicación</span></h2>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Nombre / Alias</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" placeholder="Ej: CEDIS Monterrey" value={formDataUb.nombre_lugar} onChange={e => setFormDataUb({...formDataUb, nombre_lugar: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">CP (Dato SAT)</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" value={formDataUb.codigo_postal} onChange={e => setFormDataUb({...formDataUb, codigo_postal: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC Destino (Opcional)</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white uppercase" value={formDataUb.rfc_ubicacion} onChange={e => setFormDataUb({...formDataUb, rfc_ubicacion: e.target.value})} /></div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all">
                      {loading ? "Procesando..." : "Guardar Ubicación"}
                    </button>
                  </form>
                )}

                {activeTab === 'mercancias' && (
                  <form onSubmit={guardarMercancia} className="space-y-6">
                    <h2 className="text-2xl font-black text-white italic uppercase mb-8">{editandoId ? 'Editar' : 'Nueva'} <span className="text-blue-500">Mercancía</span></h2>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Descripción del Bien</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" value={formDataMe.descripcion} onChange={e => setFormDataMe({...formDataMe, descripcion: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Clave SAT</label>
                      <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" value={formDataMe.clave_sat} onChange={e => setFormDataMe({...formDataMe, clave_sat: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Peso Std (KG)</label>
                      <input required type="number" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" value={formDataMe.peso_unitario_kg} onChange={e => setFormDataMe({...formDataMe, peso_unitario_kg: e.target.value})} /></div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all">
                      {loading ? "Procesando..." : "Guardar Mercancía"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}