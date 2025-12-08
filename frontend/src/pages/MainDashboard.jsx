// src/pages/MainDashboard.jsx
import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { loanAPI } from "../utils/api";
import { auth } from "../utils/auth";

function MainDashboard() {
  // User dashboard state
  const [latestApp, setLatestApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const user = auth.getUser();
  const userId = user?.id;

  const handleShare = async () => {
    setIsCopying(true);
    try {
      const res = await loanAPI.shareDashboard(userId);
      setShareLink(res.data.link);
      navigator.clipboard.writeText(res.data.link);
    } catch (err) {
      setShareLink("Error generating link");
    }
    setIsCopying(false);
  };

  useEffect(() => {
    async function fetchLatestApplication() {
      setLoading(true);
      try {
        const res = await loanAPI.getLastApplication();
        setLatestApp(res.data);
      } catch (err) {
        setLatestApp(null);
      }
      setLoading(false);
    }
    fetchLatestApplication();
  }, []);

  return (
    <>
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">User Dashboard</h1>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
            onClick={handleShare}
            disabled={isCopying}
          >
            {isCopying ? "Generating..." : "Share Dashboard"}
          </button>
        </div>
        {shareLink && (
          <div className="mb-4 p-2 bg-slate-700 text-white rounded">
            <span>Shareable Link: </span>
            <a
              href={shareLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-300"
            >
              {shareLink}
            </a>
            <span className="ml-2 text-green-400">(Copied!)</span>
          </div>
        )}

        <div className="mb-6">
          {loading ? (
            <div className="text-center text-slate-400">
              Loading your latest application...
            </div>
          ) : latestApp ? (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h2 className="text-lg font-semibold mb-2">Latest Application</h2>
              <div className="mb-2">
                <span className="font-semibold">Status:</span> {latestApp.status}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Eligibility Score:</span>{" "}
                {latestApp.eligibility_score ?? "N/A"}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Loan Amount:</span>{" "}
                {latestApp.loan_amount ?? "N/A"}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Income:</span> {latestApp.income ?? "N/A"}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Submitted:</span>{" "}
                {latestApp.submitted_at
                  ? new Date(latestApp.submitted_at).toLocaleString()
                  : "N/A"}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Document Status:</span>{" "}
                {latestApp.document_verified ? "Verified" : "Pending"}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                  onClick={() => (window.location.href = "/apply")}
                >
                  New Application
                </button>
                {latestApp.report_url && (
                  <a
                    href={latestApp.report_url}
                    className="bg-green-500 text-white px-3 py-1 rounded"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download Report
                  </a>
                )}
                <button
                  className="bg-slate-600 text-white px-3 py-1 rounded"
                  onClick={() => (window.location.href = "/contact")}
                >
                  Contact Support
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400">
              No applications found.{" "}
              <button
                className="underline text-blue-400"
                onClick={() => (window.location.href = "/apply")}
              >
                Start a new application
              </button>
            </div>
          )}
        </div>
      </AdminLayout>
    </>
  );
}

export default MainDashboard;

