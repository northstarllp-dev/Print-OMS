"use client";

import React from "react";
import { adminSignIn } from "@/features/auth/actions/authActions";
import { AuthLoginForm } from "@/features/auth/components/AuthLoginForm";
import { withBasePath } from "@/lib/appBasePath";

export default function AdminLogin() {
  return (
    <AuthLoginForm
      portal="admin"
      title="Admin sign in"
      subtitle="Stop hunting status. Sign in to see stuck jobs, money, and the floor."
      emailId="admin-email"
      passwordId="admin-password"
      emailPlaceholder="admin@example.com"
      submitLabel="Sign In to Admin Portal"
      backHref="/"
      onSignIn={async (email, password) => {
        const res = await adminSignIn(email, password);
        if (res.error) return { error: res.error };
        window.location.href = withBasePath("/admin/dashboard");
      }}
    />
  );
}
