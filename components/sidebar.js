'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; 
import { 
  LayoutDashboard, 
  Wrench, 
  FileCheck, 
  DollarSign,
  Map, 
  ReceiptText, 
  Scale, 
  Truck,
  LogOut,
  TrendingUp,
  Settings,
  History,
  ChevronDown,
  ChevronUp,
  Users
} from 'lucide-react';

const menuItems = [
  { name: 'Inicio', href: '/', icon: LayoutDashboard },
  { name: 'Viajes', href: '/viajes', icon: FileCheck},
  { name: 'Facturas', href: '/facturas', icon: ReceiptText },
  { name: 'Gasto operativo', href: '/gastos', icon: TrendingUp },
  { name: 'Unidades', href: '/unidades', icon: Truck },
  { name: 'Info - SAT Carta porte', href: '/sat', icon: Scale },
  { name: 'Rutas', href: '/rutas', icon: Map },
];

export default function Sidebar() {
  const pathname = usePathname();
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [rolUsuario, setRolUsuario] = useState('miembro');

  useEffect(() => {
    const obtenerRol = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();
        
        if (data?.rol) setRolUsuario(data.rol);
      }
    };
    obtenerRol();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; 
  };

  return (
    <nav className="w-64 h-screen p-6 border-r border-slate-800 bg-slate-950 flex flex-col gap-2 sticky top-0 overflow-y-auto">
      
      {/* SECCIÓN DEL LOGOTIPO ACTUALIZADA */}
{/* SECCIÓN DEL LOGOTIPO (CÓDIGO PURO) */}
      <div className="mb-8 px-2 flex flex-col items-start select-none">
        <div className="flex items-center gap-2 mb-1">
          {/* El ícono del camión en verde */}
          <Truck size={28} className="text-emerald-500" strokeWidth={2} />
          
          {/* El texto de FleetForce */}
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">
            Fleet<span className="font-bold text-slate-300">Force</span>
          </h1>
        </div>
        
        {/* El subtítulo */}
        <p className="text-[9px] text-slate-600 font-bold uppercase ml-1 tracking-widest mt-1">
          Gestión 2026
        </p>
      </div>

      <div className="flex flex-col gap-1 flex-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.name} 
              href={item.href} 
              className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                isActive 
                ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <item.icon 
                size={20} 
                className={isActive ? 'text-blue-400' : 'group-hover:text-blue-400 transition-colors'} 
              />
              <span className={`font-bold text-sm ${isActive ? 'text-blue-400' : ''}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>

      {/* SECCIÓN INFERIOR: MANTRA Y CONFIGURACIÓN */}
      <div className="mt-auto pt-6 border-t border-slate-800/50 px-1 space-y-4 pb-2">
        <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest italic leading-relaxed px-2">
          "Version BETA 1.0.1"
        </p>
        
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => setIsConfigOpen(!isConfigOpen)} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isConfigOpen ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
          >
            <div className="flex items-center gap-2">
              <Settings size={14} className={isConfigOpen ? "text-blue-400" : ""} />
              Configuración
            </div>
            {isConfigOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isConfigOpen && (
            <div className="flex flex-col gap-1 pl-2 border-l-2 border-slate-800 ml-2 animate-in fade-in slide-in-from-top-2">
              
              {rolUsuario === 'administrador' && (
                <>
                  <Link href="/historico" className="flex items-center gap-2 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                    <History size={14} />
                    Revisar Históricos
                  </Link>
                  <Link href="/equipo" className="flex items-center gap-2 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                    <Users size={14} />
                    Gestionar Equipo
                  </Link>
                </>
              )}
              
              <button onClick={handleSignOut} className="w-full flex items-center gap-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                <LogOut size={14} />
                Cerrar Sesión
              </button>
              
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}