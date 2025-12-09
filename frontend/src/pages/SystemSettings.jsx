import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import api from "../utils/api";

function SystemSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/loan/model-info");
        setSettings(res.data || {}); // prevent null
      } catch (error) {
        console.log("Error fetching settings:", error);
        setSettings({}); // fallback object
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-slate-400">Loading system settings...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-6">System Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Model Info Card */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">Model Version</p>
          <p className="text-lg font-semibold text-white mt-1">
            {settings?.modelVersion || "Not available"}
          </p>

          <p className="text-sm text-slate-400 mt-4">Last Updated</p>
          <p className="text-lg font-semibold text-white mt-1">
            {settings?.lastUpdated || "Not available"}
          </p>
        </div>

        {/* API Health Card */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">Backend Status</p>
          <p
            className="text-lg font-semibold mt-1"
            style={{ color: settings?.backendStatus === "OK" ? "#34d399" : "#ef4444" }}
          >
            {settings?.backendStatus || "Unknown"}
          </p>

          <p className="text-sm text-slate-400 mt-4">API URL</p>
          <p className="text-xs text-slate-400 break-all">
            {process.env.REACT_APP_API_URL || "http://localhost:8000/api"}
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}

export default SystemSettings;
