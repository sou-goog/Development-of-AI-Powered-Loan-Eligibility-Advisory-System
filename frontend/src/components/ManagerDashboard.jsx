import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  DollarSign,
  Target,
  FileText,
  XCircle,
  BarChart3,
  Search,
  CheckCircle,
  Phone,
  Mail,
} from "lucide-react";
import MiniChatbot from "./MiniChatbot";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ManagerDashboard - Material-inspired redesign
 *
 * Replace the placeholder fetch/post functions with your real API calls.
 */

export default function ManagerDashboard() {
  // ---- state ----
  const [applications, setApplications] = useState([]); // raw
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState(null); // null | 'pending' | 'approved' | 'rejected'
  const [stats, setStats] = useState(null);

  // ---- lifecycle: load data ----
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [apps, statData] = await Promise.all([loadApplications(), loadStats()]);
        setApplications(apps);
        setStats(statData);
      } catch (err) {
        console.error(err);
        setError("Failed to load manager data: " + (err && err.message ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- derived data ----
  const filteredApplications = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    return applications
      .filter((a) => {
        if (filter && a.approval_status !== filter) return false;
        if (!term) return true;
        return (
          String(a.full_name || "").toLowerCase().includes(term) ||
          String(a.email || "").toLowerCase().includes(term) ||
          String(a.id || "").toLowerCase().includes(term)
        );
      })
      .sort((x, y) => {
        // keep newest first if create_at exists, else by id
        const dx = x.created_at ? new Date(x.created_at).getTime() : 0;
        const dy = y.created_at ? new Date(y.created_at).getTime() : 0;
        return dy - dx;
      });
  }, [applications, searchTerm, filter]);

  const statsCards = useMemo(() => {
    return [
      {
        title: "Total",
        value: stats?.total_applications ?? 0,
        icon: BarChart3,
        color: "text-primary-600",
        bgColor: "bg-primary-50",
        borderColor: "border-primary-100",
      },
      {
        title: "Approved",
        value: stats?.approved_applications ?? 0,
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-100",
      },
      {
        title: "Rejected",
        value: stats?.rejected_applications ?? 0,
        icon: XCircle,
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-100",
      },
      {
        title: "Pending",
        value: stats?.pending_applications ?? 0,
        icon: FileText,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-100",
      },
    ];
  }, [stats]);

  const filterOptions = [
    { key: null, label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  // ---- handlers ----
  // Removed openDetails and setSelectedApp (no longer used)

  const handleDecision = useCallback(
    async (id, decision) => {
      // optimistic UI update
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, approval_status: decision } : a))
      );

      try {
        await postDecision(id, decision); // replace with your API
        // refresh stats (optionally refresh apps)
        const latestStats = await loadStats();
        setStats(latestStats);
      } catch (err) {
        console.error(err);
        setError("Failed to update decision. Reverting change.");
        // revert on failure
        setApplications((prev) =>
          prev.map((a) => (a.id === id ? { ...a, approval_status: "pending" } : a))
        );
      }
    },
    []
  );

  const [reportApp, setReportApp] = useState(null);
  const handleViewReport = useCallback((id) => {
    const app = applications.find(a => a.id === id);
    if (app) setReportApp(app);
  }, [applications]);

  // ---- small helpers ----
  const niceCurrency = (val) => {
    if (val == null) return "N/A";
    const number = Number(val);
    if (Number.isNaN(number)) return "N/A";
    return number.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // ---- render ----
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6 relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Manager Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor and manage loan applications — material-inspired, cleaner layout.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-primary-50 to-white shadow-sm">
            <BarChart3 className="w-6 h-6 text-primary-600" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex items-center justify-between p-4 rounded-lg border ${s.borderColor} ${s.bgColor}`}
            >
              <div>
                <p className="text-sm text-gray-500">{s.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${s.bgColor}`}>
                <Icon className={`w-6 h-6 ${s.color}`} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Controls: Search + Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="w-full max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="w-full pl-11 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-200 outline-none"
            placeholder="Search by name, email or id..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={String(opt.key)}
              onClick={() => setFilter(opt.key)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                filter === opt.key
                  ? "bg-primary-600 text-white shadow"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <div className="ml-2 text-sm text-gray-500">
            {filteredApplications.length} result{filteredApplications.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-md p-3 bg-red-50 border border-red-100 text-red-700"
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>{error}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Applicant</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Loan</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Documents</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Eligibility</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading applications...
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="mx-auto mb-2 w-8 h-8 text-gray-400" />
                    No applications found
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app, idx) => (
                  <motion.tr
                    key={app.id || idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * idx }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{app.full_name || "—"}</div>
                          <div className="text-xs text-gray-500">{app.email || "—"}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <div className="font-medium text-blue-600">${niceCurrency(app.loan_amount)}</div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(app.uploaded_documents) && app.uploaded_documents.length > 0 ? (
                          app.uploaded_documents.map((doc, i) => (
                            <span key={doc.id || i} className="inline-block px-2 py-1 rounded bg-gray-100 text-xs font-semibold text-gray-700 border border-gray-200">
                              {doc.id ? doc.id.replace(/_/g, ' ').toUpperCase() : 'DOC'}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">No docs</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-gray-400" />
                          <div className="text-sm font-bold text-green-600">
                            {app.eligibility_score == null ? "N/A" : `${Math.round((app.eligibility_score || 0) * 100)}%`}
                          </div>
                        </div>
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <motion.div
                            className="h-2 rounded-full bg-gradient-to-r from-primary-600 to-secondary-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(0, Math.min(100, Math.round((app.eligibility_score || 0) * 100)))}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={app.approval_status} />
                    </td>

                    <td className="px-6 py-4 text-right text-sm">
                      <div className="inline-flex items-center gap-2">
                        {/* Removed openDetails reference. If you want to show details, use handleViewReport or another handler. */}

                        {app.approval_status === "pending" && (
                          <>
                            <button
                              onClick={() => handleDecision(app.id, "approved")}
                              className="px-3 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecision(app.id, "rejected")}
                              className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleViewReport(app.id)}
                          className="px-3 py-1.5 rounded-md bg-primary-600 text-white text-sm hover:bg-primary-700"
                        >
                          <FileText className="w-4 h-4 inline-block mr-1" />
                          View Report
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {reportApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{reportApp.full_name}</h3>
                  <p className="text-sm opacity-90">Applicant Report & Details</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setReportApp(null)}
                    className="p-2 rounded-full hover:bg-white/10"
                    aria-label="Close"
                  >
                    <XCircle className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ContactField icon={Mail} label="Email" value={reportApp.email} />
                  <ContactField icon={Phone} label="Phone" value={reportApp.phone} />
                  <ContactField icon={Users} label="Full Name" value={reportApp.full_name} />
                  <ContactField icon={DollarSign} label="Loan Amount" value={niceCurrency(reportApp.loan_amount_requested)} />
                  <ContactField icon={Target} label="Eligibility Score" value={reportApp.eligibility_score != null ? `${Math.round((reportApp.eligibility_score || 0) * 100)}%` : "N/A"} />
                  <ContactField icon={BarChart3} label="Credit Score" value={reportApp.credit_score} />
                  <ContactField icon={FileText} label="Application Status" value={reportApp.approval_status} />
                </div>
                <div className="mt-4">
                  <h4 className="text-md font-semibold mb-2 text-fuchsia-700">Uploaded Documents</h4>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {Array.isArray(reportApp.uploaded_documents) && reportApp.uploaded_documents.length > 0 ? (
                      reportApp.uploaded_documents.map((doc, i) => (
                        <span key={doc.id || i} className="inline-block px-2 py-1 rounded bg-gray-100 text-xs font-semibold text-gray-700 border border-gray-200">
                          {doc.id ? doc.id.replace(/_/g, ' ').toUpperCase() : 'DOC'}
                          {doc.file_path && (
                            <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 underline">View</a>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">No documents uploaded</span>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-md font-semibold mb-2 text-fuchsia-700">Form Data</h4>
                  <pre className="bg-gray-50 rounded p-3 text-xs font-semibold overflow-x-auto border border-gray-100 text-fuchsia-700">
                    {JSON.stringify(reportApp, null, 2)}
                  </pre>
                </div>
                {reportApp.report_path && (
                  <div className="mt-4">
                    <h4 className="text-md font-semibold mb-2">Generated Report</h4>
                    <iframe src={reportApp.report_path} title="Applicant Report" className="w-full h-96 rounded border" />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* MiniChatbot fixed in bottom-right */}
      <div className="fixed bottom-6 right-6 z-50">
        <MiniChatbot />
      </div>
    </div>
  );
}

/* ---------------------------
   Small helper components
   --------------------------- */

function StatusBadge({ status }) {
  const statusMap = {
    approved: { className: "bg-green-100 text-green-800", text: "Approved" },
    rejected: { className: "bg-red-100 text-red-800", text: "Rejected" },
    pending: { className: "bg-yellow-100 text-yellow-800", text: "Pending" },
    null: { className: "bg-gray-100 text-gray-700", text: "Unknown" },
    undefined: { className: "bg-gray-100 text-gray-700", text: "Unknown" },
  };
  const s = statusMap[status] || statusMap.null;
  return <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${s.className}`}>{s.text}</span>;
}

function ContactField({ icon: Icon, label, value }) {
  return (
    <div className="bg-white p-3 rounded-lg border border-gray-100">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Icon className="w-4 h-4 text-gray-400" />
        <div>{label}</div>
      </div>
      <div className="text-sm font-medium text-gray-900">{value ?? "N/A"}</div>
    </div>
  );
}

/* ---------------------------
   Placeholder network functions
   Replace with real API implementations
   --------------------------- */

async function loadApplications() {
  const res = await fetch("/api/manager/applications");
  if (!res.ok) throw new Error("Failed to fetch applications");
  const data = await res.json();
  // If data is an array, return as is; if it's an object, return data.applications
  return Array.isArray(data) ? data : (data.applications || []);
}

async function loadStats() {
  // TODO: replace with real API call
    // await sleep(80); // Removed unused sleep function
  return {
    total_applications: 2,
    approved_applications: 1,
    rejected_applications: 0,
    pending_applications: 1,
  };
}

async function postDecision(id, decision) {
  // Replace with POST/PUT request to set decision
    // await sleep(150); // Removed unused sleep function
  // Example: return await fetch(`/api/applications/${id}/decision`, {...})
  return { ok: true };
}

