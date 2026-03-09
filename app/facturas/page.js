'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  PlusCircle, Trash2, CheckCircle, Clock, X, 
  Calendar, ChevronDown, DollarSign, Truck, FileText, Download, ShieldCheck, Settings
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function FacturasContenido() {
  const searchParams = useSearchParams();
  const viajeIdHighlight = searchParams.get('viaje_id');

  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  
  const [metricas, setMetricas] = useState({ cobrado: 0, pendiente: 0 });
  const [historial, setHistorial] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [perfilEmisor, setPerfilEmisor] = useState(null);

  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes);

  // NUEVO: Agregamos forma_pago y metodo_pago al estado inicial
  const [formData, setFormData] = useState({ 
    cliente_id: '', monto_total: '', folio_fiscal: '', 
    ruta: 'Flete / Servicio de Transporte', fecha_viaje: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '', forma_pago: '99', metodo_pago: 'PPD'
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/";
      else {
        setSesion(session);
        obtenerDatos(session.user.id);
        obtenerClientes(session.user.id);
        obtenerPerfilEmisor(session.user.id);
      }
    });
  }, [fechaInicio, fechaFin, viajeIdHighlight]);

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

  // Inteligencia de UX: Si eligen PUE, la forma de pago debe ser distinta a 99.
  useEffect(() => {
    if (formData.metodo_pago === 'PUE' && formData.forma_pago === '99') {
      setFormData(prev => ({ ...prev, forma_pago: '03' })); // Cambia a Transferencia automático
    } else if (formData.metodo_pago === 'PPD') {
      setFormData(prev => ({ ...prev, forma_pago: '99' })); // PPD exige forma de pago 99
    }
  }, [formData.metodo_pago]);

  async function obtenerPerfilEmisor(userId) {
    const { data } = await supabase.from('perfil_emisor').select('*').eq('usuario_id', userId).single();
    if (data) setPerfilEmisor(data);
  }

  async function obtenerClientes(userId) {
    const { data } = await supabase.from('clientes').select('*').eq('usuario_id', userId).order('nombre');
    setClientes(data || []);
  }

  async function obtenerDatos(userId) {
    setLoading(true);
    let query = supabase
      .from('facturas')
      .select('*') 
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false });

    if (viajeIdHighlight) {
       query = query.eq('viaje_id', viajeIdHighlight);
    } else {
       query = query.gte('fecha_viaje', fechaInicio).lte('fecha_viaje', fechaFin);
    }

    const { data: facturasBD, error } = await query;

    if (error) console.error("Error cargando facturas:", error.message);

    const cobrado = facturasBD?.filter(f => f.estatus_pago === 'Pagado')
      .reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;
    const pendiente = facturasBD?.filter(f => f.estatus_pago === 'Pendiente')
      .reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;

    setMetricas({ cobrado, pendiente });
    setHistorial(facturasBD || []);
    setLoading(false);
  }

  const prepararJsonParaPAC = (factura) => {
    const total = Number(factura.monto_total);
    const subtotal = Number((total / 1.16).toFixed(2));
    const iva = Number((subtotal * 0.16).toFixed(2));
    const retencionIva = Number((subtotal * 0.04).toFixed(2)); 

    const clienteData = clientes.find(c => c.nombre === factura.cliente) || {};

    const jsonFactura = {
      "Version": "4.0",
      "Serie": "F",
      "Folio": factura.id.toString().slice(0,5),
      "Fecha": new Date().toISOString(),
      
      // NUEVO: Variables dinámicas desde la Base de Datos
      "FormaPago": factura.forma_pago || "99", 
      "MetodoPago": factura.metodo_pago || "PPD", 
      
      "TipoDeComprobante": "I",
      "Exportacion": "01",
      "Moneda": "MXN",
      "SubTotal": subtotal,
      "Total": (subtotal + iva - retencionIva).toFixed(2),
      "Emisor": {
        "Rfc": perfilEmisor?.rfc || "XEXX010101000",
        "Nombre": perfilEmisor?.razon_social || "EMISOR GENERICO",
        "RegimenFiscal": perfilEmisor?.regimen_fiscal || "601"
      },
      "Receptor": {
        "Rfc": clienteData.rfc || "XAXX010101000",
        "Nombre": clienteData.nombre || "PUBLICO EN GENERAL",
        "UsoCFDI": clienteData.uso_cfdi || "G03", // NUEVO: Uso dinámico del catálogo
        "RegimenFiscalReceptor": clienteData.regimen_fiscal || "616",
        "DomicilioFiscalReceptor": clienteData.codigo_postal || "00000"
      },
      "Conceptos": [{
        "ClaveProdServ": "78101802", 
        "Cantidad": 1,
        "ClaveUnidad": "E48",
        "Unidad": "Servicio",
        "Descripcion": factura.ruta || "Servicio de flete nacional",
        "ValorUnitario": subtotal,
        "Importe": subtotal,
        "ObjetoImp": "02",
        "Impuestos": {
          "Traslados": [{
            "Base": subtotal,
            "Impuesto": "002",
            "TipoFactor": "Tasa",
            "TasaOCuota": 0.160000,
            "Importe": iva
          }],
          "Retenciones": [{
            "Base": subtotal,
            "Impuesto": "002",
            "TipoFactor": "Tasa",
            "TasaOCuota": 0.040000,
            "Importe": retencionIva
          }]
        }
      }]
    };

    return jsonFactura;
  };

const timbrarFactura = async (factura) => {
    // 1. REEMPLAZA ESTO CON TU API KEY DE PRUEBAS (sk_test_...)
    const facturapiKey = "sk_test_sBNjdoZ5A1UcJVmQ2KUisCQBpiD8MPFecYABBhRYci"; 
    const apiUrl = 'https://www.facturapi.io/v2/invoices';

    // 2. CÁLCULOS AUTOMATIZADOS
    // Facturapi calcula IVA y Retenciones por ti, solo mándale el subtotal
    const totalInput = Number(factura.monto_total);
    const subtotal = Number((totalInput / 1.16).toFixed(2));

    // 3. OBJETO DE FACTURACIÓN (CFDI 4.0)
    const invoiceData = {
customer: {
        legal_name: "UNIVERSIDAD ROBOTICA ESPAÑOLA",
        tax_id: "URE180429TM6",
        tax_system: "603",
        address: {
          zip: "65000" // <--- En v2 va envuelto en address
        }
      },
      items: [{
        quantity: 1,
        product: {
          description: factura.ruta || "Servicio de flete nacional",
          product_key: "78101802", // Clave SAT Autotransporte
          price: subtotal,
          taxes: [
            { type: "IVA", rate: 0.16 },
            { type: "IVA", rate: 0.04, withholding: true } // Retención 4% fletes
          ]
        }
      }],
      payment_form: factura.forma_pago || "99",
      payment_method: factura.metodo_pago || "PPD",
      use: "G03"
    };

    console.log("🚀 ENVIANDO A FACTURAPI:", invoiceData);

    setLoading(true);
    try {
      // Usamos el token directamente en el Header (Bearer Auth)
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${facturapiKey}`
        },
        body: JSON.stringify(invoiceData)
      });

      const res = await response.json();

if (response.ok) {
        console.log("✅ ÉXITO FACTURAPI:", res);
        
        // 1. Atrapamos toda la información fiscal que nos da Facturapi
        const uuidReal = res.uuid;
        const selloEmisor = res.stamp?.signature || "SELLO_NO_ENCONTRADO";
        const selloSat = res.stamp?.sat_signature || "SELLO_SAT_NO_ENCONTRADO";
        const cadenaOriginal = res.stamp?.complement_string || "CADENA_NO_ENCONTRADA";
        
        // 2. Guardamos todo en tus nuevas columnas de Supabase
        const { error: supabaseError } = await supabase
          .from('facturas')
          .update({ 
            folio_fiscal: uuidReal,
            sello_emisor: selloEmisor,
            sello_sat: selloSat,
            cadena_original: cadenaOriginal
          })
          .eq('id', factura.id);

        if (supabaseError) throw supabaseError;
        
        alert(`🎉 ¡FACTURA TIMBRADA CON SELLOS!\n\nUUID: ${uuidReal}`);
        obtenerDatos(sesion.user.id);
      }
      
      else {
        console.error("❌ ERROR:", res);
        alert(`Error de Facturapi:\n${res.message || "Error desconocido"}`);
      }
    } catch (err) {
      console.error("Error de conexión:", err);
      alert("Error de red:\n" + err.message);
    } finally {
      setLoading(false);
    }
};

const generarFacturaPDF = async (factura) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const clienteData = clientes.find(c => c.nombre === factura.cliente) || {};

    // Matemáticas
    const total = Number(factura.monto_total);
    const subtotal = total / 1.16;
    const iva = subtotal * 0.16;
    const retencionIva = subtotal * 0.04;
    const totalFinal = subtotal + iva - retencionIva; 
    
    // Estatus
    const esVencida = new Date(factura.fecha_vencimiento + 'T23:59:59') < new Date() && factura.estatus_pago !== 'Pagado';
    let etiquetaEstatus = factura.estatus_pago === 'Pagado' ? 'PAGADO' : (esVencida ? 'ATRASADO' : 'PENDIENTE');
    let colorEstatus = factura.estatus_pago === 'Pagado' ? [34, 197, 94] : (esVencida ? [239, 68, 68] : [249, 115, 22]);

    // ==========================================
    // 1. CABECERA (LOGO Y DATOS DEL EMISOR)
    // ==========================================
    doc.setDrawColor(200); 
    doc.rect(14, 15, 35, 20); // Cuadro del logo
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("LOGO\nEMPRESA", 31.5, 24, { align: 'center' });

    doc.setTextColor(0, 0, 0); 
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`${perfilEmisor?.razon_social || 'ESCUELA KEMPER URATE'}`, 55, 19);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`RFC: ${perfilEmisor?.rfc || 'EKU9003173C9'}`, 55, 24);
    doc.text(`Régimen Fiscal: ${perfilEmisor?.regimen_fiscal || '601 - General de Ley Personas Morales'}`, 55, 28);
    doc.text(`Lugar de Expedición (C.P.): ${perfilEmisor?.codigo_postal || '65000'}`, 55, 32);

    // ==========================================
    // 2. BLOQUE DERECHO (FOLIO Y ESTATUS)
    // ==========================================
    doc.setFillColor(colorEstatus[0], colorEstatus[1], colorEstatus[2]); 
    doc.rect(135, 15, 61, 7, 'F');
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255); 
    doc.text(`FACTURA CFDI 4.0 - ${etiquetaEstatus}`, 165.5, 20, { align: 'center' });

    doc.setTextColor(0); doc.setFontSize(8);
    autoTable(doc, {
      startY: 22, margin: { left: 135, right: 14 },
      body: [
        ['Serie y Folio:', `F - ${factura.id.toString().slice(0, 5)}`],
        ['Fecha Emisión:', factura.fecha_viaje || new Date().toLocaleDateString()],
        ['Uso CFDI:', clienteData.uso_cfdi || 'G03 - Gastos en general']
      ],
      theme: 'plain', styles: { fontSize: 7, cellPadding: 1 }, 
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 25 }, 1: { halign: 'right' } }
    });

    // ==========================================
    // 3. DATOS DEL RECEPTOR (CLIENTE)
    // ==========================================
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42); // Línea separadora principal superior

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); 
    doc.text("RECEPTOR (CLIENTE):", 14, 48);
    
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(factura.cliente, 14, 53);
    doc.setFontSize(8);
    doc.text(`RFC: ${clienteData.rfc || 'URE180429TM6'}`, 14, 58);
    doc.text(`Régimen: ${clienteData.regimen_fiscal || '603'} | C.P.: ${clienteData.codigo_postal || '65000'}`, 14, 62);

    const diasCredito = clienteData.dias_credito || 0;
    const condicionPago = diasCredito > 0 ? `CRÉDITO A ${diasCredito} DÍAS` : "CONTADO";
    
    // Cuadro de condiciones de pago a la derecha
    doc.setDrawColor(200); doc.setLineWidth(0.1);
    doc.rect(120, 45, 76, 18);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DE PAGO:", 122, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Condiciones: ${condicionPago}`, 122, 55);
    doc.text(`Método: ${factura.metodo_pago || 'PPD'} | Forma: ${factura.forma_pago || '99'}`, 122, 60);

    // ==========================================
    // 4. TABLA DE CONCEPTOS (PARTIDAS)
    // ==========================================
    autoTable(doc, {
      startY: 68,
      head: [['Clave SAT', 'Cant.', 'Unidad', 'Descripción / Concepto', 'Precio Unitario', 'Importe']],
      body: [['78101802', '1', 'E48', factura.ruta || 'Servicio de flete nacional', `$${subtotal.toFixed(2)}`, `$${subtotal.toFixed(2)}`]],
      theme: 'grid', 
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 8, cellPadding: 3 }, 
      columnStyles: { 
        0: { halign: 'center', cellWidth: 20 }, 
        1: { halign: 'center', cellWidth: 12 },
        2: { halign: 'center', cellWidth: 15 },
        4: { halign: 'right', cellWidth: 30 }, 
        5: { halign: 'right', cellWidth: 30 } 
      }
    });

    const finalY = doc.lastAutoTable.finalY;

    // ==========================================
    // 5. TOTALES Y MONEDA
    // ==========================================
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("Moneda: MXN - Peso Mexicano", 14, finalY + 8);
    
    // Cuadro de totales
    autoTable(doc, {
      startY: finalY + 2, margin: { left: 135, right: 14 },
      body: [
        ['Subtotal:', `$${subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`],
        ['IVA Trasladado (16%):', `$${iva.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`],
        ['Retención IVA (4%):', `-$${retencionIva.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`],
        ['Total Neto:', `$${totalFinal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`],
      ],
      theme: 'plain', styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', halign: 'right' }, 1: { halign: 'right' } },
      didParseCell: function(data) { if (data.row.index === 3) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 9; } }
    });

   // ==========================================
    // 6. PIE DE PÁGINA FISCAL Y QR (El secreto del SAT)
    // ==========================================
    const footerY = 225; // Fijamos el pie de página al fondo de la hoja
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(14, footerY - 3, 196, footerY - 3);

    // 1. EXTRAEMOS LOS DATOS REALES DE SUPABASE
    const uuid = factura.folio_fiscal || '00000000-0000-0000-0000-000000000000';
    const rfcEmisor = perfilEmisor?.rfc || 'EKU9003173C9';
    const rfcReceptor = clienteData.rfc || 'URE180429TM6';
    const totalStr = totalFinal.toFixed(6);

    const selloEmisor = factura.sello_emisor || 'Timbre la factura para generar el sello digital.';
    const selloSat = factura.sello_sat || 'Timbre la factura para generar el sello del SAT.';
    const cadenaOriginal = factura.cadena_original || '||Timbre la factura para generar la cadena original.||';

    // 2. EL TRUCO DEL QR: El SAT pide exactamente los últimos 8 caracteres del sello del emisor
    const selloOcho = factura.sello_emisor ? factura.sello_emisor.slice(-8) : '00000000';

// 3. GENERAMOS LA IMAGEN DEL QR (Convertida a formato PDF-friendly)
    const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${rfcEmisor}&rr=${rfcReceptor}&tt=${totalStr}&fe=${selloOcho}`;
    
    // Cambiamos a esta API que es más rápida y amigable con las descargas
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;

    // Función "mágica" que espera a que descargue la imagen y la vuelve código (Base64)
    const cargarImagenBase64 = (url) => {
      return new Promise((resolve, reject) => {
        let img = new Image();
        img.crossOrigin = 'Anonymous'; // Evita bloqueos de seguridad del navegador
        img.onload = () => {
          let canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          let ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Error cargando QR'));
        img.src = url;
      });
    };

    try {
        // AHORA SÍ: Esperamos la imagen antes de ponerla en el PDF
        const base64QR = await cargarImagenBase64(apiUrl);
        doc.addImage(base64QR, 'PNG', 14, footerY, 35, 35);
    } catch (e) {
        console.error("No se pudo generar el QR", e);
        doc.setDrawColor(200); doc.rect(14, footerY, 35, 35);
        doc.text("QR", 31.5, footerY + 17, { align: 'center' });
    }
    // 4. IMPRIMIMOS LAS LETRAS CHIQUITAS (Usamos splitTextToSize para que no se salgan del margen)
    let textoY = footerY + 3;
    doc.setFontSize(6); 
    
    doc.setFont("helvetica", "bold");
    doc.text("Folio Fiscal (UUID):", 52, textoY);
    textoY += 3;
    doc.setFont("helvetica", "normal");
    doc.text(uuid, 52, textoY);
    textoY += 4;

    doc.setFont("helvetica", "bold");
    doc.text("Sello Digital del Emisor:", 52, textoY);
    textoY += 3;
    doc.setFont("helvetica", "normal");
    const lineasSelloEmisor = doc.splitTextToSize(selloEmisor, 140); // 140 es el ancho máximo
    doc.text(lineasSelloEmisor, 52, textoY);
    textoY += (lineasSelloEmisor.length * 2.5) + 1.5; // Calculamos el salto de línea automático

    doc.setFont("helvetica", "bold");
    doc.text("Sello Digital del SAT:", 52, textoY);
    textoY += 3;
    doc.setFont("helvetica", "normal");
    const lineasSelloSat = doc.splitTextToSize(selloSat, 140);
    doc.text(lineasSelloSat, 52, textoY);
    textoY += (lineasSelloSat.length * 2.5) + 1.5;

    doc.setFont("helvetica", "bold");
    doc.text("Cadena Original del Complemento de Certificación:", 52, textoY);
    textoY += 3;
    doc.setFont("helvetica", "normal");
    const lineasCadena = doc.splitTextToSize(cadenaOriginal, 140);
    doc.text(lineasCadena, 52, textoY);

    doc.setFontSize(7); doc.setTextColor(100);
    doc.text("Este documento es una representación impresa de un CFDI 4.0 de Ingreso.", 105, 285, { align: 'center' });

    doc.save(`Factura_${factura.cliente}_${factura.folio_fiscal?.slice(0,5) || 'Borrador'}.pdf`);
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
        forma_pago: formData.forma_pago,
        metodo_pago: formData.metodo_pago,
        estatus_pago: 'Pendiente',
        usuario_id: sesion.user.id 
      }
    ]);

    if (error) {
      alert("Fallo al guardar: " + error.message);
    } else {
      setFormData({ cliente_id: '', monto_total: '', folio_fiscal: '', ruta: 'Flete / Servicio de Transporte', fecha_viaje: new Date().toISOString().split('T')[0], fecha_vencimiento: '', forma_pago: '99', metodo_pago: 'PPD' });
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

  const eliminarFactura = async (id, tieneViajeAsociado) => {
    if (tieneViajeAsociado) {
       alert("No puedes borrar esta factura desde aquí porque está asociada a un Viaje. Debes borrar el Viaje desde la pestaña de viajes");
       return;
    }
    if (!confirm("¿Eliminar registro manual?")) return;
    await supabase.from('facturas').delete().eq('id', id);
    obtenerDatos(sesion.user.id);
  };

  if (!sesion) return <div className="min-h-screen bg-slate-950"></div>;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200 w-full">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                Control de <span className="text-green-600">Ingresos</span>
              </h1>
              {viajeIdHighlight ? (
                 <p className="text-blue-500 text-[10px] font-black uppercase mt-1 tracking-widest flex items-center gap-1">
                   <Truck size={12}/> Mostrando factura del viaje seleccionado
                 </p>
              ) : (
                 <p className="text-slate-500 text-[10px] font-black uppercase mt-1 tracking-widest">Facturación y Cobranza</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setMostrarFiltro(!mostrarFiltro)}
                  className={`flex items-center gap-3 bg-slate-900 border ${viajeIdHighlight ? 'border-orange-500/50 text-orange-400' : 'border-slate-800 text-slate-400'} px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all`}
                >
                  <Calendar size={14} className={viajeIdHighlight ? 'text-orange-500' : 'text-blue-400'} />
                  {viajeIdHighlight ? 'Limpiar Filtro URL' : 'Periodo'}
                  <ChevronDown size={14} />
                </button>

                {mostrarFiltro && (
                  <div className="absolute right-0 mt-3 w-72 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                    <div className="space-y-4">
                      {viajeIdHighlight && (
                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-4">
                           <p className="text-[9px] text-orange-400 font-bold uppercase text-center">Estás viendo una factura específica. Aplica el filtro para ver todo el mes.</p>
                        </div>
                      )}
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
                      <button onClick={() => {
                        setMostrarFiltro(false);
                        if(viajeIdHighlight) window.location.href = '/facturas'; 
                      }} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[9px] font-black uppercase">
                        Aplicar Filtro Mensual
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setMostrarFormulario(true)} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
                <PlusCircle size={14} /> Ingreso Manual
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <TarjetaDato titulo="Cobrado en Vista" valor={`$${metricas.cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} color="green" />
            <TarjetaDato titulo="Por Cobrar en Vista" valor={`$${metricas.pendiente.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} color="blue" />
          </div>

          {mostrarFormulario && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setMostrarFormulario(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                <button onClick={() => setMostrarFormulario(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Registrar <span className="text-green-500">Ingreso Manual</span></h2>
                
                <form onSubmit={registrarFactura} className="space-y-6">
                  {/* SECCIÓN 1: DATOS BÁSICOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente Receptor</label>
                      </div>
                      <select required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none focus:border-green-500"
                        value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}>
                        <option value="">-- Seleccionar de Catálogo SAT --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.dias_credito} días crédito)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Monto Total con IVA ($)</label>
                      <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white font-mono" 
                        value={formData.monto_total} onChange={e => setFormData({...formData, monto_total: e.target.value})} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Concepto / Referencia</label>
                      <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white outline-none" 
                        value={formData.ruta} onChange={e => setFormData({...formData, ruta: e.target.value})} placeholder="Ej. Flete Extra" />
                    </div>
                  </div>

                  {/* SECCIÓN 2: OPCIONES FISCALES (NUEVO) */}
                  <div className="p-6 bg-blue-900/10 border border-blue-500/20 rounded-2xl">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Settings size={12}/> Configuración SAT (CFDI 4.0)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-1">Método de Pago</label>
                        <select className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white font-bold"
                          value={formData.metodo_pago} onChange={e => setFormData({...formData, metodo_pago: e.target.value})}>
                          <option value="PPD">PPD - Pago en Parcialidades o Diferido</option>
                          <option value="PUE">PUE - Pago en una Sola Exhibición</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-1">Forma de Pago</label>
                        <select className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white font-bold"
                          value={formData.forma_pago} onChange={e => setFormData({...formData, forma_pago: e.target.value})} disabled={formData.metodo_pago === 'PPD'}>
                          <option value="99">99 - Por Definir (Obligatorio en PPD)</option>
                          <option value="03">03 - Transferencia Electrónica</option>
                          <option value="01">01 - Efectivo</option>
                          <option value="02">02 - Cheque Nominativo</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 3: FECHAS */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block ml-1">Fecha de Servicio</label>
                      <input type="date" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                        value={formData.fecha_viaje} onChange={e => setFormData({...formData, fecha_viaje: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2 block ml-1">Vencimiento Cobro</label>
                      <input type="date" readOnly className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-sm text-slate-400 outline-none" 
                        value={formData.fecha_vencimiento} />
                    </div>
                  </div>

                  <button type="submit" disabled={loading || clientes.length === 0} className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all mt-4">
                    {loading ? "Sincronizando..." : "Confirmar Factura Libre"}
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-4">
                    <th className="pl-4">Cobro</th>
                    <th>Receptor</th>
                    <th>Concepto / Ruta</th>
                    <th>Vencimiento</th>
                    <th>Monto Total</th>
                    <th className="text-right pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => {
                    const esVencida = new Date(item.fecha_vencimiento + 'T23:59:59') < new Date() && item.estatus_pago !== 'Pagado';
                    const vieneDeViaje = item.viaje_id !== null;
                    const sinTimbrar = !item.folio_fiscal || item.folio_fiscal === '';

                    return (
                      <tr key={item.id} className="bg-slate-950 border border-slate-800 group hover:border-blue-500/30 transition-all">
                        <td className="py-4 pl-4 rounded-l-2xl border-y border-l border-slate-800">
                          <button onClick={() => alternarEstatus(item.id, item.estatus_pago)}
                            title="Marcar como Pagado/Pendiente"
                            className={`p-2 rounded-lg transition-all ${item.estatus_pago === 'Pagado' ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                            {item.estatus_pago === 'Pagado' ? <CheckCircle size={16} /> : <Clock size={16} />}
                          </button>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <h4 className="text-[11px] font-bold text-white uppercase leading-none">{item.cliente}</h4>
                          <p className="text-[9px] text-slate-500 mt-1 uppercase font-mono flex items-center gap-1">
                            <FileText size={10} className={sinTimbrar ? "text-orange-500" : "text-blue-500"}/>
                            {sinTimbrar ? 'BORRADOR' : item.folio_fiscal}
                          </p>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <p className={`text-[10px] font-bold uppercase flex items-center gap-2 ${vieneDeViaje ? 'text-blue-400' : 'text-slate-400'}`}>
                            {vieneDeViaje ? <Truck size={12}/> : <DollarSign size={12}/>}
                            {item.ruta || '---'}
                          </p>
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          {item.estatus_pago === 'Pagado' ? <span className="text-[9px] font-black text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-1 rounded-md">Liquidada</span> :
                          <span className={`text-[10px] font-black bg-slate-900 px-2 py-1 rounded-md ${esVencida ? 'text-red-500 border border-red-500/30' : 'text-orange-500 border border-orange-500/30'}`}>
                            {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString() : 'S/V'} {esVencida ? '(VENCIDA)' : ''}
                          </span>}
                        </td>
                        <td className="py-4 border-y border-slate-800">
                          <span className={`text-[11px] font-mono font-black ${item.estatus_pago === 'Pagado' ? 'text-green-400' : 'text-white'}`}>
                            ${Number(item.monto_total).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </span>
                        </td>
                        <td className="py-4 pr-4 rounded-r-2xl border-y border-r border-slate-800 text-right flex justify-end gap-2">
                          
                          {sinTimbrar && (
                            <button onClick={() => timbrarFactura(item)} 
                              title="Timbrar Factura ante el SAT"
                              className="p-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                              <ShieldCheck size={14}/>
                            </button>
                          )}

                          <button onClick={() => generarFacturaPDF(item)} 
                            title="Descargar Factura Comercial en PDF"
                            className="p-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors">
                            <Download size={14}/>
                          </button>

                          <button onClick={() => eliminarFactura(item.id, vieneDeViaje)} 
                            title={vieneDeViaje ? "Las facturas de viaje se borran desde la Bitácora" : "Eliminar ingreso manual"}
                            className={`p-2 transition-colors rounded-lg ${vieneDeViaje ? 'text-slate-700 cursor-not-allowed' : 'text-slate-600 hover:text-red-500 hover:bg-red-500/10'}`}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {historial.length === 0 && (
                <div className="text-center py-20 bg-slate-950/50 rounded-2xl border border-slate-800 mt-4">
                   <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No hay facturas o ingresos en esta vista.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function FacturasPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-blue-500">Cargando Módulo Financiero...</p></div>}>
      <FacturasContenido />
    </Suspense>
  );
}