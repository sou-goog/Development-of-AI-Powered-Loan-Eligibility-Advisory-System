// src/pages/MLPerformance.jsx

import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { managerAPI } from "../utils/api";

const MODEL_TABS = [
  { key: "xgboost", label: "XGBoost" },
  { key: "decision_tree", label: "Decision Tree" },
  { key: "random_forest", label: "Random Forest" },
];

function MLPerformance() {
  const [metrics, setMetrics] = useState({});
  const [activeTab, setActiveTab] = useState("xgboost");

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await managerAPI.getModelMetrics();
        setMetrics(res.data || {});
      } catch (err) {
        console.error("Error fetching ML metrics:", err);
      }
    }
    fetchMetrics();
  }, []);

  const COLORS = ["#34d399", "#ef4444", "#3b82f6", "#f59e42"];
  const model = metrics[activeTab] || {};

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-6">ML Model Performance</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {MODEL_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors border-b-2 ${
              activeTab === tab.key
                ? "bg-slate-800 text-blue-400 border-blue-400"
                : "bg-slate-700 text-white border-transparent hover:bg-slate-600"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
          <p className="text-sm font-semibold mb-1">Accuracy</p>
          <p className="text-2xl font-bold">
            {(model.accuracy * 100).toFixed(2)}%
          </p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
          <p className="text-sm font-semibold mb-1">Precision</p>
          <p className="text-2xl font-bold">
            {(model.precision * 100).toFixed(2)}%
          </p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
          <p className="text-sm font-semibold mb-1">Recall</p>
          <p className="text-2xl font-bold">
            {(model.recall * 100).toFixed(2)}%
          </p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
          <p className="text-sm font-semibold mb-1">F1 Score</p>
          <p className="text-2xl font-bold">{(model.f1 * 100).toFixed(2)}%</p>
        </div>
      </div>

      {/* Confusion Matrix */}
      <div className="mt-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <p className="text-sm font-semibold mb-3">Confusion Matrix</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={model.confusionMatrix || []}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" />
              <YAxis type="category" dataKey="label" />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6">
                {(model.confusionMatrix || []).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
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
