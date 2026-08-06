import type { Metadata } from "next";
import { loadClientConfig } from "@/config/loadClientConfig";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";

/**
 * Customer portal link previews (WhatsApp / iMessage / Slack) scrape this route.
 * Must NOT inherit root "Admin Operations Dashboard" title — that confuses customers.
 */
export async function generateMetadata(): Promise<Metadata> {
  const config = loadClientConfig();
  const baseUrl = await getRequestBaseUrl();
  const origin = baseUrl.replace(/\/$/, "");

  const iconFolder = config.faviconUrl
    ? config.faviconUrl.replace(/\/[^/]+$/, "")
    : null;

  // Prefer brand logo (higher quality) for link previews — favicon.ico looks pixelated in WhatsApp.
  // Fall back to 512×512 PWA icon when no logo is configured.
  const ogImagePath =
    config.logoUrl ||
    (iconFolder ? `${iconFolder}/android-chrome-512x512.png` : null);

  const ogImageAbs = ogImagePath
    ? `${origin}/printoms${ogImagePath}`
    : undefined;

  const title = `${config.name} Customer Portal`;
  const description = `Track your ${config.name} order, review site visits, quotations, designs, and payments in the customer portal.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: config.name,
      ...(ogImageAbs
        ? {
            images: [
              {
                url: ogImageAbs,
                width: 512,
                height: 512,
                alt: `${config.name} logo`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(ogImageAbs ? { images: [ogImageAbs] } : {}),
    },
  };
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
