'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { 
  Wrench, PlusCircle, History, Trash2, Fuel, X, 
  Truck, TrendingDown, Calendar, Search, ChevronDown, FileText
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import TarjetaDato from '@/components/tarjetaDato';

// === ESCUDO DE VALIDACIÓN ZOD PARA GASTOS ===
const gastoSchema = z.object({
  costo: z.number().nonnegative("🛑 El costo no puede ser negativo."),
  descripcion: z.string().min(3, "🛑 La descripción es obligatoria y debe ser clara."),
  tipo: z.enum(["Preventivo", "Correctivo", "Combustible", "Otros"], { 
    errorMap: () => ({ message: "🛑 Tipo de gasto inválido." }) 
  }),
  fecha: z.string().min(10, "🛑 La fecha es obligatoria."),
  viaje_id: z.string().optional()
});

export default function GastosOperativosPage() {
  const [sesion, setSesion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  
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

  const [formData, setFormData] = useState({ 
    unidad_id: '', viaje_id: '', descripcion: '', costo: '', tipo: 'Preventivo',
    fecha: new Date().toISOString().split('T')[0]
  });

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
  }, [fechaInicio, fechaFin]);

  async function inicializarDatos(userId) {
    setLoading(true);
    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('empresa_id, rol')
      .eq('id', userId)
      .single();

    const idMaestro = perfilData?.empresa_id || userId;
    setEmpresaId(idMaestro);
    if (perfilData?.rol) setRolUsuario(perfilData.rol);

    await obtenerDatos(idMaestro);
  }

  async function obtenerDatos(idMaestro) {
    setLoading(true);
    
    // 1. Cargar catálogo de unidades (SOLO ACTIVAS)
    const { data: unidadesBD } = await supabase
      .from('unidades')
      .select('id, numero_economico')
      .eq('usuario_id', idMaestro)
      .eq('activo', true);
    setUnidades(unidadesBD || []);

    // 2. Cargar los últimos viajes para el selector manual
    const { data: viajesBD, error: errorViajes } = await supabase
      .from('viajes')
      .select('id, folio_interno, fecha_salida')
      .eq('usuario_id', idMaestro)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (errorViajes) console.error("Error al cargar viajes:", errorViajes.message);
    setViajesActivos(viajesBD || []);

    // 3. Consulta con Rango de Fechas e Inner Join a Viajes
    const { data: gastosBD, error } = await supabase
      .from('mantenimientos')
      .select(`*, unidades(numero_economico), viajes(folio_interno)`)
      .eq('usuario_id', idMaestro)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false });

    if (error) console.error(error);

    const total = gastosBD?.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0) || 0;

    setMetricas({ totalPeriodo: total, conteo: gastosBD?.length || 0 });
    setHistorial(gastosBD || []);
    setLoading(false);
  }

  const registrarGasto = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Preparamos los datos crudos
      const datosCrudos = {
        costo: parseFloat(formData.costo || 0),
        descripcion: formData.descripcion.trim(),
        tipo: formData.tipo,
        fecha: formData.fecha,
        viaje_id: formData.viaje_id === '' ? undefined : formData.viaje_id
      };

      // 2. Pasamos por el detector de metales (SAFE PARSE)
      const validacion = gastoSchema.safeParse(datosCrudos);

      if (!validacion.success) {
        setLoading(false);
        const mensajeError = validacion.error.issues[0]?.message || "🛑 Revisa los datos ingresados.";
        return alert(mensajeError);
      }

      // 3. Si Zod aprueba, insertamos con el ADN de la empresa
      const { error } = await supabase.from('mantenimientos').insert([
        { 
          unidad_id: formData.unidad_id, 
          viaje_id: validacion.data.viaje_id || null,
          descripcion: validacion.data.descripcion, 
          costo: validacion.data.costo, 
          tipo: validacion.data.tipo, 
          fecha: validacion.data.fecha,
          usuario_id: empresaId 
        } 
      ]);

      if (error) throw error;

      setFormData({ unidad_id: '', viaje_id: '', descripcion: '', costo: '', tipo: 'Preventivo', fecha: new Date().toISOString().split('T')[0] });
      setMostrarFormulario(false);
      obtenerDatos(empresaId);
    } catch (error) {
      alert("Fallo al registrar gasto: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarGasto = async (id) => {
    if (!confirm("¿Eliminar registro de gasto?")) return;
    await supabase.from('mantenimientos').delete().eq('id', id);
    obtenerDatos(empresaId);
  };

  const exportarGastosExcel = () => {
    if (historial.length === 0) return alert("No hay datos para exportar en este periodo.");

    setLoading(true);
    try {
      // 1. Mapeo y limpieza de datos para el Excel
      const datosParaExportar = historial.map(item => {
        const vieneDeViaje = item.viaje_id !== null;
        return {
          'FECHA': item.fecha ? item.fecha.slice(0, 10) : 'S/F',
          'FOLIO GASTO': item.folio_interno ? `G-${String(item.folio_interno).padStart(4, '0')}` : 'G-S/N',
          'ORIGEN': vieneDeViaje ? `VIAJE V-${String(item.viajes?.folio_interno).padStart(4, '0')}` : 'Gasto General',
          'UNIDAD (ECO)': item.unidades?.numero_economico || '---',
          'TIPO': item.tipo.toUpperCase(),
          'DESCRIPCIÓN': item.descripcion,
          'INVERSIÓN ($)': Number(item.costo)
        };
      });

      // 2. Creación del libro y la hoja
      const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Gastos Operativos");

      // 3. Ajuste del ancho de las columnas
      worksheet['!cols'] = [
        { wch: 12 }, // FECHA
        { wch: 15 }, // FOLIO GASTO
        { wch: 20 }, // ORIGEN
        { wch: 15 }, // UNIDAD
        { wch: 15 }, // TIPO
        { wch: 45 }, // DESCRIPCION
        { wch: 15 }, // INVERSION
      ];

      // 4. Nombre dinámico y descarga
      const nombreArchivo = `Reporte_Gastos_${fechaInicio}_al_${fechaFin}.xlsx`;
      XLSX.writeFile(workbook, nombreArchivo);
      
      setMostrarFiltro(false);

    } catch (error) {
      console.error("Error al exportar:", error);
      alert("Error al generar el reporte.");
    } finally {
      setLoading(false);
    }
  };

  if (!sesion) return null;
  
  if (rolUsuario === 'facturacion') {
    return (
      <div className="flex bg-slate-950 min-h-screen text-slate-200 w-full">
        <Sidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center">
          <h2 className="text-2xl text-white font-black uppercase tracking-widest">Acceso Restringido</h2>
          <p className="text-slate-500 text-sm mt-2">Tu perfil de Facturación no tiene acceso a Logística Operativa.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200 w-full">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                Gastos <span className="text-blue-600">Operativos</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Control de Egresos por Periodo</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setMostrarFiltro(!mostrarFiltro)}
                  className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                >
                  <Calendar size={14} className="text-blue-300" />
                  Periodo
                  <ChevronDown size={14} />
                </button>

                {mostrarFiltro && (
                  <div className="absolute right-0 mt-3 w-72 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Desde</label>
                        <input type="date" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" 
                          value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Hasta</label>
                        <input type="date" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white" 
                          value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                      </div>
                      
                      <div className="pt-3 mt-2 border-t border-slate-800 space-y-2">
                        <button onClick={() => setMostrarFiltro(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
                          Aplicar Filtro
                        </button>
                        <button 
                          onClick={exportarGastosExcel} 
                          disabled={loading || historial.length === 0}
                          className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FileText size={14} /> Exportar a Excel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setMostrarFormulario(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
                <PlusCircle size={14} /> Registrar
              </button>
            </div>
          </header>

          {rolUsuario === 'administrador' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 animate-in fade-in">
              <TarjetaDato 
                titulo="Egreso en Rango" 
                valor={`$${metricas.totalPeriodo.toLocaleString('es-MX', {minimumFractionDigits: 2})}`} 
                color="blue" 
              />
              <TarjetaDato 
                titulo="Registros" 
                valor={metricas.conteo.toString()} 
                color="blue" 
              />
            </div>
          )}

          {/* TABLA DE HISTORIAL ESTANDARIZADA (DISEÑO TIPO FACTURAS) */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-[12px] font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-8 font-normal w-12">Tipo</th>
                    <th className="p-4 font-normal">Folio y Origen</th>
                    <th className="p-4 font-normal">Detalle del Gasto</th>
                    <th className="p-4 font-normal">Unidad</th>
                    <th className="p-4 font-normal">Fecha</th>
                    <th className="p-4 font-normal">Monto Total</th>
                    <th className="p-4 pr-8 text-right font-normal">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {historial.map((item) => {
                    const vieneDeViaje = item.viaje_id !== null;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                        
                        {/* COLUMNA 1: TIPO (ÍCONO) */}
                        <td className="p-4 pl-8 align-middle">
                          <button title={item.tipo} className={`p-2 rounded-lg transition-all cursor-default ${item.tipo === 'Correctivo' ? 'bg-red-500/10 text-red-500' : (item.tipo === 'Combustible' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400')}`}>
                            {item.tipo === 'Combustible' ? <Fuel size={18} /> : <Wrench size={18} />}
                          </button>
                        </td>

                        {/* COLUMNA 2: FOLIO Y ORIGEN */}
                        <td className="p-4 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[14px] text-white font-mono font-medium">
                              {item.folio_interno ? `G-${String(item.folio_interno).padStart(4, '0')}` : 'G-S/N'}
                            </span>
                            
                            {vieneDeViaje ? (
                              <span className="inline-flex px-2 py-0.5 rounded bg-blue-900/30 border border-blue-500/30 text-blue-400 uppercase tracking-widest text-[9px] items-center gap-1 mt-0.5">
                                <Truck size={8}/> VIAJE: {item.viajes?.folio_interno ? `V-${String(item.viajes?.folio_interno).padStart(4, '0')}` : 'V-S/N'}
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 uppercase tracking-widest text-[9px] items-center gap-1 mt-0.5">
                                Gasto General
                              </span>
                            )}
                          </div>
                        </td>

                        {/* COLUMNA 3: DETALLE DEL GASTO */}
                        <td className="p-4 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white truncate max-w-[200px]" title={item.descripcion}>{item.descripcion}</span>
                            <span className="text-slate-500 text-[11px] font-mono uppercase tracking-widest">
                              {item.tipo}
                            </span>
                          </div>
                        </td>

                        {/* COLUMNA 4: UNIDAD */}
                        <td className="p-4 align-middle max-w-[200px]">
                          {item.unidades?.numero_economico ? (
                            <span className="text-slate-300 text-[12px] truncate block font-mono">ECO: {item.unidades.numero_economico}</span>
                          ) : (
                            <span className="text-slate-600 text-[12px] truncate block font-mono">---</span>
                          )}
                        </td>

                        {/* COLUMNA 5: FECHA */}
                        <td className="p-4 align-middle">
                           <span className="text-[12px] text-slate-300">
                             {item.fecha?.slice(0, 10) || 'S/F'}
                           </span>
                        </td>

                        {/* COLUMNA 6: MONTO TOTAL */}
                        <td className="p-4 align-middle">
                          <span className="text-[14px] font-mono font-medium text-white">
                            ${Number(item.costo).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </span>
                        </td>

                        {/* COLUMNA 7: ACCIONES */}
                        <td className="p-4 pr-8 align-middle">
                          <div className="flex items-center justify-end gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => eliminarGasto(item.id)} title={vieneDeViaje ? "Borrar desde Viajes" : "Eliminar"} className={`p-2 transition-colors rounded-lg ${vieneDeViaje ? 'text-slate-700 cursor-not-allowed' : 'text-slate-600 hover:text-red-500 hover:bg-red-500/10'}`}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-16 text-center">
                        <Wrench size={32} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-500 uppercase tracking-widest text-sm">Sin registros en este periodo</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {mostrarFormulario && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setMostrarFormulario(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
                <button onClick={() => setMostrarFormulario(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Nuevo <span className="text-blue-500">Egreso</span></h2>
                <form onSubmit={registrarGasto} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <select required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white"
                      value={formData.unidad_id} onChange={e => setFormData({...formData, unidad_id: e.target.value})}>
                      <option value="">Unidad (Opcional si es Gasto General)...</option>
                      {unidades.map(u => <option key={u.id} value={u.id}>{u.numero_economico}</option>)}
                    </select>
                    
                    <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white focus:border-blue-500 outline-none"
                      value={formData.viaje_id} onChange={e => setFormData({...formData, viaje_id: e.target.value})}>
                      <option value="">-- Sin Viaje Asignado (Gasto General) --</option>
                      {viajesActivos.map(v => <option key={v.id} value={v.id}>Viaje V-{String(v.folio_interno).padStart(4, '0')} {v.ruta ? `(${v.ruta})` : ''}</option>)}
                    </select>

                    <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white"
                      value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                      <option value="Preventivo">Preventivo</option>
                      <option value="Correctivo">Correctivo</option>
                      <option value="Combustible">Combustible</option>
                      <option value="Otros">Otros</option>
                    </select>

                    <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                      value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Descripción" />
                    
                    <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white font-mono" 
                      value={formData.costo} onChange={e => setFormData({...formData, costo: e.target.value})} placeholder="0.00" />
                    
                    <input type="date" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white" 
                      value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all flex justify-center items-center gap-2">
                    {loading ? "Sincronizando..." : "Confirmar Egreso"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}