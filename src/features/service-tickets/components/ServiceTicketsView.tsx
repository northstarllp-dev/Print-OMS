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
    <div className="p-3 sm:p-4 md:p-8 bg-slate-50 min-h-screen">
      {/* ─── Header ─── */}
      <div className="mb-5 md:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-slate-900 m-0">
            Service Tickets
          </h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500 m-0">
            Queue of customer support tickets linked to existing orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center shrink-0">
          {isAdmin && <CopyLinkButton companyId={companyId} />}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-[12px] sm:text-[13px] font-bold"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Service Ticket</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Table Card ─── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-wrap gap-2 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket, customer, phone, description..."
            className="w-full sm:max-w-[380px] flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-[13px] outline-none"
          />
          <button
            title="Reset Filters"
            type="button"
            onClick={() => setSearch("")}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 h-[39px] bg-red-50 border border-red-200 rounded-lg text-red-600 font-semibold text-[13px] shrink-0"
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden p-3 space-y-2.5 min-h-[200px] bg-slate-50/80">
          {filteredTickets.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-slate-500 font-medium bg-white rounded-xl border border-slate-200">
              <Wrench size={28} className="text-slate-300 mx-auto mb-2" />
              No service tickets found.
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const statusStyle = getTicketStatusStyle(ticket.status);
              return (
                <div
                  key={ticket.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="flex">
                    <div className="w-1 shrink-0 self-stretch" style={{ background: statusStyle.text }} aria-hidden />
                    <div className="flex-1 min-w-0 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono text-[13px] font-extrabold text-slate-900">
                              {ticket.ticket_id}
                            </span>
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: statusStyle.bg, color: statusStyle.text }}
                            >
                              {statusStyle.label}
                            </span>
                          </div>
                          <div className="text-[13px] font-semibold text-slate-800 truncate mt-1">
                            {ticket.customer_name || ticket.customer_business_name || "—"}
                          </div>
                          {ticket.customer_name && ticket.customer_business_name ? (
                            <div className="text-[11px] text-slate-500 truncate">{ticket.customer_business_name}</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        {new Date(ticket.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {ticket.phone ? ` · ${ticket.phone}` : ""}
                      </div>
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => void openTicket(ticket.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] font-bold text-slate-700"
                        >
                          <Eye size={13} />
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto min-h-[200px]">
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

