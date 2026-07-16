"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { ReportCard } from "./ReportCard";

interface ReportChatBoxProps {
  reportData: any;
}

interface Message {
  id: string;
  sender: "bot" | "user";
  text?: string;
  reportDataKey?: keyof typeof REPORT_TYPES;
}

const REPORT_TYPES = {
  ORDERS_OVER_TIME: { title: "Orders Over Time", desc: "Monthly order volume & revenue", key: "ordersByMonth" },
  PIPELINE_FUNNEL: { title: "Pipeline Funnel", desc: "Enquiry to order conversion", key: "conversionFunnel" },
  REVENUE_BY_CUSTOMER: { title: "Revenue by Customer", desc: "Top customers by revenue", key: "revenueByCustomer" },
  TEAM_PERFORMANCE: { title: "Team Performance", desc: "Orders completed by employee", key: "teamPerformance" },
  ORDER_STAGE: { title: "Order Stage Breakdown", desc: "Distribution of active orders", key: "ordersByStage" },
  TICKET_ANALYSIS: { title: "Ticket Analysis", desc: "Support tickets by priority", key: "ticketsByPriority" },
  ENQUIRY_SOURCES: { title: "Enquiry Sources", desc: "Where leads are coming from", key: "enquirySourceBreakdown" },
} as const;

export function ReportChatBox({ reportData }: ReportChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Hi there! I can generate custom reports on the fly. Try asking for 'revenue by customer' or 'ticket analysis'.",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    
    // Process intent
    const query = input.toLowerCase();
    let matchedType: keyof typeof REPORT_TYPES | null = null;
    let botText = "Here is the report you requested:";

    if (query.includes("funnel") || query.includes("conversion")) {
      matchedType = "PIPELINE_FUNNEL";
    } else if (query.includes("revenue") || query.includes("customer")) {
      matchedType = "REVENUE_BY_CUSTOMER";
    } else if (query.includes("team") || query.includes("employee") || query.includes("performance")) {
      matchedType = "TEAM_PERFORMANCE";
    } else if (query.includes("stage") || query.includes("breakdown")) {
      matchedType = "ORDER_STAGE";
    } else if (query.includes("ticket") || query.includes("support")) {
      matchedType = "TICKET_ANALYSIS";
    } else if (query.includes("source") || query.includes("lead") || query.includes("enquiry")) {
      matchedType = "ENQUIRY_SOURCES";
    } else if (query.includes("time") || query.includes("month") || query.includes("trend") || query.includes("order")) {
      matchedType = "ORDERS_OVER_TIME";
    } else {
      botText = "I couldn't quite understand which report you need. Try asking for 'revenue', 'funnel', 'stages', or 'tickets'.";
    }

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: botText,
          reportDataKey: matchedType || undefined,
        },
      ]);
    }, 600);

    setInput("");
  };

  const handleQuickAction = (query: string) => {
    setInput(query);
    setTimeout(() => handleSend(), 100);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <Sparkles className="text-blue-500" size={18} />
        <h3 className="font-semibold text-slate-800">AI Report Builder</h3>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === "user" ? "bg-blue-600" : "bg-slate-200"}`}>
              {msg.sender === "user" ? <User size={16} className="text-white" /> : <Bot size={16} className="text-slate-600" />}
            </div>
            <div className={`max-w-[80%] flex flex-col gap-2 ${msg.sender === "user" ? "items-end" : "items-start"}`}>
              {msg.text && (
                <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.sender === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"}`}>
                  {msg.text}
                </div>
              )}
              {msg.reportDataKey && (
                <div className="w-[600px] max-w-full bg-white p-2 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <ReportCard 
                    type={msg.reportDataKey}
                    title={REPORT_TYPES[msg.reportDataKey].title}
                    description={REPORT_TYPES[msg.reportDataKey].desc}
                    data={reportData[REPORT_TYPES[msg.reportDataKey].key]}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto whitespace-nowrap bg-white border-t border-slate-100">
        {["Show revenue by customer", "View pipeline funnel", "Support ticket analysis", "Enquiry sources"].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => handleQuickAction(suggestion)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-full transition-colors border border-slate-200"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 bg-white">
        <div className="flex items-end gap-2 bg-slate-100 rounded-xl p-2 border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a report request (e.g., 'Show me orders over time')"
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2 px-3 text-sm text-slate-800"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg transition-colors shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Note: This agent only has read access to your reports data.
        </p>
      </div>
    </div>
  );
}
