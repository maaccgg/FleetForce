'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; 
import { useTheme } from 'next-themes';
import { 
  LayoutDashboard, Wrench, FileCheck, Map, ReceiptText, Scale, Truck, LogOut,
  TrendingUp, Settings, History, ChevronDown, ChevronUp, Users, KeyRound, Lock, X,
  Eye, EyeOff, AlertTriangle, Loader2, Sun, Moon, Menu
} from 'lucide-react';

import { useToast } from '@/components/toastprovider';

const menuItems = [
  { name: 'Inicio', href: '/', icon: LayoutDashboard, roles: ['administrador', 'operaciones', 'facturacion', 'miembro'] },
  { name: 'Viajes', href: '/viajes', icon: FileCheck, roles: ['administrador', 'operaciones', 'miembro'] },
  { name: 'Facturas', href: '/facturas', icon: ReceiptText, roles: ['administrador', 'facturacion'] },
  { name: 'Gasto operativo', href: '/gastos', icon: TrendingUp, roles: ['administrador'] },
  { name: 'Unidades', href: '/unidades', icon: Truck, roles: ['administrador', 'operaciones', 'facturacion', 'miembro'] },
  { name: 'Info - SAT', href: '/sat', icon: Scale, roles: ['administrador', 'operaciones', 'facturacion', 'miembro'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { mostrarAlerta } = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [rolUsuario, setRolUsuario] = useState('miembro'); 
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [dialogoConfirmacion, setDialogoConfirmacion] = useState({ visible: false, mensaje: '', accion: null });
  const [mostrarModalPassword, setMostrarModalPassword] = useState(false);
  
  // === ESTADOS DE PASSWORD AJUSTADOS ===
  const [passwordActual, setPasswordActual] = useState(''); // <-- NUEVO
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
    const obtenerRol = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single();
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

  const confirmarAperturaPassword = () => {
    pedirConfirmacion("¿Deseas proceder con el cambio de tu clave de acceso?", () => {
      setMostrarModalPassword(true);
    });
  };

  const cambiarContrasena = async (e) => {
    e.preventDefault();

    if (nuevaPassword !== confirmarPassword) {
      mostrarAlerta("Las nuevas contraseñas no coinciden.", "error");
      return;
    }
    if (nuevaPassword.length < 8) { // Subimos a 8 por estándar de seguridad
      mostrarAlerta("La nueva contraseña debe ser de al menos 8 caracteres.", "error");
      return;
    }
    
    setLoadingPassword(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;

      // 1. RE-AUTENTICACIÓN: Validamos que el usuario conoce la contraseña actual
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: passwordActual,
      });

      if (authError) {
        throw new Error("La contraseña actual es incorrecta. Verifícala e intenta de nuevo.");
      }

      // 2. ACTUALIZACIÓN: Si la autenticación pasó, cambiamos la clave
      const { error: updateError } = await supabase.auth.updateUser({ password: nuevaPassword });
      
      if (updateError) throw updateError;

      mostrarAlerta("Contraseña actualizada con éxito. Tu cuenta está blindada.", "exito");
      setMostrarModalPassword(false);
      // Limpiar campos
      setPasswordActual('');
      setNuevaPassword('');
      setConfirmarPassword('');
      setVerPassword(false); 

    } catch (error) {
      mostrarAlerta(error.message, "error");
    } finally {
      setLoadingPassword(false);
    }
  };

  const menuPermitido = menuItems.filter(item => item.roles.includes(rolUsuario));

  if (!mounted) return <div className="w-64 h-screen border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 sticky top-0"></div>;

  return (
    <>
      <button 
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-md transition-colors"
      >
        <Menu size={24} className="text-slate-600 dark:text-slate-300" />
      </button>

      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <nav className={`
        fixed md:sticky top-0 left-0 z-40
        w-64 h-screen p-6 
        border-r border-slate-200 dark:border-slate-800 
        bg-slate-50 dark:bg-slate-950 
        flex flex-col gap-2 overflow-y-auto shrink-0 
        transition-all duration-300
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        <button 
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="mb-8 px-2 flex flex-col items-start select-none">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={28} className="text-emerald-500" strokeWidth={2} />
            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none transition-colors">
              Fleet<span className="font-bold text-slate-400 dark:text-slate-300">Force</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[9px] text-slate-500 dark:text-slate-600 font-bold uppercase ml-1 tracking-widest transition-colors">
              Gestión 2026
            </p>
            <span className="px-1.5 py-0.5 rounded-sm bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-black uppercase tracking-widest border border-slate-300 dark:border-slate-700 transition-colors">
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
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                  isActive 
                  ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <item.icon 
                  size={20} 
                  className={isActive ? 'text-blue-600 dark:text-blue-400' : 'group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'} 
                />
                <span className={`font-bold text-sm ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50 px-1 pb-2">
          <p className="text-[8px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest italic leading-relaxed px-2 mb-4">
            "Version BETA 1.0.1"
          </p>
          
          <div className="relative">
            {isConfigOpen && (
              <div className="absolute bottom-full left-0 mb-3 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                
                {rolUsuario === 'administrador' && (
                  <>
                    <Link href="/historico" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">
                      <History size={14} />
                      Revisar Históricos
                    </Link>
                    <Link href="/equipo" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">
                      <Users size={14} />
                      Gestionar Equipo
                    </Link>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                  </>
                )}
                
                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                  className="w-full flex items-center justify-between text-slate-600 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors text-left group"
                >
                  <span className="flex items-center gap-2">
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                  </span>
                </button>

                <button onClick={confirmarAperturaPassword} className="w-full flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors text-left">
                  <KeyRound size={14} />
                  Cambiar Contraseña
                </button>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>

                <button onClick={handleSignOut} className="w-full flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors text-left">
                  <LogOut size={14} />
                  Cerrar Sesión
                </button>
              </div>
            )}

            <button 
              onClick={() => setIsConfigOpen(!isConfigOpen)} 
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isConfigOpen 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'bg-transparent border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings size={15} className={isConfigOpen ? "animate-[spin_3s_linear_infinite]" : ""} />
                Configuración
              </div>
              {isConfigOpen ? <X size={14} /> : <ChevronUp size={14} />}
            </button>

          </div>
        </div>
      </nav>

      {/* DIÁLOGO CONFIRMACIÓN */}
      {dialogoConfirmacion.visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm" onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 transition-colors">
            <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32} /></div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest mb-2 transition-colors">¿Estás Seguro?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 transition-colors">{dialogoConfirmacion.mensaje}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Descartar</button>
              <button onClick={ejecutarConfirmacion} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-yellow-600 text-white hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-900/20">Sí, Proceder</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CAMBIO DE CONTRASEÑA BLINDADO */}
      {mostrarModalPassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm" onClick={() => setMostrarModalPassword(false)} />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 transition-colors">
            <button onClick={() => setMostrarModalPassword(false)} className="absolute top-6 right-6 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={20} /></button>
            
            <h2 className="text-xl font-black text-slate-800 dark:text-white italic uppercase mb-6 flex items-center gap-2 transition-colors">
              <Lock className="text-emerald-500" size={20}/> 
              Seguridad de <span className="text-emerald-500">Acceso</span>
            </h2>
            
            <form onSubmit={cambiarContrasena} className="space-y-4">
              {/* CAMPO: CONTRASEÑA ACTUAL (BLINDAJE) */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Contraseña Actual</label>
                <input 
                  required 
                  type="password" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-800 dark:text-white focus:border-emerald-500 outline-none transition-all" 
                  value={passwordActual} 
                  onChange={e => setPasswordActual(e.target.value)}
                  
                />
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>

              <div className="relative">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Nueva Contraseña</label>
                <input 
                  required 
                  type={verPassword ? "text" : "password"}  
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-800 dark:text-white focus:border-emerald-500 outline-none transition-all pr-12 transition-colors" 
                  value={nuevaPassword} 
                  onChange={e => setNuevaPassword(e.target.value)} 
                  placeholder="Mínimo 8 caracteres"
                />
                <button 
                  type="button" 
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-4 top-[38px] text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Confirmar Nueva Contraseña</label>
                <input 
                  required 
                  type={verPassword ? "text" : "password"} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm text-slate-800 dark:text-white focus:border-emerald-500 outline-none transition-all pr-12 transition-colors" 
                  value={confirmarPassword} 
                  onChange={e => setConfirmarPassword(e.target.value)} 
                  placeholder="Repite la clave nueva"
                />
              </div>

              <button type="submit" disabled={loadingPassword} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all mt-6 flex justify-center items-center gap-2">
                {loadingPassword ? <Loader2 size={16} className="animate-spin" /> : null}
                {loadingPassword ? "Autenticando..." : "Actualizar Credencial"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}