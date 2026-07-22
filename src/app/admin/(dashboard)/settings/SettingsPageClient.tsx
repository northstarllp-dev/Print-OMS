"use client";

import dynamic from "next/dynamic";

const SettingsViewNew = dynamic(
  () =>
    import("@/features/settings/components/SettingsViewNew").then(
      (m) => m.SettingsViewNew
    ),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: "32px", color: "#64748b", fontSize: "14px", fontWeight: 600 }}>
        Loading settings…
      </div>
    ),
  }
);

export function SettingsPageClient({
  initialAppSettings,
  companyDetails,
}: {
  initialAppSettings: any;
  companyDetails: any;
}) {
  return (
    <SettingsViewNew
      initialAppSettings={initialAppSettings}
      companyDetails={companyDetails}
    />
  );
}
