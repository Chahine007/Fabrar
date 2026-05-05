import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  FileText, 
  FileStack, 
  Package, 
  Activity, 
  Euro,
  Settings, 
  Search, 
  Bell, 
  MessageSquare, 
  ChevronLeft,
  LogOut,
  Briefcase,
  Menu,
  ClipboardList,
  ChevronDown,
  Truck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useChatSockets, useTotalUnread } from '../../hooks/api/useConversations';
import { useHrAlerts } from '../../hooks/api/useHr';
import { useAuthContext } from '../../context/AuthContext';
import { RoleGuard } from '../auth/RoleGuard';

interface NavItem {
  icon?: React.ElementType;
  label: string;
  path: string;
  id: string;
  roles?: string[];
  subItems?: NavItem[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// --- Configuration ---

const ALL_AUTH_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN', 'WORKER'];
const WAREHOUSE_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN'];

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'DASHBOARD',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', id: 'dashboard', roles: ['ADMIN'] },
    ]
  },
  {
    title: 'OPERATIVITA',
    items: [
      { icon: Briefcase, label: 'Progetti', path: '/projects', id: 'projects' },
      { icon: Activity, label: 'Attività', path: '/activities', id: 'activities' },
      { icon: MessageSquare, label: 'Messaggi', path: '/messages', id: 'messages' },
    ]
  },
  {
    title: 'RISORSE UMANE',
    items: [
      { 
        icon: Users,          
        label: 'Gestione Personale', 
        path: '/hr',          
        id: 'hr',
        roles: ['ADMIN', 'HR']
      },
      { icon: ClipboardList, label: 'Tabulati Orari', path: '/hr/tabulati', id: 'hr-tabulati', roles: ['ADMIN', 'HR'] },
      { icon: ClipboardList, label: 'Le Mie Ore / Spese', path: '/timesheets', id: 'my-timesheets', roles: ['WORKER'] },
    ]
  },
  {
    title: 'LOGISTICA',
    items: [
      { icon: Package,        label: 'Magazzino',           path: '/warehouse',   id: 'warehouse', roles: WAREHOUSE_ROLES },
      { icon: Truck,          label: 'Fornitori',           path: '/suppliers',   id: 'suppliers', roles: WAREHOUSE_ROLES },
      { icon: ClipboardList,  label: 'Richieste Materiali', path: '/material-requests', id: 'material-requests', roles: ALL_AUTH_ROLES },
    ]
  },
  {
    title: 'AMMINISTRAZIONE',
    items: [
      { icon: Euro, label: 'Finanza', path: '/finance', id: 'finance', roles: ['ADMIN'] },
      { icon: FileText, label: 'Fatture', path: '/invoices', id: 'invoices', roles: ['ADMIN', 'PROJECT_MANAGER'] },
      { icon: UserCircle, label: 'Clienti', path: '/clients', id: 'clients', roles: ['ADMIN', 'PROJECT_MANAGER'] },
      { icon: FileStack, label: 'Documenti', path: '/documents', id: 'documents' },
    ]
  }
];

// --- Components ---

const Sidebar = ({ isMobileOpen, setIsMobileOpen, onLogout }: { isMobileOpen: boolean, setIsMobileOpen: (o: boolean) => void, onLogout: () => void }) => {
  const [isLockedExpanded, setIsLockedExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const { user } = useAuthContext();
  const role = user?.role;
  
  const isExpanded = isLockedExpanded || isHovered;

  const visibleNavGroups = React.useMemo(() => {
    const canAccessItem = (item: NavItem) => !item.roles || (!!role && item.roles.includes(role));

    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items
          .map((item) => ({
            ...item,
            subItems: item.subItems?.filter(canAccessItem),
          }))
          .filter(canAccessItem),
      }))
      .filter((group) => group.items.length > 0);
  }, [role]);

  const toggleExpandedItem = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const NavContent = () => (
    <>
      {/* Sidebar Header */}
      <div className={cn(
        "p-6 flex items-center shrink-0",
        !isExpanded ? "justify-center" : "justify-between"
      )}>
        <Link 
          to="/"
          className="flex items-center gap-3 cursor-pointer group/logo"
          onClick={() => setIsMobileOpen(false)}
        >
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold shrink-0 group-hover/logo:scale-110 transition-transform shadow-lg shadow-accent/20">
            <Activity size={20} />
          </div>
          {isExpanded && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xl font-bold text-white tracking-tight"
            >
              ERP Pro
            </motion.span>
          )}
        </Link>
        {isExpanded && !isMobileOpen && (
          <button 
            onClick={() => setIsLockedExpanded(!isLockedExpanded)}
            className="p-1.5 hover:bg-sidebar-hover rounded-lg text-slate-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} className={cn("transition-transform", !isLockedExpanded && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Scrollable Navigation Area */}
      <nav className="flex-1 px-4 space-y-6 mt-4 overflow-y-auto no-scrollbar">
        {visibleNavGroups.map((group, index) => (
          <div key={group.title} className="space-y-2">
            {isExpanded ? (
              <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                {group.title}
              </h3>
            ) : (
              index !== 0 && <div className="h-px bg-slate-700/30 mx-2 my-4" />
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || item.subItems?.some(sub => location.pathname === sub.path);
                const isItemExpanded = expandedItems[item.id];
                
                return (
                  <RoleGuard key={item.id} allowedRoles={item.roles ?? ALL_AUTH_ROLES}>
                    <div className="w-full">
                      <div className="flex items-center relative group">
                        <Link
                          to={item.path}
                          onClick={() => setIsMobileOpen(false)}
                          className={cn(
                            "flex-1 flex items-center rounded-xl transition-all duration-200",
                            !isExpanded ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5",
                            isActive && !item.subItems
                              ? "bg-sidebar-hover text-white shadow-lg" 
                              : isActive && item.subItems
                                ? "text-white"
                                : "hover:bg-sidebar-hover/50 hover:text-white"
                          )}
                        >
                          {item.icon && <item.icon size={18} className={cn(
                            "transition-colors shrink-0",
                            isActive ? "text-accent" : "text-slate-400 group-hover:text-slate-200"
                          )} />}
                          {isExpanded && (
                            <span className="font-medium text-sm truncate">{item.label}</span>
                          )}
                          {!isExpanded && (
                            <div className="absolute left-full ml-2 px-2 py-1 bg-sidebar-hover text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-slate-700">
                              {item.label}
                            </div>
                          )}
                        </Link>
                        
                        {isExpanded && item.subItems && (
                          <button 
                            onClick={(e) => toggleExpandedItem(item.id, e)}
                            className={cn(
                              "absolute right-2 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-sidebar-hover/50 transition-all",
                              isItemExpanded && "rotate-180"
                            )}
                          >
                            <ChevronDown size={16} />
                          </button>
                        )}
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && item.subItems && isItemExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-1 pl-10 pr-2 space-y-1"
                          >
                            {item.subItems.map((subItem) => {
                              const isSubActive = location.pathname === subItem.path;
                              return (
                                <RoleGuard key={subItem.id} allowedRoles={subItem.roles ?? ALL_AUTH_ROLES}>
                                  <Link
                                    to={subItem.path}
                                    onClick={() => setIsMobileOpen(false)}
                                    className={cn(
                                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200",
                                      isSubActive
                                        ? "bg-sidebar-hover text-white shadow-lg"
                                        : "text-slate-400 hover:text-white hover:bg-sidebar-hover/50"
                                    )}
                                  >
                                    {subItem.icon && <subItem.icon size={16} className={isSubActive ? "text-accent" : ""} />}
                                    <span className="font-medium truncate">{subItem.label}</span>
                                  </Link>
                                </RoleGuard>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </RoleGuard>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Fixed User Section */}
      <div className={cn(
        "border-t border-slate-700/50 bg-sidebar shrink-0 transition-all duration-300",
        !isExpanded ? "p-3" : "p-4"
      )}>
        <div className={cn(
          "flex items-center gap-2",
          !isExpanded ? "flex-col" : "justify-between"
        )}>
          <Link
            to="/settings/account"
            onClick={() => setIsMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl hover:bg-sidebar-hover/50 transition-all cursor-pointer group relative flex-1 min-w-0",
              !isExpanded ? "justify-center p-2" : "p-2"
            )}
          >
            <div className={cn(
              "bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-accent transition-all",
              "w-9 h-9"
            )}>
              <Settings size={18} />
            </div>
            {isExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate uppercase tracking-wider">Impostazioni</p>
              </div>
            )}
          </Link>

          {/* Logout Button (Small) */}
          <button
            onClick={onLogout}
            title="Esci dal sistema"
            className={cn(
              "flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all",
              "w-9 h-9 shrink-0"
            )}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "hidden lg:flex bg-sidebar text-slate-300 flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-20 no-scrollbar border-r border-white/5",
          isExpanded ? "w-64" : "w-20"
        )}
      >
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-sidebar z-50 lg:hidden flex flex-col"
            >
              <NavContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

const Header = ({ onMenuClick, onLogout }: { onMenuClick: () => void, onLogout: () => void }) => {
  const { user } = useAuthContext();
  const canViewHrAlerts = user?.role === 'ADMIN' || user?.role === 'HR';
  const unreadMessages = useTotalUnread();
  const { data: alerts } = useHrAlerts(canViewHrAlerts);
  const alertCount = alerts && 'warnings' in (alerts as any)
    ? ((alerts as any).warnings?.length ?? 0)
    : (Array.isArray(alerts) ? (alerts as any[]).length : 0);

  const username = user?.nome && user?.cognome 
    ? `${user.nome} ${user.cognome}` 
    : user?.username || 'Admin';
  const role     = user?.role || 'Amministratore';
  const initial  = username.charAt(0).toUpperCase();

  const navigate = useNavigate();
  const [searchVal, setSearchVal] = React.useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchVal.trim();
    if (q) navigate(`/projects?q=${encodeURIComponent(q)}`);
    else navigate('/projects');
  };

  return (
    <header className="h-20 bg-card/80 backdrop-blur-md border-b border-border px-4 lg:px-8 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-text-secondary hover:bg-background rounded-xl"
        >
          <Menu size={24} />
        </button>
        <form onSubmit={handleSearch} className="relative group hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" size={18} />
          <input 
            type="text"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Cerca un progetto o attività..." 
            className="bg-background border-none rounded-2xl py-2 pl-10 pr-4 w-64 focus:ring-2 focus:ring-accent/20 transition-all outline-none text-sm text-text-primary h-11 shadow-sm"
          />
        </form>
      </div>

      
      <div className="flex items-center gap-2 lg:gap-4">
        <div className="flex items-center gap-1">
          <Link to="/messages" className="p-2 text-text-secondary hover:bg-background rounded-full transition-colors relative">
            <MessageSquare size={20} />
            {unreadMessages > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[10px] flex items-center justify-center rounded-full border-2 border-card">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
          {canViewHrAlerts && (
            <Link to="/hr/tabulati" className="p-2 text-text-secondary hover:bg-background rounded-full transition-colors relative" title="Alert HR">
              <Bell size={20} />
              {alertCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-card">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </Link>
          )}
        </div>
        <div className="w-px h-6 bg-border mx-2 hidden sm:block" />
        
        {/* User Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 pl-2 focus:outline-none hover:opacity-80 transition-opacity"
          >
            <div className="hidden lg:block text-right">
              <p className="text-sm font-bold text-text-primary leading-tight">{username}</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">{role}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-accent to-indigo-400 flex items-center justify-center text-white font-bold shadow-lg shadow-accent/20">
              {initial}
            </div>
            <ChevronDown size={14} className="text-text-secondary hidden lg:block" />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-56 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50 py-2"
                >
                  <div className="px-4 py-3 border-b border-border mb-1 block lg:hidden">
                    <p className="text-sm font-bold text-text-primary leading-tight truncate">{username}</p>
                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold truncate">{role}</p>
                  </div>
                  
                  <button 
                    onClick={() => { setIsDropdownOpen(false); navigate('/settings/account'); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-background transition-colors flex items-center gap-2"
                  >
                    <UserCircle size={16} className="text-accent" />
                    Il mio Account
                  </button>
                  <button 
                    onClick={() => { setIsDropdownOpen(false); onLogout(); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-danger-text hover:bg-danger-bg transition-colors flex items-center gap-2"
                  >
                    <LogOut size={16} />
                    Esci
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default function ERPProShell({ onLogout }: { onLogout: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuthContext();
  useChatSockets(user);

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-accent/20">
      <Sidebar 
        isMobileOpen={mobileMenuOpen} 
        setIsMobileOpen={setMobileMenuOpen} 
        onLogout={onLogout} 
      />
      
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} onLogout={onLogout} />
        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
