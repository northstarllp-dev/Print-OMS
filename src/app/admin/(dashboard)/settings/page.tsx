
import { SettingsViewNew } from "@/features/settings/components/SettingsViewNew";
import { getAppSettings, getCompanyDetails } from "@/features/settings/actions/settingsActions";

export default async function SettingsPage() {
  const [appSettings, companyDetails] = await Promise.all([
    getAppSettings(),
    getCompanyDetails()
  ]);
  
  return (
    <SettingsViewNew 
      initialAppSettings={appSettings} 
      companyDetails={companyDetails} 
    />
  );
}
