import { NextResponse } from "next/server";
import { loadClientConfig } from "@/config/loadClientConfig";

export async function GET() {
  const config = loadClientConfig();

  // Prefer dedicated favicon_io set; fall back to a single logo PNG for install icons.
  // Chrome requires at least 192 + 512 icons — empty icons blocks PWA install.
  const iconFolder = config.faviconUrl
    ? config.faviconUrl.replace(/\/[^/]+$/, "")
    : null;

  const logoSrc = config.logoUrl ? `/printoms${config.logoUrl}` : null;

  const icons = iconFolder
    ? [
        {
          src: `/printoms${iconFolder}/android-chrome-192x192.png`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `/printoms${iconFolder}/android-chrome-512x512.png`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `/printoms${iconFolder}/android-chrome-512x512.png`,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: `/printoms${iconFolder}/apple-touch-icon.png`,
          sizes: "180x180",
          type: "image/png",
        },
      ]
    : logoSrc
      ? [
          { src: logoSrc, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: logoSrc, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: logoSrc, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ]
      : [];

  const manifest = {
    name: config.name,
    short_name: config.name,
    description: `${config.name} — Operations Management`,
    // start_url and scope should match the Next.js basePath exactly
    start_url: "/printoms",
    scope: "/printoms",
    display: "standalone",
    background_color: config.colors?.background || "#ffffff",
    theme_color: config.colors?.primary || "#000000",
    icons,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      // No caching — manifest reflects live client config
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
