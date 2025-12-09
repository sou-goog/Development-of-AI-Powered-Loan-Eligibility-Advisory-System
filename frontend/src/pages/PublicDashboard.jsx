import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "../utils/api";

// Simple color palette for models
const modelColors = [
  "bg-gradient-to-r from-purple-500 to-pink-500",
  "bg-gradient-to-r from-blue-500 to-cyan-500",
  "bg-gradient-to-r from-green-500 to-lime-500",
  "bg-gradient-to-r from-yellow-500 to-orange-500",
  "bg-gradient-to-r from-red-500 to-pink-500",
];

function PublicDashboard() {
  const { token } = useParams();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await axios.get(`/loan/public-dashboard/${token}`);
        setDashboard(res.data);
      } catch (err) {
        setError("Dashboard not found or link expired.");
      }
    }
    fetchDashboard();
  }, [token]);

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!dashboard) return <div className="p-8 text-center">Loading dashboard...</div>;

  // Helper to get color for model
  const getModelColor = idx => modelColors[idx % modelColors.length];

  // Render confusion matrix as colored grid
  const renderConfusionMatrix = matrix => (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {matrix?.map((row, i) =>
        row.map((cell, j) => (
          <div
            key={i + '-' + j}
            className={`flex items-center justify-center h-12 w-12 rounded-lg font-bold text-white ${cell > 0 ? 'bg-green-500' : 'bg-slate-700'}`}
          >
            {cell}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Shared Dashboard (Read-only)</h1>
      {/* Stats Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {dashboard.stats && Object.entries(dashboard.stats).map(([key, value]) => (
            <div key={key} className="bg-slate-800 p-4 rounded text-white text-center">
              <div className="text-xs text-slate-400 mb-1">{key.replace(/_/g, ' ')}</div>
              <div className="text-xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Applications Table */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Recent Applications</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-slate-800 rounded text-white">
            <thead>
              <tr>
                <th className="px-2 py-1">ID</th>
                <th className="px-2 py-1">Created</th>
                <th className="px-2 py-1">Eligibility</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Loan Amount</th>
                <th className="px-2 py-1">Income</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.applications && dashboard.applications.map(app => (
                <tr key={app.id} className="border-t border-slate-700">
                  <td className="px-2 py-1 text-center">{app.id}</td>
                  <td className="px-2 py-1 text-center">{new Date(app.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-1 text-center">{app.eligibility_score?.toFixed(2)}</td>
                  <td className="px-2 py-1 text-center">{app.approval_status}</td>
                  <td className="px-2 py-1 text-center">₹{app.loan_amount_requested?.toLocaleString()}</td>
                  <td className="px-2 py-1 text-center">₹{app.monthly_income?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ML Model Performance Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">ML Model Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dashboard.ml_metrics && Object.entries(dashboard.ml_metrics).map(([model, metrics], idx) => (
            <button
              key={model}
              className={`transition-all duration-200 shadow-lg p-4 rounded-lg border-2 border-transparent hover:border-yellow-400 cursor-pointer focus:outline-none ${getModelColor(idx)} ${selectedModel === model ? 'ring-4 ring-yellow-300' : ''}`}
              onClick={() => setSelectedModel(model)}
            >
              <h3 className="text-lg font-bold mb-2 text-white drop-shadow">{model.replace(/_/g, ' ').toUpperCase()}</h3>
              <div className="mb-2 text-sm text-white">
                <span className="font-semibold">Accuracy:</span> <span className="text-yellow-200 font-bold">{metrics.accuracy}</span>
                <br />
                <span className="font-semibold">F1 Score:</span> <span className="text-green-200 font-bold">{metrics.f1}</span>
                <br />
                <span className="font-semibold">Prediction:</span> <span className="text-pink-200 font-bold">{metrics.prediction !== null ? metrics.prediction : 'N/A'}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Model Details */}
        {selectedModel && (
          <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl border-2 border-yellow-400">
            <h3 className="text-xl font-bold mb-4 text-yellow-300">{selectedModel.replace(/_/g, ' ').toUpperCase()} KPIs</h3>
            <div className="mb-4 text-lg">
              <span className="font-semibold">Accuracy:</span> <span className="text-yellow-200 font-bold">{dashboard.ml_metrics[selectedModel].accuracy}</span>
              <br />
              <span className="font-semibold">F1 Score:</span> <span className="text-green-200 font-bold">{dashboard.ml_metrics[selectedModel].f1}</span>
              <br />
              <span className="font-semibold">Prediction:</span> <span className="text-pink-200 font-bold">{dashboard.ml_metrics[selectedModel].prediction !== null ? dashboard.ml_metrics[selectedModel].prediction : 'N/A'}</span>
            </div>
            <div>
              <span className="font-semibold text-blue-300">Confusion Matrix:</span>
              {renderConfusionMatrix(dashboard.ml_metrics[selectedModel].confusion_matrix)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default PublicDashboard;
