// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Landing + Application pages
import Home from "./pages/Home";
import ApplyPage from "./pages/ApplyPage";
import AuthPage from "./pages/AuthPage";

// Dashboard pages
import Login from "./pages/Login";
import MainDashboard from "./pages/MainDashboard";
import LoanAnalytics from "./pages/LoanAnalytics";
import MLPerformance from "./pages/MLPerformance";
import VoiceAnalytics from "./pages/VoiceAnalytics";
import ApplicationsTable from "./pages/ApplicationsTable";
import Transcripts from "./pages/Transcripts";
import SystemSettings from "./pages/SystemSettings";
import ProjectOverview from "./pages/ProjectOverview";
import LoanRejectionDashboard from "./pages/LoanRejectionDashboard";

// Voice agent
import VoiceAgentRealtime_v2 from "./components/VoiceAgentRealtime_v2";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Landing Page */}
        <Route path="/" element={<Home />} />

        {/* Apply for Loan (chat/voice/form) */}
        <Route path="/apply" element={<ApplyPage />} />

        {/* Manager Login (User-facing login for applications) */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Dashboard Admin Login */}
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

        {/* Loan Rejection Details */}
        <Route path="/loan-rejection/:userId" element={<LoanRejectionDashboard />} />

        {/* Voice agent (if needed) */}
        <Route path="/voice-agent" element={<VoiceAgentRealtime_v2 />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
