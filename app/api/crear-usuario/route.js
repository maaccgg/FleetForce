import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Whitelist de roles válidos del sistema
const schemaCrearUsuario = z.object({
  email: z.string().email({ message: 'El email no es válido.' }),
  nombre_completo: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }).max(120),
  rol: z.enum(['administrador', 'operador', 'visualizador'], {
    errorMap: () => ({ message: 'Rol inválido. Valores permitidos: administrador, operador, visualizador.' })
  }),
});

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
    )
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Gafete inválido o expirado.' }, { status: 401 });
    }

    // ==========================================
    // FASE 2: VERIFICACIÓN DE RANGO (ADMIN)
    // ==========================================
    const { data: perfilPeticionario, error: perfilError } = await supabaseAuth
      .from('perfiles')
      .select('rol, empresa_id')
      .eq('id', user.id)
      .single();

    if (perfilError || perfilPeticionario?.rol !== 'administrador') {
      return NextResponse.json({ error: 'Intrusión bloqueada: Solo un administrador puede crear usuarios.' }, { status: 403 });
    }

    // ==========================================
    // FASE 3: INVITACIÓN SEGURA (Sin pedir contraseña inicial)
    // ==========================================
    const body = await request.json();

    // Validar y sanear los datos del body con Zod
    const parsed = schemaCrearUsuario.safeParse(body);
    if (!parsed.success) {
      const mensajeError = parsed.error.errors.map(e => e.message).join(' ');
      return NextResponse.json({ error: mensajeError }, { status: 400 });
    }

    const { email, nombre_completo, rol } = parsed.data;
    
    const idDeLaEmpresaFija = perfilPeticionario.empresa_id || user.id;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Disparar el correo de invitación (Supabase genera el token)
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) throw inviteError;

    // 2. Crear el perfil con el estatus "registro_completado: false" por defecto
    const { error: insertPerfilError } = await supabaseAdmin.from('perfiles').insert([
      {
        id: authData.user.id,
        email: email,
        nombre_completo: nombre_completo,
        rol: rol,
        empresa_id: idDeLaEmpresaFija
      }
    ]);

    if (insertPerfilError) throw insertPerfilError;

    return NextResponse.json({ success: true, message: 'Invitación enviada al correo del usuario.' }, { status: 200 });

  } catch (error) {
    console.error("Falla en creación de usuario/invitación:", error);
    return NextResponse.json({ error: 'No se pudo crear el usuario.' }, { status: 400 });
  }
}