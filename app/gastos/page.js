'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx';
import { 
  Wrench, PlusCircle, Trash2, Fuel, X, Truck, Calendar, ChevronDown, FileText,
  Settings, Ticket, Coffee, Bed, ArrowRightLeft, Package, CreditCard, Wallet, Car, Coins, Key, Tag, Edit, Loader2, AlertTriangle
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';

// === SISTEMA DE ALERTAS ===
import { useToast } from '@/components/toastprovider';

// === DICCIONARIO INSTITUCIONAL DE GASTOS ===
const DICCIONARIO_GASTOS = {
  "Preventivo": { icon: Settings, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  "Correctivo": { icon: Wrench, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
  "Gasolina": { icon: Fuel, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  "Casetas": { icon: Ticket, color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
  "Viáticos": { icon: Coffee, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  "Hotel": { icon: Bed, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  "Maniobras": { icon: ArrowRightLeft, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  "Material para maniobras": { icon: Package, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  "Comisión Cajeros": { icon: CreditCard, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  "Saldo": { icon: Wallet, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  "Taxi": { icon: Car, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  "Dádivas": { icon: Coins, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  "Renta de unidad": { icon: Key, color: "text-slate-300", bg: "bg-slate-700/50", border: "border-slate-600" },
  "Otros": { icon: Tag, color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700" },
};

export default function GastosOperativosPage() {
  const { mostrarAlerta } = useToast();
  const [dialogoConfirmacion, setDialogoConfirmacion] = useState({ visible: false, mensaje: '', accion: null });

  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState(false);
  
  const [editandoId, setEditandoId] = useState(null);
  
  const [unidades, setUnidades] = useState([]);
  const [viajesActivos, setViajesActivos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [metricas, setMetricas] = useState({ totalPeriodo: 0, conteo: 0 });
  
  const [empresaId, setEmpresaId] = useState(null);
  const [rolUsuario, setRolUsuario] = useState('miembro');

  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes);

  const formInicial = { 
    unidad_id: '', 
    viaje_id: '', 
    fecha: new Date().toISOString().split('T')[0],
    descripcion_general: '',
    lineas: [
      { id_temp: Date.now(), tipo: 'Gasolina', descripcion: '', monto: '' }
    ]
  };

  const [formData, setFormData] = useState(formInicial);

  const totalLiquidacion = (formData.lineas || []).reduce((suma, linea) => {
    return suma + (parseFloat(linea.monto) || 0);
  }, 0);

  const agregarLinea = () => {
    setFormData({
      ...formData,
      lineas: [
        ...formData.lineas, 
        { id_temp: Date.now() + Math.random(), tipo: 'Gasolina', descripcion: '', monto: '' }
      ]
    });
  };

  const eliminarLinea = (idTemp) => {
    setFormData({
      ...formData,
      lineas: formData.lineas.filter(linea => linea.id_temp !== idTemp)
    });
  };

  const actualizarLinea = (idTemp, campo, valor) => {
    setFormData({
      ...formData,
      lineas: formData.lineas.map(linea => 
        linea.id_temp === idTemp ? { ...linea, [campo]: valor } : linea
      )
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/";
      else {
        setSesion(session);
        inicializarDatos(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (empresaId) obtenerDatos(empresaId);
  }, [fechaInicio, fechaFin, filtroActivo]);

  async function inicializarDatos(userId) {
    setLoading(true);
    const { data: perfilData } = await supabase.from('perfiles').select('empresa_id, rol').eq('id', userId).single();
    const idMaestro = perfilData?.empresa_id || userId;
    setEmpresaId(idMaestro);
    if (perfilData?.rol) setRolUsuario(perfilData.rol);

    await obtenerDatos(idMaestro);
  }

  async function obtenerDatos(idMaestro) {
    setLoading(true);
    
    const { data: unidadesBD } = await supabase.from('unidades').select('id, numero_economico').eq('empresa_id', idMaestro).eq('activo', true);
    setUnidades(unidadesBD || []);

    const { data: viajesBD } = await supabase.from('viajes').select('id, folio_interno, fecha_salida').eq('empresa_id', idMaestro).order('created_at', { ascending: false }).limit(50);
    setViajesActivos(viajesBD || []);

    const { data: gastosBD, error } = await supabase.from('mantenimientos').select(`*, unidades(numero_economico), viajes(folio_interno), gastos_detalle(*)`).eq('empresa_id', idMaestro).gte('fecha', fechaInicio).lte('fecha', fechaFin).order('fecha', { ascending: false });

    if (error) console.error(error);

    const total = gastosBD?.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0) || 0;
    setMetricas({ totalPeriodo: total, conteo: gastosBD?.length || 0 });
    setHistorial(gastosBD || []);
    setLoading(false);
  }

  const pedirConfirmacion = (mensaje, accion) => setDialogoConfirmacion({ visible: true, mensaje, accion });
  const ejecutarConfirmacion = async () => { if (dialogoConfirmacion.accion) await dialogoConfirmacion.accion(); setDialogoConfirmacion({ visible: false, mensaje: '', accion: null }); };

  const abrirModalCrear = () => {
    setFormData(formInicial);
    setEditandoId(null);
    setMostrarFormulario(true);
  };

  const abrirModalEditar = async (item) => {
    setLoading(true);
    
    const { data: detalles, error } = await supabase.from('gastos_detalle').select('*').eq('gasto_id', item.id);

    if (error) {
      mostrarAlerta("No se pudieron cargar los detalles.", "error");
      setLoading(false);
      return;
    }

    const lineasRecuperadas = detalles.map(d => ({ id_temp: d.id, tipo: d.tipo, descripcion: d.descripcion, monto: d.monto }));

    setFormData({
      unidad_id: item.unidad_id || '', viaje_id: item.viaje_id || '', fecha: item.fecha, descripcion_general: item.descripcion,
      lineas: lineasRecuperadas.length > 0 ? lineasRecuperadas : [{ id_temp: Date.now(), tipo: 'Otros', descripcion: '', monto: '' }]
    });

    setEditandoId(item.id);
    setMostrarFormulario(true);
    setLoading(false);
  };

  const registrarGasto = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.lineas || formData.lineas.length === 0) {
        throw new Error("Debes agregar al menos un concepto de gasto.");
      }

      const totalCalculado = formData.lineas.reduce((suma, linea) => {
        const monto = parseFloat(linea.monto);
        if (isNaN(monto) || monto < 0) throw new Error("Revisa los montos: no pueden estar vacíos ni ser negativos.");
        return suma + monto;
      }, 0);

      const payloadMaestro = {
        unidad_id: formData.unidad_id || null, viaje_id: formData.viaje_id || null, descripcion: formData.descripcion_general.trim() || 'Liquidación Operativa', costo: totalCalculado, tipo: 'Liquidación', fecha: formData.fecha, empresa_id: empresaId 
      };

      if (editandoId) {
        const { error: errorMaestro } = await supabase.from('mantenimientos').update(payloadMaestro).eq('id', editandoId);
        if (errorMaestro) throw errorMaestro;

        const { error: errorBorrado } = await supabase.from('gastos_detalle').delete().eq('gasto_id', editandoId);
        if (errorBorrado) throw errorBorrado;

        const payloadDetalles = formData.lineas.map(linea => ({ gasto_id: editandoId, tipo: linea.tipo, descripcion: linea.descripcion.trim(), monto: parseFloat(linea.monto) }));
        const { error: errorDetalles } = await supabase.from('gastos_detalle').insert(payloadDetalles);
        if (errorDetalles) throw new Error(`Detalles rechazados por BD: ${errorDetalles.message}`);

        mostrarAlerta("Gasto actualizado exitosamente.", "exito");
      } else {
        const { data: dataMaestro, error: errorMaestro } = await supabase.from('mantenimientos').insert([payloadMaestro]).select('id').single();
        if (errorMaestro) throw errorMaestro;

        const nuevoGastoId = dataMaestro.id;

        const payloadDetalles = formData.lineas.map(linea => ({ gasto_id: nuevoGastoId, tipo: linea.tipo, descripcion: linea.descripcion.trim(), monto: parseFloat(linea.monto) }));
        const { error: errorDetalles } = await supabase.from('gastos_detalle').insert(payloadDetalles);
        if (errorDetalles) {
          await supabase.from('mantenimientos').delete().eq('id', nuevoGastoId);
          throw new Error(`Detalles rechazados por BD: ${errorDetalles.message}`);
        }

        mostrarAlerta("Gasto registrado exitosamente.", "exito");
      }

      setMostrarFormulario(false);
      setFormData(formInicial);
      setEditandoId(null);
      obtenerDatos(empresaId);

    } catch (error) {
      mostrarAlerta("Fallo Operativo: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const eliminarGasto = (id) => {
    pedirConfirmacion("¿Eliminar registro de gasto de forma permanente? Esta acción no se puede deshacer.", async () => {
      setLoading(true);
      try {
        const { error } = await supabase.from('mantenimientos').delete().eq('id', id);
        if (error) throw error;
        mostrarAlerta("Gasto eliminado correctamente.", "exito");
        obtenerDatos(empresaId);
      } catch (error) {
        mostrarAlerta("Error al eliminar: " + error.message, "error");
      } finally {
        setLoading(false);
      }
    });
  };

  const exportarGastosExcel = () => {
    if (historial.length === 0) return mostrarAlerta("No hay datos para exportar en este periodo.", "error");
    setLoading(true);
    try {
      const datosParaExportar = [];

      historial.forEach(item => {
        const vieneDeViaje = item.viaje_id !== null;
        const fechaStr = item.fecha ? item.fecha.slice(0, 10) : 'S/F';
        const folioOrigen = item.folio_interno ? `G-${String(item.folio_interno).padStart(4, '0')}` : 'G-S/N';
        const referenciaViaje = vieneDeViaje ? `VIAJE V-${String(item.viajes?.folio_interno).padStart(4, '0')}` : 'Gasto General';
        const unidad = item.unidades?.numero_economico || '---';

        if (item.gastos_detalle && item.gastos_detalle.length > 0) {
          item.gastos_detalle.forEach(det => {
            datosParaExportar.push({
              'FECHA': fechaStr, 'FOLIO GASTO': folioOrigen, 'ORIGEN': referenciaViaje, 'UNIDAD (ECO)': unidad, 'CONCEPTO GENERAL': item.descripcion, 'CATEGORÍA (TICKET)': det.tipo.toUpperCase(), 'DESCRIPCIÓN (TICKET)': det.descripcion, 'MONTO ($)': Number(det.monto)
            });
          });
        } else {
          datosParaExportar.push({
            'FECHA': fechaStr, 'FOLIO GASTO': folioOrigen, 'ORIGEN': referenciaViaje, 'UNIDAD (ECO)': unidad, 'CONCEPTO GENERAL': item.descripcion, 'CATEGORÍA (TICKET)': 'S/D', 'DESCRIPCIÓN (TICKET)': 'Sin desglose registrado', 'MONTO ($)': Number(item.costo)
          });
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Desglose Operativo");
      
      worksheet['!cols'] = [ { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 40 }, { wch: 15 } ];
      
      XLSX.writeFile(workbook, `Desglose_Gastos_${fechaInicio}_al_${fechaFin}.xlsx`);
      mostrarAlerta("Reporte exportado exitosamente.", "exito");
      setMostrarFiltro(false);
    } catch (error) {
      mostrarAlerta("Error al generar el reporte: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!sesion) return null;
  
  if (rolUsuario === 'facturacion') {
    return (
      <div className="flex bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-200 w-full transition-colors"><Sidebar /><main className="flex-1 p-8 flex flex-col items-center justify-center"><h2 className="text-2xl font-black uppercase tracking-widest">Acceso Restringido</h2></main></div>
    );
  }

  return (
    <div className="flex bg-transparent min-h-screen text-slate-900 dark:text-slate-200 w-full transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 transition-colors">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white italic uppercase tracking-tighter transition-colors">Egresos <span className="text-blue-600 dark:text-blue-500">Operativos</span></h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1 transition-colors">Gestión Centralizada de Costos</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-auto">
                <button onClick={() => setMostrarFiltro(!mostrarFiltro)} className={`w-full md:w-auto flex items-center justify-center gap-3 border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filtroActivo ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                  <Calendar size={14} className={filtroActivo ? 'text-blue-600 dark:text-blue-500' : 'text-slate-500'} /> {filtroActivo ? 'Filtros Activos' : 'Periodo y Reportes'} <ChevronDown size={14} />
                </button>

                {mostrarFiltro && (
                  <div className="absolute right-0 md:right-auto mt-3 w-full md:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl dark:shadow-2xl z-50 animate-in fade-in zoom-in-95 transition-colors">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 transition-colors">Desde</label><input type="date" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors cursor-pointer" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
                        <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 transition-colors">Hasta</label><input type="date" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors cursor-pointer" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
                      </div>
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 transition-colors">
                        <button onClick={() => { setFiltroActivo(true); setMostrarFiltro(false); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20">Aplicar Filtros</button>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                           {filtroActivo && (<button onClick={() => { setFiltroActivo(false); setFechaInicio(primerDiaMes); setFechaFin(ultimoDiaMes); setMostrarFiltro(false); }} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">Limpiar</button>)}
                           <button onClick={exportarGastosExcel} disabled={loading || historial.length === 0} className={`${filtroActivo ? '' : 'col-span-2'} flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-600/10 hover:bg-emerald-100 dark:hover:bg-emerald-600 text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-white border border-emerald-200 dark:border-emerald-500/20 font-black text-[9px] uppercase tracking-widest py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed`}><FileText size={14} /> Excel</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={abrirModalCrear} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 shadow-blue-900/20"><PlusCircle size={14} /> Registrar Gasto</button>
            </div>
          </header>

          {(rolUsuario === 'administrador' || rolUsuario === 'admin') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12 animate-in fade-in transition-colors">
              <TarjetaDato titulo="Egreso en Periodo" valor={`$${metricas.totalPeriodo.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} color="blue" />
              <TarjetaDato titulo="Folios Registrados" valor={metricas.conteo.toString()} color="blue" />
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm dark:shadow-2xl mb-12 flex flex-col transition-colors">
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-left border-collapse text-[13px] min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors">
                    <th className="p-5 pl-8 w-32">Folio Gasto</th><th className="p-5 w-36">Folio Viaje</th><th className="p-5 w-32">Unidad</th><th className="p-5 w-32">Fecha</th><th className="p-5 min-w-[350px]">Detalle del Egreso</th><th className="p-5 w-36 text-right">Monto Total</th><th className="p-5 pr-8 w-28 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors">
                  {historial.map((item) => {
                    const vieneDeViaje = item.viaje_id !== null;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                        <td className="p-4 pl-8 whitespace-nowrap"><span className="text-[14px] text-slate-900 dark:text-white font-mono font-medium transition-colors">{item.folio_interno ? `G-${String(item.folio_interno).padStart(4, '0')}` : 'G-S/N'}</span></td>
                        <td className="p-4 whitespace-nowrap">
                          {vieneDeViaje ? ( <span className="inline-flex px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 font-mono text-[12px] items-center gap-1.5 transition-colors"><Truck size={12}/> V-{String(item.viajes?.folio_interno).padStart(4, '0')}</span>) : ( <span className="text-slate-400 dark:text-slate-600 text-[12px] font-mono transition-colors">---</span> )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {item.unidades?.numero_economico ? ( <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[12px] transition-colors">ECO: {item.unidades.numero_economico}</span> ) : ( <span className="text-slate-400 dark:text-slate-600 text-[12px] font-mono transition-colors">---</span> )}
                        </td>
                        <td className="p-4 whitespace-nowrap"><span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium transition-colors">{item.fecha?.slice(0, 10) || 'S/F'}</span></td>
                        <td className="p-4 whitespace-normal min-w-[350px]">
                          <div className="flex flex-col items-start py-1">
                            <span className="text-slate-700 dark:text-slate-200 text-sm leading-tight transition-colors">{item.descripcion}</span>
                            <span className="text-slate-500 text-[11px] mt-1 font-medium transition-colors">{(item.gastos_detalle?.length || 0)} {(item.gastos_detalle?.length === 1) ? 'concepto registrado' : 'conceptos registrados'}</span>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap text-right"><span className="text-[15px] font-mono font-black text-slate-900 dark:text-white transition-colors">${Number(item.costo).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span></td>
                        <td className="p-4 pr-8 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-30 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => abrirModalEditar(item)} title="Editar" className="p-2 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"><Edit size={16} /></button>
                            <button onClick={() => eliminarGasto(item.id)} title="Eliminar" className="p-2 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {historial.length === 0 && (
                    <tr><td colSpan="7" className="py-16 text-center"><Wallet size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3 transition-colors" /><p className="text-slate-500 uppercase tracking-widest text-sm font-black transition-colors">Sin registros en este periodo</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* MODAL DE CONFIRMACIÓN CUSTOM */}
          {/* ========================================================= */}
          {dialogoConfirmacion.visible && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm transition-colors" onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} />
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 transition-colors">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-6 transition-colors"><AlertTriangle size={32} /></div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 transition-colors">¿Estás Seguro?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 transition-colors">{dialogoConfirmacion.mensaje}</p>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setDialogoConfirmacion({ visible: false, mensaje: '', accion: null })} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Descartar</button>
                  <button onClick={ejecutarConfirmacion} disabled={loading} className="flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest bg-red-600 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">{loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Sí, Proceder"}</button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL DE REGISTRO */}
          {/* ========================================================= */}
          {mostrarFormulario && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm transition-colors" onClick={() => setMostrarFormulario(false)} />
              
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-[3rem] p-6 sm:p-10 shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                <button onClick={() => setMostrarFormulario(false)} className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white bg-slate-100 dark:bg-slate-950 p-2 rounded-full transition-colors"><X size={20} /></button>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white italic uppercase mb-8 shrink-0 transition-colors">{editandoId ? 'Editar' : 'Captura de'} <span className="text-blue-600 dark:text-blue-500">Gasto</span></h2>
                
                <form onSubmit={registrarGasto} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2 transition-colors">1. Datos Generales (Folio Maestro)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" value={formData.unidad_id} onChange={e => setFormData({...formData, unidad_id: e.target.value})}>
                        <option value="">-- Sin Unidad --</option>
                        {unidades.map(u => <option key={u.id} value={u.id}>ECO: {u.numero_economico}</option>)}
                      </select>
                      <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" value={formData.viaje_id} onChange={e => setFormData({...formData, viaje_id: e.target.value})}>
                        <option value="">-- Gasto Admin --</option>
                        {viajesActivos.map(v => <option key={v.id} value={v.id}>Viaje V-{String(v.folio_interno).padStart(4, '0')}</option>)}
                      </select>
                      <input type="date" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none cursor-pointer transition-colors" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} required />
                    </div>
                    <input required className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" value={formData.descripcion_general} onChange={e => setFormData({...formData, descripcion_general: e.target.value})} placeholder="Concepto General (Ej. Gastos de Viaje MTY-QRO)" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-800 pb-2 transition-colors">
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">2. Desglose del gasto (Detalle)</p>
                      <button type="button" onClick={agregarLinea} className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/20 transition-colors"><PlusCircle size={12} /> Agregar Concepto</button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-3 pr-2">
                      {formData.lineas.map((linea) => (
                        <div key={linea.id_temp} className="flex flex-col sm:flex-row gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 group hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                          <select required className="sm:w-1/4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" value={linea.tipo} onChange={e => actualizarLinea(linea.id_temp, 'tipo', e.target.value)}>
                            <optgroup label="OPERACIÓN" className="bg-white dark:bg-slate-900 text-slate-500">
                              <option value="Gasolina">Gasolina / Diesel</option>
                              <option value="Casetas">Casetas</option>
                              <option value="Viáticos">Viáticos</option>
                              <option value="Hotel">Hotel</option>
                              <option value="Taxi">Taxi</option>
                            </optgroup>
                            <optgroup label="MANTENIMIENTO" className="bg-white dark:bg-slate-900 text-slate-500">
                              <option value="Preventivo">Preventivo</option>
                              <option value="Correctivo">Correctivo</option>
                              <option value="Material para maniobras">Mat. Maniobras</option>
                            </optgroup>
                            <optgroup label="ADMINISTRATIVO" className="bg-white dark:bg-slate-900 text-slate-500">
                              <option value="Maniobras">Maniobras</option>
                              <option value="Comisión Cajeros">Comisión</option>
                              <option value="Saldo">Saldo</option>
                              <option value="Dádivas">Dádivas</option>
                              <option value="Renta de unidad">Renta Unidad</option>
                              <option value="Otros">Otros</option>
                            </optgroup>
                          </select>
                          <input required className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" value={linea.descripcion} onChange={e => actualizarLinea(linea.id_temp, 'descripcion', e.target.value)} placeholder="Descripción del gasto..." />
                          <div className="sm:w-1/4 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">$</span>
                            <input required type="number" step="0.01" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 pl-7 pr-10 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:border-blue-500 outline-none transition-colors" value={linea.monto} onChange={e => actualizarLinea(linea.id_temp, 'monto', e.target.value)} placeholder="0.00" />
                            {formData.lineas.length > 1 && (
                              <button type="button" onClick={() => eliminarLinea(linea.id_temp)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors">
                    <div className="text-left w-full sm:w-auto">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest transition-colors">Total del gasto</p>
                      <p className="text-3xl font-mono font-black text-blue-600 dark:text-blue-500 italic transition-colors">${totalLiquidacion.toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    </div>
                    <button type="submit" disabled={loading || formData.lineas.length === 0} className="w-full sm:w-auto flex-1 bg-blue-600 text-white py-4 px-8 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all flex justify-center items-center gap-3 disabled:opacity-50 shadow-blue-900/20">
                      {loading ? <Loader2 size={16} className="animate-spin" /> : editandoId ? <Edit size={16}/> : <PlusCircle size={16}/>}
                      {loading ? "Sincronizando..." : editandoId ? "Actualizar Gasto" : "Ingresar Gasto"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}