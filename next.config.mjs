/** @type {import('next').NextConfig} */
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
          // Política básica de contenido: solo carga recursos del propio dominio y servicios conocidos
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval requerido por Next.js en dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://www.facturapi.io",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
