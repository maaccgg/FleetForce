import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generarPDFCartaPorte = async (viaje, perfilEmisor) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // ==========================================
  // LÓGICA DE HORA EXACTA (EXTRAÍDA DEL SAT)
  // ==========================================
  let fechaEmisionCompleta = `${viaje.fecha_salida || 'Borrador'}`;

  // Truco: Buscamos la fecha y hora oficial directamente dentro de la Cadena Original del SAT
  if (viaje.cadena_original && viaje.cadena_original.includes('T')) {
    const partesCadena = viaje.cadena_original.split('|');
    // Buscamos el fragmento que parezca una fecha (Ej: 2024-03-12T14:35:10)
    const fechaTimbre = partesCadena.find(p => p.includes('T') && p.includes('-') && p.includes(':'));
    
    if (fechaTimbre) {
      const dateObj = new Date(fechaTimbre);
      const hora = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const dia = dateObj.toLocaleDateString('es-MX');
      fechaEmisionCompleta = `${dia} a las ${hora} hrs`;
    }
  }

  // ==========================================
  // 1. CABECERA (LOGO Y DATOS DEL EMISOR)
  // ==========================================
  if (perfilEmisor?.logo_base64) {
    const formato = perfilEmisor.logo_base64.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(perfilEmisor.logo_base64, formato, 14, 15, 35, 20);
  } else {
    doc.setDrawColor(200); doc.rect(14, 15, 35, 20); 
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("SIN\nLOGO", 31.5, 24, { align: 'center' });
  }

  doc.setTextColor(0); doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(perfilEmisor?.razon_social || "EMPRESA DE TRANSPORTE SA DE CV", 55, 19);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`RFC: ${perfilEmisor?.rfc || 'XEXX010101000'}`, 55, 24);
  doc.text(`Régimen: ${perfilEmisor?.regimen_fiscal || '601'}`, 55, 28);
  doc.text(`C.P. Emisión: ${perfilEmisor?.codigo_postal || '00000'}`, 55, 32);

  // Bloque Derecho (Folios y Fechas)
  doc.setFillColor(15, 23, 42); doc.rect(135, 15, 61, 7, 'F');
  doc.setTextColor(255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("INGRESO / CARTA PORTE 3.1", 165.5, 20, { align: 'center' });
  
  doc.setTextColor(0); doc.setFontSize(8);
  autoTable(doc, {
    startY: 22, margin: { left: 135, right: 14 },
    body: [
      ['Folio Interno:', `#${String(viaje.folio_interno).padStart(5, '0')}`],
      ['Fecha Emisión:', fechaEmisionCompleta], // <-- Usamos la hora extraída del SAT
      ['Folio Fiscal:', viaje.folio_fiscal?.slice(0,13) || 'POR ASIGNAR']
    ],
    theme: 'plain', styles: { fontSize: 7, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
  });

  // ==========================================
  // 2. SECCIÓN: CLIENTE / RECEPTOR
  // ==========================================
  doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(14, 42, 196, 42);
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("CLIENTE / RECEPTOR:", 14, 48);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Nombre: ${viaje.clientes?.nombre || 'PÚBLICO EN GENERAL'}`, 14, 53);
  doc.text(`RFC: ${viaje.clientes?.rfc || 'XAXX010101000'}`, 14, 58);
  doc.text(`Uso CFDI: ${viaje.clientes?.uso_cfdi || 'G03'} | Régimen: ${viaje.clientes?.regimen_fiscal || '601'}`, 14, 62);

  // ==========================================
  // Función ayudante para unir direcciones
  // ==========================================
  const formatDireccion = (obj) => {
    if (!obj) return '---';
    const parts = [];
    if (obj.calle_numero) parts.push(obj.calle_numero);
    if (obj.colonia) parts.push(`Col. ${obj.colonia}`);
    if (obj.municipio) parts.push(obj.municipio);
    return parts.length > 0 ? parts.join(', ') : '---';
  };

  // ==========================================
  // 3. SECCIÓN: LOGÍSTICA (ORIGEN Y DESTINO)
  // ==========================================
  doc.setFillColor(245, 245, 245); doc.rect(14, 68, 182, 6, 'F');
  doc.setFont("helvetica", "bold"); 
  doc.text("REMITENTE (ORIGEN)", 16, 72.5);
  doc.text("DESTINATARIO (LLEGADA)", 110, 72.5);

  doc.setFont("helvetica", "normal");
  let yLog = 79;
  
  // --- ORIGEN ---
  doc.setFont("helvetica", "bold");
  doc.text(`Ubicación: ${viaje.origen?.nombre_lugar || 'Domicilio Conocido'}`, 14, yLog);
  doc.setFont("helvetica", "normal");
  
  const dirO = doc.splitTextToSize(`Domicilio: ${formatDireccion(viaje.origen)}`, 85);
  doc.text(dirO, 14, yLog + 4);
  const saltoO = dirO.length * 4;
  
  doc.text(`C.P.: ${viaje.origen?.codigo_postal || '00000'} | Estado: ${viaje.origen?.estado || 'NLE'}`, 14, yLog + saltoO + 4);
  doc.text(`RFC Remitente: ${viaje.origen?.rfc_ubicacion || perfilEmisor?.rfc || 'XEXX010101000'}`, 14, yLog + saltoO + 8);
  
  // --- DESTINO ---
  doc.setFont("helvetica", "bold");
  doc.text(`Ubicación: ${viaje.destino?.nombre_lugar || 'Domicilio Conocido'}`, 110, yLog);
  doc.setFont("helvetica", "normal");
  
  const dirD = doc.splitTextToSize(`Domicilio: ${formatDireccion(viaje.destino)}`, 85);
  doc.text(dirD, 110, yLog + 4);
  const saltoD = dirD.length * 4;
  
  doc.text(`C.P.: ${viaje.destino?.codigo_postal || '00000'} | Estado: ${viaje.destino?.estado || 'TAM'}`, 110, yLog + saltoD + 4);
  doc.text(`RFC Destinatario: ${viaje.destino?.rfc_ubicacion || viaje.clientes?.rfc || 'XAXX010101000'}`, 110, yLog + saltoD + 8);

  let startTablas = yLog + Math.max(saltoO, saltoD) + 14;

  // ==========================================
  // 4. TABLAS (MERCANCÍAS Y TRANSPORTE)
  // ==========================================
  const filasMercancias = (viaje.mercancias_detalle || []).map(item => [
    item.cantidad,
    item.embalaje || 'KGM',
    item.clave_sat,
    item.descripcion,
    item.peso_kg
  ]);

  if (filasMercancias.length === 0 && viaje.mercancias) {
    filasMercancias.push([viaje.cantidad_mercancia || 1, 'E48', viaje.mercancias?.clave_sat, viaje.mercancias?.descripcion, viaje.peso_total_kg]);
  }

  autoTable(doc, {
    startY: startTablas,
    head: [['Cant.', 'Embalaje/Unidad', 'Clave SAT', 'Descripción del Bien', 'Peso (KG)']],
    body: filasMercancias,
    theme: 'grid', styles: { fontSize: 7 }, headStyles: { fillColor: [40, 40, 40] }
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5,
    head: [['VEHÍCULO / PLACAS', 'PERMISO SCT', 'SEGURO RC Y PÓLIZA', 'OPERADOR / LICENCIA']],
    body: [[
      `${viaje.unidades?.configuracion_vehicular || '---'}\n${viaje.unidades?.placas || 'N/A'}\nRemolque: ${viaje.remolques?.placas || 'N/A'}`,
      `${viaje.unidades?.permiso_sict || 'TPAF01'}\nNúm: ${viaje.unidades?.num_permiso_sict || 'S/N'}`,
      `${viaje.unidades?.aseguradora_rc || 'N/A'}\nPol: ${viaje.unidades?.poliza_rc || 'N/A'}`,
      `${viaje.operadores?.nombre_completo || 'N/A'}\nLic: ${viaje.operadores?.numero_licencia || 'N/A'}`
    ]],
    theme: 'grid', styles: { fontSize: 7 }, headStyles: { fillColor: [80, 80, 80] }
  });

  // ==========================================
  // 5. PIE FISCAL Y CÓDIGO QR
  // ==========================================
  let footerY = 225;
  
  if (doc.lastAutoTable.finalY > 215) {
     doc.addPage();
     footerY = 20;
  }

  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(14, footerY - 3, 196, footerY - 3);

  const uuid = viaje.folio_fiscal || '00000000-0000-0000-0000-000000000000';
  const rfcEmisor = perfilEmisor?.rfc || 'EKU9003173C9';
  const rfcReceptor = viaje.clientes?.rfc || 'URE180429TM6';
  const totalStr = (viaje.monto_flete || 0).toFixed(6);
  const selloOcho = viaje.sello_emisor ? viaje.sello_emisor.slice(-8) : '00000000';

  const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${rfcEmisor}&rr=${rfcReceptor}&tt=${totalStr}&fe=${selloOcho}`;
  const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;

  try {
    const resp = await fetch(qrApi);
    const blob = await resp.blob();
    const base64 = await new Promise(r => { const reader = new FileReader(); reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob); });
    doc.addImage(base64, 'PNG', 14, footerY, 35, 35);
  } catch (e) { 
    doc.setDrawColor(200); doc.rect(14, footerY, 35, 35); doc.text("QR SAT", 31.5, footerY + 17, { align: 'center' }); 
  }

  doc.setFontSize(6); doc.setFont("helvetica", "bold");
  doc.text(`IdCCP: ${viaje.id_ccp || 'POR ASIGNAR'}`, 52, footerY + 3);
  doc.text("Sello Digital del Emisor:", 52, footerY + 10);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(viaje.sello_emisor || 'Pendiente...', 140), 52, footerY + 13);
  
  doc.setFont("helvetica", "bold"); doc.text("Cadena Original:", 52, footerY + 25);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(viaje.cadena_original || '||Pendiente...||', 140), 52, footerY + 28);

  // ==========================================
  // 6. ANEXO LEGAL
  // ==========================================
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

  doc.setFont("helvetica", "bold"); doc.text("FIRMA DE CONFORMIDAD DEL CLIENTE / REMITENTE", 105, yLegal + 30, { align: 'center' });
  doc.line(65, yLegal + 25, 145, yLegal + 25);

  doc.save(`CartaPorte_${viaje.folio_interno}.pdf`);
};