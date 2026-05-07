import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuthContext } from "./context/AuthContext";
import { ProtectedRoute, RoleRoute } from "./components/auth/RoleGuard";
import { FullPageLoader, ToastProvider } from "./components/ui";

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
import TabulatiPage       from "./pages/TabulatiPage";
import TelegramAuditPage  from "./pages/TelegramAuditPage";
import SettingsPage       from "./pages/SettingsPage";
import WarehousePage      from "./pages/WarehousePage";
import SuppliersPage      from "./pages/SuppliersPage";
import MaterialRequestsPage from "./pages/MaterialRequestsPage";
import ActivitiesPage     from "./pages/ActivitiesPage";
import DataEntryPage      from "./pages/DataEntryPage";

// Public Guard Component (redirects to home if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthContext();
  
  if (isLoading) {
    return <FullPageLoader label="Verifica sessione..." />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const ALL_AUTH_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN", "WORKER"];
const WAREHOUSE_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN"];
const PROJECT_ROLES = ALL_AUTH_ROLES;

const HomeRedirect = () => {
  const { user } = useAuthContext();

  switch (user?.role) {
    case "ADMIN":
      return <Navigate to="/dashboard" replace />;
    case "HR":
      return <Navigate to="/hr" replace />;
    case "PROJECT_MANAGER":
      return <Navigate to="/projects" replace />;
    case "WAREHOUSEMAN":
      return <Navigate to="/warehouse" replace />;
    case "WORKER":
      return <Navigate to="/data-entry" replace />;
    default:
      return <Navigate to="/settings/account" replace />;
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
        <Route path="/dashboard"  element={<RoleRoute allowedRoles={["ADMIN"]} allowedCapabilities={["dashboard:read"]}><Dashboard /></RoleRoute>} />
        <Route path="/messages"   element={<RoleRoute allowedRoles={ALL_AUTH_ROLES} allowedCapabilities={["messages:read"]}><MessagesPage /></RoleRoute>} />

        {/* Pilastro 1: Routing a due livelli per i Progetti */}
        <Route path="/projects"         element={<RoleRoute allowedRoles={PROJECT_ROLES} allowedCapabilities={["projects:read"]}><ProjectListPage /></RoleRoute>} />
        <Route path="/projects/:id"     element={<RoleRoute allowedRoles={PROJECT_ROLES} allowedCapabilities={["projects:read"]}><ProjectDetailPage /></RoleRoute>} />

        <Route path="/activities" element={<RoleRoute allowedRoles={ALL_AUTH_ROLES} allowedCapabilities={["tasks:read"]}><ActivitiesPage /></RoleRoute>} />
        <Route path="/data-entry" element={<RoleRoute allowedRoles={ALL_AUTH_ROLES} allowedCapabilities={["data_entry:read"]}><DataEntryPage /></RoleRoute>} />

        {/* ── RISORSE ── */}
        <Route path="/hr"                element={<RoleRoute allowedRoles={["ADMIN", "HR"]} allowedCapabilities={["hr:read"]}><EmployeesPage /></RoleRoute>} />
        <Route path="/personnel"         element={<RoleRoute allowedRoles={["ADMIN", "HR"]}><Navigate to="/hr" replace /></RoleRoute>} />
        <Route path="/hr/employees/:id"  element={<RoleRoute allowedRoles={["ADMIN", "HR"]} allowedCapabilities={["hr:read"]}><EmployeeDetailPage /></RoleRoute>} />
        <Route path="/hr/tabulati"       element={<RoleRoute allowedRoles={["ADMIN", "HR"]} allowedCapabilities={["audit:approve"]}><TabulatiPage /></RoleRoute>} />
        <Route path="/hr/telegram-audit" element={<RoleRoute allowedRoles={["ADMIN", "HR"]} allowedCapabilities={["audit:approve"]}><TelegramAuditPage /></RoleRoute>} />
        <Route path="/timesheets"        element={<RoleRoute allowedRoles={["WORKER"]} allowedCapabilities={["timesheets:self:write"]}><TabulatiPage /></RoleRoute>} />
        {/* Legacy: /hr/audit → /hr/tabulati */}
        <Route path="/hr/audit"          element={<Navigate to="/hr/tabulati" replace />} />
        <Route path="/warehouse"         element={<RoleRoute allowedRoles={WAREHOUSE_ROLES} allowedCapabilities={["warehouse:read"]}><WarehousePage /></RoleRoute>} />
        <Route path="/suppliers"         element={<RoleRoute allowedRoles={WAREHOUSE_ROLES} allowedCapabilities={["suppliers:read"]}><SuppliersPage /></RoleRoute>} />
        <Route path="/material-requests" element={<RoleRoute allowedRoles={ALL_AUTH_ROLES} allowedCapabilities={["material_requests:read"]}><MaterialRequestsPage /></RoleRoute>} />
        <Route path="/finance"           element={<RoleRoute allowedRoles={["ADMIN"]} allowedCapabilities={["dashboard:read"]}><Navigate to="/dashboard?tab=finanza" replace /></RoleRoute>} />

        {/* Hidden until real production pages exist */}
        <Route path="/documents" element={<Navigate to="/" replace />} />
        <Route path="/clients"   element={<Navigate to="/" replace />} />
        <Route path="/invoices"  element={<Navigate to="/" replace />} />
        <Route path="/reports"   element={<Navigate to="/" replace />} />

        <Route path="/account"  element={<Navigate to="/settings/account" replace />} />

        <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
        <Route path="/settings/:section" element={<SettingsPage onClose={() => window.history.back()} />} />

        {/* Legacy redirects */}
        <Route path="/cantieri" element={<Navigate to="/projects" replace />} />
        <Route path="/spese"    element={<Navigate to="/messages" replace />} />
        <Route path="/report"   element={<Navigate to="/hr"       replace />} />
        <Route path="/inserimenti" element={<Navigate to="/data-entry" replace />} />

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
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
