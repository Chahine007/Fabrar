import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserCircle, 
  Package, 
  Activity, 
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
  Inbox,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useChatSockets, useTotalUnread } from '../../hooks/api/useConversations';
import { useHrAlerts } from '../../hooks/api/useHr';
import { useAuthContext } from '../../context/AuthContext';

interface NavNode {
  icon?: React.ElementType;
  label: string;
  path?: string;
  id: string;
  roles?: string[];
  children?: NavNode[];
  hidden?: boolean;
}

// --- Configuration ---

const ALL_AUTH_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN', 'WORKER'];
const WAREHOUSE_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN'];

const NAV_TREE: NavNode[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['ADMIN'],
  },
  {
    id: 'operations-section',
    label: 'Operatività',
    icon: Briefcase,
    children: [
      { icon: Inbox, label: 'Raccolta Dati', path: '/data-entry', id: 'data-entry', roles: ALL_AUTH_ROLES },
      { icon: Briefcase, label: 'Progetti', path: '/projects', id: 'projects' },
      { icon: Activity, label: 'Attività', path: '/activities', id: 'activities' },
      { icon: MessageSquare, label: 'Messaggi', path: '/messages', id: 'messages' },
    ],
  },
  {
    id: 'hr-section',
    label: 'Risorse Umane',
    icon: Users,
    children: [
      { icon: Users, label: 'Gestione Personale', path: '/hr', id: 'hr', roles: ['ADMIN', 'HR'] },
      { icon: ClipboardList, label: 'Tabulati', path: '/hr/tabulati', id: 'hr-tabulati', roles: ['ADMIN', 'HR'] },
      { icon: ClipboardList, label: 'Le Mie Ore / Spese', path: '/timesheets', id: 'my-timesheets', roles: ['WORKER'] },
    ],
  },
  {
    id: 'logistics-section',
    label: 'Logistica',
    icon: Package,
    children: [
      { icon: Package, label: 'Magazzino', path: '/warehouse', id: 'warehouse', roles: WAREHOUSE_ROLES },
      { icon: Truck, label: 'Fornitori', path: '/suppliers', id: 'suppliers', roles: WAREHOUSE_ROLES },
      { icon: ClipboardList, label: 'Richieste Materiali', path: '/material-requests', id: 'material-requests', roles: ALL_AUTH_ROLES },
    ],
  },
];

// --- Components ---

const Sidebar = ({ isMobileOpen, setIsMobileOpen, onLogout }: { isMobileOpen: boolean, setIsMobileOpen: (o: boolean) => void, onLogout: () => void }) => {
  const [isLockedExpanded, setIsLockedExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('fabrar.nav.expanded');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const location = useLocation();
  const { user } = useAuthContext();
  const role = user?.role;
  
  const isExpanded = isMobileOpen || isLockedExpanded || isHovered;

  const canAccessNode = React.useCallback(
    (node: NavNode) => !node.roles || (!!role && node.roles.includes(role)),
    [role]
  );

  const visibleNavTree = React.useMemo(() => {
    const filterNodes = (nodes: NavNode[]): NavNode[] => nodes
      .filter((node) => !node.hidden && canAccessNode(node))
      .map((node) => {
        const children = node.children ? filterNodes(node.children) : undefined;
        return { ...node, children };
      })
      .filter((node) => !!node.path || (node.children?.length ?? 0) > 0);

    return filterNodes(NAV_TREE);
  }, [canAccessNode]);

  const isPathActive = React.useCallback((path?: string) => {
    if (!path) return false;

    const normalizePath = (value: string) => {
      if (value === '/') return value;
      return value.replace(/\/+$/, '');
    };

    const currentPath = normalizePath(location.pathname);
    const targetPath = normalizePath(path);

    if (targetPath === '/projects') {
      return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
    }

    if (targetPath === '/hr') {
      return currentPath === targetPath || currentPath.startsWith('/hr/employees/');
    }

    return currentPath === targetPath;
  }, [location.pathname]);

  const isNodeActive = React.useCallback((node: NavNode): boolean => {
    return isPathActive(node.path) || !!node.children?.some(isNodeActive);
  }, [isPathActive]);

  React.useEffect(() => {
    try {
      localStorage.setItem('fabrar.nav.expanded', JSON.stringify(expandedSections));
    } catch {
      // Local storage can be unavailable in private/locked-down browser contexts.
    }
  }, [expandedSections]);

  React.useEffect(() => {
    setExpandedSections((current) => {
      let changed = false;
      const next = { ...current };
      visibleNavTree.forEach((node) => {
        if (node.children?.length && isNodeActive(node) && !next[node.id]) {
          next[node.id] = true;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [isNodeActive, visibleNavTree]);

  const toggleExpandedSection = (id: string) => {
    setExpandedSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const closeMobile = () => setIsMobileOpen(false);

  const renderExpandedNode = (node: NavNode) => {
    const Icon = node.icon;
    const hasChildren = !!node.children?.length;
    const active = isNodeActive(node);
    const open = expandedSections[node.id] ?? active;

    if (!hasChildren && node.path) {
      return (
        <Link
          key={node.id}
          to={node.path}
          onClick={closeMobile}
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
            active
              ? "bg-sidebar-hover text-white shadow-lg"
              : "text-slate-300 hover:bg-sidebar-hover/50 hover:text-white"
          )}
        >
          {Icon && <Icon size={18} className={cn("shrink-0", active ? "text-accent" : "text-slate-400")} />}
          <span className="truncate">{node.label}</span>
        </Link>
      );
    }

    return (
      <div key={node.id} className="space-y-1">
        <button
          type="button"
          onClick={() => toggleExpandedSection(node.id)}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-all duration-200",
            active
              ? "bg-sidebar-hover/60 text-white"
              : "text-slate-400 hover:bg-sidebar-hover/50 hover:text-white"
          )}
        >
          {Icon && <Icon size={18} className={cn("shrink-0", active ? "text-accent" : "text-slate-500")} />}
          <span className="min-w-0 flex-1 truncate text-left">{node.label}</span>
          <ChevronDown size={16} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="ml-4 space-y-1 border-l border-slate-700/60 pl-3">
                {node.children?.map((child) => renderExpandedNode(child))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderCollapsedNode = (node: NavNode) => {
    const Icon = node.icon;
    const hasChildren = !!node.children?.length;
    const active = isNodeActive(node);
    const firstPath = node.path || node.children?.find((child) => child.path)?.path || '/';

    return (
      <div key={node.id} className="group/flyout relative">
        <Link
          to={firstPath}
          onClick={closeMobile}
          aria-label={node.label}
          className={cn(
            "mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
            active
              ? "bg-sidebar-hover text-white shadow-lg"
              : "text-slate-400 hover:bg-sidebar-hover/50 hover:text-white"
          )}
        >
          {Icon && <Icon size={19} className={cn(active && "text-accent")} />}
        </Link>

        <div className="pointer-events-none absolute left-full top-0 z-50 ml-3 hidden min-w-56 rounded-2xl border border-slate-700 bg-sidebar p-2 text-sm shadow-2xl group-hover/flyout:block group-hover/flyout:pointer-events-auto">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {node.label}
          </div>
          <div className="space-y-1">
            {hasChildren ? node.children?.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isNodeActive(child);
              return child.path ? (
                <Link
                  key={child.id}
                  to={child.path}
                  onClick={closeMobile}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition-colors",
                    childActive
                      ? "bg-sidebar-hover text-white"
                      : "text-slate-300 hover:bg-sidebar-hover/50 hover:text-white"
                  )}
                >
                  {ChildIcon && <ChildIcon size={16} className={cn(childActive ? "text-accent" : "text-slate-500")} />}
                  <span>{child.label}</span>
                </Link>
              ) : null;
            }) : (
              <Link
                to={firstPath}
                onClick={closeMobile}
                className="flex items-center gap-3 rounded-xl px-3 py-2 font-medium text-slate-300 hover:bg-sidebar-hover/50 hover:text-white"
              >
                {Icon && <Icon size={16} className="text-slate-500" />}
                <span>{node.label}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
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
            <span className="text-xl font-bold text-white tracking-tight">
              ERP Pro
            </span>
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
      <nav className={cn("flex-1 mt-4 overflow-y-auto no-scrollbar", isExpanded ? "px-4 space-y-2" : "px-3 space-y-3")}>
        {visibleNavTree.map((node, index) => (
          <React.Fragment key={node.id}>
            {!isExpanded && index !== 0 && <div className="mx-auto h-px w-8 bg-slate-700/40" />}
            {isExpanded ? renderExpandedNode(node) : renderCollapsedNode(node)}
          </React.Fragment>
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
  const alertCount = (alerts?.warnings?.length ?? 0) + (alerts?.anomalies?.length ?? 0);

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
