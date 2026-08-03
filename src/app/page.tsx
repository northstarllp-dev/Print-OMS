import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getStaffHomePath } from "@/features/orders/workspace/shared/stageGrants";
import { Shield, Users, ArrowRight, BarChart3, ClipboardList } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { PlatformMadeWithLove } from "@/components/ui/PlatformMadeWithLove";
import { InstallPwaButton } from "@/components/pwa/InstallPwaButton";

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
      <div style={{ marginBottom: 48, userSelect: "none", display: "flex", justifyContent: "center" }}>
        <Logo height={80} width={400} />
      </div>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 40, maxWidth: 520 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 10px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          Operations management portal for signage business
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
          Select your access portal to authenticate and manage signage operations.
          A comprehensive operations management software for streamlining signage and fabrication workflows.
        </p>
      </div>

      {/* Portal Cards */}
      <div className="flex flex-col sm:flex-row justify-center items-stretch gap-6 w-full max-w-5xl">

        {/* Admin Card */}
        <Link
          href="/admin/login"
          className="w-full sm:w-[320px]"
          style={{
            background: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-2xl)",
            padding: "28px 24px",
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.18s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ width: 40, height: 40, background: "var(--color-primary)", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Shield size={18} color="var(--color-on-primary)" />
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
          className="w-full sm:w-[320px]"
          style={{
            background: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-2xl)",
            padding: "28px 24px",
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.18s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ width: 40, height: 40, background: "var(--color-secondary)", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Users size={18} color="var(--color-on-secondary)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Staff Portal</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20, flex: 1 }}>
            View your assigned tasks, upload site measurements, and update job status.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--color-secondary)" }}>
            Go to Staff Login <ArrowRight size={13} />
          </div>
        </Link>

      </div>

      {/* PWA Install Button */}
      <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
        <InstallPwaButton />
      </div>

      {/* Footer */}
      <div style={{ marginTop: 80, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
        <PlatformMadeWithLove variant="gateway" />
      </div>

    </div>
  );
}
