import { Outlet } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import { useState } from "react";

export default function Shell({ children, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onLogout={onLogout} />
      <div className="flex flex-col flex-1 w-full relative z-0">
        <Topbar setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children || <Outlet />}
        </main>
      </div>
    </>
  );
}
