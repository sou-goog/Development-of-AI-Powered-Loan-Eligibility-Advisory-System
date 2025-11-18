import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Components
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import Chatbot from "./components/Chatbot";
import ApplyPage from "./pages/ApplyPage";
import Verification from "./pages/Verification";
import Manager from "./pages/Manager";

// Utils
import { auth } from "./utils/auth";

function App() {
  // Protected Route Component
  const ProtectedRoute = ({ children, requireManager = false }) => {
    const authed = auth.isAuthenticated();
    const manager = auth.isManager();
    if (!authed) {
      return <Navigate to="/auth" replace />;
    }
    if (requireManager && !manager) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
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
                <div className="container mx-auto px-4 py-8">
                  <Chatbot />
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
            path="/manager"
            element={
              <ProtectedRoute requireManager={true}>
                <Manager />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </Router>
  );
}

export default App;
