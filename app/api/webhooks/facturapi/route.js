import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// Usamos la llave maestra (SERVICE ROLE) porque esta petición viene de un servidor externo (Facturapi),
// no de un usuario logueado en tu app. Esto nos da permiso de escribir en la BD.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Comparación en tiempo constante: evita que un atacante adivine el secreto
// midiendo cuánto tarda el servidor en responder (timing attack).
// timingSafeEqual siempre tarda exactamente lo mismo, sin importar si el token
// coincide en 0 o en 99 caracteres.
function verificarToken(tokenRecibido) {
  const secreto = process.env.WEBHOOK_SECRET_FACTURAPI;

  // Si falta el secreto en las variables de entorno, bloqueamos todo
  if (!secreto || !tokenRecibido) return false;

  // timingSafeEqual requiere que ambos Buffers tengan el mismo tamaño.
  // Si no coinciden en longitud, ya sabemos que son distintos — pero aun así
  // comparamos contra el secreto para no filtrar información por tiempo.
  const bufRecibido = Buffer.from(tokenRecibido, 'utf8');
  const bufSecreto  = Buffer.from(secreto,        'utf8');

  if (bufRecibido.length !== bufSecreto.length) return false;

  return timingSafeEqual(bufRecibido, bufSecreto);
}

export async function POST(req) {
  try {

    // 1. EL ESCUDO DE SEGURIDAD
    // Facturapi no soporta headers personalizados, el secreto viaja como query param.
    // El valor viene de la variable de entorno WEBHOOK_SECRET_FACTURAPI en Vercel.
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!verificarToken(token)) {
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
