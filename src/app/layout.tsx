import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { GlobalNavigationLoader } from "@/components/ui/GlobalNavigationLoader";
import { ClientThemeProvider } from "@/components/ui/ClientThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

import { loadClientConfig } from "@/config/loadClientConfig";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export async function generateMetadata(): Promise<Metadata> {
  const config = loadClientConfig();

  // Derive apple-touch-icon path from faviconUrl directory
  const iconFolder = config.faviconUrl
    ? config.faviconUrl.replace(/\/[^/]+$/, "")
    : null;

  return {
    title: `${config.name} Admin Operations Dashboard`,
    description: "Operations dashboard for custom signage and order management.",
    // Use the full URL including basePath — Next.js does NOT auto-prepend basePath for manifest
    manifest: "/printoms/api/manifest",
    icons: {
      ...(config.faviconUrl || config.logoUrl
        ? { icon: `/printoms${config.faviconUrl || config.logoUrl}` }
        : {}),
      ...(iconFolder
        ? { apple: `/printoms${iconFolder}/apple-touch-icon.png` }
        : {}),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", "font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <style>{`
          .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        `}</style>
        {/* Explicit manifest link — required for PWA installability. Metadata API alone is unreliable with basePath. */}
        <link rel="manifest" href="/printoms/api/manifest" />
      </head>
      <body suppressHydrationWarning className={`${inter.variable} font-sans min-h-full bg-[var(--color-background)] antialiased`}>
        <ClientThemeProvider />
        <GlobalNavigationLoader />
        {children}
      </body>
    </html>
  );
}
