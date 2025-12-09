import React, { useEffect, useState, useRef } from "react";

const WS_URL =
  process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws/manager/notifications";

function ManagerNotifications({ onNotificationClick, onNotificationDismiss, setNotifCount, setUnreadCount }) {
  const [notifications, setNotifications] = useState([
    {
      type: "new_application",
      full_name: "Test Applicant",
      email: "test@example.com",
      loan_amount: 12345,
      application_id: "test_app_1",
      created_at: new Date().toISOString(),
      read: false,
    },
  ]);
  const [showAll, setShowAll] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_application") {
          setNotifications((prev) => {
            const updated = [
              { ...data, read: false },
              ...prev
            ];
            setNotifCount && setNotifCount(updated.length);
            setUnreadCount && setUnreadCount(updated.filter(n => !n.read).length);
            return updated;
          });
        }
      } catch (err) {}
    };
    wsRef.current.onerror = () => {};
    wsRef.current.onclose = () => {};
    return () => {
      wsRef.current && wsRef.current.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNotifCount]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setNotifCount && setNotifCount(notifications.length);
    setUnreadCount && setUnreadCount(notifications.filter(n => !n.read).length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, setNotifCount]);

  return (
    <div className="fixed top-16 right-4 z-50 w-96">
      {(showAll ? notifications : notifications.slice(0, 5)).map((n, idx) => (
        <div
          key={idx}
          className={`bg-blue-900 text-white border border-blue-700 rounded-lg shadow-lg p-4 mb-3 animate-fade-in cursor-pointer relative ${n.read ? 'opacity-60' : ''}`}
          onClick={() => {
            if (!n.read) {
              setNotifications(prev => prev.map((notif, i) => i === idx ? { ...notif, read: true } : notif));
              setUnreadCount && setUnreadCount(notifications.filter((notif, i) => i !== idx && !notif.read).length);
            }
            onNotificationClick && onNotificationClick(n);
          }}
        >
          <div className="font-bold text-lg mb-1">New Loan Application</div>
          <div className="text-sm mb-1">
            <span className="font-semibold">Name:</span> {n.full_name}
          </div>
          <div className="text-sm mb-1">
            <span className="font-semibold">Email:</span> {n.email}
          </div>
          <div className="text-sm mb-1">
            <span className="font-semibold">Loan Amount:</span> {n.loan_amount}
          </div>
          <div className="text-xs text-slate-300">
            <span className="font-semibold">Application ID:</span> {n.application_id}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {new Date(n.created_at).toLocaleString()}
          </div>
          <button
            className="absolute top-2 right-2 text-white/70 hover:text-white text-xs px-2 py-1 rounded"
            onClick={e => { e.stopPropagation(); onNotificationDismiss && onNotificationDismiss(n.application_id); setNotifications(notifications.filter((_, i) => i !== idx)); }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      ))}
      {/* Show More button if more than 5 notifications */}
      {notifications.length > 5 && !showAll && (
        <button className="w-full py-2 text-blue-700 bg-blue-100 rounded" onClick={() => setShowAll(true)}>
          Show More
        </button>
      )}
      {showAll && notifications.length > 5 && (
        <button className="w-full py-2 text-blue-700 bg-blue-100 rounded" onClick={() => setShowAll(false)}>
          Show Less
        </button>
      )}
    </div>
  );
}

export default ManagerNotifications;
