"use client";

import { Heart } from "lucide-react";
import { withBasePath } from "@/lib/appBasePath";

/** Platform branding — identical on every CLIENT_SLUG. Do not white-label. */
export const PLATFORM_HOME_URL = "https://www.printoms.thepolarislabs.com/";
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
      className={className}
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
      Made with{" "}
      {isGateway || isPortal ? (
        <Heart size={14} fill="#EF4444" color="#EF4444" />
      ) : (
        <span style={{ color: "#EF4444", fontSize: "14px" }}>❤️</span>
      )}{" "}
      by
      <img
        src={PLATFORM_LOGO_SRC}
        alt="Polaris"
        className={isGateway ? undefined : "h-8 lg:h-9 w-auto ml-0.5"}
        style={
          isGateway
            ? {
                height: "50px",
                marginLeft: "-2px",
                marginTop: "-16px",
                marginBottom: "-12px",
              }
            : isPortal
              ? { height: 28, marginLeft: 2 }
              : undefined
        }
      />
    </a>
  );
}
