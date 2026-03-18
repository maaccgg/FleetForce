import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, nombre_completo, rol, empresa_id } = body;

    // Iniciamos Supabase con la LLAVE MAESTRA (bypasses RLS y no cierra tu sesión)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Crear la credencial de acceso (Bóveda de Auth)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Confirmado automáticamente
    });

    if (authError) throw authError;

    // 2. Crear su perfil operativo asociado a tu Institución
    const { error: perfilError } = await supabaseAdmin.from('perfiles').insert([
      {
        id: authData.user.id,
        email: email,
        nombre_completo: nombre_completo,
        rol: rol,
        empresa_id: empresa_id
      }
    ]);

    if (perfilError) throw perfilError;

    return NextResponse.json({ success: true, message: 'Usuario creado con éxito' }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}