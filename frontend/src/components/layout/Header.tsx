import React, { useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, MessageSquare, Search, UserCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useChatSockets, useTotalUnread } from '../../hooks/api/useConversations';
import { useHrAlerts } from '../../hooks/api/useHr';

export function useShellRealtime() {
  const { user } = useAuthContext();
  useChatSockets(user);
}

export default function Header({ onMenuClick, onLogout }: { onMenuClick: () => void; onLogout: () => void }) {
  const { user } = useAuthContext();
  const canViewHrAlerts = user?.role === 'ADMIN' || user?.role === 'HR';
  const unreadMessages = useTotalUnread();
  const { data: alerts } = useHrAlerts(canViewHrAlerts);
  const alertCount = (alerts?.warnings?.length ?? 0) + (alerts?.anomalies?.length ?? 0);
  const username = user?.nome && user?.cognome ? `${user.nome} ${user.cognome}` : user?.username || 'Admin';
  const role = user?.role || 'Amministratore';
  const initial = username.charAt(0).toUpperCase();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = searchVal.trim();
    if (q) navigate(`/projects?q=${encodeURIComponent(q)}`);
    else navigate('/projects');
  };

  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md transition-colors duration-300 lg:px-8">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="rounded-xl p-2 text-text-secondary hover:bg-background lg:hidden">
          <Menu size={24} />
        </button>
        <form onSubmit={handleSearch} className="group relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-accent" size={18} />
          <input
            type="text"
            value={searchVal}
            onChange={(event) => setSearchVal(event.target.value)}
            placeholder="Cerca un progetto o attività..."
            className="h-11 w-64 rounded-2xl border-none bg-background py-2 pl-10 pr-4 text-sm text-text-primary shadow-sm outline-none transition-all focus:ring-2 focus:ring-accent/20"
          />
        </form>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <div className="flex items-center gap-1">
          <Link to="/messages" className="relative rounded-full p-2 text-text-secondary transition-colors hover:bg-background">
            <MessageSquare size={20} />
            {unreadMessages > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-accent text-[10px] text-white">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
          {canViewHrAlerts && (
            <Link to="/hr/tabulati" className="relative rounded-full p-2 text-text-secondary transition-colors hover:bg-background" title="Alert HR">
              <Bell size={20} />
              {alertCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-warning-text text-[10px] text-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </Link>
          )}
        </div>

        <div className="mx-2 hidden h-6 w-px bg-border sm:block" />

        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 pl-2 transition-opacity hover:opacity-80 focus:outline-none"
          >
            <div className="hidden text-right lg:block">
              <p className="text-sm font-bold leading-tight text-text-primary">{username}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{role}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent font-bold text-white shadow-lg shadow-accent/20">
              {initial}
            </div>
            <ChevronDown size={14} className="hidden text-text-secondary lg:block" />
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
                  className="absolute right-0 z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-border bg-card py-2 shadow-xl"
                >
                  <div className="mb-1 block border-b border-border px-4 py-3 lg:hidden">
                    <p className="truncate text-sm font-bold leading-tight text-text-primary">{username}</p>
                    <p className="truncate text-[10px] font-bold uppercase tracking-wider text-text-secondary">{role}</p>
                  </div>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/settings/account');
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-background"
                  >
                    <UserCircle size={16} className="text-accent" />
                    Il mio Account
                  </button>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-danger-text transition-colors hover:bg-danger-bg"
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
}
