// src/pages/MLPerformance.jsx
import React from "react";
import AdminLayout from "../components/AdminLayout";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

function MLPerformance() {
  // Feature importance data
  const featureImportance = [
    { feature: "Credit Score", value: 42 },
    { feature: "Monthly Income", value: 28 },
    { feature: "Loan Amount", value: 15 },
    { feature: "Loan Tenure", value: 10 },
    { feature: "Existing EMIs", value: 5 },
  ];

  // Prediction confidence data
  const confidenceData = [
    { label: "0.1", value: 10 },
    { label: "0.3", value: 28 },
    { label: "0.5", value: 56 },
    { label: "0.7", value: 110 },
    { label: "0.9", value: 168 },
  ];

  // Outlier predictions
  const outliers = [
    {
      id: 1,
      income: 90000,
      credit: 810,
      loan: 12000,
      result: "Rejected",
    },
    {
      id: 2,
      income: 18000,
      credit: 520,
      loan: 200000,
      result: "Approved",
    },
  ];

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-6">ML Model Performance</h1>

      {/* Accuracy Section */}
      <div className="bg-slate-800 p-5 rounded-xl mb-6 border border-slate-700">
        <p className="text-sm font-semibold text-slate-300">
          Model Accuracy
        </p>
        <p className="text-4xl font-bold text-green-400 mt-2">92.4%</p>
        <p className="text-xs text-slate-400 mt-1">
          Evaluated on 500 validation samples
        </p>
      </div>

      {/* Feature Importance + Confidence Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Feature Importance Chart */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm mb-2 font-semibold">
            Feature Importance
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportance}>
                <XAxis dataKey="feature" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Confidence Distribution */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm mb-2 font-semibold">
            Prediction Confidence Distribution
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={confidenceData}>
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#60a5fa"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Outlier Cases Table */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
        <p className="text-sm mb-3 font-semibold">
          Unusual / Outlier Prediction Cases
        </p>

        <table className="w-full text-sm text-left text-slate-300">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2">ID</th>
              <th className="py-2">Income</th>
              <th className="py-2">Credit Score</th>
              <th className="py-2">Loan Amount</th>
              <th className="py-2">Model Result</th>
            </tr>
          </thead>
          <tbody>
            {outliers.map((o) => (
              <tr key={o.id} className="border-b border-slate-700">
                <td className="py-2">{o.id}</td>
                <td>{o.income}</td>
                <td>{o.credit}</td>
                <td>{o.loan}</td>
                <td className="text-red-400">{o.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </AdminLayout>
  );
}

export default MLPerformance;
