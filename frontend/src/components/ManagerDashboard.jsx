import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { managerAPI, reportAPI } from "../utils/api";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  DollarSign,
  Download,
  Eye,
  Search,
  BarChart3,
  Mail,
  Phone,
  CreditCard,
  Target,
} from "lucide-react";

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [filter, setFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const statsRes = await managerAPI.getStatistics();
      setStats(statsRes.data);

      const appRes = await managerAPI.getApplications(filter);
      setApplications(appRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [filter, loadData]);

  const handleDecision = async (applicationId, decision) => {
    try {
      if (decision === "approved") {
        await managerAPI.approveApplication(applicationId);
      } else if (decision === "rejected") {
        await managerAPI.rejectApplication(applicationId);
      }
      loadData();
      setSelectedApp(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to make decision");
    }
  };

  const openDetails = async (applicationId) => {
    try {
      setIsLoading(true);
      const res = await managerAPI.getApplicationDetails(applicationId);
      setSelectedApp(res.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to load application details"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async (applicationId) => {
    try {
      // Try to download; if not generated yet, generate first
      let response;
      try {
        response = await reportAPI.downloadReport(applicationId);
      } catch (e) {
        // If 404 or not generated, attempt generation
        try {
          await reportAPI.generateReport(applicationId);
          response = await reportAPI.downloadReport(applicationId);
        } catch (genErr) {
          throw genErr;
        }
      }

      const contentType =
        response.headers?.["content-type"] || "application/pdf";
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      if (contentType.includes("html")) {
        // Open HTML fallback in new tab
        window.open(url, "_blank");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `loan_report_${applicationId}${
            contentType.includes("pdf") ? ".pdf" : ""
          }`
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download report");
    }
  };

  const filteredApplications = applications.filter((app) => {
    const name = (app.full_name || "").toLowerCase();
    const email = (app.email || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  const statsCards = [
    {
      title: "Total Applications",
      value: stats?.total_applications || 0,
      icon: FileText,
      color: "text-primary-600",
      bgColor: "bg-primary-50",
      borderColor: "border-primary-200",
    },
    {
      title: "Pending Review",
      value: stats?.pending_applications || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
    },
    {
      title: "Approved",
      value: stats?.approved_applications || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      title: "Rejected",
      value: stats?.rejected_applications || 0,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
  ];

  const filterOptions = [
    {
      key: null,
      label: "All Applications",
      count: stats?.total_applications || 0,
    },
    {
      key: "pending",
      label: "Pending",
      count: stats?.pending_applications || 0,
    },
    {
      key: "approved",
      label: "Approved",
      count: stats?.approved_applications || 0,
    },
    {
      key: "rejected",
      label: "Rejected",
      count: stats?.rejected_applications || 0,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Manager Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage loan applications
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-primary-100 p-3 rounded-lg">
            <BarChart3 className="w-6 h-6 text-primary-600" />
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index }}
              className={`card border-2 ${stat.borderColor} ${stat.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg ${stat.bgColor} border ${stat.borderColor}`}
                >
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3"
          >
            <XCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <motion.button
                key={option.key || "all"}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setFilter(option.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                  filter === option.key
                    ? "bg-primary-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>{option.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    filter === option.key ? "bg-white/20" : "bg-gray-200"
                  }`}
                >
                  {option.count}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Applications Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Applications</h2>
          <p className="text-gray-600 text-sm mt-1">
            {filteredApplications.length} application
            {filteredApplications.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-600">Loading applications...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Applicant
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Loan Amount
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Eligibility
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredApplications.map((app, index) => (
                  <motion.tr
                    key={app.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {app.full_name}
                        </p>
                        <p className="text-sm text-gray-500">{app.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">
                          {app.loan_amount == null
                            ? "N/A"
                            : app.loan_amount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Target className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">
                            {app.eligibility_score == null
                              ? "N/A"
                              : `${Math.round(app.eligibility_score * 100)}%`}
                          </span>
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <motion.div
                            className="bg-primary-600 h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  Math.round((app.eligibility_score || 0) * 100)
                                )
                              )}%`,
                            }}
                            transition={{
                              delay: 0.5 + index * 0.1,
                              duration: 0.8,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                          app.approval_status === "approved"
                            ? "bg-green-100 text-green-800"
                            : app.approval_status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {app.approval_status?.charAt(0).toUpperCase() +
                          app.approval_status?.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openDetails(app.id)}
                        className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredApplications.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No applications found</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Application Detail Modal */}
      <AnimatePresence>
        {selectedApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-primary-600 to-secondary-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {selectedApp.full_name}
                      </h2>
                      <p className="text-primary-100 text-sm">
                        Application Review
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Application Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Email
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {selectedApp.email || "N/A"}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Phone
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {selectedApp.phone || "N/A"}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Annual Income
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {selectedApp.annual_income == null
                        ? "N/A"
                        : `$${Number(
                            selectedApp.annual_income
                          ).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Credit Score
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {selectedApp.credit_score == null
                        ? "N/A"
                        : selectedApp.credit_score}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Loan Amount
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {selectedApp.loan_amount == null
                        ? "N/A"
                        : `$${Number(
                            selectedApp.loan_amount
                          ).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Eligibility Score
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {(selectedApp.eligibility_score * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Eligibility Progress */}
                <div className="bg-gradient-to-r from-primary-50 to-secondary-50 p-6 rounded-xl mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Eligibility Assessment
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">
                        Score
                      </span>
                      <span className="text-sm font-bold text-primary-600">
                        {selectedApp.eligibility_score == null
                          ? "N/A"
                          : `${Math.round(
                              selectedApp.eligibility_score * 100
                            )}%`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <motion.div
                        className="bg-gradient-to-r from-primary-600 to-secondary-600 h-3 rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              Math.round(
                                (selectedApp.eligibility_score || 0) * 100
                              )
                            )
                          )}%`,
                        }}
                        transition={{ duration: 1, delay: 0.2 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-3">
                  {selectedApp.approval_status === "pending" && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          handleDecision(selectedApp.id, "approved")
                        }
                        className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        <span>Approve Application</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          handleDecision(selectedApp.id, "rejected")
                        }
                        className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <XCircle className="w-5 h-5" />
                        <span>Reject Application</span>
                      </motion.button>
                    </>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDownloadReport(selectedApp.id)}
                    className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Report</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
