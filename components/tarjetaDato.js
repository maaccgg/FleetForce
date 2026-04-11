// components/tarjetaDato.js

export default function TarjetaDato({ titulo, valor, color = "slate" }) {
  // Se agregan las paletas duales (Modo Claro / Modo Oscuro) y la variante 'emerald'
  const estilosColor = {
    blue: "border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-transparent",
    green: "border-green-200 dark:border-green-500/50 text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-transparent",
    emerald: "border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-transparent",
    red: "border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-transparent",
    slate: "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-transparent"
  };

  // Validación de seguridad por si en el futuro pasas un color que no existe
  const colorAplicado = estilosColor[color] || estilosColor.slate;

  return (
    <div className={`border ${colorAplicado} p-6 sm:p-8 rounded-[2rem] shadow-sm dark:shadow-lg transition-all duration-300 hover:scale-[1.02] flex flex-col justify-center`}>
      <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-80 transition-colors">
        {titulo}
      </h3>
      <p className="text-3xl sm:text-4xl font-black mt-2 text-slate-900 dark:text-white italic tracking-tighter transition-colors">
        {valor}
      </p>
    </div>
  );
}