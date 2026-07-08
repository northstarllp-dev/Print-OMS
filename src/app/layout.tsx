import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalNavigationLoader } from "@/components/ui/GlobalNavigationLoader";
import { ClientThemeProvider } from "@/components/ui/ClientThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Printoms Admin Operations Dashboard",
  description: "Operations dashboard for custom signage and order management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <style>{`
          .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        `}</style>
      </head>
      <body suppressHydrationWarning className={`${inter.variable} font-sans min-h-full bg-[var(--color-background)] antialiased`}>
        <ClientThemeProvider />
        <GlobalNavigationLoader />
        {children}
      </body>
    </html>
  );
}
