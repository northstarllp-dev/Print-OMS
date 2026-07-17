"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Zap } from "lucide-react";
import { ReportCard, type ReportType } from "./ReportCard";

interface ReportChatBoxProps {
  reportData: any;
}

interface Message {
  id: string;
  sender: "bot" | "user";
  text?: string;
  reportType?: ReportType;
  reportDataKey?: string;
}

const REPORT_REGISTRY: Record<string, { title: string; desc: string; type: ReportType; dataKey: string; keywords: string[] }> = {
  REVENUE_TREND: {
    title: "Revenue & Order Trend", desc: "Monthly revenue bars + order count line",
    type: "REVENUE_TREND", dataKey: "revenueTrend",
    keywords: ["revenue trend", "monthly revenue", "revenue growth", "income"],
  },
  ORDERS_OVER_TIME: {
    title: "Orders Over Time", desc: "Monthly order volume and estimated revenue",
    type: "ORDERS_OVER_TIME", dataKey: "ordersByMonth",
    keywords: ["orders over time", "order trend", "monthly orders", "order volume"],
  },
  PIPELINE_FUNNEL: {
    title: "Pipeline Funnel", desc: "Enquiry → Order → Installation → Completed",
    type: "PIPELINE_FUNNEL", dataKey: "conversionFunnel",
    keywords: ["funnel", "pipeline", "conversion funnel"],
  },
  REVENUE_BY_CUSTOMER: {
    title: "Top 10 Customers", desc: "Highest revenue generating customers",
    type: "REVENUE_BY_CUSTOMER", dataKey: "revenueByCustomer",
    keywords: ["customer", "top customers", "revenue by customer", "best customers"],
  },
  TEAM_PERFORMANCE: {
    title: "Team Performance", desc: "Assigned vs completed orders per employee",
    type: "TEAM_PERFORMANCE", dataKey: "teamPerformance",
    keywords: ["team", "employee", "performance", "staff", "completed by"],
  },
  ORDER_STAGE: {
    title: "Order Stage Breakdown", desc: "Distribution of orders by pipeline stage",
    type: "ORDER_STAGE", dataKey: "ordersByStage",
    keywords: ["stage", "breakdown", "order stages", "pipeline stages"],
  },
  TICKET_ANALYSIS: {
    title: "Tickets by Priority", desc: "Support ticket distribution by priority",
    type: "TICKET_ANALYSIS", dataKey: "ticketsByPriority",
    keywords: ["ticket", "support", "priority", "service ticket"],
  },
  ENQUIRY_SOURCES: {
    title: "Enquiry Sources", desc: "Where your leads are coming from",
    type: "ENQUIRY_SOURCES", dataKey: "enquirySourceBreakdown",
    keywords: ["source", "lead source", "enquiry source", "where leads", "marketing"],
  },
  ORDER_HEALTH: {
    title: "Order Health", desc: "Active, on-hold, lost & completed breakdown",
    type: "ORDER_HEALTH", dataKey: "orderHealthBreakdown",
    keywords: ["health", "order health", "active orders", "lost orders", "on hold"],
  },
  CONVERSION_BY_MONTH: {
    title: "Monthly Conversion Trend", desc: "Enquiries vs orders with conversion rate",
    type: "CONVERSION_BY_MONTH", dataKey: "conversionByMonth",
    keywords: ["conversion", "conversion rate", "monthly conversion", "enquiry to order"],
  },
  CUSTOMER_RETENTION: {
    title: "Customer Retention", desc: "New vs returning customers per month",
    type: "CUSTOMER_RETENTION", dataKey: "customerRetention",
    keywords: ["retention", "returning customer", "new customer", "repeat", "loyal"],
  },
  WEEKLY_COMPLETIONS: {
    title: "Weekly Completions", desc: "Orders completed per week (last 12 weeks)",
    type: "WEEKLY_COMPLETIONS", dataKey: "weeklyCompletions",
    keywords: ["weekly", "week", "completion rate", "completed per week"],
  },
  TICKET_STATUS: {
    title: "Ticket Status Mix", desc: "Open, in-progress, and resolved breakdown",
    type: "TICKET_STATUS", dataKey: "ticketStatusBreakdown",
    keywords: ["ticket status", "open tickets", "resolved", "closed tickets"],
  },
};

const QUICK_SUGGESTIONS = [
  "Show revenue trend",
  "Top customers by revenue",
  "Team performance",
  "Pipeline funnel",
  "Customer retention",
  "Ticket analysis",
];

export function ReportChatBox({ reportData }: ReportChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "👋 Hi! I can generate any report instantly. Ask me about **revenue**, **orders**, **team performance**, **customer retention**, **tickets**, and more. Or pick a suggestion below!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (overrideInput?: string) => {
    const query = (overrideInput ?? input).trim();
    if (!query) return;

    const userMsg: Message = { id: Date.now().toString(), sender: "user", text: query };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const lower = query.toLowerCase();
    let matched: typeof REPORT_REGISTRY[string] | null = null;
    let bestScore = 0;

    for (const entry of Object.values(REPORT_REGISTRY)) {
      const score = entry.keywords.reduce((s, kw) => s + (lower.includes(kw) ? kw.length : 0), 0);
      if (score > bestScore) { bestScore = score; matched = entry; }
    }

    setTimeout(() => {
      setIsTyping(false);
      if (matched) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: `Here's the **${matched.title}** report:`,
          reportType: matched.type,
          reportDataKey: matched.dataKey,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: "I couldn't find a matching report. Try asking for: revenue, orders, funnel, customers, team, tickets, retention, conversion, or health.",
        }]);
      }
    }, 700);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06)" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={16} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>AI Report Builder</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>Ask for any report in plain English</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 10px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>Live data</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14, background: "#fafafa" }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: "flex", gap: 10, flexDirection: msg.sender === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
            {/* Avatar */}
            <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: msg.sender === "user" ? "#6366f1" : "#fff",
              border: msg.sender === "bot" ? "1px solid #e2e8f0" : "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              {msg.sender === "user" ? <User size={14} color="#fff" /> : <Bot size={14} color="#6366f1" />}
            </div>
            <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 6, alignItems: msg.sender === "user" ? "flex-end" : "flex-start" }}>
              {msg.text && (
                <div style={{
                  padding: "10px 14px", borderRadius: 12,
                  borderTopLeftRadius: msg.sender === "bot" ? 2 : 12,
                  borderTopRightRadius: msg.sender === "user" ? 2 : 12,
                  background: msg.sender === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#fff",
                  color: msg.sender === "user" ? "#fff" : "#334155",
                  fontSize: 13, lineHeight: 1.5,
                  border: msg.sender === "bot" ? "1px solid #e2e8f0" : "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}>
                  {msg.text}
                </div>
              )}
              {msg.reportType && msg.reportDataKey && (
                <div style={{ width: 580, maxWidth: "100%" }}>
                  <ReportCard
                    type={msg.reportType}
                    title={(REPORT_REGISTRY[msg.reportType] || {}).title || msg.reportType}
                    description={(REPORT_REGISTRY[msg.reportType] || {}).desc || ""}
                    data={reportData[msg.reportDataKey] || []}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={14} color="#6366f1" />
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 16px", display: "flex", gap: 4, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", animation: `dotBounce 1.2s ${i * 0.2}s infinite ease-in-out` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick suggestions */}
      <div style={{ padding: "10px 14px 6px", background: "#fff", borderTop: "1px solid #f1f5f9", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QUICK_SUGGESTIONS.map(s => (
          <button key={s} onClick={() => handleSend(s)} style={{
            padding: "5px 12px", background: "#f5f3ff", border: "1px solid #e0e7ff", borderRadius: 20,
            cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#6366f1",
            display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#e0e7ff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#f5f3ff"; }}>
            <Zap size={10} />
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px 14px", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "#f8fafc", borderRadius: 12, padding: "8px 10px", border: "1.5px solid #e2e8f0", transition: "border-color 0.2s" }}
          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "#6366f1"; }}
          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask for any report… (e.g. 'Show customer retention')"
            rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", maxHeight: 100, fontSize: 13, color: "#334155", lineHeight: 1.5, padding: "4px 4px" }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            style={{ padding: "8px 14px", background: input.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#e2e8f0", border: "none", borderRadius: 9, cursor: input.trim() ? "pointer" : "not-allowed", color: input.trim() ? "#fff" : "#94a3b8", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, flexShrink: 0, transition: "all 0.2s" }}>
            <Send size={13} />
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
