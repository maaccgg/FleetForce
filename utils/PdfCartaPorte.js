import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Función para formatear el domicilio reutilizable
const formatDireccion = (obj) => {
  if (!obj) return '---';
  const parts = [];
  if (obj.calle_numero) parts.push(obj.calle_numero);
  if (obj.colonia) parts.push(`Col. ${obj.colonia}`);
  if (obj.municipio) parts.push(obj.municipio);
  if (obj.estado) parts.push(obj.estado);
  return parts.length > 0 ? parts.join(', ') : '---';
};

export const generarPDFCartaPorte = async (viaje, perfilEmisor) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  let fechaEmisionCompleta = `${viaje.fecha_salida || 'Borrador'}`;

  if (viaje.cadena_original && viaje.cadena_original.includes('T')) {
    const partesCadena = viaje.cadena_original.split('|');
    const fechaTimbre = partesCadena.find(p => p.includes('T') && p.includes('-') && p.includes(':'));
    
    if (fechaTimbre) {
      const dateObj = new Date(fechaTimbre);
      const hora = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  doc.text(`RFC: ${perfilEmisor?.rfc || 'XEXX010101000'} | Régimen: ${perfilEmisor?.regimen_fiscal || '601'}`, 55, 24);
  doc.text(`C.P. Emisión: ${perfilEmisor?.codigo_postal || '00000'}`, 55, 28);
  
  const dirEmisor = `Domicilio: ${formatDireccion(perfilEmisor)}`;
  const lineasDirEmisor = doc.splitTextToSize(dirEmisor, 75);
  doc.text(lineasDirEmisor, 55, 32);

  // Bloque Derecho (Folios y Fechas)
  doc.setFillColor(15, 23, 42); doc.rect(125, 15, 71, 7, 'F'); 
  doc.setTextColor(255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("INGRESO / CARTA PORTE 3.1", 160.5, 20, { align: 'center' });
  
  doc.setTextColor(0); doc.setFontSize(8);
  autoTable(doc, {
    startY: 22, margin: { left: 125, right: 14 },
    body: [
      ['Folio Interno:', `V - ${String(viaje.folio_interno).padStart(4, '0')}`],
      ['Fecha Emisión:', fechaEmisionCompleta],
      ['Folio Fiscal:', viaje.folio_fiscal || 'POR ASIGNAR'],
      ['Orden Compra:', viaje.referencia || '---']
    ],
    theme: 'plain', styles: { fontSize: 7, cellPadding: 0.8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 1: { halign: 'right', cellWidth: 49 } }
  });

  let startYCliente = Math.max(44, 34 + (lineasDirEmisor.length * 3.5));

  // ==========================================
  // 2. SECCIÓN: CLIENTE / RECEPTOR
  // ==========================================
  doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(14, startYCliente, 196, startYCliente);
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("CLIENTE / RECEPTOR:", 14, startYCliente + 6);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Nombre: ${viaje.clientes?.nombre || 'PÚBLICO EN GENERAL'}`, 14, startYCliente + 11);
  doc.text(`RFC: ${viaje.clientes?.rfc || 'XAXX010101000'}`, 14, startYCliente + 16);
  doc.text(`Uso CFDI: ${viaje.clientes?.uso_cfdi || 'G03'} | Régimen: ${viaje.clientes?.regimen_fiscal || '601'}`, 14, startYCliente + 20);

  // ==========================================
  // 3. SECCIÓN: LOGÍSTICA (ORIGEN Y DESTINO)
  // ==========================================
  let startYLogistica = startYCliente + 26;
  doc.setFillColor(245, 245, 245); doc.rect(14, startYLogistica, 182, 6, 'F');
  doc.setFont("helvetica", "bold"); 
  doc.text("REMITENTE (ORIGEN)", 16, startYLogistica + 4.5);
  doc.text("DESTINATARIO (LLEGADA)", 110, startYLogistica + 4.5);

  doc.setFont("helvetica", "normal");
  let yLog = startYLogistica + 11;
  
  // --- ORIGEN ---
  doc.setFont("helvetica", "bold");
  doc.text(`Ubicación: ${viaje.origen?.nombre_lugar || 'Domicilio Conocido'}`, 14, yLog);
  doc.setFont("helvetica", "normal");
  const dirO = doc.splitTextToSize(`Domicilio: ${formatDireccion(viaje.origen)}`, 85);
  doc.text(dirO, 14, yLog + 4);
  const saltoO = dirO.length * 4;
  doc.text(`C.P.: ${viaje.origen?.codigo_postal || '00000'} | Estado: ${viaje.origen?.estado || 'NLE'} | País: MEX`, 14, yLog + saltoO + 4);
  doc.text(`RFC Remitente: ${viaje.origen?.rfc_ubicacion || perfilEmisor?.rfc || 'XEXX010101000'}`, 14, yLog + saltoO + 8);
  
  // --- DESTINO ---
  doc.setFont("helvetica", "bold");
  doc.text(`Ubicación: ${viaje.destino?.nombre_lugar || 'Domicilio Conocido'}`, 110, yLog);
  doc.setFont("helvetica", "normal");
  const dirD = doc.splitTextToSize(`Domicilio: ${formatDireccion(viaje.destino)}`, 85);
  doc.text(dirD, 110, yLog + 4);
  const saltoD = dirD.length * 4;
  doc.text(`C.P.: ${viaje.destino?.codigo_postal || '00000'} | Estado: ${viaje.destino?.estado || 'TAM'} | País: MEX`, 110, yLog + saltoD + 4);
  doc.text(`RFC Destinatario: ${viaje.destino?.rfc_ubicacion || viaje.clientes?.rfc || 'XAXX010101000'}`, 110, yLog + saltoD + 8);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Distancia Recorrida: ${viaje.distancia_km || '0'} KM`, 110, yLog + saltoD + 12);
  doc.setFont("helvetica", "normal");

  let startTablas = yLog + Math.max(saltoO, saltoD) + 18;

  // ==========================================
  // 4. TABLAS (MERCANCÍAS Y TRANSPORTE)
  // ==========================================
  const filasMercancias = (viaje.mercancias_detalle || []).map(item => {
    const valorDeclarado = (item.valor && item.valor > 0) ? `$${Number(item.valor).toLocaleString('es-MX')} ${item.moneda || 'MXN'}` : '---';
    
    // NUEVO: IMPRIMIMOS EXPLÍCITAMENTE "SÍ" o "NO" EN MAT. PELIGROSO
    const textoPeligroso = item.material_peligroso ? 'MAT. PELIGROSO: SÍ ⚠️' : 'MAT. PELIGROSO: NO';
    const descripcionAmpliacion = `${item.descripcion}\n${textoPeligroso}`;
    
    return [
      item.cantidad,
      item.embalaje || 'KGM',
      item.clave_sat,
      descripcionAmpliacion,
      `${item.peso_kg} kg`,
      valorDeclarado
    ];
  });

  if (filasMercancias.length === 0 && viaje.mercancias) {
    filasMercancias.push([viaje.cantidad_mercancia || 1, 'E48', viaje.mercancias?.clave_sat, `${viaje.mercancias?.descripcion}\nMAT. PELIGROSO: NO`, `${viaje.peso_total_kg} kg`, '---']);
  }

  autoTable(doc, {
    startY: startTablas,
    head: [['Cant.', 'Emb.', 'Clave SAT', 'Descripción del Bien', 'Peso (KG)', 'Valor Decl.']],
    body: filasMercancias,
    theme: 'grid', styles: { fontSize: 7 }, headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 5: { halign: 'right' } }
  });

  const totalPeso = (viaje.mercancias_detalle || []).reduce((acc, curr) => acc + (Number(curr.peso_kg) || 0), 0) || viaje.peso_total_kg || 0;
  const totalBienes = (viaje.mercancias_detalle || []).length || 1;
  
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(`Número Total de Mercancías: ${totalBienes} | Peso Bruto Total de la Carga: ${totalPeso} KG`, 14, doc.lastAutoTable.finalY + 5);

  const configSAT = viaje.unidades?.configuracion_vehicular || '';
  const esArticulado = configSAT.includes('T') || configSAT.includes('R');
  const textoRemolque = esArticulado && viaje.remolques ? `Caja/Remolque: ${viaje.remolques.placas}` : 'Remolque: No Aplica';
  
  const modelo = viaje.unidades?.anio_modelo || 'N/A';
  const pesoBruto = viaje.unidades?.peso_bruto_maximo || '30.00';

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['VEHÍCULO / PLACAS', 'PERMISO SCT', 'SEGURO RC Y PÓLIZA', 'OPERADOR / LICENCIA']],
    body: [[
      `${configSAT} (Mod: ${modelo})\nPlacas: ${viaje.unidades?.placas || 'N/A'}\nPBV: ${pesoBruto} Ton\n${textoRemolque}`,
      `${viaje.unidades?.permiso_sict || 'TPAF01'}\nNúm: ${viaje.unidades?.num_permiso_sict || 'S/N'}`,
      `${viaje.unidades?.aseguradora_rc || 'N/A'}\nPol: ${viaje.unidades?.poliza_rc || 'N/A'}`,
      `${viaje.operadores?.nombre_completo || 'N/A'}\nRFC: ${viaje.operadores?.rfc || 'XAXX010101000'}\nLic: ${viaje.operadores?.numero_licencia || 'N/A'}`
    ]],
    theme: 'grid', styles: { fontSize: 7 }, headStyles: { fillColor: [80, 80, 80] }
  });

  // ==========================================
  // 5. PIE FISCAL Y LOS 2 CÓDIGOS QR (SAT 3.1)
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
  const idCcp = viaje.id_ccp || 'POR-ASIGNAR';

  // URL del QR 1 (CFDI de Ingreso Standard)
  const qrCfdiUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${rfcEmisor}&rr=${rfcReceptor}&tt=${totalStr}&fe=${selloOcho}`;
  const qrCfdiApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCfdiUrl)}`;

  // URL del QR 2 (Carta Porte IdCCP Exclusivo)
  const qrCcpUrl = `https://verificaccp.facturaelectronica.sat.gob.mx/default.aspx?idccp=${idCcp}`;
  const qrCcpApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCcpUrl)}`;

  try {
    // Generar e imprimir QR 1 (Izquierda)
    const resp1 = await fetch(qrCfdiApi);
    const blob1 = await resp1.blob();
    const base64_1 = await new Promise(r => { const reader = new FileReader(); reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob1); });
    doc.addImage(base64_1, 'PNG', 14, footerY, 28, 28);
    doc.setFontSize(5); doc.setFont("helvetica", "bold");
    doc.text("QR FACTURA (CFDI)", 28, footerY + 31, { align: 'center' });

    // Generar e imprimir QR 2 (Derecha)
    const resp2 = await fetch(qrCcpApi);
    const blob2 = await resp2.blob();
    const base64_2 = await new Promise(r => { const reader = new FileReader(); reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob2); });
    doc.addImage(base64_2, 'PNG', 168, footerY, 28, 28);
    doc.text("QR CARTA PORTE", 182, footerY + 31, { align: 'center' });
  } catch (e) { 
    doc.setDrawColor(200); 
    doc.rect(14, footerY, 28, 28); doc.text("QR CFDI", 28, footerY + 14, { align: 'center' }); 
    doc.rect(168, footerY, 28, 28); doc.text("QR CCP", 182, footerY + 14, { align: 'center' }); 
  }

// Textos y Sellos centrados entre los dos QRs (x = 46 a 160)
  let textoY = footerY + 2;
  doc.setFontSize(6); doc.setFont("helvetica", "bold");
  doc.text(`IdCCP: ${idCcp}`, 46, textoY);
  
  textoY += 6;
  doc.text("Sello Digital del Emisor:", 46, textoY);
  doc.setFont("helvetica", "normal");
  // 1. Guardamos el arreglo de líneas del emisor
  const lineasSelloEmisor = doc.splitTextToSize(viaje.sello_emisor || 'Pendiente...', 115);
  doc.text(lineasSelloEmisor, 46, textoY + 3);
  
  // 2. Calculamos dinámicamente el salto: 3 (margen sup) + (número de líneas * 2.5 alto de línea) + 3 (margen inf)
  textoY += 3 + (lineasSelloEmisor.length * 2.5) + 3;
  
  doc.setFont("helvetica", "bold");
  doc.text("Sello Digital del SAT:", 46, textoY);
  doc.setFont("helvetica", "normal");
  // 3. Repetimos la lógica para el SAT
  const lineasSelloSat = doc.splitTextToSize(viaje.sello_sat || 'Pendiente...', 115);
  doc.text(lineasSelloSat, 46, textoY + 3);
  
  textoY += 3 + (lineasSelloSat.length * 2.5) + 3;
  
  doc.setFont("helvetica", "bold"); doc.text("Cadena Original:", 46, textoY);
  doc.setFont("helvetica", "normal");
  const lineasCadena = doc.splitTextToSize(viaje.cadena_original || '||Pendiente...||', 115);
  doc.text(lineasCadena, 46, textoY + 3);
  
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

  doc.save(`CartaPorte_${viaje.folio_interno || '0000'}.pdf`);
};