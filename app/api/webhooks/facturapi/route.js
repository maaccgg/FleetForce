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
    const payload = await req.json();

    // 1. EVENTO: FACTURA TIMBRADA
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

    // 2. EVENTO: FACTURA CANCELADA DESDE EL SAT O DESDE FACTURAPI DIRECTAMENTE
    if (payload.type === 'invoice.canceled') {
      const facturapiId = payload.data.invoice.id;
      
      await supabaseAdmin
        .from('facturas')
        .update({ estatus_pago: 'Cancelada' })
        .eq('facturapi_id', facturapiId);
    }

    // 3. RESPUESTA RÁPIDA: Facturapi necesita un OK (200) para saber que el mensaje llegó.
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error("Error crítico en Webhook de Facturapi:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}