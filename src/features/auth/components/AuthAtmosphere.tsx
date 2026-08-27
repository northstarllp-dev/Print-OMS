/** Shared print-shop atmosphere for public auth screens. */
export function AuthAtmosphere({
  intensity = "default",
}: {
  intensity?: "default" | "rich";
}) {
  const rich = intensity === "rich";
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: rich
            ? "radial-gradient(90% 70% at 8% 0%, #bfdbfe 0%, transparent 50%), radial-gradient(75% 55% at 100% 20%, #93c5fd 0%, transparent 46%), radial-gradient(80% 60% at 92% 100%, #fdba74 0%, transparent 48%), linear-gradient(160deg, #eef4ff 0%, #f8fafc 42%, #fff7ed 100%)"
            : "radial-gradient(110% 70% at 0% 0%, #dbeafe 0%, transparent 52%), radial-gradient(80% 60% at 100% 100%, #ffedd5 0%, transparent 48%), linear-gradient(165deg, #f8fafc 0%, #eef2f7 50%, #e8eef8 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.22] motion-reduce:opacity-12"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at center, black 18%, transparent 78%)",
        }}
      />
    </div>
  );
}
