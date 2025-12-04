import React from "react";

export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Help & FAQs</h1>
      <p className="mb-4">Find answers to common questions, or use the AI Assistant for instant help.</p>
      <ul className="list-disc pl-6 mb-6 text-gray-700">
        <li>How to apply for a loan</li>
        <li>Required documents</li>
        <li>Eligibility criteria</li>
        <li>How to upload documents</li>
        <li>How to reset your password</li>
        <li>Contacting support</li>
      </ul>
      <div className="bg-primary-50 border border-primary-200 rounded p-4">
        <p className="mb-2 font-semibold">Need more help?</p>
        <p>Use the AI Assistant chatbox at the bottom right or visit the <a href="/contact" className="text-primary-600 underline">Contact Us</a> page.</p>
      </div>
    </div>
  );
}
