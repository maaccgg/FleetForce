import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // ==========================================
    // FASE 1: EL CADENERO EXIGE GAFETE
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
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Gafete inválido o expirado.' }, { status: 401 });
    }

    // ==========================================
    // FASE 2: VERIFICACIÓN DE RANGO (ADMIN)
    // ==========================================
    const { data: perfilPeticionario, error: perfilError } = await supabaseAuth
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (perfilError || perfilPeticionario?.rol !== 'administrador') {
      return NextResponse.json({ error: 'Intrusión bloqueada: Solo un administrador puede reenviar invitaciones.' }, { status: 403 });
    }

    // ==========================================
    // FASE 3: REENVÍO DE INVITACIÓN
    // ==========================================
    const { email } = await request.json();

    // Requerimos la llave maestra porque enviar correos de sistema es una acción de alto nivel
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Invitación reenviada con éxito.' }, { status: 200 });
  } catch (error) {
    console.error("Falla al reenviar invitación:", error);
    return NextResponse.json({ error: 'No se pudo reenviar la invitación.' }, { status: 400 });
  }
}