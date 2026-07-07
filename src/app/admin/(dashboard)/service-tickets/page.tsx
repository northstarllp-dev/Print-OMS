import { Ticket } from "lucide-react";

export default function AdminServiceTicketsPage() {
  return (
    <div style={{ padding: "32px" }}>
      <div
        style={{
          maxWidth: 560,
          margin: "48px auto 0",
          textAlign: "center",
          padding: "48px 32px",
          background: "white",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 16px",
            borderRadius: "14px",
            background: "#EEF2FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6366F1",
          }}
        >
          <Ticket size={28} />
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800, color: "#0F172A" }}>
          Service Tickets
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: "#64748B", lineHeight: 1.6 }}>
          Post-installation support and service requests will be managed here. Coming soon.
        </p>
      </div>
    </div>
  );
}
