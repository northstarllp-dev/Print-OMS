"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Zap } from "lucide-react";
import { ReportCard, C, type ReportType } from "./ReportCard";
import { REPORT_REGISTRY, QUICK_SUGGESTIONS } from "../lib/reportRegistry";
import { resolveReportRequest } from "../actions/aiReportBuilder";

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

const BRAND = {
  primary: C.revenue,
  primarySoft: C.revenueTint,
  gradient: `linear-gradient(135deg, ${C.revenue} 0%, ${C.orders} 100%)`,
};

export function ReportChatBox({ reportData }: ReportChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Hi! Ask me for any report in plain English — revenue, orders, team performance, retention, tickets, and more. Or tap a suggestion below.",
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
  }, [messages, isTyping]);

  const handleSend = async (overrideInput?: string) => {
    const query = (overrideInput ?? input).trim();
    if (!query || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), sender: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const result = await resolveReportRequest(query);

      if (!result.ok) {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "bot", text: result.error },
        ]);
        return;
      }

      if (result.reportId && result.dataKey) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: result.message,
            reportType: result.reportId!,
            reportDataKey: result.dataKey,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "bot", text: result.message },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: "Something went wrong talking to the AI. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", background: BRAND.gradient, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={16} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>AI Report Builder</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>Powered by a real LLM · live PrintOMS data</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 10px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.completion }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>Live data</span>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14, background: "#f8fafc" }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: "flex", gap: 10, flexDirection: msg.sender === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: msg.sender === "user" ? BRAND.primary : "#fff",
              border: msg.sender === "bot" ? "1px solid #e2e8f0" : "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}>
              {msg.sender === "user" ? <User size={14} color="#fff" /> : <Bot size={14} color={BRAND.primary} />}
            </div>
            <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 6, alignItems: msg.sender === "user" ? "flex-end" : "flex-start" }}>
              {msg.text && (
                <div style={{
                  padding: "10px 14px", borderRadius: 12,
                  borderTopLeftRadius: msg.sender === "bot" ? 2 : 12,
                  borderTopRightRadius: msg.sender === "user" ? 2 : 12,
                  background: msg.sender === "user" ? BRAND.gradient : "#fff",
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
                    title={REPORT_REGISTRY[msg.reportType]?.title || msg.reportType}
                    description={REPORT_REGISTRY[msg.reportType]?.desc || ""}
                    data={reportData[msg.reportDataKey] || []}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={14} color={BRAND.primary} />
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 16px", display: "flex", gap: 4, alignItems: "center" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: BRAND.primary, animation: `dotBounce 1.2s ${i * 0.2}s infinite ease-in-out` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "10px 14px 6px", background: "#fff", borderTop: "1px solid #f1f5f9", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSend(s)}
            disabled={isTyping}
            style={{
              padding: "5px 12px", background: BRAND.primarySoft, border: "1px solid #bfdbfe", borderRadius: 20,
              cursor: isTyping ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: BRAND.primary,
              display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s", opacity: isTyping ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!isTyping) e.currentTarget.style.background = "#bfdbfe"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = BRAND.primarySoft; }}
          >
            <Zap size={10} />
            {s}
          </button>
        ))}
      </div>

      <div style={{ padding: "10px 14px 14px", background: "#fff" }}>
        <div
          style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "#f8fafc", borderRadius: 12, padding: "8px 10px", border: "1.5px solid #e2e8f0", transition: "border-color 0.2s" }}
          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BRAND.primary; }}
          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Ask for any report… (e.g. 'Show customer retention')"
            rows={1}
            disabled={isTyping}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", maxHeight: 100, fontSize: 13, color: "#334155", lineHeight: 1.5, padding: "4px 4px" }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isTyping}
            style={{
              padding: "8px 14px",
              background: input.trim() && !isTyping ? BRAND.gradient : "#e2e8f0",
              border: "none",
              borderRadius: 9,
              cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
              color: input.trim() && !isTyping ? "#fff" : "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
              transition: "all 0.2s",
            }}
          >
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
