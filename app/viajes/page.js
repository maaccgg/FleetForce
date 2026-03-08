'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, User, MapPin, Package, PlusCircle, 
  Trash2, FileText, X, Navigation, Receipt, ShieldCheck, DollarSign,
} from 'lucide-react';
import Sidebar from '@/components/sidebar';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ViajesPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viajes, setViajes] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  const [catalogos, setCatalogos] = useState({ 
    unidades: [], operadores: [], ubicaciones: [], mercancias: [], remolques: [] 
  });
  const [clientes, setClientes] = useState([]);
  const [perfilEmisor, setPerfilEmisor] = useState(null);

  const [formData, setFormData] = useState({
    unidad_id: '', operador_id: '', origen_id: '', destino_id: '', 
    mercancia_id: '', remolque_id: '', cantidad_mercancia: 1, 
    fecha_salida: new Date().toISOString().split('T')[0],
    cliente_id: '', monto_flete: '', distancia_km: ''
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

  async function obtenerPerfilFiscal(userId) {
    const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', userId).single();
    if (data) setPerfilEmisor(data);
  }

  async function cargarCatalogos(userId) {
    const [u, o, ub, m, cl, r] = await Promise.all([
      supabase.from('unidades').select('*').eq('usuario_id', userId),
      supabase.from('operadores').select('*').eq('usuario_id', userId),
      supabase.from('ubicaciones').select('*').eq('usuario_id', userId),
      supabase.from('mercancias').select('*').eq('usuario_id', userId),
      supabase.from('clientes').select('*').eq('usuario_id', userId),
      supabase.from('remolques').select('*').eq('usuario_id', userId)
    ]);
    
    setCatalogos({ 
      unidades: u.data || [], operadores: o.data || [], 
      ubicaciones: ub.data || [], mercancias: m.data || [],
      remolques: r.data || []
    });
    setClientes(cl.data || []);
  }

  async function obtenerViajes(userId) {
    const { data } = await supabase.from('viajes').select(`
        *, unidades(*), operadores(*), remolques(*), clientes(*),
        origen:ubicaciones!viajes_origen_id_fkey(*),
        destino:ubicaciones!viajes_destino_id_fkey(*),
        mercancias(*)
      `).eq('usuario_id', userId).order('created_at', { ascending: false });
    setViajes(data || []);
  }

  const generarIdCCP = () => 'CCC' + crypto.randomUUID().toUpperCase().substring(3);

  const prepararJsonCartaPorte = (viaje) => {
    /* Tu motor JSON actual se mantiene igual */
    const pesoBruto = viaje.peso_total_kg || 15000;
    const distancia = viaje.distancia_km || 150; 
    const fechaHoraSalida = `${viaje.fecha_salida}T08:00:00`;
    const fechaHoraLlegada = `${viaje.fecha_salida}T20:00:00`;

    const jsonCartaPorte = {
      "Version": "4.0", "TipoDeComprobante": "I", "Total": viaje.monto_total || "0.00",
      "Complemento": {
        "CartaPorte": {
          "Version": "3.1", "IdCCP": viaje.id_ccp, "TranspInternac": "No", "TotalDistRec": distancia,
          "Ubicaciones": [
            {
              "TipoUbicacion": "Origen", "RFCRemitenteDestinatario": perfilEmisor?.rfc, "FechaHoraSalidaLlegada": fechaHoraSalida,
              "Domicilio": { "Calle": viaje.origen?.nombre_lugar, "Estado": viaje.origen?.estado || "NLE", "Pais": "MEX", "CodigoPostal": viaje.origen?.codigo_postal }
            },
            {
              "TipoUbicacion": "Destino", "RFCRemitenteDestinatario": viaje.clientes?.rfc || "XAXX010101000", "DistanciaRecorrida": distancia, "FechaHoraSalidaLlegada": fechaHoraLlegada,
              "Domicilio": { "Calle": viaje.destino?.nombre_lugar, "Estado": viaje.destino?.estado || "TAM", "Pais": "MEX", "CodigoPostal": viaje.destino?.codigo_postal }
            }
          ],
          "Mercancias": {
            "PesoBrutoTotal": pesoBruto, "UnidadPeso": "KGM", "NumTotalMercancias": 1,
            "Mercancia": [{ "BienesTransp": viaje.mercancias?.clave_sat || "31181701", "Descripcion": viaje.mercancias?.descripcion, "Cantidad": viaje.cantidad_mercancia, "ClaveUnidad": "KGM", "PesoEnKg": pesoBruto }],
            "Autotransporte": {
              "PermSCT": viaje.unidades?.permiso_sict || "TPAF01", "NumPermisoSCT": viaje.unidades?.num_permiso_sict || "S/N",
              "IdentificacionVehicular": { "ConfigVehicular": viaje.unidades?.configuracion_vehicular || "T3S1", "PlacaVM": viaje.unidades?.placas, "AnioModeloVM": viaje.unidades?.anio_modelo || "2015" },
              "Seguros": { "AseguraRespCivil": viaje.unidades?.aseguradora_rc || "QUALITAS", "PolizaRespCivil": viaje.unidades?.poliza_rc || "00000" },
              "Remolques": viaje.remolques ? { "Remolque": [{ "SubTipoRem": viaje.remolques.subtipo_remolque || "CTR007", "Placa": viaje.remolques.placas }] } : null
            }
          },
          "FiguraTransporte": { "TiposFigura": "01", "RFCFigura": viaje.operadores?.rfc, "NumLicencia": viaje.operadores?.numero_licencia, "NombreFigura": viaje.operadores?.nombre_completo }
        }
      }
    };
    return jsonCartaPorte;
  };

  const timbrarCartaPorte = async (viaje) => {
    const datosJSON = prepararJsonCartaPorte(viaje);
    console.log("🚛 PAQUETE CARTA PORTE 3.1 LISTO PARA EL SAT:", JSON.stringify(datosJSON, null, 2));
    if (!confirm("Revisa la consola. Se enviará la CARTA PORTE al PAC (Simulación). ¿Continuar?")) return;

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      const simulatedUUID = `CCP-${Math.random().toString(36).substring(2, 10).toUpperCase()}-XXXX-YYYY`;
      const { error } = await supabase.from('viajes').update({ estatus: 'Emitido (Timbrado)' }).eq('id', viaje.id);
      if (error) throw error;
      alert(`✅ ¡Carta Porte Timbrada con Éxito!\n\nUUID: ${simulatedUUID}\nIdCCP: ${viaje.id_ccp}`);
      obtenerViajes(sesion.user.id);
    } catch (err) { alert("Error en timbrado: " + err.message); } finally { setLoading(false); }
  };

  // =========================================================================
  // NUEVO DISEÑO DE PDF (CARTA PORTE ESTILO "FEMA")
  // =========================================================================
  const generarPDF = (viaje) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // --- CABECERA ---
    // Placeholder para el LOGO
    doc.setDrawColor(200);
    doc.rect(14, 15, 35, 20);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("ESPACIO\nPARA LOGO", 31.5, 24, { align: 'center' });

    // Emisor Info
    doc.setTextColor(0); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(perfilEmisor?.razon_social || "EMPRESA DE TRANSPORTE SA DE CV", 55, 20);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`RFC: ${perfilEmisor?.rfc || 'XEXX010101000'}`, 55, 25);
    doc.text(`Régimen: ${perfilEmisor?.regimen_fiscal || '601'}`, 55, 29);
    doc.text(`C.P. Emisión: ${perfilEmisor?.codigo_postal || '00000'}`, 55, 33);

    // Bloque Derecho (Tipo y Fechas)
    doc.setFillColor(15, 23, 42); // Azul oscuro institucional
    doc.rect(145, 15, 51, 8, 'F');
    doc.setTextColor(255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("INGRESO / CARTA PORTE", 170.5, 20, { align: 'center' });
    
    doc.setTextColor(0); doc.setFontSize(8);
    autoTable(doc, {
      startY: 23, margin: { left: 145, right: 14 },
      body: [
        ['Folio Interno:', `#${String(viaje.folio_interno).padStart(5, '0')}`],
        ['Fecha Emisión:', viaje.fecha_salida],
        ['Folio Fiscal (UUID):', viaje.estatus === 'Borrador' ? 'POR ASIGNAR' : 'TIMBRADO-PAC-12345']
      ],
      theme: 'plain', styles: { fontSize: 7, cellPadding: 1 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
    });

    // --- SECCIÓN: CLIENTE (Receptor de Factura) ---
    doc.setDrawColor(200); doc.line(14, 45, 196, 45);
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("CLIENTE / RECEPTOR:", 14, 51);
    
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Nombre: ${viaje.clientes?.nombre || 'PÚBLICO EN GENERAL'}`, 14, 56);
    doc.text(`RFC: ${viaje.clientes?.rfc || 'XAXX010101000'}`, 14, 60);
    doc.text(`Uso CFDI: ${viaje.clientes?.uso_cfdi || 'G03'} | Régimen: ${viaje.clientes?.regimen_fiscal || '601'}`, 14, 64);
    
    // Calcular condiciones de pago
    const diasCredito = viaje.clientes?.dias_credito || 0;
    const condicionPago = diasCredito > 0 ? `CRÉDITO A ${diasCredito} DÍAS` : "CONTADO";
    doc.setFont("helvetica", "bold");
    doc.text(`Condiciones de Pago: ${condicionPago}`, 120, 56);

// --- SECCIÓN: REMITENTE Y DESTINATARIO (El corazón de la Carta Porte) ---
    doc.line(14, 68, 196, 68);
    
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("REMITENTE (ORIGEN):", 14, 74);
    doc.text("DESTINATARIO (LLEGADA):", 110, 74);

    doc.setFont("helvetica", "normal");
    
    // -- Lógica elástica para Origen --
    let yOrigen = 79;
    doc.text(`Nombre/Ubicación: ${viaje.origen?.nombre_lugar}`, 14, yOrigen);
    yOrigen += 4;
    
    // splitTextToSize corta el texto largo o con "Enters" para que no se salga del margen
    const dirOrigenTexto = `Dirección: ${viaje.origen?.direccion || 'Domicilio Conocido'}`;
    const dirOrigenLineas = doc.splitTextToSize(dirOrigenTexto, 90); 
    doc.text(dirOrigenLineas, 14, yOrigen);
    yOrigen += (dirOrigenLineas.length * 4); // Empujamos "Y" dependiendo de cuántas líneas salieron
    
    doc.text(`C.P.: ${viaje.origen?.codigo_postal} | Estado: ${viaje.origen?.estado || 'NLE'}`, 14, yOrigen);

    // -- Lógica elástica para Destino --
    let yDestino = 79;
    doc.text(`Nombre/Ubicación: ${viaje.destino?.nombre_lugar}`, 110, yDestino);
    yDestino += 4;
    
    const dirDestinoTexto = `Dirección: ${viaje.destino?.direccion || 'Domicilio Conocido'}`;
    const dirDestinoLineas = doc.splitTextToSize(dirDestinoTexto, 80);
    doc.text(dirDestinoLineas, 110, yDestino);
    yDestino += (dirDestinoLineas.length * 4);
    
    doc.text(`C.P.: ${viaje.destino?.codigo_postal} | Estado: ${viaje.destino?.estado || 'TAM'}`, 110, yDestino);

    // Calculamos cuál de los dos bloques quedó más abajo para poner la Distancia y la Tabla
    const yMaximoDirecciones = Math.max(yOrigen, yDestino);

    doc.setFont("helvetica", "bold");
    doc.text(`Distancia Total: ${viaje.distancia_km || 0} KM`, 110, yMaximoDirecciones + 5);

    // --- TABLA DE MERCANCÍAS ---
    autoTable(doc, {
      startY: yMaximoDirecciones + 9, // La tabla ahora empieza dinámicamente debajo de las direcciones
      head: [['Cant.', 'Unidad', 'Clave SAT', 'Descripción del Bien', 'Peso (KG)']],
      body: [[
        viaje.cantidad_mercancia, 'Servicio',
        viaje.mercancias?.clave_sat || '---',
        viaje.mercancias?.descripcion || '---',
        viaje.peso_total_kg || '0'
      ]],
      theme: 'grid', styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
    });

    // --- DATOS DEL AUTOTRANSPORTE ---
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 4,
      head: [['VEHÍCULO / PLACAS', 'PERMISO SCT', 'SEGURO RC Y PÓLIZA', 'OPERADOR / LICENCIA']],
      body: [[
        `${viaje.unidades?.configuracion_vehicular || 'T3S1'} - ${viaje.unidades?.placas || 'N/A'}\nRemolque: ${viaje.remolques?.placas || 'N/A'}`,
        `${viaje.unidades?.permiso_sict || 'TPAF01'}\nNúm: ${viaje.unidades?.num_permiso_sict || 'S/N'}`,
        `${viaje.unidades?.aseguradora_rc || 'N/A'}\nPol: ${viaje.unidades?.poliza_rc || 'N/A'}`,
        `${viaje.operadores?.nombre_completo}\nLic: ${viaje.operadores?.numero_licencia}`
      ]],
      theme: 'grid', styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });

    // --- FOOTER Y SELLOS ---
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setDrawColor(150); doc.rect(14, finalY, 25, 25);
    doc.setFontSize(6); doc.setTextColor(150); doc.text("QR SAT", 26.5, finalY + 13, { align: 'center' });

    doc.setTextColor(0); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text(`IdCCP (Identificador Carta Porte): ${viaje.id_ccp || 'SIN-ASIGNAR'}`, 45, finalY + 4);
    doc.text("Sello Digital del CFDI:", 45, finalY + 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(5);
    doc.text(viaje.estatus === 'Borrador' ? "(Documento en Borrador - Sin validez fiscal hasta timbrado)" : "hR+j8xV1q... [Sello truncado para ejemplo] ...9kL=", 45, finalY + 15);
    
    // ======== PÁGINA 2: ANEXO LEGAL ========
    doc.addPage();
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("CONDICIONES DE PRESTACIÓN DE SERVICIOS QUE AMPARA EL COMPLEMENTO CARTA PORTE", 105, 20, { align: 'center' });
    
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    const marcoLegal = [
      "PRIMERA.- Para efectos del presente contrato de transporte se denomina \"Transportista\" a quien realiza el servicio; \"Remitente\" a quien expide la mercancía y \"Destinatario\" a quien la recibe.",
      "SEGUNDA.- El \"Remitente\" declara que la mercancía es de procedencia lícita y asume toda la responsabilidad legal, fiscal y penal por el contenido de la misma, liberando al \"Transportista\" de cualquier reclamación, multa o decomiso por parte de las autoridades.",
      "TERCERA.- El \"Transportista\" no se hace responsable por daños ocultos, mermas, vicios propios de la mercancía, o daños causados por caso fortuito, fuerza mayor, huelgas o actos de la autoridad.",
      "CUARTA.- Las condiciones de pago serán las estipuladas en el anverso de este documento. En caso de mora, el \"Cliente\" se obliga a pagar intereses moratorios a razón del 5% mensual sobre el saldo insoluto.",
      "QUINTA.- El \"Remitente\" o \"Usuario\" queda obligado a verificar que la carga y el vehículo que la transporta cumplan con el peso y dimensiones máximas establecidas en la NOM-012-SCT-2-2017. En caso de incumplimiento, el \"Remitente\" será responsable solidario de las infracciones que la SICT o Guardia Nacional impongan al \"Transportista\"."
    ];

    let yLegal = 35;
    marcoLegal.forEach(parrafo => {
      const lineas = doc.splitTextToSize(parrafo, 180);
      doc.text(lineas, 14, yLegal);
      yLegal += (lineas.length * 4) + 4;
    });

    doc.setFont("helvetica", "bold");
    doc.text("FIRMA DE CONFORMIDAD DEL CLIENTE / REMITENTE", 105, yLegal + 30, { align: 'center' });
    doc.line(65, yLegal + 25, 145, yLegal + 25);

    doc.save(`CartaPorte_${viaje.folio_interno}.pdf`);
  };

  const registrarViaje = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const m = catalogos.mercancias.find(x => x.id === formData.mercancia_id);
      const clienteObj = clientes.find(c => c.id === formData.cliente_id);
      const pesoCalc = m ? m.peso_unitario_kg * formData.cantidad_mercancia : 0;
      
      const nuevoIdCCP = generarIdCCP();

      const { data: maxFolioData } = await supabase.from('viajes').select('folio_interno').eq('usuario_id', sesion.user.id).order('folio_interno', { ascending: false }).limit(1);
      let nuevoFolio = 1;
      if (maxFolioData && maxFolioData.length > 0 && maxFolioData[0].folio_interno) nuevoFolio = maxFolioData[0].folio_interno + 1;

      const { data: nuevoViaje, error: errViaje } = await supabase.from('viajes').insert([{
        folio_interno: nuevoFolio, id_ccp: nuevoIdCCP, distancia_km: parseFloat(formData.distancia_km || 0),
        unidad_id: formData.unidad_id, operador_id: formData.operador_id, remolque_id: formData.remolque_id || null,
        origen_id: formData.origen_id, destino_id: formData.destino_id, mercancia_id: formData.mercancia_id,
        cliente_id: formData.cliente_id || null, cantidad_mercancia: parseFloat(formData.cantidad_mercancia),
        peso_total_kg: pesoCalc, fecha_salida: formData.fecha_salida, usuario_id: sesion.user.id, estatus: 'Borrador'
      }]).select().single();

      if (errViaje) throw errViaje;

      if (formData.monto_flete > 0 && formData.cliente_id) {
        const fechaVenc = new Date(formData.fecha_salida);
        fechaVenc.setDate(fechaVenc.getDate() + (clienteObj?.dias_credito || 0));

        await supabase.from('facturas').insert([{
          usuario_id: sesion.user.id, viaje_id: nuevoViaje.id, cliente: clienteObj.nombre,
          monto_total: parseFloat(formData.monto_flete), fecha_viaje: formData.fecha_salida,
          fecha_vencimiento: fechaVenc.toISOString().split('T')[0], estatus_pago: 'Pendiente', ruta: `Flete (IdCCP: ${nuevoIdCCP.substring(0,8)}...)` 
        }]);
      }

      setMostrarModal(false);
      setFormData({ unidad_id: '', operador_id: '', origen_id: '', destino_id: '', mercancia_id: '', remolque_id: '', cantidad_mercancia: 1, fecha_salida: new Date().toISOString().split('T')[0], cliente_id: '', monto_flete: '', distancia_km: '' });
      await obtenerViajes(sesion.user.id);
    } catch (err) { alert("Error: " + err.message); } finally { setLoading(false); }
  };

  const eliminarViaje = async (id) => {
    if (!confirm("¿Deseas eliminar este viaje y su factura?")) return;
    await supabase.from('facturas').delete().eq('viaje_id', id);
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
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-2">Bitácora de Carta Porte Nacional</p>
            </div>
            <button onClick={() => setMostrarModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
              <PlusCircle size={16} /> Programar Viaje
            </button>
          </header>

          <div className="grid grid-cols-1 gap-4">
            {viajes.map((v) => (
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
                        <span className="text-[9px] text-slate-500 font-mono bg-slate-950 px-2 py-1 rounded-md">{v.distancia_km} KM</span>
                      </div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">{v.unidades?.numero_economico} | {v.operadores?.nombre_completo}</p>
                      {v.id_ccp && <p className="text-[8px] text-blue-400/50 font-mono mt-1">IdCCP: {v.id_ccp}</p>}
                    </div>
                    
                    <div className="flex gap-2 ml-auto opacity-0 group-hover:opacity-100 transition-all">
                      {v.estatus === 'Borrador' && (
                        <button onClick={() => timbrarCartaPorte(v)} title="Timbrar Carta Porte 3.1 ante el SAT" className="p-3 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-colors border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                          <ShieldCheck size={18}/>
                        </button>
                      )}
                      <button onClick={() => router.push(`/facturas?viaje_id=${v.id}`)} title="Ver Factura de este Viaje" className="p-3 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white rounded-xl transition-colors">
                        <Receipt size={18}/>
                      </button>
                      <button onClick={() => generarPDF(v)} title="Descargar Carta Porte PDF" className="p-3 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded-xl transition-colors">
                        <FileText size={18}/>
                      </button>
                      <button onClick={() => eliminarViaje(v.id)} title="Eliminar Viaje" className="p-3 bg-slate-950 text-slate-600 hover:text-red-500 rounded-xl transition-colors">
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setMostrarModal(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
                <button onClick={() => setMostrarModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8 tracking-tighter">Programar <span className="text-blue-500">Operación</span></h2>
                
                <form onSubmit={registrarViaje} className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.unidad_id} onChange={e => setFormData({...formData, unidad_id: e.target.value})}>
                      <option value="">Tractocamión...</option>
                      {catalogos.unidades.map(u => <option key={u.id} value={u.id}>{u.numero_economico}</option>)}
                    </select>
                    <select className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.remolque_id} onChange={e => setFormData({...formData, remolque_id: e.target.value})}>
                      <option value="">Remolque (Opcional)...</option>
                      {catalogos.remolques.map(r => <option key={r.id} value={r.id}>{r.numero_economico}</option>)}
                    </select>
                    <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.operador_id} onChange={e => setFormData({...formData, operador_id: e.target.value})}>
                      <option value="">Operador...</option>
                      {catalogos.operadores.map(o => <option key={o.id} value={o.id}>{o.nombre_completo}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-5 gap-4">
                    <select required className="col-span-2 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.origen_id} onChange={e => setFormData({...formData, origen_id: e.target.value})}>
                      <option value="">Punto A (Origen)...</option>
                      {catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}
                    </select>
                    <select required className="col-span-2 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.destino_id} onChange={e => setFormData({...formData, destino_id: e.target.value})}>
                      <option value="">Punto B (Destino)...</option>
                      {catalogos.ubicaciones.map(ub => <option key={ub.id} value={ub.id}>{ub.nombre_lugar}</option>)}
                    </select>
                    <input required type="number" placeholder="KM Total" className="col-span-1 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold text-center" value={formData.distancia_km} onChange={e => setFormData({...formData, distancia_km: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <select required className="col-span-2 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.mercancia_id} onChange={e => setFormData({...formData, mercancia_id: e.target.value})}>
                      <option value="">Bienes / Mercancía...</option>
                      {catalogos.mercancias.map(m => <option key={m.id} value={m.id}>{m.descripcion}</option>)}
                    </select>
                    <input required type="number" placeholder="Cant." className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.cantidad_mercancia} onChange={e => setFormData({...formData, cantidad_mercancia: e.target.value})} />
                  </div>

                  <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl space-y-4">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><DollarSign size={12} /> Cliente y Facturación</p>
                    <div className="grid grid-cols-2 gap-4">
                      <select required className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold" value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value})}>
                        <option value="">Seleccionar Cliente...</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <input type="number" placeholder="Flete (Subtotal sin IVA)" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-mono" value={formData.monto_flete} onChange={e => setFormData({...formData, monto_flete: e.target.value})} />
                    </div>
                  </div>

                  <input type="date" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white" value={formData.fecha_salida} onChange={e => setFormData({...formData, fecha_salida: e.target.value})} />

                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-blue-500 transition-all">
                    {loading ? "Sincronizando..." : "Consolidar Viaje Nacional"}
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