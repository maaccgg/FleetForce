import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";


// 1. IMPORTAMOS EL SISTEMA GLOBAL DE ALERTAS
import { ToastProvider } from "../components/toastprovider"; 

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
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-200 flex`}
      >
        {/* 2. ENVOLVEMOS LA APLICACIÓN CON EL PROVEEDOR */}
        <ToastProvider>
          {/* Lado Derecho: Contenido Dinámico */}
          <main className="flex-1 h-screen overflow-y-auto relative bg-slate-950">
            {/* Añadimos un contenedor interno con padding para que 
                el contenido de cada página no choque con los bordes 
            */}
            <div className="min-h-full">
              {children}
            </div>
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}