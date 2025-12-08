// src/pages/LoanRejectionDashboard.jsx
import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { loanAPI } from "../utils/api";
import { useParams } from "react-router-dom";

function LoanRejectionDashboard() {
  const { userId } = useParams();
  const [application, setApplication] = useState(null);

  useEffect(() => {
    // Fetch application details from API
    loanAPI.getLastApplication().then((res) => {
      setApplication(res.data);
    });
  }, [userId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Sharable link copied!");
  };

  if (!application) return <AdminLayout>Loading...</AdminLayout>;

  const {
    applicantName,
    loanAmount,
    loanType,
    rejectionReason,
    detailedReason,
    metrics = [],
    suggestions = [],
    // eslint-disable-next-line no-unused-vars
    id
  } = application || {};

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
          <p className="text-lg font-semibold text-white">
            {application?.id || "N/A"}
          </p>
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

      {/* Metrics */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold mb-3">Eligibility Snapshot</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {metrics.map((m, index) => (
            <div
              key={index}
              className="bg-slate-900/60 border border-slate-700 rounded-lg p-3"
            >
              <p className="text-xs text-slate-400">{m.label}</p>
              <p className="text-base font-semibold text-white mt-1">
                {m.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold mb-2">How to Improve</p>
        <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
          {suggestions.map((s, index) => (
            <li key={index}>{s}</li>
          ))}
        </ul>
      </div>

      {/* Sharable Link */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold mb-1">Sharable Link</p>
          <p className="text-xs text-slate-400">
            Share this link with the user to view their rejection dashboard.
          </p>
        </div>

        <button
          onClick={handleCopyLink}
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg"
        >
          Copy Link
        </button>
      </div>
    </AdminLayout>
  );
}

export default LoanRejectionDashboard;
