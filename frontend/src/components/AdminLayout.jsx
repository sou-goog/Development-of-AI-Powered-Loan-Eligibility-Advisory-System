// src/components/AdminLayout.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

function AdminLayout({ children }) {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Loan Analytics", path: "/loan-analytics" },
    { name: "ML Performance", path: "/ml-performance" },
    { name: "Voice Analytics", path: "/voice-analytics" },
    { name: "Applications", path: "/applications" },
    { name: "Transcripts", path: "/transcripts" },
    { name: "System Settings", path: "/settings" },
    { name: "Project Overview", path: "/overview" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-700">
          <h1 className="text-lg font-bold">AI Loan System</h1>
          <p className="text-xs text-slate-400">
            Admin Dashboard
          </p>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1">
          {menu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-2 rounded-lg text-sm ${
                location.pathname === item.path
                  ? "bg-blue-500 text-white font-semibold"
                  : "hover:bg-slate-700"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {/* Navbar */}
        <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
          <h2 className="text-sm font-semibold">
            AI Loan Eligibility Dashboard
          </h2>
          <span className="text-xs text-slate-300">
            Logged in as <b>Admin</b>
          </span>
        </header>

        {/* Main Page Content */}
        <main className="flex-1 p-6 bg-slate-900">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
