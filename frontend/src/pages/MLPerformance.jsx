// src/pages/MLPerformance.jsx
import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { managerAPI } from "../utils/api";

function MLPerformance() {
  const [metrics, setMetrics] = useState({
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1: 0,
    confusionMatrix: [],
  });

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await managerAPI.getModelMetrics(); // Backend API call
        setMetrics(res.data || {});
      } catch (err) {
        console.error("Error fetching ML metrics:", err);
      }
    }
    fetchMetrics();
  }, []);

  const COLORS = ["#34d399", "#ef4444"];

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-6">ML Model Performance</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
          <p className="text-sm font-semibold mb-1">Accuracy</p>
          <p className="text-2xl font-bold">{(metrics.accuracy * 100).toFixed(2)}%</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
          <p className="text-sm font-semibold mb-1">Precision</p>
          <p className="text-2xl font-bold">{(metrics.precision * 100).toFixed(2)}%</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
          <p className="text-sm font-semibold mb-1">Recall</p>
          <p className="text-2xl font-bold">{(metrics.recall * 100).toFixed(2)}%</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
          <p className="text-sm font-semibold mb-1">F1 Score</p>
          <p className="text-2xl font-bold">{(metrics.f1 * 100).toFixed(2)}%</p>
        </div>
      </div>

      <div className="mt-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <p className="text-sm font-semibold mb-3">Confusion Matrix</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={metrics.confusionMatrix || []}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" />
              <YAxis type="category" dataKey="label" />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6">
                {(metrics.confusionMatrix || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AdminLayout>
  );
}

export default MLPerformance;
