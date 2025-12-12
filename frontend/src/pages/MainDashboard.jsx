// src/pages/MainDashboard.jsx
import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { managerAPI } from "../utils/api";
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
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await managerAPI.getStatistics();
        setStats(res.data);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading dashboard data...</div>
        </div>
      </AdminLayout>
    );
  }

  const incomeVsEligibility = [
    { income: "20k", score: 0.4 },
    { income: "40k", score: 0.6 },
    { income: "60k", score: 0.8 },
    { income: "80k", score: 0.9 },
  ];

  // KPI Data
  const kpis = [
    { title: "Total Applications", value: stats?.total_applications || 0 },
    {
      title: "Approved Applications",
      value: stats?.approved_applications || 0,
    },
    { title: "Voice Calls Handled", value: stats?.voice_calls_count || 0 },
    { title: "Average Credit Score", value: stats?.avg_credit_score || 0 },
  ];

  // Bar Chart – Loan Amount Ranges (dynamic if API provides)
  const loanRanges = stats?.loan_amount_distribution || [
    { range: "< 2L", count: 0 },
    { range: "2–5L", count: 0 },
    { range: "5–10L", count: 0 },
    { range: "> 10L", count: 0 },
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
