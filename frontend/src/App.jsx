import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { isAuthenticated, clearToken } from "./lib/api";

// Unified Shell
import ERPProShell from "./components/layout/ERPProShell";

// Pages
import LoginPage      from "./pages/LoginPage";
import Dashboard      from "./pages/Dashboard";
import ProjectListPage   from "./pages/ProjectListPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import MessagesPage   from "./pages/MessagesPage";
import HRPage         from "./pages/HRPage";
import TelegramAuditPage from "./pages/TelegramAuditPage";
import SettingsPage   from "./pages/SettingsPage";
import PlaceholderPage from "./pages/PlaceholderPage";

function App() {
  const [authed, setAuthed] = useState(() => isAuthenticated());

  const handleLoginSuccess = () => setAuthed(true);
  const handleLogout = () => { clearToken(); setAuthed(false); };

  if (!authed) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ERPProShell onLogout={handleLogout} />}>
          {/* ── OPERATIVO ── */}
          <Route path="/"           element={<Dashboard />} />
          <Route path="/messages"   element={<MessagesPage />} />

          {/* Pilastro 1: Routing a due livelli per i Progetti */}
          <Route path="/projects"         element={<ProjectListPage />} />
          <Route path="/projects/:id"     element={<ProjectDetailPage />} />

          <Route path="/activities" element={<PlaceholderPage title="Attività" description="Gestione task, Kanban board e time tracking." />} />

          {/* ── RISORSE ── */}
          <Route path="/hr"                element={<HRPage />} />
          {/* Pilastro 3: Rotta globale Audit Telegram */}
          <Route path="/hr/audit"          element={<TelegramAuditPage />} />
          <Route path="/documents"         element={<PlaceholderPage title="Documenti" description="Archivio file e gestione documentale." />} />
          <Route path="/warehouse"         element={<PlaceholderPage title="Magazzino" description="Inventario e scorte materiali." />} />

          {/* ── BUSINESS ── */}
          <Route path="/clients"  element={<PlaceholderPage title="Clienti" description="Anagrafica clienti e storico." />} />
          <Route path="/invoices" element={<PlaceholderPage title="Fatture" description="Fatturazione attiva e passiva." />} />
          <Route path="/reports"  element={<PlaceholderPage title="Report" description="Esportazione dati e reportistica." />} />

          <Route path="/settings" element={<SettingsPage onClose={() => window.history.back()} />} />

          {/* Legacy redirects */}
          <Route path="/cantieri" element={<Navigate to="/projects" replace />} />
          <Route path="/spese"    element={<Navigate to="/messages" replace />} />
          <Route path="/report"   element={<Navigate to="/hr"       replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

