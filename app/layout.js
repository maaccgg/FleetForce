import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// IMPORTACIONES DE PROVEEDORES GLOBALES
import { ToastProvider } from "@/components/toastprovider"; 
import { ThemeProvider } from "@/components/themeprovider"; // <-- NUEVO

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "FleetForce",
  description: "Gestión de flotas eficiente y sin complicaciones",
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning es vital para que next-themes no genere errores al leer el tema del sistema
    <html lang="es" suppressHydrationWarning>
      {/* 🛑 Eliminamos bg-slate-950 y text-slate-200. globals.css ahora manda. */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex`}>
        
        {/* ENVOLVEMOS TODO EN EL TEMA PRIMERO */}
        <ThemeProvider>
          <ToastProvider>
            
            {/* Lado Derecho: Contenido Dinámico */}
            {/* 🛑 También quitamos el bg-slate-950 de aquí */}
            <main className="flex-1 h-screen overflow-y-auto relative">
              <div className="min-h-full">
                {children}
              </div>
            </main>

          </ToastProvider>
        </ThemeProvider>

      </body>
    </html>
  );
}