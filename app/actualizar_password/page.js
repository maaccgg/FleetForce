"use client";

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function ActualizarPassword() {
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const manejarActualizacion = async (e) => {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden. Verifica e intenta de nuevo.');
      return;
    }

    setCargando(true);

    try {
      // 1. Guardamos la nueva contraseña en la bóveda de seguridad
      const { data: authData, error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // 2. Marcamos el perfil como "Activo" en la tabla pública
      if (authData?.user) {
        await supabase.from('perfiles')
          .update({ registro_completado: true })
          .eq('id', authData.user.id);
      }

      setMensaje('Contraseña actualizada con éxito. Redirigiendo a tu panel...');
      
      // Redirección táctica al sistema operativo
      setTimeout(() => {
        router.push('/dashboard'); 
      }, 2000);

    } catch (err) {
      console.error("Error al actualizar contraseña:", err);
      setError(err.message || 'Ocurrió un error al intentar guardar la contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Establece tu contraseña
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingresa una clave segura para acceder a tu cuenta corporativa.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={manejarActualizacion}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva Contraseña
              </label>
              <input
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="••••••••"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded-md border border-red-200">
              {error}
            </div>
          )}

          {mensaje && (
            <div className="text-green-600 text-sm font-medium bg-green-50 p-3 rounded-md border border-green-200">
              {mensaje}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={cargando}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                cargando ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {cargando ? 'Guardando...' : 'Guardar y Entrar'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}