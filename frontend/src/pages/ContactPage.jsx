import React from "react";

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Contact Us</h1>
      <p className="mb-4">If you need assistance, please reach out to our support team. We’re here to help!</p>
      <div className="mb-4">
        <h2 className="font-semibold mb-1">Email</h2>
        <p>support@ai-loan-system.com</p>
      </div>
      <div className="mb-4">
        <h2 className="font-semibold mb-1">Phone</h2>
        <p>+1-800-123-4567</p>
      </div>
      <div className="mb-4">
        <h2 className="font-semibold mb-1">Live Chat</h2>
        <p>Use the AI Assistant chatbox at the bottom right for instant help.</p>
      </div>
    </div>
  );
}
