// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    // Simple admin login credentials
    if (email === "admin@gmail.com" && password === "Admin@123") {
      setError("");
      navigate("/dashboard"); // Go to the dashboard after login
    } else {
      setError("Invalid email or password. Try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-slate-900">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl p-8 rounded-2xl w-[360px]">
        <h1 className="text-center text-2xl font-bold text-white mb-2">
          Admin Login
        </h1>
        <p className="text-center text-slate-300 mb-6 text-sm">
          AI Loan Eligibility Dashboard
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-slate-300 text-sm">Email</label>
            <input
              type="email"
              placeholder="admin@gmail.com"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 mt-1 focus:ring-2 focus:ring-blue-400 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-slate-300 text-sm">Password</label>
            <input
              type="password"
              placeholder="Admin@123"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 mt-1 focus:ring-2 focus:ring-blue-400 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-300 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-400 transition py-2 rounded-lg text-white font-semibold"
          >
            Login
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-4">
          Username: <b>admin@gmail.com</b> <br />
          Password: <b>Admin@123</b>
        </p>
      </div>
    </div>
  );
}

export default Login;
