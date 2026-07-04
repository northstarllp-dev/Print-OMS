"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import {
  getWhatsAppConfigStatusAction,
  testWhatsAppHelloWorldAction,
  type WhatsAppConfigStatus,
  type HelloWorldTestResult,
} from "@/features/notifications/actions/testWhatsAppAction";

type Props = {
  initialStatus: WhatsAppConfigStatus;
};

export function WhatsAppTestPanel({ initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [phone, setPhone] = useState(initialStatus.defaultTestPhone || "15556275106");
  const [result, setResult] = useState<HelloWorldTestResult | null>(null);
  const [pending, startTransition] = useTransition();

  const runTest = () => {
    setResult(null);
    startTransition(async () => {
      const res = await testWhatsAppHelloWorldAction(phone);
      setResult(res);
      const fresh = await getWhatsAppConfigStatusAction();
      setStatus(fresh);
    });
  };

  return (
    <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <Link
          href="/admin/settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "#64748b",
            textDecoration: "none",
            marginBottom: "20px",
          }}
        >
          <ArrowLeft size={14} /> Back to Settings
        </Link>

        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#16a34a",
              }}
            >
              <MessageCircle size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                WhatsApp API Test
              </h1>
              <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0" }}>
                Sends Meta&apos;s <code style={{ fontSize: "12px" }}>hello_world</code> template to verify your token and Phone Number ID.
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
            Configuration
          </h2>
          <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px 16px", margin: 0, fontSize: "13px" }}>
            <dt style={{ color: "#64748b" }}>API configured</dt>
            <dd style={{ margin: 0, fontWeight: 600, color: status.configured ? "#16a34a" : "#dc2626" }}>
              {status.configured ? "Yes" : "No — add env vars"}
            </dd>
            <dt style={{ color: "#64748b" }}>Test mode</dt>
            <dd style={{ margin: 0, fontWeight: 600, color: status.testMode ? "#d97706" : "#64748b" }}>
              {status.testMode
                ? "ON — lifecycle sends hello_world (WHATSAPP_TEST_MODE=true)"
                : "OFF — uses approved printec_* templates"}
            </dd>
            <dt style={{ color: "#64748b" }}>Sending enabled</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{status.enabled ? "Yes" : "No"}</dd>
            <dt style={{ color: "#64748b" }}>Phone Number ID</dt>
            <dd style={{ margin: 0, fontFamily: "monospace" }}>{status.phoneNumberId || "—"}</dd>
            <dt style={{ color: "#64748b" }}>WABA ID</dt>
            <dd style={{ margin: 0, fontFamily: "monospace" }}>{status.wabaId || "—"}</dd>
            <dt style={{ color: "#64748b" }}>Graph API</dt>
            <dd style={{ margin: 0 }}>{status.graphVersion}</dd>
          </dl>
        </div>

        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
            Send test message
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>
            Recipient must be added as a <strong>test number</strong> in Meta Developer Console → WhatsApp → API Setup.
          </p>

          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
            Test phone (E.164)
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="15556275106"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
              marginBottom: "16px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="button"
            onClick={runTest}
            disabled={pending || !status.configured}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: status.configured ? "#16a34a" : "#94a3b8",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: pending || !status.configured ? "not-allowed" : "pointer",
            }}
          >
            {pending ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
            {pending ? "Sending…" : "Send hello_world"}
          </button>
        </div>

        {result && (
          <div
            style={{
              background: result.ok ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${result.ok ? "#bbf7d0" : "#fecaca"}`,
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              {result.ok ? (
                <CheckCircle2 size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: result.ok ? "#166534" : "#991b1b" }}>
                  {result.ok ? "Message sent successfully" : "Send failed"}
                </p>
                {result.to && (
                  <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#475569" }}>
                    To: <code>{result.to}</code>
                  </p>
                )}
                {result.messageId && (
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Meta message ID: <code>{result.messageId}</code>
                  </p>
                )}
                {result.error && (
                  <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#991b1b" }}>{result.error}</p>
                )}
                {result.hint && (
                  <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#475569" }}>{result.hint}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
