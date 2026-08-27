"use client";

import React from "react";
import { installationFloorSignIn } from "@/features/auth/actions/authActions";
import { AuthLoginForm } from "@/features/auth/components/AuthLoginForm";
import { withBasePath } from "@/lib/appBasePath";

export default function InstallationLogin() {
  return (
    <AuthLoginForm
      portal="installation"
      title="Installation sign in"
      subtitle="Don’t roll out blind. Sign in for site details, photos, and close-out."
      emailId="installation-email"
      passwordId="installation-password"
      emailPlaceholder="installation@example.com"
      submitLabel="Sign In to Installation Portal"
      backHref="/"
      onSignIn={async (email, password) => {
        const res = await installationFloorSignIn(email, password);
        if (res.error) return { error: res.error };
        window.location.href = withBasePath("/installation/orders");
      }}
    />
  );
}
