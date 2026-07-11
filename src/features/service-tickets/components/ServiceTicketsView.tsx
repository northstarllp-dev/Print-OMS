"use client";

import React from "react";
import { Eye, Plus, SendHorizontal } from "lucide-react";
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
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>
            Service Tickets
          </h1>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "14px" }}>
            Queue of customer support tickets linked to existing orders.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
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

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #e2e8f0" }}>
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
            }}
          />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={thStyle}>DATE CREATED</th>
              <th style={thStyle}>TICKET</th>
              <th style={thStyle}>CUSTOMER / BUSINESS</th>
              <th style={thStyle}>PHONE</th>
              <th style={thStyle}>PROBLEM</th>
              <th style={thStyle}>STATUS</th>
              <th style={{ ...thStyle, textAlign: "center" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((ticket) => (
              <tr
                key={ticket.id}
                onClick={() => {
                  void openTicket(ticket.id);
                }}
                style={{
                  borderBottom: "1px solid #e2e8f0",
                  cursor: "pointer",
                }}
              >
                <td style={tdStyle} suppressHydrationWarning>{new Date(ticket.created_at).toLocaleDateString()}</td>
                <td style={tdStyle}>{ticket.ticket_id}</td>
                <td style={tdStyle}>
                  {(ticket.customer_name || "-") + " / " + (ticket.customer_business_name || "-")}
                </td>
                <td style={tdStyle}>{ticket.phone}</td>
                <td style={tdStyle}>{truncate(ticket.description, 80)}</td>
                <td style={tdStyle}>{ticket.status}</td>
                <td style={{ ...tdStyle, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => {
                        void openTicket(ticket.id);
                      }}
                      style={{
                        padding: "8px 10px",
                        background: "#fff",
                        color: "#334155",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <Eye size={14} />
                      View Ticket
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
                          padding: "8px 10px",
                          background: "#0f766e",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <SendHorizontal size={14} />
                        Send to Service Manager
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredTickets.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "28px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No service tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
  padding: "14px 16px",
  textAlign: "left",
  fontSize: "11px",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: "13px",
  color: "#334155",
  verticalAlign: "top",
};

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

