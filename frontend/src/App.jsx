import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Shell from "./components/layout/Shell";
import Dashboard from "./pages/Dashboard";
import Topbar from "./components/layout/Topbar";
import Sidebar from "./components/layout/Sidebar";

// Legacy app components
import LoginPage from "./pages/legacy/LoginPage";
import ProjectPage from "./pages/legacy/ProjectPage";
import MessagesPage from "./pages/legacy/MessagesPage";
import HRPage from "./pages/legacy/HRPage";
import SettingsPage from "./pages/legacy/SettingsPage";
import { isAuthenticated, clearToken } from "./lib/api";

function PrivateRoute({ children }) {
  // Simple auth check wrapper
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function App() {
  const [authed, setAuthed] = useState(() => isAuthenticated());

  const handleLoginSuccess = () => {
    setAuthed(true);
  };

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
  };

  return (
    <BrowserRouter>
      {authed ? (
        <div className="flex h-screen overflow-hidden bg-base-900 text-slate-200">
           {/* Legacy layout wrapper logic can fit inside my beautiful Shell later, for now let's just use my new shell */}
           <Shell onLogout={handleLogout}>
             <Routes>
               <Route path="/" element={<Dashboard />} />
               <Route path="/cantieri" element={<ProjectPage />} />
               <Route path="/report" element={<HRPage />} />
               {/* Legacy messages usually maps to telegram logs */}
               <Route path="/spese" element={<MessagesPage />} /> 
               <Route path="/settings" element={<SettingsPage onClose={() => window.history.back()} />} />
             </Routes>
           </Shell>
        </div>
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </BrowserRouter>
  );
}

export default App;
