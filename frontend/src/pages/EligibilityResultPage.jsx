import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoanResultCard from "../components/LoanResultCard";

export default function EligibilityResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Get result and applicationId from navigation state or query params
  const { result, applicationId, applicationData, extractedData } = location.state || {};

  // If no result, redirect back to verification
  React.useEffect(() => {
    if (!result || !applicationId) {
      navigate("/verify", { replace: true });
    }
  }, [result, applicationId, navigate]);

  if (!result || !applicationId) return null;

  // Only show XGBoost model result if available
  let xgboostResult = result;
  if (result && result.models && result.models.xgboost) {
    xgboostResult = {
      ...result.models.xgboost,
      risk_level: result.risk_level,
      credit_tier: result.credit_tier,
      confidence: result.confidence,
      debt_to_income_ratio: result.debt_to_income_ratio,
      recommendations: result.recommendations,
    };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-100/80 via-white to-secondary-100/80 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-3xl mx-auto pt-10 px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Loan Assessment Result</h1>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-full shadow hover:bg-primary-700 transition"
          >
            Go to Home
          </button>
        </div>
        <LoanResultCard
          result={xgboostResult}
          applicationId={applicationId}
          applicationData={applicationData}
          extractedData={extractedData}
        />
      </div>
<<<<<<< HEAD
    </div>
  );
}
=======
    );
}
>>>>>>> origin/backup/safe-branch
