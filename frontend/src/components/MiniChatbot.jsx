import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { chatAPI } from "../utils/api";
import VoiceAgentButton from "./VoiceAgentButton";
import {
  Send,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
  FileText,
  Mail,
  MessageCircle,
  Minimize2,
} from "lucide-react";

export default function MiniChatbot({
  applicationId = null,
  isMinimized = true,
  onToggleMinimize,
}) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content:
        "Hi! I'm here to help with any questions about your loan application. How can I assist you?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!isMinimized);
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

      // Handle eligibility results
      if (response.data.eligibility_score !== undefined) {
        const eligibilityMessage = {
          id: messages.length + 2,
          role: "assistant",
          content: `Your eligibility score is ${response.data.score_percentage}%. You are ${response.data.status_text} for a loan.`,
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

      // Regular assistant message
      if (
        !response.data.eligibility_score &&
        !response.data.report_generated &&
        !response.data.otp_sent &&
        !response.data.application_created
      ) {
        const suggestionsArr = Array.isArray(response.data.suggestions)
          ? response.data.suggestions.map((s) => s.label || String(s))
          : response.data.suggested_next_steps || [];
        const assistantMessage = {
          id: messages.length + 2,
          role: "assistant",
          content: response.data.message,
          suggestions: suggestionsArr,
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

  const getMessageIcon = (type) => {
    switch (type) {
      case "eligibility_result":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "report_generated":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "otp_sent":
        return <Mail className="w-4 h-4 text-yellow-600" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Bot className="w-4 h-4 text-primary-600" />;
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

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (onToggleMinimize) {
      onToggleMinimize(!isExpanded);
    }
  };

  if (!isExpanded) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          onClick={toggleExpanded}
          className="bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="hidden md:inline font-medium">AI Assistant</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      className="fixed bottom-6 right-6 z-50 w-96 max-w-sm"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-secondary-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">AI Assistant</h3>
              <p className="text-primary-100 text-xs">Ready to help</p>
            </div>
          </div>
          <button
            onClick={toggleExpanded}
            className="text-white hover:bg-white/20 p-1 rounded-lg transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
          <AnimatePresence>
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex max-w-xs items-end space-x-1.5 ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      msg.role === "user"
                        ? "bg-primary-600 ml-1.5"
                        : getMessageStyle(msg.type).includes("bg-")
                        ? "bg-white border border-gray-200"
                        : "bg-primary-600"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="w-3 h-3 text-white" />
                    ) : (
                      getMessageIcon(msg.type)
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`px-3 py-2 rounded-lg shadow-sm text-sm ${
                      msg.role === "user"
                        ? "bg-primary-600 text-white"
                        : `border ${getMessageStyle(msg.type)}`
                    }`}
                  >
                    <p className="leading-relaxed">{msg.content}</p>

                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium mb-1">
                          Suggested next steps:
                        </p>
                        <div className="space-y-1">
                          {msg.suggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
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
                                  navigate("/apply?view=form");
                                  return;
                                }
                                if (sid && sid.startsWith("provide_")) {
                                  const label =
                                    sObj && sObj.label
                                      ? sObj.label
                                      : suggestion;
                                  handleSendMessage(label);
                                  return;
                                }
                                handleSendMessage(suggestion);
                              }}
                              className="block w-full text-left text-xs bg-white/60 hover:bg-white px-2 py-1 rounded transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Eligibility result details */}
                    {msg.type === "eligibility_result" && msg.data && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2 pt-2 border-t border-green-200"
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
                        </div>
                      </motion.div>
                    )}

                    {/* Timestamp */}
                    <div
                      className={`text-xs mt-1 ${
                        msg.role === "user"
                          ? "text-primary-100"
                          : "text-gray-500"
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex justify-start"
              >
                <div className="flex items-end space-x-1.5">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
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
        <div className="border-t border-gray-100 p-3 bg-white">
          <div className="flex items-end space-x-2">
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
                placeholder="Ask me anything..."
                className="input-field pr-10 text-sm resize-none"
                disabled={isLoading}
                rows={1}
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSendMessage(inputValue)}
              disabled={isLoading || !inputValue.trim()}
              className="btn-primary p-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </motion.button>
            {/* Voice Agent (Realtime Call) */}
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
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
