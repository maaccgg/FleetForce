// Archivo: components/ToastProvider.js
'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

// 1. Creamos el contexto
const ToastContext = createContext();

// 2. Creamos el Proveedor que envolverá la App
export function ToastProvider({ children }) {
  const [alertaUI, setAlertaUI] = useState({ visible: false, mensaje: '', tipo: 'info' });

  const mostrarAlerta = useCallback((mensaje, tipo = 'error') => {
    setAlertaUI({ visible: true, mensaje, tipo });
    // Se oculta automáticamente a los 5 segundos
    setTimeout(() => setAlertaUI({ visible: false, mensaje: '', tipo: 'info' }), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ mostrarAlerta }}>
      {children}
      
      {/* EL DISEÑO GLOBAL SE RENDERIZA AQUÍ, UNA SOLA VEZ PARA TODA LA APP */}
      {alertaUI.visible && (
        <div className={`fixed top-8 right-8 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-md max-w-sm 
          ${alertaUI.tipo === 'exito' 
            ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-100 shadow-emerald-900/20' 
            : 'bg-red-950/80 border-red-500/30 text-red-100 shadow-red-900/20'
          }`}
        >
          {alertaUI.tipo === 'exito' 
            ? <CheckCircle size={20} className="text-emerald-500 shrink-0" /> 
            : <AlertTriangle size={20} className="text-red-500 shrink-0" />
          }
          <p className="text-xs font-medium tracking-wide whitespace-pre-wrap">{alertaUI.mensaje}</p>
          <button 
            onClick={() => setAlertaUI({ ...alertaUI, visible: false })} 
            className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// 3. Exportamos un "Hook" personalizado para usarlo fácilmente en cualquier página
export const useToast = () => useContext(ToastContext);