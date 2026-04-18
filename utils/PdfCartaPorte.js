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
  
  // === DETECTOR DE MODO ===
  const isBorrador = viaje.estatus === 'Borrador';

  // Función interna para imprimir la marca de agua en cada página
  const imprimirMarcaDeAgua = () => {
    if (isBorrador) {
      doc.setTextColor(225, 225, 225); // Gris muy claro
      doc.setFontSize(70);
      doc.setFont("helvetica", "bold");
      doc.text("BORRADOR", 105, 140, { align: 'center', angle: 45 });
      doc.setFontSize(25);
      doc.text("SIN VALIDEZ FISCAL", 105, 160, { align: 'center', angle: 45 });
      doc.setTextColor(0); // Regresamos el pincel a negro
    }
  };

  imprimirMarcaDeAgua(); // Imprimimos en la primera página
  
  let fechaEmisionCompleta = `${viaje.fecha_salida || 'Borrador'}`;

  if (viaje.cadena_original && viaje.cadena_original.includes('T')) {
    const partesCadena = viaje.cadena_original.split('|');
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
      
      fechaEmisionCompleta = `${finalDia}/${finalMes}/${finalAño} a las ${finalHora}:${finalMin} hrs`;
    }
  } else {
     const ahora = new Date();
     const formatHoraMty = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Monterrey', hour: '2-digit', minute: '2-digit', hour12: false });
     const formatFechaMty = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit' });
     fechaEmisionCompleta = `${formatFechaMty.format(ahora)} a las ${formatHoraMty.format(ahora)} hrs (Borrador)`;
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
  doc.text(isBorrador ? "PREVISUALIZACIÓN DE VIAJE" : "INGRESO / CARTA PORTE 3.1", 160.5, 20, { align: 'center' });
  
  doc.setTextColor(0); doc.setFontSize(8);
  autoTable(doc, {
    startY: 22, margin: { left: 125, right: 14 },
    body: [
      ['Folio Interno:', `V - ${String(viaje.folio_interno).padStart(4, '0')}`],
      ['Fecha Emisión:', fechaEmisionCompleta],
      ['Folio Fiscal:', isBorrador ? 'DOCUMENTO NO TIMBRADO' : (viaje.folio_fiscal || 'POR ASIGNAR')],
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
  doc.text(`Uso CFDI: ${viaje.clientes?.uso_cfdi || 'G01'} | Régimen: ${viaje.clientes?.regimen_fiscal || '601'}`, 14, startYCliente + 20);

  doc.setFont("helvetica", "bold");
  doc.text("Servicio Amparado (CFDI):", 14, startYCliente + 25);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Servicio de Flete Nacional (Clave SAT: 78101802)   |   Importe: - ", 56, startYCliente + 25);
  doc.setTextColor(0);

  // ==========================================
  // 3. SECCIÓN: LOGÍSTICA (ORIGEN Y DESTINO)
  // ==========================================
  let startYLogistica = startYCliente + 31;
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
    const textoPeligroso = item.material_peligroso ? 'MAT. PELIGROSO: SÍ ⚠️' : 'MAT. PELIGROSO: NO';
    const descripcionAmpliacion = `${item.descripcion}\nEmb: ${item.clave_embalaje || 'Z01'} | ${textoPeligroso}`;
    
    return [
      item.cantidad,
      item.clave_unidad || 'H87',
      item.clave_sat,
      descripcionAmpliacion,
      `${item.peso_kg} kg`
    ];
  });

  if (filasMercancias.length === 0 && viaje.mercancias) {
    filasMercancias.push([
        viaje.cantidad_mercancia || 1, 
        viaje.mercancias?.clave_unidad || 'H87', 
        viaje.mercancias?.clave_sat, 
        `${viaje.mercancias?.descripcion}\nEmb: ${viaje.mercancias?.clave_embalaje || 'Z01'} | MAT. PELIGROSO: NO`, 
        `${viaje.peso_total_kg} kg`
    ]);
  }

  autoTable(doc, {
    startY: startTablas,
    head: [['Cant.', 'Unidad', 'Clave SAT', 'Descripción del Bien', 'Peso (KG)']],
    body: filasMercancias,
    theme: 'grid', styles: { fontSize: 7 }, headStyles: { fillColor: [40, 40, 40] }
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
  // 5. PIE FISCAL (QR ÚNICO Y SELLOS)
  // ==========================================
  let footerY = 225;
  if (doc.lastAutoTable.finalY > 215) {
     doc.addPage();
     imprimirMarcaDeAgua(); // Imprimimos marca de agua en la nueva página si hay salto
     footerY = 20;
  }

  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(14, footerY - 3, 196, footerY - 3);

  const idCcp = viaje.id_ccp || 'POR-ASIGNAR';

  // Ajuste táctico: Si es borrador, no buscamos el QR para evitar errores de red
  if (isBorrador) {
    doc.setDrawColor(200); 
    doc.rect(14, footerY, 28, 28); 
    doc.setFontSize(6); doc.setTextColor(150);
    doc.text("BORRADOR\nSIN QR", 28, footerY + 14, { align: 'center' }); 
    doc.setTextColor(0);
  } else {
    const qrCcpUrl = `https://verificaccp.facturaelectronica.sat.gob.mx/default.aspx?idccp=${idCcp}`;
    const qrCcpApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCcpUrl)}`;

    try {
      const resp2 = await fetch(qrCcpApi);
      const blob2 = await resp2.blob();
      const base64_2 = await new Promise(r => { const reader = new FileReader(); reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob2); });
      doc.addImage(base64_2, 'PNG', 14, footerY, 28, 28);
      doc.setFontSize(5); doc.setFont("helvetica", "bold");
      doc.text("QR CARTA PORTE", 28, footerY + 31, { align: 'center' });
    } catch (e) { 
      doc.setDrawColor(200); 
      doc.rect(14, footerY, 28, 28); doc.text("QR CCP", 28, footerY + 14, { align: 'center' }); 
    }
  }

  // Textos y Sellos a la derecha del QR único
  let textoY = footerY + 2;
  doc.setFontSize(6); doc.setFont("helvetica", "bold");
  doc.text(`IdCCP: ${isBorrador ? 'DOCUMENTO EN BORRADOR' : idCcp}`, 46, textoY);
  
  textoY += 6;
  doc.text("Sello Digital del Emisor:", 46, textoY);
  doc.setFont("helvetica", "normal");
  const textoSelloEmisor = isBorrador ? 'DOCUMENTO EN BORRADOR - SIN EFECTOS FISCALES' : (viaje.sello_emisor || 'Pendiente...');
  const lineasSelloEmisor = doc.splitTextToSize(textoSelloEmisor, 145); 
  doc.text(lineasSelloEmisor, 46, textoY + 3);
  
  textoY += 3 + (lineasSelloEmisor.length * 2.5) + 3;
  
  doc.setFont("helvetica", "bold");
  doc.text("Sello Digital del SAT:", 46, textoY);
  doc.setFont("helvetica", "normal");
  const textoSelloSat = isBorrador ? 'DOCUMENTO EN BORRADOR - SIN EFECTOS FISCALES' : (viaje.sello_sat || 'Pendiente...');
  const lineasSelloSat = doc.splitTextToSize(textoSelloSat, 145);
  doc.text(lineasSelloSat, 46, textoY + 3);
  
  textoY += 3 + (lineasSelloSat.length * 2.5) + 3;
  
  doc.setFont("helvetica", "bold"); doc.text("Cadena Original:", 46, textoY);
  doc.setFont("helvetica", "normal");
  const textoCadena = isBorrador ? '||DOCUMENTO EN BORRADOR - SIN EFECTOS FISCALES||' : (viaje.cadena_original || '||Pendiente...||');
  const lineasCadena = doc.splitTextToSize(textoCadena, 145);
  doc.text(lineasCadena, 46, textoY + 3);
  
  // ==========================================
  // 6. ANEXO LEGAL
  // ==========================================
  doc.addPage();
  imprimirMarcaDeAgua(); // Imprimimos la marca de agua en la página legal también

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

  const nombreArchivo = isBorrador ? `PREVISUALIZACION_Borrador_V${viaje.folio_interno || '0000'}.pdf` : `CartaPorte_${viaje.folio_interno || '0000'}.pdf`;
  doc.save(nombreArchivo);
};