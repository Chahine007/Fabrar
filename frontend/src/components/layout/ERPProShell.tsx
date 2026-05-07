import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header, { useShellRealtime } from './Header';

export default function ERPProShell({ onLogout }: { onLogout: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useShellRealtime();

  return (
    <div className="flex h-screen overflow-hidden bg-background selection:bg-accent/20">
      <Sidebar
        isMobileOpen={mobileMenuOpen}
        setIsMobileOpen={setMobileMenuOpen}
        onLogout={onLogout}
      />

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} onLogout={onLogout} />
        <div className="no-scrollbar flex-1 overflow-y-auto scroll-smooth">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
