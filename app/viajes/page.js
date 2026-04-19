'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, User, MapPin, Package, PlusCircle, Trash2, FileText, Navigation, Receipt, ShieldCheck, DollarSign, Loader2, Edit2, XCircle, FileCode, X, Calendar, ChevronDown, AlertTriangle, Search
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { generarPDFCartaPorte } from '@/utils/PdfCartaPorte'; 
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/toastprovider';
import { fetchSafe } from '@/lib/fetchSafe';
import { notifyOffline } from '@/lib/notifyOffline'; 

// === ESCUDO DE VALIDACIÓN ZOD PARA VIAJES ===
const viajeSchema = z.object({
  distancia_km: z.number().positive("🛑 La distancia en KM debe ser estrictamente mayor a 0."),
  monto_flete: z.number().nonnegative("🛑 El monto del flete no puede ser negativo."),
  fecha_salida: z.string().min(10, "🛑 La fecha de salida es obligatoria.")
});

// === TRADUCTOR INTELIGENTE DE ERRORES DEL SAT ===
const traducirErrorFacturapi = (err, viaje = null) => {
  const errorStr = typeof err === 'object' ? JSON.stringify(err).toLowerCase() : String(err).toLowerCase();
  
  if (errorStr.includes("legal_name") || errorStr.includes("nombre")) return "NOMBRE INCORRECTO: Escríbelo exactamente como en la Constancia Fiscal.";
  if (errorStr.includes("zip") || errorStr.includes("postal")) return "CÓDIGO POSTAL: El CP del cliente o ubicación no coincide con el RFC en el SAT.";
  if (errorStr.includes("tax_system") || errorStr.includes("regimen")) return "RÉGIMEN FISCAL: El régimen del cliente no es correcto.";
  if (errorStr.includes("tax_id") || errorStr.includes("rfc")) return "RFC INVÁLIDO: Verifica que los RFC no tengan espacios.";
  if (errorStr.includes("configvehicular")) return "ERROR EN UNIDAD: La Configuración Vehicular debe ser una clave del SAT (Ej: T3S2).";
  if (errorStr.includes("placa")) return "PLACAS INVÁLIDAS: Revisa que las placas no tengan guiones ni espacios.";
  if (errorStr.includes("peso") || errorStr.includes("weight")) return "ERROR DE PESO: Verifica que el peso sea mayor a 0.";
  if (errorStr.includes("unidadpeso") || errorStr.includes("claveunidad")) return "CLAVE DE EMBALAJE: Verifica el embalaje seleccionado.";
  if (errorStr.includes("permisosct") || errorStr.includes("numpermiso")) return "PERMISO SCT: Faltan datos del permiso SCT de la unidad.";
  if (errorStr.includes("fecha") || errorStr.includes("date")) return "FECHA INVÁLIDA: La fecha de salida no es válida.";
  if (errorStr.includes("ubicaciones") && errorStr.includes("estado")) return "ESTADO FALTANTE: Falta la clave del Estado (Ej: NLE) en Origen o Destino.";

  // DETECTOR ESPECÍFICO DE MERCANCÍAS
  if (errorStr.includes("catalog key") || errorStr.includes("bienestransp") || errorStr.includes("product key")) {
    const match = errorStr.match(/key '?([0-9]+)'?/i) || String(err).match(/BienesTransp.*?([0-9]+)/i);
    let badKey = match ? match[1] : null;

    if (badKey && viaje && viaje.mercancias_detalle) {
      const productoProblematico = viaje.mercancias_detalle.find(m => String(m.clave_sat).includes(badKey));
      if (productoProblematico) {
        return `CLAVE SAT RECHAZADA: El producto "${productoProblematico.descripcion}" tiene una clave SAT (${badKey}) que no existe en el catálogo oficial. Edita la mercancía.`;
      }
    }
    return "CLAVE SAT INVÁLIDA: Uno de los productos tiene un código que no existe en el catálogo oficial del SAT.";
  }

  if (typeof err === 'object' && err.message) return `El SAT rechazó el timbrado:\n${err.message}`;
  return `Error técnico:\n${typeof err === 'object' ? JSON.stringify(err) : err}`;
};

// === COMPONENTE: SELECTOR BUSCADOR INTELIGENTE ===
const SelectorBuscador = ({ opciones, valorSeleccionado, onSelect, placeholder, isSmall = false }) => {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const wrapperRef = useRef(null);

  const itemSeleccionado = opciones.find(o => o.id === valorSeleccionado);

  useEffect(() => {
    if (itemSeleccionado) setBusqueda(itemSeleccionado.label);
    else setBusqueda('');
  }, [valorSeleccionado, itemSeleccionado]);

  useEffect(() => {
    const handleClickFuera = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setAbierto(false);
        if (itemSeleccionado) setBusqueda(itemSeleccionado.label);
        else setBusqueda('');
      }
    };
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [itemSeleccionado]);

  const filtradas = opciones.filter(o => o.label.toLowerCase().includes(busqueda.toLowerCase()));

  // Lógica dinámica de tamaño para empatar alturas
  const paddingClass = isSmall ? 'p-3 md:p-[0.55rem] pl-9 md:pl-9 text-xs' : 'p-4 pl-10 text-sm';
  const iconSize = isSmall ? 14 : 16;
  const iconPos = isSmall ? 'left-3' : 'left-4';

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          className={`w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white transition-colors outline-none focus:border-blue-500 ${paddingClass}`}
          value={abierto ? busqueda : (itemSeleccionado?.label || '')}
          onChange={(e) => { 
            setBusqueda(e.target.value); 
            setAbierto(true); 
            if(valorSeleccionado) onSelect(''); 
          }}
          onFocus={() => { setAbierto(true); setBusqueda(''); }}
        />
        <Search size={iconSize} className={`absolute ${iconPos} top-1/2 transform -translate-y-1/2 text-slate-400`} />
      </div>
      
      {abierto && (
        <ul className="absolute z-[60] w-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl custom-scrollbar">
          {filtradas.length === 0 ? (
            <li className="p-4 text-xs text-slate-500 italic text-center">No se encontraron resultados...</li>
          ) : (
            filtradas.map(op => (
              <li 
                key={op.id} 
                className="p-3 px-4 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                onMouseDown={() => { 
                  onSelect(op.id); 
                  setBusqueda(op.label); 
                  setAbierto(false); 
                }}
              >
                {op.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};


export default function ViajesPage() {
  const router = useRouter();
  const { mostrarAlerta } = useToast(); 

  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viajes, setViajes] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);

  const [dialogoConfirmacion, setDialogoConfirmacion] = useState({ visible: false, mensaje: '', accion: null });

  const [filtroEstatus, setFiltroEstatus] = useState('Todos'); 
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroActivo, setFiltroActivo] = useState(false);
  
  const [catalogos, setCatalogos] = useState({ unidades: [], operadores: [], ubicaciones: [], mercancias: [], remolques: [] });
  const [clientes, setClientes] = useState([]);
  const [perfilEmisor, setPerfilEmisor] = useState(null);
  
  const [filtroOrigen, setFiltroOrigen] = useState('');
  const [filtroDestino, setFiltroDestino] = useState('');

  const [empresaId, setEmpresaId] = useState(null);
  const [rolUsuario, setRolUsuario] = useState('miembro');

  const puedeVerAdmin = rolUsuario === 'admin' || rolUsuario === 'administrador'; 

  const formInicial = {
    unidad_id: '', remolque_id: '', operador_id: '', origen_id: '', destino_id: '', 
    cliente_id: '', monto_flete: '', 
    moneda: 'MXN',
    aplica_iva: true, 
    aplica_retencion: true, 
    distancia_km: '', referencia: '', fecha_salida: new Date().toISOString().split('T')[0],
    mercancias_detalle: [{ mercancia_id: '', cantidad: 1, peso_kg: '', valor: '', moneda: 'MXN' }],
    gasto_monto: '', gasto_descripcion: 'Viáticos de Ruta',
    tag_casetas: '', tarjeta_gasolina: ''
  };

  const [formData, setFormData] = useState(formInicial);

  const unidadSeleccionadaObj = catalogos.unidades.find(u => u.id === formData.unidad_id);
  const configVehicularSAT = unidadSeleccionadaObj?.configuracion_vehicular || '';
  const esCamionArticulado = configVehicularSAT.includes('T') || configVehicularSAT.includes('R');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSesion(session);
        inicializarDatos(session.user.id);
      }
    });
  }, []);

  async function inicializarDatos(userId) {
    setLoading(true);
    const { data: perfilData } = await supabase.from('perfiles').select('empresa_id, rol').eq('id', userId).single();
    const idMaestro = perfilData?.empresa_id || userId;
    setEmpresaId(idMaestro);
    if (perfilData?.rol) setRolUsuario(perfilData.rol);

    await Promise.all([cargarCatalogos(idMaestro), obtenerViajes(idMaestro), obtenerPerfilFiscal(idMaestro)]);
    setLoading(false);
  }

  async function obtenerPerfilFiscal(idMaestro) {
    const { data, offline } = await fetchSafe(
      supabase.from('perfil_emisor').select('*').eq('empresa_id', idMaestro).single(),
      `perfil_emisor_${idMaestro}`
    );
    if (offline) notifyOffline();
    if (data) setPerfilEmisor(data);
  }

  async function cargarCatalogos(idMaestro) {
    const [u, o, ub, m, cl, r] = await Promise.all([
      fetchSafe(supabase.from('unidades').select('*').eq('empresa_id', idMaestro).eq('activo', true), `unidades_${idMaestro}`),
      fetchSafe(supabase.from('operadores').select('*').eq('empresa_id', idMaestro).eq('activo', true), `operadores_${idMaestro}`),
      fetchSafe(supabase.from('ubicaciones').select('*').eq('empresa_id', idMaestro).eq('activo', true), `ubicaciones_${idMaestro}`),
      fetchSafe(supabase.from('mercancias').select('*').eq('empresa_id', idMaestro).eq('activo', true), `mercancias_${idMaestro}`),
      fetchSafe(supabase.from('clientes').select('*').eq('empresa_id', idMaestro).eq('activo', true), `clientes_${idMaestro}`),
      fetchSafe(supabase.from('remolques').select('*').eq('empresa_id', idMaestro).eq('activo', true), `remolques_${idMaestro}`),
    ]);
    if (u.offline || o.offline || ub.offline) notifyOffline();
    setCatalogos({ unidades: u.data || [], operadores: o.data || [], ubicaciones: ub.data || [], mercancias: m.data || [], remolques: r.data || [] });
    setClientes(cl.data || []);
  }

  async function obtenerViajes(idMaestro) {
    const { data, offline } = await fetchSafe(
      supabase.from('viajes').select(`
        *, unidades(*), operadores(*), remolques(*), clientes(*),
        origen:ubicaciones!viajes_origen_id_fkey(*), destino:ubicaciones!viajes_destino_id_fkey(*)
      `).eq('empresa_id', idMaestro).order('created_at', { ascending: false }),
      `viajes_completos_${idMaestro}`
    );
    if (offline) notifyOffline();
    setViajes(data || []);
  }

  const generarIdCCP = () => `CCC${crypto.randomUUID().substring(3).toUpperCase()}`;
  const agregarFilaMercancia = () => { setFormData({ ...formData, mercancias_detalle: [...formData.mercancias_detalle, { mercancia_id: '', cantidad: 1, peso_kg: '', valor: '', moneda: 'MXN' }] }); };
  const actualizarFilaMercancia = (index, campo, valor) => { const nuevasMercancias = [...formData.mercancias_detalle]; nuevasMercancias[index][campo] = valor; setFormData({ ...formData, mercancias_detalle: nuevasMercancias }); };
  const eliminarFilaMercancia = (index) => { const nuevasMercancias = formData.mercancias_detalle.filter((_, i) => i !== index); setFormData({ ...formData, mercancias_detalle: nuevasMercancias }); };
  const calcularPesoTotal = () => { return formData.mercancias_detalle.reduce((acc, curr) => acc + (Number(curr.peso_kg) || 0), 0); };

  const cerrarModal = () => { setMostrarModal(false); setFormData(formInicial); };

  const pedirConfirmacion = (mensaje, accion) => { setDialogoConfirmacion({ visible: true, mensaje, accion }); };
  const ejecutarConfirmacion = async () => { if (dialogoConfirmacion.accion) { await dialogoConfirmacion.accion(); } setDialogoConfirmacion({ visible: false, mensaje: '', accion: null }); };

  const eliminarViaje = (id) => {
    pedirConfirmacion("¿Deseas eliminar este viaje permanentemente? Esta acción no se puede deshacer.", async () => {
      setLoading(true);
      try {
        await supabase.from('mantenimientos').delete().eq('viaje_id', id); 
        await supabase.from('facturas').delete().eq('viaje_id', id);
        await supabase.from('viajes').delete().eq('id', id);
        obtenerViajes(empresaId);
        mostrarAlerta("Viaje eliminado permanentemente.", "exito");
      } catch (error) { mostrarAlerta("Error al eliminar: " + error.message, "error"); } finally { setLoading(false); }
    });
  };

  const cancelarViaje = (viaje) => {
    pedirConfirmacion("¿Estás seguro de CANCELAR esta Carta Porte? Se enviará la petición al SAT y la factura quedará invalidada.", async () => {
      setLoading(true);
      try {
        const { data: factura } = await supabase.from('facturas').select('facturapi_id').eq('viaje_id', viaje.id).single();
        if (factura && factura.facturapi_id) {
          await fetch('/api/facturapi', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: `invoices/${factura.facturapi_id}?motive=02`, method: 'DELETE' })
          });
        }
        await supabase.from('viajes').update({ estatus: 'Cancelado' }).eq('id', viaje.id);
        await supabase.from('facturas').update({ estatus_pago: 'Cancelada' }).eq('viaje_id', viaje.id);
        mostrarAlerta("Carta Porte CANCELADA exitosamente en el SAT.", "exito");
        obtenerViajes(empresaId);
      } catch (error) { mostrarAlerta("Error al cancelar: " + error.message, "error"); } finally { setLoading(false); }
    });
  };

 const timbrarCartaPorte = async (viaje) => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error("Sesión expirada o inválida. Por favor, vuelve a iniciar sesión.");

      if (!viaje.clientes?.rfc) throw new Error("Falta el RFC del Cliente.");
      if (!viaje.clientes?.codigo_postal) throw new Error("Falta el Código Postal del Cliente.");
      if (!viaje.clientes?.regimen_fiscal) throw new Error("Falta el Régimen Fiscal del Cliente.");

      const rfcOrigen = viaje.origen?.rfc_ubicacion || perfilEmisor?.rfc;
      const rfcDestino = viaje.destino?.rfc_ubicacion || viaje.clientes?.rfc;
      
      if (!rfcOrigen || !rfcDestino) throw new Error("Faltan RFCs en Origen o Destino.");
      if (!viaje.origen?.codigo_postal || !viaje.destino?.codigo_postal) throw new Error("Falta C.P. en Origen o Destino.");
      if (!viaje.origen?.estado || !viaje.destino?.estado) throw new Error("Falta Estado en Origen o Destino.");

      const u = viaje.unidades;
      if (!u?.permiso_sict || !u?.num_permiso_sict || !u?.configuracion_vehicular || !u?.placas) {
        throw new Error("Faltan datos requeridos en la Unidad (Permiso, Configuración o Placas).");
      }

      const op = viaje.operadores;
      if (!op?.rfc || !op?.numero_licencia) throw new Error("Faltan datos requeridos en el Operador (RFC o Licencia).");


      // 3. 🛡️ FORMACIÓN DE MERCANCÍAS Y FILTRO ESPECÍFICO
      const arregloMercanciasFacturapi = (viaje.mercancias_detalle || []).map((item, index) => {
        if (!item.clave_sat || !item.descripcion || !item.peso_kg) {
          throw new Error(`Faltan datos en el producto #${index + 1}: "${item.descripcion || 'Sin nombre'}"`);
        }

        const claveSatLimpia = String(item.clave_sat).trim().replace(/[^0-9]/g, '');
        // AQUÍ HACEMOS EL ERROR MUY ESPECÍFICO
        if (claveSatLimpia.length !== 8) {
           throw new Error(`ERROR SAT: El producto "${item.descripcion}" tiene la clave '${item.clave_sat}'. El SAT exige que tenga exactamente 8 números. Edítalo en tu catálogo.`);
        }

        let unidadValida = "H87";
        if (item.clave_unidad && String(item.clave_unidad).length <= 3) {
          unidadValida = String(item.clave_unidad).trim().toUpperCase();
        }

        let mercancia = { 
          BienesTransp: claveSatLimpia, 
          Descripcion: item.descripcion, 
          Cantidad: parseFloat(item.cantidad || 1), 
          ClaveUnidad: unidadValida,
          PesoEnKg: parseFloat(item.peso_kg) 
        };

        const esPeligroso = item.material_peligroso === true || item.material_peligroso === "Sí" || item.material_peligroso === "1";
        if (esPeligroso) {
          mercancia.MaterialPeligroso = "Sí";
          if (item.clave_embalaje || item.embalaje) {
            mercancia.Embalaje = item.clave_embalaje || item.embalaje;
          }
        } 

        if (item.valor && parseFloat(item.valor) > 0) { 
          mercancia.ValorMercancia = parseFloat(item.valor); 
          mercancia.Moneda = item.moneda || "MXN"; 
        }

        return mercancia;
      });

      const pesoTotalTimbre = (viaje.mercancias_detalle || []).reduce((acc, item) => acc + (Number(item.peso_kg) || 0), 0) || viaje.peso_total_kg || 1;
      
      const ahora = new Date(); ahora.setHours(ahora.getHours() - 1);
      const año = ahora.getFullYear(); const mes = String(ahora.getMonth() + 1).padStart(2, '0'); const dia = String(ahora.getDate()).padStart(2, '0');
      const horas = String(ahora.getHours()).padStart(2, '0'); const minutos = String(ahora.getMinutes()).padStart(2, '0'); const segundos = String(ahora.getSeconds()).padStart(2, '0');
      const fechaHoraCFDI = `${año}-${mes}-${dia}T${horas}:${minutos}:${segundos}`;

      const horasTrayecto = Math.ceil((viaje.distancia_km || 60) / 60) + 1;
      const llegadaDate = new Date(ahora.getTime() + (horasTrayecto * 60 * 60 * 1000));
      const llegadaAño = llegadaDate.getFullYear(); const llegadaMes = String(llegadaDate.getMonth() + 1).padStart(2, '0'); const llegadaDia = String(llegadaDate.getDate()).padStart(2, '0');
      const llegadaHoras = String(llegadaDate.getHours()).padStart(2, '0'); const llegadaMinutos = String(llegadaDate.getMinutes()).padStart(2, '0'); const llegadaSegundos = String(llegadaDate.getSeconds()).padStart(2, '0');
      const fechaHoraLlegadaCFDI = `${llegadaAño}-${llegadaMes}-${llegadaDia}T${llegadaHoras}:${llegadaMinutos}:${llegadaSegundos}`;

      const configSAT = u.configuracion_vehicular.trim().toUpperCase();
      const requiereRemolqueSAT = configSAT.includes('T') || configSAT.includes('R');

      const autotransporteObj = {
        PermSCT: u.permiso_sict, 
        NumPermisoSCT: u.num_permiso_sict,
        IdentificacionVehicular: { 
          ConfigVehicular: configSAT, 
          PlacaVM: u.placas.replace(/[- ]/g, ''), 
          AnioModeloVM: u.anio_modelo.toString(), 
          PesoBrutoVehicular: parseFloat(u.peso_bruto_maximo || 30.00) 
        },
        Seguros: { AseguraRespCivil: u.aseguradora_rc, PolizaRespCivil: u.poliza_rc }
      };

      if (requiereRemolqueSAT) {
        if (!viaje.remolques || !viaje.remolques.placas) throw new Error(`El camión requiere remolque. Edita el viaje y asígnale uno.`);
        autotransporteObj.Remolques = [{ 
          SubTipoRem: (viaje.remolques.subtipo_remolque || "CTR02").trim().toUpperCase(), 
          Placa: viaje.remolques.placas.replace(/[- ]/g, '') 
        }];
      }

      const subtotal = parseFloat(viaje.monto_flete || 0);
      let impuestosArray = [];
      if (viaje.aplica_iva !== false) impuestosArray.push({ type: "IVA", rate: 0.16 });
      if (viaje.aplica_retencion !== false) impuestosArray.push({ type: "IVA", rate: 0.04, withholding: true });

      const descripcionServicio = viaje.referencia ? `Servicio de Flete Nacional - Ref: ${viaje.referencia}` : "Servicio de Flete Nacional";

      const invoiceData = {
        type: "I", 
        date: fechaHoraCFDI,
        currency: viaje.moneda || "MXN",
        customer: { 
          legal_name: viaje.clientes.nombre, 
          tax_id: viaje.clientes.rfc, 
          tax_system: viaje.clientes.regimen_fiscal, 
          address: { zip: viaje.clientes.codigo_postal } 
        },
        items: [{ 
          quantity: 1, 
          product: { 
            description: descripcionServicio, 
            product_key: "78101802", 
            price: subtotal, 
            taxes: impuestosArray 
          } 
        }],
        payment_form: "99", 
        payment_method: "PPD", 
        use: viaje.clientes.uso_cfdi || "G03",
        complements: [{
          type: "carta_porte",
          data: {
            IdCCP: viaje.id_ccp?.startsWith('CCC') ? viaje.id_ccp : `CCC${(viaje.id_ccp || crypto.randomUUID().toUpperCase()).substring(3)}`, 
            TranspInternac: "No", 
            TotalDistRec: parseFloat(viaje.distancia_km || 150),
            Ubicaciones: [
              { TipoUbicacion: "Origen", RFCRemitenteDestinatario: rfcOrigen, FechaHoraSalidaLlegada: fechaHoraCFDI, Domicilio: { Calle: viaje.origen.nombre_lugar, Estado: viaje.origen.estado, Pais: "MEX", CodigoPostal: viaje.origen.codigo_postal } },
              { TipoUbicacion: "Destino", DistanciaRecorrida: parseFloat(viaje.distancia_km || 150), RFCRemitenteDestinatario: rfcDestino, FechaHoraSalidaLlegada: fechaHoraLlegadaCFDI, Domicilio: { Calle: viaje.destino.nombre_lugar, Estado: viaje.destino.estado, Pais: "MEX", CodigoPostal: viaje.destino.codigo_postal } }            
            ],
            Mercancias: { 
              PesoBrutoTotal: pesoTotalTimbre, 
              UnidadPeso: "KGM", 
              NumTotalMercancias: arregloMercanciasFacturapi.length, 
              Mercancia: arregloMercanciasFacturapi, 
              Autotransporte: autotransporteObj 
            },
            FiguraTransporte: [{ TipoFigura: "01", RFCFigura: op.rfc, NumLicencia: op.numero_licencia, NombreFigura: op.nombre_completo }]
          }
        }]
      };

      setLoading(true);
      const response = await fetch('/api/facturapi', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${currentSession.access_token}` 
        }, 
        body: JSON.stringify({ endpoint: 'invoices', method: 'POST', payload: invoiceData }) 
      });

      const res = await response.json();
      
      if (response.ok) {
        await supabase.from('viajes').update({ 
          estatus: 'Emitido (Timbrado)', 
          folio_fiscal: res.uuid, 
          id_ccp: res.complements?.[0]?.data?.IdCCP || "Generado", 
          sello_emisor: res.stamp?.signature, 
          sello_sat: res.stamp?.sat_signature, 
          cadena_original: res.stamp?.complement_string 
        }).eq('id', viaje.id);

        await supabase.from('facturas').update({ 
          estatus_pago: 'Pendiente', 
          facturapi_id: res.id, 
          folio_fiscal: res.uuid, 
          sello_emisor: res.stamp?.signature, 
          sello_sat: res.stamp?.sat_signature, 
          cadena_original: res.stamp?.complement_string, 
          no_certificado_sat: res.stamp?.sat_cert_number 
        }).eq('viaje_id', viaje.id);

        mostrarAlerta(`¡CARTA PORTE TIMBRADA! 🎉🎉\n`, "exito");
        obtenerViajes(empresaId);
      } else {
        mostrarAlerta(traducirErrorFacturapi(res, viaje), "error");
      }
    } catch (err) { 
      mostrarAlerta(err.message, "error"); 
    } finally { 
      setLoading(false); 
    }
  }; 

const registrarViaje = async (e) => {
    e.preventDefault();
    
    // === VALIDACIONES MANUALES (Para selectores inteligentes) ===
    if (!formData.unidad_id) return mostrarAlerta("Debes seleccionar una Unidad / Tractocamión.", "error");
    if (esCamionArticulado && !formData.remolque_id) return mostrarAlerta("Este camión requiere un remolque seleccionado.", "error");
    if (!formData.operador_id) return mostrarAlerta("Debes seleccionar un Operador.", "error");
    if (!formData.origen_id) return mostrarAlerta("Debes seleccionar un Origen de Ruta.", "error");
    if (!formData.destino_id) return mostrarAlerta("Debes seleccionar un Destino de Ruta.", "error");
    if (!formData.cliente_id) return mostrarAlerta("Debes seleccionar un Cliente para facturar.", "error");
    
    if (formData.mercancias_detalle.length === 0) return mostrarAlerta("Debes agregar al menos una mercancía al viaje.", "error");
    const mercanciaIncompleta = formData.mercancias_detalle.find(m => !m.mercancia_id);
    if (mercanciaIncompleta) return mostrarAlerta("Hay una fila de mercancía sin producto. Búscalo en la lista.", "error");

    setLoading(true);
    try {
      const clienteObj = clientes.find(c => c.id === formData.cliente_id);
      const mercanciasEnriquecidas = formData.mercancias_detalle.map(item => {
        const cat = catalogos.mercancias.find(m => m.id === item.mercancia_id);
        return { ...item, clave_sat: cat?.clave_sat, descripcion: cat?.descripcion, embalaje: cat?.clave_embalaje || '4G', material_peligroso: cat?.material_peligroso || false };
      });

      const remolqueLimpio = esCamionArticulado ? formData.remolque_id : null;

      const payloadComun = {
        distancia_km: parseFloat(formData.distancia_km || 0), unidad_id: formData.unidad_id, remolque_id: remolqueLimpio, operador_id: formData.operador_id, origen_id: formData.origen_id, destino_id: formData.destino_id,
        mercancia_id: formData.mercancias_detalle[0].mercancia_id, mercancias_detalle: mercanciasEnriquecidas, peso_total_kg: calcularPesoTotal(), cliente_id: formData.cliente_id || null, 
        monto_flete: parseFloat(formData.monto_flete || 0), 
        moneda: formData.moneda, 
        aplica_iva: formData.aplica_iva, 
        aplica_retencion: formData.aplica_retencion, 
        referencia: formData.referencia || '', fecha_salida: formData.fecha_salida, tag_casetas: formData.tag_casetas, tarjeta_gasolina: formData.tarjeta_gasolina
      };

      const validacion = viajeSchema.safeParse({ distancia_km: payloadComun.distancia_km, monto_flete: payloadComun.monto_flete, fecha_salida: payloadComun.fecha_salida });
      if (!validacion.success) {
        setLoading(false);
        return mostrarAlerta(validacion.error.issues[0]?.message || "🛑 Revisa los datos ingresados.", "error");
      }

      let fleteBase = payloadComun.monto_flete;
      let montoCalculado = fleteBase;
      if (payloadComun.aplica_iva) montoCalculado += (fleteBase * 0.16);
      if (payloadComun.aplica_retencion) montoCalculado -= (fleteBase * 0.04);
      montoCalculado = Number(montoCalculado.toFixed(2)); 

      const nuevoIdCCP = generarIdCCP();
      const { data: nuevoViaje, error: errorViaje } = await supabase.from('viajes').insert([{ ...payloadComun, id_ccp: nuevoIdCCP, estatus: 'Borrador', empresa_id: empresaId }]).select().single();
      if (errorViaje) throw errorViaje;

      if (payloadComun.unidad_id && payloadComun.distancia_km > 0) {
        const { data: unidadData } = await supabase.from('unidades').select('kilometraje_actual').eq('id', payloadComun.unidad_id).single();
        await supabase.from('unidades').update({ kilometraje_actual: Number(unidadData?.kilometraje_actual || 0) + Number(payloadComun.distancia_km) }).eq('id', payloadComun.unidad_id);
      }

      if (formData.monto_flete > 0 && formData.cliente_id) {
        const fechaVenc = new Date(formData.fecha_salida); fechaVenc.setDate(fechaVenc.getDate() + (clienteObj?.dias_credito || 0));
        await supabase.from('facturas').insert([{ 
            viaje_id: nuevoViaje.id, 
            folio_viaje: nuevoViaje.folio_interno, 
            empresa_id: empresaId, 
            cliente: clienteObj.nombre, 
            monto_total: montoCalculado, 
            moneda: formData.moneda,
            fecha_viaje: formData.fecha_salida, 
            fecha_vencimiento: fechaVenc.toISOString().split('T')[0], 
            estatus_pago: 'Pendiente', 
            ruta: `Flete CCP${formData.referencia ? ' - Ref: '+formData.referencia : ''}` 
        }]);
      }

      if (formData.gasto_monto && parseFloat(formData.gasto_monto) > 0) {
        await supabase.from('mantenimientos').insert([{ unidad_id: formData.unidad_id, empresa_id: empresaId, viaje_id: nuevoViaje.id, descripcion: formData.gasto_descripcion || `Gastos Operativos - Viaje V-${String(nuevoViaje.folio_interno).padStart(4, '0')}`, costo: parseFloat(formData.gasto_monto), tipo: 'Otros', fecha: formData.fecha_salida }]);
      }
      mostrarAlerta("Viaje programado exitosamente.", "exito");

      cerrarModal(); obtenerViajes(empresaId);
    } catch (err) { mostrarAlerta("Error: " + err.message, "error"); } finally { setLoading(false); }
  };

const getBadgeColor = (estatus) => {
    switch(estatus) { 
      case 'Cerrado': return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'; 
      case 'Emitido (Timbrado)': return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
      case 'Cancelado': return 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'; 
      default: return 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20'; 
    }
  };

  const filtrarPorPeriodo = (viajeDate) => {
    if (!filtroActivo) return true; 
    if (!viajeDate) return false;
    if (!fechaInicio && !fechaFin) return true;
    const fViaje = new Date(viajeDate + 'T12:00:00'); const fInicio = fechaInicio ? new Date(fechaInicio + 'T12:00:00') : null; const fFin = fechaFin ? new Date(fechaFin + 'T12:00:00') : null;
    if (fInicio && fViaje < fInicio) return false;
    if (fFin && fViaje > fFin) return false;
    return true;
  };

  const viajesDelPeriodo = viajes.filter(v => filtrarPorPeriodo(v.fecha_salida));

const getFiltrosArray = () => {
  return [
    { id: 'Todos', label: 'Todos', count: viajesDelPeriodo.length }, 
    { id: 'Borrador', label: 'Borradores', count: viajesDelPeriodo.filter(v => v.estatus === 'Borrador').length },
    { id: 'Emitido (Timbrado)', label: 'Timbrados', count: viajesDelPeriodo.filter(v => v.estatus === 'Emitido (Timbrado)').length }, 
    { id: 'Cerrado', label: 'Cerrados', count: viajesDelPeriodo.filter(v => v.estatus === 'Cerrado').length },
    { id: 'Cancelado', label: 'Cancelados', count: viajesDelPeriodo.filter(v => v.estatus === 'Cancelado').length },
  ];
};

  const viajesFiltrados = viajesDelPeriodo.filter(v => {
    return (filtroEstatus === 'Todos' || v.estatus === filtroEstatus) && (filtroOrigen === '' || v.origen_id === filtroOrigen) && (filtroDestino === '' || v.destino_id === filtroDestino);
  });

  if (!sesion) return null;

  if (rolUsuario === 'facturacion') {
    return (
      <div className="flex bg-transparent min-h-screen text-slate-900 dark:text-slate-200 w-full"><Sidebar /><main className="flex-1 p-8 flex flex-col items-center justify-center"><h2 className="text-2xl text-slate-900 dark:text-white font-black uppercase tracking-widest">Acceso Restringido</h2><p className="text-slate-500 text-sm mt-2">Tu perfil no tiene acceso.</p></main></div>
    );
  }
  
  const exportarExcelViajes = () => {
    const datosParaExcel = viajesFiltrados.map(v => ({ Folio: `V-${String(v.folio_interno).padStart(4, '0')}`, Fecha: v.fecha_salida, Estatus: v.estatus, Cliente: v.clientes?.nombre || 'N/A', Referencia: v.referencia || '', Origen: v.origen?.nombre_lugar || '', Destino: v.destino?.nombre_lugar || '', Unidad: v.unidades?.numero_economico || '', Operador: v.operadores?.nombre_completo || '', Peso_KG: v.peso_total_kg, Monto_Flete: v.monto_flete || 0, Moneda: v.moneda || 'MXN', ID_CartaPorte: v.id_ccp || '' }));
    const ws = XLSX.utils.json_to_sheet(datosParaExcel); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Viajes"); XLSX.writeFile(wb, `Reporte_Viajes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex bg-transparent min-h-screen text-slate-900 dark:text-slate-200 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 transition-colors">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white leading-none transition-colors">Logística <span className="text-blue-600 dark:text-blue-500">Operativa</span></h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 transition-colors">Histórico de Despachos y Carta Porte</p>
          </div>
          <div className="flex gap-3 items-center w-full sm:w-auto">
            <button onClick={() => setMostrarModal(true)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] flex justify-center items-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
              <PlusCircle size={16} /> Crear Despacho
            </button>
          </div>
        </header>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4 transition-colors">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide w-full sm:w-auto pb-2 sm:pb-0">
              {getFiltrosArray().map(f => (
                <button key={f.id} onClick={() => setFiltroEstatus(f.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${filtroEstatus === f.id ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white border-blue-200 dark:border-slate-700 shadow-sm' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                  {f.label} <span className={`px-2 py-0.5 rounded-full text-[9px] ${filtroEstatus === f.id ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{f.count}</span>
                </button>
              ))}
            </div>

            <div className="relative shrink-0 z-20 w-full sm:w-auto">
              <button onClick={() => setMostrarFiltro(!mostrarFiltro)} className={`w-full sm:w-auto flex items-center justify-between gap-3 border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${filtroActivo ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className={filtroActivo ? 'text-blue-600 dark:text-blue-500' : 'text-slate-500'} />
                  <span>{filtroActivo ? 'Filtros Activos' : 'Filtros y Reportes'}</span>
                </div>
                <ChevronDown size={14} className={`transition-transform duration-300 ${mostrarFiltro ? 'rotate-180' : ''}`} />
              </button>

              {mostrarFiltro && (
                <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-full sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200 transition-colors">
                  <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-5 border-b border-slate-200 dark:border-slate-800 pb-3 text-center transition-colors">Parámetros de Búsqueda</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Desde</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-[11px] rounded-xl p-3 outline-none focus:border-blue-500 transition-colors" /></div>
                    <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Hasta</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-[11px] rounded-xl p-3 outline-none focus:border-blue-500 transition-colors" /></div>
                  </div>
                  <div className="space-y-4 mb-6">
                    <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Origen de Ruta</label><select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl p-3 outline-none focus:border-blue-500 appearance-none transition-colors"><option value="">Todos los Orígenes</option>{catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}</select></div>
                    <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Destino de Ruta</label><select value={filtroDestino} onChange={(e) => setFiltroDestino(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl p-3 outline-none focus:border-blue-500 appearance-none transition-colors"><option value="">Todos los Destinos</option>{catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}</select></div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800 transition-colors">
                    <button onClick={() => { setFiltroActivo(true); setMostrarFiltro(false); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20">Aplicar Filtros</button>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {filtroActivo && (<button onClick={() => { setFiltroActivo(false); setFechaInicio(''); setFechaFin(''); setFiltroOrigen(''); setFiltroDestino(''); setMostrarFiltro(false); }} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl transition-colors">Limpiar</button>)}
                      {puedeVerAdmin && (<button onClick={exportarExcelViajes} className={`${filtroActivo ? '' : 'col-span-2'} flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-600/10 hover:bg-emerald-100 dark:hover:bg-emerald-600 text-emerald-600 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-500/20 font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl transition-colors`}><FileText size={12} /> Excel</button>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] mb-12 flex flex-col shadow-sm dark:shadow-2xl overflow-hidden transition-colors">
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors">
                      <th className="p-5 pl-8 w-24">Folio</th>
                      <th className="p-5 w-48">Cliente / Referencia</th>
                      <th className="p-5 min-w-[220px]">Ruta Operativa</th>
                      <th className="p-5 min-w-[200px]">Asignación</th>
                      <th className="p-5 w-32 text-center">Estatus</th>
                      <th className="p-5 pr-8 w-40 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors">
                  {viajesFiltrados.map((v) => (
                    <tr key={v.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group ${v.estatus === 'Cancelado' ? 'opacity-50 grayscale' : ''}`}>
<td className="p-4 pl-8 whitespace-nowrap align-middle">
    <div className="flex flex-col items-start gap-1">
      <span className="text-[14px] text-slate-900 dark:text-white font-mono font-medium transition-colors">V-{String(v.folio_interno).padStart(4, '0')}</span>
      <span className="text-[11px] text-slate-500 font-medium">{v.fecha_salida?.slice(0, 10)}</span>
    </div>
  </td>

 <td className="p-4 whitespace-nowrap align-middle">
    <div className="flex flex-col gap-1.5 items-start">
      <span className="text-slate-900 dark:text-white text-sm font-semibold truncate max-w-[200px] transition-colors" title={v.clientes?.nombre}>{v.clientes?.nombre || 'Sin Cliente'}</span>
      {v.referencia ? (
        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-mono font-bold uppercase tracking-widest">PO: {v.referencia}</span>
      ) : (v.clientes?.rfc && <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono tracking-widest">RFC: {v.clientes.rfc}</span>)}
    </div>
  </td>
                      <td className="p-4 whitespace-nowrap align-middle">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-xs transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"/> <span className="truncate max-w-[220px]" title={v.origen?.nombre_lugar}>{v.origen?.nombre_lugar || 'Sin Origen'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-xs transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] shrink-0"/> <span className="truncate max-w-[220px]" title={v.destino?.nombre_lugar}>{v.destino?.nombre_lugar || 'Sin Destino'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap align-middle">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-slate-900 dark:text-white text-xs font-semibold uppercase truncate max-w-[200px] transition-colors" title={v.operadores?.nombre_completo}>{v.operadores?.nombre_completo || 'Sin Operador'}</span>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] transition-colors"><Truck size={10} className="text-blue-500 dark:text-blue-400"/> {v.unidades?.numero_economico || 'N/A'} {v.remolques ? `+ ${v.remolques.placas}` : ''}</span>
                        </div>
                      </td>

<td className="p-4 whitespace-nowrap align-middle text-center">
    <span className={`inline-flex px-3 py-1.5 rounded-lg uppercase tracking-widest text-[9px] font-black items-center justify-center gap-1 min-w-[110px] shadow-sm ${getBadgeColor(v.estatus)}`}>
      {v.estatus}
    </span>
  </td>

                      <td className="p-4 pr-8 whitespace-nowrap text-center align-middle">
    <div className="flex items-center justify-end gap-1.5 opacity-30 group-hover:opacity-100 transition-opacity">
      
      {v.estatus === 'Borrador' && (
        <>
          <button onClick={() => eliminarViaje(v.id)} title="Eliminar Viaje" className="p-2 text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-500 rounded-lg transition-colors mr-2"><Trash2 size={16}/></button>
          <button onClick={() => router.push(`/viajes/${v.id}`)} title="Centro de Control" className="p-2 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors mr-2"><Edit2 size={16}/></button>
          {puedeVerAdmin && (<button onClick={() => generarPDFCartaPorte(v, perfilEmisor)} title="Previsualizar PDF" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors mr-2"><FileText size={16}/></button>)}
          {puedeVerAdmin && (<button onClick={() => timbrarCartaPorte(v)} disabled={loading} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-600 hover:text-blue-700 dark:hover:text-white border border-blue-200 dark:border-blue-500/20 rounded-lg uppercase tracking-widest text-[10px] flex items-center gap-1.5 transition-colors">{loading ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>} Timbrar</button>)}
        </>
      )}

      {v.estatus === 'Emitido (Timbrado)' && (
        <>
          <button onClick={() => cancelarViaje(v)} disabled={loading} title="Cancelar Carta Porte" className="p-2 text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-500 rounded-lg transition-colors mr-2"><XCircle size={16}/></button>
          <button onClick={() => router.push(`/viajes/${v.id}`)} title="Centro de Control" className="p-2 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors mr-2"><Edit2 size={16}/></button>
          <button onClick={() => router.push(`/facturas?viaje_id=${v.id}`)} title="Ver Factura" className="p-2 bg-emerald-50 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-600 hover:text-emerald-700 dark:hover:text-white rounded-lg transition-colors mr-2"><Receipt size={16}/></button>
          <button onClick={() => generarPDFCartaPorte(v, perfilEmisor)} title="Descargar PDF" className="p-2 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-600 hover:text-blue-700 dark:hover:text-white rounded-lg transition-colors"><FileText size={16}/></button>
        </>
      )}

      {v.estatus === 'Cerrado' && (
        <>
          <button onClick={() => router.push(`/viajes/${v.id}`)} title="Centro de Control" className="p-2 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors mr-2"><Edit2 size={16}/></button>
          <button onClick={() => router.push(`/facturas?viaje_id=${v.id}`)} title="Ver Factura" className="p-2 bg-emerald-50 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-600 hover:text-emerald-700 dark:hover:text-white rounded-lg transition-colors mr-2"><Receipt size={16}/></button>
          <button onClick={() => generarPDFCartaPorte(v, perfilEmisor)} title="Descargar PDF" className="p-2 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-600 hover:text-blue-700 dark:hover:text-white rounded-lg transition-colors"><FileText size={16}/></button>
        </>
      )}

      {v.estatus === 'Cancelado' && (
        <>
          <button onClick={() => eliminarViaje(v.id)} title="Eliminar Definitivamente" className="p-2 text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-500 rounded-lg transition-colors mr-2"><Trash2 size={16}/></button>
          <button onClick={() => generarPDFCartaPorte(v, perfilEmisor)} title="Descargar PDF" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"><FileText size={16}/></button>
        </>
      )}

    </div>
  </td>


                    </tr>
                  ))}
                  {viajesFiltrados.length === 0 && (
                    <tr><td colSpan="6" className="py-16 text-center"><Navigation size={32} className="mx-auto text-slate-400 dark:text-slate-700 mb-3" /><p className="text-slate-500 uppercase tracking-widest text-sm font-black">No hay despachos</p></td></tr>
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
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm" onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} />
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 transition-colors">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 transition-colors">¿Estás Seguro?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 transition-colors">{dialogoConfirmacion.mensaje}</p>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    Descartar
                  </button>
                  <button onClick={ejecutarConfirmacion} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-red-600 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">
                    {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Sí, Proceder"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL DE REGISTRO */}
          {/* ========================================================= */}
          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-md" />
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-5xl rounded-[2.5rem] p-6 sm:p-10 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar transition-colors">
                <button onClick={cerrarModal} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X size={24} /></button>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white italic uppercase mb-8 transition-colors">Programar <span className="text-blue-600 dark:text-blue-500">Operación</span></h2>
                
                <form onSubmit={registrarViaje} className="space-y-6">
                  
                  {/* ASIGNACIONES (AHORA CON BUSCADORES) */}
                  <div className={`grid gap-4 ${esCamionArticulado ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    <SelectorBuscador
                      placeholder="Buscar Unidad / Tractocamión..."
                      opciones={catalogos.unidades.map(u => ({ id: u.id, label: `${u.numero_economico} (${u.configuracion_vehicular})` }))}
                      valorSeleccionado={formData.unidad_id}
                      onSelect={(id) => {
                        setFormData({...formData, unidad_id: id});
                        const unidadElegida = catalogos.unidades.find(u => u.id === id);
                        if (unidadElegida && !unidadElegida.configuracion_vehicular.includes('T') && !unidadElegida.configuracion_vehicular.includes('R')) {
                           setFormData(prev => ({...prev, unidad_id: id, remolque_id: ''}));
                        }
                      }}
                    />

                    {esCamionArticulado && (
                      <SelectorBuscador
                        placeholder="Buscar Remolque (OBLIGATORIO)..."
                        opciones={catalogos.remolques.map(r => ({ id: r.id, label: `${r.placas} - ${r.subtipo_remolque || 'Caja'}` }))}
                        valorSeleccionado={formData.remolque_id}
                        onSelect={(id) => setFormData({...formData, remolque_id: id})}
                      />
                    )}

                    <SelectorBuscador
                      placeholder="Buscar Operador..."
                      opciones={catalogos.operadores.map(o => ({ id: o.id, label: o.nombre_completo }))}
                      valorSeleccionado={formData.operador_id}
                      onSelect={(id) => setFormData({...formData, operador_id: id})}
                    />
                  </div>
                  
                  {/* RUTAS (CON BUSCADORES) */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                    <div className="col-span-1 sm:col-span-2">
                      <SelectorBuscador
                        placeholder="Buscar Origen..."
                        opciones={catalogos.ubicaciones.map(ub => ({ id: ub.id, label: ub.nombre_lugar }))}
                        valorSeleccionado={formData.origen_id}
                        onSelect={(id) => setFormData({...formData, origen_id: id})}
                      />
                    </div>
                    
                    <div className="col-span-1 sm:col-span-2">
                      <SelectorBuscador
                        placeholder="Buscar Destino..."
                        opciones={catalogos.ubicaciones.map(ub => ({ id: ub.id, label: ub.nombre_lugar }))}
                        valorSeleccionado={formData.destino_id}
                        onSelect={(id) => setFormData({...formData, destino_id: id})}
                      />
                    </div>
                    
                    <input required type="number" placeholder="KM Total" className="col-span-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white text-center transition-colors outline-none focus:border-blue-500" value={formData.distancia_km} onChange={e => setFormData({...formData, distancia_km: e.target.value})} />
                  </div>
                  
                  {/* MERCANCÍAS (PRODUCTOS CON BUSCADOR PEQUEÑO) */}
                  <div className="p-4 sm:p-6 border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-900/10 rounded-2xl space-y-4 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase flex items-center gap-2 font-black tracking-widest"><Package size={14}/> Detalle de Carga</p>
                      <button type="button" onClick={agregarFilaMercancia} className="w-full sm:w-auto text-[9px] font-black tracking-widest bg-blue-600 text-white px-4 py-2 sm:py-1.5 rounded-lg uppercase hover:bg-blue-500 transition-colors">+ Agregar Producto</button>
                    </div>
                    {formData.mercancias_detalle.map((item, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white dark:bg-slate-950 p-4 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                        
                        <div className="md:col-span-4">
                          <SelectorBuscador
                            isSmall={true} // <-- Hace que el tamaño empate con los inputs de al lado
                            placeholder="Buscar Producto..."
                            opciones={catalogos.mercancias.map(m => ({ id: m.id, label: m.descripcion }))}
                            valorSeleccionado={item.mercancia_id}
                            onSelect={(id) => actualizarFilaMercancia(index, 'mercancia_id', id)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:col-span-4">
                          <input required type="number" placeholder="Cant." className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 md:p-2.5 rounded-lg text-xs text-slate-900 dark:text-white text-center transition-colors w-full outline-none focus:border-blue-500" value={item.cantidad} onChange={e => actualizarFilaMercancia(index, 'cantidad', e.target.value)} />
                          <input required type="number" step="0.01" placeholder="Peso (KG)" className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 md:p-2.5 rounded-lg text-xs text-slate-900 dark:text-white text-center transition-colors w-full outline-none focus:border-blue-500" value={item.peso_kg} onChange={e => actualizarFilaMercancia(index, 'peso_kg', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:col-span-3">
                          <input type="number" step="0.01" placeholder="Valor ($)" className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 md:p-2.5 rounded-lg text-xs text-slate-900 dark:text-white text-center transition-colors w-full outline-none focus:border-blue-500" value={item.valor} onChange={e => actualizarFilaMercancia(index, 'valor', e.target.value)} />
                          <select className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 md:p-2.5 rounded-lg text-xs text-slate-900 dark:text-white text-center transition-colors w-full outline-none focus:border-blue-500" value={item.moneda} onChange={e => actualizarFilaMercancia(index, 'moneda', e.target.value)}><option value="MXN">MXN</option><option value="USD">USD</option></select>
                        </div>
                        <button type="button" onClick={() => eliminarFilaMercancia(index)} disabled={formData.mercancias_detalle.length === 1} className="md:col-span-1 text-slate-400 dark:text-slate-500 hover:text-red-500 flex justify-center py-3 md:py-0 disabled:opacity-30 border md:border-0 border-slate-200 dark:border-slate-800 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    ))}
                    <div className="text-right mt-2"><p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Peso Total: <span className="text-slate-900 dark:text-white text-xs ml-1 transition-colors">{calcularPesoTotal().toLocaleString('es-MX', {minimumFractionDigits: 2})} KG</span></p></div>
                  </div>
                  
                  {/* CASETAS Y GASOLINA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <input type="text" placeholder="TAG de Casetas (Ejemplo: Pase-123)" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white transition-colors outline-none focus:border-blue-500" value={formData.tag_casetas} onChange={e => setFormData({...formData, tag_casetas: e.target.value})} />
                    <input type="text" placeholder="Tarjeta de Gasolina (Ejemplo: Edenred-456)" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white transition-colors outline-none focus:border-blue-500" value={formData.tarjeta_gasolina} onChange={e => setFormData({...formData, tarjeta_gasolina: e.target.value})} />
                  </div>
                  
                  {/* CLIENTE, FLETE E IMPUESTOS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <SelectorBuscador
                        placeholder="Buscar Cliente para Facturar..."
                        opciones={clientes.map(c => ({ id: c.id, label: c.nombre }))}
                        valorSeleccionado={formData.cliente_id}
                        onSelect={(id) => setFormData({...formData, cliente_id: id})}
                      />
                    </div>
                    
                    <input type="text" placeholder="Orden de Compra / Referencia" className="col-span-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white transition-colors outline-none focus:border-blue-500" value={formData.referencia} onChange={e => setFormData({...formData, referencia: e.target.value})} />
                    
                    {puedeVerAdmin && (
                      <div className="col-span-1 flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input type="number" placeholder="Monto Flete Base ($)" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white font-mono transition-colors outline-none focus:border-blue-500" value={formData.monto_flete} onChange={e => setFormData({...formData, monto_flete: e.target.value})} />
                          <select className="w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-900 dark:text-white font-bold transition-colors outline-none focus:border-blue-500" value={formData.moneda} onChange={e => setFormData({...formData, moneda: e.target.value})}>
                            <option value="MXN">MXN</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                        
                        {/* === CONTROLES DE IMPUESTO === */}
                        <div className="flex gap-4 px-2 mt-1">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" className="w-4 h-4 accent-blue-600 dark:accent-blue-500 rounded border-slate-300 dark:border-slate-800 cursor-pointer" checked={formData.aplica_iva} onChange={e => setFormData({...formData, aplica_iva: e.target.checked})} />
                            <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-widest">+ IVA (16%)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" className="w-4 h-4 accent-blue-600 dark:accent-blue-500 rounded border-slate-300 dark:border-slate-800 cursor-pointer" checked={formData.aplica_retencion} onChange={e => setFormData({...formData, aplica_retencion: e.target.checked})} />
                            <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-widest">- Ret. (4%)</span>
                          </label>
                        </div>
                      </div>
                    )}

                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 rounded-2xl uppercase font-black text-[11px] tracking-widest shadow-xl transition-all bg-blue-600 hover:bg-blue-500 text-white">
                    {loading ? "Procesando..." : "Confirmar Viaje"}
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