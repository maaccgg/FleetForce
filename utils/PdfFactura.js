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

  // === DETECTOR DE MODO (Borrador vs Timbrado) ===
  const isBorrador = !factura.folio_fiscal || factura.folio_fiscal.trim() === '';

  const imprimirMarcaDeAgua = () => {
    if (isBorrador) {
      doc.setTextColor(225, 225, 225);
      doc.setFontSize(70);
      doc.setFont("helvetica", "bold");
      doc.text("BORRADOR", 105, 140, { align: 'center', angle: 45 });
      doc.setFontSize(25);
      doc.text("SIN VALIDEZ FISCAL", 105, 160, { align: 'center', angle: 45 });
      doc.setTextColor(0);
    }
  };

  imprimirMarcaDeAgua();

  // ==========================================
  // CONFIGURACIÓN DE DATOS Y DIVISA
  // ==========================================
  let conceptosArray = [];
  let subtotal = 0;
  let iva = 0;
  let retencionIva = 0;
  const monedaStr = factura.moneda || 'MXN';

  if (factura.conceptos_detalle && factura.conceptos_detalle.length > 0) {
    conceptosArray = factura.conceptos_detalle.map(c => {
      const montoBase = parseFloat(c.monto) || 0;
      subtotal += montoBase;
      if (c.aplica_iva !== false) iva += montoBase * 0.16;
      if (c.aplica_retencion === true || factura.aplica_retencion === true) retencionIva += montoBase * 0.04;

      const montoFormateado = `$${montoBase.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      return [c.clave_sat || '78101802', '1', 'E48', c.descripcion, montoFormateado, montoFormateado];
    });
  } else {
    const aplicaIva = factura.aplica_iva !== false; 
    const aplicaRetencion = factura.aplica_retencion !== false; 
    let factor = 1.0 + (aplicaIva ? 0.16 : 0) - (aplicaRetencion ? 0.04 : 0);
    subtotal = Number(factura.monto_total || 0) / factor;
    if (aplicaIva) iva = subtotal * 0.16;
    if (aplicaRetencion) retencionIva = subtotal * 0.04;
    const subForm = `$${subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    conceptosArray = [['78101802', '1', 'E48', factura.ruta || 'Servicio de flete nacional', subForm, subForm]];
  }

  const totalFinal = (subtotal + iva - retencionIva);
  let fechaImpresion = factura.fecha_viaje || 'Borrador';

  // ==========================================
  // EXTRACCIÓN INTELIGENTE DE REFERENCIA/VIAJE
  // ==========================================
  let arrRef = [];
  if (factura.referencia) arrRef.push(factura.referencia);
  if (factura.folio_viaje) arrRef.push(`Viaje ${factura.folio_viaje}`);
  
  let textoReferencia = arrRef.length > 0 ? arrRef.join(' | ') : 'S/N';
  if (textoReferencia.length > 38) textoReferencia = textoReferencia.substring(0, 35) + '...';

  // ==========================================
  // 1. CABECERA (LOGOTIPO Y DATOS EMISOR)
  // ==========================================
  if (perfilEmisor?.logo_base64) {
    const formato = perfilEmisor.logo_base64.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(perfilEmisor.logo_base64, formato, 14, 15, 35, 20);
  } else {
    doc.setDrawColor(220); doc.rect(14, 15, 35, 20); 
    doc.setFontSize(7); doc.setTextColor(150); doc.text("LOGOTIPO", 31.5, 26, { align: 'center' });
  }

  doc.setTextColor(0); 
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(`${perfilEmisor?.razon_social || 'EMISOR NO REGISTRADO'}`, 55, 19);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`RFC: ${perfilEmisor?.rfc || 'XAXX010101000'} | Régimen: ${perfilEmisor?.regimen_fiscal || '601'}`, 55, 24);
  
  const dirEmisor = formatDireccion(perfilEmisor) + ` C.P. ${perfilEmisor?.codigo_postal || '00000'}`;
  const lineasDirEmisor = doc.splitTextToSize(dirEmisor, 65); 
  doc.text(lineasDirEmisor, 55, 28);

  doc.setFillColor(15, 23, 42); 
  doc.rect(125, 15, 71, 7, 'F');
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255); 
  doc.text(isBorrador ? "PREVISUALIZACIÓN DE FACTURA" : "FACTURA CFDI 4.0", 160.5, 20, { align: 'center' });

  doc.setTextColor(0); doc.setFontSize(7.5);
  autoTable(doc, {
    startY: 23, margin: { left: 125, right: 14 }, 
    body: [
      ['Serie y Folio:', `F - ${String(factura.folio_interno || 'S/N').padStart(4, '0')}`],
      ['Folio Fiscal:', isBorrador ? 'DOCUMENTO NO TIMBRADO' : factura.folio_fiscal],
      ['Fecha Emisión:', fechaImpresion],
      ['Orden / Ref:', textoReferencia],
      ['Uso CFDI:', clienteData?.uso_cfdi || 'G03']
    ],
    theme: 'plain', styles: { fontSize: 7, cellPadding: 0.8 }, 
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 1: { halign: 'right' } } 
  });

  // ==========================================
  // 2. RECEPTOR Y CONDICIONES 
  // ==========================================
  let startYReceptor = doc.lastAutoTable.finalY + 8; 

  doc.setDrawColor(15, 23, 42); doc.setLineWidth(0.4);
  doc.line(14, startYReceptor - 4, 196, startYReceptor - 4); 

  doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.text("RECEPTOR (CLIENTE):", 14, startYReceptor);
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text(String(factura.cliente || 'CLIENTE NO REGISTRADO'), 14, startYReceptor + 5);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`RFC: ${clienteData?.rfc || 'XAXX010101000'} | Régimen: ${clienteData?.regimen_fiscal || '601'}`, 14, startYReceptor + 10);
  const dirReceptor = 'Domicilio: ' + formatDireccion(clienteData) + ', C.P. ' + (clienteData?.codigo_postal || '00000');
  doc.text(doc.splitTextToSize(dirReceptor, 100), 14, startYReceptor + 14);

  doc.setDrawColor(230); doc.rect(125, startYReceptor - 1, 71, 18);
  doc.setFont("helvetica", "bold"); doc.text("DATOS DE PAGO:", 127, startYReceptor + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`Moneda: ${monedaStr}`, 127, startYReceptor + 9);
  doc.text(`Método: ${factura.metodo_pago || 'PPD'} | Forma: ${factura.forma_pago || '99'}`, 127, startYReceptor + 14);

  // ==========================================
  // 3. TABLA DE CONCEPTOS 
  // ==========================================
  autoTable(doc, {
    startY: startYReceptor + 25,
    margin: { left: 14, right: 14 },
    head: [['Clave SAT', 'Cant.', 'Uni.', 'Descripción / Concepto', 'Precio Unitario', 'Importe']],
    body: conceptosArray,
    theme: 'grid', 
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
    columnStyles: { 
      0: { halign: 'center', cellWidth: 20 }, 1: { halign: 'center', cellWidth: 12 }, 
      2: { halign: 'center', cellWidth: 12 }, 3: { halign: 'left' },                  
      4: { halign: 'right', cellWidth: 30 },  5: { halign: 'right', cellWidth: 30 }   
    }
  });

  const finalY = doc.lastAutoTable.finalY;

  // ==========================================
  // 4. TOTALES 
  // ==========================================
  const subtotalForm = subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const bodyTotales = [['Subtotal:', `$${subtotalForm}`]];
  if (iva > 0) bodyTotales.push(['IVA (16%):', `$${iva.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);
  if (retencionIva > 0) bodyTotales.push(['Retención IVA (4%):', `-$${retencionIva.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);
  bodyTotales.push(['Total:', `$${totalFinal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${monedaStr}`]);

  autoTable(doc, {
    startY: finalY + 2, margin: { left: 130, right: 14 },
    body: bodyTotales,
    theme: 'plain', styles: { fontSize: 8, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'right' }, 1: { halign: 'right', cellWidth: 36 } },
    didParseCell: function(data) { 
        if (data.row.index === bodyTotales.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 9; } 
    }
  });

  // ==========================================
  // 5. SECCIÓN DE COMENTARIOS 
  // ==========================================
  const footerY = 225; // Base donde comienza la zona del SAT
  let heightComentarios = 0;
  let lineasComentarios = [];
  
  if (factura.comentarios && factura.comentarios.trim() !== '') {
    lineasComentarios = doc.splitTextToSize(factura.comentarios, 180);
    heightComentarios = (lineasComentarios.length * 4) + 6; 
  }

  // Si los comentarios y los totales chocan con la zona del SAT, creamos nueva hoja
  if (doc.lastAutoTable.finalY + heightComentarios > 215) {
    doc.addPage();
    imprimirMarcaDeAgua();
  }

  // Imprimimos los comentarios justo arriba de la línea divisoria
  if (heightComentarios > 0) {
    const startComentariosY = footerY - heightComentarios - 2;
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Observaciones / Notas:", 14, startComentariosY);
    doc.setFont("helvetica", "normal"); doc.setTextColor(80);
    doc.text(lineasComentarios, 14, startComentariosY + 4);
    doc.setTextColor(0); 
  }

  // ==========================================
  // 6. PIE FISCAL (CÓDIGOS Y SELLOS)
  // ==========================================
  doc.setDrawColor(15, 23, 42); doc.setLineWidth(0.4); doc.line(14, footerY - 3, 196, footerY - 3);

  const uuid = factura.folio_fiscal || 'POR DEFINIR';
  const selloEmisor = factura.sello_emisor || 'Pendiente de timbrado.';
  const selloSat = factura.sello_sat || 'Pendiente de timbrado.';
  const cadena = factura.cadena_original || '||Pendiente de timbrado.||';

  // Lógica del Código QR (Provisional si es Borrador, Real si está Timbrado)
  if (isBorrador) {
    doc.setDrawColor(200); doc.rect(14, footerY, 30, 30);
    doc.setFontSize(6); doc.setTextColor(150);
    doc.text("BORRADOR\nSIN QR", 29, footerY + 15, { align: 'center' });
    doc.setTextColor(0);
  } else {
    // Generación del QR real usando la API pública gratuita
    const qrData = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}`;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    
    try {
      const resp = await fetch(qrApi);
      const blob = await resp.blob();
      const base64 = await new Promise(r => { const reader = new FileReader(); reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob); });
      doc.addImage(base64, 'PNG', 14, footerY, 30, 30);
    } catch (e) {
      doc.setDrawColor(200); doc.rect(14, footerY, 30, 30); 
      doc.text("QR SAT", 29, footerY + 15, { align: 'center' });
    }
  }

  let textX = 50; let textY = footerY + 3;
  doc.setFontSize(6); doc.setFont("helvetica", "bold"); doc.text("Folio Fiscal (UUID):", textX, textY);
  doc.setFont("helvetica", "normal"); doc.text(String(uuid), textX + 25, textY);
  
  textY += 5; doc.setFont("helvetica", "bold"); doc.text("Sello Digital del Emisor:", textX, textY);
  textY += 3; doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(selloEmisor, 140), textX, textY);
  
  textY += 10; doc.setFont("helvetica", "bold"); doc.text("Sello Digital del SAT:", textX, textY);
  textY += 3; doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(selloSat, 140), textX, textY);
  
  textY += 10; doc.setFont("helvetica", "bold"); doc.text("Cadena Original:", textX, textY);
  textY += 3; doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(cadena, 140), textX, textY);

  doc.setFontSize(7); doc.setTextColor(150);
  doc.text("Este documento es una representación impresa de un CFDI 4.0", 105, 288, { align: 'center' });

  // Nombre del archivo dinámico
  const nombreArchivo = isBorrador ? `PREVISUALIZACION_Borrador_F${String(factura.folio_interno || '0000').padStart(4, '0')}.pdf` : `Factura_F${String(factura.folio_interno || '0000').padStart(4, '0')}.pdf`;
  doc.save(nombreArchivo);
};