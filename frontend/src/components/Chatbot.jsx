import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { chatAPI } from "../utils/api";
import { auth } from "../utils/auth";
import VoiceAgentButton from "./VoiceAgentButton";
import MiniChatbot from "./MiniChatbot";
import { toast } from "react-toastify";
import {
  Send,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
  FileText,
  Mail,
} from "lucide-react";

export default function Chatbot({
  applicationId = null,
  showVoiceAgentInHeader = true,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [voiceApplicationId, setVoiceApplicationId] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content:
        "Hello! I'm your AI Loan Assistant. I can help you apply for a loan by asking some questions first, then guide you to fill out a detailed form. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setCollectedInfo] = useState({
    hasBasicInfo: false,
    hasContactInfo: false,
    hasFinancialInfo: false,
    suggestedForm: false,
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    // Add user message to chat
    const userMessage = {
      id: messages.length + 1,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(text, applicationId);

      // Update collected information tracking
      updateCollectedInfo(text, response.data);

      // Handle eligibility results
      if (response.data.eligibility_score !== undefined) {
        const eligibilityMessage = {
          id: messages.length + 2,
          role: "assistant",
          content: `Great news! Your eligibility score is ${response.data.score_percentage}%. You are ${response.data.status_text} for a loan.`,
          type: "eligibility_result",
          data: response.data,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, eligibilityMessage]);
      }

      // Handle report generation
      if (response.data.report_generated) {
        const reportMessage = {
          id: messages.length + 2,
          role: "assistant",
          content:
            "Your loan report has been generated! You can download it from the reports section.",
          type: "report_generated",
          data: response.data,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, reportMessage]);
      }

      // Handle OTP sent
      if (response.data.otp_sent) {
        const otpMessage = {
          id: messages.length + 2,
          role: "assistant",
          content: `I've sent a verification code to ${response.data.email}. Please check your email and enter the 6-digit code.`,
          type: "otp_sent",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, otpMessage]);
      }

      // Handle application creation
      if (response.data.application_created) {
        const appMessage = {
          id: messages.length + 2,
          role: "assistant",
          content:
            "Perfect! I've created your loan application. Let's continue gathering the required information.",
          type: "application_created",
          data: response.data,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, appMessage]);
      }

      // Auto-navigate if backend signals to open form
      if (response.data.action === "open_form") {
        toast.info("Opening the detailed application form…", {
          autoClose: 2000,
        });
        handleFormNavigation();
      }

      // Regular assistant message
      if (
        !response.data.eligibility_score &&
        !response.data.report_generated &&
        !response.data.otp_sent &&
        !response.data.application_created
      ) {
        let assistantContent = response.data.message;
        // Prefer structured suggestions if present, fallback to text list
        let suggestions = [];
        if (
          Array.isArray(response.data.suggestions) &&
          response.data.suggestions.length > 0
        ) {
          suggestions = response.data.suggestions.map(
            (s) => s.label || String(s)
          );
        } else {
          suggestions = response.data.suggested_next_steps || [];
        }

        // Leave form suggestions to backend logic only; no client-side injection

        const assistantMessage = {
          id: messages.length + 2,
          role: "assistant",
          content: assistantContent,
          suggestions: suggestions,
          // Preserve structured suggestions for click handlers
          suggestionsObj: Array.isArray(response.data.suggestions)
            ? response.data.suggestions
            : null,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        id: messages.length + 2,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        type: "error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCollectedInfo = (userText, responseData) => {
    const text = userText.toLowerCase().trim();
    const numericOnly = text.replace(/\D/g, "");
    const collected = new Set(responseData?.collected_fields || []);

    // Basic personal information
    const hasNameFromUser =
      /\b(my\s+name\s+is|i\s*am|i'm|this\s+is)\b/.test(text) ||
      /^[a-z][a-z'.-]+(\s+[a-z][a-z'.-]+){0,3}$/i.test(text);
    const hasAgeFromUser = /\b(\d{2})\s*(years|yrs|yo)\b/.test(text);
    const hasContactFromUser =
      /@/.test(text) ||
      /\b(\d{10})\b/.test(text) ||
      /\b(email|phone|contact)\b/.test(text);

    // Financial information
    const hasIncomeFromUser =
      /\b(income|salary|earn)\b/.test(text) ||
      /\b(\d+(?:\.\d+)?\s*(lakh|lakhs|crore|crores))\b/.test(text) ||
      /^\d{4,8}$/.test(numericOnly);
    const hasLoanFromUser =
      /\b(loan|borrow|amount)\b/.test(text) ||
      /\b(\d+(?:\.\d+)?\s*(lakh|lakhs|crore|crores))\b/.test(text);
    const creditScoreMatch = text.match(/\b([3-9]\d{2})\b/);
    const hasCreditScoreFromUser = !!(
      creditScoreMatch &&
      parseInt(creditScoreMatch[1]) >= 300 &&
      parseInt(creditScoreMatch[1]) <= 900
    );

    // Combine with backend-confirmed extractions
    const hasBasicInfo =
      hasNameFromUser || hasAgeFromUser || collected.has("full_name");
    const hasContactInfo =
      hasContactFromUser || collected.has("email") || collected.has("phone");
    const hasFinancialInfo =
      hasIncomeFromUser ||
      hasLoanFromUser ||
      hasCreditScoreFromUser ||
      collected.has("annual_income") ||
      collected.has("loan_amount") ||
      collected.has("credit_score");

    setCollectedInfo((prev) => ({
      ...prev,
      hasBasicInfo: prev.hasBasicInfo || hasBasicInfo,
      hasContactInfo: prev.hasContactInfo || hasContactInfo,
      hasFinancialInfo: prev.hasFinancialInfo || hasFinancialInfo,
    }));
  };

  // Removed shouldSuggestForm: backend controls when to suggest/open the form

  const handleFormNavigation = () => {
    // If not authenticated, send user to auth first, preserving view=form
    if (!auth.isAuthenticated()) {
      toast.info("Please sign in to continue to the form.", {
        autoClose: 2000,
      });
      const nextUrl = encodeURIComponent("/apply?view=form");
      navigate(`/auth?next=${nextUrl}`);
      return;
    }
    navigate("/apply?view=form");
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case "eligibility_result":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "report_generated":
        return <FileText className="w-5 h-5 text-blue-600" />;
      case "otp_sent":
        return <Mail className="w-5 h-5 text-yellow-600" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Bot className="w-5 h-5 text-primary-600" />;
    }
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case "eligibility_result":
        return "bg-green-50 border-green-200 text-green-900";
      case "report_generated":
        return "bg-blue-50 border-blue-200 text-blue-900";
      case "otp_sent":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "error":
        return "bg-red-50 border-red-200 text-red-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">AI Loan Assistant</h3>
              <p className="text-primary-100 text-sm">
                Online and ready to help
              </p>
            </div>
          </div>

          {/* Header actions: Open Form + optional Voice Agent */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleFormNavigation}
              className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm"
            >
              Open Form
            </button>
            {showVoiceAgentInHeader && (
              <VoiceAgentButton
                applicationId={applicationId}
                onBackendTurn={(userText, assistantText) => {
                  // Mirror the voice conversation in the chat window
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: prev.length + 1,
                      role: "user",
                      content: userText,
                      timestamp: new Date(),
                    },
                    {
                      id: prev.length + 2,
                      role: "assistant",
                      content: assistantText,
                      timestamp: new Date(),
                    },
                  ]);
                }}
                onApplicationLinked={(appId) => {
                  setVoiceApplicationId(appId);
                  // Also show a CTA message in the chat
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: prev.length + 1,
                      role: "assistant",
                      content:
                        "I’ve created your application from this call. You can skip the form and upload your documents now.",
                      type: "info",
                      timestamp: new Date(),
                    },
                  ]);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
        <AnimatePresence>
          {messages.map((msg, index) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex max-w-xs lg:max-w-md ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                } items-end space-x-2`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === "user"
                      ? "bg-primary-600 ml-2"
                      : getMessageStyle(msg.type).includes("bg-")
                      ? "bg-white border-2 border-gray-200"
                      : "bg-primary-600"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    getMessageIcon(msg.type)
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl shadow-sm ${
                    msg.role === "user"
                      ? "bg-primary-600 text-white"
                      : `border ${getMessageStyle(msg.type)}`
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>

                  {/* Eligibility result details */}
                  {msg.type === "eligibility_result" && msg.data && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 pt-3 border-t border-green-200"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Score:</span>
                          <span className="font-semibold">
                            {msg.data.score_percentage}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className="font-semibold">
                            {msg.data.eligibility_status}
                          </span>
                        </div>
                        {msg.data.recommendations &&
                          msg.data.recommendations.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium mb-1">
                                Recommendations:
                              </p>
                              <ul className="list-disc list-inside space-y-1">
                                {msg.data.recommendations.map((rec, idx) => (
                                  <li key={idx} className="text-xs">
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                      </div>
                    </motion.div>
                  )}

                  {/* Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 pt-3 border-t border-gray-200"
                    >
                      <p className="text-xs font-medium mb-2">
                        Suggested next steps:
                      </p>
                      <div className="space-y-1">
                        {msg.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              // If structured suggestion exists on the message, use its id
                              const sObj = Array.isArray(msg.suggestionsObj)
                                ? msg.suggestionsObj[idx]
                                : null;
                              const sid =
                                sObj && sObj.id ? String(sObj.id) : null;
                              const s = String(suggestion || "")
                                .toLowerCase()
                                .trim();
                              if (
                                sid === "open_form" ||
                                s === "open detailed application form" ||
                                s === "yes, take me to the form"
                              ) {
                                handleFormNavigation();
                                return;
                              }
                              if (sid && sid.startsWith("provide_")) {
                                // Turn the id back into a natural language prompt
                                const label =
                                  sObj && sObj.label ? sObj.label : suggestion;
                                handleSendMessage(label);
                                return;
                              }
                              handleSendMessage(suggestion);
                            }}
                            className="block w-full text-left text-xs bg-white/50 hover:bg-white/80 px-2 py-1 rounded transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`text-xs mt-2 ${
                      msg.role === "user" ? "text-primary-100" : "text-gray-500"
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex justify-start"
            >
              <div className="flex items-end space-x-2">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-100 p-4 bg-white">
        <div className="flex items-end space-x-3 flex-wrap gap-y-3">
          {voiceApplicationId && (
            <button
              onClick={() =>
                navigate(`/verification?applicationId=${voiceApplicationId}`)
              }
              className="px-3 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700"
            >
              Upload Documents for Application #{voiceApplicationId}
            </button>
          )}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !isLoading && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }
              }}
              placeholder="Type your message..."
              className="input-field pr-12 resize-none"
              disabled={isLoading}
              rows={1}
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim()}
            className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Subtle manual form link, only if not already on /apply */}
        {location.pathname !== "/apply" && (
          <div className="mt-3 text-xs text-gray-500">
            Prefer the full form?{" "}
            <button
              type="button"
              onClick={handleFormNavigation}
              className="text-primary-600 hover:underline"
            >
              Open detailed application form
            </button>
          </div>
        )}
      </div>

      {/* Mini Chatbot for additional help */}
      <MiniChatbot applicationId={applicationId} isMinimized={true} />
    </div>
  );
}
