"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TarjetaDato from '@/components/tarjetaDato';
import Sidebar from '@/components/sidebar';
import { Bell, Calendar, DollarSign, TrendingUp, AlertTriangle, ChevronRight, Search, ChevronDown, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const [metricas, setMetricas] = useState({ ingresos: 0, gastos: 0, ganancia: 0 });
  const [alertas, setAlertas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  
  // Rango de Fechas (Afecta solo al Balance Financiero)
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes);

  const [sesion, setSesion] = useState(null);
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState(""); 
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function obtenerDashboard(userId) {
    const ahora = new Date();
    
    // 1. FINANZAS FILTRADAS POR RANGO (Solo lo que ya se pagó o gastó)
    const { data: facturasPagadas } = await supabase
      .from('facturas')
      .select('monto_total')
      .eq('usuario_id', userId)
      .eq('estatus_pago', 'Pagado')
      .gte('fecha_viaje', fechaInicio)
      .lte('fecha_viaje', fechaFin);

    const { data: gastosBD } = await supabase
      .from('mantenimientos')
      .select('costo')
      .eq('usuario_id', userId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin);

    const totalIngresos = facturasPagadas?.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;
    const totalGastos = gastosBD?.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0) || 0;

    setMetricas({
      ingresos: totalIngresos,
      gastos: totalGastos,
      ganancia: totalIngresos - totalGastos
    });

    // 2. ALERTAS GLOBALES (No dependen del filtro de fechas)
    const nuevasAlertas = [];

    // Alertas Unidades
    const { data: unidades } = await supabase.from('unidades').select('numero_economico, vencimiento_seguro, vencimiento_sct').eq('usuario_id', userId);
    unidades?.forEach(u => {
      const docs = [{ t: 'Seguro', f: u.vencimiento_seguro }, { t: 'Permiso SCT', f: u.vencimiento_sct }];
      docs.forEach(d => {
        if (!d.f) return;
        const dias = Math.ceil((new Date(d.f + 'T00:00:00') - ahora) / (1000 * 60 * 60 * 24));
        if (dias <= 30) {
          nuevasAlertas.push({
            id: `U-${u.numero_economico}-${d.t}`,
            titulo: `${d.t}: ${u.numero_economico}`,
            subtitulo: dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : `Vence en ${dias} días`,
            dias, tipo: 'unidad', urgencia: dias < 0 ? 'critica' : 'preventiva',
            icono: <AlertTriangle size={18} />, ruta: '/unidades'
          });
        }
      });
    });

// Alertas Operadores (Licencias)
    const { data: operadores } = await supabase.from('operadores').select('nombre_completo, vencimiento_licencia').eq('usuario_id', userId);
    operadores?.forEach(op => {
      if (!op.vencimiento_licencia) return;
      const dias = Math.ceil((new Date(op.vencimiento_licencia + 'T00:00:00') - ahora) / (1000 * 60 * 60 * 24));
      
      if (dias <= 30) {
        nuevasAlertas.push({
          id: `OP-${op.nombre_completo}`,
          titulo: `Licencia: ${op.nombre_completo}`,
          subtitulo: dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : `Vence en ${dias} días`,
          dias, 
          tipo: 'operador', 
          urgencia: dias < 0 ? 'critica' : 'preventiva',
          icono: <User size={18} />, 
          ruta: '/sat' // O la ruta exacta donde tengas tu catálogo de operadores
        });
      }
    });

    // Alertas Facturas Agrupadas
    const { data: facturasPendientes } = await supabase.from('facturas').select('cliente, fecha_vencimiento, monto_total').eq('usuario_id', userId).eq('estatus_pago', 'Pendiente');
    if (facturasPendientes) {
      const grupos = {};
      facturasPendientes.forEach(f => {
        if (!f.fecha_vencimiento) return;
        const dias = Math.ceil((new Date(f.fecha_vencimiento + 'T00:00:00') - ahora) / (1000 * 60 * 60 * 24));
        if (dias <= 30) {
          if (!grupos[f.cliente]) grupos[f.cliente] = { v: 0, pv: 0, m: 0, min: dias };
          if (dias < 0) { grupos[f.cliente].v += 1; grupos[f.cliente].m += Number(f.monto_total); }
          else { grupos[f.cliente].pv += 1; }
          if (dias < grupos[f.cliente].min) grupos[f.cliente].min = dias;
        }
      });
      Object.keys(grupos).forEach(c => {
        const info = grupos[c];
        const msg = [];
        if (info.v > 0) msg.push(`${info.v} vencidas ($${info.m.toLocaleString()})`);
        if (info.pv > 0) msg.push(`${info.pv} por cobrar`);
        nuevasAlertas.push({
          id: `G-F-${c}`, titulo: `Cobranza: ${c}`, subtitulo: msg.join(' | '),
          dias: info.min, tipo: 'factura', urgencia: 'preventiva',
          icono: <DollarSign size={18} />, ruta: '/facturas'
        });
      });
    }
    setAlertas(nuevasAlertas.sort((a, b) => a.dias - b.dias));
  }

  useEffect(() => {
    if (sesion) obtenerDashboard(sesion.user.id);
  }, [sesion, fechaInicio, fechaFin]);

  const alertasFiltradas = alertas.filter(a => {
    const cumpleBusqueda = a.titulo.toLowerCase().includes(busqueda.toLowerCase()) || a.subtitulo.toLowerCase().includes(busqueda.toLowerCase());
    const cumpleFiltro = filtroTipo === "todos" || a.tipo === filtroTipo;
    return cumpleBusqueda && cumpleFiltro;
  });

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black uppercase tracking-widest">Iniciando...</div>;

  if (!sesion) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white p-6">
      <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }); }} className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 w-full max-w-md shadow-2xl">
        <h2 className="text-3xl font-black mb-8 text-blue-500 italic uppercase text-center tracking-tighter">Inicia <span className="text-white">Sesión</span></h2>
        <div className="space-y-4">
          <input type="email" placeholder="Usuario" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-white" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black uppercase tracking-widest transition-all">Entrar</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="flex bg-slate-950 min-h-screen text-white">
      <Sidebar/>
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-350 mx-auto">
          <header className="mb-10">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none">Panel <span className="text-blue-500">Principal</span></h1>
            <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-[0.3em]">Estado del Sistema</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* BALANCE FINANCIERO */}
            <section className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <TrendingUp className="text-green-500" size={24} />
                  <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Balance del Periodo</h2>
                </div>
                
                {/* SELECTOR DE PERIODO (Solo Financiero) */}
                <div className="relative">
                  <button onClick={() => setMostrarFiltro(!mostrarFiltro)} className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-400 transition-all">
                    <Calendar size={12} /> Periodo <ChevronDown size={12} />
                  </button>
                  {mostrarFiltro && (
                    <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                      <div className="space-y-4">
                        <div>
                          <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Desde</label>
                          <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-lg text-xs text-white" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Hasta</label>
                          <input type="date" className="w-full bg-slate-950 border border-slate-800 p-2 rounded-lg text-xs text-white" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                        </div>
                        <button onClick={() => setMostrarFiltro(false)} className="w-full bg-blue-600 text-white py-2 rounded-lg text-[9px] font-black uppercase">Aplicar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <TarjetaDato titulo="Ingresos" valor={`$${metricas.ingresos.toLocaleString()}`} color="blue" />
                  <TarjetaDato titulo="Gastos" valor={`$${metricas.gastos.toLocaleString()}`} color="blue" />
                </div>
                <div className="bg-green-600/10 border border-green-500/20 p-8 rounded-4xl relative overflow-hidden">
                  <p className="text-xs font-black text-green-500 uppercase tracking-widest mb-1 text-[9px]">Ganancia Neta</p>
                  <h3 className="text-4xl font-black text-white italic tracking-tighter">${metricas.ganancia.toLocaleString()}</h3>
                  <div className="mt-4 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{ width: '100%' }}></div>
                  </div>
                </div>
              </div>
            </section>

            {/* AVISOS DEL SISTEMA */}
            <section className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="text-blue-500" size={18} />
                    <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Avisos del Sistema</h2>
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input type="text" placeholder="BUSCAR..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                      className="bg-slate-900/50 border border-slate-800 rounded-full py-1.5 pl-8 pr-4 text-[9px] font-black uppercase outline-none focus:border-blue-500/50 transition-all w-32 focus:w-48" />
                  </div>
                </div>
<div className="flex gap-2">
                  {[{ id: 'todos', label: 'Todos' }, { id: 'unidad', label: 'Unidades' }, { id: 'operador', label: 'Operadores' }, { id: 'factura', label: 'Cobranza' }].map((f) => (
                    <button key={f.id} onClick={() => setFiltroTipo(f.id)}
                      className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all border ${
                        filtroTipo === f.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500'
                      }`}>{f.label}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                {alertasFiltradas.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2rem] text-center">
                    <p className="text-[10px] text-slate-600 font-black uppercase italic tracking-widest">Sin alertas pendientes</p>
                  </div>
                ) : (
                  alertasFiltradas.map((alerta) => (
                    <div key={alerta.id} onClick={() => router.push(alerta.ruta)}
                      className={`bg-slate-900 border ${alerta.urgencia === 'critica' ? 'border-red-500/30' : 'border-orange-500/30'} p-5 rounded-2xl flex items-center gap-5 hover:bg-slate-800 transition-all cursor-pointer group`}>
                      <div className={`${alerta.urgencia === 'critica' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'} p-3 rounded-xl transition-transform group-hover:scale-110`}>
                        {alerta.icono}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <h4 className="text-white font-black uppercase text-xs italic">{alerta.titulo}</h4>
                          <ChevronRight size={14} className="text-slate-700" />
                        </div>
                        <p className={`text-[10px] mt-0.5 font-bold tracking-tight ${alerta.urgencia === 'critica' ? 'text-red-400' : 'text-orange-400'}`}>
                          {alerta.subtitulo}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}