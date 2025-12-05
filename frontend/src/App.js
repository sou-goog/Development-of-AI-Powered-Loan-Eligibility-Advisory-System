// Redesigned App.js with cleaner structure, layout wrappers, animated transitions,
// and ready for modern UI (sidebar + topbar). You can now plug redesigned pages/components.

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import MainLayout from "./layout/MainLayout";

// Pages
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import ApplyPage from "./pages/ApplyPage";
import Verification from "./pages/Verification";
import Manager from "./pages/Manager";
import EligibilityResultPage from "./pages/EligibilityResultPage";
import MiniChatbot from "./components/MiniChatbot";

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

// Utils
import { auth } from "./utils/auth";

// Protected Route Wrapper
function ProtectedRoute({ children, requireManager = false }) {
  const authed = auth.isAuthenticated();
  const manager = auth.isManager();

  if (!authed) return <Navigate to="/auth" replace />;
  if (requireManager && !manager) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/auth"
            element={
              auth.isAuthenticated() ? (
                <Navigate
                  to={auth.isManager() ? "/manager" : "/apply"}
                  replace
                />
              ) : (
                <AuthPage />
              )
            }
          />

          <Route
            path="/apply"
            element={
              <ProtectedRoute>
                <ApplyPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/apply-chat"
            element={
              <ProtectedRoute>
                <div className="p-4">
                  {/* Only MiniChatbot and VoiceAgentButton should be present. */}
                  <MiniChatbot />
                  {/* VoiceAgentButton is already included in MiniChatbot, so no need to add separately unless required elsewhere. */}
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/verify"
            element={
              <ProtectedRoute>
                <Verification />
              </ProtectedRoute>
            }
          />

          <Route
            path="/eligibility-result"
            element={
              <ProtectedRoute>
                <EligibilityResultPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/manager"
            element={
              <ProtectedRoute requireManager={true}>
                <Manager />
              </ProtectedRoute>
            }
          />

          {/* Dashboard Admin Login */}
          <Route path="/login" element={<Login />} />

          {/* Dashboard Pages */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireManager={true}>
                <MainDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loan-analytics"
            element={
              <ProtectedRoute requireManager={true}>
                <LoanAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ml-performance"
            element={
              <ProtectedRoute requireManager={true}>
                <MLPerformance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voice-analytics"
            element={
              <ProtectedRoute requireManager={true}>
                <VoiceAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications"
            element={
              <ProtectedRoute requireManager={true}>
                <ApplicationsTable />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transcripts"
            element={
              <ProtectedRoute requireManager={true}>
                <Transcripts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requireManager={true}>
                <SystemSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/overview"
            element={
              <ProtectedRoute requireManager={true}>
                <ProjectOverview />
              </ProtectedRoute>
            }
          />

          {/* Loan Rejection Details */}
          <Route
            path="/loan-rejection/:userId"
            element={
              <ProtectedRoute>
                <LoanRejectionDashboard />
              </ProtectedRoute>
            }
          />

          {/* Voice agent (if needed) */}
          <Route path="/voice-agent" element={<VoiceAgentRealtime_v2 />} />
        </Routes>

        <ToastContainer position="top-right" autoClose={4000} />
      </MainLayout>
    </Router>
  );
}
