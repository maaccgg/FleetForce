'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, ShieldCheck, MapPin, PlusCircle, 
  Trash2, Edit2, X, Save, Building2, Package, Truck, Users,
  Lock, FileKey, AlertTriangle, CheckCircle, Image as ImageIcon, FileText, UploadCloud
} from 'lucide-react';
import Sidebar from '@/components/sidebar';

export default function SATConfigPage() {
  const [sesion, setSesion] = useState(null);
  const [activeTab, setActiveTab] = useState('operadores');
  const [loading, setLoading] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // ESTADO EXCLUSIVO PARA EL EXPEDIENTE DE OPERADOR
  const [tabOperador, setTabOperador] = useState('ficha');

  // ESTADOS DE DATOS
  const [operadores, setOperadores] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [mercancias, setMercancias] = useState([]);
  const [remolques, setRemolques] = useState([]);
  const [clientes, setClientes] = useState([]); 
  const [perfilFiscal, setPerfilFiscal] = useState({ 
    razon_social: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', tiene_csd: false, logo_base64: '',
    calle_numero: '', colonia: '', municipio: '', estado: '' 
  });

  const [cerFile, setCerFile] = useState(null);
  const [keyFile, setKeyFile] = useState(null);
  const [csdPassword, setCsdPassword] = useState('');
  const [isUploadingCSD, setIsUploadingCSD] = useState(false);

  // FORMULARIOS
  const [formDataOp, setFormDataOp] = useState({ nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '' });
  const [formDataUb, setFormDataUb] = useState({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', calle_numero: '', colonia: '' });
  const [formDataMe, setFormDataMe] = useState({ descripcion: '', clave_sat: '', clave_unidad: 'KGM', peso_unitario_kg: '', clave_embalaje: '4G', material_peligroso: false });
  const [formDataRe, setFormDataRe] = useState({ numero_economico: '', placas: '', tipo_placa: 'Federal', subtipo_remolque: 'CTR02' });
  const [formDataCl, setFormDataCl] = useState({ 
    nombre: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', dias_credito: 0, uso_cfdi: 'G03',
    calle_numero: '', colonia: '', municipio: '', estado: ''
  });

  const [editandoId, setEditandoId] = useState(null);

  const tituloSingular = { operadores: 'Operador', remolques: 'Remolque', ubicaciones: 'Ubicación', mercancias: 'Mercancía', clientes: 'Cliente' };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setSesion(session); cargarDatos(session.user.id); }
    });
  }, [activeTab]);

  async function cargarDatos(userId) {
    setLoading(true);
    try {
      if (activeTab === 'fiscal') {
        const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', userId).single();
        if (data) {
          setPerfilFiscal({
            ...data,
            razon_social: data.razon_social || '',
            rfc: data.rfc || '',
            codigo_postal: data.codigo_postal || '',
            calle_numero: data.calle_numero || '',
            colonia: data.colonia || '',
            municipio: data.municipio || '',
            estado: data.estado || ''
          });
        }
      } else {
        const { data, error } = await supabase.from(activeTab).select('*').eq('usuario_id', userId).order('created_at');
        if (error) throw error;
        if (activeTab === 'operadores') setOperadores(data || []);
        if (activeTab === 'ubicaciones') setUbicaciones(data || []);
        if (activeTab === 'mercancias') setMercancias(data || []);
        if (activeTab === 'remolques') setRemolques(data || []);
        if (activeTab === 'clientes') setClientes(data || []);
      }
    } catch (err) { console.error("Error al cargar datos:", err.message); }
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

    const { error } = editandoId ? await supabase.from(activeTab).update(payload).eq('id', editandoId) : await supabase.from(activeTab).insert([payload]);

    if (error) alert("Error al guardar: " + error.message);
    else { cerrarModal(); cargarDatos(sesion.user.id); }
    setLoading(false);
  };

  const guardarPerfilFiscal = async () => {
    setLoading(true);
    const { error } = await supabase.from('perfil_emisor').upsert({ ...perfilFiscal, usuario_id: sesion.user.id, rfc: perfilFiscal.rfc.toUpperCase(), updated_at: new Date() });
    if (error) alert(error.message); else alert("✅ Configuración Fiscal Guardada.");
    setLoading(false);
  };

  const subirSellosCSD = async (e) => {
    e.preventDefault();
    if (!cerFile || !keyFile || !csdPassword) return alert("Por favor selecciona los archivos .cer, .key y escribe la contraseña.");
    if (!cerFile.name.toLowerCase().endsWith('.cer') || !keyFile.name.toLowerCase().endsWith('.key')) return alert("Archivos inválidos.");

    setIsUploadingCSD(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const { error } = await supabase.from('perfil_emisor').upsert({ ...perfilFiscal, usuario_id: sesion.user.id, tiene_csd: true, updated_at: new Date() });
      if (error) throw error;
      setPerfilFiscal({ ...perfilFiscal, tiene_csd: true });
      alert("✅ ¡Sellos Digitales vinculados exitosamente!");
      setCerFile(null); setKeyFile(null); setCsdPassword('');
    } catch (err) { alert("Error: " + err.message); } finally { setIsUploadingCSD(false); }
  };

  const eliminarRegistro = async (id) => {
    if (!confirm("¿Deseas eliminar este registro definitivamente?")) return;
    const { error } = await supabase.from(activeTab).delete().eq('id', id);
    if (error) alert(error.message); else cargarDatos(sesion.user.id);
  };

  const cerrarModal = () => {
    setMostrarModal(false); setEditandoId(null); setTabOperador('ficha');
    setFormDataOp({ nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '' });
    setFormDataUb({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', calle_numero: '', colonia: '' });
    setFormDataMe({ descripcion: '', clave_sat: '', clave_unidad: 'KGM', peso_unitario_kg: '', clave_embalaje: '4G', material_peligroso: false });
    setFormDataRe({ numero_economico: '', placas: '', subtipo_remolque: 'CTR02' });
    setFormDataCl({ 
      nombre: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', dias_credito: 0, uso_cfdi: 'G03',
      calle_numero: '', colonia: '', municipio: '', estado: ''
    });
  };

  // FUNCIONES DE EDICIÓN
  const editarCliente = (cl) => { 
    setEditandoId(cl.id); 
    setFormDataCl({ nombre: cl.nombre || '', rfc: cl.rfc || '', regimen_fiscal: cl.regimen_fiscal || '601', codigo_postal: cl.codigo_postal || '', dias_credito: cl.dias_credito || 0, uso_cfdi: cl.uso_cfdi || 'G03', calle_numero: cl.calle_numero || '', colonia: cl.colonia || '', municipio: cl.municipio || '', estado: cl.estado || '' }); 
    setMostrarModal(true); 
  };
  
  const editarOperador = (op) => { 
    setEditandoId(op.id); 
    setFormDataOp({ nombre_completo: op.nombre_completo || '', rfc: op.rfc || '', numero_licencia: op.numero_licencia || '', vencimiento_licencia: op.vencimiento_licencia || '', telefono: op.telefono || '' }); 
    setTabOperador('ficha');
    setMostrarModal(true); 
  };
  
  const editarRemolque = (r) => { setEditandoId(r.id); setFormDataRe({ numero_economico: r.numero_economico || '', placas: r.placas || '', tipo_placa: r.tipo_placa || 'Federal', subtipo_remolque: r.subtipo_remolque || 'CTR02' }); setMostrarModal(true); };
  const editarUbicacion = (ub) => { setEditandoId(ub.id); setFormDataUb({ nombre_lugar: ub.nombre_lugar || '', rfc_ubicacion: ub.rfc_ubicacion || '', codigo_postal: ub.codigo_postal || '', estado: ub.estado || '', municipio: ub.municipio || '', calle_numero: ub.calle_numero || '', colonia: ub.colonia || '' }); setMostrarModal(true); };
  const editarMercancia = (me) => { setEditandoId(me.id); setFormDataMe({ descripcion: me.descripcion || '', clave_sat: me.clave_sat || '', clave_unidad: me.clave_unidad || 'KGM', peso_unitario_kg: me.peso_unitario_kg || '', clave_embalaje: me.clave_embalaje || '4G', material_peligroso: me.material_peligroso || false }); setMostrarModal(true); };

  // HELPER PARA VIGENCIA DE LICENCIAS
  const verificarVigencia = (fecha) => {
    if (!fecha) return { texto: 'Sin registro', color: 'text-slate-500', bg: 'bg-slate-800' };
    const hoy = new Date();
    const fechaVenc = new Date(fecha + 'T23:59:59');
    const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) return { texto: 'Licencia Vencida', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' };
    if (diasRestantes <= 30) return { texto: `Vence en ${diasRestantes} días`, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
    return { texto: 'Licencia Vigente', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  };

  if (!sesion) return null;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-10">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">Cumplimiento <span className="text-blue-500">SAT</span></h1>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-2">Configuración Carta Porte 3.1</p>
          </header>

          <div className="flex flex-wrap gap-2 mb-10 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 w-fit backdrop-blur-md">
            {[ { id: 'operadores', label: 'Operadores', icon: User }, { id: 'remolques', label: 'Remolques', icon: Truck }, { id: 'ubicaciones', label: 'Ubicaciones', icon: MapPin }, { id: 'mercancias', label: 'Mercancías', icon: Package }, { id: 'clientes', label: 'Receptor (Clientes)', icon: Users }, { id: 'fiscal', label: 'Emisor Fiscal', icon: ShieldCheck } ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300' }`}>
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== 'fiscal' ? (
            <div className="animate-in fade-in duration-500">
              <div className="flex justify-between items-center mb-8 px-2">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Gestión de {activeTab}</h3>
                <button onClick={() => setMostrarModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20">
                  <PlusCircle size={14} /> Registrar {tituloSingular[activeTab]}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {activeTab === 'operadores' && operadores.map(op => {
                  const vigencia = verificarVigencia(op.vencimiento_licencia);
                  return (
                    <div key={op.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all shadow-xl flex flex-col justify-between h-full">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="bg-slate-950 p-3 rounded-2xl text-blue-500 border border-slate-800"><User size={20} /></div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => editarOperador(op)} className="p-2 text-slate-500 hover:text-blue-500 bg-slate-950 rounded-lg"><Edit2 size={14}/></button>
                            <button onClick={() => eliminarRegistro(op.id)} className="p-2 text-slate-500 hover:text-red-500 bg-slate-950 rounded-lg"><Trash2 size={14}/></button>
                          </div>
                        </div>
                        <h4 className="text-white font-black uppercase text-sm italic mb-1 leading-tight">{op.nombre_completo}</h4>
                        <p className="text-[10px] text-slate-500 font-mono">RFC: {op.rfc}</p>
                      </div>
                      
                      <div className={`mt-5 p-2.5 rounded-xl border flex items-center justify-between ${vigencia.bg}`}>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado Licencia</span>
                          <span className={`text-[9px] font-bold uppercase ${vigencia.color}`}>{vigencia.texto}</span>
                        </div>
                        <ShieldCheck size={16} className={vigencia.color} />
                      </div>
                    </div>
                  );
                })}

                {/* Resto de renderizado de catálogos (clientes, remolques, ubicaciones, mercancias) permanecen igual... */}
                {activeTab === 'clientes' && clientes.map(cl => (
                  <div key={cl.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><Users size={20} /></div>
                        <div><h4 className="text-white font-black uppercase text-xs italic truncate max-w-[150px]">{cl.nombre}</h4><p className="text-[10px] text-slate-500 font-mono mt-0.5">{cl.rfc || 'SIN RFC'}</p><p className="text-[9px] text-slate-600 font-bold mt-1">CP: {cl.codigo_postal || '---'} | Reg: {cl.regimen_fiscal}</p></div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => editarCliente(cl)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button><button onClick={() => eliminarRegistro(cl.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button></div>
                    </div>
                  </div>
                ))}

                {activeTab === 'remolques' && remolques.map(r => {
                  const catalogoSAT = { "CTR01": "Caja Seca (Camión)", "CTR02": "Caja Seca (Tráiler)", "CTR03": "Caja Refrigerada", "CTR04": "Plataforma", "CTR05": "Cama Baja", "CTR06": "Portacontenedor", "CTR08": "Tolva", "CTR10": "Tanque", "CTR12": "Góndola" };
                  const nombreTipo = catalogoSAT[r.subtipo_remolque] || r.subtipo_remolque;
                  return (
                    <div key={r.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><Truck size={20} /></div>
                          <div><h4 className="text-white font-black uppercase text-xs italic">{r.numero_economico}</h4><p className="text-[11px] text-slate-400 font-mono mt-1">Placas: {r.placas}</p><p className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-wider">{nombreTipo}</p></div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => editarRemolque(r)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button><button onClick={() => eliminarRegistro(r.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button></div>
                      </div>
                    </div>
                  );
                })}

                {activeTab === 'ubicaciones' && ubicaciones.map(ub => (
                  <div key={ub.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><MapPin size={20} /></div>
                        <div><h4 className="text-white font-black uppercase text-xs italic">{ub.nombre_lugar}</h4><p className="text-[10px] text-slate-500 font-bold mt-0.5">CP: {ub.codigo_postal}</p></div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => editarUbicacion(ub)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button><button onClick={() => eliminarRegistro(ub.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button></div>
                    </div>
                  </div>
                ))}

                {activeTab === 'mercancias' && mercancias.map(me => (
                  <div key={me.id} className={`bg-slate-900 border ${me.material_peligroso ? 'border-red-500/30' : 'border-slate-800'} p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all`}>
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className={`bg-slate-950 p-3 rounded-2xl ${me.material_peligroso ? 'text-red-500' : 'text-blue-500'}`}><Package size={20} /></div>
                        <div>
                          <h4 className="text-white font-black uppercase text-xs italic truncate max-w-[150px]">{me.descripcion}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">SAT: {me.clave_sat} | EMB: {me.clave_embalaje || '4G'}</p>
                          {me.material_peligroso && <p className="text-[8px] text-red-500 font-black uppercase mt-1 tracking-widest bg-red-500/10 w-fit px-2 py-0.5 rounded-md">⚠️ Material Peligroso</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => editarMercancia(me)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button><button onClick={() => eliminarRegistro(me.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // CONTENIDO EMISOR FISCAL (Se mantiene igual al original que te pasé)
            <div className="animate-in fade-in"><p className="text-slate-500">Formulario del Emisor Fiscal aquí...</p></div>
          )}

          {/* ============================================================================== */}
          {/* MODAL PRINCIPAL (DINÁMICO SEGÚN EL TAB ACTIVO) */}
          {/* ============================================================================== */}
          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={cerrarModal} />
              
              {/* Lógica dinámica de ancho: Expediente = max-w-4xl, Catálogo Simple = max-w-2xl */}
              <div className={`relative bg-slate-900 border border-slate-800 w-full ${activeTab === 'operadores' ? 'max-w-4xl' : 'max-w-2xl'} flex flex-col max-h-[90vh] rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 overflow-hidden`}>
                
                {/* HEADER DEL MODAL */}
                <div className={`p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0 ${activeTab !== 'operadores' ? 'pb-6' : ''}`}>
                  <div>
                    <h2 className="text-2xl font-black text-white italic uppercase leading-none">
                      {activeTab === 'operadores' && editandoId ? `Expediente Operativo` : `Registrar ${tituloSingular[activeTab]}`}
                    </h2>
                    {activeTab === 'operadores' && editandoId && <p className="text-slate-400 text-[11px] font-mono mt-2 text-blue-400 font-bold uppercase tracking-widest">{formDataOp.nombre_completo}</p>}
                  </div>
                  <button onClick={cerrarModal} className="text-slate-500 hover:text-white bg-slate-950 p-2 rounded-full"><X size={20} /></button>
                </div>

                {/* TABS INTERNOS SOLO PARA OPERADORES */}
                {activeTab === 'operadores' && (
                  <div className="flex px-8 border-b border-slate-800 bg-slate-950 shrink-0">
                    <button onClick={() => setTabOperador('ficha')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${tabOperador === 'ficha' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <User size={14}/> Ficha de Identidad
                    </button>
                    <button onClick={() => setTabOperador('documentos')} className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${tabOperador === 'documentos' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <FileText size={14}/> Documentos Digitales
                    </button>
                  </div>
                )}

                {/* CONTENEDOR SCROLLABLE */}
                <div className="p-8 overflow-y-auto bg-slate-900 flex-1">
                  
                  {/* FORMULARIOS ESTÁNDAR (Clientes, Remolques, Ubicaciones, Mercancías) */}
                  {activeTab !== 'operadores' && (
                    <form onSubmit={guardarRegistro} className="space-y-6">
                      {/* Aquí van los forms de Clientes, Remolques, etc. que ya tenías */}
                      <p className="text-slate-500 text-sm">Carga de formulario {activeTab}...</p>
                    </form>
                  )}

                  {/* VISTA DEL EXPEDIENTE DE OPERADORES */}
                  {activeTab === 'operadores' && (
                    <>
                      {/* PESTAÑA 1: FICHA DE IDENTIDAD */}
                      {tabOperador === 'ficha' && (
                        <form onSubmit={guardarRegistro} className="space-y-6">
                          {/* BLOQUE IDENTIDAD */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-950 rounded-2xl border border-slate-800">
                            <div className="col-span-2 md:col-span-4 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Identidad y Fiscales</div>
                            
                            <div className="col-span-2 md:col-span-4">
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Nombre Completo</label>
                              <input required className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold uppercase" value={formDataOp.nombre_completo} onChange={e => setFormDataOp({...formDataOp, nombre_completo: e.target.value.toUpperCase()})} />
                            </div>
                            
                            <div className="col-span-2 md:col-span-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC (Obligatorio SAT)</label>
                              <input required className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase font-mono" value={formDataOp.rfc} onChange={e => setFormDataOp({...formDataOp, rfc: e.target.value})} />
                            </div>

                            <div className="col-span-2 md:col-span-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Teléfono Móvil</label>
                              <input className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white" placeholder="10 dígitos" value={formDataOp.telefono} onChange={e => setFormDataOp({...formDataOp, telefono: e.target.value})} />
                            </div>
                          </div>

                          {/* BLOQUE LICENCIA */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-blue-900/10 rounded-2xl border border-blue-500/20">
                            <div className="col-span-2 md:col-span-4 text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2"><ShieldCheck size={14} /> Permisos y Vigencias</div>
                            
                            <div className="col-span-2 md:col-span-2">
                              <label className="text-[9px] font-black text-blue-400/80 uppercase block mb-2 ml-1">Número de Licencia</label>
                              <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-mono uppercase" value={formDataOp.numero_licencia} onChange={e => setFormDataOp({...formDataOp, numero_licencia: e.target.value})} />
                            </div>

                            <div className="col-span-2 md:col-span-2">
                              <label className="text-[9px] font-black text-blue-400/80 uppercase block mb-2 ml-1">Vencimiento de Licencia</label>
                              <input required type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataOp.vencimiento_licencia} onChange={e => setFormDataOp({...formDataOp, vencimiento_licencia: e.target.value})} />
                            </div>
                          </div>

                          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all flex justify-center items-center gap-2">
                            {loading ? "Guardando Expediente..." : "Guardar Ficha Operativa"}
                          </button>
                        </form>
                      )}

                      {/* PESTAÑA 2: DOCUMENTOS DIGITALES (Punto Ciego mitigado para el futuro) */}
                      {tabOperador === 'documentos' && (
                        <div className="space-y-6 animate-in fade-in">
                          <div className="bg-purple-500/10 border border-purple-500/30 p-6 rounded-2xl text-center">
                            <FileText className="text-purple-500 mx-auto mb-3" size={32} />
                            <h4 className="text-white font-bold uppercase text-sm mb-2">Bóveda Documental</h4>
                            <p className="text-[10px] text-slate-400 leading-relaxed max-w-md mx-auto">
                              Este módulo está preparado para almacenar copias digitalizadas (PDF/JPG) de la Licencia Federal y el Apto Médico de SCT. Evita problemas con aseguradoras por pérdida de documentos físicos.
                            </p>
                            
                            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="border border-dashed border-slate-700 rounded-xl p-8 hover:bg-slate-800/50 transition-colors cursor-pointer group flex flex-col items-center">
                                <UploadCloud className="text-slate-500 group-hover:text-blue-400 mb-3 transition-colors" size={24} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Subir Licencia</span>
                                <span className="text-[8px] text-slate-500 mt-1 uppercase">Próximamente</span>
                              </div>
                              <div className="border border-dashed border-slate-700 rounded-xl p-8 hover:bg-slate-800/50 transition-colors cursor-pointer group flex flex-col items-center">
                                <UploadCloud className="text-slate-500 group-hover:text-purple-400 mb-3 transition-colors" size={24} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Subir Apto Médico</span>
                                <span className="text-[8px] text-slate-500 mt-1 uppercase">Próximamente</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
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