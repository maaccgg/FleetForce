import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  // Generamos un ID de rastreo inicial por si algo falla antes de tiempo
  const errorId = crypto.randomUUID().split('-')[0].toUpperCase();

  try {
    // ==========================================
    // FASE 1: EL CADENERO EXIGE GAFETE (USUARIO)
    // ==========================================
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Acceso Denegado. Token no proporcionado.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    // ==========================================
    // FASE 2: BÚSQUEDA DE LLAVE MULTI-TENANT
    // ==========================================
    // A. Identificamos a la empresa a la que pertenece el usuario
    const { data: perfilPeticionario, error: perfilError } = await supabaseAuth
      .from('perfiles')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (perfilError) {
      return NextResponse.json({ error: 'No se pudo verificar la identidad corporativa.' }, { status: 403 });
    }

    const idMaestro = perfilPeticionario?.empresa_id || user.id;

    // B. Extraemos la llave de Facturapi del dueño de la cuenta (Maestro)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: perfilMaestro, error: maestroError } = await supabaseAdmin
      .from('perfiles')
      .select('facturapi_key')
      .eq('id', idMaestro)
      .single();

    const apiKeyCliente = perfilMaestro?.facturapi_key;

    if (!apiKeyCliente) {
      return NextResponse.json({ 
        error: 'Operación bloqueada: Tu empresa no tiene una llave de Facturapi configurada. Contacta a soporte FleetForce.' 
      }, { status: 403 });
    }

    // ==========================================
    // FASE 3: VALIDACIÓN Y TÚNEL SEGURO
    // ==========================================
    const body = await request.json();
    const { endpoint, method, payload } = body;

    // Whitelist de métodos HTTP
    const METODOS_PERMITIDOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const metodoFinal = (method || 'POST').toUpperCase();
    
    if (!METODOS_PERMITIDOS.includes(metodoFinal)) {
      return NextResponse.json({ error: 'Método HTTP no permitido en el túnel.' }, { status: 400 });
    }

    // Sanitización del Endpoint (Evita Path Traversal)
    if (!endpoint || typeof endpoint !== 'string' || endpoint.includes('..') || endpoint.startsWith('/')) {
      return NextResponse.json({ error: 'Endpoint de Facturapi inválido o mal formado.' }, { status: 400 });
    }

    const url = `https://www.facturapi.io/v2/${endpoint}`;
    
    const options = {
      method: metodoFinal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyCliente}`
      }
    };

    if (payload && !['GET', 'DELETE'].includes(metodoFinal)) {
      options.body = JSON.stringify(payload);
    }

    // Ejecución de la petición a Facturapi
    const response = await fetch(url, options);

    // Manejo de archivos XML (Descarga de Facturas/Carta Porte)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/xml')) {
        const xmlText = await response.text();
        if (!response.ok) return NextResponse.json({ error: 'Error al procesar XML del SAT' }, { status: response.status });
        return new NextResponse(xmlText, { headers: { 'Content-Type': 'application/xml' } });
    }

    // Manejo de respuesta JSON (Normal)
    const data = await response.json();

    // Si Facturapi devuelve un error de negocio (RFC mal escrito, etc.), lo pasamos tal cual
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Si todo salió bien, enviamos el éxito
    return NextResponse.json(data);

  } catch (error) {
    // ==========================================
    // SOLUCIÓN "PUNTO MEDIO" (LOGS VS PRIVACIDAD)
    // ==========================================
    
    // 1. Log detallado en tu consola privada de Vercel/Servidor
    console.error(`[FleetForce Security Log] ID: #ERR-${errorId}`);
    console.error(`Mensaje: ${error.message}`);
    console.error(`Stack: ${error.stack}`);

    // 2. Respuesta "blindada" para el cliente
    return NextResponse.json({ 
      error: 'Falla crítica de comunicación interna.',
      mensaje: `Ha ocurrido un error técnico en el túnel de timbrado. Por favor, reporta este código a soporte para ayudarte: #ERR-${errorId}`
    }, { status: 500 });
  }
}