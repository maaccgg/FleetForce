"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Lock, Truck, Loader2, AlertTriangle } from 'lucide-react';

export default function Bienvenida() {
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);
  
  // === NUEVOS ESTADOS DE SEGURIDAD ===
  const [sesionValida, setSesionValida] = useState(false);
  const [verificando, setVerificando] = useState(true);
  
  const router = useRouter();

  useEffect(() => {
    const verificarSesion = async () => {
      // 1. Revisar si el link trajo una sesión válida
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setSesionValida(true);
        setVerificando(false);
      } else {
        // 2. A veces Supabase tarda unos milisegundos en leer el URL
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) setSesionValida(true);
          setVerificando(false);
        });

        // 3. Fallback: Si después de 1.5 segundos no detecta nada, el link expiró
        setTimeout(() => {
          setVerificando(false);
        }, 4000);

        return () => subscription.unsubscribe();
      }
    };

    verificarSesion();
  }, []);

  const manejarActualizacion = async (e) => {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (password.length < 6) {
      setError('🛑 La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmarPassword) {
      setError('🛑 Las contraseñas no coinciden. Verifica e intenta de nuevo.');
      return;
    }

    setCargando(true);

    try {
      const { data: authData, error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      if (authData?.user) {
        await supabase.from('perfiles')
          .update({ registro_completado: true, activo: true })
          .eq('id', authData.user.id);
      }

      setMensaje('✅ Credencial establecida con éxito. Redirigiendo a tu Institución...');
      
      setTimeout(() => {
        router.push('/'); 
      }, 2000);

    } catch (err) {
      console.error("Error al actualizar contraseña:", err);
      setError(err.message || 'Ocurrió un error al intentar guardar la contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full relative z-10 bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl">
        
        <div className="text-center mb-10">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Truck size={36} className="text-emerald-500" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none uppercase italic mb-2">
            Fleet<span className="text-slate-300">Force</span>
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Establece tu credencial de acceso
          </p>
        </div>

        {/* ESCUDO DE VALIDACIÓN VISUAL */}
        {verificando ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Validando llave de seguridad...</p>
          </div>
        ) : !sesionValida ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
            <AlertTriangle size={32} className="text-red-500 mb-3" />
            <p className="text-red-400 text-[11px] font-black uppercase tracking-widest mb-2">Enlace Inválido o Expirado</p>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Por seguridad, los enlaces de invitación son de un solo uso. Si recargaste la página o ya usaste este enlace, ha sido destruido.
              <br/><br/>Solicita a tu administrador que te reenvíe el acceso.
            </p>
          </div>
        ) : (
          <form className="space-y-6 animate-in fade-in" onSubmit={manejarActualizacion}>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nueva Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 text-slate-500" size={16} />
                  <input type="password" required placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 pl-12 p-3.5 rounded-2xl text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Confirmar Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 text-slate-500" size={16} />
                  <input type="password" required placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 pl-12 p-3.5 rounded-2xl text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-[11px] uppercase tracking-widest font-bold bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-center">
                {error}
              </div>
            )}

            {mensaje && (
              <div className="text-emerald-400 text-[11px] uppercase tracking-widest font-bold bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                {mensaje}
              </div>
            )}

            <button type="submit" disabled={cargando}
              className={`w-full flex justify-center items-center gap-2 py-4 border border-transparent text-[11px] font-black uppercase tracking-widest rounded-xl text-white bg-blue-600 hover:bg-blue-500 focus:outline-none transition-all shadow-xl shadow-blue-900/20 ${cargando ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {cargando ? 'Guardando...' : 'Establecer y Entrar'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}