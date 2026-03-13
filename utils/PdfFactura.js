import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Función ayudante para unir las cajitas de dirección
const formatDireccion = (obj) => {
  if (!obj) return 'No especificada';
  const parts = [];
  if (obj.calle_numero) parts.push(obj.calle_numero);
  if (obj.colonia) parts.push(`Col. ${obj.colonia}`);
  if (obj.municipio) parts.push(obj.municipio);
  if (obj.estado) parts.push(obj.estado);
  return parts.length > 0 ? parts.join(', ') : 'No especificada';
};

export const generarFacturaPDF = async (factura, clienteData, perfilEmisor) => {
  const doc = new jsPDF('p', 'mm', 'a4');

  const total = Number(factura.monto_total);
  const subtotal = total / 1.16;
  const iva = subtotal * 0.16;
  const retencionIva = subtotal * 0.04;
  const totalFinal = subtotal + iva - retencionIva; 
  
  const esVencida = new Date(factura.fecha_vencimiento + 'T23:59:59') < new Date() && factura.estatus_pago !== 'Pagado';
  let etiquetaEstatus = factura.estatus_pago === 'Pagado' ? 'PAGADO' : (esVencida ? 'ATRASADO' : 'PENDIENTE');
  let colorEstatus = factura.estatus_pago === 'Pagado' ? [34, 197, 94] : (esVencida ? [239, 68, 68] : [249, 115, 22]);

  // ==========================================
  // LÓGICA DE HORA EXACTA (EXTRAÍDA DEL SAT)
  // ==========================================
  let fechaImpresion = `${factura.fecha_viaje || 'Borrador'}`;

  // Extraemos la fecha y hora oficial directamente dentro de la Cadena Original del SAT
  if (factura.cadena_original && factura.cadena_original.includes('T')) {
    const partesCadena = factura.cadena_original.split('|');
    // Buscamos el fragmento que parezca una fecha (Ej: 2024-03-12T14:35:10)
    const fechaTimbre = partesCadena.find(p => p.includes('T') && p.includes('-') && p.includes(':'));
    
    if (fechaTimbre) {
      const dateObj = new Date(fechaTimbre);
      const hora = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dia = dateObj.toLocaleDateString('es-MX');
      fechaImpresion = `${dia} a las ${hora} hrs`;
    }
  } else if (factura.created_at) {
    // Respaldo por si es un borrador sin timbrar
    const fechaCreacion = new Date(factura.created_at);
    const horaFormateada = fechaCreacion.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fechaImpresion = `${factura.fecha_viaje || fechaCreacion.toLocaleDateString('es-MX')} a las ${horaFormateada}`;
  }

  // ==============================
  // CABECERA Y LOGO
  // ==============================
  if (perfilEmisor?.logo_base64) {
    const formato = perfilEmisor.logo_base64.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(perfilEmisor.logo_base64, formato, 14, 15, 35, 20);
  } else {
    doc.setDrawColor(200); doc.rect(14, 15, 35, 20); 
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("SIN\nLOGO", 31.5, 24, { align: 'center' });
  }

  // ==============================
  // EMISOR (Dirección concatenada)
  // ==============================
  doc.setTextColor(0, 0, 0); 
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(`${perfilEmisor?.razon_social || 'EMISOR SIN REGISTRAR'}`, 55, 19);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`RFC: ${perfilEmisor?.rfc || 'XAXX010101000'} | Régimen Fiscal: ${perfilEmisor?.regimen_fiscal || '601'}`, 55, 24);
  doc.text(`C.P. Emisión: ${perfilEmisor?.codigo_postal || '00000'}`, 55, 28);
  
  const dirEmisor = 'Dirección: ' + formatDireccion(perfilEmisor);
  const lineasDirEmisor = doc.splitTextToSize(dirEmisor, 75); 
  doc.text(lineasDirEmisor, 55, 32);

  doc.setFillColor(colorEstatus[0], colorEstatus[1], colorEstatus[2]); 
  doc.rect(135, 15, 61, 7, 'F');
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255); 
  doc.text(`FACTURA CFDI 4.0 - ${etiquetaEstatus}`, 165.5, 20, { align: 'center' });

  doc.setTextColor(0); doc.setFontSize(8);
  autoTable(doc, {
    startY: 22, margin: { left: 135, right: 14 },
    body: [
      ['Serie y Folio:', `F - ${factura.id.toString().slice(0, 5)}`],
      ['Fecha Emisión:', fechaImpresion], // <-- Aquí se imprime la hora oficial del SAT
      ['Uso CFDI:', clienteData?.uso_cfdi || 'G03 - Gastos en general']
    ],
    theme: 'plain', styles: { fontSize: 7, cellPadding: 1 }, 
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 25 }, 1: { halign: 'right' } }
  });

  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(14, Math.max(42, 32 + (lineasDirEmisor.length * 3.5)), 196, Math.max(42, 32 + (lineasDirEmisor.length * 3.5))); 

  // ==============================
  // RECEPTOR (Dirección concatenada)
  // ==============================
  let yReceptor = Math.max(48, 38 + (lineasDirEmisor.length * 3.5));
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); 
  doc.text("RECEPTOR (CLIENTE):", 14, yReceptor);
  
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(factura.cliente, 14, yReceptor + 5);
  doc.setFontSize(8);
  doc.text(`RFC: ${clienteData?.rfc || 'XAXX010101000'} | Régimen: ${clienteData?.regimen_fiscal || '601'}`, 14, yReceptor + 10);
  
  const dirReceptor = 'Domicilio: ' + formatDireccion(clienteData) + ', C.P. ' + (clienteData?.codigo_postal || '00000');
  const lineasDirReceptor = doc.splitTextToSize(dirReceptor, 100); 
  doc.text(lineasDirReceptor, 14, yReceptor + 14);

  const diasCredito = clienteData?.dias_credito || 0;
  const condicionPago = diasCredito > 0 ? `CRÉDITO A ${diasCredito} DÍAS` : "CONTADO";
  
  doc.setDrawColor(200); doc.setLineWidth(0.1);
  doc.rect(120, yReceptor - 3, 76, 18);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DE PAGO:", 122, yReceptor + 2);
  doc.setFont("helvetica", "normal");
  doc.text(`Condiciones: ${condicionPago}`, 122, yReceptor + 7);
  doc.text(`Método: ${factura.metodo_pago || 'PPD'} | Forma: ${factura.forma_pago || '99'}`, 122, yReceptor + 12);

  let startYTabla = yReceptor + 14 + (lineasDirReceptor.length * 3.5) + 5;

  // Formateamos el subtotal para que SIEMPRE lleve la coma de los miles
  const subtotalFormateado = subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});

  autoTable(doc, {
    startY: startYTabla,
    head: [['Clave SAT', 'Cant.', 'Unidad', 'Descripción / Concepto', 'Precio Unitario', 'Importe']],
    body: [['78101802', '1', 'E48', factura.ruta || 'Servicio de flete nacional', `$${subtotalFormateado}`, `$${subtotalFormateado}`]],
    theme: 'grid', 
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 }, 
    columnStyles: { 
      0: { halign: 'center', cellWidth: 20 }, 
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'left' }, 
      4: { halign: 'right', cellWidth: 30 }, 
      5: { halign: 'right', cellWidth: 30 } 
    },
    willDrawCell: function(data) {
      if (data.section === 'head' && (data.column.index === 4 || data.column.index === 5)) {
        data.cell.styles.halign = 'right';
      }
    }
  });

  const finalY = doc.lastAutoTable.finalY;

  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Moneda: MXN - Peso Mexicano", 14, finalY + 8);
  
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

  const footerY = 225; 
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(14, footerY - 3, 196, footerY - 3);

  const uuid = factura.folio_fiscal || '00000000-0000-0000-0000-000000000000';
  const rfcEmisor = perfilEmisor?.rfc || 'XAXX010101000';
  const rfcReceptor = clienteData?.rfc || 'XAXX010101000';
  const totalStr = totalFinal.toFixed(6);

  const selloEmisor = factura.sello_emisor || 'Timbre la factura para generar el sello digital.';
  const selloSat = factura.sello_sat || 'Timbre la factura para generar el sello del SAT.';
  const cadenaOriginal = factura.cadena_original || '||Timbre la factura para generar la cadena original.||';

  const selloOcho = factura.sello_emisor ? factura.sello_emisor.slice(-8) : '00000000';
  const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${rfcEmisor}&rr=${rfcReceptor}&tt=${totalStr}&fe=${selloOcho}`;
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;

  const cargarImagenBase64 = (url) => {
    return new Promise((resolve, reject) => {
      let img = new Image();
      img.crossOrigin = 'Anonymous'; 
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
      const base64QR = await cargarImagenBase64(apiUrl);
      doc.addImage(base64QR, 'PNG', 14, footerY, 35, 35);
  } catch (e) {
      doc.setDrawColor(200); doc.rect(14, footerY, 35, 35);
      doc.text("QR SAT", 31.5, footerY + 17, { align: 'center' });
  }
  
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
  const lineasSelloEmisor = doc.splitTextToSize(selloEmisor, 140); 
  doc.text(lineasSelloEmisor, 52, textoY);
  textoY += (lineasSelloEmisor.length * 2.5) + 1.5; 

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