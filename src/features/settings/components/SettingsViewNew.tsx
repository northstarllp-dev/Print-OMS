"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Save, MoreVertical, Bell, Lock, Palette, ArrowRight, CreditCard } from "lucide-react";

export function SettingsViewNew() {
  const [settings, setSettings] = useState({
    companyName: "Printoms",
    email: "admin@printoms.com",
    phone: "+91 98765 12345",
    address: "123 Business Park, Tech City",
    notifications: true,
    twoFactorAuth: true,
    theme: "light",
  });

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
      title: "Notifications",
      icon: <Bell size={20} />,
      description: "Control how you receive alerts and updates",
      fields: [
        { label: "Email Notifications", key: "notifications", type: "toggle" },
      ],
    },
    {
      title: "Payment Gates",
      icon: <CreditCard size={20} />,
      description:
        "Choose which stages show the “Is payment required before the next stage?” popup",
      fields: [] as { label: string; key: string; type: string }[],
      link: {
        href: "/admin/settings/payments",
        label: "Configure payment gate stages",
      },
    },
    {
      title: "Security",
      icon: <Lock size={20} />,
      description: "Manage your account security and access",
      fields: [
        { label: "Two-Factor Authentication", key: "twoFactorAuth", type: "toggle" },
      ],
    },
  ];

  const handleChange = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
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
                        padding: "8px 16px",
                        background: settings[field.key as keyof typeof settings] ? "var(--color-primary)" : "#e2e8f0",
                        color: settings[field.key as keyof typeof settings] ? "white" : "#475569",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "12px",
                        transition: "all 0.2s",
                      }}
                    >
                      {settings[field.key as keyof typeof settings] ? "Enabled" : "Disabled"}
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

            {"link" in section && section.link && (
              <Link
                href={section.link.href}
                style={{
                  marginTop: "16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "var(--color-primary)",
                  textDecoration: "none",
                }}
              >
                {section.link.label} <ArrowRight size={14} />
              </Link>
            )}
          </div>
        ))}

        {/* Save Button */}
        <button
          style={{
            width: "100%",
            padding: "14px",
            background: "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "700",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-primary-container)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--color-primary)";
          }}
        >
          <Save size={16} /> Save Settings
        </button>
      </div>
    </div>
  );
}
