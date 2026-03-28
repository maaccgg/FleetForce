'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '@/components/sidebar';
import { 
  Users, ShieldCheck, UserPlus, X, Mail, Lock, User as UserIcon, Loader2, Edit2, Power, PowerOff, MoreVertical, Trash2, Send
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

  const formInicial = { nombre_completo: '', email: '', rol: 'miembro' };
  const [formData, setFormData] = useState(formInicial);

  useEffect(() => {
    const inicializar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return window.location.href = '/';
      setSesion(session);

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id, rol')
        .eq('id', session.user.id)
        .single();

      if (perfil?.rol !== 'administrador') {
        router.push('/'); 
        return;
      }

      const idMaestro = perfil?.empresa_id || session.user.id;
      setEmpresaId(idMaestro);
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
    else cargarEquipo(empresaId);
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
      rol: user.rol || 'miembro'
    });
    setEditandoId(user.id);
    setMostrarModal(true);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-200 w-full">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          <header className="mb-10 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none flex items-center gap-3">
                 <Users className="text-blue-500" size={32} /> Gestión de <span className="text-blue-500">Equipo</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 ml-11">
                Control de accesos y estatus operativo
              </p>
            </div>
            <button onClick={() => { setFormData(formInicial); setEditandoId(null); setMostrarModal(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 shadow-lg transition-all">
              <UserPlus size={16} /> Nueva Credencial
            </button>
          </header>

          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-[12px] font-semibold uppercase tracking-wider">
                    <th className="p-4 pl-8 font-normal">Identidad</th>
                    <th className="p-4 font-normal">Nivel de Acceso</th>
                    <th className="p-4 font-normal">ID Sistema</th>
                    <th className="p-4 pr-8 text-right font-normal">Estatus / Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {equipo.map((user) => (
                    <tr key={user.id} className={`hover:bg-slate-800/30 transition-colors group ${!user.activo ? 'opacity-50' : ''}`}>
                      <td className="p-4 pl-8 align-middle">
                        <div className="flex flex-col">
                          <span className="text-white font-bold lowercase">{user.nombre_completo || 'Sin nombre'}</span>
                          <span className="text-slate-500 text-[11px] font-mono lowercase">{user.email}</span>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <span className={`inline-flex px-3 py-1 rounded-lg border uppercase tracking-widest text-[9px] font-black items-center gap-1 ${user.rol === 'administrador' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                          {user.rol === 'administrador' ? <ShieldCheck size={12}/> : <UserIcon size={12}/>}
                          {user.rol}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-slate-600 font-mono text-[10px] bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          {user.id.split('-')[0]}...
                        </span>
                      </td>
                      <td className="p-4 pr-8 align-middle text-right relative">
                        <div className="flex items-center justify-end gap-2">
                          
                          {!user.registro_completado ? (
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-yellow-500/10 border-yellow-500/20 text-yellow-500 text-[9px] font-black uppercase tracking-widest cursor-default">
                              <Mail size={12}/> Pendiente
                            </span>
                          ) : (
                            <button 
                              onClick={() => alternarEstatus(user)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${user.activo ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-500'}`}
                            >
                              {user.activo ? <><Power size={12}/> Activo</> : <><PowerOff size={12}/> Inactivo</>}
                            </button>
                          )}

                          <button onClick={() => abrirEdicion(user)} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>

                          <div className="relative">
                            <button onClick={() => toggleMenu(user.id)} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <MoreVertical size={14} />
                            </button>
                            
{menuAbiertoId === user.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-xl shadow-2xl z-50 border border-slate-700 overflow-hidden">
                                <button onClick={() => reenviarInvitacion(user)} className="flex items-center gap-3 w-full text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-700 transition-colors">
                                  <Send size={14}/> Reenviar Link
                                </button>
                                {/* El botón de eliminar fue extirpado de aquí */}
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setMostrarModal(false)} />
              <div className="relative bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
                <button onClick={() => setMostrarModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X size={20} /></button>
                <h2 className="text-xl font-black text-white italic uppercase mb-6 flex items-center gap-2">
                  <Lock className="text-blue-500" size={20}/> 
                  {editandoId ? 'Actualizar' : 'Generar'} <span className="text-blue-500">Credencial</span>
                </h2>
                
                <form onSubmit={guardarUsuario} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nombre Completo</label>
                    <input required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white focus:border-blue-500 outline-none" 
                      value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} placeholder="ej. juan pérez" />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Correo (Usuario)</label>
                    <input required type="email" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white focus:border-blue-500 outline-none lowercase" 
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="ejemplo@maccgg.com" />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nivel de Acceso</label>
                    <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-white font-bold uppercase"
                      value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                      <option value="miembro">Miembro (Operación)</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </div>

                  <button type="submit" disabled={procesando} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all mt-4">
                    {procesando ? "Procesando..." : (editandoId ? "Actualizar Datos" : "Enviar Invitación")}
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