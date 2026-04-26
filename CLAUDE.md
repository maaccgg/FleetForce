# FleetForce MX — CLAUDE.md

## Proyecto
SaaS de gestión de flotillas para el mercado mexicano. Permite gestionar viajes, unidades, gastos, facturación SAT y equipo, con soporte offline-first.

## Stack
- **Framework:** Next.js 16 (App Router) + React 19
- **Backend/Auth/DB:** Supabase (PostgreSQL 17 + Auth + Realtime)
- **Estilos:** Tailwind CSS 4, dark mode via clase `.dark`
- **Offline:** Dexie (IndexedDB) — `lib/db.js`
- **PDF:** jsPDF + jspdf-autotable — `utils/PdfFactura.js`, `utils/PdfCartaPorte.js`
- **Facturación:** FacturaAPI (integración SAT México)
- **Iconos:** lucide-react
- **Validación:** Zod
- **Temas:** next-themes

## Estructura de directorios
```
app/                  # Next.js App Router
  api/                # Rutas API (server-side)
    crear-usuario/
    facturapi/
    reenviar-invitacion/
    webhooks/facturapi/
  (dashboard)/        # Grupo de rutas del dashboard
  bienvenida/
  equipo/
  facturas/
  Finanzas/
  gastos/
  historico/
  rutas/
  sat/
  unidades/
  viajes/
    [id]/             # Detalle de viaje (ruta dinámica)
  layout.js           # Root layout — ThemeProvider + ToastProvider
  page.js             # Dashboard principal
components/
  sidebar.js
  OfflineBanner.js
  tarjetaDato.js
  themeprovider.jsx
  toastprovider.js
lib/
  supabaseClient.js   # Cliente Supabase (singleton)
  fetchSafe.js        # fetch con soporte offline
  notifyOffline.js
  db.js               # Dexie — IndexedDB config
utils/
  PdfFactura.js
  PdfCartaPorte.js
public/
  logo-fleetforce.png
  Fleet/
  Icons/
supabase/
  config.toml         # Config local Supabase
  migrations/
```

## Convenciones
- Alias de rutas: `@/*` apunta a la raíz del proyecto.
- Páginas en español: nombres de rutas y variables en español.
- Todas las páginas son Client Components (`"use client"`) salvo las rutas API.
- Las rutas API (`app/api/*`) son Server-side y usan `@supabase/ssr`.
- No usar `console.log` en producción; usar el sistema de toast (`toastprovider.js`).

## Seguridad
- Headers configurados en `next.config.mjs`: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- CSP permite: Supabase API, FacturaAPI, qrserver.com.
- No exponer variables de entorno al cliente salvo las prefijadas con `NEXT_PUBLIC_`.

## Variables de entorno relevantes
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FACTURAPI_KEY
```

## Scripts
```bash
npm run dev     # Desarrollo en localhost:3000
npm run build   # Build de producción
npm run lint    # ESLint
```

## Reglas para Claude
- No modificar lógica de negocio existente salvo que se pida explícitamente.
- No cambiar el diseño visual ni la estructura de componentes sin instrucción.
- No agregar dependencias sin preguntar.
- No crear archivos de documentación innecesarios.
- Mantener el idioma español en nombres de rutas, variables y UI.
- Respetar los headers de seguridad definidos en `next.config.mjs`.
- Ante dudas, preguntar antes de actuar.
