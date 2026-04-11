'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/sidebar';
import { 
  Users, ShieldCheck, UserPlus, X, Mail, Lock, User as UserIcon, Loader2, Edit2, Power, PowerOff, MoreVertical, Trash2, Send, Receipt, Crown
} from 'lucide-react';

export default function EquipoPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);

  const [planActual, setPlanActual] = useState('inicio');
  const [limiteUsuarios, setLimiteUsuarios] = useState(1);

  const formInicial = { nombre_completo: '', email: '', rol: 'operaciones' };
  const [formData, setFormData] = useState(formInicial);

  const LIMITES_POR_PLAN = {
    'inicio': 1,
    'flotilla': 2,
    'completo': 3
  };

  useEffect(() => {
    const inicializar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return window.location.href = '/';
      setSesion(session);

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id, rol, plan_suscripcion')
        .eq('id', session.user.id)
        .single();

      if (perfil?.rol !== 'administrador') {
        router.push('/'); 
        return;
      }

      const idMaestro = perfil?.empresa_id || session.user.id;
      const plan = perfil?.plan_suscripcion?.toLowerCase() || 'inicio';
      
      setEmpresaId(idMaestro);
      setPlanActual(plan);
      setLimiteUsuarios(LIMITES_POR_PLAN[plan] || 1);
      
      cargarEquipo(idMaestro);
    };
    inicializar();
  }, [router]);

  async function cargarEquipo(idMaestro) {
    setLoading(true);
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .or(`id.eq.${idMaestro},empresa_id.eq.${idMaestro}`)
      .order('created_at', { ascending: true });
    
    if (!error) setEquipo(data || []);
    setLoading(false);
  }

  const alternarEstatus = async (usuario) => {
    if (usuario.id === sesion.user.id) {
      alert("⚠️ Seguridad: No puedes desactivar tu propia cuenta de administrador.");
      return;
    }

    const nuevoEstado = !usuario.activo;
    const confirmacion = confirm(`¿Estás seguro de ${nuevoEstado ? 'activar' : 'desactivar'} el acceso para ${usuario.nombre_completo}?`);
    
    if (!confirmacion) return;

    const { error } = await supabase
      .from('perfiles')
      .update({ activo: nuevoEstado })
      .eq('id', usuario.id);

    if (error) alert("Error: " + error.message);
    else cargarEquipo(idMaestro);
  };

  const toggleMenu = (id) => {
    setMenuAbiertoId(menuAbiertoId === id ? null : id);
  };

  const reenviarInvitacion = async (user) => {
    setMenuAbiertoId(null);
    if (!confirm(`¿Reenviar correo de invitación a ${user.email}?`)) return;
    
    try {
      const res = await fetch('/api/reenviar-invitacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      if (!res.ok) throw new Error('Falla al reenviar el correo.');
      alert('Invitación reenviada con éxito.');
    } catch (error) {
      alert(error.message);
    }
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");

      if (editandoId) {
        const { error } = await supabase
          .from('perfiles')
          .update({
            nombre_completo: formData.nombre_completo.trim(), 
            email: formData.email.trim().toLowerCase(), 
            rol: formData.rol
          })
          .eq('id', editandoId);
        if (error) throw error;
      } else {
        const response = await fetch('/api/crear-usuario', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}` 
          },
          body: JSON.stringify({ 
            nombre_completo: formData.nombre_completo.trim(), 
            email: formData.email.trim().toLowerCase(),
            rol: formData.rol,
            empresa_id: empresaId 
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
      }
      setMostrarModal(false);
      cargarEquipo(empresaId);
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const abrirEdicion = (user) => {
    setFormData({
      nombre_completo: user.nombre_completo || '',
      email: user.email || '',
      rol: user.rol || 'operaciones'
    });
    setEditandoId(user.id);
    setMostrarModal(true);
  };

  const limiteAlcanzado = equipo.length >= limiteUsuarios;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors">
      <Loader2 className="animate-spin text-blue-600 dark:text-blue-500" size={40} />
    </div>
  );

  return (
    <div className="flex bg-transparent min-h-screen text-slate-900 dark:text-slate-200 w-full transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 dark:border-slate-800 pb-6 gap-4 transition-colors">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white leading-none flex items-center gap-3 transition-colors">
                 <Users className="text-blue-600 dark:text-blue-500" size={32} /> Gestión de <span className="text-blue-600 dark:text-blue-500">Equipo</span>
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 transition-colors">
                  Plan: <span className="text-blue-600 dark:text-blue-400 font-black">{planActual}</span>
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-colors ${limiteAlcanzado ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'}`}>
                   Cupo: {equipo.length}/{limiteUsuarios} Usuarios
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
              {limiteAlcanzado && !editandoId ? (
                <>
                  <button disabled className="w-full md:w-auto bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 px-6 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 cursor-not-allowed transition-colors">
                    <Lock size={16} /> Límite del Plan
                  </button>
                  <span className="text-orange-600 dark:text-orange-500 text-[9px] font-black uppercase tracking-widest animate-pulse">Upgrade Sugerido</span>
                </>
              ) : (
                <button onClick={() => { setFormData(formInicial); setEditandoId(null); setMostrarModal(true); }} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
                  <UserPlus size={16} /> Nueva Credencial
                </button>
              )}
            </div>
          </header>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[12px] font-semibold uppercase tracking-wider transition-colors">
                    <th className="p-4 pl-8 font-normal">Identidad</th>
                    <th className="p-4 font-normal">Nivel de Acceso</th>
                    <th className="p-4 font-normal">ID Sistema</th>
                    <th className="p-4 pr-8 text-right font-normal">Estatus / Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors">
                  {equipo.map((user) => (
                    <tr key={user.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${!user.activo ? 'opacity-50' : ''}`}>
                      <td className="p-4 pl-8 align-middle">
                        <div className="flex flex-col">
                          <span className="text-slate-900 dark:text-white font-bold uppercase text-[12px] transition-colors">{user.nombre_completo || 'Sin nombre'}</span>
                          <span className="text-slate-500 dark:text-slate-500 text-[11px] font-mono lowercase transition-colors">{user.email}</span>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <span className={`inline-flex px-3 py-1 rounded-lg border uppercase tracking-widest text-[9px] font-black items-center gap-1 transition-colors
                          ${user.rol === 'administrador' ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-700 dark:text-orange-400' : 
                            user.rol === 'facturacion' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 
                            'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'}`}>
                          {user.rol === 'administrador' ? <ShieldCheck size={12}/> : user.rol === 'facturacion' ? <Receipt size={12}/> : <UserIcon size={12}/>}
                          {user.rol}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-slate-400 dark:text-slate-600 font-mono text-[10px] bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 transition-colors">
                          {user.id.split('-')[0]}...
                        </span>
                      </td>
                      <td className="p-4 pr-8 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          
                          {!user.registro_completado ? (
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-amber-50 dark:bg-yellow-500/10 border-amber-200 dark:border-yellow-500/20 text-amber-700 dark:text-yellow-500 text-[9px] font-black uppercase tracking-widest cursor-default transition-colors">
                              <Mail size={12}/> Pendiente
                            </span>
                          ) : (
                            <button 
                              onClick={() => alternarEstatus(user)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${user.activo ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/20' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-500'}`}
                            >
                              {user.activo ? <><Power size={12}/> Activo</> : <><PowerOff size={12}/> Inactivo</>}
                            </button>
                          )}

                          <button onClick={() => abrirEdicion(user)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>

                          <div className="relative">
                            <button onClick={() => toggleMenu(user.id)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors focus:outline-none">
                              <MoreVertical size={14} />
                            </button>
                            
                            {menuAbiertoId === user.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl dark:shadow-2xl z-50 border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 transition-colors">
                                <button onClick={() => reenviarInvitacion(user)} className="flex items-center gap-3 w-full text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                  <Send size={14}/> Reenviar Link
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {mostrarModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/90 backdrop-blur-sm transition-colors" onClick={() => setMostrarModal(false)} />
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 transition-colors">
                <button onClick={() => setMostrarModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors"><X size={20} /></button>
                <h2 className="text-xl font-black text-slate-900 dark:text-white italic uppercase mb-6 flex items-center gap-2 transition-colors">
                  <Lock className="text-blue-600 dark:text-blue-500" size={20}/> 
                  {editandoId ? 'Actualizar' : 'Generar'} <span className="text-blue-600 dark:text-blue-500">Credencial</span>
                </h2>
                
                <form onSubmit={guardarUsuario} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Nombre Completo</label>
                    <input required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-sm text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-colors" 
                      value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} placeholder="Ej. Juan Pérez" />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Correo Electrónico</label>
                    <input required type="email" disabled={!!editandoId} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-sm text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-500 outline-none lowercase disabled:opacity-50 transition-colors" 
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="usuario@empresa.com" />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 transition-colors">Nivel de Acceso</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-sm text-slate-900 dark:text-white font-bold uppercase focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-colors cursor-pointer"
                      value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                      <option value="operaciones">Operaciones (Logística)</option>
                      <option value="facturacion">Facturación y Cobranza</option>
                      <option value="administrador">Administrador Total</option>
                    </select>
                  </div>

                  <button type="submit" disabled={procesando} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-900/20 transition-all mt-4">
                    {procesando ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={14} /> Sincronizando...
                      </div>
                    ) : (editandoId ? "Actualizar Datos" : "Enviar Invitación")}
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