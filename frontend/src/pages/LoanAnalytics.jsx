// src/pages/LoanAnalytics.jsx
import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { managerAPI } from "../utils/api";

function LoanAnalytics() {
  const [eligibilityData, setEligibilityData] = useState([]);
  const [loanRanges, setLoanRanges] = useState([]);
  const [stabilityData, setStabilityData] = useState([]);
  const [incomeApproval, setIncomeApproval] = useState([]);

  const COLORS = ["#34d399", "#ef4444"];

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await managerAPI.getLoanAnalytics(); // backend API
        setEligibilityData(res.data.eligibilityBreakdown || []);
        setLoanRanges(res.data.loanAmountDistribution || []);
        setStabilityData(res.data.employmentStability || []);
        setIncomeApproval(res.data.incomeVsApproval || []);
      } catch (err) {
        console.error("Error fetching analytics:", err);
      }
    }
    fetchAnalytics();
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-6">Loan Eligibility Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm font-semibold mb-3">Eligibility Breakdown</p>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={eligibilityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {eligibilityData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loan Amount Distribution */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm font-semibold mb-3">Loan Amount Distribution</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loanRanges}>
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Employment Stability */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm font-semibold mb-3">Employment Stability</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stabilityData}>
                <XAxis dataKey="years" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Line Chart */}
      <div className="mt-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <p className="text-sm font-semibold mb-3">Income Level vs Loan Approval %</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={incomeApproval}>
              <XAxis dataKey="income" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="approval" stroke="#facc15" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AdminLayout>
  );
}

export default LoanAnalytics;
