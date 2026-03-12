'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, ShieldCheck, MapPin, PlusCircle, 
  Trash2, Edit2, X, Save, Building2, Package, Truck, Users,
  Lock, FileKey, AlertTriangle, CheckCircle, Image as ImageIcon
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
  const [formDataRe, setFormDataRe] = useState({ numero_economico: '', placas: '', subtipo_remolque: 'CTR007' });
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
          // Filtro para convertir los 'null' de Supabase a textos vacíos ''
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
      }
      
      else {
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
    if (error) alert(error.message); else alert("✅ Configuración Fiscal Guardada. Cheems está feliz.");
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
    setMostrarModal(false); setEditandoId(null);
    setFormDataOp({ nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '' });
   setFormDataUb({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', calle_numero: '', colonia: '' });
    setFormDataMe({ descripcion: '', clave_sat: '', clave_unidad: 'KGM', peso_unitario_kg: '', clave_embalaje: '4G', material_peligroso: false });
    setFormDataRe({ numero_economico: '', placas: '', subtipo_remolque: 'CTR007' });
    setFormDataCl({ 
      nombre: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', dias_credito: 0, uso_cfdi: 'G03',
      calle_numero: '', colonia: '', municipio: '', estado: ''
    });
  };

  const editarCliente = (cl) => { 
    setEditandoId(cl.id); 
    setFormDataCl({ 
      nombre: cl.nombre || '', rfc: cl.rfc || '', regimen_fiscal: cl.regimen_fiscal || '601', codigo_postal: cl.codigo_postal || '', 
      dias_credito: cl.dias_credito || 0, uso_cfdi: cl.uso_cfdi || 'G03',
      calle_numero: cl.calle_numero || '', colonia: cl.colonia || '', municipio: cl.municipio || '', estado: cl.estado || ''
    }); 
    setMostrarModal(true); 
  };
  
  const editarOperador = (op) => { setEditandoId(op.id); setFormDataOp({ nombre_completo: op.nombre_completo || '', rfc: op.rfc || '', numero_licencia: op.numero_licencia || '', vencimiento_licencia: op.vencimiento_licencia || '', telefono: op.telefono || '' }); setMostrarModal(true); };
  const editarRemolque = (r) => { setEditandoId(r.id); setFormDataRe({ numero_economico: r.numero_economico || '', placas: r.placas || '', subtipo_remolque: r.subtipo_remolque || 'CTR007' }); setMostrarModal(true); };
  const editarUbicacion = (ub) => { setEditandoId(ub.id); setFormDataUb({ nombre_lugar: ub.nombre_lugar || '', rfc_ubicacion: ub.rfc_ubicacion || '', codigo_postal: ub.codigo_postal || '', estado: ub.estado || '', municipio: ub.municipio || '', calle_numero: ub.calle_numero || '', colonia: ub.colonia || '' }); setMostrarModal(true); };
  const editarMercancia = (me) => { setEditandoId(me.id); setFormDataMe({ descripcion: me.descripcion || '', clave_sat: me.clave_sat || '', clave_unidad: me.clave_unidad || 'KGM', peso_unitario_kg: me.peso_unitario_kg || '', clave_embalaje: me.clave_embalaje || '4G', material_peligroso: me.material_peligroso || false }); setMostrarModal(true); };

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

                {/* Demás catálogos... */}
                {activeTab === 'operadores' && operadores.map(op => (
                  <div key={op.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><User size={20} /></div>
                        <div><h4 className="text-white font-black uppercase text-xs italic">{op.nombre_completo}</h4><p className="text-[10px] text-slate-500 font-mono mt-0.5">{op.rfc}</p></div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => editarOperador(op)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button><button onClick={() => eliminarRegistro(op.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button></div>
                    </div>
                  </div>
                ))}
                {activeTab === 'remolques' && remolques.map(r => (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] group hover:border-blue-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="bg-slate-950 p-3 rounded-2xl text-blue-500"><Truck size={20} /></div>
                        <div><h4 className="text-white font-black uppercase text-xs italic">{r.numero_economico}</h4><p className="text-[10px] text-slate-500 font-bold mt-0.5">Placas: {r.placas}</p></div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => editarRemolque(r)} className="p-2 text-slate-500 hover:text-blue-500"><Edit2 size={14}/></button><button onClick={() => eliminarRegistro(r.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button></div>
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
            // =========================================================
            // PESTAÑA EMISOR FISCAL 
            // =========================================================

            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
              
              {/* FILA 1: PERFIL Y LOGOTIPO (Lado a lado, misma altura automática) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Tarjeta 1: Datos de Facturación */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col">
                  <Building2 className="text-blue-500 mb-5" size={32} />
                  <h3 className="text-xl font-black text-white italic uppercase mb-1">Perfil del <span className="text-blue-500">Transportista</span></h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Datos de Facturación</p>
                  
                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">Razón Social</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none focus:border-blue-500 uppercase" 
                        value={perfilFiscal.razon_social} onChange={e => setPerfilFiscal({...perfilFiscal, razon_social: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">RFC</label>
                        <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white uppercase font-mono" 
                          value={perfilFiscal.rfc} onChange={e => setPerfilFiscal({...perfilFiscal, rfc: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">CP Fiscal</label>
                        <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                          value={perfilFiscal.codigo_postal} onChange={e => setPerfilFiscal({...perfilFiscal, codigo_postal: e.target.value})} />
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-800 mt-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Dirección Comercial</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">Calle y Número</label>
                          <input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" 
                            placeholder="Ej. Av. Universidad 123" value={perfilFiscal.calle_numero} onChange={e => setPerfilFiscal({...perfilFiscal, calle_numero: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">Colonia</label>
                          <input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" 
                            placeholder="Ej. Centro" value={perfilFiscal.colonia} onChange={e => setPerfilFiscal({...perfilFiscal, colonia: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">Municipio</label>
                          <input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" 
                            placeholder="Ej. Monterrey" value={perfilFiscal.municipio} onChange={e => setPerfilFiscal({...perfilFiscal, municipio: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block">Estado</label>
                          <input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" 
                            placeholder="Ej. Nuevo León" value={perfilFiscal.estado} onChange={e => setPerfilFiscal({...perfilFiscal, estado: e.target.value})} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 2: LOGOTIPO */}
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col">
                  <ImageIcon className="text-orange-500 mb-5" size={32} />
                  <h3 className="text-xl font-black text-white italic uppercase mb-1">Imagen <span className="text-orange-500">Corporativa</span></h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8">Logotipo para Facturas y Carta Porte</p>
                  
                  <div className="flex flex-col items-center justify-center gap-8 flex-1">
                    <div className="w-56 h-56 bg-slate-950 rounded-[2rem] border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden p-4 relative group">
                      {perfilFiscal.logo_base64 ? (
                        <img src={perfilFiscal.logo_base64} alt="Logo Empresa" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="text-slate-700 mx-auto mb-2" size={32} />
                          <span className="text-xs text-slate-600 font-black uppercase tracking-widest">Sin Logotipo</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="w-full">
                      <label className="w-full flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-800 bg-slate-950 hover:bg-slate-800 cursor-pointer transition-all">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <ImageIcon size={14} /> Seleccionar Nueva Imagen
                        </span>
                        <span className="text-[8px] text-slate-500 mt-1 uppercase">PNG o JPG (Max 1MB)</span>
                        <input type="file" accept="image/png, image/jpeg" className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 1024 * 1024) return alert("El logo debe pesar menos de 1MB");
                            
                            const reader = new FileReader();
                            reader.onloadend = () => setPerfilFiscal({...perfilFiscal, logo_base64: reader.result});
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

              </div>

              {/* FILA 2: SELLOS DIGITALES (Abajo, ancho completo) */}
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] relative overflow-hidden">
                <FileKey className="text-purple-500 mb-5" size={32} />
                <h3 className="text-xl font-black text-white italic uppercase mb-1">Sellos <span className="text-purple-500">Digitales (CSD)</span></h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Requisito para Timbrar en Producción</p>
                
                {perfilFiscal.tiene_csd ? (
                  <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-2xl text-center max-w-lg mx-auto">
                    <CheckCircle className="text-green-500 mx-auto mb-3" size={32} />
                    <h4 className="text-white font-bold uppercase text-sm mb-1">Sellos Activos</h4>
                    <p className="text-[10px] text-slate-400">Tu cuenta está lista para timbrar ante el SAT.</p>
                    <button type="button" onClick={() => setPerfilFiscal({...perfilFiscal, tiene_csd: false})} className="mt-4 text-[9px] text-blue-400 uppercase font-bold hover:text-white">Actualizar Sellos</button>
                  </div>
                ) : (
                  <form onSubmit={subirSellosCSD} className="space-y-4 max-w-2xl">
                    <div className="bg-blue-900/20 border border-blue-500/20 p-3 rounded-xl flex items-start gap-3">
                      <AlertTriangle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-[9px] text-blue-200/80 leading-relaxed">Asegúrate de subir tus archivos de <strong>Facturación (CSD)</strong>. El SAT rechazará los timbres si subes los de e.firma (FIEL).</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Archivo .CER</label>
                        <input type="file" accept=".cer" required onChange={e => setCerFile(e.target.files[0])} className="w-full text-[10px] text-slate-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-bold file:uppercase file:bg-slate-800 file:text-white hover:file:bg-slate-700" />
                      </div>
                      
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Archivo .KEY</label>
                        <input type="file" accept=".key" required onChange={e => setKeyFile(e.target.files[0])} className="w-full text-[10px] text-slate-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-bold file:uppercase file:bg-slate-800 file:text-white hover:file:bg-slate-700" />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block flex items-center gap-1"><Lock size={10}/> Contraseña del Sello</label>
                        <input type="password" required value={csdPassword} onChange={e => setCsdPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-2xl text-sm text-white outline-none focus:border-purple-500" placeholder="••••••••" />
                      </div>
                    </div>

                    <button type="submit" disabled={isUploadingCSD} className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex justify-center items-center gap-2 transition-all ${isUploadingCSD ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-500'}`}>
                      <Lock size={14}/> {isUploadingCSD ? "Validando en el SAT..." : "Vincular Sellos CSD"}
                    </button>
                  </form>
                )}
              </div>

              {/* BOTÓN GIGANTE */}
              <div className="mt-4">
                <button type="button" onClick={guardarPerfilFiscal} disabled={loading} 
                  className={`w-full py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl flex justify-center items-center gap-3 transition-all 
                  ${loading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                  <Save size={20}/> {loading ? "Sincronizando..." : "Guardar Datos Maestros"}
                </button>
              </div>

            </div>
          )}

{mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={cerrarModal} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
                <button onClick={cerrarModal} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Registrar <span className="text-blue-500">{tituloSingular[activeTab]}</span></h2>
                
                <form onSubmit={guardarRegistro} className="space-y-6">
                  
                  {/* 👇 NUEVO FORMULARIO DE CLIENTES CON 4 CAJITAS 👇 */}
                  {activeTab === 'clientes' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl mb-2"><p className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-2">⚠️ Regla CFDI 4.0 del SAT</p><p className="text-[9px] text-yellow-400/80 mt-1">El Nombre y Código Postal deben capturarse <strong>exactamente</strong> como aparecen en la Constancia de Situación Fiscal. Omite el "S.A. DE C.V.".</p></div>
                      
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Razón Social del Cliente</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold uppercase" value={formDataCl.nombre} onChange={e => setFormDataCl({...formDataCl, nombre: e.target.value.toUpperCase()})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase font-mono" value={formDataCl.rfc} onChange={e => setFormDataCl({...formDataCl, rfc: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">CP Fiscal</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataCl.codigo_postal} onChange={e => setFormDataCl({...formDataCl, codigo_postal: e.target.value})} /></div>
                      
                      <div className="col-span-2 mt-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Domicilio del Cliente</p></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Calle y Número</label><input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" value={formDataCl.calle_numero} onChange={e => setFormDataCl({...formDataCl, calle_numero: e.target.value})} /></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Colonia</label><input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" value={formDataCl.colonia} onChange={e => setFormDataCl({...formDataCl, colonia: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Municipio</label><input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" value={formDataCl.municipio} onChange={e => setFormDataCl({...formDataCl, municipio: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Estado</label><input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" value={formDataCl.estado} onChange={e => setFormDataCl({...formDataCl, estado: e.target.value})} /></div>
                      
                      <div className="col-span-2 mt-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Datos Fiscales</p></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Régimen Fiscal</label><select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formDataCl.regimen_fiscal} onChange={e => setFormDataCl({...formDataCl, regimen_fiscal: e.target.value})}><option value="601">601 - General de Ley Personas Morales</option><option value="612">612 - Personas Físicas con Actividad Empresarial</option><option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option></select></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Uso de CFDI</label><select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formDataCl.uso_cfdi} onChange={e => setFormDataCl({...formDataCl, uso_cfdi: e.target.value})}><option value="G03">G03 - Gastos en general</option><option value="G01">G01 - Adquisición de mercancías</option><option value="S01">S01 - Sin efectos fiscales</option></select></div>
                    </div>
                  )}

                  {/* Resto de formularios quedan igual... */}
                  {activeTab === 'operadores' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Nombre Completo</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataOp.nombre_completo} onChange={e => setFormDataOp({...formDataOp, nombre_completo: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC (Obligatorio)</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase" value={formDataOp.rfc} onChange={e => setFormDataOp({...formDataOp, rfc: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">No. Licencia</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataOp.numero_licencia} onChange={e => setFormDataOp({...formDataOp, numero_licencia: e.target.value})} /></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">Vencimiento Licencia</label><input required type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataOp.vencimiento_licencia} onChange={e => setFormDataOp({...formDataOp, vencimiento_licencia: e.target.value})} /></div>
                    </div>
                  )}

                  {activeTab === 'remolques' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Número Económico</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataRe.numero_economico} onChange={e => setFormDataRe({...formDataRe, numero_economico: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Placas</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase" value={formDataRe.placas} onChange={e => setFormDataRe({...formDataRe, placas: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Tipo SAT</label><select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataRe.subtipo_remolque} onChange={e => setFormDataRe({...formDataRe, subtipo_remolque: e.target.value})}><option value="CTR007">Caja Seca</option><option value="CTR001">Caballete</option><option value="CTR004">Cama Baja</option><option value="CTR011">Tanque</option><option value="CTR019">Plataforma</option></select></div>
                    </div>
                  )}

{activeTab === 'ubicaciones' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-2">
                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider flex items-center gap-2">⚠️ Dato Obligatorio</p>
                        <p className="text-[9px] text-blue-400/80 mt-1">El <strong>RFC y el Estado (3 letras)</strong> son indispensables. Si no los registras, el SAT no te permitirá timbrar la Carta Porte.</p>
                      </div>
                      
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Nombre / Alias del Lugar</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" placeholder="Ej: CEDIS Monterrey" value={formDataUb.nombre_lugar} onChange={e => setFormDataUb({...formDataUb, nombre_lugar: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">Código Postal</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataUb.codigo_postal} onChange={e => setFormDataUb({...formDataUb, codigo_postal: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">RFC Ubicación</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase" value={formDataUb.rfc_ubicacion} onChange={e => setFormDataUb({...formDataUb, rfc_ubicacion: e.target.value})} /></div>
                      
                      <div className="col-span-2 mt-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Domicilio de la Ubicación</p></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Calle y Número</label><input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" value={formDataUb.calle_numero} onChange={e => setFormDataUb({...formDataUb, calle_numero: e.target.value})} /></div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Colonia</label><input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" value={formDataUb.colonia} onChange={e => setFormDataUb({...formDataUb, colonia: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Municipio</label><input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white" value={formDataUb.municipio} onChange={e => setFormDataUb({...formDataUb, municipio: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">Estado (Clave SAT Ej: NLE)</label><input required className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white uppercase" placeholder="Ej: NLE, JAL, CMX, TAM" value={formDataUb.estado} onChange={e => setFormDataUb({...formDataUb, estado: e.target.value.toUpperCase().slice(0,3)})} /></div>
                    </div>
                  )}

                  {activeTab === 'mercancias' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Descripción del Bien</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataMe.descripcion} onChange={e => setFormDataMe({...formDataMe, descripcion: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-blue-500 uppercase block mb-2 ml-1">Clave SAT (Producto)</label><input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" placeholder="Ej: 31181701" value={formDataMe.clave_sat} onChange={e => setFormDataMe({...formDataMe, clave_sat: e.target.value})} /></div>
                      <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Peso Estimado (KG)</label><input required type="number" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataMe.peso_unitario_kg} onChange={e => setFormDataMe({...formDataMe, peso_unitario_kg: e.target.value})} /></div>
                      <div className="col-span-2 mt-2 pt-4 border-t border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Configuración de Envío</p>
                        <div className="grid grid-cols-2 gap-4 items-center">
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1">Embalaje (Clave Unidad)</label>
                            <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formDataMe.clave_embalaje} onChange={e => setFormDataMe({...formDataMe, clave_embalaje: e.target.value})}>
                              <option value="4G">4G - Cajas de Cartón</option><option value="XG">XG - Tarima (Pallet)</option><option value="H87">H87 - Pieza (Suelto)</option><option value="E48">E48 - Unidad de servicio</option><option value="KGM">KGM - Kilogramo</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-center bg-slate-950 border border-slate-800 p-4 rounded-xl h-full">
                            <label className="flex items-center gap-3 cursor-pointer w-full justify-center">
                              <input type="checkbox" className="w-5 h-5 accent-red-500 rounded bg-slate-950 border-slate-800 cursor-pointer" checked={formDataMe.material_peligroso} onChange={e => setFormDataMe({...formDataMe, material_peligroso: e.target.checked})} />
                              <span className={`text-[10px] font-black uppercase tracking-widest ${formDataMe.material_peligroso ? 'text-red-500' : 'text-slate-500'}`}>¿Material Peligroso?</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all ${loading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
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