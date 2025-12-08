import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "../utils/api";

function PublicDashboard() {
  const { token } = useParams();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

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

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Shared Dashboard (Read-only)</h1>
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Stats</h2>
        <pre className="bg-slate-800 p-4 rounded text-white overflow-x-auto">
          {JSON.stringify(dashboard.stats, null, 2)}
        </pre>
      </section>
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Applications</h2>
        <pre className="bg-slate-800 p-4 rounded text-white overflow-x-auto">
          {JSON.stringify(dashboard.applications, null, 2)}
        </pre>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">ML Model Performance</h2>
        <pre className="bg-slate-800 p-4 rounded text-white overflow-x-auto">
          {JSON.stringify(dashboard.ml_metrics, null, 2)}
        </pre>
      </section>
    </div>
  );
}

export default PublicDashboard;
