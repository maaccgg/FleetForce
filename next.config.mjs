/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Evita que la app sea embebida en iframes de otros dominios (clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Evita que el navegador "adivine" el tipo de contenido (MIME sniffing)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Fuerza HTTPS por 1 año en producción
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // No envía el referrer al salir de la app
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Deshabilita funciones del navegador que no se usan
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Política de contenido: solo carga recursos del propio dominio y servicios conocidos
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-eval solo en desarrollo (Next.js lo requiere en dev, no en producción)
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
              "style-src 'self' 'unsafe-inline'",
              // api.qrserver.com: generación de QR para Carta Porte y Facturas (PDF)
              "img-src 'self' data: blob: https://api.qrserver.com",
              "font-src 'self'",
              // api.qrserver.com: fetch() del QR en PdfCartaPorte.js y PdfFactura.js
              "connect-src 'self' https://*.supabase.co https://www.facturapi.io https://api.qrserver.com",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
