import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FileUpload from "../components/FileUpload";
import { loanAPI } from "../utils/api";
import { toast } from "react-toastify";

const Verification = () => {
  const [applicationId, setApplicationId] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [lockedFromQuery, setLockedFromQuery] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [voiceData, setVoiceData] = useState(null);
  const [fromVoiceAgent, setFromVoiceAgent] = useState(false);

  useEffect(() => {
    // Pre-fill applicationId from query string if present: /verification?applicationId=123
    const params = new URLSearchParams(location.search);
    const qId = params.get("applicationId");
    const source = params.get("source");
    
    if (qId && !applicationId) {
      setApplicationId(qId);
      setLockedFromQuery(true);
    }
    
    // Check if coming from voice agent
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

  const handleUploadSuccess = (data) => {
    setExtractedData(data.extracted_data);
    // If from voice agent, automatically trigger prediction after document upload
    if (fromVoiceAgent && voiceData) {
      // Small delay to ensure document is marked as verified in backend
      setTimeout(() => {
        handleEligibilityCheck();
      }, 1000);
    }
  };

  const handleEligibilityCheck = async () => {
    if (!extractedData) {
      toast.error("Please upload and verify a document first.");
      return;
    }

    setCheckingEligibility(true);
    try {
      let response;
      if (applicationId) {
        // Use the application-aware prediction when we have an ID
        response = await loanAPI.predictForApplication(applicationId);
      } else {
        // Combine extracted data with voice agent data or defaults
        const eligibilityData = {
          ...extractedData,
          Age: extractedData.Age || 30,
          Gender: extractedData.Gender || "Male",
          Marital_Status: extractedData.Marital_Status || "Single",
          Monthly_Income:
            extractedData.Monthly_Income ||
            extractedData.monthly_income ||
            (voiceData ? voiceData.monthly_income : 50000),
          Employment_Type: extractedData.Employment_Type || "Salaried",
          Loan_Amount_Requested: extractedData.Loan_Amount_Requested || (voiceData ? voiceData.loan_amount : 500000),
          Loan_Tenure_Years: extractedData.Loan_Tenure_Years || 5,
          Credit_Score: extractedData.Credit_Score || (voiceData ? voiceData.credit_score : 650),
          Region: extractedData.Region || "Urban",
          Loan_Purpose: extractedData.Loan_Purpose || "Personal",
          Dependents: extractedData.Dependents || 0,
          Existing_EMI: extractedData.Existing_EMI || 0,
          Salary_Credit_Frequency:
            extractedData.Salary_Credit_Frequency || "Monthly",
          Total_Withdrawals: extractedData.Total_Withdrawals || 0,
          Total_Deposits: extractedData.Total_Deposits || 0,
          Avg_Balance: extractedData.Avg_Balance || 0,
          Bounced_Transactions: extractedData.Bounced_Transactions || 0,
          Account_Age_Months: extractedData.Account_Age_Months || 12,
          Total_Liabilities: extractedData.Total_Liabilities || 0,
          Debt_to_Income_Ratio: extractedData.Debt_to_Income_Ratio || 0,
          Income_Stability_Score: extractedData.Income_Stability_Score || 0.8,
          Credit_Utilization_Ratio:
            extractedData.Credit_Utilization_Ratio || 0.3,
          Loan_to_Value_Ratio: extractedData.Loan_to_Value_Ratio || 0.7,
        };
        response = await loanAPI.predictEligibility(eligibilityData);
      }

      toast.success("Eligibility check completed!");
      navigate(`/apply?view=form`, {
        state: { eligibilityResult: response.data, applicationId },
      });
    } catch (error) {
      toast.error("Failed to check eligibility. Please try again.");
      console.error("Eligibility check error:", error);
    } finally {
      setCheckingEligibility(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Document Verification
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Upload your bank statement or relevant documents for OCR
            verification
          </p>
          {fromVoiceAgent && voiceData && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                📞 Voice Agent Application
              </p>
              <div className="text-xs text-blue-700 space-y-1">
                <p>Applicant: {voiceData.name}</p>
                <p>Monthly Income: ${voiceData.monthly_income.toLocaleString()}</p>
                <p>Credit Score: {voiceData.credit_score}</p>
                <p>Loan Amount: ${voiceData.loan_amount.toLocaleString()}</p>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                After uploading your document, eligibility will be automatically checked
              </p>
            </div>
          )}
        </div>

        <div className="bg-white py-6 px-4 shadow sm:rounded-lg sm:px-8 h-[78vh] flex flex-col min-h-0">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Application ID (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                placeholder="Enter application ID if you have one"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                disabled={lockedFromQuery}
                readOnly={lockedFromQuery}
              />
              {lockedFromQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setApplicationId("");
                    setLockedFromQuery(false);
                    navigate("/verify", { replace: true });
                  }}
                  className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
                  title="Unlink from this application"
                >
                  Unlink
                </button>
              )}
            </div>
            {lockedFromQuery && applicationId && (
              <p className="mt-1 text-xs text-gray-500">
                Linked to application #{applicationId}. You can unlink to upload
                without attaching to an application.
              </p>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              applicationId={applicationId || null}
              footer={
                <div>
                  <button
                    onClick={handleEligibilityCheck}
                    disabled={checkingEligibility}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {checkingEligibility
                      ? "Checking Eligibility..."
                      : "Proceed to Eligibility Check"}
                  </button>
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    Click the button to run the eligibility check.
                  </p>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verification;
