import { Activity, DollarSign, Users, Briefcase } from "lucide-react";

export default function Dashboard() {
  const stats = [
    { label: "Cantieri Attivi", value: "12", icon: Briefcase, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Dipendenti", value: "24", icon: Users, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Spese Mese", value: "€ 45,200", icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "WBS Completi", value: "8", icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-white mb-8">Dashboard Job Costing</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="glass-card p-6 flex flex-col justify-between overflow-hidden relative group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500"></div>
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <span className="text-slate-400 font-medium text-sm">{s.label}</span>
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <Icon size={20} className={s.color} />
                </div>
              </div>
              <div className="text-3xl font-bold text-white relative z-10">{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="glass-card mt-8 p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
        <h2 className="text-xl font-semibold text-white mb-4 relative z-10">Avanzamento Gerarchico WBS</h2>
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-4 relative z-10">
          <Activity size={48} className="text-primary/50" />
          <p>Il cruscotto WBS Cost-to-Cost verrà renderizzato in quest'area.</p>
        </div>
      </div>
    </div>
  );
}
