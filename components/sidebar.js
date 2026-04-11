'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; 
import { 
  LayoutDashboard, 
  Wrench, 
  FileCheck, 
  Map, 
  ReceiptText, 
  Scale, 
  Truck,
  LogOut,
  TrendingUp,
  Settings,
  History,
  ChevronDown,
  ChevronUp,
  Users,
  KeyRound,
  Lock,
  X,
  Eye,      
  EyeOff,
  AlertTriangle, // <-- Añadido para el modal
  Loader2        // <-- Añadido por consistencia
} from 'lucide-react';

// === SISTEMA DE ALERTAS ===
import { useToast } from '@/components/toastprovider';

// === DICCIONARIO DE RUTAS Y PERMISOS ===
const menuItems = [
  { name: 'Inicio', href: '/', icon: LayoutDashboard, roles: ['administrador', 'operaciones', 'facturacion', 'miembro'] },
  { name: 'Viajes', href: '/viajes', icon: FileCheck, roles: ['administrador', 'operaciones', 'miembro'] },
  { name: 'Facturas', href: '/facturas', icon: ReceiptText, roles: ['administrador', 'facturacion'] },
  { name: 'Gasto operativo', href: '/gastos', icon: TrendingUp, roles: ['administrador',] },
  { name: 'Unidades', href: '/unidades', icon: Truck, roles: ['administrador', 'operaciones', 'facturacion', 'miembro'] },
  { name: 'Info - SAT', href: '/sat', icon: Scale, roles: ['administrador', 'operaciones', 'facturacion', 'miembro'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { mostrarAlerta } = useToast();
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [rolUsuario, setRolUsuario] = useState('miembro'); 

  // === ESTADOS PARA MODAL DE CONFIRMACIÓN ===
  const [dialogoConfirmacion, setDialogoConfirmacion] = useState({ visible: false, mensaje: '', accion: null });

  // === ESTADOS PARA CAMBIO DE CONTRASEÑA ===
  const [mostrarModalPassword, setMostrarModalPassword] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    const obtenerRol = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();
        
        if (data?.rol) setRolUsuario(data.rol);
      }
    };
    obtenerRol();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; 
  };

  const pedirConfirmacion = (mensaje, accion) => setDialogoConfirmacion({ visible: true, mensaje, accion });
  const ejecutarConfirmacion = async () => { 
    if (dialogoConfirmacion.accion) await dialogoConfirmacion.accion(); 
    setDialogoConfirmacion({ visible: false, mensaje: '', accion: null }); 
  };

  // 1. PREGUNTA DE SEGURIDAD ANTES DE ABRIR MODAL CON NUEVA LÓGICA
  const confirmarAperturaPassword = () => {
    pedirConfirmacion("¿Estás seguro de que deseas cambiar tu contraseña actual?", () => {
      setMostrarModalPassword(true);
    });
  };

  const cambiarContrasena = async (e) => {
    e.preventDefault();
    if (nuevaPassword !== confirmarPassword) {
      mostrarAlerta("Las contraseñas no coinciden.", "error");
      return;
    }
    if (nuevaPassword.length < 6) {
      mostrarAlerta("La contraseña debe tener al menos 6 caracteres por seguridad.", "error");
      return;
    }
    
    setLoadingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
    
    if (error) {
      mostrarAlerta("Error al actualizar: " + error.message, "error");
    } else {
      mostrarAlerta("Contraseña actualizada con éxito. Tu cuenta está segura.", "exito");
      setMostrarModalPassword(false);
      setNuevaPassword('');
      setConfirmarPassword('');
      setVerPassword(false); 
    }
    setLoadingPassword(false);
  };

  const menuPermitido = menuItems.filter(item => item.roles.includes(rolUsuario));

  return (
    <>
      <nav className="w-64 h-screen p-6 border-r border-slate-800 bg-slate-950 flex flex-col gap-2 sticky top-0 overflow-y-auto shrink-0 z-40">
        
        <div className="mb-8 px-2 flex flex-col items-start select-none">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={28} className="text-emerald-500" strokeWidth={2} />
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">
              Fleet<span className="font-bold text-slate-300">Force</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[9px] text-slate-600 font-bold uppercase ml-1 tracking-widest">
              Gestión 2026
            </p>
            <span className="px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400 text-[8px] font-black uppercase tracking-widest border border-slate-700">
              {rolUsuario}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          {menuPermitido.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                  isActive 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <item.icon 
                  size={20} 
                  className={isActive ? 'text-blue-400' : 'group-hover:text-blue-400 transition-colors'} 
                />
                <span className={`font-bold text-sm ${isActive ? 'text-blue-400' : ''}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pt-6 border-t border-slate-800/50 px-1 space-y-4 pb-2">
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest italic leading-relaxed px-2">
            "Version BETA 1.0.1"
          </p>
          
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setIsConfigOpen(!isConfigOpen)} 
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isConfigOpen ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
            >
              <div className="flex items-center gap-2">
                <Settings size={14} className={isConfigOpen ? "text-blue-400" : ""} />
                Configuración
              </div>
              {isConfigOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isConfigOpen && (
              <div className="flex flex-col gap-1 pl-2 border-l-2 border-slate-800 ml-2 animate-in fade-in slide-in-from-top-2">
                
                {rolUsuario === 'administrador' && (
                  <>
                    <Link href="/historico" className="flex items-center gap-2 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                      <History size={14} />
                      Revisar Históricos
                    </Link>
                    <Link href="/equipo" className="flex items-center gap-2 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                      <Users size={14} />
                      Gestionar Equipo
                    </Link>
                  </>
                )}
                
                <button onClick={confirmarAperturaPassword} className="w-full flex items-center gap-2 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors text-left">
                  <KeyRound size={14} />
                  Cambiar Contraseña
                </button>

                <button onClick={handleSignOut} className="w-full flex items-center gap-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors text-left">
                  <LogOut size={14} />
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* MODAL DE CONFIRMACIÓN CUSTOM */}
      {/* ========================================================= */}
      {dialogoConfirmacion.visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} />
          <div className="relative bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32} /></div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">¿Estás Seguro?</h3>
            <p className="text-slate-400 text-sm mb-8">{dialogoConfirmacion.mensaje}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">Descartar</button>
              <button onClick={ejecutarConfirmacion} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-yellow-600 text-white hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-900/20">Sí, Proceder</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE CAMBIO DE CONTRASEÑA */}
      {/* ========================================================= */}
      {mostrarModalPassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setMostrarModalPassword(false)} />
          <div className="relative bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95">
            <button onClick={() => setMostrarModalPassword(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X size={20} /></button>
            
            <h2 className="text-xl font-black text-white italic uppercase mb-6 flex items-center gap-2">
              <Lock className="text-emerald-500" size={20}/> 
              Seguridad de <span className="text-emerald-500">Acceso</span>
            </h2>
            
            <form onSubmit={cambiarContrasena} className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nueva Contraseña</label>
                <input 
                  required 
                  type={verPassword ? "text" : "password"}  
                  className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white focus:border-emerald-500 outline-none transition-all pr-12" 
                  value={nuevaPassword} 
                  onChange={e => setNuevaPassword(e.target.value)} 
                />
                <button 
                  type="button" 
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-4 top-[38px] text-slate-600 hover:text-slate-300 transition-colors"
                >
                  {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Confirmar Contraseña</label>
                <input 
                  required 
                  type={verPassword ? "text" : "password"} 
                  className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white focus:border-emerald-500 outline-none transition-all pr-12" 
                  value={confirmarPassword} 
                  onChange={e => setConfirmarPassword(e.target.value)} 
                />
              </div>

              <button type="submit" disabled={loadingPassword} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all mt-6 flex justify-center items-center gap-2">
                {loadingPassword ? <Loader2 size={16} className="animate-spin" /> : null}
                {loadingPassword ? "Procesando..." : "Actualizar Credencial"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}