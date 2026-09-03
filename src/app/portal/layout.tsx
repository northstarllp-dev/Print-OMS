import type { Metadata } from "next";
import { portalDisplayName } from "@/app/portal/utils/portalBrandName";
import { loadClientConfig } from "@/config/loadClientConfig";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";

/**
 * Customer portal link previews (WhatsApp / iMessage / Slack) scrape this route.
 * Must NOT inherit root "Admin Operations Dashboard" title that confuses customers.
 */
export async function generateMetadata(): Promise<Metadata> {
  const config = loadClientConfig();
  const baseUrl = await getRequestBaseUrl();
  const origin = baseUrl.replace(/\/$/, "");

  const iconFolder = config.faviconUrl
    ? config.faviconUrl.replace(/\/[^/]+$/, "")
    : null;

  // WhatsApp crops OG images to a square. Prefer the 512×512 PWA icon (logo
  // already padded into a square). Wide brand logos (e.g. 992×251) get clipped
  // to a center crop and look broken in previews.
  const ogImagePath =
    (iconFolder ? `${iconFolder}/android-chrome-512x512.png` : null) ||
    config.logoUrl;

  const ogImageAbs = ogImagePath
    ? `${origin}/printoms${ogImagePath}`
    : undefined;

  const displayName = portalDisplayName();
  const title = `${displayName} Customer Portal`;
  const description = `Track your ${displayName} order, review site visits, quotations, designs, and payments in the customer portal.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: displayName,
      ...(ogImageAbs
        ? {
            images: [
              {
                url: ogImageAbs,
                width: 512,
                height: 512,
                alt: `${displayName} logo`,
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
