'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { DollarSign, ArrowDownCircle, ArrowUpCircle, TrendingUp } from 'lucide-react';

export default function DineroPage() {
  return (
    <div className="p-8">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          Gestión de <span className="text-green-500">Capital</span>
        </h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Institución - Flujo de Efectivo</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Formulario de Gastos/Ingresos */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-4xl shadow-2xl">
          <h2 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-6">Registrar Movimiento</h2>
          <div className="space-y-4">
            <input placeholder="Concepto (ej. Diésel, Casetas)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-green-500" />
            <input type="number" placeholder="Monto ($)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-green-500" />
            <div className="grid grid-cols-2 gap-4">
              <button className="bg-green-600/10 border border-green-600/20 text-green-500 py-4 rounded-2xl font-black uppercase text-xs hover:bg-green-600 hover:text-white transition-all">Ingreso</button>
              <button className="bg-red-600/10 border border-red-600/20 text-red-500 py-4 rounded-2xl font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all">Gasto</button>
            </div>
          </div>
        </div>

        {/* Resumen de Utilidad */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-4xl flex flex-col justify-center items-center text-center">
          <TrendingUp size={48} className="text-blue-500 mb-4" />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Utilidad Neta Proyectada</p>
          <h2 className="text-5xl font-black text-white mt-2">$0.00</h2>
          <p className="text-[10px] text-slate-600 mt-4 italic">"My authority generates wealth"</p>
        </div>
      </div>
    </div>
  );
}