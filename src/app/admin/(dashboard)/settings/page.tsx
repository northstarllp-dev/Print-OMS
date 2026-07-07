
import { SettingsViewNew } from "@/features/settings/components/SettingsViewNew";
import { getAppSettings } from "@/features/settings/actions/settingsActions";

export default async function SettingsPage() {
  const appSettings = await getAppSettings();
  return <SettingsViewNew initialAppSettings={appSettings} />;
}
