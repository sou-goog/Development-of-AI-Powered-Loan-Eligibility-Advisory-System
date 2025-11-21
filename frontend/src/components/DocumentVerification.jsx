import React, { useState } from "react";
import { ocrAPI, loanAPI, reportAPI } from "../utils/api";

export default function DocumentVerification({ applicationId, onVerified }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState("upload"); // upload, review, predicted

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await ocrAPI.verifyDocument(applicationId, file);
      setExtractedData(response.data);
      setStep("review");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to verify document");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePredictEligibility = async () => {
    setIsLoading(true);
    try {
      const response = await loanAPI.predictForApplication(applicationId);
      setStep("predicted");
      onVerified && onVerified(response.data);

      // Generate report
      await reportAPI.generateReport(applicationId);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to predict eligibility");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 h-[75vh] flex flex-col min-h-0">
      <h2 className="text-2xl font-bold mb-4">📄 Document Verification</h2>

      {error && (
        <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="space-y-4 flex-1 min-h-0">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/*,.pdf"
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="cursor-pointer flex flex-col items-center"
            >
              <span className="text-4xl mb-2">📸</span>
              <p className="text-gray-600">
                {file ? file.name : "Click to upload or drag and drop"}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                PNG, JPG, PDF (max 5MB)
              </p>
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || isLoading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
          >
            {isLoading ? "Verifying..." : "Verify Document"}
          </button>
        </div>
      )}

      {step === "review" && extractedData && (
        <div className="flex-1 min-h-0 flex flex-col space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-800 mb-2">
              ✓ Document Verified
            </h3>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                {extractedData.document_type || "Unknown Document"}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg flex-1 min-h-0 flex flex-col">
            <h4 className="font-semibold mb-2">Extracted Information</h4>
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
              {Object.entries(extractedData.fields || {}).map(
                ([key, value]) => {
                  const displayVal = Array.isArray(value)
                    ? Array.isArray(value[0])
                      ? value[0].join(", ")
                      : value[0]
                    : value;
                  return (
                    <div
                      key={key}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span className="text-gray-600 whitespace-nowrap">
                        {key.replace(/_/g, " ").toUpperCase()}:
                      </span>
                      <span className="font-semibold text-right break-words">
                        {displayVal}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          <button
            onClick={handlePredictEligibility}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
          >
            {isLoading ? "Processing..." : "Continue to Eligibility Check"}
          </button>
        </div>
      )}

      {step === "predicted" && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
          <h3 className="text-xl font-bold text-green-800 mb-2">
            ✓ Verification Complete!
          </h3>
          <p className="text-green-700">
            Your document has been verified and eligibility has been calculated.
          </p>
          <p className="text-sm text-green-600 mt-2">
            Your PDF report has been generated and is ready for download.
          </p>
        </div>
      )}
    </div>
  );
}
