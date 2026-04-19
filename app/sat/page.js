'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, ShieldCheck, MapPin, PlusCircle, 
  Trash2, Edit2, X, Save, Building2, Package, Truck, Users,
  Lock, FileKey, AlertTriangle, CheckCircle, Image as ImageIcon, FileText, UploadCloud, Loader2,
  Search, ArrowUpDown, ChevronUp, ChevronDown, Calendar
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/toastprovider';
import { fetchSafe } from '@/lib/fetchSafe';
import { notifyOffline } from '@/lib/notifyOffline';

const DOCS_OPERADOR = [
  { id: 'doc_ine', label: 'INE / Identificación', icon: User },
  { id: 'doc_licencia', label: 'Licencia de Conducir', icon: ShieldCheck },
  { id: 'doc_comprobante_domicilio', label: 'Comprobante de Domicilio', icon: MapPin },
  { id: 'doc_estudios', label: 'Comprobante de Estudios', icon: FileText },
  { id: 'doc_acta_nacimiento', label: 'Acta de Nacimiento', icon: FileText },
  { id: 'doc_curp', label: 'CURP', icon: FileKey },
  { id: 'doc_rfc', label: 'RFC (Constancia)', icon: Building2 },
  { id: 'doc_nss', label: '# Seguro Social (NSS)', icon: Lock },
];

const extraerSerieCER = async (archivoCer) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new Uint8Array(e.target.result);
      let hex = '';
      for (let i = 0; i < view.length; i++) {
        hex += view[i].toString(16).padStart(2, '0');
      }
      const match = hex.match(/(3[0-9]){20}/);
      if (match) {
        const serialHex = match[0];
        let serial = '';
        for (let i = 0; i < serialHex.length; i += 2) {
          serial += String.fromCharCode(parseInt(serialHex.substring(i, i + 2), 16));
        }
        resolve(serial);
      } else {
        reject(new Error('No se detectó un número de serie válido del SAT en este archivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo .cer'));
    reader.readAsArrayBuffer(archivoCer);
  });
};

const formatearFecha = (fechaISO) => {
  if (!fechaISO) return '---';
  return new Date(fechaISO).toLocaleDateString('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
};

export default function SATConfigPage() {
  const { mostrarAlerta } = useToast();
  const [dialogoConfirmacion, setDialogoConfirmacion] = useState({ visible: false, mensaje: '', accion: null });
  const [sesion, setSesion] = useState(null);
  const [activeTab, setActiveTab] = useState('operadores');
  const [loading, setLoading] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tabOperador, setTabOperador] = useState('ficha');

  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ columna: 'created_at', direccion: 'desc' });

  const [operadores, setOperadores] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [mercancias, setMercancias] = useState([]);
  const [remolques, setRemolques] = useState([]);
  const [clientes, setClientes] = useState([]); 
  const [perfilFiscal, setPerfilFiscal] = useState({ 
    razon_social: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', tiene_csd: false, logo_base64: '',
    calle_numero: '', colonia: '', municipio: '', estado: '', no_certificado: '' 
  });

  const [cerFile, setCerFile] = useState(null);
  const [empresaId, setEmpresaId] = useState(null); 
  const [rolUsuario, setRolUsuario] = useState('miembro');

  const [formDataOp, setFormDataOp] = useState({ 
    nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '',
    doc_ine: '', doc_licencia: '', doc_comprobante_domicilio: '', doc_estudios: '',
    doc_acta_nacimiento: '', doc_curp: '', doc_rfc: '', doc_nss: ''
  });
  const [formDataUb, setFormDataUb] = useState({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', calle_numero: '', colonia: '' });
  
  // SEPARACIÓN EXPLÍCITA DE UNIDAD Y EMBALAJE
  const [formDataMe, setFormDataMe] = useState({ 
    descripcion: '', clave_sat: '', clave_unidad: 'H87', peso_unitario_kg: '', clave_embalaje: 'Z01', material_peligroso: false 
  });
  
  const [formDataRe, setFormDataRe] = useState({ numero_economico: '', placas: '', tipo_placa: 'Federal', subtipo_remolque: 'CTR002' });
  const [formDataCl, setFormDataCl] = useState({ 
    nombre: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', dias_credito: 0, uso_cfdi: 'G03',
    calle_numero: '', colonia: '', municipio: '', estado: ''
  });

  const [editandoId, setEditandoId] = useState(null);
  const [importingInfo, setImportingInfo] = useState(false);
  const [validandoSAT, setValidandoSAT] = useState(false);

  const manejarOrden = (columna) => {
    setOrden(prev => ({
      columna,
      direccion: prev.columna === columna && prev.direccion === 'asc' ? 'desc' : 'asc'
    }));
  };

  const IconoOrden = ({ columna }) => {
    if (orden.columna !== columna) return <ArrowUpDown size={12} className="text-slate-300 opacity-50 ml-1 inline" />;
    return orden.direccion === 'asc' 
      ? <ChevronUp size={12} className="text-blue-600 ml-1 inline" /> 
      : <ChevronDown size={12} className="text-blue-600 ml-1 inline" />;
  };

  const procesarDatos = (datos) => {
    if (!datos) return [];
    let procesados = [...datos];

    if (busqueda.trim() !== '') {
      const b = busqueda.toLowerCase();
      procesados = procesados.filter(item => 
        Object.values(item).some(val => val && String(val).toLowerCase().includes(b))
      );
    }

    if (orden.columna) {
      procesados.sort((a, b) => {
        let valA = a[orden.columna];
        let valB = b[orden.columna];
        if (!valA) valA = '';
        if (!valB) valB = '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return orden.direccion === 'asc' ? -1 : 1;
        if (valA > valB) return orden.direccion === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return procesados;
  };

  useEffect(() => {
    setBusqueda('');
    setOrden({ columna: 'created_at', direccion: 'desc' });
  }, [activeTab]);


  const pedirConfirmacion = (mensaje, accion) => setDialogoConfirmacion({ visible: true, mensaje, accion });
  const ejecutarConfirmacion = async () => { if (dialogoConfirmacion.accion) await dialogoConfirmacion.accion(); setDialogoConfirmacion({ visible: false, mensaje: '', accion: null }); };

  const descargarPlantillaMaestra = () => {
    const wb = XLSX.utils.book_new();
    const estructuras = {
      'operadores': ['nombre_completo', 'rfc', 'numero_licencia', 'vencimiento_licencia', 'telefono'],
      'remolques': ['numero_economico', 'placas', 'tipo_placa', 'subtipo_remolque'],
      'clientes': ['nombre', 'rfc', 'regimen_fiscal', 'codigo_postal', 'dias_credito', 'uso_cfdi', 'calle_numero', 'colonia', 'municipio', 'estado'],
      'ubicaciones': ['nombre_lugar', 'rfc_ubicacion', 'codigo_postal', 'estado', 'municipio', 'calle_numero', 'colonia'],
      'mercancias': ['descripcion', 'clave_sat', 'clave_unidad', 'peso_unitario_kg', 'clave_embalaje', 'material_peligroso']
    };

    for (const [nombreHoja, headers] of Object.entries(estructuras)) {
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    }
    XLSX.writeFile(wb, 'Plantilla_FleetForce_General.xlsx');
  };

  const handleFileUploadExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      mostrarAlerta("Formato incorrecto. Sube un archivo de Excel (.xlsx)", "error");
      e.target.value = null; return;
    }

    setImportingInfo(true);
    const reader = new FileReader();
    
    reader.onload = async (evento) => {
      try {
        const data = new Uint8Array(evento.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames.includes(activeTab)) throw new Error(`Falta pestaña '${activeTab}' en el Excel.`);
        const worksheet = workbook.Sheets[activeTab];
        const registros = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (registros.length === 0) throw new Error(`La pestaña '${activeTab}' está vacía.`);

        const payloadMasivo = registros.map(reg => {
          let limpio = { empresa_id: empresaId, activo: true };
          for (const key in reg) limpio[key.trim()] = String(reg[key]).trim(); 
          if (activeTab === 'operadores' && limpio.rfc) limpio.rfc = limpio.rfc.toUpperCase();
          if (activeTab === 'clientes' && limpio.rfc) limpio.rfc = limpio.rfc.toUpperCase();
          if (activeTab === 'remolques' && limpio.placas) limpio.placas = limpio.placas.toUpperCase();
          if (activeTab === 'ubicaciones' && limpio.rfc_ubicacion) limpio.rfc_ubicacion = limpio.rfc_ubicacion.toUpperCase();
          if (activeTab === 'mercancias' && limpio.material_peligroso) {
            const matPel = String(limpio.material_peligroso).toLowerCase();
            limpio.material_peligroso = (matPel === 'true' || matPel === '1' || matPel === 'sí' || matPel === 'si');
          }
          return limpio;
        });

        const { error } = await supabase.from(activeTab).insert(payloadMasivo);
        if (error) throw error;
        mostrarAlerta(`${payloadMasivo.length} registros importados.`, "exito");
        cargarDatos(sesion.user.id);
      } catch (err) {
        mostrarAlerta(`Error: ${err.message}`, "error");
      } finally {
        setImportingInfo(false); e.target.value = null; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const tituloSingular = { operadores: 'Operador', remolques: 'Remolque', ubicaciones: 'Ubicación', mercancias: 'Mercancía', clientes: 'Cliente' };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setSesion(session); cargarDatos(session.user.id); }
    });
  }, [activeTab]);

  async function cargarDatos(userId) {
    setLoading(true);
    try {
      const { data: perfilData, offline: offP } = await fetchSafe(
        supabase.from('perfiles').select('empresa_id, rol').eq('id', userId).single(),
        `perfil_${userId}`
      );
      if (offP) notifyOffline();
      const idInstitucion = perfilData?.empresa_id || userId;
      setEmpresaId(idInstitucion);
      if (perfilData?.rol) setRolUsuario(perfilData.rol);

      if (activeTab === 'fiscal') {
        const { data, offline } = await fetchSafe(
          supabase.from('perfil_emisor').select('*').eq('empresa_id', idInstitucion).single(),
          `perfil_emisor_${idInstitucion}`
        );
        if (offline) notifyOffline();
        if (data) setPerfilFiscal({...data, razon_social: data.razon_social||'', rfc: data.rfc||'', codigo_postal: data.codigo_postal||''});
      } else {
        const { data, offline } = await fetchSafe(
          supabase.from(activeTab).select('*').eq('empresa_id', idInstitucion).eq('activo', true).order('created_at', { ascending: false }),
          `${activeTab}_${idInstitucion}`
        );
        if (offline) notifyOffline();
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
    setValidandoSAT(true);

    let payload = {};

    if (activeTab === 'operadores') payload = { ...formDataOp, empresa_id: empresaId, rfc: formDataOp.rfc.toUpperCase() };
    if (activeTab === 'ubicaciones') payload = { ...formDataUb, empresa_id: empresaId, rfc_ubicacion: formDataUb.rfc_ubicacion.toUpperCase() };
    if (activeTab === 'mercancias') payload = { ...formDataMe, empresa_id: empresaId };
    if (activeTab === 'remolques') payload = { ...formDataRe, empresa_id: empresaId, placas: formDataRe.placas.toUpperCase() };
    if (activeTab === 'clientes') payload = { ...formDataCl, empresa_id: empresaId, rfc: formDataCl.rfc.toUpperCase() };

    try {
        if (activeTab === 'mercancias') {
            payload.clave_sat = payload.clave_sat.trim();

            if (!/^\d{8}$/.test(payload.clave_sat)) {
                throw new Error("🚨 ERROR DE SINTAXIS: La Clave SAT debe ser de 8 números exactos.");
            }

            // 1. CONSULTAR AL INSPECTOR DE FACTURAPI
            const resVal = await fetch('/api/facturapi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sesion.access_token}` },
                body: JSON.stringify({ endpoint: `catalogs/products?q=${payload.clave_sat}`, method: 'GET' })
            });

            const dataVal = await resVal.json();

            // 🛡️ BLINDAJE ROBUSTO DE RED Y LLAVES
            if (!resVal.ok || dataVal.error || dataVal.message) {
                const motivoRechazo = dataVal.message || dataVal.error || 'Acceso Denegado / Sin Llaves Fiscales';
                throw new Error(`🔌 ERROR DE CONEXIÓN O LLAVES: No pudimos validar la clave en el SAT. Motivo: ${motivoRechazo}.`);
            }
            
            // 2. BUSCAR EXACTAMENTE EL CÓDIGO (Ya corregido a item.key)
            const productoEncontrado = dataVal.data && dataVal.data.find(item => item.key === payload.clave_sat);

            if (!productoEncontrado) {
                throw new Error(`🚨 RECHAZO SAT (Catálogo Producto): La clave ${payload.clave_sat} NO EXISTE en el catálogo oficial.`);
            }

            // 3. VALIDACIÓN DE PELIGROSIDAD
            const nivelPeligroSAT = String(productoEncontrado.hazardous_material || "0,1"); 

            if (payload.material_peligroso) {
                if (nivelPeligroSAT === "0") {
                    throw new Error(`🛑 ERROR MATERIAL PELIGROSO: El SAT dictamina que la clave ${payload.clave_sat} es estrictamente "NO Peligrosa". Desmarca la casilla.`);
                }
                if (!payload.clave_embalaje || payload.clave_embalaje === "Z01") {
                    throw new Error(`🛑 ERROR DE EMBALAJE: Al ser material peligroso, el SAT TE EXIGE seleccionar un Tipo de Embalaje físico válido.`);
                }
            } else {
                if (nivelPeligroSAT === "1") {
                    throw new Error(`🛑 ERROR MATERIAL PELIGROSO: El SAT dictamina que la clave ${payload.clave_sat} es estrictamente "PELIGROSA". Estás OBLIGADO a marcar la casilla y elegir un embalaje.`);
                }
            }
        }

        if (activeTab === 'clientes' || activeTab === 'operadores') {
            const rfc = activeTab === 'clientes' ? payload.rfc : payload.rfc;
            const rfcRegex = /^([A-ZÑ&]{3,4})\d{6}([A-Z0-9]{3})$/i;
            if (rfc !== 'XAXX010101000' && rfc !== 'XEXX010101000' && !rfcRegex.test(rfc)) {
                throw new Error(`El RFC "${rfc}" tiene un formato inválido.`);
            }
        }
        
        const { error } = editandoId 
            ? await supabase.from(activeTab).update(payload).eq('id', editandoId) 
            : await supabase.from(activeTab).insert([payload]);

        if (error) throw error;

        mostrarAlerta("✅ Registro validado y guardado exitosamente.", "exito");
        cerrarModal(); 
        cargarDatos(sesion.user.id); 

    } catch (error) {
        mostrarAlerta("🛑 " + error.message, "error");
    } finally {
        setLoading(false);
        setValidandoSAT(false);
    }
  };

  const guardarPerfilFiscal = async () => { 
    setLoading(true);
    const { error } = await supabase.from('perfil_emisor').upsert({ 
        ...perfilFiscal, empresa_id: empresaId, rfc: perfilFiscal.rfc.toUpperCase(), updated_at: new Date().toISOString()
    });
    if (error) mostrarAlerta(error.message, "error");
    else mostrarAlerta("Configuración Fiscal Guardada.", "exito");
    setLoading(false);
  };

  const handleCargaCer = async (e) => { 
    const file = e.target.files[0];
    if (!file) return;
    setCerFile(file);
    try {
      const numCer = await extraerSerieCER(file);
      setPerfilFiscal(prev => ({ ...prev, no_certificado: numCer }));
      mostrarAlerta(`Certificado leído: ${numCer}`, "exito");
    } catch (err) { mostrarAlerta(err.message, "error"); e.target.value = null; setCerFile(null); }
  };

  const eliminarRegistro = (id) => {
    pedirConfirmacion("¿Deseas dar de baja (archivar) este registro? Ya no aparecerá para crear nuevos viajes.", async () => {
      setLoading(true);
      try {
        const { error } = await supabase.from(activeTab).update({ activo: false }).eq('id', id);
        if (error) throw error;
        mostrarAlerta("Registro archivado exitosamente.", "exito");
        cargarDatos(empresaId || sesion.user.id);
      } catch (error) { mostrarAlerta("Error al archivar: " + error.message, "error"); }
      setLoading(false);
    });
  };

  const cerrarModal = () => {
    setMostrarModal(false); setEditandoId(null); setTabOperador('ficha');
    setFormDataOp({ nombre_completo: '', rfc: '', numero_licencia: '', vencimiento_licencia: '', telefono: '', doc_ine: '', doc_licencia: '', doc_comprobante_domicilio: '', doc_estudios: '', doc_acta_nacimiento: '', doc_curp: '', doc_rfc: '', doc_nss: '' });
    setFormDataUb({ nombre_lugar: '', rfc_ubicacion: '', codigo_postal: '', estado: '', municipio: '', calle_numero: '', colonia: '' });
    // Aseguramos valores por defecto limpios
    setFormDataMe({ descripcion: '', clave_sat: '', clave_unidad: 'H87', peso_unitario_kg: '', clave_embalaje: 'Z01', material_peligroso: false });
    setFormDataRe({ numero_economico: '', placas: '', tipo_placa: 'Federal', subtipo_remolque: 'CTR002' });
    setFormDataCl({ nombre: '', rfc: '', regimen_fiscal: '601', codigo_postal: '', dias_credito: 0, uso_cfdi: 'G03', calle_numero: '', colonia: '', municipio: '', estado: '' });
  };

  const editarCliente = (cl) => { setEditandoId(cl.id); setFormDataCl({ nombre: cl.nombre || '', rfc: cl.rfc || '', regimen_fiscal: cl.regimen_fiscal || '601', codigo_postal: cl.codigo_postal || '', dias_credito: cl.dias_credito || 0, uso_cfdi: cl.uso_cfdi || 'G03', calle_numero: cl.calle_numero || '', colonia: cl.colonia || '', municipio: cl.municipio || '', estado: cl.estado || '' }); setMostrarModal(true); };
  const editarOperador = (op) => { setEditandoId(op.id); setFormDataOp({ nombre_completo: op.nombre_completo || '', rfc: op.rfc || '', numero_licencia: op.numero_licencia || '', vencimiento_licencia: op.vencimiento_licencia || '', telefono: op.telefono || '', doc_ine: op.doc_ine || '', doc_licencia: op.doc_licencia || '', doc_comprobante_domicilio: op.doc_comprobante_domicilio || '', doc_estudios: op.doc_estudios || '', doc_acta_nacimiento: op.doc_acta_nacimiento || '', doc_curp: op.doc_curp || '', doc_rfc: op.doc_rfc || '', doc_nss: op.doc_nss || '' }); setTabOperador('ficha'); setMostrarModal(true); };
  const editarRemolque = (r) => { setEditandoId(r.id); setFormDataRe({ numero_economico: r.numero_economico || '', placas: r.placas || '', tipo_placa: r.tipo_placa || 'Federal', subtipo_remolque: r.subtipo_remolque || 'CTR002' }); setMostrarModal(true); };
  const editarUbicacion = (ub) => { setEditandoId(ub.id); setFormDataUb({ nombre_lugar: ub.nombre_lugar || '', rfc_ubicacion: ub.rfc_ubicacion || '', codigo_postal: ub.codigo_postal || '', estado: ub.estado || '', municipio: ub.municipio || '', calle_numero: ub.calle_numero || '', colonia: ub.colonia || '' }); setMostrarModal(true); };
  
  const editarMercancia = (me) => { 
    setEditandoId(me.id); 
    setFormDataMe({ 
        descripcion: me.descripcion || '', 
        clave_sat: me.clave_sat || '', 
        clave_unidad: me.clave_unidad || 'H87', 
        peso_unitario_kg: me.peso_unitario_kg || '', 
        clave_embalaje: me.clave_embalaje || 'Z01', 
        material_peligroso: me.material_peligroso || false 
    }); 
    setMostrarModal(true); 
  };

  const verificarVigencia = (fecha) => {
    if (!fecha) return { texto: 'Sin registro', color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200' };
    const hoy = new Date(); const fechaVenc = new Date(fecha + 'T23:59:59');
    const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
    if (diasRestantes < 0) return { texto: 'Vencida', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
    if (diasRestantes <= 30) return { texto: `${diasRestantes} días`, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
    return { texto: 'Vigente', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  };

  const getSubtipoRemolque = (clave) => {
    const catalogo = { "CTR001": "Caja Seca (Camión)", "CTR002": "Caja Seca (Tráiler)", "CTR003": "Caja Refrigerada", "CTR004": "Plataforma", "CTR005": "Cama Baja", "CTR006": "Portacontenedor", "CTR008": "Tolva", "CTR010": "Tanque", "CTR012": "Góndola" };
    return catalogo[clave] || clave;
  };

  if (!sesion) return null;

  return (
    <div className="flex bg-transparent min-h-screen text-slate-900 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-8 sm:mb-10 transition-colors">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 leading-none transition-colors">Cumplimiento <span className="text-blue-600">SAT</span></h1>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-2 transition-colors">Configuración Carta Porte 3.1</p>
          </header>

          <div className="flex flex-wrap gap-2 mb-8 sm:mb-10 bg-white/50 p-1.5 rounded-2xl border border-slate-200 w-fit backdrop-blur-md transition-colors">
            {[ 
              { id: 'operadores', label: 'Operadores', icon: User },
               { id: 'remolques', label: 'Remolques', icon: Truck }, 
               { id: 'ubicaciones', label: 'Ubicaciones', icon: MapPin }, 
               { id: 'mercancias', label: 'Mercancías', icon: Package }, 
               { id: 'clientes', label: 'Receptor (Clientes)', icon: Users }, 
               { id: 'fiscal', label: 'Emisor Fiscal', icon: ShieldCheck } ]
            .filter(tab => {
              const esAdmin = rolUsuario === 'administrador' || rolUsuario === 'admin';   
              if (esAdmin) return true;
              return tab.id !== 'fiscal' && tab.id !== 'clientes';
            })
            .map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${ activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-700' }`}>
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== 'fiscal' ? (
            <div className="animate-in fade-in duration-500">

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 px-2 transition-colors">
                
                <div className="relative w-full sm:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    placeholder={`Buscar en ${tituloSingular[activeTab]}...`} 
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                  />
                </div>
                
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <button onClick={descargarPlantillaMaestra} className="text-slate-500 hover:text-emerald-600 font-black uppercase text-[9px] tracking-widest transition-colors flex items-center gap-1" title="Descargar plantilla general">
                    <FileText size={14}/> Plantilla (.xlsx)
                  </button>
                  
                  <label className={`cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 sm:px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all border border-slate-200 ${importingInfo ? 'opacity-50 pointer-events-none' : ''}`}>
                    {importingInfo ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    {importingInfo ? 'Procesando...' : 'Subir Excel'}
                    <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUploadExcel} disabled={importingInfo} />
                  </label>

                  <button onClick={() => setMostrarModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 sm:px-5 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20">
                    <PlusCircle size={14} /> Registrar {tituloSingular[activeTab]}
                  </button>
                </div>
              </div>

              {/* TABLA ELEGANTE CON ORDENAMIENTO */}
              <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm transition-colors">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {activeTab === 'operadores' && (
                          <>
                            <th onClick={() => manejarOrden('nombre_completo')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Operador <IconoOrden columna="nombre_completo"/></th>
                            <th onClick={() => manejarOrden('numero_licencia')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Licencia <IconoOrden columna="numero_licencia"/></th>
                            <th onClick={() => manejarOrden('vencimiento_licencia')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Vigencia <IconoOrden columna="vencimiento_licencia"/></th>
                            <th onClick={() => manejarOrden('created_at')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"><Calendar size={12} className="inline mr-1 mb-0.5"/>Fecha Alta <IconoOrden columna="created_at"/></th>
                            <th className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Acciones</th>
                          </>
                        )}
                        {activeTab === 'clientes' && (
                          <>
                            <th onClick={() => manejarOrden('nombre')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Razón Social <IconoOrden columna="nombre"/></th>
                            <th onClick={() => manejarOrden('regimen_fiscal')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Régimen <IconoOrden columna="regimen_fiscal"/></th>
                            <th onClick={() => manejarOrden('codigo_postal')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">C.P. <IconoOrden columna="codigo_postal"/></th>
                            <th onClick={() => manejarOrden('created_at')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"><Calendar size={12} className="inline mr-1 mb-0.5"/>Fecha Alta <IconoOrden columna="created_at"/></th>
                            <th className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Acciones</th>
                          </>
                        )}
                        {activeTab === 'remolques' && (
                          <>
                            <th onClick={() => manejarOrden('numero_economico')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Identificador <IconoOrden columna="numero_economico"/></th>
                            <th onClick={() => manejarOrden('placas')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Placas <IconoOrden columna="placas"/></th>
                            <th onClick={() => manejarOrden('subtipo_remolque')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Tipo Remolque <IconoOrden columna="subtipo_remolque"/></th>
                            <th onClick={() => manejarOrden('created_at')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"><Calendar size={12} className="inline mr-1 mb-0.5"/>Fecha Alta <IconoOrden columna="created_at"/></th>
                            <th className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Acciones</th>
                          </>
                        )}
                        {activeTab === 'ubicaciones' && (
                          <>
                            <th onClick={() => manejarOrden('nombre_lugar')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Ubicación <IconoOrden columna="nombre_lugar"/></th>
                            <th onClick={() => manejarOrden('codigo_postal')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">C.P. <IconoOrden columna="codigo_postal"/></th>
                            <th onClick={() => manejarOrden('estado')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Estado/Mpio <IconoOrden columna="estado"/></th>
                            <th onClick={() => manejarOrden('created_at')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"><Calendar size={12} className="inline mr-1 mb-0.5"/>Fecha Alta <IconoOrden columna="created_at"/></th>
                            <th className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Acciones</th>
                          </>
                        )}
                        {activeTab === 'mercancias' && (
                          <>
                            <th onClick={() => manejarOrden('descripcion')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">Descripción del Bien <IconoOrden columna="descripcion"/></th>
                            {/* NUEVAS COLUMNAS SEPARADAS */}
                            <th onClick={() => manejarOrden('clave_unidad')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors border-l border-slate-100">Unidad de Medida <IconoOrden columna="clave_unidad"/></th>
                            <th onClick={() => manejarOrden('clave_embalaje')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors border-l border-slate-100">Tipo Embalaje <IconoOrden columna="clave_embalaje"/></th>
                            <th onClick={() => manejarOrden('created_at')} className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors border-l border-slate-100"><Calendar size={12} className="inline mr-1 mb-0.5"/>Fecha Alta <IconoOrden columna="created_at"/></th>
                            <th className="p-4 sm:px-6 text-[9px] font-black uppercase tracking-widest text-slate-500 text-right border-l border-slate-100">Acciones</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      
                      {activeTab === 'operadores' && procesarDatos(operadores).length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 text-xs uppercase font-bold">No se encontraron resultados</td></tr>}
                      {activeTab === 'operadores' && procesarDatos(operadores).map(op => {
                        const vigencia = verificarVigencia(op.vencimiento_licencia);
                        return (
                          <tr key={op.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><User size={16}/></div>
                                <div>
                                  <p className="text-xs font-black uppercase text-slate-900">{op.nombre_completo}</p>
                                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{op.rfc}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 sm:px-6 text-[11px] font-mono text-slate-600 uppercase">{op.numero_licencia || '---'}</td>
                            <td className="p-4 sm:px-6">
                              <span className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border ${vigencia.bg} ${vigencia.color}`}>{vigencia.texto}</span>
                            </td>
                            <td className="p-4 sm:px-6 text-[10px] font-mono font-medium text-slate-500">{formatearFecha(op.created_at)}</td>
                            <td className="p-4 sm:px-6 text-right">
                              <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => editarOperador(op)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-100 rounded-lg"><Edit2 size={14}/></button>
                                <button onClick={() => eliminarRegistro(op.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 rounded-lg"><Trash2 size={14}/></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {activeTab === 'clientes' && procesarDatos(clientes).length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 text-xs uppercase font-bold">No se encontraron resultados</td></tr>}
                      {activeTab === 'clientes' && procesarDatos(clientes).map(cl => (
                        <tr key={cl.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Users size={16}/></div>
                              <div>
                                <p className="text-xs font-black uppercase text-slate-900 truncate max-w-[200px]">{cl.nombre}</p>
                                <p className="text-[10px] font-mono text-slate-500 mt-0.5">{cl.rfc || 'SIN RFC'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 sm:px-6 text-[10px] font-bold text-slate-600 uppercase">Reg: {cl.regimen_fiscal}</td>
                          <td className="p-4 sm:px-6 text-[11px] font-mono text-slate-600">{cl.codigo_postal || '---'}</td>
                          <td className="p-4 sm:px-6 text-[10px] font-mono font-medium text-slate-500">{formatearFecha(cl.created_at)}</td>
                          <td className="p-4 sm:px-6 text-right">
                            <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => editarCliente(cl)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-100 rounded-lg"><Edit2 size={14}/></button>
                              <button onClick={() => eliminarRegistro(cl.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 rounded-lg"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {activeTab === 'remolques' && procesarDatos(remolques).length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 text-xs uppercase font-bold">No se encontraron resultados</td></tr>}
                      {activeTab === 'remolques' && procesarDatos(remolques).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Truck size={16}/></div>
                              <p className="text-xs font-black uppercase text-slate-900">{r.numero_economico}</p>
                            </div>
                          </td>
                          <td className="p-4 sm:px-6 text-[11px] font-mono font-bold text-slate-600 uppercase">{r.placas}</td>
                          <td className="p-4 sm:px-6 text-[10px] font-bold text-slate-600 uppercase">{getSubtipoRemolque(r.subtipo_remolque)}</td>
                          <td className="p-4 sm:px-6 text-[10px] font-mono font-medium text-slate-500">{formatearFecha(r.created_at)}</td>
                          <td className="p-4 sm:px-6 text-right">
                            <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => editarRemolque(r)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-100 rounded-lg"><Edit2 size={14}/></button>
                              <button onClick={() => eliminarRegistro(r.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 rounded-lg"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {activeTab === 'ubicaciones' && procesarDatos(ubicaciones).length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 text-xs uppercase font-bold">No se encontraron resultados</td></tr>}
                      {activeTab === 'ubicaciones' && procesarDatos(ubicaciones).map(ub => (
                        <tr key={ub.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><MapPin size={16}/></div>
                              <p className="text-xs font-black uppercase text-slate-900">{ub.nombre_lugar}</p>
                            </div>
                          </td>
                          <td className="p-4 sm:px-6 text-[11px] font-mono font-bold text-slate-600">{ub.codigo_postal}</td>
                          <td className="p-4 sm:px-6 text-[10px] font-bold text-slate-600 uppercase">{ub.municipio ? `${ub.estado} / ${ub.municipio}` : ub.estado}</td>
                          <td className="p-4 sm:px-6 text-[10px] font-mono font-medium text-slate-500">{formatearFecha(ub.created_at)}</td>
                          <td className="p-4 sm:px-6 text-right">
                            <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => editarUbicacion(ub)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-100 rounded-lg"><Edit2 size={14}/></button>
                              <button onClick={() => eliminarRegistro(ub.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 rounded-lg"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* RENDERIZADO VISUALMENTE SEPARADO PARA MERCANCÍAS */}
                      {activeTab === 'mercancias' && procesarDatos(mercancias).length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400 text-xs uppercase font-bold">No se encontraron resultados</td></tr>}
                      {activeTab === 'mercancias' && procesarDatos(mercancias).map(me => (
                        <tr key={me.id} className={`hover:bg-slate-50 transition-colors group ${me.material_peligroso ? 'bg-red-50/30' : ''}`}>
                          <td className="p-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${me.material_peligroso ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                <Package size={16}/>
                              </div>
                              <div>
                                <p className="text-xs font-black uppercase text-slate-900 truncate max-w-[250px]">{me.descripcion}</p>
                                <p className="text-[10px] font-mono text-slate-500 mt-0.5">SAT: {me.clave_sat}</p>
                                {me.material_peligroso && <span className="text-[8px] text-red-600 bg-red-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest mt-1 inline-block">Material Peligroso</span>}
                              </div>
                            </div>
                          </td>
                          {/* COLUMNA EXCLUSIVA PARA UNIDAD */}
                          <td className="p-4 sm:px-6 border-l border-slate-100">
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-md">{me.clave_unidad || 'H87'}</span>
                          </td>
                          {/* COLUMNA EXCLUSIVA PARA EMBALAJE */}
                          <td className="p-4 sm:px-6 border-l border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-3 py-1 rounded-md">{me.clave_embalaje || 'Z01'}</span>
                          </td>
                          <td className="p-4 sm:px-6 text-[10px] font-mono font-medium text-slate-500 border-l border-slate-100">{formatearFecha(me.created_at)}</td>
                          <td className="p-4 sm:px-6 text-right border-l border-slate-100">
                            <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => editarMercancia(me)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-100 rounded-lg"><Edit2 size={14}/></button>
                              <button onClick={() => eliminarRegistro(me.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 rounded-lg"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            // =========================================================
            // PESTAÑA EMISOR FISCAL 
            // =========================================================
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 transition-colors">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-[2.5rem] flex flex-col shadow-sm transition-colors">
                  <Building2 className="text-blue-600 mb-5 transition-colors" size={32} />
                  <h3 className="text-xl font-black text-slate-900 italic uppercase mb-1 transition-colors">Perfil del <span className="text-blue-600">Transportista</span></h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6 transition-colors">Datos de Facturación</p>
                  
                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block transition-colors">Razón Social</label>
                      <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm text-slate-900 outline-none focus:border-blue-500 uppercase transition-colors" 
                        value={perfilFiscal.razon_social} onChange={e => setPerfilFiscal({...perfilFiscal, razon_social: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block transition-colors">RFC</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm text-slate-900 uppercase font-mono transition-colors" 
                          value={perfilFiscal.rfc} onChange={e => setPerfilFiscal({...perfilFiscal, rfc: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block transition-colors">CP Fiscal</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm text-slate-900 transition-colors" 
                          value={perfilFiscal.codigo_postal} onChange={e => setPerfilFiscal({...perfilFiscal, codigo_postal: e.target.value})} />
                      </div>
      {/* === NUEVO BLOQUE: RÉGIMEN FISCAL EMISOR === */}
                            <div className="sm:col-span-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block transition-colors">Régimen Fiscal (Emisor)</label>
                              <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm text-slate-900 font-bold transition-colors" 
                                value={perfilFiscal.regimen_fiscal} onChange={e => setPerfilFiscal({...perfilFiscal, regimen_fiscal: e.target.value})}>
                                <option value="601">601 - General de Ley Personas Morales</option>
                                <option value="612">612 - Personas Físicas con Actividad Empresarial y Profesional</option>
                                <option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option>
                                <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
                                <option value="621">621 - Incorporación Fiscal</option>
                              </select>
                            </div>

                    </div>
                    
                    <div className="pt-4 border-t border-slate-200 mt-2 transition-colors">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 transition-colors">Dirección Comercial</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block transition-colors">Calle y Número</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" 
                            placeholder="Ejemplo: Av. Universidad 123" value={perfilFiscal.calle_numero} onChange={e => setPerfilFiscal({...perfilFiscal, calle_numero: e.target.value})} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block transition-colors">Colonia</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" 
                            placeholder="Ejemplo: Centro" value={perfilFiscal.colonia} onChange={e => setPerfilFiscal({...perfilFiscal, colonia: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block transition-colors">Municipio</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" 
                            placeholder="Ejemplo: Monterrey" value={perfilFiscal.municipio} onChange={e => setPerfilFiscal({...perfilFiscal, municipio: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-2 block transition-colors">Estado</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" 
                            placeholder="Ejemplo: Nuevo León" value={perfilFiscal.estado} onChange={e => setPerfilFiscal({...perfilFiscal, estado: e.target.value})} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-[2.5rem] flex flex-col shadow-sm transition-colors">
                  <ImageIcon className="text-orange-500 mb-5 transition-colors" size={32} />
                  <h3 className="text-xl font-black text-slate-900 italic uppercase mb-1 transition-colors">Imagen <span className="text-orange-500">Corporativa</span></h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8 transition-colors">Logotipo para Facturas y Carta Porte</p>
                  
                  <div className="flex flex-col items-center justify-center gap-8 flex-1">
                    <div className="w-48 h-48 sm:w-56 sm:h-56 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden p-4 relative group transition-colors">
                      {perfilFiscal.logo_base64 ? (
                        <img src={perfilFiscal.logo_base64} alt="Logo Empresa" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="text-slate-400 mx-auto mb-2 transition-colors" size={32} />
                          <span className="text-xs text-slate-500 font-black uppercase tracking-widest transition-colors">Sin Logotipo</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="w-full">
                      <label className="w-full flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 transition-colors">
                          <ImageIcon size={14} /> Seleccionar Nueva Imagen
                        </span>
                        <span className="text-[8px] text-slate-500 mt-1 uppercase transition-colors">PNG o JPG (Max 1MB)</span>
                        <input type="file" accept="image/png, image/jpeg" className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 1024 * 1024) return mostrarAlerta("El logo debe pesar menos de 1MB", "error");
                            
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

              <div className="mt-4">
                <button type="button" onClick={guardarPerfilFiscal} disabled={loading} 
                  className={`w-full py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-lg flex justify-center items-center gap-3 transition-all 
                  ${loading ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/20'}`}>
                  <Save size={20}/> {loading ? "Sincronizando..." : "Guardar Datos"}
                </button>
              </div>

            </div>
          )}

          {/* MODALES REUTILIZADOS */}
          {dialogoConfirmacion.visible && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} />
              <div className="relative bg-white border border-slate-200 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 transition-colors">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 transition-colors"><AlertTriangle size={32} /></div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-2 transition-colors">¿Estás Seguro?</h3>
                <p className="text-slate-500 text-sm mb-8 transition-colors">{dialogoConfirmacion.mensaje}</p>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Descartar</button>
                  <button onClick={ejecutarConfirmacion} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-red-600 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">{loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Sí, Proceder"}</button>
                </div>
              </div>
            </div>
          )}

          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md transition-colors" onClick={cerrarModal} />
              
              <div className={`relative bg-white border border-slate-200 w-full ${activeTab === 'operadores' ? 'max-w-4xl' : 'max-w-2xl'} flex flex-col max-h-[90vh] rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 overflow-hidden transition-colors`}>
                
                <div className={`p-6 sm:p-8 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0 transition-colors ${activeTab !== 'operadores' ? 'pb-6' : ''}`}>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 italic uppercase leading-none transition-colors">
                      {activeTab === 'operadores' && editandoId ? `Expediente Operativo` : `Registrar ${tituloSingular[activeTab]}`}
                    </h2>
                    {activeTab === 'operadores' && editandoId && <p className="text-slate-500 text-[11px] font-mono mt-2 text-blue-600 font-bold uppercase tracking-widest transition-colors">{formDataOp.nombre_completo}</p>}
                  </div>
                  <button onClick={cerrarModal} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {activeTab === 'operadores' && (
                  <div className="flex px-4 sm:px-8 border-b border-slate-200 bg-slate-100 shrink-0 overflow-x-auto scrollbar-hide transition-colors">
                    <button onClick={() => setTabOperador('ficha')} className={`py-4 px-4 sm:px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabOperador === 'ficha' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      <User size={14}/> Ficha de Identidad
                    </button>
                    <button onClick={() => setTabOperador('documentos')} className={`py-4 px-4 sm:px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 shrink-0 ${tabOperador === 'documentos' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      <FileText size={14}/> Bóveda Digital
                    </button>
                  </div>
                )}

                <div className="p-4 sm:p-8 overflow-y-auto bg-white flex-1 custom-scrollbar transition-colors">
                  
                  {activeTab !== 'operadores' && (
                    <form onSubmit={guardarRegistro} className="space-y-6">
                      
                      {activeTab === 'clientes' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2 bg-yellow-50 border border-yellow-200 p-4 rounded-xl mb-2 transition-colors"><p className="text-[10px] text-yellow-600 font-bold uppercase tracking-wider flex items-center gap-2 transition-colors">⚠️ Regla CFDI 4.0 del SAT</p><p className="text-[9px] text-yellow-700 mt-1 transition-colors">El Nombre y Código Postal deben capturarse <strong>exactamente</strong> como aparecen en la Constancia de Situación Fiscal. Omite el "S.A. DE C.V.".</p></div>
                          
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Razón Social del Cliente</label><input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 font-bold uppercase transition-colors" value={formDataCl.nombre} onChange={e => setFormDataCl({...formDataCl, nombre: e.target.value.toUpperCase()})} /></div>
                          <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">RFC</label><input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 uppercase font-mono transition-colors" value={formDataCl.rfc} onChange={e => setFormDataCl({...formDataCl, rfc: e.target.value})} /></div>
                          <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">CP Fiscal</label><input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" value={formDataCl.codigo_postal} onChange={e => setFormDataCl({...formDataCl, codigo_postal: e.target.value})} /></div>
                          
                          <div className="sm:col-span-2 mt-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 transition-colors">Domicilio del Cliente</p></div>
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Calle y Número</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" value={formDataCl.calle_numero} onChange={e => setFormDataCl({...formDataCl, calle_numero: e.target.value})} /></div>
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Colonia</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" value={formDataCl.colonia} onChange={e => setFormDataCl({...formDataCl, colonia: e.target.value})} /></div>
                          <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Municipio</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" value={formDataCl.municipio} onChange={e => setFormDataCl({...formDataCl, municipio: e.target.value})} /></div>
                          <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Estado</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" value={formDataCl.estado} onChange={e => setFormDataCl({...formDataCl, estado: e.target.value})} /></div>
                          
                          <div className="sm:col-span-2 mt-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 transition-colors">Datos Fiscales</p></div>
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Régimen Fiscal</label><select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 font-bold transition-colors" value={formDataCl.regimen_fiscal} onChange={e => setFormDataCl({...formDataCl, regimen_fiscal: e.target.value})}><option value="601">601 - General de Ley Personas Morales</option><option value="612">612 - Personas Físicas con Actividad Empresarial</option><option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option></select></div>
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Uso de CFDI</label><select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 font-bold transition-colors" value={formDataCl.uso_cfdi} onChange={e => setFormDataCl({...formDataCl, uso_cfdi: e.target.value})}><option value="G03">G03 - Gastos en general</option><option value="G01">G01 - Adquisición de mercancías</option><option value="S01">S01 - Sin efectos fiscales</option></select></div>
                        </div>
                      )}

                      {activeTab === 'remolques' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Número Económico (Alias)</label><input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 font-bold transition-colors" placeholder="Ejemplo: Caja-01 " value={formDataRe.numero_economico} onChange={e => setFormDataRe({...formDataRe, numero_economico: e.target.value})} /></div>
                          
                          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                            <select className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 w-full sm:w-1/3 transition-colors" value={formDataRe.tipo_placa} onChange={e => setFormDataRe({...formDataRe, tipo_placa: e.target.value})}>
                              <option value="Federal">Federal</option>
                              <option value="Estatal">Estatal</option>
                            </select>
                            <input required className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 uppercase font-mono transition-colors" placeholder="Placas (Ejemplo: 456ABC)" value={formDataRe.placas} onChange={e => setFormDataRe({...formDataRe, placas: e.target.value})} />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Tipo de Remolque (Catálogo SAT 3.1)</label>
                            <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" value={formDataRe.subtipo_remolque} onChange={e => setFormDataRe({...formDataRe, subtipo_remolque: e.target.value})}>
                              <option value="CTR001">CTR001 - Caja Seca (Camión / Rabón)</option>
                              <option value="CTR002">CTR002 - Caja Seca (Tráiler / Full)</option>
                              <option value="CTR003">CTR003 - Caja Refrigerada</option>
                              <option value="CTR004">CTR004 - Plataforma</option>
                              <option value="CTR005">CTR005 - Cama Baja</option>
                              <option value="CTR006">CTR006 - Chasis Portacontenedor</option>
                              <option value="CTR008">CTR008 - Tolva</option>
                              <option value="CTR010">CTR010 - Tanque (Pipa)</option>
                              <option value="CTR012">CTR012 - Góndola / Madrina</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {activeTab === 'ubicaciones' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2 bg-blue-50 border border-blue-200 p-4 rounded-xl mb-2 transition-colors">
                            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider flex items-center gap-2 transition-colors">⚠️ Dato Obligatorio</p>
                            <p className="text-[9px] text-blue-700 mt-1 transition-colors">El <strong>RFC y el Estado (3 letras)</strong> son indispensables. Si no los registras, el SAT no te permitirá timbrar la Carta Porte.</p>
                          </div>
                          
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Nombre / Alias del Lugar</label><input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" placeholder="Ejemplo: CEDIS Monterrey" value={formDataUb.nombre_lugar} onChange={e => setFormDataUb({...formDataUb, nombre_lugar: e.target.value})} /></div>
                          <div><label className="text-[9px] font-black text-blue-600 uppercase block mb-2 ml-1 transition-colors">Código Postal</label><input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" value={formDataUb.codigo_postal} onChange={e => setFormDataUb({...formDataUb, codigo_postal: e.target.value})} /></div>
                          <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">RFC Ubicación</label><input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 uppercase transition-colors" value={formDataUb.rfc_ubicacion} onChange={e => setFormDataUb({...formDataUb, rfc_ubicacion: e.target.value})} /></div>
                          
                          <div className="sm:col-span-2 mt-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 transition-colors">Domicilio de la Ubicación</p></div>
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Calle y Número</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" value={formDataUb.calle_numero} onChange={e => setFormDataUb({...formDataUb, calle_numero: e.target.value})} /></div>
                          <div className="sm:col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Colonia</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" value={formDataUb.colonia} onChange={e => setFormDataUb({...formDataUb, colonia: e.target.value})} /></div>
                          <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Municipio</label><input className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 transition-colors" value={formDataUb.municipio} onChange={e => setFormDataUb({...formDataUb, municipio: e.target.value})} /></div>
                          <div><label className="text-[9px] font-black text-blue-600 uppercase block mb-2 ml-1 transition-colors">Estado (Clave SAT Ej: NLE)</label><input required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm text-slate-900 uppercase transition-colors" placeholder="Ejemplo: NLE, JAL, CMX, TAM" value={formDataUb.estado} onChange={e => setFormDataUb({...formDataUb, estado: e.target.value.toUpperCase().slice(0,3)})} /></div>
                        </div>
                      )}

                      {/* FORMULARIO DE MERCANCÍAS DEFINITIVO (SEPARADO) */}
                      {activeTab === 'mercancias' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Descripción del Bien</label>
                            <input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" value={formDataMe.descripcion} onChange={e => setFormDataMe({...formDataMe, descripcion: e.target.value})} />
                          </div>
                          
                          <div>
                            <label className="text-[9px] font-black text-blue-600 uppercase block mb-2 ml-1 transition-colors">Clave SAT (Producto)</label>
                            <input required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" placeholder="Ejemplo: 31181701" value={formDataMe.clave_sat} onChange={e => setFormDataMe({...formDataMe, clave_sat: e.target.value})} />
                          </div>
                          
                          <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Peso Estimado (KG)</label>
                            <input required type="number" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" value={formDataMe.peso_unitario_kg} onChange={e => setFormDataMe({...formDataMe, peso_unitario_kg: e.target.value})} />
                          </div>
                          
                          <div className="sm:col-span-2 mt-2 pt-4 border-t border-slate-200 transition-colors">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 transition-colors">Unidad de Medida y Logística</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                              {/* 1. CLAVE UNIDAD */}
                              <div>
                                <label className="text-[9px] font-black text-blue-600 uppercase block mb-2 ml-1 transition-colors">Unidad de Medida</label>
                                <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" value={formDataMe.clave_unidad} onChange={e => setFormDataMe({...formDataMe, clave_unidad: e.target.value})}>
                                  <option value="H87">H87 - Pieza</option>
                                  <option value="KGM">KGM - Kilogramo</option>
                                  <option value="LTR">LTR - Litro</option>
                                  <option value="E48">E48 - Unidad de servicio</option>
                                  <option value="XG">XG - Tarima (Como unidad)</option>
                                </select>
                              </div>

                              {/* 2. TIPO DE EMBALAJE (CONDICIONAL) */}
                              <div className={`transition-all duration-300 ${!formDataMe.material_peligroso ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">
                                  Tipo de Embalaje {!formDataMe.material_peligroso && '(No requerido)'}
                                </label>
                                <select 
                                  disabled={!formDataMe.material_peligroso}
                                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors disabled:bg-slate-100 disabled:text-slate-400" 
                                  value={formDataMe.clave_embalaje} 
                                  onChange={e => setFormDataMe({...formDataMe, clave_embalaje: e.target.value})}
                                >
                                  <option value="Z01">Z01 - No aplica (A granel)</option>
                                  <option value="4G">4G - Cajas de Cartón</option>
                                  <option value="X8A">X8A - Tarima / Pallet de madera</option>
                                  <option value="XAG">XAG - Pallet empaquetado (Playo)</option>
                                  <option value="X44">X44 - Bolsa de plástico</option>
                                  <option value="X1A">X1A - Tambor / Bidón de acero</option>
                                  <option value="X4C">X4C - Caja de madera natural</option>
                                </select>
                              </div>


                              {/* 3. MATERIAL PELIGROSO */}
                              <div className="flex items-center justify-center bg-slate-50 border border-slate-200 p-4 rounded-xl h-full transition-colors">
                                <label className="flex items-center gap-3 cursor-pointer w-full justify-center">
                                  <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-red-600 rounded bg-white border-slate-300 cursor-pointer transition-colors" 
                                    checked={formDataMe.material_peligroso} 
                                    onChange={e => setFormDataMe({
                                      ...formDataMe, 
                                      material_peligroso: e.target.checked,
                                      clave_embalaje: e.target.checked ? formDataMe.clave_embalaje : 'Z01'
                                    })} 
                                  />
                                  <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${formDataMe.material_peligroso ? 'text-red-600' : 'text-slate-500'}`}>
                                    ¿Material Peligroso?
                                  </span>
                                </label>
                              </div>


                              
                            </div>
                          </div>
                        </div>
                      )}
                      
                        <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg transition-all ${loading ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/20'}`}>
                          {validandoSAT ? "Consultando al SAT..." : loading ? "Procesando..." : "Guardar Registro"}
                        </button>
                    </form>
                  )}

                  {activeTab === 'operadores' && (
                    <>
                      {tabOperador === 'ficha' && (
                        <form onSubmit={guardarRegistro} className="space-y-6">
                           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 sm:p-6 bg-slate-50 rounded-2xl border border-slate-200 transition-colors">
                            <div className="sm:col-span-2 md:col-span-4 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 transition-colors">Identidad y Fiscales</div>
                            
                            <div className="sm:col-span-2 md:col-span-4">
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Nombre Completo</label>
                              <input required className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-900 font-bold uppercase transition-colors" value={formDataOp.nombre_completo} onChange={e => setFormDataOp({...formDataOp, nombre_completo: e.target.value.toUpperCase()})} />
                            </div>
                            
                            <div className="sm:col-span-1 md:col-span-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">RFC (Obligatorio SAT)</label>
                              <input required className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-900 uppercase font-mono transition-colors" value={formDataOp.rfc} onChange={e => setFormDataOp({...formDataOp, rfc: e.target.value})} />
                            </div>

                            <div className="sm:col-span-1 md:col-span-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 ml-1 transition-colors">Teléfono Móvil</label>
                              <input className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" placeholder="10 dígitos" value={formDataOp.telefono} onChange={e => setFormDataOp({...formDataOp, telefono: e.target.value})} />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 sm:p-6 bg-blue-50 rounded-2xl border border-blue-200 transition-colors">
                            <div className="sm:col-span-2 md:col-span-4 text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2 transition-colors"><ShieldCheck size={14} /> Permisos y Vigencias</div>
                            
                            <div className="sm:col-span-1 md:col-span-2">
                              <label className="text-[9px] font-black text-blue-700 uppercase block mb-2 ml-1 transition-colors">Número de Licencia</label>
                              <input required className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-900 font-mono uppercase transition-colors" value={formDataOp.numero_licencia} onChange={e => setFormDataOp({...formDataOp, numero_licencia: e.target.value})} />
                            </div>

                            <div className="sm:col-span-1 md:col-span-2">
                              <label className="text-[9px] font-black text-blue-700 uppercase block mb-2 ml-1 transition-colors">Vencimiento de Licencia</label>
                              <input required type="date" className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-900 transition-colors" value={formDataOp.vencimiento_licencia} onChange={e => setFormDataOp({...formDataOp, vencimiento_licencia: e.target.value})} />
                            </div>
                          </div>

                          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex justify-center items-center gap-2">
                            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            {loading ? "Guardando Expediente..." : "Guardar Ficha Operativa"}
                          </button>
                        </form>
                      )}

                      {tabOperador === 'documentos' && (
                        <div className="space-y-6 animate-in fade-in">
                          <div className="bg-purple-50 border border-purple-200 p-6 rounded-2xl text-center mb-6 transition-colors">
                            <FileText className="text-purple-600 mx-auto mb-3 transition-colors" size={32} />
                            <h4 className="text-slate-900 font-bold uppercase text-sm mb-2 transition-colors">Bóveda Documental</h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed max-w-md mx-auto transition-colors">
                              Respaldo digitalizado (PDF o JPG) del expediente del operador. Los documentos se almacenan de forma segura y privada.
                            </p>
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