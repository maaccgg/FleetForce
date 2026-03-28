import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}