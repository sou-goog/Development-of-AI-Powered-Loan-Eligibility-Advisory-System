// src/pages/LoanRejectionDashboard.jsx
import React from "react";
import AdminLayout from "../components/AdminLayout";

function LoanRejectionDashboard() {
  // Dummy data for now
  const applicantName = "Ravi Kumar";
  const applicationId = "APP-23918";
  const loanAmount = "₹5,00,000";
  const loanType = "Personal Loan";

  const rejectionReason = "Low Credit Score";
  const detailedReason =
    "Your current credit score is below the required threshold.";

  const metrics = [
    { label: "Your Credit Score", value: "580 / 900" },
    { label: "Required Score", value: "700 / 900" },
    { label: "Monthly Income", value: "₹28,000" },
    { label: "Required Income", value: "₹35,000" },
    { label: "Existing EMIs", value: "₹12,000" },
    { label: "Allowed EMI Limit", value: "₹10,000" },
  ];

  const suggestions = [
    "Pay bills on time for 6 months.",
    "Keep credit card usage below 30%.",
    "Avoid taking new loans.",
    "Update income proof before re-applying.",
  ];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Sharable link copied!");
  };

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-4">
        Loan Rejection Summary (Sharable)
      </h1>

      {/* Banner */}
      <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 mb-6">
        <p className="text-sm text-red-300 font-semibold">Loan Status</p>
        <p className="text-2xl font-bold text-red-400 mt-1">
          ❌ Loan Application Rejected
        </p>
        <p className="text-sm text-slate-300 mt-2">
          This loan could not be approved due to eligibility criteria.
        </p>
      </div>

      {/* Basic Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Applicant Name</p>
          <p className="text-lg font-semibold text-white">{applicantName}</p>

          <p className="text-sm text-slate-400 mt-3">Application ID</p>
          <p className="text-lg font-semibold text-white">{applicationId}</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Loan Type</p>
          <p className="text-lg font-semibold text-white">{loanType}</p>

          <p className="text-sm text-slate-400 mt-3">Requested Amount</p>
          <p className="text-lg font-semibold text-white">{loanAmount}</p>
        </div>
      </div>

      {/* Rejection Reason */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
        <p className="text-sm text-slate-400">Rejection Reason</p>
        <p className="text-xl font-semibold text-red-400 mt-1">
          {rejectionReason}
        </p>
        <p className="text-sm text-slate-300 mt-2">{detailedReason}</p>
      </div>
    </AdminLayout>
  );
}

export default LoanRejectionDashboard;
