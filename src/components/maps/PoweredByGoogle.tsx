"use client";

/**
 * Required Places Autocomplete (custom UI) attribution.
 * https://developers.google.com/maps/documentation/places/web-service/policies
 */
export function PoweredByGoogle({
  className = "",
  align = "end",
}: {
  className?: string;
  align?: "start" | "end" | "center";
}) {
  const justify =
    align === "start"
      ? "justify-start"
      : align === "center"
        ? "justify-center"
        : "justify-end";

  return (
    <div
      className={`flex items-center gap-1 ${justify} select-none ${className}`}
      aria-label="Powered by Google"
    >
      <span className="text-[10px] font-medium text-slate-400">Powered by</span>
      <span className="text-[11px] font-bold tracking-tight leading-none" aria-hidden>
        <span style={{ color: "#4285F4" }}>G</span>
        <span style={{ color: "#EA4335" }}>o</span>
        <span style={{ color: "#FBBC05" }}>o</span>
        <span style={{ color: "#4285F4" }}>g</span>
        <span style={{ color: "#34A853" }}>l</span>
        <span style={{ color: "#EA4335" }}>e</span>
      </span>
    </div>
  );
}
