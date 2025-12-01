import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Chatbot from "../components/Chatbot";
import CallingAgentPanel from "../components/CallingAgentPanel";
import LoanApplicationForm from "../components/LoanApplicationForm";
import LoanResultCard from "../components/LoanResultCard";
import { useLocation } from "react-router-dom";

const ApplyPage = () => {
  const location = useLocation();
  const formRef = useRef(null);
  const resultRef = useRef(null);
  const [eligibilityResult, setEligibilityResult] = useState(null);
  const [applicationData, setApplicationData] = useState(null);
  const [applicationId, setApplicationId] = useState(null);
  const params = new URLSearchParams(location.search);
  const view = params.get("view") || "voice"; // voice | form

  useEffect(() => {
    if (view === "form" && formRef.current) {
      // Smooth scroll to the form when requested
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  // If navigated from Verification with eligibilityResult in state, show results
  useEffect(() => {
    const state = location.state || {};
    if (state.eligibilityResult) {
      setEligibilityResult(state.eligibilityResult);
      if (state.applicationId) setApplicationId(state.applicationId);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [location.state]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Page intro */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 text-center mb-3">
            Apply for a Loan
          </h1>
          <p className="text-gray-600 text-center max-w-3xl mx-auto">
            Choose how you’d like to proceed. You can chat with our AI assistant
            or use the voice-based calling agent. Both options connect to the
            same application flow.
          </p>
        </motion.div>

        {/* Side-by-side: Chatbot + Voice panel or Detailed Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="h-[70vh] md:h-[75vh]">
              <Chatbot showVoiceAgentInHeader={false} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {view === "form" ? (
              <div className="h-full space-y-6">
                {!eligibilityResult ? (
                  <div ref={formRef} id="form-section">
                    <LoanApplicationForm
                      onFormComplete={({
                        formData,
                        eligibilityResult: result,
                        applicationId,
                      }) => {
                        setEligibilityResult(result);
                        setApplicationData({
                          ...formData,
                          application_id: applicationId,
                        });
                        // Scroll to results
                        setTimeout(() => {
                          resultRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }, 100);
                      }}
                    />
                  </div>
                ) : (
                  <div ref={resultRef} id="result-section">
                    <LoanResultCard
                      result={eligibilityResult}
                      applicationData={applicationData}
                      applicationId={
                        applicationId || applicationData?.application_id
                      }
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[70vh] md:h-[75vh]">
                <CallingAgentPanel />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ApplyPage;
