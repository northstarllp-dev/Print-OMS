"use client";

import { Heart } from "lucide-react";
import { withBasePath } from "@/lib/appBasePath";

/** Platform branding identical on every CLIENT_SLUG. Do not white-label. */
export const PLATFORM_HOME_URL = "https://www.printops.thepolarislabs.com/";
export const PLATFORM_LOGO_SRC = withBasePath("/clients/light%20withoutbg.png");

type PlatformMadeWithLoveProps = {
  /** gateway = large heart+logo; sidebar = compact emoji style */
  variant?: "gateway" | "sidebar" | "portal";
  className?: string;
  style?: React.CSSProperties;
};

export function PlatformMadeWithLove({
  variant = "sidebar",
  className,
  style,
}: PlatformMadeWithLoveProps) {
  const isGateway = variant === "gateway";
  const isPortal = variant === "portal";

  return (
    <a
      href={PLATFORM_HOME_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={["polaris-mwl", className].filter(Boolean).join(" ")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontWeight: 600,
        margin: 0,
        color: "inherit",
        textDecoration: "none",
        cursor: "pointer",
        transition: "opacity 0.15s ease",
        pointerEvents: "auto",
        ...style,
      }}
    >
      <span className="polaris-mwl-text polaris-mwl-text-a">
        <span className="polaris-mwl-text-base">Made with</span>
        <span className="polaris-mwl-text-shine" aria-hidden="true">
          Made with
        </span>
      </span>
      <span className="polaris-mwl-heart">
        {isGateway || isPortal ? (
          <Heart size={14} fill="#EF4444" color="#EF4444" />
        ) : (
          <span style={{ color: "#EF4444", fontSize: "14px", lineHeight: 1 }}>
            ❤️
          </span>
        )}
      </span>
      <span className="polaris-mwl-text polaris-mwl-text-b">
        <span className="polaris-mwl-text-base">by</span>
        <span className="polaris-mwl-text-shine" aria-hidden="true">
          by
        </span>
      </span>
      <span
        className="polaris-mwl-logo-wrap"
        style={{ ["--mwl-logo" as string]: `url("${PLATFORM_LOGO_SRC}")` }}
      >
        <img
          src={PLATFORM_LOGO_SRC}
          alt="Polaris"
          className={!isGateway ? "h-8 lg:h-9 w-auto" : undefined}
          style={
            isGateway
              ? {
                  height: "50px",
                  marginTop: "-16px",
                  marginBottom: "-12px",
                }
              : isPortal
                ? { height: 28 }
                : undefined
          }
        />
      </span>
    </a>
  );
}
