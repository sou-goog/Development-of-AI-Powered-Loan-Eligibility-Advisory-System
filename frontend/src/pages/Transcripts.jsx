// src/pages/Transcripts.jsx
import React from "react";
import AdminLayout from "../components/AdminLayout";

function Transcripts() {
  // Sample transcript data (later connect to backend)
  const transcripts = [
    {
      id: "CALL1021",
      user: "What is the interest rate?",
      ai: "Current loan interest rate starts from 10.5%.",
      extracted: "{ 'query': 'interest_rate' }",
      time: "2025-01-14 10:32 AM",
    },
    {
      id: "CALL1022",
      user: "Am I eligible for 5 lakh loan?",
      ai: "Based on your credit score, you are likely eligible.",
      extracted: "{ 'loan_amount': '500000' }",
      time: "2025-01-14 10:45 AM",
    },
    {
      id: "CALL1023",
      user: "What documents do I need?",
      ai: "You need ID proof, address proof, and bank statements.",
      extracted: "{ 'query': 'documents' }",
      time: "2025-01-14 11:02 AM",
    },
    {
      id: "CALL1024",
      user: "What is my eligibility?",
      ai: "You are eligible for a maximum of ₹2,40,000.",
      extracted: "{ 'eligibility': '240000' }",
      time: "2025-01-14 11:20 AM",
    },
  ];

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold mb-6">Voice Conversation Transcripts</h1>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="py-3 px-2">Call ID</th>
              <th className="py-3 px-2">User Message</th>
              <th className="py-3 px-2">AI Response</th>
              <th className="py-3 px-2">Extracted Fields</th>
              <th className="py-3 px-2">Timestamp</th>
            </tr>
          </thead>

          <tbody>
            {transcripts.map((t, index) => (
              <tr
                key={index}
                className="border-b border-slate-700 hover:bg-slate-700/40"
              >
                <td className="py-3 px-2">{t.id}</td>
                <td className="py-3 px-2 text-slate-200">{t.user}</td>
                <td className="py-3 px-2 text-blue-300">{t.ai}</td>
                <td className="py-3 px-2 text-yellow-300">{t.extracted}</td>
                <td className="py-3 px-2">{t.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

export default Transcripts;
