import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DocumentVerification from "../components/DocumentVerification";
import { loanAPI, reportAPI } from "../utils/api";
import { toast } from "react-toastify";

const Verification = () => {
  const [applicationId, setApplicationId] = useState("");
  const [lockedFromQuery, setLockedFromQuery] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Pre-fill applicationId from query string if present: /verification?applicationId=123
    const params = new URLSearchParams(location.search);
    const qId = params.get("applicationId");
    if (qId && !applicationId) {
      setApplicationId(qId);
      setLockedFromQuery(true);
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
