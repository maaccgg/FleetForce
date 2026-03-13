'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Truck, PlusCircle, Trash2, Edit2, X, 
  ShieldCheck, Hash, Calendar, FileText, Info
} from 'lucide-react';
import Sidebar from '@/components/sidebar';

export default function UnidadesPage() {
  const [sesion, setSesion] = useState(null);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [formData, setFormData] = useState({
    numero_economico: '',
    placas: '',
    permiso_sict: 'TPAF01',
    num_permiso_sict: '',
    configuracion_vehicular: '',
    anio_modelo: '',
    aseguradora_rc: '',
    poliza_rc: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSesion(session);
        obtenerUnidades(session.user.id);
      }
    });
  }, []);

  async function obtenerUnidades(userId) {
    setLoading(true);
    const { data } = await supabase.from('unidades').select('*').eq('usuario_id', userId).order('created_at');
    setUnidades(data || []);
    setLoading(false);
  }

  const guardarUnidad = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...formData, usuario_id: sesion.user.id, placas: formData.placas.toUpperCase() };

    const { error } = editandoId 
      ? await supabase.from('unidades').update(payload).eq('id', editandoId)
      : await supabase.from('unidades').insert([payload]);

    if (error) {
      console.error("Error detallado:", error);
      alert("Error al guardar en base de datos. Verifica que las columnas existan en Supabase.");
    } else {
      cerrarModal();
      obtenerUnidades(sesion.user.id);
    }
    setLoading(false);
  };

  const eliminarUnidad = async (id) => {
    if (!confirm("¿Deseas eliminar esta unidad?")) return;
    await supabase.from('unidades').delete().eq('id', id);
    obtenerUnidades(sesion.user.id);
  };

  // ESTA FUNCIÓN SOLUCIONA EL ERROR DE "UNCONTROLLED INPUT"
  const prepararEdicion = (u) => {
    setEditandoId(u.id);
    setFormData({
      numero_economico: u.numero_economico || '',
      placas: u.placas || '',
      permiso_sict: u.permiso_sict || 'TPAF01',
      num_permiso_sict: u.num_permiso_sict || '',
      configuracion_vehicular: u.configuracion_vehicular || '',
      anio_modelo: u.anio_modelo || '',
      aseguradora_rc: u.aseguradora_rc || '', // Si es null, usa ''
      poliza_rc: u.poliza_rc || ''            // Si es null, usa ''
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setEditandoId(null);
    setFormData({ 
      numero_economico: '', placas: '', permiso_sict: 'TPAF01', 
      num_permiso_sict: '', configuracion_vehicular: '', 
      anio_modelo: '', aseguradora_rc: '', poliza_rc: '' 
    });
  };

  if (!sesion) return null;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <header className="mb-10 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">
                Flota de <span className="text-blue-500">Unidades</span>
              </h1>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-2">Activos Vehiculares y Seguros</p>
            </div>
            <button onClick={() => setMostrarModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">
              <PlusCircle size={16} /> Alta de Unidad
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unidades.map((u) => (
              <div key={u.id} className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2.5rem] group hover:border-blue-500/30 transition-all backdrop-blur-sm">
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-slate-950 p-4 rounded-2xl text-blue-500 shadow-inner">
                    <Truck size={24} />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => prepararEdicion(u)} className="p-2 bg-slate-950 text-slate-500 hover:text-blue-500 rounded-lg"><Edit2 size={14}/></button>
                    <button onClick={() => eliminarUnidad(u.id)} className="p-2 bg-slate-950 text-slate-500 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic">Eco: {u.numero_economico}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Placas: <span className="text-slate-300">{u.placas}</span></p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <ShieldCheck size={12} className="text-green-500" />
                      <span className="text-[9px] font-bold uppercase truncate">{u.aseguradora_rc || 'Sin Seguro'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar size={12} className="text-blue-500" />
                      <span className="text-[9px] font-bold uppercase">Modelo: {u.anio_modelo || '---'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {mostrarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={cerrarModal} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
                <button onClick={cerrarModal} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
                <h2 className="text-2xl font-black text-white italic uppercase mb-8">Datos Técnicos de <span className="text-blue-500">Unidad</span></h2>
                
                <form onSubmit={guardarUnidad} className="space-y-8">
                  <div className="grid grid-cols-2 gap-4 p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                    <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Identificación Vehicular</div>
                    <input required placeholder="Número Económico" className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold"
                      value={formData.numero_economico} onChange={e => setFormData({...formData, numero_economico: e.target.value})} />
                    <input required placeholder="Placas" className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase font-mono"
                      value={formData.placas} onChange={e => setFormData({...formData, placas: e.target.value})} />
                    <input placeholder="Año Modelo (Ej: 2022)" className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.anio_modelo} onChange={e => setFormData({...formData, anio_modelo: e.target.value})} />
                    
                    {/* 👇 AQUÍ ESTÁ LA LISTA COMPLETA DE CAMIONES 👇 */}
                    <select required className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold"
                      value={formData.configuracion_vehicular} onChange={e => setFormData({...formData, configuracion_vehicular: e.target.value})}>
                      <option value="">-- Seleccionar Camión --</option>
                      <option value="VL">VL (Vehículo Ligero / Pick-up / Estaquitas)</option>
                      <option value="C2">C2 (Camión Rabón / 2 ejes)</option>
                      <option value="C3">C3 (Camión Torton / 3 ejes)</option>
                      <option value="C2R2">C2R2 (Camión Remolque / 4 ejes)</option>
                      <option value="T2S1">T2S1 (Tractocamión con caja / 3 ejes)</option>
                      <option value="T2S2">T2S2 (Tractocamión con caja / 4 ejes)</option>
                      <option value="T3S1">T3S1 (Tractocamión con caja / 4 ejes)</option>
                      <option value="T3S2">T3S2 (Tráiler Estándar / 5 ejes)</option>
                      <option value="T3S2R4">T3S2R4 (Tráiler Full / Doble Remolque)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-6 bg-blue-600/5 rounded-2xl border border-blue-500/10">
                    <div className="col-span-2 text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Permisos y Pólizas (SAT 3.1)</div>
                    <select className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white font-bold"
                      value={formData.permiso_sict} onChange={e => setFormData({...formData, permiso_sict: e.target.value})}>
                      <option value="TPAF01">Autotransporte Federal Carga</option>
                      <option value="TPXX00">Permiso No Requerido</option>
                    </select>
                    <input placeholder="Num. Permiso SICT" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.num_permiso_sict} onChange={e => setFormData({...formData, num_permiso_sict: e.target.value})} />
                    <input placeholder="Nombre Aseguradora RC" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white uppercase"
                      value={formData.aseguradora_rc} onChange={e => setFormData({...formData, aseguradora_rc: e.target.value})} />
                    <input placeholder="Número de Póliza" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-white"
                      value={formData.poliza_rc} onChange={e => setFormData({...formData, poliza_rc: e.target.value})} />
                  </div>

                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-500 transition-all flex justify-center items-center gap-2">
                    <ShieldCheck size={18} /> {loading ? "Sincronizando..." : "Guardar Configuración Técnica"}
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