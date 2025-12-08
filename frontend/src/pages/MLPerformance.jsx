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
// ...existing code...

function MLPerformance() {
  const [metrics, setMetrics] = useState({
    xgboost: { accuracy: 0, precision: 0, recall: 0, f1: 0, confusionMatrix: [] },
    decision_tree: { accuracy: 0, precision: 0, recall: 0, f1: 0, confusionMatrix: [] },
    random_forest: { accuracy: 0, precision: 0, recall: 0, f1: 0, confusionMatrix: [] },
  });

  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Simulate API response for all three models
        setMetrics({
          xgboost: { accuracy: 0.92, precision: 0.91, recall: 0.90, f1: 0.905, confusionMatrix: [
            { label: "True Positive", value: 120 },
            { label: "True Negative", value: 80 },
            { label: "False Positive", value: 10 },
            { label: "False Negative", value: 15 },
          ] },
          decision_tree: { accuracy: 0.85, precision: 0.83, recall: 0.82, f1: 0.825, confusionMatrix: [
            { label: "True Positive", value: 110 },
            { label: "True Negative", value: 70 },
            { label: "False Positive", value: 20 },
            { label: "False Negative", value: 25 },
          ] },
          random_forest: { accuracy: 0.89, precision: 0.88, recall: 0.87, f1: 0.875, confusionMatrix: [
            { label: "True Positive", value: 115 },
            { label: "True Negative", value: 75 },
            { label: "False Positive", value: 15 },
            { label: "False Negative", value: 20 },
          ] },
        });
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {Object.entries(metrics).map(([model, m]) => (
          <div key={model} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h2 className="text-lg font-bold mb-2 capitalize">{model.replace('_', ' ')}</h2>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="text-sm font-semibold">Accuracy</p>
                <p className="text-xl font-bold">{(m.accuracy * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Precision</p>
                <p className="text-xl font-bold">{(m.precision * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Recall</p>
                <p className="text-xl font-bold">{(m.recall * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm font-semibold">F1 Score</p>
                <p className="text-xl font-bold">{(m.f1 * 100).toFixed(2)}%</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold mb-2">Confusion Matrix</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={m.confusionMatrix || []}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="label" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6">
                      {(m.confusionMatrix || []).map((entry, index) => (
                        <Cell
                          key={`cell-${model}-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default MLPerformance;
