import { getAppSettings, getCompanyDetails } from "@/features/settings/actions/settingsActions";
import { SettingsPageClient } from "./SettingsPageClient";

export default async function SettingsPage() {
  const [appSettings, companyDetails] = await Promise.all([
    getAppSettings(),
    getCompanyDetails(),
  ]);

  return (
    <SettingsPageClient
      initialAppSettings={appSettings}
      companyDetails={companyDetails}
    />
  );
}
