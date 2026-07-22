"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PrintomsLoading } from "@/components/ui/PrintomsLoading";

function NavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && anchor.href) {
        try {
          const currentUrl = new URL(window.location.href);
          const targetUrl = new URL(anchor.href, window.location.href);

          const isInternal = targetUrl.hostname === currentUrl.hostname;
          const isDifferentPath =
            targetUrl.pathname !== currentUrl.pathname ||
            targetUrl.search !== currentUrl.search;
          const targetAttribute = anchor.getAttribute("target");

          const isHashLink =
            targetUrl.pathname === currentUrl.pathname &&
            targetUrl.hash !== currentUrl.hash;
          const isDownload = anchor.hasAttribute("download");

          if (
            isInternal &&
            isDifferentPath &&
            targetAttribute !== "_blank" &&
            !isHashLink &&
            !isDownload
          ) {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 5000);
          }
        } catch {
          // Ignore URL parsing errors
        }
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  if (!isLoading) return null;

  return <PrintomsLoading fullScreen />;
}

export function GlobalNavigationLoader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  );
}
