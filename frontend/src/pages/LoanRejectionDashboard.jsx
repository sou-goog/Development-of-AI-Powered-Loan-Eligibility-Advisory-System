// src/pages/LoanRejectionDashboard.jsx

import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { loanAPI } from "../utils/api";
import { useParams } from "react-router-dom";

function LoanRejectionDashboard() {
  const { userId, applicationId } = useParams();
  const id = applicationId || userId;
  const [application, setApplication] = useState(null);
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    if (!id) return;
    loanAPI.getApplication(id).then((res) => {
      setApplication(res.data);
    });
  }, [id]);


  const handleShareDashboard = async () => {
    setShareLoading(true);
    setShareError("");
    try {
      // Use userId or application.user_id for sharing (adjust as needed)
      const user_id = application?.user_id || userId;
      if (!user_id) throw new Error("User ID not found");
      const res = await loanAPI.shareDashboard(user_id);
      setShareLink(res.data.link);
      navigator.clipboard.writeText(res.data.link);
      alert("Sharable dashboard link copied!");
    } catch (err) {
      setShareError("Failed to generate share link");
    } finally {
      setShareLoading(false);
    }
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
  } = application;

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
        <p className="text-sm text-red-500 mt-2">
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

      {/* Share Dashboard Option */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold mb-1">Share Dashboard</p>
          <p className="text-xs text-slate-400">
            Generate a public link to share this dashboard with the user.
          </p>
          {shareLink && (
            <div className="mt-2">
              <span className="text-xs text-green-400">Link generated and copied!</span>
              <br />
              <a href={shareLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all">{shareLink}</a>
            </div>
          )}
          {shareError && <div className="text-xs text-red-400 mt-2">{shareError}</div>}
        </div>
        <button
          onClick={handleShareDashboard}
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg"
          disabled={shareLoading}
        >
          {shareLoading ? "Generating..." : "Share Dashboard"}
        </button>
      </div>
    </AdminLayout>
  );
}

export default LoanRejectionDashboard;