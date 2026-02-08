"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TarjetaDato from '@/components/tarjetaDato';

export default function Page() {
  const [conteoUnidades, setConteoUnidades] = useState(0); 
  const [totalIngresos, setTotalIngresos] = useState(0); 
  const [sesion, setSesion] = useState(null);
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState(""); 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSesion(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSesion(session));
    return () => subscription.unsubscribe();
  }, []);

  async function iniciarSesion(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Acceso denegado");
  }

  async function obtenerMetricas() {
    // 1. Contar Unidades
    const { count } = await supabase.from('unidades').select('*', { count: 'exact', head: true });
    setConteoUnidades(count || 0);

    // 2. Sumar Ingresos
    const { data } = await supabase.from('facturas').select('monto_total');
    if (data) {
      const suma = data.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0);
      setTotalIngresos(suma);
    }
  }

  useEffect(() => {
    if (!sesion) return; 
    obtenerMetricas();

    const canal = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, () => obtenerMetricas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => obtenerMetricas())
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [sesion]);

  if (!sesion) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <form onSubmit={iniciarSesion} className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-full max-w-md shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-blue-500 italic uppercase tracking-tighter text-center">Ingresa tu usuario</h2>
          <input type="email" placeholder="Correo" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg mb-4 outline-none focus:border-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg mb-6 outline-none focus:border-blue-500" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold transition-all uppercase tracking-widest">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <main className="p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white">
              SISTEMA <span className="text-blue-600">CENTRAL</span>
            </h1>
            <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-[0.3em]">Institución de Logística Marco Cantu</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-[10px] font-black bg-slate-900 hover:bg-red-950 text-slate-500 hover:text-red-400 px-4 py-2 rounded-xl border border-slate-800 transition-all uppercase tracking-widest">
            Desconectar
          </button>
        </header>

        {/* MÉTRICAS DE IMPACTO PARA EL PMV */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <TarjetaDato titulo="Flota Operativa" valor={conteoUnidades.toString()} color="blue" />
          <TarjetaDato titulo="Cobranza Total" valor={`$${totalIngresos.toLocaleString()}`} color="green" />
          <TarjetaDato titulo="Meta Consolidación" valor="$60,000" color="slate" />
        </div>
      </div>
    </main>
  );
}