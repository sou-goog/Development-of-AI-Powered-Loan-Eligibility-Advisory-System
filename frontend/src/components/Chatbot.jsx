import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { chatAPI } from "../utils/api";
import MiniChatbot from "./MiniChatbot";
import { toast } from "react-toastify";
import { Send, Bot, User } from "lucide-react";

export default function Chatbot({ applicationId = null }) {
  const generateId = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  const [messages, setMessages] = useState([
    {
      id: generateId(),
      role: "assistant",
      content:
        "Hello! I'm your AI Loan Assistant. To get started, what's your full name?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Send user message and process backend response
  const handleSendMessage = async (text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    if (isLoading) return;

    const userMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(trimmed, applicationId);

      const assistantMessages = [];
      const suggestions =
        response.data.suggestions ||
        response.data.suggested_next_steps ||
        [];

      assistantMessages.push({
        id: generateId(),
        role: "assistant",
        content: response.data.message || "Here's an update.",
        suggestions,
        timestamp: new Date(),
      });

      setMessages((prev) => [...prev, ...assistantMessages]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        },
      ]);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    // suggestion could be object {id, label} or string
    const text = typeof suggestion === "object" ? suggestion.label : suggestion;
    handleSendMessage(text);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 px-6 py-4 flex items-center space-x-3">
        <div className="bg-white/20 p-2 rounded-lg">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-white font-semibold">AI Loan Assistant</h3>
          <p className="text-primary-100 text-sm">Online and ready to help</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-xs lg:max-w-md ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                } items-end space-x-2`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === "user" ? "bg-primary-600" : "bg-white border border-gray-200"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-primary-600" />}
                </div>

                <div
                  className={`px-4 py-3 rounded-2xl shadow-sm ${
                    msg.role === "user" ? "bg-primary-600 text-white" : "border bg-white"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      {msg.suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(s)}
                          className="block w-full text-left text-xs bg-white/50 hover:bg-white/80 px-2 py-1 rounded transition-colors mt-1"
                        >
                          {typeof s === "object" ? s.label : s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="text-xs mt-1 text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
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
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 p-4 bg-white sticky bottom-0 z-20 flex items-center gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border rounded-md px-4 py-3 pr-12"
          disabled={isLoading}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !isLoading && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(inputValue);
            }
          }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSendMessage(inputValue)}
          disabled={isLoading || !inputValue.trim()}
          className="bg-primary-600 text-white p-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </motion.button>
      </div>

      {/* MiniChatbot */}
      <MiniChatbot applicationId={applicationId} isMinimized={true} />
    </div>
  );
}

