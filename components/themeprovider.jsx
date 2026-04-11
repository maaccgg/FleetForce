// components/ThemeProvider.jsx
'use client'; // Indispensable porque usa el estado del navegador

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeProvider({ children }) {
  const [mounted, setMounted] = useState(false);

  // Este efecto asegura que el componente solo se renderice 
  // una vez que el cliente (navegador) está listo.
  // Esto evita errores de parpadeo visual al cargar la página.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Mientras se monta, mostramos el contenido sin el proveedor
    // para evitar errores de hidratación.
    return <>{children}</>;
  }

  return (
    <NextThemesProvider 
      attribute="class"    // Esto inyectará la clase "dark" en el HTML
      defaultTheme="dark"  // FleetForce nace siendo oscuro por ADN
      enableSystem={false} // Ignoramos la config del sistema para dar control total al usuario
    >
      {children}
    </NextThemesProvider>
  );
}