import { Menu, Bell } from "lucide-react";

export default function Topbar({ setSidebarOpen }) {
  return (
    <header className="h-16 glass border-b border-[var(--glass-border)] flex items-center justify-between px-4 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:block text-sm text-slate-400 font-medium">
          Dashboard / Overview
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-sm font-semibold border border-white/10 shadow-lg cursor-pointer hover:opacity-90">
          A
        </div>
      </div>
    </header>
  );
}
