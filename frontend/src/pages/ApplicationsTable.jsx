// src/pages/ApplicationsTable.jsx
import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { managerAPI } from "../utils/api";

function ApplicationsTable() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      try {
        const res = await managerAPI.getApplications(); // backend API call
        setApplications(res.data.items || []);
      } catch (err) {
        console.error("Error fetching applications:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchApplications();
  }, []);

  if (loading)
    return (
      <AdminLayout>
        <p className="text-slate-300">Loading applications...</p>
      </AdminLayout>
    );

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-6">Loan Applications</h1>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="py-3 px-2">ID</th>
              <th className="py-3 px-2">Name</th>
              <th className="py-3 px-2">Income</th>
              <th className="py-3 px-2">Loan Amount</th>
              <th className="py-3 px-2">Eligibility Probability</th>
              <th className="py-3 px-2">Result</th>
              <th className="py-3 px-2">Mode</th>
              <th className="py-3 px-2">Date</th>
              <th className="py-3 px-2">Confidence</th>
            </tr>
          </thead>

          <tbody>
            {applications.map((app) => (
              <tr
                key={app.id}
                className="border-b border-slate-700 hover:bg-slate-700/40 transition"
              >
                <td className="py-3 px-2">{app.id}</td>
                <td className="py-3 px-2">{app.name}</td>
                <td className="py-3 px-2">₹{app.income?.toLocaleString()}</td>
                <td className="py-3 px-2">₹{app.loan?.toLocaleString()}</td>
                <td className="py-3 px-2">
                  {(app.probability * 100).toFixed(1)}%
                </td>
                <td
                  className="py-3 px-2 font-semibold"
                  style={{
                    color: app.result === "Eligible" ? "#34d399" : "#ef4444",
                  }}
                >
                  {app.result}
                </td>
                <td className="py-3 px-2">{app.mode}</td>
                <td className="py-3 px-2">{app.date}</td>
                <td className="py-3 px-2">{app.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

export default ApplicationsTable;
