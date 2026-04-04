import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    // ==========================================
    // FASE 1: EL CADENERO EXIGE GAFETE (USUARIO)
    // ==========================================
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Acceso Denegado. Se requiere autenticación.' }, { status: 401 });
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
      return NextResponse.json({ error: 'Gafete inválido o expirado.' }, { status: 401 });
    }

    // ==========================================
    // FASE 2: BÚSQUEDA DE LLAVE MULTI-TENANT
    // ==========================================
    // A. Identificamos a la empresa del usuario
    const { data: perfilPeticionario, error: perfilError } = await supabaseAuth
      .from('perfiles')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (perfilError) {
      return NextResponse.json({ error: 'No se pudo verificar la identidad corporativa.' }, { status: 403 });
    }

    const idMaestro = perfilPeticionario?.empresa_id || user.id;

    // B. Extraemos la llave de Facturapi (Usamos la Llave Maestra por seguridad interna)
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
      return NextResponse.json({ error: 'Operación bloqueada: Tu empresa no tiene una llave de Facturapi configurada. Contacta a soporte.' }, { status: 403 });
    }

    // ==========================================
    // FASE 3: TIMBRADO EXCLUSIVO DEL CLIENTE
    // ==========================================
    const body = await request.json();
    const { endpoint, method, payload } = body;
    
    const url = `https://www.facturapi.io/v2/${endpoint}`;
    const options = {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyCliente}` // <--- TIMBRAMOS CON LA LLAVE DE SU BD
      }
    };

    if (payload && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/xml')) {
        const xmlText = await response.text();
        if (!response.ok) return NextResponse.json({ error: 'Error al descargar XML' }, { status: response.status });
        return new NextResponse(xmlText, { headers: { 'Content-Type': 'application/xml' } });
    }

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    return NextResponse.json(data);

} catch (error) {
    console.error("Error en túnel seguro multi-tenant:", error);
    return NextResponse.json({ 
      error: 'Falla de comunicación interna.',
      detalle_tecnico: error.message, // <--- ESTO REVELARÁ EL PROBLEMA EXACTO
      linea: error.stack
    }, { status: 500 });
  }
}