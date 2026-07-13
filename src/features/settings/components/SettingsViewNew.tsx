"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Save, MoreVertical, Bell, Lock, Palette, MessageCircle, Calendar, Key, X } from "lucide-react";
import { updateAppSettings, AppSettings } from "@/features/settings/actions/settingsActions";
import { updateUserPassword } from "@/features/auth/actions/authActions";

interface SettingsViewNewProps {
  initialAppSettings?: AppSettings;
}

export function SettingsViewNew({ initialAppSettings }: SettingsViewNewProps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [settings, setSettings] = useState({
    companyName: "Printoms",
    email: "admin@printoms.com",
    phone: "+91 98765 12345",
    address: "123 Business Park, Tech City",
    notifications: true,
    twoFactorAuth: true,
    theme: "light",
    siteVisitSchedulingEnabled: initialAppSettings?.siteVisitSchedulingEnabled ?? true,
    installationSchedulingEnabled: initialAppSettings?.installationSchedulingEnabled ?? true,
  });

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "error" | "success">("idle");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");

  const sections = [
    {
      title: "General Settings",
      icon: <Palette size={20} />,
      description: "Manage your business information and preferences",
      fields: [
        { label: "Company Name", key: "companyName", type: "text" },
        { label: "Email Address", key: "email", type: "email" },
        { label: "Phone Number", key: "phone", type: "tel" },
        { label: "Business Address", key: "address", type: "text" },
      ],
    },
    {
      title: "Customer Portal",
      icon: <Calendar size={20} />,
      description: "Control what customers can do in their portal",
      fields: [
        { label: "Site Visit Self-Scheduling", key: "siteVisitSchedulingEnabled", type: "toggle", description: "Allow customers to book their site visit slots." },
        { label: "Installation Self-Scheduling", key: "installationSchedulingEnabled", type: "toggle", description: "Allow customers to book their installation slots." },
      ],
    },
  ];

  const handleChange = async (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
    if (key === "siteVisitSchedulingEnabled" || key === "installationSchedulingEnabled") {
      try {
        await updateAppSettings({ [key]: value });
      } catch (e) {
        console.error("Failed to save app settings", e);
        // revert local state on failure
        setSettings({ ...settings, [key]: !value });
      }
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus("error");
      setPasswordErrorMsg("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus("error");
      setPasswordErrorMsg("Password must be at least 6 characters");
      return;
    }
    
    setPasswordStatus("saving");
    try {
      const res = await updateUserPassword(newPassword);
      if (res.error) {
        setPasswordStatus("error");
        setPasswordErrorMsg(res.error);
      } else {
        setPasswordStatus("success");
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setNewPassword("");
          setConfirmPassword("");
          setPasswordStatus("idle");
        }, 1500);
      }
    } catch (err: any) {
      setPasswordStatus("error");
      setPasswordErrorMsg(err.message || "An error occurred");
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>
            Settings
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Configure your account settings and preferences
          </p>
        </div>

        <Link
          href="/admin/settings/notifications"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "20px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                background: "#dcfce7",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#16a34a",
              }}
            >
              <MessageCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>WhatsApp API Test</div>
              <div style={{ fontSize: "13px", color: "#64748b" }}>
                Send hello_world to verify Meta credentials
              </div>
            </div>
          </div>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-primary)" }}>Open →</span>
        </Link>

        {/* Settings Sections */}
        {sections.map((section, idx) => (
          <div
            key={idx}
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "20px",
            }}
          >
            {/* Section Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ width: "40px", height: "40px", background: "#f1f5f9", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
                {section.icon}
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                  {section.title}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  {section.description}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div style={{ display: "grid", gap: "16px" }}>
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "6px", display: "block" }}>
                    {field.label}
                  </label>
                  {field.type === "toggle" ? (
                    <button
                      onClick={() => handleChange(field.key, !settings[field.key as keyof typeof settings])}
                      style={{
                        position: "relative",
                        width: "48px",
                        height: "26px",
                        background: settings[field.key as keyof typeof settings] ? "var(--color-primary)" : "#cbd5e1",
                        border: "none",
                        borderRadius: "9999px",
                        cursor: "pointer",
                        transition: "background 0.3s ease",
                        padding: 0,
                        outline: "none",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: settings[field.key as keyof typeof settings] ? "24px" : "2px",
                          width: "22px",
                          height: "22px",
                          background: "white",
                          borderRadius: "50%",
                          transition: "left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)"
                        }}
                      />
                    </button>
                  ) : (
                    <input
                      type={field.type}
                      value={settings[field.key as keyof typeof settings] as string}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        transition: "all 0.2s",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#94a3b8";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(148, 163, 184, 0.1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

          </div>
        ))}

        {/* Security Section */}
        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ width: "40px", height: "40px", background: "#fef2f2", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
              <Key size={20} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                Security & Login
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Manage your password and authentication settings
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>Account Password</div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>Change the password you use to log in</div>
            </div>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              style={{
                padding: "8px 16px",
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0f172a",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
            >
              Change Password
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={() => {
            setSaveStatus("saving");
            setTimeout(() => {
              setSaveStatus("saved");
              setTimeout(() => setSaveStatus("idle"), 3000);
            }, 800);
          }}
          disabled={saveStatus === "saving"}
          style={{
            width: "100%",
            padding: "14px",
            background: saveStatus === "saved" ? "#10b981" : "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "700",
            cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.3s",
            opacity: saveStatus === "saving" ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (saveStatus !== "saved") e.currentTarget.style.background = "var(--color-primary-container)";
          }}
          onMouseLeave={(e) => {
            if (saveStatus !== "saved") e.currentTarget.style.background = "var(--color-primary)";
          }}
        >
          {saveStatus === "saving" ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>Saving...</span>
          ) : saveStatus === "saved" ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>✓ Settings Saved</span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><Save size={16} /> Save Settings</span>
          )}
        </button>
      </div>

      {/* Floating Notification Toast */}
      <div style={{
        position: "fixed",
        bottom: saveStatus === "saved" ? "32px" : "-100px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#0f172a",
        color: "white",
        padding: "12px 24px",
        borderRadius: "9999px",
        fontSize: "14px",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        transition: "bottom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        zIndex: 50
      }}>
        <div style={{ width: "20px", height: "20px", background: "#10b981", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        Settings successfully saved!
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "white", borderRadius: "12px", width: "100%", maxWidth: "400px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", padding: "24px"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Change Password</h2>
              <button onClick={() => setIsPasswordModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "6px", display: "block" }}>New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px"
                  }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "6px", display: "block" }}>Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px"
                  }}
                  required
                />
              </div>

              {passwordStatus === "error" && (
                <div style={{ fontSize: "13px", color: "#ef4444", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px" }}>
                  {passwordErrorMsg}
                </div>
              )}
              {passwordStatus === "success" && (
                <div style={{ fontSize: "13px", color: "#10b981", background: "#dcfce7", padding: "8px 12px", borderRadius: "6px" }}>
                  Password updated successfully!
                </div>
              )}

              <button 
                type="submit" 
                disabled={passwordStatus === "saving" || passwordStatus === "success"}
                style={{
                  width: "100%", padding: "12px", background: "var(--color-primary)", color: "white", border: "none",
                  borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginTop: "8px",
                  opacity: (passwordStatus === "saving" || passwordStatus === "success") ? 0.7 : 1
                }}
              >
                {passwordStatus === "saving" ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
