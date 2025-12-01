import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DocumentVerification from "../components/DocumentVerification";
import { loanAPI } from "../utils/api";
import { toast } from "react-toastify";

const Verification = () => {
  const [applicationId, setApplicationId] = useState("");
  const [lockedFromQuery, setLockedFromQuery] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [voiceData, setVoiceData] = useState(null);
  const [fromVoiceAgent, setFromVoiceAgent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qId = params.get("applicationId");
    const source = params.get("source");
    
    if (qId && !applicationId) {
      setApplicationId(qId);
      setLockedFromQuery(true);
    }
    
    if (source === "voice") {
      setFromVoiceAgent(true);
      const name = params.get("name");
      const income = params.get("income");
      const credit = params.get("credit");
      const loan = params.get("loan");
      
      setVoiceData({
        name: name || "",
        monthly_income: parseFloat(income) || 0,
        credit_score: parseInt(credit) || 0,
        loan_amount: parseFloat(loan) || 0
      });
    }
  }, [location.search, applicationId]);

  const handleVerificationSuccess = (data) => {
    toast.success("Eligibility check completed!");
    navigate(`/apply?view=form`, {
      state: { eligibilityResult: data, applicationId },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto h-screen flex flex-col">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-extrabold text-gray-900">
            Document Verification & KYC
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Upload all required documents to proceed with loan eligibility
          </p>
          {fromVoiceAgent && voiceData && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                 Voice Agent Application
              </p>
              <div className="text-xs text-blue-700 space-y-1">
                <p>Applicant: {voiceData.name}</p>
                <p>Monthly Income: ${voiceData.monthly_income.toLocaleString()}</p>
                <p>Credit Score: {voiceData.credit_score}</p>
                <p>Loan Amount: ${voiceData.loan_amount.toLocaleString()}</p>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                After uploading all documents, eligibility will be automatically checked
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
          {applicationId && !lockedFromQuery && (
            <div className="bg-blue-50 border-b border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application ID
                  </label>
                  <input
                    type="text"
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                    placeholder="Enter application ID if you have one"
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 max-w-xs"
                  />
                </div>
                {applicationId && (
                  <button
                    type="button"
                    onClick={() => {
                      setApplicationId("");
                      setLockedFromQuery(false);
                      navigate("/verification", { replace: true });
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col">
            <DocumentVerification
              applicationId={applicationId || null}
              onVerified={handleVerificationSuccess}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verification;
