"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/Logo";

function NavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Navigation completed
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
          const isDifferentPath = targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search;
          const targetAttribute = anchor.getAttribute("target");
          
          // Avoid triggering on purely hash links or download links
          const isHashLink = targetUrl.pathname === currentUrl.pathname && targetUrl.hash !== currentUrl.hash;
          const isDownload = anchor.hasAttribute("download");
          
          if (isInternal && isDifferentPath && targetAttribute !== "_blank" && !isHashLink && !isDownload) {
            setIsLoading(true);
            
            // Failsafe to turn off the loader if navigation gets aborted or takes too long
            setTimeout(() => setIsLoading(false), 5000);
          }
        } catch (err) {
          // Ignore URL parsing errors
        }
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm transition-opacity duration-300">
      <div className="animate-pulse flex items-center justify-center drop-shadow-xl">
        <Logo width={400} height={100} align="center" />
      </div>
    </div>
  );
}

export function GlobalNavigationLoader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  );
}
