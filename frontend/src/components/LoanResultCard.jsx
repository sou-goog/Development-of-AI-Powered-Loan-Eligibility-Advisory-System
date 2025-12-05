import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Shield,
  CreditCard,
  Target,
  Award,
} from "lucide-react";
import { reportAPI } from "../utils/api";

const LoanResultCard = ({
  result,
  applicationData,
  extractedData,
  applicationId,
}) => {
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const getStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case "eligible":
        return {
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          icon: CheckCircle,
          gradient: "from-green-500 to-emerald-500",
          statusText: "Eligible for Loan",
        };
      case "ineligible":
        return {
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          icon: XCircle,
          gradient: "from-red-500 to-rose-500",
          statusText: "Not Eligible",
        };
      default:
        return {
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          icon: AlertTriangle,
          gradient: "from-yellow-500 to-orange-500",
          statusText: "Under Review",
        };
    }
  };

  const getRiskConfig = (risk) => {
    switch (risk?.toLowerCase()) {
      case "low_risk":
        return {
          color: "text-green-600",
          bgColor: "bg-green-100",
          label: "Low Risk",
        };
      case "medium_risk":
        return {
          color: "text-yellow-600",
          bgColor: "bg-yellow-100",
          label: "Medium Risk",
        };
      case "high_risk":
        return {
          color: "text-red-600",
          bgColor: "bg-red-100",
          label: "High Risk",
        };
      default:
        return {
          color: "text-gray-600",
          bgColor: "bg-gray-100",
          label: "Unknown",
        };
    }
  };

  const statusConfig = getStatusConfig(result.eligibility_status);
  const riskConfig = getRiskConfig(result.risk_level);
  const StatusIcon = statusConfig.icon;

  // Normalize percentage-like values from 0-1 to 0-100 display
  const toPct = (v) => {
    const n = Number(v ?? 0);
    if (Number.isNaN(n)) return 0;
    return n <= 1 ? Math.round(n * 100) : Math.round(n);
  };

  const scorePct = toPct(result.eligibility_score);
  const confPct = toPct(result.confidence);
  const dtiRatio = Number(result.debt_to_income_ratio ?? 0) || 0;
  const dtiPct = Math.round(dtiRatio * 100);
  const dtiConfig = (() => {
    if (dtiRatio <= 0.36)
      return {
        color: "text-green-600",
        bgColor: "bg-green-100",
        label: `${dtiPct}% (Good)`,
      };
    if (dtiRatio <= 0.43)
      return {
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
        label: `${dtiPct}% (Borderline)`,
      };
    return {
      color: "text-red-600",
      bgColor: "bg-red-100",
      label: `${dtiPct}% (High)`,
    };
  })();

  const metrics = [
    {
      icon: TrendingUp,
      label: "Eligibility Score",
      value: `${scorePct}%`,
      progress: scorePct,
      color: "bg-primary-500",
    },
    {
      icon: Shield,
      label: "Risk Level",
      value: riskConfig.label,
      color: riskConfig.color,
      bgColor: riskConfig.bgColor,
    },
    {
      icon: CreditCard,
      label: "Credit Tier",
      value: result.credit_tier,
      color: "text-secondary-600",
    },
    {
      icon: Target,
      label: "Debt-to-Income",
      value: dtiConfig.label,
      color: dtiConfig.color,
      bgColor: dtiConfig.bgColor,
    },
    {
      icon: Award,
      label: "Confidence",
      value: `${confPct}%`,
      progress: confPct,
      color: "bg-secondary-500",
    },
  ];

  // Auto-generate analysis once when result is present
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!applicationId || !result || analysis) return;
      setLoadingExplain(true);
      setAnalysisError("");
      try {
        const { data } = await reportAPI.generateAnalysis(applicationId);
        // Prefer explicit analysis text; if missing, fall back to raw payload for debugging
        const analysisText = data?.analysis ?? JSON.stringify(data ?? {});
        if (!cancelled) setAnalysis(analysisText);
      } catch (e) {
        // Provide more detailed error feedback for debugging
        let msg =
          "Sorry, I'm having trouble responding right now. Please try again.";
        try {
          msg =
            e?.response?.data?.detail || e?.response?.data || e?.message || msg;
        } catch (__) {}
        if (!cancelled) setAnalysisError(String(msg));
      } finally {
        if (!cancelled) setLoadingExplain(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, !!result]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-2xl mx-auto"
    >
      {/* Main Result Card */}
      <div
        className={`card border-2 ${statusConfig.borderColor} ${statusConfig.bgColor} overflow-hidden`}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${statusConfig.gradient} px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <StatusIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Loan Assessment Result
                </h3>
                <p className="text-white/90 text-sm">
                  AI-powered eligibility analysis
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{scorePct}%</div>
              <div className="text-white/90 text-sm">Eligibility Score</div>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className={`px-6 py-3 rounded-full ${statusConfig.bgColor} border-2 ${statusConfig.borderColor}`}
            >
              <div className="flex items-center space-x-2">
                <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                <span className={`font-bold text-lg ${statusConfig.color}`}>
                  {statusConfig.statusText}
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      metric.bgColor || "bg-gray-100"
                    }`}
                  >
                    <metric.icon className={`w-4 h-4 ${metric.color}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {metric.label}
                  </span>
                </div>

                {metric.progress !== undefined ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">
                        {metric.value}
                      </span>
                      <span className="text-sm text-gray-500">
                        {metric.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        className={`h-2 rounded-full ${metric.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${metric.progress}%` }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 1 }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-lg font-bold text-gray-900">
                    {metric.value}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              disabled={!applicationId || loadingExplain}
              onClick={async () => {
                if (!applicationId) return;
                setLoadingExplain(true);
                try {
                  const { data } = await reportAPI.generateAnalysis(
                    applicationId
                  );
                  const analysisText =
                    data?.analysis ?? JSON.stringify(data ?? {});
                  setAnalysis(analysisText);
                  setAnalysisError("");
                } catch (e) {
                  let msg =
                    "Sorry, I'm having trouble responding right now. Please try again.";
                  try {
                    msg =
                      e?.response?.data?.detail ||
                      e?.response?.data ||
                      e?.message ||
                      msg;
                  } catch (__) {}
                  setAnalysisError(String(msg));
                } finally {
                  setLoadingExplain(false);
                }
              }}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-60"
              title={
                !applicationId
                  ? "Analysis requires an application ID"
                  : "Explain the result with AI"
              }
            >
              {loadingExplain ? "Generating analysis..." : "Explain with AI"}
            </button>

            <button
              disabled={!applicationId || reportLoading}
              onClick={async () => {
                if (!applicationId) return;
                setReportLoading(true);
                try {
                  // Ensure report exists
                  await reportAPI.generateReport(applicationId);
                  // Then trigger download
                  const res = await reportAPI.downloadReport(applicationId);
                  const contentType =
                    res.headers?.["content-type"] || "application/pdf";
                  const blob = new Blob([res.data], { type: contentType });
                  const url = window.URL.createObjectURL(blob);
                  // If the server returned HTML (fallback), open in new tab so browser can render it.
                  if (contentType.includes("html")) {
                    window.open(url, "_blank");
                  } else {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `loan_report_${applicationId}${
                      contentType.includes("pdf") ? ".pdf" : ""
                    }`;
                    a.click();
                    a.remove();
                  }
                  window.URL.revokeObjectURL(url);
                } catch (e) {
                  // optional: toast
                } finally {
                  setReportLoading(false);
                }
              }}
              className="px-4 py-2 rounded-md bg-gray-800 text-white disabled:opacity-60"
              title={
                !applicationId
                  ? "Report requires an application ID"
                  : "Download PDF report"
              }
            >
              {reportLoading ? "Preparing report..." : "Download PDF Report"}
            </button>
          </div>
        </div>
      </div>

      {/* Application Summary */}
      {(applicationData || extractedData) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card mt-6"
        >
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-secondary-100 p-2 rounded-lg">
              <CreditCard className="w-5 h-5 text-secondary-600" />
            </div>
            <h4 className="text-lg font-semibold text-primary-600">
              Application Summary
            </h4>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {applicationData && (
              <div>
                <h5 className="font-medium text-gray-900 mb-3">
                  Personal Information
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">
                      {applicationData.full_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{applicationData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium">{applicationData.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Income:</span>
                    <span className="font-medium">
                      ₹{applicationData.monthly_income}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loan Amount:</span>
                    <span className="font-medium">
                      ₹{applicationData.loan_amount_requested}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {extractedData && (
              <div>
                <h5 className="font-medium text-secondary-600 mb-3">
                  Document Verification
                </h5>
                <div className="space-y-2 text-sm">
                  {extractedData.monthly_income && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Verified Income:</span>
                      <span className="font-medium">
                        ₹{extractedData.monthly_income}
                      </span>
                    </div>
                  )}
                  {extractedData.credit_score && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Credit Score:</span>
                      <span className="font-medium">
                        {extractedData.credit_score}
                      </span>
                    </div>
                  )}
                  {extractedData.account_age_months && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Age:</span>
                      <span className="font-medium">
                        {extractedData.account_age_months} months
                      </span>
                    </div>
                  )}
                  {extractedData.avg_balance && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Balance:</span>
                      <span className="font-medium">
                        ₹{extractedData.avg_balance}
                      </span>
                    </div>
                  )}
                  <div className="mt-3 p-2 bg-green-50 rounded-lg">
                    <p className="text-green-800 text-xs font-medium">
                      ✓ Document verification completed
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* AI Analysis Section */}
      {(analysis || analysisError || loadingExplain) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6"
        >
          <div className="card border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-indigo-200">
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    AI Analysis & Insights
                  </h3>
                  <p className="text-xs text-gray-600">
                    Detailed assessment by our AI system
                  </p>
                </div>
              </div>
              {analysisError && (
                <button
                  onClick={async () => {
                    if (!applicationId) return;
                    setLoadingExplain(true);
                    setAnalysisError("");
                    try {
                      const { data } = await reportAPI.generateAnalysis(
                        applicationId
                      );
                      setAnalysis(data.analysis);
                    } catch (e) {
                      setAnalysisError(
                        "Sorry, I'm having trouble responding right now. Please try again."
                      );
                    } finally {
                      setLoadingExplain(false);
                    }
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-white border border-indigo-300 text-indigo-600 hover:bg-indigo-100 font-medium transition"
                >
                  Retry
                </button>
              )}
            </div>

            {/* Loading State */}
            {loadingExplain && !analysis && (
              <div className="py-8 text-center">
                <div className="inline-block">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full"
                  />
                </div>
                <p className="text-gray-600 text-sm mt-3">
                  Analyzing your loan application...
                </p>
              </div>
            )}

            {/* Error State */}
            {analysisError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                <p className="text-red-700 text-sm">
                  <span className="font-semibold">Error: </span>
                  {analysisError}
                </p>
              </div>
            )}

            {/* Analysis Content */}
            {analysis && !loadingExplain && (
              <div className="space-y-4 text-left">
                {/* Parse and display analysis in structured format */}
                {(() => {
                  const sections = analysis
                    .split(/\n\n+/)
                    .filter((s) => s.trim())
                    .map((section) => {
                      return section.trim();
                    });

                  return sections.map((section, idx) => {
                    // Parse structured sections
                    if (section.includes(":") && !section.includes("\n")) {
                      const [label, value] = section
                        .split(":")
                        .map((s) => s.trim());
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * idx }}
                          className="flex justify-between items-start bg-white rounded-lg p-3 border border-indigo-100"
                        >
                          <span className="text-gray-600 font-medium">
                            {label}
                          </span>
                          <span className="text-gray-900 font-semibold text-right ml-2">
                            {value}
                          </span>
                        </motion.div>
                      );
                    }

                    // Multi-line section (prose)
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * idx }}
                        className="bg-white rounded-lg p-4 border border-indigo-100"
                      >
                        <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-wrap">
                          {section}
                        </p>
                      </motion.div>
                    );
                  });
                })()}
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-indigo-200">
              <p className="text-xs text-gray-600 text-center">
                💡 This assessment is based on AI analysis of your provided
                information and credit profile. For final approval, please
                consult with a loan officer.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bottom note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center mt-6 text-sm text-gray-500"
      >
        <p>
          Your assessment is complete. Review your results and download the
          report for your records.
        </p>
      </motion.div>
    </motion.div>
  );
};

export default LoanResultCard;
