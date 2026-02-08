'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ReceiptText, Plus, X, Search, DollarSign, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function FacturasPage() {
  const [facturas, setFacturas] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ cliente: '', monto: '', folio: '', estatus: 'Pendiente' });

  const fetchFacturas = async () => {
    const { data } = await supabase.from('facturas').select('*').order('created_at', { ascending: false });
    if (data) setFacturas(data);
  };

  useEffect(() => { fetchFacturas(); }, []);

  const handleCrearFactura = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('facturas').insert([{
      cliente: formData.cliente,
      monto_total: parseFloat(formData.monto),
      folio_fiscal: formData.folio,
      estatus_pago: formData.estatus
    }]);

    if (!error) {
      setShowModal(false);
      fetchFacturas();
      setFormData({ cliente: '', monto: '', folio: '', estatus: 'Pendiente' });
    } else {
      alert("Error al generar folio: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white italic tracking-tight">Gestión de Facturación</h1>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mt-1">Control de Ingresos e Institución</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all"
        >
          <Plus size={20} /> Generar Factura
        </button>
      </header>

      {/* LISTADO DE FACTURAS */}
      <div className="grid grid-cols-1 gap-4">
        {facturas.map((f) => (
          <div key={f.id} className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl flex items-center justify-between group hover:border-blue-500/50 transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-slate-800 p-4 rounded-2xl text-slate-400 group-hover:text-blue-400">
                <ReceiptText size={24} />
              </div>
              <div>
                <h3 className="text-white font-black text-lg uppercase tracking-tighter">Folio: {f.folio_fiscal}</h3>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">{f.cliente}</p>
              </div>
            </div>

            <div className="flex items-center gap-10">
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-black uppercase">Monto Total</p>
                <p className="text-2xl font-mono font-bold text-white">${f.monto_total?.toLocaleString()}</p>
              </div>

              {/* DIV DE ESTATUS DINÁMICO */}
              <div className={`w-32 py-3 rounded-2xl border text-center flex flex-col items-center gap-1 ${
                f.estatus_pago === 'Pagado' 
                ? 'bg-green-500/10 border-green-500/20 text-green-500' 
                : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
              }`}>
                {f.estatus_pago === 'Pagado' ? <CheckCircle2 size={16}/> : <Clock size={16}/>}
                <span className="text-[10px] font-black uppercase tracking-widest">{f.estatus_pago}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL PARA NUEVA FACTURA */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-white italic uppercase tracking-widest">Nueva Factura</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleCrearFactura} className="space-y-4">
              <input 
                placeholder="Folio (ej. F-1001)" 
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500"
                onChange={(e) => setFormData({...formData, folio: e.target.value})} required
              />
              <input 
                placeholder="Nombre del Cliente" 
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500"
                onChange={(e) => setFormData({...formData, cliente: e.target.value})} required
              />
              <input 
                type="number" placeholder="Monto total ($MXN)" 
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500"
                onChange={(e) => setFormData({...formData, monto: e.target.value})} required
              />
              <select 
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500"
                onChange={(e) => setFormData({...formData, estatus: e.target.value})}
              >
                <option value="Pendiente">Pendiente</option>
                <option value="Pagado">Pagado</option>
              </select>
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-3xl transition-all uppercase tracking-[0.2em] shadow-lg shadow-blue-900/40">
                Registrar Ingreso
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}