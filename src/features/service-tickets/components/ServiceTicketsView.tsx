"use client";

import React from "react";
import { Eye, Plus, SendHorizontal, Wrench, RefreshCw } from "lucide-react";
import {
  getTicketById,
  sendToServiceManagerAction,
  type ServiceTicketRecord,
} from "@/features/service-tickets/actions/serviceTicketActions";
import { CreateServiceTicketModal } from "./CreateServiceTicketModal";
import { ServiceTicketDetailModal } from "./ServiceTicketDetailModal";
import { CopyLinkButton } from "./CopyLinkButton";

interface ServiceTicketsViewProps {
  initialTickets: ServiceTicketRecord[];
  companyId: string;
  isAdmin: boolean;
  canManage: boolean;
}

const getTicketStatusStyle = (status: string): { bg: string; text: string; label: string } => {
  switch (status) {
    case "open":
      return { bg: "#fef3c7", text: "#b45309", label: "Open" };
    case "with_service_manager":
      return { bg: "#ccfbf1", text: "#0f766e", label: "With Service Manager" };
    case "closed":
      return { bg: "#dcfce7", text: "#15803d", label: "Closed" };
    default:
      return { bg: "#f1f5f9", text: "#64748b", label: status };
  }
};

export function ServiceTicketsView({
  initialTickets,
  companyId,
  isAdmin,
  canManage,
}: ServiceTicketsViewProps) {
  const [tickets, setTickets] = React.useState<ServiceTicketRecord[]>(initialTickets);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = React.useState<ServiceTicketRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  async function refreshTicket(ticketId: string) {
    const fresh = await getTicketById(ticketId);
    if (!fresh) return;
    setTickets((prev) => prev.map((t) => (t.id === fresh.id ? fresh : t)));
    setSelectedTicket(fresh);
  }

  async function openTicket(ticketId: string) {
    const detail = await getTicketById(ticketId);
    setSelectedTicket(detail);
  }

  const filteredTickets = tickets.filter((ticket) => {
    const text = search.toLowerCase();
    if (!text) return true;
    return (
      ticket.ticket_id.toLowerCase().includes(text) ||
      (ticket.customer_name || "").toLowerCase().includes(text) ||
      (ticket.customer_business_name || "").toLowerCase().includes(text) ||
      ticket.phone.toLowerCase().includes(text) ||
      ticket.description.toLowerCase().includes(text)
    );
  });

  return (
    <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh" }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>
            Service Tickets
          </h1>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "14px" }}>
            Queue of customer support tickets linked to existing orders.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {isAdmin && <CopyLinkButton companyId={companyId} />}
          {isAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              style={{
                padding: "10px 14px",
                background: "var(--color-primary)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <Plus size={16} />
              Add Service Ticket
            </button>
          )}
        </div>
      </div>

      {/* ─── Table Card ─── */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
        {/* Search */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket, customer, phone, description..."
            style={{
              width: "100%",
              maxWidth: "380px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "13px",
              outline: "none",
            }}
          />
          <button
            title="Reset Filters"
            onClick={() => setSearch("")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              cursor: "pointer",
              color: "#dc2626",
              outline: "none",
              height: "39px",
              transition: "all 0.2s",
              fontWeight: "600",
              fontSize: "13px",
              gap: "6px",
              flexShrink: 0
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.borderColor = "#fca5a5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; }}
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", minHeight: "200px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <th style={thStyle}>DATE</th>
                <th style={thStyle}>TICKET</th>
                <th style={thStyle}>CUSTOMER</th>
                <th style={thStyle}>PHONE</th>
                <th style={thStyle}>PROBLEM</th>
                <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
                <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => {
                const statusStyle = getTicketStatusStyle(ticket.status);
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => void openTicket(ticket.id)}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={tdStyle} suppressHydrationWarning>
                      {new Date(ticket.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>
                        {ticket.ticket_id}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "13px" }}>
                        {ticket.customer_name || "-"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                        {ticket.customer_business_name || "-"}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: "13px", color: "#475569" }}>{ticket.phone}</span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: "240px" }}>
                      <span style={{ fontSize: "13px", color: "#475569", lineHeight: "1.4" }}>
                        {truncate(ticket.description, 60)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          flexWrap: "nowrap",
                        }}
                      >
                        <button
                          onClick={() => void openTicket(ticket.id)}
                          style={{
                            padding: "7px 10px",
                            background: "#fff",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.15s",
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; }}
                        >
                          <Eye size={13} />
                          View
                        </button>
                        {isAdmin && ticket.status === "open" && (
                          <button
                            disabled={loadingId === ticket.id}
                            onClick={async () => {
                              setLoadingId(ticket.id);
                              try {
                                await sendToServiceManagerAction(ticket.id);
                                setTickets((prev) =>
                                  prev.map((t) =>
                                    t.id === ticket.id
                                      ? { ...t, status: "with_service_manager" }
                                      : t
                                  )
                                );
                              } finally {
                                setLoadingId(null);
                              }
                            }}
                            style={{
                              padding: "7px 10px",
                              background: "#0f766e",
                              color: "#fff",
                              border: "none",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              cursor: loadingId === ticket.id ? "wait" : "pointer",
                              opacity: loadingId === ticket.id ? 0.7 : 1,
                              whiteSpace: "nowrap",
                              transition: "all 0.15s",
                            }}
                            onMouseOver={(e) => { if (loadingId !== ticket.id) e.currentTarget.style.background = "#115e59"; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = "#0f766e"; }}
                          >
                            <SendHorizontal size={13} />
                            Send to Manager
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 20px", textAlign: "center" }}>
                    <Wrench size={28} style={{ color: "#cbd5e1", margin: "0 auto 8px" }} />
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0, fontWeight: 600 }}>
                      No service tickets found.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <CreateServiceTicketModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => window.location.reload()}
        />
      )}

      {selectedTicket && (
        <ServiceTicketDetailModal
          key={selectedTicket.id}
          ticket={selectedTicket}
          canManage={canManage}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => {
            if (selectedTicket) {
              void refreshTicket(selectedTicket.id);
            }
          }}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "14px 20px",
  textAlign: "left",
  fontSize: "11px",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 20px",
  fontSize: "13px",
  color: "#334155",
  verticalAlign: "middle",
};

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

