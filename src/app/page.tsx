import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getStaffHomePath } from "@/features/orders/workspace/shared/stageGrants";
import { Shield, Users, ArrowRight, BarChart3, ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function RootGateway() {
  const profile = await getCurrentUser();

  if (profile) {
    const actor = {
      role: profile.role,
      staff_role: profile.staff_role ?? null,
      company_id: profile.company_id ?? null,
    };
    if (profile.role === "admin") {
      redirect("/admin/dashboard");
    }
    redirect(getStaffHomePath(actor));
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--background)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-sans)",
      padding: 24,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48, userSelect: "none" }}>
        <div style={{ width: 44, height: 44, background: "#0C0F1A", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, color: "var(--color-primary)" }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 20h18" />
            <path d="M5 20l-1.5 2.5" /><path d="M9 20l-1.5 2.5" /><path d="M13 20l-1.5 2.5" /><path d="M17 20l-1.5 2.5" />
            <path d="M6 20V11" />
            <circle cx="6" cy="11" r="1.2" fill="var(--color-primary)" />
            <path d="M6 11l6-4.5" />
            <circle cx="12" cy="6.5" r="1.2" fill="var(--color-primary)" />
            <path d="M12 6.5l5 3.5" />
            <path d="M17 10l1.2-1.8" /><path d="M16.2 10.8l1.2-1.8" /><path d="M18 9l-2-2" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "0.06em", lineHeight: 1 }}>NORTHSTAR</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, marginTop: 2, letterSpacing: "0.03em" }}>Operations Gateway</div>
        </div>
      </div>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 40, maxWidth: 480 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 10px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          Sign Fabrication Portal
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
          Select your access portal to authenticate and manage signage operations.
        </p>
      </div>

      {/* Portal Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, width: "100%", maxWidth: 1120 }}>

        {/* Admin Card */}
        <Link
          href="/admin/login"
          style={{
            background: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-2xl)",
            padding: "28px 24px",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.18s",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ width: 40, height: 40, background: "var(--color-primary)", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Shield size={18} color="white" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Admin Portal</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20, flex: 1 }}>
            Manage orders, review enquiries, coordinate teams, and oversee billing.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>
            Go to Admin Login <ArrowRight size={13} />
          </div>
        </Link>

        {/* Staff Card */}
        <Link
          href="/staff/login"
          style={{
            background: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-2xl)",
            padding: "28px 24px",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.18s",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ width: 40, height: 40, background: "var(--color-secondary)", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Users size={18} color="white" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Staff Portal</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20, flex: 1 }}>
            View your assigned tasks, upload site measurements, and update job status.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--color-secondary)" }}>
            Go to Staff Login <ArrowRight size={13} />
          </div>
        </Link>

        {/* Production Card */}
        <Link
          href="/production/login"
          style={{
            background: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-2xl)",
            padding: "28px 24px",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.18s",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ width: 40, height: 40, background: "#dbeafe", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <ClipboardList size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Production Floor</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20, flex: 1 }}>
            Dedicated workshop display for tenants with floor portals enabled. Staff at other clients use the Staff portal instead.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#0284c7" }}>
            Go to Production Login <ArrowRight size={13} />
          </div>
        </Link>

        {/* Installation Card */}
        <Link
          href="/installation/login"
          style={{
            background: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-2xl)",
            padding: "28px 24px",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.18s",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ width: 40, height: 40, background: "#dcfce7", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <ClipboardList size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Installation Floor</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20, flex: 1 }}>
            Dedicated on-site display for tenants with floor portals enabled. Staff at other clients use the Staff portal instead.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
            Go to Installation Login <ArrowRight size={13} />
          </div>
        </Link>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 32, marginTop: 48, padding: "16px 32px", background: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "none" }}>
        {[
          { icon: BarChart3, label: "Active Orders", value: "128+" },
          { icon: ClipboardList, label: "Site Visits", value: "08" },
          { icon: Users, label: "Team Members", value: "12" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon size={16} color="var(--text-secondary)" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
