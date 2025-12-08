import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "../utils/auth";

export default function UserNotifications({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(`ws://localhost:8000/ws/user/${userId}/notifications?token=${token}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setNotifications((prev) => [{ ...data, read: false }, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };
    return () => ws.close();
  }, [userId]);

  // TEST: Inject a test notification on mount for demo purposes
  useEffect(() => {
    if (!userId) return;
    setTimeout(() => {
      setNotifications((prev) => [
        {
          type: "application_rejected",
          application_id: 123,
          message: "Your loan application has been rejected.",
          reason: "Insufficient credit score.",
          action: "view_rejection_details",
          read: false
        },
        {
          type: "application_accepted",
          application_id: 456,
          message: "Your loan application has been accepted!",
          read: false
        },
        ...prev
      ]);
      setUnreadCount((prev) => prev + 2);
    }, 1000);
  }, [userId]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  useEffect(() => {
    if (!panelOpen) return;
    const handleClick = (e) => {
      // If click is outside the notification button or panel, close it
      if (!e.target.closest('.user-notif-btn') && !e.target.closest('.user-notif-panel')) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [panelOpen]);

  return (
    <div style={{ position: "relative" }}>
      <button className="user-notif-btn" onClick={() => { setPanelOpen((open) => !open); markAllRead(); }} style={{ background: "none", border: "none", cursor: "pointer", position: "relative" }}>
        <Bell color="#2563eb" />
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: -6, right: -6, background: "#2563eb", color: "#fff", borderRadius: "50%", padding: "2px 7px", fontSize: "13px", fontWeight: "bold", boxShadow: "0 0 4px #2563eb55" }}>
            {unreadCount}
          </span>
        )}
      </button>
      {panelOpen && (
        <div className="user-notif-panel" style={{ position: "absolute", right: 0, top: "2.5em", background: "#fff", border: "1px solid #2563eb", borderRadius: "8px", minWidth: "250px", zIndex: 100, boxShadow: "0 2px 12px #2563eb22" }}>
          <div style={{ padding: "8px", borderBottom: "1px solid #eee", fontWeight: "bold", color: "#2563eb", background: "#f0f6ff" }}>Notifications</div>
          {notifications.length === 0 ? (
            <div style={{ padding: "8px", color: "#333" }}>No notifications</div>
          ) : (
            notifications.slice(0, 5).map((notif, idx) => (
              <div key={idx} style={{ padding: "8px", borderBottom: "1px solid #eee", background: notif.read ? "#f9f9f9" : "#e6f7ff", color: "#222" }}>
                <span style={{ color: notif.type === "application_rejected" ? "#dc2626" : "#2563eb", fontWeight: "500" }}>{notif.message || notif.type}</span>
                {notif.application_id && (
                  <div style={{ fontSize: "12px", color: "#555" }}>Application ID: {notif.application_id}</div>
                )}
                {notif.type === "application_rejected" && notif.reason && (
                  <button
                    style={{ marginTop: "6px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 10px", cursor: "pointer", fontSize: "12px" }}
                    onClick={() => navigate(`/loan-rejection/${userId}`)}
                  >
                    See why loan got rejected
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
