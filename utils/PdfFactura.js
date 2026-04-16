import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  // ==========================================
  // CÁLCULO FINANCIERO DINÁMICO (CFDI 4.0 Multi-Concepto)
  // ==========================================
  let conceptosArray = [];
  let subtotal = 0;
  let iva = 0;
  let retencionIva = 0;
  
  // INYECCIÓN DE DIVISA DINÁMICA
  const monedaStr = factura.moneda || 'MXN';

  if (factura.conceptos_detalle && factura.conceptos_detalle.length > 0) {
    conceptosArray = factura.conceptos_detalle.map(c => {
      const montoBase = parseFloat(c.monto) || 0;
      subtotal += montoBase;

      const aplicaIva = c.aplica_iva !== false;
      const aplicaRet = c.aplica_retencion === true || factura.aplica_retencion === true;

      if (aplicaIva) iva += montoBase * 0.16;
      if (aplicaRet) retencionIva += montoBase * 0.04;

      const montoFormateado = `$${montoBase.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

      return [
        c.clave_sat || '78101802',
        '1',
        'E48',
        c.descripcion,
        montoFormateado,
        montoFormateado
      ];
    });
  } else {
    // MODO COMPATIBILIDAD (Facturas Viejas)
    const aplicaIva = factura.aplica_iva !== false; 
    const aplicaRetencion = factura.aplica_retencion !== false; 

    let factorMultiplicador = 1.0;
    if (aplicaIva) factorMultiplicador += 0.16;
    if (aplicaRetencion) factorMultiplicador -= 0.04;

    subtotal = Number(factura.monto_total || 0) / factorMultiplicador;
    if (aplicaIva) iva = subtotal * 0.16;
    if (aplicaRetencion) retencionIva = subtotal * 0.04;

    const subFormateado = `$${subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    conceptosArray = [
      ['78101802', '1', 'E48', factura.ruta || 'Servicio de flete nacional', subFormateado, subFormateado]
    ];
  }

  const totalFinal = (factura.conceptos_detalle && factura.conceptos_detalle.length > 0) 
    ? (subtotal + iva - retencionIva) 
    : Number(factura.monto_total || 0);
  
  const esVencida = new Date(factura.fecha_vencimiento + 'T23:59:59') < new Date() && factura.estatus_pago !== 'Pagado';
  let etiquetaEstatus = factura.estatus_pago === 'Pagado' ? 'PAGADO' : (esVencida ? 'ATRASADO' : 'PENDIENTE');
  let colorEstatus = factura.estatus_pago === 'Pagado' ? [34, 197, 94] : (esVencida ? [239, 68, 68] : [249, 115, 22]);

  let fechaImpresion = `${factura.fecha_viaje || 'Borrador'}`;

  // ==========================================
  // CORRECCIÓN DE ZONA HORARIA
  // ==========================================
  if (factura.cadena_original && factura.cadena_original.includes('T')) {
    const partesCadena = factura.cadena_original.split('|');
    const fechaTimbre = partesCadena.find(p => p.includes('T') && p.includes('-') && p.includes(':'));
    
    if (fechaTimbre) {
      const [fechaPart, horaPart] = fechaTimbre.split('T');
      const [year, month, day] = fechaPart.split('-');
      const [horas, minutos, segundos] = horaPart.split(':');
      
      const dateObj = new Date(year, month - 1, day, horas, minutos, segundos || 0);
      dateObj.setHours(dateObj.getHours() - 1); 
      
      const finalDia = String(dateObj.getDate()).padStart(2, '0');
      const finalMes = String(dateObj.getMonth() + 1).padStart(2, '0');
      const finalAño = dateObj.getFullYear();
      const finalHora = String(dateObj.getHours()).padStart(2, '0');
      const finalMin = String(dateObj.getMinutes()).padStart(2, '0');
      
      fechaImpresion = `${finalDia}/${finalMes}/${finalAño} a las ${finalHora}:${finalMin} hrs`;
    }
  } else if (factura.created_at) {
     const ahora = new Date();
     const formatHoraMty = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Monterrey', hour: '2-digit', minute: '2-digit', hour12: false });
     const formatFechaMty = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit' });
     fechaImpresion = `${formatFechaMty.format(ahora)} a las ${formatHoraMty.format(ahora)} hrs (Borrador)`;
  }

  let ordenCompra = factura.referencia || 'No especificada';
  if (ordenCompra === 'No especificada' && factura.ruta && factura.ruta.includes('Ref:')) {
      ordenCompra = factura.ruta.split('Ref:')[1].trim();
  }

  // ==========================================
  // 1. CABECERA Y LOGO
  // ==========================================
  if (perfilEmisor?.logo_base64) {
    const formato = perfilEmisor.logo_base64.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(perfilEmisor.logo_base64, formato, 14, 15, 35, 20);
  } else {
    doc.setDrawColor(200); doc.rect(14, 15, 35, 20); 
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("SIN\nLOGO", 31.5, 24, { align: 'center' });
  }

  doc.setTextColor(0, 0, 0); 
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(`${perfilEmisor?.razon_social || 'EMISOR SIN REGISTRAR'}`, 55, 19);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`RFC: ${perfilEmisor?.rfc || 'XAXX010101000'} | Régimen Fiscal: ${perfilEmisor?.regimen_fiscal || '601'}`, 55, 24);
  doc.text(`C.P. Emisión: ${perfilEmisor?.codigo_postal || '00000'}`, 55, 28);
  
  const dirEmisor = 'Dirección: ' + formatDireccion(perfilEmisor);
  const lineasDirEmisor = doc.splitTextToSize(dirEmisor, 65); 
  doc.text(lineasDirEmisor, 55, 32);

  doc.setFillColor(colorEstatus[0], colorEstatus[1], colorEstatus[2]); 
  doc.rect(125, 15, 71, 7, 'F');
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255); 
  doc.text(`FACTURA CFDI 4.0 - ${etiquetaEstatus}`, 160.5, 20, { align: 'center' });

  doc.setTextColor(0); doc.setFontSize(8);
  autoTable(doc, {
    startY: 22, margin: { left: 115, right: 14 }, 
    body: [
      ['Serie y Folio:', `F - ${String(factura.folio_interno || 'S/N').padStart(4, '0')}`],
      ['Folio Fiscal:', factura.folio_fiscal || 'POR ASIGNAR'],
      ['Fecha Emisión:', fechaImpresion],
      ['Orden / Ref:', ordenCompra], 
      ['Uso CFDI:', clienteData?.uso_cfdi || 'G03']
    ],
    theme: 'plain', styles: { fontSize: 7, cellPadding: 0.8 }, 
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 1: { halign: 'right', cellWidth: 59 } } 
  });

  // ==========================================
  // 2. RECEPTOR Y CONDICIONES DE PAGO
  // ==========================================
  let startYReceptor = Math.max(48, 36 + (lineasDirEmisor.length * 3.5));
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(14, startYReceptor - 4, 196, startYReceptor - 4); 

  doc.setFontSize(9); doc.setFont("helvetica", "bold"); 
  doc.text("RECEPTOR (CLIENTE):", 14, startYReceptor);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(String(factura.cliente || 'CLIENTE NO REGISTRADO'), 14, startYReceptor + 5);
  doc.setFontSize(8);
  doc.text(`RFC: ${clienteData?.rfc || 'XAXX010101000'} | Régimen: ${clienteData?.regimen_fiscal || '601'}`, 14, startYReceptor + 10);
  
  const dirReceptor = 'Domicilio: ' + formatDireccion(clienteData) + ', C.P. ' + (clienteData?.codigo_postal || '00000');
  const lineasDirReceptor = doc.splitTextToSize(dirReceptor, 100); 
  doc.text(lineasDirReceptor, 14, startYReceptor + 14);

  const diasCredito = clienteData?.dias_credito || 0;
  const condicionPago = diasCredito > 0 ? `CRÉDITO A ${diasCredito} DÍAS` : "CONTADO";
  
  doc.setDrawColor(200); doc.setLineWidth(0.1);
  doc.rect(120, startYReceptor - 1, 76, 18);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DE PAGO:", 122, startYReceptor + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`Condiciones: ${condicionPago}`, 122, startYReceptor + 9);
  doc.text(`Método: ${factura.metodo_pago || 'PPD'} | Forma: ${factura.forma_pago || '99'}`, 122, startYReceptor + 14);

  // ==========================================
  // 3. TABLA DE CONCEPTOS DINÁMICA
  // ==========================================
  let startYTabla = startYReceptor + 14 + (lineasDirReceptor.length * 3.5) + 5;

  autoTable(doc, {
    startY: startYTabla,
    head: [['Clave SAT', 'Cant.', 'Unidad', 'Descripción / Concepto', 'Precio Unitario', 'Importe']],
    body: conceptosArray, 
    theme: 'grid', 
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 
      0: { halign: 'center', cellWidth: 20 }, 1: { halign: 'center', cellWidth: 12 }, 
      2: { halign: 'center', cellWidth: 15 }, 3: { halign: 'left' },                  
      4: { halign: 'right', cellWidth: 25 },  5: { halign: 'right', cellWidth: 25 }   
    }
  });

  const finalY = doc.lastAutoTable.finalY;

  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  // INYECCIÓN DE TEXTO DIVISA
  doc.text(`Moneda: ${monedaStr} - ${monedaStr === 'USD' ? 'Dólar Estadounidense' : 'Peso Mexicano'}`, 14, finalY + 8);
  
  // ==========================================
  // MATRIZ DINÁMICA DE TOTALES
  // ==========================================
  const subtotalFormateado = subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const bodyTotales = [];
  bodyTotales.push(['Subtotal:', `$${subtotalFormateado}`]);

  if (iva > 0) bodyTotales.push(['IVA Trasladado (16%):', `$${iva.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);
  if (retencionIva > 0) bodyTotales.push(['Retención IVA (4%):', `-$${retencionIva.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);

  bodyTotales.push(['Total Neto:', `$${totalFinal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);

  autoTable(doc, {
    startY: finalY + 2, margin: { left: 135, right: 14 },
    body: bodyTotales,
    theme: 'plain', styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'right' }, 1: { halign: 'right', cellWidth: 30 } },
    didParseCell: function(data) { 
        if (data.row.index === bodyTotales.length - 1) { 
            data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 9; 
        } 
    }
  });

  // ==========================================
  // 4. PIE FISCAL Y QR
  // ==========================================
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

  const noCertificadoEmisor = factura.no_certificado_emisor || perfilEmisor?.no_certificado || '00001000000000000000';
  const noCertificadoSAT = factura.no_certificado_sat || '00001000000000000000';

  const selloOcho = factura.sello_emisor ? factura.sello_emisor.slice(-8) : '00000000';
  const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${rfcEmisor}&rr=${rfcReceptor}&tt=${totalStr}&fe=${selloOcho}`;
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;

  try {
      const resp = await fetch(apiUrl);
      const blob = await resp.blob();
      const base64QR = await new Promise(r => { const reader = new FileReader(); reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob); });
      doc.addImage(base64QR, 'PNG', 14, footerY, 35, 35);
      doc.setFontSize(5); doc.setFont("helvetica", "bold");
      doc.text("QR FACTURA (CFDI)", 31.5, footerY + 38, { align: 'center' });
  } catch (e) {
      doc.setDrawColor(200); doc.rect(14, footerY, 35, 35);
      doc.text("QR SAT", 31.5, footerY + 17, { align: 'center' });
  }
  
  let textoY = footerY + 3;
  doc.setFontSize(6); 
  
  doc.setFont("helvetica", "bold"); doc.text("Folio Fiscal (UUID):", 52, textoY);
  doc.setFont("helvetica", "normal"); doc.text(String(uuid), 80, textoY);
  textoY += 4;

  doc.setFont("helvetica", "bold"); doc.text("No. Certificado Emisor:", 52, textoY);
  doc.setFont("helvetica", "normal"); doc.text(String(noCertificadoEmisor), 85, textoY);
  
  doc.setFont("helvetica", "bold"); doc.text("No. Certificado SAT:", 135, textoY);
  doc.setFont("helvetica", "normal"); doc.text(String(noCertificadoSAT), 162, textoY);
  textoY += 5; 

  doc.setFont("helvetica", "bold"); doc.text("Sello Digital del Emisor:", 52, textoY); textoY += 3;
  doc.setFont("helvetica", "normal");
  const lineasSelloEmisor = doc.splitTextToSize(selloEmisor, 140); doc.text(lineasSelloEmisor, 52, textoY);
  textoY += (lineasSelloEmisor.length * 2.5) + 2; 

  doc.setFont("helvetica", "bold"); doc.text("Sello Digital del SAT:", 52, textoY); textoY += 3;
  doc.setFont("helvetica", "normal");
  const lineasSelloSat = doc.splitTextToSize(selloSat, 140); doc.text(lineasSelloSat, 52, textoY);
  textoY += (lineasSelloSat.length * 2.5) + 2;

  doc.setFont("helvetica", "bold"); doc.text("Cadena Original del Complemento de Certificación:", 52, textoY); textoY += 3;
  doc.setFont("helvetica", "normal");
  const lineasCadena = doc.splitTextToSize(cadenaOriginal, 140); doc.text(lineasCadena, 52, textoY);

  doc.setFontSize(7); doc.setTextColor(100);
  doc.text("Este documento es una representación impresa de un CFDI 4.0 de Ingreso.", 105, 288, { align: 'center' });

  doc.save(`Factura_F${String(factura.folio_interno || '0000').padStart(4, '0')}.pdf`);
};