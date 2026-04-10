'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, User, MapPin, Package, PlusCircle, Trash2, FileText, Navigation, Receipt, ShieldCheck, DollarSign, Loader2, Edit2, XCircle, FileCode, X, Calendar, ChevronDown
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { generarPDFCartaPorte } from '@/utils/PdfCartaPorte'; 
import { z } from 'zod';
import * as XLSX from 'xlsx';

// === ESCUDO DE VALIDACIÓN ZOD PARA VIAJES ===
const viajeSchema = z.object({
  distancia_km: z.number().positive("🛑 La distancia en KM debe ser estrictamente mayor a 0."),
  monto_flete: z.number().nonnegative("🛑 El monto del flete no puede ser negativo."),
  fecha_salida: z.string().min(10, "🛑 La fecha de salida es obligatoria.")
});

export default function ViajesPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viajes, setViajes] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null); 
  
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
    cliente_id: '', monto_flete: '', distancia_km: '', referencia: '', fecha_salida: new Date().toISOString().split('T')[0],
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
    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('empresa_id, rol')
      .eq('id', userId)
      .single();

    const idMaestro = perfilData?.empresa_id || userId;
    setEmpresaId(idMaestro);
    if (perfilData?.rol) setRolUsuario(perfilData.rol);

    await Promise.all([
      cargarCatalogos(idMaestro),
      obtenerViajes(idMaestro),
      obtenerPerfilFiscal(idMaestro)
    ]);
    setLoading(false);
  }

  async function obtenerPerfilFiscal(idMaestro) {
    const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', idMaestro).single();
    if (data) setPerfilEmisor(data);
  }

  async function cargarCatalogos(idMaestro) {
    const [u, o, ub, m, cl, r] = await Promise.all([
      supabase.from('unidades').select('*').eq('usuario_id', idMaestro).eq('activo', true),
      supabase.from('operadores').select('*').eq('usuario_id', idMaestro).eq('activo', true),
      supabase.from('ubicaciones').select('*').eq('usuario_id', idMaestro).eq('activo', true),
      supabase.from('mercancias').select('*').eq('usuario_id', idMaestro).eq('activo', true),
      supabase.from('clientes').select('*').eq('usuario_id', idMaestro).eq('activo', true),
      supabase.from('remolques').select('*').eq('usuario_id', idMaestro).eq('activo', true)
    ]);
    setCatalogos({ unidades: u.data || [], operadores: o.data || [], ubicaciones: ub.data || [], mercancias: m.data || [], remolques: r.data || [] });
    setClientes(cl.data || []);
  }

  async function obtenerViajes(idMaestro) {
    const { data } = await supabase.from('viajes').select(`
        *, unidades(*), operadores(*), remolques(*), clientes(*),
        origen:ubicaciones!viajes_origen_id_fkey(*), destino:ubicaciones!viajes_destino_id_fkey(*)
      `).eq('usuario_id', idMaestro).order('created_at', { ascending: false });
    setViajes(data || []);
  }

  const generarIdCCP = () => `CCC${crypto.randomUUID().substring(3).toUpperCase()}`;

  const agregarFilaMercancia = () => { setFormData({ ...formData, mercancias_detalle: [...formData.mercancias_detalle, { mercancia_id: '', cantidad: 1, peso_kg: '', valor: '', moneda: 'MXN' }] }); };
  const actualizarFilaMercancia = (index, campo, valor) => { const nuevasMercancias = [...formData.mercancias_detalle]; nuevasMercancias[index][campo] = valor; setFormData({ ...formData, mercancias_detalle: nuevasMercancias }); };
  const eliminarFilaMercancia = (index) => { const nuevasMercancias = formData.mercancias_detalle.filter((_, i) => i !== index); setFormData({ ...formData, mercancias_detalle: nuevasMercancias }); };
  const calcularPesoTotal = () => { return formData.mercancias_detalle.reduce((acc, curr) => acc + (Number(curr.peso_kg) || 0), 0); };

  const cerrarModal = () => {
    setMostrarModal(false);
    setEditandoId(null);
    setFormData(formInicial);
  };

  const editarViaje = (viaje) => {
    setEditandoId(viaje.id);
    let detalle = viaje.mercancias_detalle || [];
    if (detalle.length === 0 && viaje.mercancia_id) detalle = [{ mercancia_id: viaje.mercancia_id, cantidad: viaje.cantidad_mercancia || 1, peso_kg: viaje.peso_total_kg || '', valor: '', moneda: 'MXN' }];
    if (detalle.length === 0) detalle = [{ mercancia_id: '', cantidad: 1, peso_kg: '', valor: '', moneda: 'MXN' }];

    setFormData({
     unidad_id: viaje.unidad_id || '', remolque_id: viaje.remolque_id || '', operador_id: viaje.operador_id || '', origen_id: viaje.origen_id || '', destino_id: viaje.destino_id || '',
     cliente_id: viaje.cliente_id || '', monto_flete: viaje.monto_flete || '', distancia_km: viaje.distancia_km || '', referencia: viaje.referencia || '',
     fecha_salida: viaje.fecha_salida || new Date().toISOString().split('T')[0], mercancias_detalle: detalle,
     tag_casetas: viaje.tag_casetas || '', tarjeta_gasolina: viaje.tarjeta_gasolina || ''
      });
    setMostrarModal(true);
  };

  const eliminarViaje = async (id) => {
    if (!confirm("¿Deseas eliminar este viaje permanentemente?")) return;
    setLoading(true);
    try {
      await supabase.from('mantenimientos').delete().eq('viaje_id', id); 
      await supabase.from('facturas').delete().eq('viaje_id', id);
      await supabase.from('viajes').delete().eq('id', id);
      obtenerViajes(empresaId);
    } catch (error) { alert("Error al eliminar: " + error.message); } 
    finally { setLoading(false); }
  };

  const cancelarViaje = async (viaje) => {
    if (!confirm("¿Estás seguro de CANCELAR esta Carta Porte? Se enviará la petición al SAT y la factura quedará invalidada.")) return;
    setLoading(true);
    try {
      const { data: factura } = await supabase.from('facturas').select('facturapi_id').eq('viaje_id', viaje.id).single();
      if (factura && factura.facturapi_id) {
        await fetch('/api/facturapi', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: `invoices/${factura.facturapi_id}?motive=02`,
            method: 'DELETE'
          })
        });
      }
      await supabase.from('viajes').update({ estatus: 'Cancelado' }).eq('id', viaje.id);
      await supabase.from('facturas').update({ estatus_pago: 'Cancelada' }).eq('viaje_id', viaje.id);
      alert("✅ Carta Porte CANCELADA exitosamente.");
      obtenerViajes(empresaId);
    } catch (error) { alert("Error al cancelar: " + error.message); } finally { setLoading(false); }
  };

  const descargarXML = async (viajeId) => {
    setLoading(true);
    try {
      const { data: factura } = await supabase.from('facturas').select('facturapi_id').eq('viaje_id', viajeId).single();
      if (!factura || !factura.facturapi_id) throw new Error("No se encontró el registro de esta factura en el sistema.");

      const response = await fetch('/api/facturapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `invoices/${factura.facturapi_id}/xml`,
          method: 'GET'
        })
      });

      if (!response.ok) throw new Error("No se pudo descargar el XML del SAT.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CartaPorte_${factura.facturapi_id}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const traducirErrorFacturapi = (err) => {
    const errorStr = typeof err === 'object' ? JSON.stringify(err).toLowerCase() : String(err).toLowerCase();
    
    if (errorStr.includes("legal_name") || errorStr.includes("nombre")) return "🚨 NOMBRE INCORRECTO: Escríbelo exactamente como en la Constancia Fiscal.";
    if (errorStr.includes("zip") || errorStr.includes("postal")) return "🚨 CÓDIGO POSTAL: El CP del cliente o ubicación no coincide con el RFC en el SAT.";
    if (errorStr.includes("tax_system") || errorStr.includes("regimen")) return "🚨 RÉGIMEN FISCAL: El régimen del cliente no es correcto.";
    if (errorStr.includes("tax_id") || errorStr.includes("rfc")) return "🚨 RFC INVÁLIDO: Verifica que los RFC no tengan espacios.";
    if (errorStr.includes("configvehicular")) return "🚨 ERROR EN UNIDAD: La Configuración Vehicular debe ser una clave del SAT (Ej: T3S2).";
    if (errorStr.includes("placa")) return "🚨 PLACAS INVÁLIDAS: Revisa que las placas no tengan guiones ni espacios.";
    if (errorStr.includes("peso") || errorStr.includes("weight")) return "🚨 ERROR DE PESO: Verifica que el peso sea mayor a 0.";
    if (errorStr.includes("unidadpeso") || errorStr.includes("claveunidad")) return "🚨 CLAVE DE EMBALAJE: Verifica el embalaje seleccionado.";
    if (errorStr.includes("permisosct") || errorStr.includes("numpermiso")) return "🚨 PERMISO SCT: Faltan datos del permiso SCT de la unidad.";
    if (errorStr.includes("fecha") || errorStr.includes("date")) return "🚨 FECHA INVÁLIDA: La fecha de salida no es válida.";
    if (errorStr.includes("catalog key") || errorStr.includes("bienestransp")) return "🚨 CLAVE SAT INVÁLIDA: El código de la mercancía no existe en el SAT.";
    if (errorStr.includes("ubicaciones") && errorStr.includes("estado")) return "🚨 ESTADO FALTANTE: Falta la clave del Estado (Ej: NLE) en Origen o Destino.";

    if (typeof err === 'object' && err.message) return `❌ El SAT rechazó el timbrado:\n${err.message}`;
    return `❌ Error técnico:\n${typeof err === 'object' ? JSON.stringify(err) : err}`;
  };

  const timbrarCartaPorte = async (viaje) => {
    try {
      if (!viaje.clientes?.rfc) throw new Error("Falta el RFC del Cliente. Revisa el catálogo de Clientes.");
      if (!viaje.clientes?.codigo_postal) throw new Error("Falta el Código Postal del Cliente.");
      if (!viaje.clientes?.regimen_fiscal) throw new Error("Falta el Régimen Fiscal del Cliente.");

      const rfcOrigen = viaje.origen?.rfc_ubicacion || perfilEmisor?.rfc;
      const rfcDestino = viaje.destino?.rfc_ubicacion || viaje.clientes?.rfc;
      
      if (!rfcOrigen) throw new Error(`Falta el RFC de la ubicación de origen: ${viaje.origen?.nombre_lugar}`);
      if (!rfcDestino) throw new Error(`Falta el RFC de la ubicación de destino: ${viaje.destino?.nombre_lugar}`);
      if (!viaje.origen?.codigo_postal) throw new Error(`Falta el C.P. en el origen: ${viaje.origen?.nombre_lugar}`);
      if (!viaje.destino?.codigo_postal) throw new Error(`Falta el C.P. en el destino: ${viaje.destino?.nombre_lugar}`);
      if (!viaje.origen?.estado) throw new Error(`Falta el Estado (Ej: NLE) en el origen: ${viaje.origen?.nombre_lugar}`);
      if (!viaje.destino?.estado) throw new Error(`Falta el Estado (Ej: TAM) en el destino: ${viaje.destino?.nombre_lugar}`);

      const u = viaje.unidades;
      if (!u?.permiso_sict) throw new Error(`La unidad ${u?.numero_economico} NO tiene Tipo de Permiso SCT.`);
      if (!u?.num_permiso_sict) throw new Error(`La unidad ${u?.numero_economico} NO tiene Número de Permiso SCT.`);
      if (!u?.configuracion_vehicular) throw new Error(`La unidad ${u?.numero_economico} NO tiene Configuración Vehicular.`);
      if (!u?.placas) throw new Error(`La unidad ${u?.numero_economico} NO tiene Placas registradas.`);

      const op = viaje.operadores;
      if (!op?.rfc) throw new Error(`El operador ${op?.nombre_completo} NO tiene RFC registrado.`);
      if (!op?.numero_licencia) throw new Error(`El operador ${op?.nombre_completo} NO tiene Número de Licencia.`);

      const arregloMercanciasFacturapi = (viaje.mercancias_detalle || []).map((item, index) => {
        if (!item.clave_sat) throw new Error(`Falta la Clave SAT en el producto #${index + 1}`);
        if (!item.descripcion) throw new Error(`Falta la Descripción en el producto #${index + 1}`);
        if (!item.embalaje) throw new Error(`Falta el Embalaje (Clave Unidad) en el producto #${index + 1}`);
        if (!item.peso_kg || parseFloat(item.peso_kg) <= 0) throw new Error(`Falta el Peso (KG) en el producto #${index + 1}`);

        let mercancia = {
          BienesTransp: item.clave_sat,        
          Descripcion: item.descripcion,        
          Cantidad: parseFloat(item.cantidad),  
          ClaveUnidad: item.embalaje,           
          PesoEnKg: parseFloat(item.peso_kg),
          MaterialPeligroso: item.material_peligroso ? "Sí" : "No"
        };

        if (item.valor && parseFloat(item.valor) > 0) {
          mercancia.ValorMercancia = parseFloat(item.valor);
          mercancia.Moneda = item.moneda || "MXN";
        }
        return mercancia;
      });

      const pesoTotalTimbre = (viaje.mercancias_detalle || []).reduce((acc, item) => acc + (Number(item.peso_kg) || 0), 0) || viaje.peso_total_kg || 1;
      
      const ahora = new Date();
      ahora.setHours(ahora.getHours() - 1);

      const año = ahora.getFullYear();
      const mes = String(ahora.getMonth() + 1).padStart(2, '0');
      const dia = String(ahora.getDate()).padStart(2, '0');
      const horas = String(ahora.getHours()).padStart(2, '0');
      const minutos = String(ahora.getMinutes()).padStart(2, '0');
      const segundos = String(ahora.getSeconds()).padStart(2, '0');

      const fechaHoraCFDI = `${año}-${mes}-${dia}T${horas}:${minutos}:${segundos}`;

      const horasTrayecto = Math.ceil((viaje.distancia_km || 60) / 60) + 1;
      const llegadaDate = new Date(ahora.getTime() + (horasTrayecto * 60 * 60 * 1000));
      
      const llegadaAño = llegadaDate.getFullYear();
      const llegadaMes = String(llegadaDate.getMonth() + 1).padStart(2, '0');
      const llegadaDia = String(llegadaDate.getDate()).padStart(2, '0');
      const llegadaHoras = String(llegadaDate.getHours()).padStart(2, '0');
      const llegadaMinutos = String(llegadaDate.getMinutes()).padStart(2, '0');
      const llegadaSegundos = String(llegadaDate.getSeconds()).padStart(2, '0');

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
        if (!viaje.remolques || !viaje.remolques.placas) {
          throw new Error(`🛑 ERROR SAT: El camión ${u.numero_economico} tiene clave ${configSAT}. Es OBLIGATORIO que lleve un Remolque. Edita el viaje y asígnale uno.`);
        }
        autotransporteObj.Remolques = [
          { 
            SubTipoRem: (viaje.remolques.subtipo_remolque || "CTR02").trim().toUpperCase(), 
            Placa: viaje.remolques.placas.replace(/[- ]/g, '') 
          }
        ];
      }

      setLoading(true);
      
      const subtotal = Number((Number(viaje.monto_flete || 0) / 1.16).toFixed(2));
      const descripcionServicio = viaje.referencia ? `Servicio de Flete Nacional - Ref: ${viaje.referencia}` : "Servicio de Flete Nacional";

      const invoiceData = {
        type: "I",
        date: fechaHoraCFDI,
        customer: {
          legal_name: viaje.clientes.nombre, tax_id: viaje.clientes.rfc, tax_system: viaje.clientes.regimen_fiscal, address: { zip: viaje.clientes.codigo_postal }
        },
        items: [{ 
          quantity: 1, product: { description: descripcionServicio, product_key: "78101802", price: subtotal, taxes: [{ type: "IVA", rate: 0.16 }, { type: "IVA", rate: 0.04, withholding: true }] } 
        }],
        payment_form: "99", payment_method: "PPD", use: viaje.clientes.uso_cfdi || "G03",
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
              PesoBrutoTotal: pesoTotalTimbre, UnidadPeso: "KGM", NumTotalMercancias: arregloMercanciasFacturapi.length, Mercancia: arregloMercanciasFacturapi, 
              Autotransporte: autotransporteObj
            },
            FiguraTransporte: [{ TipoFigura: "01", RFCFigura: op.rfc, NumLicencia: op.numero_licencia, NombreFigura: op.nombre_completo }]
          }
        }]
      };

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("Sesión expirada o inválida. Vuelve a iniciar sesión.");

      const response = await fetch('/api/facturapi', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }, 
        body: JSON.stringify({
          endpoint: 'invoices',
          method: 'POST',
          payload: invoiceData
        }) 
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

        alert(`🎉 ¡CARTA PORTE TIMBRADA!\nUUID: ${res.uuid}`);
        obtenerViajes(empresaId);
      } else {
        alert(traducirErrorFacturapi(res));
      }
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  }; 

  const registrarViaje = async (e) => {
    e.preventDefault();
    if (formData.mercancias_detalle.length === 0) return alert("Debes agregar al menos una mercancía al viaje.");
    
    setLoading(true);
    try {
      const clienteObj = clientes.find(c => c.id === formData.cliente_id);
      const mercanciasEnriquecidas = formData.mercancias_detalle.map(item => {
        const cat = catalogos.mercancias.find(m => m.id === item.mercancia_id);
        return { ...item, clave_sat: cat?.clave_sat, descripcion: cat?.descripcion, embalaje: cat?.clave_embalaje || '4G', material_peligroso: cat?.material_peligroso || false };
      });

      const remolqueLimpio = esCamionArticulado ? formData.remolque_id : null;

      const payloadComun = {
        distancia_km: parseFloat(formData.distancia_km || 0), 
        unidad_id: formData.unidad_id, 
        remolque_id: remolqueLimpio, 
        operador_id: formData.operador_id, 
        origen_id: formData.origen_id, 
        destino_id: formData.destino_id,
        mercancia_id: formData.mercancias_detalle[0].mercancia_id, 
        mercancias_detalle: mercanciasEnriquecidas, 
        peso_total_kg: calcularPesoTotal(), 
        cliente_id: formData.cliente_id || null, 
        monto_flete: parseFloat(formData.monto_flete || 0), 
        referencia: formData.referencia || '', 
        fecha_salida: formData.fecha_salida, 
        usuario_id: empresaId,
        tag_casetas: formData.tag_casetas,
        tarjeta_gasolina: formData.tarjeta_gasolina
      };

      const validacion = viajeSchema.safeParse({
        distancia_km: payloadComun.distancia_km,
        monto_flete: payloadComun.monto_flete,
        fecha_salida: payloadComun.fecha_salida
      });

      if (!validacion.success) {
        setLoading(false);
        const mensajeError = validacion.error.issues[0]?.message || "🛑 Revisa los datos ingresados.";
        return alert(mensajeError);
      }

      if (editandoId) {
        // === EDICIÓN DE VIAJE ===
        await supabase.from('viajes').update(payloadComun).eq('id', editandoId);
        
        if (formData.monto_flete > 0 && formData.cliente_id) {
          const fechaVenc = new Date(formData.fecha_salida); fechaVenc.setDate(fechaVenc.getDate() + (clienteObj?.dias_credito || 0));
          const { data: facExistente } = await supabase.from('facturas').select('id').eq('viaje_id', editandoId).single();
          
          if (facExistente) {
            await supabase.from('facturas').update({ cliente: clienteObj.nombre, monto_total: parseFloat(formData.monto_flete), fecha_viaje: formData.fecha_salida, fecha_vencimiento: fechaVenc.toISOString().split('T')[0], ruta: `Flete CCP${formData.referencia ? ' - Ref: '+formData.referencia : ''}` }).eq('id', facExistente.id);
          } else {
            const { data: viajeEditado } = await supabase.from('viajes').select('folio_interno').eq('id', editandoId).single();
            await supabase.from('facturas').insert([{ 
              usuario_id: empresaId, viaje_id: editandoId, folio_viaje: viajeEditado?.folio_interno,
              cliente: clienteObj.nombre, monto_total: parseFloat(formData.monto_flete), fecha_viaje: formData.fecha_salida, fecha_vencimiento: fechaVenc.toISOString().split('T')[0], estatus_pago: 'Pendiente', ruta: `Flete CCP${formData.referencia ? ' - Ref: '+formData.referencia : ''}` 
            }]);
          }
        }
      } else {
        // === CREACIÓN DE VIAJE ===
        const nuevoIdCCP = generarIdCCP();

        const { data: nuevoViaje, error: errorViaje } = await supabase.from('viajes')
          .insert([{ ...payloadComun, id_ccp: nuevoIdCCP, estatus: 'Borrador' }])
          .select().single();
          
        if (errorViaje) throw errorViaje;

        // --- INICIO DEL MOTOR DE ODÓMETRO ESTIMADO ---
        if (payloadComun.unidad_id && payloadComun.distancia_km > 0) {
          // 1. Obtenemos el kilometraje actual del camión
          const { data: unidadData } = await supabase
            .from('unidades')
            .select('kilometraje_actual')
            .eq('id', payloadComun.unidad_id)
            .single();

          const kmActuales = Number(unidadData?.kilometraje_actual || 0);
          const kmRuta = Number(payloadComun.distancia_km);
          const nuevoKilometraje = kmActuales + kmRuta;

          // 2. Sumamos y guardamos el nuevo total en la unidad
          await supabase
            .from('unidades')
            .update({ kilometraje_actual: nuevoKilometraje })
            .eq('id', payloadComun.unidad_id);
        }
        // --- FIN DEL MOTOR DE ODÓMETRO ESTIMADO ---

        // Creación de factura ligada
        if (formData.monto_flete > 0 && formData.cliente_id) {
          const fechaVenc = new Date(formData.fecha_salida); fechaVenc.setDate(fechaVenc.getDate() + (clienteObj?.dias_credito || 0));
          
          await supabase.from('facturas').insert([{ 
            usuario_id: empresaId, viaje_id: nuevoViaje.id, folio_viaje: nuevoViaje.folio_interno,
            cliente: clienteObj.nombre, monto_total: parseFloat(formData.monto_flete), fecha_viaje: formData.fecha_salida, fecha_vencimiento: fechaVenc.toISOString().split('T')[0], estatus_pago: 'Pendiente', ruta: `Flete CCP${formData.referencia ? ' - Ref: '+formData.referencia : ''}` 
          }]);
        }

        // Registro de gastos de viaje
        if (formData.gasto_monto && parseFloat(formData.gasto_monto) > 0) {
          await supabase.from('mantenimientos').insert([{
            usuario_id: empresaId,
            unidad_id: formData.unidad_id,
            viaje_id: nuevoViaje.id, 
            descripcion: formData.gasto_descripcion || `Gastos Operativos - Viaje V-${String(nuevoViaje.folio_interno).padStart(4, '0')}`,
            costo: parseFloat(formData.gasto_monto), 
            tipo: 'Otros',
            fecha: formData.fecha_salida
          }]);
        }
      }

      cerrarModal(); obtenerViajes(empresaId);
    } catch (err) { alert("Error: " + err.message); } finally { setLoading(false); }
  };

  const getBadgeColor = (estatus) => {
    switch(estatus) {
      case 'Emitido (Timbrado)': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Cancelado': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    }
  };

  const filtrarPorPeriodo = (viajeDate) => {
    if (!filtroActivo) return true; 
    if (!viajeDate) return false;
    if (!fechaInicio && !fechaFin) return true;

    const fViaje = new Date(viajeDate + 'T12:00:00'); 
    const fInicio = fechaInicio ? new Date(fechaInicio + 'T12:00:00') : null;
    const fFin = fechaFin ? new Date(fechaFin + 'T12:00:00') : null;

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
      { id: 'Cancelado', label: 'Cancelados', count: viajesDelPeriodo.filter(v => v.estatus === 'Cancelado').length },
    ];
  };

  const viajesFiltrados = viajesDelPeriodo.filter(v => {
    const pasaEstatus = filtroEstatus === 'Todos' || v.estatus === filtroEstatus;
    const pasaOrigen = filtroOrigen === '' || v.origen_id === filtroOrigen;
    const pasaDestino = filtroDestino === '' || v.destino_id === filtroDestino;
    
    return pasaEstatus && pasaOrigen && pasaDestino;
  });

  if (!sesion) return null;

  if (rolUsuario === 'facturacion') {
    return (
      <div className="flex bg-slate-950 min-h-screen text-slate-200 w-full">
        <Sidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center">
          <h2 className="text-2xl text-white font-black uppercase tracking-widest">Acceso Restringido</h2>
          <p className="text-slate-500 text-sm mt-2">Tu perfil de Facturación no tiene acceso a Logística Operativa.</p>
        </main>
      </div>
    );
  }
  
  const exportarExcelViajes = () => {
    const datosParaExcel = viajesFiltrados.map(v => ({
      Folio: `V-${String(v.folio_interno).padStart(4, '0')}`,
      Fecha: v.fecha_salida,
      Estatus: v.estatus,
      Cliente: v.clientes?.nombre || 'N/A',
      Referencia: v.referencia || '',
      Origen: v.origen?.nombre_lugar || '',
      Destino: v.destino?.nombre_lugar || '',
      Unidad: v.unidades?.numero_economico || '',
      Operador: v.operadores?.nombre_completo || '',
      Peso_KG: v.peso_total_kg,
      Monto_Flete: v.monto_flete || 0,
      ID_CartaPorte: v.id_ccp || ''
    }));

    const ws = XLSX.utils.json_to_sheet(datosParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Viajes Filtrados");
    XLSX.writeFile(wb, `Reporte_Viajes_FleetForce_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">
              Logística <span className="text-blue-500">Operativa</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">
              Histórico de Despachos y Carta Porte
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <button 
              onClick={() => setMostrarModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"><PlusCircle size={16} /> Crear Despacho
            </button>
          </div>
        </header>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-800 pb-4">
            
            <div className="flex gap-2 overflow-x-auto scrollbar-hide w-full sm:w-auto">
              {getFiltrosArray().map(f => (
                <button key={f.id} onClick={() => setFiltroEstatus(f.id)} 
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border
                  ${filtroEstatus === f.id ? 'bg-slate-800 text-white border-slate-700 shadow-md' : 'bg-slate-900/50 text-slate-500 border-transparent hover:bg-slate-800/50'}`}>
                  {f.label} <span className={`px-2 py-0.5 rounded-full text-[9px] ${filtroEstatus === f.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{f.count}</span>
                </button>
              ))}
            </div>

        <div className="relative shrink-0">
          <button 
            onClick={() => setMostrarFiltro(!mostrarFiltro)}
            className={`flex items-center gap-3 border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
              ${filtroActivo ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Calendar size={14} className={filtroActivo ? 'text-blue-500' : 'text-slate-500'} />
            {filtroActivo ? 'Filtro Activo' : 'Periodo'}
            <ChevronDown size={14} className={`transition-transform duration-200 ${mostrarFiltro ? 'rotate-180' : ''}`} />
          </button>

          {mostrarFiltro && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-[1.5rem] shadow-2xl overflow-hidden z-20 p-6 animate-in fade-in zoom-in-95 duration-200">
              
              <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-5 border-b border-slate-800 pb-3">
                Filtros de Búsqueda
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Desde</label>
                  <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white text-[11px] rounded-xl p-3 outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Hasta</label>
                  <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white text-[11px] rounded-xl p-3 outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Origen de Ruta</label>
                  <select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-3 outline-none focus:border-blue-500 appearance-none">
                    <option value="">Todos los Orígenes</option>
                    {catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Destino de Ruta</label>
                  <select value={filtroDestino} onChange={(e) => setFiltroDestino(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-3 outline-none focus:border-blue-500 appearance-none">
                    <option value="">Todos los Destinos</option>
                    {catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-800">
                <button onClick={() => { setFiltroActivo(true); setMostrarFiltro(false); }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20">
                  Aplicar Filtros
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  {filtroActivo && (
                    <button onClick={() => { setFiltroActivo(false); setFechaInicio(''); setFechaFin(''); setFiltroOrigen(''); setFiltroDestino(''); setMostrarFiltro(false); }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl transition-colors">
                      Limpiar
                    </button>
                  )}
                  
                  {puedeVerAdmin && (
                    <button 
                      onClick={exportarExcelViajes} 
                      className={`${filtroActivo ? '' : 'col-span-2'} flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl transition-colors`}
                    >
                      <FileText size={12} /> Excel
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

          </div>

          {/* ========================================================= */}
          {/* TABLA OPTIMIZADA FORMATO DATA-GRID */}
          {/* ========================================================= */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] mb-12 flex flex-col shadow-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
                    <th className="p-5 pl-8 w-32">Folio & Estatus</th>
                    <th className="p-5 w-48">Cliente / Referencia</th>
                    <th className="p-5 min-w-[220px]">Ruta Operativa</th>
                    <th className="p-5 min-w-[200px]">Asignación</th>
                    <th className="p-5 w-32">Detalle Carga</th>
                    <th className="p-5 pr-8 w-40 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {viajesFiltrados.map((v) => (
                    <tr key={v.id} className={`hover:bg-slate-800/40 transition-colors group ${v.estatus === 'Cancelado' ? 'opacity-50 grayscale' : ''}`}>
                      
                      {/* 1. FOLIO & ESTATUS */}
                      <td className="p-4 pl-8 whitespace-nowrap align-middle">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[14px] text-white font-mono font-medium">V-{String(v.folio_interno).padStart(4, '0')}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded border uppercase tracking-widest text-[9px] items-center gap-1 ${getBadgeColor(v.estatus)}`}>
                            {v.estatus}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-0.5 font-medium">{v.fecha_salida?.slice(0, 10)}</span>
                        </div>
                      </td>

                      {/* 2. CLIENTE / REF */}
                      <td className="p-4 whitespace-nowrap align-middle">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="text-white text-sm font-semibold truncate max-w-[200px]" title={v.clientes?.nombre}>
                            {v.clientes?.nombre || 'Sin Cliente'}
                          </span>
                          {v.referencia ? (
                            <span className="text-blue-400 text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                              PO: {v.referencia}
                            </span>
                          ) : (
                            v.clientes?.rfc && <span className="text-slate-500 text-[10px] font-mono tracking-widest">RFC: {v.clientes.rfc}</span>
                          )}
                        </div>
                      </td>

                      {/* 3. RUTA OPERATIVA */}
                      <td className="p-4 whitespace-nowrap align-middle">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-slate-200 text-xs">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"/> 
                            <span className="truncate max-w-[220px]" title={v.origen?.nombre_lugar}>{v.origen?.nombre_lugar || 'Sin Origen'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-200 text-xs">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] shrink-0"/> 
                            <span className="truncate max-w-[220px]" title={v.destino?.nombre_lugar}>{v.destino?.nombre_lugar || 'Sin Destino'}</span>
                          </div>
                        </div>
                      </td>

                      {/* 4. ASIGNACIÓN */}
                      <td className="p-4 whitespace-nowrap align-middle">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-white text-xs font-semibold uppercase truncate max-w-[200px]" title={v.operadores?.nombre_completo}>
                            {v.operadores?.nombre_completo || 'Sin Operador'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">
                            <Truck size={10} className="text-blue-400"/> 
                            {v.unidades?.numero_economico || 'N/A'} {v.remolques ? `+ ${v.remolques.placas}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* 5. DETALLE CARGA */}
                      <td className="p-4 whitespace-nowrap align-middle">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[13px] text-white font-mono font-medium">{v.peso_total_kg} KG</span>
                        </div>
                      </td>

                      {/* 6. ACCIONES */}
                      <td className="p-4 pr-8 whitespace-nowrap text-center align-middle">
                        <div className="flex items-center justify-end gap-1.5 opacity-30 group-hover:opacity-100 transition-opacity">
                          
                          {v.estatus === 'Borrador' && (
                            <>
                              <button onClick={() => eliminarViaje(v.id)} title="Eliminar Viaje" className="p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={16}/></button>
                              <button onClick={() => editarViaje(v)} title="Editar Viaje" className="p-2 text-slate-400 hover:bg-orange-500/10 hover:text-orange-400 rounded-lg transition-colors mr-2"><Edit2 size={16}/></button> 

                             {puedeVerAdmin && (
                              <button onClick={() => generarPDFCartaPorte(v, perfilEmisor)} title="Previsualizar PDF (Borrador)" className="p-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors mr-2">
                                <FileText size={16}/>
                              </button>  )}

                              {puedeVerAdmin && (
                              <button onClick={() => timbrarCartaPorte(v)} disabled={loading} className="px-3 py-1.5 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/20 rounded-lg uppercase tracking-widest text-[10px] flex items-center gap-1.5 transition-colors">
                                {loading ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>} Timbrar
                              </button>  )}
                            </>
                          )}

                          {v.estatus === 'Emitido (Timbrado)' && (
                            <>
                              <button onClick={() => cancelarViaje(v)} disabled={loading} title="Cancelar Carta Porte en el SAT" className="p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors mr-2"><XCircle size={16}/></button>
                              <button onClick={() => descargarXML(v.id)} title="Descargar XML" className="p-2 bg-purple-600/10 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg transition-colors"><FileCode size={16}/></button>
                              <button onClick={() => router.push(`/facturas?viaje_id=${v.id}`)} title="Ver Factura (Ingreso)" className="p-2 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors"><Receipt size={16}/></button>
                              <button onClick={() => generarPDFCartaPorte(v, perfilEmisor)} title="Descargar Carta Porte" className="p-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg transition-colors"><FileText size={16}/></button>
                            </>
                          )}

                          {v.estatus === 'Cancelado' && (
                            <>
                              <button onClick={() => eliminarViaje(v.id)} title="Eliminar Definitivamente" className="p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors mr-2"><Trash2 size={16}/></button>
                              <button onClick={() => generarPDFCartaPorte(v, perfilEmisor)} title="Descargar PDF Cancelado" className="p-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"><FileText size={16}/></button>
                            </>
                          )}

                        </div>
                      </td>
                    </tr>
                  ))}
                  
                  {viajesFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <Navigation size={32} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm font-black">No hay despachos en este periodo</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* MODAL DE REGISTRO */}
          {/* ========================================================= */}
          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                <button onClick={cerrarModal} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">{editandoId ? 'Editar' : 'Programar'} <span className="text-blue-500">Operación</span></h2>
                
                <form onSubmit={registrarViaje} className="space-y-6">
                  
                  <div className={`grid gap-4 ${esCamionArticulado ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" 
                      value={formData.unidad_id} 
                      onChange={e => {
                        setFormData({...formData, unidad_id: e.target.value});
                        const unidadElegida = catalogos.unidades.find(u => u.id === e.target.value);
                        if (unidadElegida && !unidadElegida.configuracion_vehicular.includes('T') && !unidadElegida.configuracion_vehicular.includes('R')) {
                           setFormData(prev => ({...prev, unidad_id: e.target.value, remolque_id: ''}));
                        }
                      }}>
                      <option value="">Tractocamión / Unidad...</option>
                      {catalogos.unidades.map(u => <option key={u.id} value={u.id}>{u.numero_economico} ({u.configuracion_vehicular})</option>)}
                    </select>

                    {esCamionArticulado && (
                      <select required className="bg-slate-950 border border-orange-500/50 p-4 rounded-xl text-sm text-white" value={formData.remolque_id} onChange={e => setFormData({...formData, remolque_id: e.target.value})}>
                        <option value="">Remolque (OBLIGATORIO)...</option>
                        {catalogos.remolques.map(r => <option key={r.id} value={r.id}>{r.placas} - {r.subtipo_remolque || 'Caja'}</option>)}
                      </select>
                    )}

                    <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.operador_id} onChange={e => setFormData({...formData, operador_id: e.target.value})}>
                      <option value="">Operador...</option>
                      {catalogos.operadores.map(o => <option key={o.id} value={o.id}>{o.nombre_completo}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-5 gap-4">
                    <select required className="col-span-2 w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.origen_id} onChange={e => setFormData({...formData, origen_id: e.target.value})}>
                      <option value="">Origen...</option>
                      {catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}
                    </select>
                    <select required className="col-span-2 w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.destino_id} onChange={e => setFormData({...formData, destino_id: e.target.value})}>
                      <option value="">Destino...</option>
                      {catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}
                    </select>
                    <input required type="number" placeholder="KM Total" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white text-center" value={formData.distancia_km} onChange={e => setFormData({...formData, distancia_km: e.target.value})} />
                  </div>

                  <div className="p-6 border border-blue-500/20 bg-blue-900/10 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] text-blue-400 uppercase flex items-center gap-2 font-black tracking-widest"><Package size={14}/> Detalle de Carga y Seguros</p>
                      <button type="button" onClick={agregarFilaMercancia} className="text-[9px] font-black tracking-widest bg-blue-600 text-white px-3 py-1.5 rounded-lg uppercase hover:bg-blue-500 transition-colors">+ Agregar Producto</button>
                    </div>

                    {formData.mercancias_detalle.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <select required className="col-span-4 bg-slate-950 text-sm text-white outline-none" 
                          value={item.mercancia_id} onChange={e => actualizarFilaMercancia(index, 'mercancia_id', e.target.value)}>
                          <option value="">Seleccionar Producto...</option>
                          {catalogos.mercancias.map(m => <option key={m.id} value={m.id}>{m.descripcion}</option>)}
                        </select>
                        <input required type="number" placeholder="Cant." className="col-span-2 bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs text-white text-center focus:border-blue-500" 
                          value={item.cantidad} onChange={e => actualizarFilaMercancia(index, 'cantidad', e.target.value)} />
                        <input required type="number" step="0.01" placeholder="Peso (KG)" className="col-span-2 bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs text-white text-center focus:border-blue-500" 
                          value={item.peso_kg} onChange={e => actualizarFilaMercancia(index, 'peso_kg', e.target.value)} />
                        
                        <input type="number" step="0.01" placeholder="Valor ($)" className="col-span-2 bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs text-white text-center focus:border-blue-500" 
                          value={item.valor} onChange={e => actualizarFilaMercancia(index, 'valor', e.target.value)} title="Valor de la mercancía (Opcional)" />
                        <select className="col-span-1 bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs text-white text-center" 
                          value={item.moneda} onChange={e => actualizarFilaMercancia(index, 'moneda', e.target.value)}>
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </select>

                        <button type="button" onClick={() => eliminarFilaMercancia(index)} disabled={formData.mercancias_detalle.length === 1} className="col-span-1 text-slate-500 hover:text-red-500 flex justify-center disabled:opacity-30 transition-colors"><Trash2 size={16}/></button>
                      </div>
                    ))}
                    <div className="text-right mt-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Total: <span className="text-white text-xs ml-1">{calcularPesoTotal().toLocaleString('es-MX', {minimumFractionDigits: 2})} KG</span></p></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <input type="text" placeholder="TAG de Casetas (Ejemplo: Pase-123)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.tag_casetas} onChange={e => setFormData({...formData, tag_casetas: e.target.value})} />
                    <input type="text" placeholder="Tarjeta de Gasolina (Ejemplo: Edenred-456)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.tarjeta_gasolina} onChange={e => setFormData({...formData, tarjeta_gasolina: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <select required className="col-span-1 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value})}>
                      <option value="">Cliente Factura...</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <input type="text" placeholder="Orden de Compra / Referencia (Opcional)" className="col-span-1 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.referencia} onChange={e => setFormData({...formData, referencia: e.target.value})} />
                    
                    {puedeVerAdmin && (
                      <input type="number" placeholder="Monto Flete ($)" className="col-span-1 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-mono" value={formData.monto_flete} onChange={e => setFormData({...formData, monto_flete: e.target.value})} />
                    )}
                  </div>
                                      
                  <button type="submit" disabled={loading} className={`w-full py-5 rounded-2xl uppercase font-black text-[11px] tracking-widest shadow-xl transition-all ${editandoId ? 'bg-orange-500 hover:bg-orange-400' : 'bg-blue-600 hover:bg-blue-500'} text-white`}>
                    {loading ? "Procesando..." : (editandoId ? "Guardar Cambios" : "Confirmar Viaje")}
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