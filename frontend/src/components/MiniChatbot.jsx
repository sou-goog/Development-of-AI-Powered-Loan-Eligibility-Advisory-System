import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  User,
  MessageCircle,
  Minimize2,
  Send,
  ExternalLink,
} from "lucide-react";
import VoiceAgentButton from "./VoiceAgentButton"; // safe voice button

export default function MiniChatbot({
  applicationId = null,
  isMinimized = true,
  onToggleMinimize,
}) {
  const navigate = useNavigate();

  const initialMessages = [
    {
      id: `mini-${Date.now()}`,
      role: "assistant",
      content:
        "Hi! I'm here to help with quick questions about your loan application. For full application help, open the full chat.",
      timestamp: new Date(),
    },
  ];

  const [isExpanded, setIsExpanded] = useState(!isMinimized);
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, isExpanded]);

  const toggleExpanded = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (typeof onToggleMinimize === "function") onToggleMinimize(!next);
  };

  const startNewChat = () => {
    setMessages([
      {
        id: `mini-${Date.now()}`,
        role: "assistant",
        content:
          "Hi again! If you'd like to continue with a full chat (eligibility, uploads, etc.), click Open Full Chat.",
        timestamp: new Date(),
      },
    ]);
    setInputValue("");
  };

  const handleLocalSend = () => {
    const trimmed = (inputValue || "").trim();
    if (!trimmed) return;
    setIsLoading(true);

    const userMsg = {
      id: `mini-user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    setTimeout(() => {
      const reply = {
        id: `mini-assistant-${Date.now()}`,
        role: "assistant",
        content:
          "Thanks — for more detailed help (eligibility checks, document uploads), please open the full chat.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, reply]);
      setIsLoading(false);
    }, 600);
  };

  const QUICK_SUGGESTIONS = [
    { id: "how-to-apply", label: "How to apply?" },
    { id: "required-docs", label: "Which documents are required?" },
    { id: "open-form", label: "Open application form" },
  ];

  const onQuickSuggestion = (id) => {
    if (id === "open-form") {
      navigate("/apply?view=form");
      return;
    }

    const mapping = {
      "how-to-apply":
        "You can start by opening the full application form and filling the required details. Or ask me any specific question.",
      "required-docs":
        "We typically need an ID (Aadhaar/PAN/KYC) and a financial proof (Bank Statement or Salary Slip). Use the Upload section to submit them.",
    };

    setInputValue(mapping[id] || "");
    setIsLoading(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `mini-assistant-${Date.now()}`,
          role: "assistant",
          content: mapping[id] || "Here's some help.",
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    }, 450);
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
          aria-label="Open assistant"
          className="bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="hidden md:inline font-medium">AI Assistant</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 12 }}
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
              <p className="text-primary-100 text-xs">Quick help & links</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={startNewChat}
              className="text-white/90 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-xs"
            >
              🆕 New Chat
            </button>

            <button
              onClick={() => navigate("/chat")}
              className="text-white/90 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-xs flex items-center space-x-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Open Full Chat</span>
            </button>

            <button
              onClick={toggleExpanded}
              className="text-white hover:bg-white/20 p-1 rounded-lg transition-colors"
              aria-label="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex max-w-xs items-end space-x-1.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-primary-600" : "bg-white border border-gray-200"}`}>
                    {msg.role === "user" ? <User className="w-3 h-3 text-white" /> : <Bot className="w-3 h-3 text-primary-600" />}
                  </div>
                  <div className={`px-3 py-2 rounded-lg shadow-sm text-sm ${msg.role === "user" ? "bg-primary-600 text-white" : "border bg-white"}`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className="text-xs mt-1 text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex justify-start">
              <div className="flex items-end space-x-1.5">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick suggestions + input */}
        <div className="border-t border-gray-100 p-3 bg-white">
          <div className="mb-2 text-xs text-gray-600">Quick help</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_SUGGESTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => onQuickSuggestion(s.id)}
                className="text-xs px-2 py-1 rounded bg-white/80 hover:bg-white transition-colors border"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Input + Send + Voice */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a quick question..."
              className="flex-grow min-w-0 text-sm border rounded px-3 py-2"
              onKeyPress={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  e.preventDefault();
                  handleLocalSend();
                }
              }}
            />

            {/* Send button immediately next to input */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleLocalSend}
              className="flex-shrink-0 bg-primary-600 text-white p-2 rounded"
              disabled={isLoading || !inputValue.trim()}
            >
              <Send className="w-4 h-4" />
            </motion.button>

            {/* Voice button far right */}
            <div className="flex-shrink-0">
              <VoiceAgentButton
                onVoiceResult={(text) => {
                  setInputValue(text);
                  handleLocalSend();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
