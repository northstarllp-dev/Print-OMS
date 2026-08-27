"use client";

import React from "react";
import { staffSignIn } from "@/features/auth/actions/authActions";
import { AuthLoginForm } from "@/features/auth/components/AuthLoginForm";

export function StaffLoginForm() {
  return (
    <AuthLoginForm
      portal="staff"
      title="Staff sign in"
      subtitle="Skip the group chat. Sign in for today’s jobs, sites, and files."
      emailId="staff-email"
      passwordId="staff-password"
      emailPlaceholder="staff@example.com"
      submitLabel="Sign In to Staff Portal"
      backHref="/"
      onSignIn={async (email, password) => {
        const res = await staffSignIn(email, password);
        if (res.error) return { error: res.error };
        window.location.href = "/printoms";
      }}
    />
  );
}
