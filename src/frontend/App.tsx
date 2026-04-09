import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FolderRoot, 
  Users, 
  UserCircle, 
  FileText, 
  FileStack, 
  Package, 
  Activity, 
  BarChart3, 
  Settings, 
  Search, 
  Bell, 
  MessageSquare, 
  ChevronRight, 
  ChevronLeft,
  PanelLeft,
  LogOut,
  Sun,
  Moon,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  LifeBuoy,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  Legend
} from 'recharts';
import { cn } from './lib/utils';

import SettingsPage from './components/SettingsPage';
import MessagesPage from './components/MessagesPage';
import ProjectPage from './components/ProjectPage';
import WelcomePage from './components/WelcomePage';
import Dashboard from './components/Dashboard';
import PlaceholderPage from './components/PlaceholderPage';

// --- Types ---

interface NavItem {
  icon: React.ElementType;
  label: string;
  id: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SummaryCardProps {
  title: string;
  value: string;
  trend?: string;
  trendType?: 'positive' | 'negative';
}

interface ActivityItem {
  user: {
    name: string;
    avatar: string;
  };
  task: string;
  time: string;
  status: 'Completato' | 'In Revisione' | 'In Corso';
}

// --- Mock Data ---

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'OPERATIVO',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
      { icon: MessageSquare, label: 'Messages', id: 'messages' },
      { icon: Briefcase, label: 'Projects', id: 'projects' },
      { icon: Activity, label: 'Activities', id: 'activities' },
    ]
  },
  {
    title: 'RESOURCES',
    items: [
      { icon: Users, label: 'HR', id: 'hr' },
      { icon: FileStack, label: 'Documents', id: 'documents' },
      { icon: Package, label: 'Warehouse', id: 'warehouse' },
    ]
  },
  {
    title: 'BUSINESS',
    items: [
      { icon: UserCircle, label: 'Clients', id: 'clients' },
      { icon: FileText, label: 'Invoices', id: 'invoices' },
      { icon: BarChart3, label: 'Reports', id: 'reports' },
    ]
  }
];

const PROJECT_STATUS_DATA = [
  { name: 'In Corso', value: 60, color: '#1e2139' },
  { name: 'Completati', value: 30, color: '#6366f1' },
  { name: 'In Ritardo', value: 10, color: '#f87171' },
];

const RECENT_ACTIVITY: ActivityItem[] = [
  { user: { name: 'Marco Rossi', avatar: 'https://i.pravatar.cc/150?u=1' }, task: 'Getto calcestruzzo pilastro A4', time: '10 min', status: 'Completato' },
  { user: { name: 'Elena Bianchi', avatar: 'https://i.pravatar.cc/150?u=2' }, task: 'Revisione planimetria settore B', time: '10 min', status: 'In Revisione' },
  { user: { name: 'Luca Verdi', avatar: 'https://i.pravatar.cc/150?u=3' }, task: 'Ordine materiale isolante', time: '20 min', status: 'In Revisione' },
  { user: { name: 'Giulia Neri', avatar: 'https://i.pravatar.cc/150?u=4' }, task: 'Sopralluogo cantiere Nord', time: '10 min', status: 'Completato' },
  { user: { name: 'Sofia Gialli', avatar: 'https://i.pravatar.cc/150?u=5' }, task: 'Posa pavimentazione', time: '15 min', status: 'Completato' },
  { user: { name: 'Davide Blu', avatar: 'https://i.pravatar.cc/150?u=6' }, task: 'Installazione infissi', time: '20 min', status: 'Completato' },
];

const INVENTORY_DATA = [
  { name: 'Prodotto A', value: 3 },
  { name: 'B', value: 4 },
  { name: 'C', value: 2 },
];

const PROJECTS = [
  { name: 'App Mobile', date: '10/2023' },
  { name: 'Sito Web', date: '10/2023' },
  { name: 'Marketing Plan', date: '11/2023' },
];

// --- Components ---

const Sidebar = ({ onOpenSettings, activeTab, setActiveTab }: { onOpenSettings: () => void, activeTab: string, setActiveTab: (id: string) => void }) => {
  const [mode, setMode] = useState<'unlocked' | 'locked-expanded' | 'locked-collapsed'>('locked-expanded');
  const [isHovered, setIsHovered] = useState(false);
  
  const isExpanded = mode === 'locked-expanded' || (mode === 'unlocked' && isHovered);

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setMode(prev => prev === 'locked-expanded' ? 'unlocked' : 'locked-expanded')}
      className={cn(
        "bg-sidebar text-slate-300 flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-20 no-scrollbar",
        isExpanded ? "w-64" : "w-20"
      )}
    >
      {/* Sidebar Header */}
      <div className={cn(
        "p-6 flex items-center shrink-0",
        !isExpanded ? "justify-center" : "justify-between"
      )}>
        <div 
          className="flex items-center gap-3 cursor-pointer group/logo"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab('home');
          }}
        >
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold shrink-0 group-hover/logo:scale-110 transition-transform">
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
        </div>
        {isExpanded && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setMode('locked-collapsed');
            }}
            className="p-1.5 hover:bg-sidebar-hover rounded-lg text-slate-500 hover:text-white transition-colors"
            title="Blocca compresso"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Scrollable Navigation Area */}
      <nav className="flex-1 px-4 space-y-6 mt-4 overflow-y-auto no-scrollbar">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.title} className="space-y-2">
            {isExpanded ? (
              <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                {group.title}
              </h3>
            ) : (
              index !== 0 && <div className="h-px bg-slate-700/30 mx-2 my-4" />
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab(item.id);
                  }}
                  className={cn(
                    "w-full flex items-center rounded-xl transition-all duration-200 group relative",
                    !isExpanded ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5",
                    activeTab === item.id 
                      ? "bg-sidebar-hover text-white shadow-lg" 
                      : "hover:bg-sidebar-hover/50 hover:text-white"
                  )}
                >
                  <item.icon size={18} className={cn(
                    "transition-colors shrink-0",
                    activeTab === item.id ? "text-accent" : "text-slate-400 group-hover:text-slate-200"
                  )} />
                  {isExpanded && (
                    <span className="font-medium text-sm truncate">{item.label}</span>
                  )}
                  {!isExpanded && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-sidebar-hover text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-slate-700">
                      {item.label}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Fixed User Section */}
      <div className={cn(
        "border-t border-slate-700/50 bg-sidebar shrink-0 transition-all duration-300",
        !isExpanded ? "p-2" : "p-4"
      )}>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
          className={cn(
            "flex items-center rounded-xl hover:bg-sidebar-hover/50 transition-all cursor-pointer group relative",
            !isExpanded ? "justify-center p-1" : "gap-3 p-2"
          )}
        >
          <img 
            src="https://i.pravatar.cc/150?u=me" 
            alt="User" 
            className={cn(
              "rounded-full border-2 border-accent/20 group-hover:border-accent transition-all shrink-0 object-cover",
              !isExpanded ? "w-8 h-8" : "w-10 h-10"
            )}
            referrerPolicy="no-referrer"
          />
          {isExpanded && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">Alessandro Rossi</p>
                <p className="text-xs text-slate-500 truncate">Admin</p>
              </div>
              <Settings size={18} className="text-slate-500 group-hover:text-white transition-colors shrink-0" />
            </>
          )}
          {!isExpanded && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-sidebar-hover text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-slate-700">
              Impostazioni
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

const Header = ({ theme, toggleTheme }: { theme: 'light' | 'dark', toggleTheme: () => void }) => {
  return (
    <header className="h-20 bg-card/80 backdrop-blur-md border-b border-border px-8 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
      <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
      
      <div className="flex items-center gap-6">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Cerca..." 
            className="bg-background border-none rounded-full py-2 pl-10 pr-4 w-64 focus:ring-2 focus:ring-accent/20 transition-all outline-none text-sm text-text-primary"
          />
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:bg-background rounded-full transition-all duration-300 hover:scale-110"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-amber-400" />}
          </button>
          <button className="p-2 text-text-secondary hover:bg-background rounded-full transition-colors relative">
            <MessageSquare size={20} />
            <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[10px] flex items-center justify-center rounded-full border-2 border-card">3</span>
          </button>
          <button className="p-2 text-text-secondary hover:bg-background rounded-full transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[10px] flex items-center justify-center rounded-full border-2 border-card">5</span>
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          <img 
            src="https://i.pravatar.cc/150?u=99" 
            alt="User" 
            className="w-10 h-10 rounded-full border-2 border-card shadow-sm"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
};

const SummaryCard = ({ title, value, trend, trendType = 'positive' }: SummaryCardProps) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-card p-6 rounded-3xl shadow-sm border border-border flex flex-col justify-between h-full transition-colors duration-300"
  >
    <p className="text-text-secondary font-medium text-sm mb-2">{title}</p>
    <div className="flex items-end justify-between">
      <h3 className="text-2xl font-bold text-text-primary">{value}</h3>
      {trend && (
        <span className={cn(
          "text-xs font-bold px-2 py-1 rounded-full",
          trendType === 'positive' ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"
        )}>
          {trend}
        </span>
      )}
    </div>
  </motion.div>
);

const StatusBadge = ({ status }: { status: ActivityItem['status'] }) => {
  const styles = {
    'Completato': 'bg-success-bg text-success-text',
    'In Revisione': 'bg-warning-bg text-warning-text',
    'In Corso': 'bg-info-bg text-info-text',
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-300", styles[status])}>
      {status}
    </span>
  );
};

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setActiveTab(''); // Deselect main nav
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setActiveTab('dashboard');
  };

  const handleSetActiveTab = (id: string) => {
    setActiveTab(id);
    setIsSettingsOpen(false);
  };

  const renderContent = () => {
    if (isSettingsOpen) {
      return (
        <motion.div
          key="settings"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="h-screen"
        >
          <SettingsPage onClose={handleCloseSettings} />
        </motion.div>
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col h-full"
          >
            <WelcomePage onGetStarted={() => setActiveTab('dashboard')} />
          </motion.div>
        );
      case 'messages':
        return (
          <motion.div
            key="messages"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-screen"
          >
            <MessagesPage />
          </motion.div>
        );
      case 'projects':
        return (
          <motion.div
            key="projects"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col h-full"
          >
            <ProjectPage />
          </motion.div>
        );
      case 'activities':
        return (
          <motion.div key="activities" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col h-full">
            <PlaceholderPage title="Attività" description="Gestione task, Kanban board e time tracking." />
          </motion.div>
        );
      case 'hr':
        return (
          <motion.div key="hr" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col h-full">
            <PlaceholderPage title="Risorse Umane" description="Gestione team, ruoli, permessi e disponibilità." />
          </motion.div>
        );
      case 'documents':
        return (
          <motion.div key="documents" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col h-full">
            <PlaceholderPage title="Documenti" description="Archivio file, versioning e condivisione." />
          </motion.div>
        );
      case 'warehouse':
        return (
          <motion.div key="warehouse" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col h-full">
            <PlaceholderPage title="Magazzino" description="Inventario, movimenti e alert scorte." />
          </motion.div>
        );
      case 'clients':
        return (
          <motion.div key="clients" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col h-full">
            <PlaceholderPage title="Clienti" description="CRM, anagrafiche e storico progetti." />
          </motion.div>
        );
      case 'invoices':
        return (
          <motion.div key="invoices" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col h-full">
            <PlaceholderPage title="Fatture" description="Fatturazione attiva, passiva e scadenze." />
          </motion.div>
        );
      case 'reports':
        return (
          <motion.div key="reports" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col h-full">
            <PlaceholderPage title="Report" description="Analisi finanziarie, produttività e materiali." />
          </motion.div>
        );
      case 'dashboard':
      default:
        return (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col flex-1"
          >
            <Header theme={theme} toggleTheme={toggleTheme} />
            <Dashboard />
          </motion.div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        onOpenSettings={handleOpenSettings} 
        activeTab={activeTab} 
        setActiveTab={handleSetActiveTab} 
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}
