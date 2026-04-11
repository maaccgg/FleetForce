"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { 
  Lock, Truck, Loader2, AlertTriangle, 
  CheckCircle2, Eye, EyeOff 
} from 'lucide-react';

export default function Bienvenida() {
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);
  
  // Estados de Visibilidad y Validación
  const [verPassword, setVerPassword] = useState(false);
  const [sesionValida, setSesionValida] = useState(false);
  const [verificando, setVerificando] = useState(true);
  
  const router = useRouter();

  useEffect(() => {
    // Escuchamos el evento de recuperación de sesión del enlace
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSesionValida(true);
        setVerificando(false);
      }
    });

    // Tiempo de espera de seguridad (5 seg) antes de dar el link por muerto
    const timer = setTimeout(() => {
      setVerificando(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const manejarActualizacion = async (e) => {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (password.length < 8) {
      setError('🛑 Por seguridad, la contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmarPassword) {
      setError('🛑 Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);

    try {
      const { data: authData, error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      if (authData?.user) {
        // Actualizamos el estado en la tabla de perfiles
        await supabase.from('perfiles')
          .update({ registro_completado: true, activo: true })
          .eq('id', authData.user.id);
      }

      setMensaje('✅ Credencial establecida con éxito. Redirigiendo...');
      setTimeout(() => { router.push('/'); }, 2500);

    } catch (err) {
      setError(err.message || 'Error al intentar guardar la contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 relative overflow-hidden transition-colors duration-500">
      {/* Efectos de fondo adaptativos */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/10 dark:bg-blue-600/10 rounded-full blur-3xl transition-colors"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-600/10 dark:bg-emerald-600/10 rounded-full blur-3xl transition-colors"></div>

      <div className="max-w-md w-full relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 sm:p-10 rounded-[2.5rem] shadow-xl dark:shadow-2xl transition-all">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
            <Truck size={32} className="text-emerald-600 dark:text-emerald-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic leading-none transition-colors">
            Fleet<span className="text-blue-600 dark:text-slate-300">Force</span>
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest font-bold mt-2 transition-colors">
            Configuración de Acceso Institucional
          </p>
        </div>

        {verificando ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 size={32} className="text-blue-600 dark:text-blue-500 animate-spin mb-4" />
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest text-center">
              Sincronizando llave de seguridad...
            </p>
          </div>
        ) : !sesionValida ? (
          <div className="flex flex-col items-center py-8 px-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-3xl text-center animate-in fade-in slide-in-from-bottom-4 transition-colors">
            <AlertTriangle size={32} className="text-red-600 dark:text-red-500 mb-3" />
            <p className="text-red-700 dark:text-red-400 text-[11px] font-black uppercase tracking-widest mb-2">Enlace Inválido o Expirado</p>
            <p className="text-slate-500 dark:text-slate-500 text-[10px] leading-relaxed">
              Por seguridad, estos enlaces son de un solo uso. Si ya completaste tu registro o el tiempo expiró, solicita un nuevo acceso a tu administrador.
            </p>
          </div>
        ) : (
          <form className="space-y-6 animate-in fade-in duration-500" onSubmit={manejarActualizacion}>
            <div className="space-y-4">
              {/* Campo: Password */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Nueva Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={16} />
                  <input 
                    type={verPassword ? "text" : "password"} 
                    required 
                    placeholder="Contraseña robusta"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pl-12 pr-12 p-4 rounded-2xl text-sm text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-emerald-500 outline-none transition-all font-mono"
                    value={password} onChange={(e) => setPassword(e.target.value)} 
                  />
                  <button 
                    type="button"
                    onClick={() => setVerPassword(!verPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              {/* Campo: Confirmar Password */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Confirmar Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={16} />
                  <input 
                    type={verPassword ? "text" : "password"} 
                    required 
                    placeholder="Repite tu contraseña"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pl-12 pr-12 p-4 rounded-2xl text-sm text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-emerald-500 outline-none transition-all font-mono"
                    value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-700 dark:text-red-400 text-[10px] font-black uppercase bg-red-50 dark:bg-red-500/10 p-4 rounded-xl border border-red-100 dark:border-red-500/20 text-center animate-shake transition-colors">
                {error}
              </div>
            )}
            
            {mensaje && (
              <div className="text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20 text-center transition-colors">
                {mensaje}
              </div>
            )}

            <button type="submit" disabled={cargando}
              className={`w-full flex justify-center items-center gap-2 py-4 text-[11px] font-black uppercase tracking-widest rounded-2xl text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 active:scale-95 ${cargando ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {cargando ? 'Sincronizando...' : 'Establecer y Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}