import { Home, HardHat, FileText, Settings, X, Activity, LogOut } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";

const navItems = [
  { name: "Dashboard", path: "/", icon: Home },
  { name: "Cantieri", path: "/cantieri", icon: HardHat },
  { name: "Report", path: "/report", icon: FileText },
  { name: "Spese", path: "/spese", icon: Activity },
  { name: "Impostazioni", path: "/settings", icon: Settings },
];

export default function Sidebar({ isOpen, setIsOpen, onLogout }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 glass flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 border-r border-[var(--glass-border)]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--glass-border)]">
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Fabdar ERP
          </span>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={18} className={cn(
                  "transition-colors",
                  isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {onLogout && (
          <div className="p-4 border-t border-[var(--glass-border)]">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
