import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Chatbot from "../components/Chatbot";
import MiniChatbot from "../components/MiniChatbot";
import LoanApplicationForm from "../components/LoanApplicationForm";
import LoanResultCard from "../components/LoanResultCard";
import CallingAgentPanel from "../components/CallingAgentPanel";

/*
  Redesigned Apply Page
  - Cleaner split layout
  - Modern card styles matching Home + Navbar redesign
  - Smooth transitions between chatbot, voice panel, and form
  - Professional dashboard-like layout
  - Reusable motion presets
*/

export default function ApplyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const resultRef = useRef(null);

  const [eligibilityResult, setEligibilityResult] = useState(null);
  const [applicationData, setApplicationData] = useState(null);
  const [applicationId, setApplicationId] = useState(null);

  const params = new URLSearchParams(location.search);
  const view = params.get("view") || "voice"; // voice | form

  useEffect(() => {
    if (view === "form" && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  useEffect(() => {
    const state = location.state || {};
    if (state.eligibilityResult) {
      setEligibilityResult(state.eligibilityResult);
      if (state.applicationId) setApplicationId(state.applicationId);

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [location.state]);

  return (
    <div className="min-h-screen bg-slate-50 py-14 px-6 relative">
      <div className="max-w-7xl mx-auto w-full space-y-14">

        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white border shadow-lg rounded-3xl p-10"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 md:mb-0">
                Apply for a Loan
              </h1>
              <p className="text-slate-600 max-w-3xl text-lg mb-6 md:mb-0">
                Choose your preferred method — chat with our AI assistant, use the
                voice calling agent, or fill the form directly.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-4 md:mt-0 px-6 py-2 bg-primary-600 text-white font-semibold rounded-full shadow hover:bg-primary-700 transition"
            >
              Go to Home
            </button>
          </div>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Chatbot */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white border shadow-md rounded-2xl p-6"
          >
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              AI Chat Assistance
            </h2>
            <Chatbot applicationId={applicationId} />
          </motion.div>

          {/* Right: Form / Voice / Result */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="bg-white border shadow-md rounded-2xl p-6"
          >
            {view === "form" ? (
              !eligibilityResult ? (
                <div ref={formRef}>
                  <h2 className="text-xl font-semibold text-slate-800 mb-4">
                    Loan Application Form
                  </h2>
                  <LoanApplicationForm
                    setEligibilityResult={setEligibilityResult}
                    setApplicationData={setApplicationData}
                    setApplicationId={setApplicationId}
                  />
                </div>
              ) : (
                <div ref={resultRef}>
                  <LoanResultCard
                    result={eligibilityResult}
                    applicationData={applicationData}
                    applicationId={
                      applicationId || applicationData?.application_id
                    }
                  />
                </div>
              )
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-800 mb-4">
                  Voice-Based Calling Agent
                </h2>
                <CallingAgentPanel />
              </>
            )}
          </motion.div>
        </div>
      </div>
      {/* MiniChatbot fixed at bottom-right for all pages */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50 }}>
        <MiniChatbot applicationId={applicationId} />
      </div>
    </div>
  );
}