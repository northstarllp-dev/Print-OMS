"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { productionFloorSignIn } from "@/features/auth/actions/authActions";

export default function ProductionLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("production@printoms.co.in");
  const [password, setPassword] = useState("productionpass");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await productionFloorSignIn(email, password);
      if (res.error) {
        setError(res.error);
      } else {
        router.push("/production/orders");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-sans)",
      padding: 24,
    }}>
      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "white",
        borderRadius: 16,
        border: "1px solid #E2E8F0",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        padding: "36px 36px 32px",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, background: "#0284c7", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, color: "white" }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", letterSpacing: "0.05em" }}>NORTHSTAR</div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>Production Portal</div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
          Production Sign In
        </h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 28px" }}>
          Authenticate to track and manage active fabrication orders.
        </p>

        {error && (
          <div style={{ marginBottom: 18, padding: "10px 14px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, fontSize: 13, color: "#BE123C", fontWeight: 600 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 6, letterSpacing: "0.03em" }}>
              Email Address
            </label>
            <input
              id="production-email"
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="prt-input"
              placeholder="production@printoms.co.in"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 6, letterSpacing: "0.03em" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="production-password"
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="prt-input"
                placeholder="••••••••"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: 0 }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="prt-btn prt-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "10px 16px", fontSize: 14, marginTop: 4, background: "#0284c7" }}
          >
            {loading ? "Signing in..." : "Sign In to Production Portal"}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: "14px 16px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Demo Credentials
          </div>
          <div style={{ fontSize: 12, fontFamily: "monospace", color: "#0F172A", marginBottom: 10, background: "white", border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 10px" }}>
            production@printoms.co.in / productionpass
          </div>
          <button
            type="button"
            onClick={() => { setEmail("production@printoms.co.in"); setPassword("productionpass"); setError(""); }}
            style={{ fontSize: 12, color: "#0284c7", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
          >
            Quick fill credentials →
          </button>
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{ fontSize: 12, color: "#94A3B8", background: "none", border: "none", cursor: "pointer" }}
          >
            ← Back to portal select
          </button>
        </div>
      </div>
    </div>
  );
}
