import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { authAPI } from "../utils/api";
import { auth } from "../utils/auth";
import { toast } from "react-toastify";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  Shield,
} from "lucide-react";

// Segmented OTP input component (6 digits)
const OTPInput = ({ value, onChange }) => {
  const inputs = Array.from({ length: 6 });
  const refs = useRef(inputs.map(() => React.createRef()));

  const handleChange = (idx, val) => {
    const digit = val.replace(/\D/g, "").slice(0, 1);
    const chars = (value || "").padEnd(6, "").split("");
    chars[idx] = digit;
    const next = chars.join("").slice(0, 6);
    onChange(next);
    if (digit && idx < 5) refs.current[idx + 1].current?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !((value || "")[idx] || "")) {
      if (idx > 0) refs.current[idx - 1].current?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0)
      refs.current[idx - 1].current?.focus();
    if (e.key === "ArrowRight" && idx < 5)
      refs.current[idx + 1].current?.focus();
  };

  useEffect(() => {
    // Autofocus first empty cell
    const firstEmpty = (value || "").indexOf("");
    if (firstEmpty === -1 || firstEmpty > 5) return;
    refs.current[firstEmpty]?.current?.focus();
  }, [value]);

  return (
    <div className="flex items-center justify-center gap-2">
      {inputs.map((_, i) => (
        <input
          key={i}
          ref={refs.current[i]}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={(value || "")[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-12 h-12 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xl"
        />
      ))}
    </div>
  );
};

const LoginForm = ({ onSwitchToSignup }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpPhase, setOtpPhase] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loginPayload, setLoginPayload] = useState(null); // holds token+user until OTP verified
  const [remember, setRemember] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login(formData.email, formData.password);
      const { access_token, token, user } = response.data || {};
      const finalToken = access_token || token;
      if (!finalToken || !user)
        throw new Error("Invalid login response from server");

      // If already verified skip OTP
      if (user.email_verified) {
        auth.setToken(finalToken, remember);
        auth.setUser(user, remember);
        toast.success("Login successful!");
        navigate(user.role === "manager" ? "/manager" : "/apply");
        return;
      }

      // Move to OTP phase
      setLoginPayload({ token: finalToken, user });
      setOtpPhase(true);
      setResendCooldown(0); // allow immediate send
      await handleSendOTP(user.email, user.id, true);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };
  const handleSendOTP = async (email, userId, initial = false) => {
    if (resendCooldown > 0 && !initial) return;
    setOtpSending(true);
    setOtpError("");
    try {
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, user_id: userId }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || "Failed to send OTP");
      toast.info("OTP sent to your email");
      setResendCooldown(45); // 45 second cooldown
    } catch (e) {
      setOtpError(e.message);
    } finally {
      setOtpSending(false);
    }
  };

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!loginPayload) return;
    setLoading(true);
    setOtpError("");
    try {
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginPayload.user.email,
          otp_code: otpCode,
          user_id: loginPayload.user.id,
        }),
      });
      const data = await resp.json();
      if (!data.verified) throw new Error("Invalid OTP");
      // Persist auth now
      auth.setToken(loginPayload.token, remember);
      auth.setUser({ ...loginPayload.user, email_verified: true }, remember);
      toast.success("Email verified. Login complete!");
      navigate(loginPayload.user.role === "manager" ? "/manager" : "/apply");
    } catch (e) {
      setOtpError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (otpPhase) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <h3 className="text-xl font-semibold text-gray-900 text-center">
          Verify Your Email
        </h3>
        <p className="text-sm text-gray-600 text-center">
          Enter the 6-digit code sent to {loginPayload?.user?.email}
        </p>
        {otpError && (
          <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
            {otpError}
          </div>
        )}
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <OTPInput value={otpCode} onChange={(v) => setOtpCode(v)} />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="btn-primary w-full flex items-center justify-center disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </motion.button>
        </form>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={otpSending || resendCooldown > 0}
            onClick={() =>
              handleSendOTP(loginPayload.user.email, loginPayload.user.id)
            }
            className="text-primary-600 disabled:text-gray-400 hover:underline"
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : otpSending
              ? "Sending..."
              : "Resend Code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOtpPhase(false);
              setLoginPayload(null);
              setOtpCode("");
              setOtpError("");
            }}
            className="text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    );
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="input-field pl-10"
            placeholder="Enter your email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="input-field pl-10 pr-10"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>Remember me</span>
        </label>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="btn-primary px-6 py-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Signing in...
            </div>
          ) : (
            <>
              Sign In
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </motion.button>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
          >
            Create one now
          </button>
        </p>
      </div>
    </motion.form>
  );
};

const SignupForm = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "applicant",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [postRegisterOTP, setPostRegisterOTP] = useState(false);
  const [regOtpCode, setRegOtpCode] = useState("");
  const [regPayload, setRegPayload] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.register(
        formData.email,
        formData.password,
        formData.fullName,
        formData.role
      );
      // auto-login to get token & user
      const loginResp = await authAPI.login(formData.email, formData.password);
      const { access_token, token, user } = loginResp.data || {};
      const finalToken = access_token || token;
      if (!finalToken || !user)
        throw new Error("Invalid login response after registration");
      // registration implies unverified email -> start OTP flow
      setRegPayload({ token: finalToken, user });
      setPostRegisterOTP(true);
      setResendCooldown(0);
      await handleSendOTP(user.email, user.id, true);
      toast.info("Account created. Verify email to complete login.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };
  const handleSendOTP = async (email, userId, initial = false) => {
    if (resendCooldown > 0 && !initial) return;
    setOtpError("");
    try {
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, user_id: userId }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || "Failed to send OTP");
      toast.info("OTP sent to your email");
      setResendCooldown(45);
    } catch (e) {
      setOtpError(e.message);
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!regPayload) return;
    setLoading(true);
    setOtpError("");
    try {
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regPayload.user.email,
          otp_code: regOtpCode,
          user_id: regPayload.user.id,
        }),
      });
      const data = await resp.json();
      if (!data.verified) throw new Error("Invalid OTP");
      auth.setToken(regPayload.token);
      auth.setUser({ ...regPayload.user, email_verified: true });
      toast.success("Email verified. Welcome!");
      // Navigate based on role (SPA navigation)
      navigate(regPayload.user.role === "manager" ? "/manager" : "/apply");
    } catch (e) {
      setOtpError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (postRegisterOTP) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <h3 className="text-xl font-semibold text-gray-900 text-center">
          Verify Your Email
        </h3>
        <p className="text-sm text-gray-600 text-center">
          Enter the 6-digit code sent to {regPayload?.user?.email}
        </p>
        {otpError && (
          <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
            {otpError}
          </div>
        )}
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <OTPInput value={regOtpCode} onChange={(v) => setRegOtpCode(v)} />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || regOtpCode.length !== 6}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </motion.button>
        </form>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={resendCooldown > 0}
            onClick={() =>
              handleSendOTP(regPayload.user.email, regPayload.user.id)
            }
            className="text-primary-600 disabled:text-gray-400 hover:underline"
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend Code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPostRegisterOTP(false);
              setRegPayload(null);
              setRegOtpCode("");
              setOtpError("");
            }}
            className="text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    );
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Full Name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
            className="input-field pl-10"
            placeholder="Enter your full name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="input-field pl-10"
            placeholder="Enter your email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="input-field pl-10 pr-10"
            placeholder="Create a password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Account Type
        </label>
        <div className="relative">
          <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="input-field pl-10 appearance-none"
          >
            <option value="applicant">Loan Applicant</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Creating account...
          </div>
        ) : (
          <>
            Create Account
            <ArrowRight className="ml-2 w-5 h-5" />
          </>
        )}
      </motion.button>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
          >
            Sign in here
          </button>
        </p>
      </div>
    </motion.form>
  );
};

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {isLogin ? "Welcome back" : "Join our platform"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isLogin
              ? "Sign in to access your AI-powered loan assistant"
              : "Create your account to start your loan journey"}
          </p>
        </motion.div>

        {/* Form Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="card"
        >
          <div className="px-8 py-6">
            {isLogin ? (
              <LoginForm onSwitchToSignup={() => setIsLogin(false)} />
            ) : (
              <SignupForm onSwitchToLogin={() => setIsLogin(true)} />
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center"
        >
          <p className="text-xs text-gray-500">
            Secured with enterprise-grade encryption
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
