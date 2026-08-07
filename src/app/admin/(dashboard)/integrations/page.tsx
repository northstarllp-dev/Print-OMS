import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";

export const metadata = {
  title: "Integrations | Admin",
};

export default function AdminIntegrationsPage() {
  return (
    <ComingSoonPage
      title="Integrations"
      description="Connect Meta Ads, WhatsApp, Google leads, and other inbound channels to your enquiry pipeline."
      icon="plug"
    />
  );
}
