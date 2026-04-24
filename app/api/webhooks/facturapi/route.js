import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos la llave maestra (SERVICE ROLE) porque esta petición viene de un servidor externo (Facturapi),
// no de un usuario logueado en tu app. Esto nos da permiso de escribir en la BD.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {

    // 1. EL ESCUDO DE SEGURIDAD
    // Facturapi no soporta headers personalizados, el secreto viaja como query param.
    // El valor viene de la variable de entorno WEBHOOK_SECRET_FACTURAPI en Vercel.
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (token !== process.env.WEBHOOK_SECRET_FACTURAPI) {
      return NextResponse.json({ error: 'Acceso no autorizado al Webhook' }, { status: 401 });
    }

    const payload = await req.json();

    // 2. EVENTO: FACTURA TIMBRADA
    if (payload.type === 'invoice.stamped') {
      const facturapiId = payload.data.invoice.id;
      const uuidSat = payload.data.invoice.uuid;
      
      await supabaseAdmin
        .from('facturas')
        .update({ 
            estatus_pago: 'Timbrada', 
            folio_fiscal: uuidSat 
        })
        .eq('facturapi_id', facturapiId);
    }

    // 3. EVENTO: FACTURA CANCELADA DESDE EL SAT O DESDE FACTURAPI DIRECTAMENTE
    if (payload.type === 'invoice.canceled') {
      const facturapiId = payload.data.invoice.id;
      
      await supabaseAdmin
        .from('facturas')
        .update({ estatus_pago: 'Cancelada' })
        .eq('facturapi_id', facturapiId);
    }

    // 4. RESPUESTA RAPIDA: Facturapi necesita un OK (200) para saber que el mensaje llego.
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error("Error critico en Webhook de Facturapi:", error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
