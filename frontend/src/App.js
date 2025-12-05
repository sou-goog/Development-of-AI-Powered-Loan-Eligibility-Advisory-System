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

        {/* Application Page */}
        <Route path="/apply" element={<ApplyPage />} />

        {/* Public Login (Applicant Login) */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Admin Login */}
        <Route path="/login" element={<Login />} />

        {/* DASHBOARD ROUTES */}
        <Route path="/admin/dashboard" element={<MainDashboard />} />
        <Route path="/admin/loan-analytics" element={<LoanAnalytics />} />
        <Route path="/admin/ml-performance" element={<MLPerformance />} />
        <Route path="/admin/voice-analytics" element={<VoiceAnalytics />} />
        <Route path="/admin/applications" element={<ApplicationsTable />} />
        <Route path="/admin/transcripts" element={<Transcripts />} />
        <Route path="/admin/settings" element={<SystemSettings />} />
        <Route path="/admin/overview" element={<ProjectOverview />} />
        <Route path="/admin/loan-rejection/:userId" element={<LoanRejectionDashboard />} />

        {/* Voice agent */}
        <Route path="/voice-agent" element={<VoiceAgentRealtime_v2 />} />

        {/* 404 → redirect home */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
