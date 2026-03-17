"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TarjetaDato from '@/components/tarjetaDato';
import Sidebar from '@/components/sidebar';
import { 
  Bell, Calendar, DollarSign, TrendingUp, AlertTriangle, 
  ChevronRight, Search, ChevronDown, Truck, User 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const [metricas, setMetricas] = useState({ 
    ingresos: 0, gastos: 0, ganancia: 0,
    viajesTotales: 0, viajesTimbrados: 0, viajesBorradores: 0
  });
  const [alertas, setAlertas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  
  // ESTADOS DEL FILTRO GLOBAL
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState(true); // Activado por defecto en el mes actual
  
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes);
  const [rolUsuario, setRolUsuario] = useState('miembro');

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
    const fIni = filtroActivo && fechaInicio ? new Date(fechaInicio + 'T00:00:00') : null;
    const fFinObj = filtroActivo && fechaFin ? new Date(fechaFin + 'T23:59:59') : null;

    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', userId)
      .single();

    if (perfilData?.rol) {
      setRolUsuario(perfilData.rol);
    }
    
    // 1. CONSTRUCCIÓN DE CONSULTAS (MÉTRICAS)
    let queryFacturas = supabase.from('facturas').select('monto_total').eq('usuario_id', userId).eq('estatus_pago', 'Pagado');
    let queryGastos = supabase.from('mantenimientos').select('costo').eq('usuario_id', userId);
    let queryViajes = supabase.from('viajes').select('estatus').eq('usuario_id', userId);

    if (filtroActivo && fechaInicio && fechaFin) {
      queryFacturas = queryFacturas.gte('fecha_viaje', fechaInicio).lte('fecha_viaje', fechaFin);
      queryGastos = queryGastos.gte('fecha', fechaInicio).lte('fecha', fechaFin);
      queryViajes = queryViajes.gte('fecha_salida', fechaInicio).lte('fecha_salida', fechaFin);
    }

    // EJECUCIÓN CONCURRENTE (Rendimiento Optimizado)
    const [
      { data: facturasPagadas }, { data: gastosBD }, { data: viajesBD },
      { data: unidades }, { data: operadores }, { data: facturasPendientes }
    ] = await Promise.all([
      queryFacturas, queryGastos, queryViajes,
      supabase.from('unidades').select('numero_economico, vencimiento_seguro, vencimiento_sct').eq('usuario_id', userId),
      supabase.from('operadores').select('nombre_completo, vencimiento_licencia').eq('usuario_id', userId),
      supabase.from('facturas').select('cliente, fecha_vencimiento, monto_total').eq('usuario_id', userId).eq('estatus_pago', 'Pendiente')
    ]);

    // PROCESAMIENTO DE MÉTRICAS
    const totalIngresos = facturasPagadas?.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0) || 0;
    const totalGastos = gastosBD?.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0) || 0;
    
    setMetricas({
      ingresos: totalIngresos, gastos: totalGastos, ganancia: totalIngresos - totalGastos,
      viajesTotales: viajesBD?.length || 0,
      viajesTimbrados: viajesBD?.filter(v => v.estatus === 'Emitido (Timbrado)').length || 0,
      viajesBorradores: viajesBD?.filter(v => v.estatus === 'Borrador').length || 0
    });

    // 2. PROCESAMIENTO DE ALERTAS (AHORA RESPETAN EL FILTRO)
    const nuevasAlertas = [];

    // Helper para evaluar si una fecha entra en el filtro
    const evaluarAlerta = (fechaString) => {
      const fVencimiento = new Date(fechaString + 'T00:00:00');
      const dias = Math.ceil((fVencimiento - ahora) / (1000 * 60 * 60 * 24));
      
      let entraEnFiltro = false;
      if (filtroActivo && fIni && fFinObj) {
        entraEnFiltro = (fVencimiento >= fIni && fVencimiento <= fFinObj);
      } else {
        entraEnFiltro = dias <= 30; // Comportamiento por defecto (Todo el historial)
      }
      return { entraEnFiltro, dias };
    };

    // Alertas Unidades
    unidades?.forEach(u => {
      const docs = [{ t: 'Seguro', f: u.vencimiento_seguro }, { t: 'Permiso SCT', f: u.vencimiento_sct }];
      docs.forEach(d => {
        if (!d.f) return;
        const { entraEnFiltro, dias } = evaluarAlerta(d.f);
        
        if (entraEnFiltro) {
          nuevasAlertas.push({
            id: `U-${u.numero_economico}-${d.t}`, titulo: `${d.t}: ${u.numero_economico}`,
            subtitulo: dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : `Vence en ${dias} días`,
            dias, tipo: 'unidad', urgencia: dias < 0 ? 'critica' : 'preventiva',
            icono: <AlertTriangle size={18} />, ruta: '/unidades'
          });
        }
      });
    });

    // Alertas Operadores
    operadores?.forEach(op => {
      if (!op.vencimiento_licencia) return;
      const { entraEnFiltro, dias } = evaluarAlerta(op.vencimiento_licencia);
      
      if (entraEnFiltro) {
        nuevasAlertas.push({
          id: `OP-${op.nombre_completo}`, titulo: `Licencia: ${op.nombre_completo}`,
          subtitulo: dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : `Vence en ${dias} días`,
          dias, tipo: 'operador', urgencia: dias < 0 ? 'critica' : 'preventiva',
          icono: <User size={18} />, ruta: '/sat'
        });
      }
    });

    // Alertas Facturas Agrupadas
    if (facturasPendientes) {
      const grupos = {};
      facturasPendientes.forEach(f => {
        if (!f.fecha_vencimiento) return;
        const { entraEnFiltro, dias } = evaluarAlerta(f.fecha_vencimiento);
        
        if (entraEnFiltro) {
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

  // Agregamos filtroActivo a las dependencias para que recalcule al instante
  useEffect(() => {
    if (sesion) obtenerDashboard(sesion.user.id);
  }, [sesion, fechaInicio, fechaFin, filtroActivo]);

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
        <div className="max-w-7xl mx-auto">
          
          {/* ENCABEZADO GLOBAL (CON EL BOTÓN DE FILTRO) */}
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none">Panel <span className="text-blue-500">Principal</span></h1>
              <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-[0.3em]">Estado del Sistema</p>
            </div>
            
            <div className="relative shrink-0 z-50">
              <button 
                onClick={() => setMostrarFiltro(!mostrarFiltro)}
                className={`flex items-center gap-3 border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                  ${filtroActivo ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
              >
                <Calendar size={14} className={filtroActivo ? 'text-blue-500' : 'text-slate-500'} />
                {filtroActivo ? 'Periodo Activo' : 'Ver Histórico'}
                <ChevronDown size={14} className={`transition-transform duration-200 ${mostrarFiltro ? 'rotate-180' : ''}`} />
              </button>

              {mostrarFiltro && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 p-5">
                  <div className="mb-4">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Desde</label>
                    <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl p-3 outline-none focus:border-blue-500" />
                  </div>
                  <div className="mb-6">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Hasta</label>
                    <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl p-3 outline-none focus:border-blue-500" />
                  </div>
                  <button onClick={() => { setFiltroActivo(true); setMostrarFiltro(false); }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-colors mb-2">
                    Aplicar Filtro
                  </button>
                  {filtroActivo && (
                    <button onClick={() => { setFiltroActivo(false); setMostrarFiltro(false); }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest py-2.5 rounded-xl transition-colors">
                      Ver Histórico Total
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* MONITOR OPERATIVO */}
          <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <Truck className="text-blue-500" size={20} />
              <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-[0.2em]">
                {filtroActivo ? 'Despachos del Periodo' : 'Histórico de Despachos'}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
                <div className="absolute -right-6 -top-6 bg-slate-800/20 w-28 h-28 rounded-full transition-transform group-hover:scale-150 duration-500" />
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Total de Viajes</p>
                <h3 className="text-4xl font-black text-white italic tracking-tighter relative z-10">
                  {metricas.viajesTotales}
                </h3>
              </div>
              
              <div className="bg-slate-900 border border-emerald-500/20 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="absolute -right-6 -top-6 bg-emerald-500/10 w-28 h-28 rounded-full transition-transform group-hover:scale-150 duration-500" />
                <p className="text-[11px] font-black text-emerald-500/70 uppercase tracking-widest mb-2 relative z-10">Timbrados</p>
                <h3 className="text-4xl font-black text-emerald-400 italic tracking-tighter relative z-10">
                  {metricas.viajesTimbrados}
                </h3>
              </div>
            </div>
          </section>

          {/* GRID INFERIOR DE 2 COLUMNAS */}
<div className={`grid grid-cols-1 ${rolUsuario === 'administrador' ? 'lg:grid-cols-2' : ''} gap-12 border-t border-slate-800/50 pt-10`}>
            
            {/* BALANCE FINANCIERO (RESTRINGIDO A ADMINISTRADORES) */}
            {rolUsuario === 'administrador' && (
              <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="text-green-500" size={24} />
                  <h2 className="text-[20px] font-black text-slate-400 uppercase tracking-[0.2em]">Balance Financiero</h2>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <TarjetaDato titulo="Ingresos" valor={`$${metricas.ingresos.toLocaleString()}`} color="blue" />
                    <TarjetaDato titulo="Gastos" valor={`$${metricas.gastos.toLocaleString()}`} color="blue" />
                  </div>
                  <div className="bg-green-600/10 border border-green-500/20 p-8 rounded-[2.5rem] relative overflow-hidden">
                    <p className="font-black text-green-500 uppercase tracking-widest mb-1 text-[11px]">Ganancia Neta</p>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter">${metricas.ganancia.toLocaleString()}</h3>
                    <div className="mt-4 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* AVISOS DEL SISTEMA */}
            <section className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="text-blue-500" size={20} />
                    <h2 className="text-[15px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      {filtroActivo ? 'Avisos del Periodo' : 'Todos los Avisos'}
                    </h2>
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input type="text" placeholder="BUSCAR..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                      className="bg-slate-900/50 border border-slate-800 rounded-full py-1.5 pl-8 pr-4 text-[12px] font-black uppercase outline-none focus:border-blue-500/50 transition-all w-32 focus:w-48" />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[{ id: 'todos', label: 'Todos' }, { id: 'unidad', label: 'Flota' }, { id: 'operador', label: 'Operadores' }, { id: 'factura', label: 'Cobranza' }].map((f) => (
                    <button key={f.id} onClick={() => setFiltroTipo(f.id)}
                      className={`px-4 py-1.5 rounded-full text-[9.5px] font-black uppercase tracking-widest transition-all border ${
                        filtroTipo === f.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500'
                      }`}>{f.label}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                {alertasFiltradas.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] text-center">
                    <p className="text-[10px] text-slate-600 font-black uppercase italic tracking-widest">Sin alertas pendientes</p>
                  </div>
                ) : (
                  alertasFiltradas.map((alerta) => (
                    <div key={alerta.id} onClick={() => router.push(alerta.ruta)}
                      className={`bg-slate-900 border ${alerta.urgencia === 'critica' ? 'border-red-500/30' : 'border-orange-500/30'} p-5 rounded-[1.5rem] flex items-center gap-5 hover:bg-slate-800 transition-all cursor-pointer group`}>
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