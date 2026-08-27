"use client";

import React from "react";
import { productionFloorSignIn } from "@/features/auth/actions/authActions";
import { AuthLoginForm } from "@/features/auth/components/AuthLoginForm";

export default function ProductionLogin() {
  return (
    <AuthLoginForm
      portal="production"
      title="Production sign in"
      subtitle="Don’t wait on Drive links. Sign in to pull approved files and hit the date."
      emailId="production-email"
      passwordId="production-password"
      emailPlaceholder="production@example.com"
      submitLabel="Sign In to Production Portal"
      backHref="/"
      onSignIn={async (email, password) => {
        const res = await productionFloorSignIn(email, password);
        if (res.error) return { error: res.error };
        window.location.href = "/printoms/production/orders";
      }}
    />
  );
}
