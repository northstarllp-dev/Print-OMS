"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { adminSignIn } from "@/features/auth/actions/authActions";
import { Logo } from "@/components/ui/Logo";

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await adminSignIn(email, password);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else {
        window.location.href = "/printoms/admin/dashboard";
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
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
        <div style={{ marginBottom: 28 }}>
          <Logo height={36} align="left" />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
          Admin Sign In
        </h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 28px" }}>
          Authenticate to access the operations dashboard.
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
              id="admin-email"
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="prt-input"
              placeholder="admin@printoms.com"
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 6, letterSpacing: "0.03em" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="admin-password"
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
            style={{ width: "100%", justifyContent: "center", padding: "10px 16px", fontSize: 14, marginTop: 4 }}
          >
            {loading ? "Signing in..." : "Sign In to Admin Portal"}
          </button>
        </form>



        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => window.location.href = "/printoms"}
            style={{ fontSize: 12, color: "#94A3B8", background: "none", border: "none", cursor: "pointer" }}
          >
            ← Back to portal select
          </button>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 24, textAlign: "center", width: "100%", fontSize: 13, color: "#64748B", pointerEvents: "none" }}>
        <a
          href="https://www.thepolarislabs.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontWeight: 600,
            margin: 0,
            color: "inherit",
            textDecoration: "none",
            cursor: "pointer",
            transition: "opacity 0.15s ease",
            pointerEvents: "auto",
          }}
        >
          Made with <span style={{ color: "#EF4444", fontSize: "14px" }}>❤️</span> by
          <img
            src="/printoms/clients/light%20withoutbg.png"
            alt="Polaris"
            style={{ height: "50px", marginLeft: "-2px", marginTop: "-16px", marginBottom: "-12px" }}
          />
        </a>
      </div>
    </div>
  );
}
