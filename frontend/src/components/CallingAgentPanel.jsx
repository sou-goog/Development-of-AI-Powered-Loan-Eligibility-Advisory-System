import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneCall, User, Bot, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import VoiceAgentButton from "./VoiceAgentButton";

export default function CallingAgentPanel() {
  const navigate = useNavigate();
  const [applicationId, setApplicationId] = useState(null);
  const [turns, setTurns] = useState([]); // [{user, assistant, ts}]
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState([]);

  // Auto-navigate to verification once ready and we have an application id
  useEffect(() => {
    if (ready && applicationId) {
      navigate(`/verification?applicationId=${applicationId}`);
    }
  }, [ready, applicationId, navigate]);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-secondary-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <PhoneCall className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">AI Calling Agent</h3>
              <p className="text-primary-100 text-sm">Tap Speak to talk</p>
            </div>
          </div>

          <VoiceAgentButton
            applicationId={applicationId}
            onBackendTurn={(userText, assistantText) => {
              setTurns((prev) => [
                ...prev,
                {
                  user: userText,
                  assistant: assistantText,
                  ts: new Date(),
                },
              ]);
            }}
            onApplicationLinked={(appId) => setApplicationId(appId)}
            onReadyForPrediction={(isReady, appId, missingFields) => {
              setReady(!!isReady);
              setMissing(Array.isArray(missingFields) ? missingFields : []);
              if (appId && !applicationId) setApplicationId(appId);
            }}
          />
        </div>
      </div>

      {/* Transcript area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
        {turns.length === 0 ? (
          <div className="text-center text-gray-500 text-sm">
            Start speaking to begin your voice application. We'll capture key
            info and create/update your application.
          </div>
        ) : (
          <AnimatePresence>
            {turns.map((t, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-2"
              >
                <div className="flex justify-end">
                  <div className="flex items-end space-x-2 max-w-md">
                    <div className="px-4 py-3 rounded-2xl bg-secondary-600 text-white shadow-sm">
                      <p className="text-sm leading-relaxed">{t.user}</p>
                      <div className="text-xs mt-2 text-secondary-100">
                        {t.ts.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-secondary-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="flex items-end space-x-2 max-w-md">
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-secondary-600" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 shadow-sm">
                      <p className="text-sm leading-relaxed">{t.assistant}</p>
                      <div className="text-xs mt-2 text-gray-500">
                        {t.ts.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-100 p-4 bg-white flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {applicationId ? (
            ready ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" /> All set. Proceed to document
                upload.
              </div>
            ) : (
              <span>
                Collecting details
                {missing && missing.length > 0
                  ? `: ${missing.join(", ")}`
                  : "…"}
              </span>
            )
          ) : (
            <span>We'll link an application once enough info is captured.</span>
          )}
        </div>
        {applicationId && ready && (
          <button
            onClick={() =>
              navigate(`/verification?applicationId=${applicationId}`)
            }
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            Upload Documents
          </button>
        )}
      </div>
    </div>
  );
}
