import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuthContext } from "./context/AuthContext";
import { ProtectedRoute, RoleRoute } from "./components/auth/RoleGuard";

// Unified Shell
import ERPProShell from "./components/layout/ERPProShell";

// Pages
import LoginPage          from "./pages/LoginPage";
import Dashboard          from "./pages/Dashboard";
import ProjectListPage    from "./pages/ProjectListPage";
import ProjectDetailPage  from "./pages/ProjectDetailPage";
import MessagesPage       from "./pages/MessagesPage";
import EmployeesPage      from "./pages/EmployeesPage";
import EmployeeDetailPage from "./pages/EmployeeDetailPage";
import TabulatiOrariPage  from "./pages/TabulatiOrariPage";
import TelegramAuditPage  from "./pages/TelegramAuditPage";
import SettingsPage       from "./pages/SettingsPage";
import WarehousePage      from "./pages/WarehousePage";
import ActivitiesPage     from "./pages/ActivitiesPage";
import AccountPage        from "./pages/AccountPage";
import PlaceholderPage    from "./pages/PlaceholderPage";

// Public Guard Component (redirects to home if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthContext();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const ALL_AUTH_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WORKER"];

const HomeRedirect = () => {
  const { user } = useAuthContext();

  switch (user?.role) {
    case "ADMIN":
      return <Navigate to="/dashboard" replace />;
    case "HR":
      return <Navigate to="/hr" replace />;
    case "PROJECT_MANAGER":
    case "WORKER":
      return <Navigate to="/timesheets" replace />;
    default:
      return <Navigate to="/account" replace />;
  }
};

function AppRoutes() {
  const { logout } = useAuthContext();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } 
      />

      <Route 
        element={
          <ProtectedRoute>
            <ERPProShell onLogout={logout} />
          </ProtectedRoute>
        }
      >
        {/* ── OPERATIVO ── */}
        <Route path="/"           element={<HomeRedirect />} />
        <Route path="/dashboard"  element={<RoleRoute allowedRoles={["ADMIN"]}><Dashboard /></RoleRoute>} />
        <Route path="/messages"   element={<MessagesPage />} />

        {/* Pilastro 1: Routing a due livelli per i Progetti */}
        <Route path="/projects"         element={<ProjectListPage />} />
        <Route path="/projects/:id"     element={<ProjectDetailPage />} />

        <Route path="/activities" element={<ActivitiesPage />} />

        {/* ── RISORSE ── */}
        <Route path="/hr"                element={<RoleRoute allowedRoles={["ADMIN", "HR"]}><EmployeesPage /></RoleRoute>} />
        <Route path="/personnel"         element={<RoleRoute allowedRoles={["ADMIN", "HR"]}><Navigate to="/hr" replace /></RoleRoute>} />
        <Route path="/hr/employees/:id"  element={<RoleRoute allowedRoles={["ADMIN", "HR"]}><EmployeeDetailPage /></RoleRoute>} />
        <Route path="/hr/tabulati"       element={<RoleRoute allowedRoles={["ADMIN", "HR"]}><TabulatiOrariPage /></RoleRoute>} />
        <Route path="/timesheets"        element={<RoleRoute allowedRoles={ALL_AUTH_ROLES}><TabulatiOrariPage /></RoleRoute>} />
        {/* Legacy: /hr/audit → /hr/tabulati */}
        <Route path="/hr/audit"          element={<Navigate to="/hr/tabulati" replace />} />
        <Route path="/documents"         element={<PlaceholderPage title="Documenti" description="Archivio file e gestione documentale." />} />
        <Route path="/warehouse"         element={<RoleRoute allowedRoles={["ADMIN"]}><WarehousePage /></RoleRoute>} />
        <Route path="/finance"           element={<RoleRoute allowedRoles={["ADMIN"]}><Navigate to="/dashboard?tab=finanza" replace /></RoleRoute>} />

        {/* ── BUSINESS ── */}
        <Route path="/clients"  element={<PlaceholderPage title="Clienti" description="Anagrafica clienti e storico." />} />
        <Route path="/invoices" element={<PlaceholderPage title="Fatture" description="Fatturazione attiva e passiva." />} />
        <Route path="/reports"  element={<PlaceholderPage title="Report" description="Esportazione dati e reportistica." />} />

        <Route path="/account"  element={<RoleRoute allowedRoles={ALL_AUTH_ROLES}><AccountPage /></RoleRoute>} />

        <Route path="/settings" element={<SettingsPage onClose={() => window.history.back()} />} />

        {/* Legacy redirects */}
        <Route path="/cantieri" element={<Navigate to="/projects" replace />} />
        <Route path="/spese"    element={<Navigate to="/messages" replace />} />
        <Route path="/report"   element={<Navigate to="/hr"       replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  // Replace this with your actual client ID or ensure VITE_GOOGLE_CLIENT_ID is set in frontend/.env
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_MISSING";

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
