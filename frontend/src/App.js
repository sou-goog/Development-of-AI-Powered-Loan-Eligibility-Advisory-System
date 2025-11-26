// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Pages
import Login from "./pages/Login";
import MainDashboard from "./pages/MainDashboard";
import LoanAnalytics from "./pages/LoanAnalytics";
import MLPerformance from "./pages/MLPerformance";
import VoiceAnalytics from "./pages/VoiceAnalytics";
import ApplicationsTable from "./pages/ApplicationsTable";
import Transcripts from "./pages/Transcripts";
import SystemSettings from "./pages/SystemSettings";
import ProjectOverview from "./pages/ProjectOverview";

// ⭐ NEW PAGE IMPORT
import LoanRejectionDashboard from "./pages/LoanRejectionDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login Pages */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Dashboard Pages */}
        <Route path="/dashboard" element={<MainDashboard />} />
        <Route path="/loan-analytics" element={<LoanAnalytics />} />
        <Route path="/ml-performance" element={<MLPerformance />} />
        <Route path="/voice-analytics" element={<VoiceAnalytics />} />
        <Route path="/applications" element={<ApplicationsTable />} />
        <Route path="/transcripts" element={<Transcripts />} />
        <Route path="/settings" element={<SystemSettings />} />
        <Route path="/overview" element={<ProjectOverview />} />

        {/* ⭐ NEW LOAN REJECTION DASHBOARD ROUTE */}
        <Route
          path="/loan-rejection/:userId"
          element={<LoanRejectionDashboard />}
        />

        {/* Wrong URL → Redirect to login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
