// src/pages/MainDashboard.jsx
import React from "react";
import AdminLayout from "../components/AdminLayout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

function MainDashboard() {
  // KPI Data
  const kpis = [
    { title: "Total Applications", value: 428 },
    { title: "Eligible Applications", value: 276 },
    { title: "Voice Calls Handled", value: 612 },
    { title: "Average Credit Score", value: 731 },
  ];

  // Line Chart – Income vs Eligibility
  const incomeVsEligibility = [
    { income: "20K", score: 0.42 },
    { income: "40K", score: 0.58 },
    { income: "60K", score: 0.71 },
    { income: "80K", score: 0.81 },
    { income: "100K", score: 0.88 },
  ];

  // Bar Chart – Loan Amount Ranges
  const loanRanges = [
    { range: "< 2L", count: 95 },
    { range: "2–5L", count: 162 },
    { range: "5–10L", count: 112 },
    { range: "> 10L", count: 59 },
  ];

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-6">Executive Summary</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {kpis.map((item, index) => (
          <div
            key={index}
            className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow"
          >
            <p className="text-sm text-slate-400">{item.title}</p>
            <p className="text-3xl font-bold mt-2 text-white">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Income vs Eligibility Chart */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm mb-2 font-semibold">
            Income vs Eligibility Score
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={incomeVsEligibility}>
                <XAxis dataKey="income" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#38bdf8" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loan Amount Distribution */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm mb-2 font-semibold">
            Loan Applications by Amount Range
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loanRanges}>
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

export default MainDashboard;
