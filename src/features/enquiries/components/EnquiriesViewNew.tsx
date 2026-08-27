"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Search, Filter, Plus, AlertCircle, CheckCircle, Clock, Phone, X, Check, Calendar, ChevronLeft, ChevronRight, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { AddEnquiryModal, EnquiryFormData } from "./AddEnquiryModal";
import { ConvertEnquiryModal } from "./ConvertEnquiryModal";
import { AssignTeamModal } from "./AssignTeamModal";
import { mapEnquiryFormToInsert } from "@/features/enquiries/enquiryFormLogic";
import {
  computeEnquiryKpis,
  countActiveEnquiryFilters,
  filterEnquiries,
  healthMenuActions,
  paginateEnquiries,
  requiresLostReasonPrompt,
  requiresHoldFollowUpPrompt,
} from "@/features/enquiries/enquiryListLogic";
import { ListPagination, LIST_PAGE_SIZE } from "@/components/ui/ListPagination";
import { HoldFollowUpModal } from "@/features/calendar/components/HoldFollowUpModal";
import {
  canConvertEnquiry,
} from "@/features/enquiries/enquiryConvertLogic";
import { shouldOpenAssignTeamAfterConvert } from "@/features/enquiries/enquiryAssignLogic";
import { getBusinessOperation } from "@/features/orders/businessOperations";
import { BusinessOperationCaption } from "@/features/orders/components/BusinessOperationCaption";
import { createEnquiry, updateEnquiry, deleteEnquiryAction, convertEnquiryToOrderAction, updateEnquiryHealthAction } from "@/features/enquiries/actions/enquiryActions";
import { CustomerMessageModal, CustomerMessageInfo } from "@/features/notifications/customer-message/CustomerMessageModal";
import type { CustomerMessageKey } from "@/features/notifications/customer-message/templates";

const getStatusColor = (status: string) => {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    "Pending": { bg: "#dcfce7", text: "#16a34a", label: "PENDING" },
    "Contacted": { bg: "#dbeafe", text: "#0284c7", label: "CONTACTED" },
    "Quoted": { bg: "#fef3c7", text: "#ea580c", label: "QUOTED" },
    "Converted": { bg: "#dcfce7", text: "#16a34a", label: "CONVERTED" },
  };
  return colors[status] || colors["Pending"];
};

// Success Modal component
function SuccessModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.4)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      padding: "20px"
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "400px",
        padding: "24px",
        textAlign: "center",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
      }}>
        <div style={{
          width: "56px",
          height: "56px",
          background: "#dcfce7",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px"
        }}>
          <Check size={32} style={{ color: "#16a34a" }} />
        </div>
        <h2 style={{
          fontSize: "18px",
          fontWeight: "800",
          color: "#0f172a",
          margin: "0 0 8px"
        }}>{title}</h2>
        <p style={{
          fontSize: "14px",
          color: "#64748b",
          margin: "0 0 20px"
        }}>{message}</p>
        <button onClick={onClose} style={{
          width: "100%",
          padding: "10px 16px",
          background: "var(--color-primary)",
          border: "none",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "700",
          color: "white",
          cursor: "pointer",
          transition: "all 0.2s"
        }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-primary-container)"} onMouseLeave={(e) => e.currentTarget.style.background = "var(--color-primary)"}>Okay</button>
      </div>
    </div>
  );
}

function LostReasonModal({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  
  if (!isOpen) return null;
  
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 400, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 16px" }}>Mark as Lost</h2>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Reason for lost enquiry</label>
          <textarea 
            value={reason} 
            onChange={(e) => setReason(e.target.value)}
            placeholder="E.g., Price too high, chose competitor..."
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, outline: "none", minHeight: 80, resize: "vertical" }}
            autoFocus
          />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 16px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => { if(reason.trim()) { onSubmit(reason); setReason(""); } else { alert("Reason is required."); } }} style={{ flex: 1, padding: "10px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Mark Lost</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function EnquiriesViewNew({
  initialEnquiries,
  initialCustomers,
  canEdit = true,
  canViewOrder = true,
  orderBasePath = "/admin/orders",
}: {
  initialEnquiries: any[];
  initialCustomers: any[];
  canEdit?: boolean;
  canViewOrder?: boolean;
  orderBasePath?: string;
}) {
  const [enquiries, setEnquiries] = useState(initialEnquiries);
  const [customers, setCustomers] = useState(initialCustomers);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  
  // Custom Date Range Filter States
  const [dateFilterType, setDateFilterType] = useState<"all" | "range">("range");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [addedByFilter, setAddedByFilter] = useState("All");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const availableAddedBy = useMemo(() => {
    const creatorsSet = new Set<string>();
    enquiries.forEach(e => {
      creatorsSet.add(e.addedBy || "Admin");
    });
    return Array.from(creatorsSet).sort();
  }, [enquiries]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [assignTeamModalOpen, setAssignTeamModalOpen] = useState(false);
  const [assignedOrderId, setAssignedOrderId] = useState("");
  const [selectedEnquiry, setSelectedEnquiry] = useState<{
    id: string;
    businessName: string;
    leadName: string;
    notes?: string;
    businessOperation?: string;
  } | null>(null);

  // Customer message popup (templated copy / WhatsApp / email)
  const [customerMsg, setCustomerMsg] = useState<{
    key: CustomerMessageKey;
    info: CustomerMessageInfo;
    closeLabel?: string;
    afterClose?: "assignTeam";
  } | null>(null);
  // Message queued to open after the success modal closes
  const [pendingCustomerMsg, setPendingCustomerMsg] = useState<{
    key: CustomerMessageKey;
    info: CustomerMessageInfo;
  } | null>(null);

  // Success modal states
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState({ title: "", message: "" });
  
  // Lost reason modal state
  const [lostReasonModalData, setLostReasonModalData] = useState<{enquiryId: string} | null>(null);
  const [holdModalEnquiryId, setHoldModalEnquiryId] = useState<string | null>(null);
  const [editingEnquiry, setEditingEnquiry] = useState<{ id: string; formData: EnquiryFormData } | null>(null);
  const [deletingEnquiryId, setDeletingEnquiryId] = useState<string | null>(null);

  const canEditEnquiry = (enq: any) => canEdit && !enq.orderId && enq.status !== "Converted";
  const canDeleteEnquiry = (enq: any) => canEdit && !enq.orderId && enq.status !== "Converted";

  const openEditModal = (enq: any) => {
    setEditingEnquiry({
      id: enq.id,
      formData: {
        businessName: enq.businessName || "",
        leadName: enq.leadName || "",
        phone: enq.phone || "",
        whatsappNumber: enq.whatsapp || "",
        email: enq.email || "",
        primaryMode: (enq.primaryCommunicationMode === "MAIL" ? "email" : "whatsapp") as any,
        source: enq.source || "Meta Ads",
        notes: enq.notes || "",
        location: enq.location || "",
        businessOperation: enq.businessOperation || "signage",
      },
    });
  };

  const handleEditEnquiry = async (data: EnquiryFormData) => {
    if (!editingEnquiry) return;
    try {
      const payload: Record<string, unknown> = {
        lead_name: data.leadName,
        business_name: data.businessName,
        phone: data.phone.replace(/\s/g, ""),
        whatsapp: data.whatsappNumber.replace(/\s/g, ""),
        email: data.email,
        source: data.source,
        notes: data.notes,
        primary_communication_mode: data.primaryMode === "whatsapp" ? "WHATSAPP" : "MAIL",
        location: data.location,
        business_operation: data.businessOperation || "signage",
      };
      await updateEnquiry(editingEnquiry.id, payload);
      setEnquiries((prev) =>
        prev.map((e) =>
          e.id === editingEnquiry.id
            ? {
                ...e,
                leadName: data.leadName,
                businessName: data.businessName,
                phone: data.phone,
                whatsapp: data.whatsappNumber,
                email: data.email,
                source: data.source,
                notes: data.notes,
                primaryCommunicationMode: data.primaryMode === "whatsapp" ? "WHATSAPP" : "MAIL",
                location: data.location,
                businessOperation: data.businessOperation,
              }
            : e
        )
      );
      setEditingEnquiry(null);
    } catch (err: any) {
      alert(err.message || "Failed to update enquiry");
    }
  };

  const handleDeleteEnquiry = async (id: string) => {
    try {
      await deleteEnquiryAction(id);
      setEnquiries((prev) => prev.filter((e) => e.id !== id));
      setDeletingEnquiryId(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete enquiry");
      setDeletingEnquiryId(null);
    }
  };

  const handleAddEnquiry = async (data: EnquiryFormData) => {
    try {
      const newEnq = mapEnquiryFormToInsert(data);
      const result = await createEnquiry(newEnq);
      if (result && result[0]) {
        const mapped = {
          id: result[0].id,
          dateReceived: result[0].date_received,
          leadName: result[0].lead_name,
          businessName: result[0].business_name || result[0].lead_name,
          phone: result[0].phone,
          whatsapp: result[0].whatsapp,
          email: result[0].email,
          source: result[0].source,
          status: result[0].status,
          notes: result[0].notes,
          primaryCommunicationMode: result[0].primary_communication_mode,
          location: result[0].location,
          enquireId: result[0].enquire_id,
          addedBy: result[0].added_by
        };
        setEnquiries([mapped, ...enquiries]);
        setIsAddModalOpen(false);
        setSuccessModalData({
          title: "Enquiry Created Successfully!",
          message: `Enquiry for ${data.businessName} has been added to the system. (Enquiry ID: ${mapped.enquireId || mapped.id})`
        });
        setSuccessModalOpen(true);
        setPendingCustomerMsg({
          key: "enquiry_received",
          info: {
            businessName: mapped.businessName || mapped.leadName || "Customer",
            phone: mapped.whatsapp || mapped.phone || "",
            email: mapped.email || "",
            enquiryNo: mapped.enquireId || "",
          },
        });
      }
    } catch (error) {
      console.error("Error adding enquiry:", error);
      alert("Failed to add enquiry. Check console.");
    }
  };
  
  const convertEnquiryToOrderLocal = async (enquiryId: string, clientName: string, businessName: string, productType?: string, requirements?: string, assignedAdmins?: string[]) => {
    try {
      const res = await convertEnquiryToOrderAction(enquiryId, clientName, businessName, productType, requirements, assignedAdmins);
      if (res && res.success) {
        setEnquiries(prev => prev.map(e => e.id === enquiryId ? { 
          ...e, 
          status: "Converted",
          customerId: res.customerId,
          orderId: res.orderId
        } : e));
        return res;
      }
    } catch (err: any) {
      console.error("Conversion failed", err);
      alert(err.message || "Failed to convert enquiry to order.");
    }
    return null;
  };

  const getHealthBadgeColor = (health: string) => {
    const colors: Record<string, string> = {
      Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
      "Needs Attention": "bg-amber-50 text-amber-700 border-amber-200",
      "On Hold": "bg-slate-50 text-slate-600 border-slate-200",
      Lost: "bg-red-50 text-red-700 border-red-200",
    };
    return colors[health] || "bg-slate-100 text-slate-600 border-slate-200";
  };

  const applyEnquiryHealth = async (
    enquiryId: string,
    health: string,
    promptReason?: string,
    hold?: { note: string; reachOutAt: string } | null
  ) => {
    try {
      if (requiresHoldFollowUpPrompt(health) && !hold) {
        setHoldModalEnquiryId(enquiryId);
        return;
      }
      let lostReason = promptReason || null;
      if (requiresLostReasonPrompt(health, promptReason)) {
        setLostReasonModalData({ enquiryId });
        return;
      }
      
      // Optimistic update
      setEnquiries((prev) =>
        prev.map((e) =>
          e.id === enquiryId
            ? {
                ...e,
                health,
                lostReason: health === "Lost" ? lostReason : null,
                holdNote: health === "On Hold" ? hold?.note ?? null : null,
                reachOutAt: health === "On Hold" ? hold?.reachOutAt ?? null : null,
              }
            : e
        )
      );
      
      await updateEnquiryHealthAction(
        enquiryId,
        health,
        lostReason,
        health === "On Hold" ? hold : null
      );
    } catch (err: any) {
      alert(err.message || "Failed to update enquiry health");
    }
  };

  const { total: totalEnquiries, pending: pendingResponses, converted: convertedCount, conversionRate } =
    computeEnquiryKpis(enquiries);

  const stats = [
    {
      label: "TOTAL ENQUIRIES",
      value: totalEnquiries.toString(),
      change: "All time",
      filterKey: "total",
      icon: AlertCircle,
      color: "#3b82f6",
    },
    {
      label: "PENDING RESPONSES",
      value: pendingResponses.toString(),
      change: "Requires action",
      filterKey: "pending",
      icon: Clock,
      color: "#f59e0b",
    },
    {
      label: "CONVERTED",
      value: convertedCount.toString(),
      change: "Total successful orders",
      filterKey: "converted",
      icon: CheckCircle,
      color: "#06b6d4",
    },
    {
      label: "CONVERSION RATE",
      value: `${conversionRate}%`,
      change: "Based on all enquiries",
      filterKey: null,
      icon: CheckCircle,
      color: "var(--color-success)",
    },
  ];

  const filteredEnquiries = useMemo(() => {
    return filterEnquiries(enquiries, {
      search: debouncedSearchTerm,
      sourceFilter,
      addedByFilter,
      healthFilter,
      selectedKpi,
      dateFilterType: dateFilterType as "range" | "all",
      startDate,
      endDate,
    });
  }, [enquiries, debouncedSearchTerm, sourceFilter, addedByFilter, healthFilter, selectedKpi, dateFilterType, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearchTerm,
    sourceFilter,
    addedByFilter,
    healthFilter,
    selectedKpi,
    dateFilterType,
    startDate,
    endDate,
  ]);

  const pagedEnquiries = useMemo(
    () => paginateEnquiries(filteredEnquiries, page, LIST_PAGE_SIZE),
    [filteredEnquiries, page]
  );
  const pageEnquiries = pagedEnquiries.items;

  const resetFilters = () => {
    setDateFilterType("range");
    setStartDate("");
    setEndDate("");
    setAddedByFilter("All");
    setSourceFilter("All");
    setHealthFilter("ALL");
    setSearchTerm("");
    setSelectedKpi(null);
    setPage(1);
  };

  const activeFilterCount = countActiveEnquiryFilters({
    sourceFilter,
    addedByFilter,
    healthFilter,
    startDate,
    endDate,
    selectedKpi,
  });

  const openConvert = (enq: any) => {
    setSelectedEnquiry({
      id: enq.id,
      businessName: enq.businessName || enq.leadName,
      leadName: enq.leadName,
      notes: enq.notes,
      businessOperation: enq.businessOperation || "signage",
    });
    setConvertModalOpen(true);
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 bg-slate-50 min-h-0 pb-6">
      {/* Header Section */}
      <div className="mb-5 md:mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4 md:mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-slate-900 m-0 mb-1 md:mb-2">
              Enquiries Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 m-0">
              Track and manage incoming customer enquiries and leads
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-[13px] font-semibold text-white bg-[var(--color-primary)] rounded-lg"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={16} /> New Enquiry
            </button>
          ) : null}
        </div>

        {/* Mobile KPI chips */}
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {stats.map((stat: any) => {
            const isActive = stat.filterKey && selectedKpi === stat.filterKey;
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => stat.filterKey && setSelectedKpi(isActive ? null : stat.filterKey)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors"
                style={{
                  background: isActive ? `${stat.color}14` : "white",
                  borderColor: isActive ? stat.color : "#e2e8f0",
                  color: isActive ? stat.color : "#64748b",
                  cursor: stat.filterKey ? "pointer" : "default",
                }}
              >
                <span>{stat.label}</span>
                <span
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                  style={{
                    background: isActive ? stat.color : "#f1f5f9",
                    color: isActive ? "white" : "#475569",
                  }}
                >
                  {stat.value}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop Stats Cards */}
        <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat: any, idx) => {
            const Icon = stat.icon;
            const isActive = stat.filterKey && selectedKpi === stat.filterKey;
            return (
              <div
                key={idx}
                onClick={() => stat.filterKey && setSelectedKpi(isActive ? null : stat.filterKey)}
                style={{
                  background: isActive ? `${stat.color}12` : "white",
                  border: isActive ? `2px solid ${stat.color}` : "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: isActive ? "19px" : "20px",
                  transition: "all 0.2s",
                  cursor: stat.filterKey ? "pointer" : "default",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (stat.filterKey && !isActive) {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: isActive ? stat.color : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {stat.label}
                  </span>
                  <div style={{ width: "32px", height: "32px", background: `${stat.color}15`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} style={{ color: stat.color }} />
                  </div>
                </div>
                <div style={{ fontSize: "28px", fontWeight: "800", color: isActive ? stat.color : "#0f172a", marginBottom: "8px" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "12px", color: isActive ? stat.color : "#64748b", opacity: isActive ? 0.85 : 1 }}>
                  {stat.change}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-visible">
        {/* Search & Filter Bar Orders-style */}
        <div className="p-3 sm:p-4 border-b border-slate-200">
          {/* Mobile / tablet: search + Filters chip + icon reset */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search enquiries…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-[34px] pr-8 py-2.5 border border-slate-200 rounded-full text-[13px] outline-none focus:border-[var(--color-primary)] bg-slate-50"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className={`relative shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border text-[12px] font-bold transition-colors ${
                activeFilterCount > 0
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              title="Reset filters"
              onClick={resetFilters}
              className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-full bg-red-50 border border-red-200 text-red-600"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {mobileFiltersOpen &&
            createPortal(
            <div className="lg:hidden fixed inset-0 z-[200]">
              <button
                type="button"
                aria-label="Close filters"
                className="absolute inset-0 bg-slate-900/40"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] max-h-[85dvh] flex-col overscroll-contain rounded-t-2xl bg-white shadow-xl">
                <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-slate-100 rounded-t-2xl">
                  <h3 className="text-sm font-extrabold text-slate-900">Filters</h3>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Source</label>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                    >
                      <option value="All">All Sources</option>
                      <option value="Meta Ads">Meta Ads</option>
                      <option value="Referrals">Referrals</option>
                      <option value="Walk-ins">Walk-ins</option>
                      <option value="Google Enquiry (Ph Call)">Google Enquiry (Ph Call)</option>
                      <option value="Website">Website</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Health</label>
                    <select
                      value={healthFilter}
                      onChange={(e) => setHealthFilter(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                    >
                      <option value="ALL">All Health States</option>
                      <option value="Active">Active</option>
                      <option value="Needs Attention">Needs Attention</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Added by</label>
                    <select
                      value={addedByFilter}
                      onChange={(e) => setAddedByFilter(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                    >
                      <option value="All">All Added By</option>
                      {availableAddedBy.map((creator) => (
                        <option key={creator} value={creator}>{creator}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Date range</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setDateFilterType("range");
                          setStartDate(e.target.value);
                        }}
                        className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700"
                      />
                      <span className="text-[12px] text-slate-400 font-medium">to</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setDateFilterType("range");
                          setEndDate(e.target.value);
                        }}
                        className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 px-4 py-3 border-t border-slate-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 bg-white"
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="flex-[1.4] py-3 rounded-xl bg-slate-900 text-white text-[13px] font-bold"
                  >
                    Show results
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Desktop: inline filters */}
          <div className="hidden lg:flex flex-row flex-wrap gap-3 items-center">
            <div className="flex-1 relative min-w-[12rem]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search enquiries…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-[34px] pr-8 py-2.5 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[var(--color-primary)] focus:ring-[3px] focus:ring-[rgba(30,64,175,0.1)]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600"
            >
              <option value="All">All Sources</option>
              <option value="Meta Ads">Meta Ads</option>
              <option value="Referrals">Referrals</option>
              <option value="Walk-ins">Walk-ins</option>
              <option value="Google Enquiry (Ph Call)">Google Enquiry (Ph Call)</option>
              <option value="Website">Website</option>
            </select>

            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600"
            >
              <option value="ALL">All Health States</option>
              <option value="Active">Active</option>
              <option value="Needs Attention">Needs Attention</option>
              <option value="On Hold">On Hold</option>
              <option value="Lost">Lost</option>
            </select>

            <select
              value={addedByFilter}
              onChange={(e) => setAddedByFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600"
            >
              <option value="All">All Added By</option>
              {availableAddedBy.map((creator) => (
                <option key={creator} value={creator}>{creator}</option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDateFilterType("range");
                  setStartDate(e.target.value);
                }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-600"
              />
              <span className="text-[13px] text-slate-500 font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDateFilterType("range");
                  setEndDate(e.target.value);
                }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-600"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setDateFilterType("all");
                  }}
                  className="flex items-center justify-center bg-white border border-slate-200 rounded-lg cursor-pointer text-slate-400 p-2.5"
                  title="Clear Dates"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              title="Reset Filters"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-[13px] font-semibold shrink-0 hover:bg-red-100"
            >
              <RefreshCw size={14} />
              Reset
            </button>
          </div>
        </div>

        {/* Mobile inbox cards */}
        <div className="lg:hidden p-3 space-y-2.5 min-h-[200px] bg-slate-50/80">
          {filteredEnquiries.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-slate-500 font-medium bg-white rounded-xl border border-slate-200">
              No enquiries found matching your search.
            </div>
          ) : (
            pageEnquiries.map((enq) => {
              const statusColor = getStatusColor(enq.status);
              const dateStr = enq.dateReceived
                ? new Date(enq.dateReceived).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                : "";
              return (
                <div
                  key={enq.id}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="flex">
                    <div className="w-1 shrink-0 self-stretch" style={{ background: statusColor.text }} aria-hidden />
                    <div className="flex-1 min-w-0 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[13px] font-extrabold text-slate-900">
                              {enq.enquireId || enq.id.substring(0, 8)}
                            </span>
                            <span
                              className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold"
                              style={{ background: statusColor.bg, color: statusColor.text }}
                            >
                              {statusColor.label}
                            </span>
                            <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-bold border ${getHealthBadgeColor(enq.health || 'Active')}`}>
                              {enq.health || 'Active'}
                            </span>
                            {enq.health === 'Lost' && enq.lostReason && (
                              <span className="inline-block text-[10px] text-red-600 font-medium truncate max-w-[120px]" title={enq.lostReason}>
                                ({enq.lostReason})
                              </span>
                            )}
                          </div>
                          <BusinessOperationCaption opId={enq.businessOperation} />
                          <div className="text-[13px] font-semibold text-slate-800 truncate mt-1">
                            {enq.businessName || enq.leadName}
                          </div>
                          {enq.businessName && enq.leadName ? (
                            <div className="text-[11px] text-slate-500 truncate">{enq.leadName}</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-medium">{dateStr}</span>
                        <span>{enq.phone}</span>
                        {enq.source ? <span>· {enq.source}</span> : null}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {canEditEnquiry(enq) && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(enq)}
                              className="px-2.5 py-1.5 rounded-md text-[12px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap inline-flex items-center gap-1"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingEnquiryId(enq.id)}
                              className="px-2.5 py-1.5 rounded-md text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 whitespace-nowrap inline-flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </>
                        )}
                        {canConvertEnquiry(enq.status) ? (
                          canEdit ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openConvert(enq)}
                                className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white bg-[var(--color-primary)] whitespace-nowrap"
                              >
                                Convert to Order
                              </button>
                              <div className="relative group/health-mobile">
                                <button
                                  type="button"
                                  className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap"
                                >
                                  Update Health
                                </button>
                                <div className="absolute left-0 bottom-full mb-1 w-40 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover/health-mobile:opacity-100 group-hover/health-mobile:visible transition-all z-20">
                                  <div className="py-1">
                                    {healthMenuActions(enq.health || 'Active').map((action) => (
                                      <button
                                        key={action.health}
                                        type="button"
                                        onClick={() => applyEnquiryHealth(enq.id, action.health)}
                                        className="w-full text-left px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                      >
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span
                              className="px-3 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap"
                              style={{ background: statusColor.bg, color: statusColor.text }}
                            >
                              {statusColor.label}
                            </span>
                          )
                        ) : enq.orderId ? (
                          canViewOrder ? (
                            <Link
                              href={`${orderBasePath}/${enq.orderId}`}
                              className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap"
                            >
                              View Order
                            </Link>
                          ) : (
                            <span
                              title="You do not have access to view orders."
                              className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 whitespace-nowrap cursor-not-allowed opacity-70"
                            >
                              View Order
                            </span>
                          )
                        ) : (
                          <span className="text-[12px] font-bold text-emerald-600 whitespace-nowrap">Converted</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 10 }}>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ENQUIRY ID</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>DATE</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>BUSINESS / LEAD NAME</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>PHONE</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>SOURCE</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>HEALTH</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>REQ NOTES</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ADDED BY</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ORDER ID</th>
                <th style={{ padding: "14px 20px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pageEnquiries.map((enq) => {
                return (
                  <tr key={enq.id} style={{ borderBottom: "1px solid #e2e8f0", transition: "background 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a", fontWeight: "700" }}>
                      <div>{enq.enquireId || enq.id.substring(0, 8)}</div>
                      <BusinessOperationCaption opId={enq.businessOperation} />
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#64748b", fontWeight: "500" }}>{new Date(enq.dateReceived).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>
                      <div style={{ fontWeight: "700" }}>{enq.businessName}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{enq.leadName}</div>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>{enq.phone}</td>
                    <td style={{ padding: "16px 20px", fontSize: "12px", color: "#64748b" }}>{enq.source}</td>
                    <td style={{ padding: "16px 20px" }}>
                      <div className="flex flex-row gap-2 items-center">
                        <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-bold border ${getHealthBadgeColor(enq.health || 'Active')}`}>
                          {enq.health || 'Active'}
                        </span>
                        {canConvertEnquiry(enq.status) && canEdit && (
                          <div className="relative group/health">
                            <button type="button" className="text-[10px] whitespace-nowrap text-slate-400 hover:text-slate-600 font-semibold underline decoration-slate-300 underline-offset-2">
                              Update
                            </button>
                            <div className="absolute left-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover/health:opacity-100 group-hover/health:visible transition-all z-20">
                              <div className="py-1">
                                {healthMenuActions(enq.health || 'Active').map((action) => (
                                  <button
                                    key={action.health}
                                    type="button"
                                    onClick={() => applyEnquiryHealth(enq.id, action.health)}
                                    className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {enq.health === 'Lost' && enq.lostReason && (
                          <span className="text-[11px] text-red-600 font-medium truncate max-w-[150px]" title={enq.lostReason}>
                            ({enq.lostReason})
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={enq.notes || "No notes"}>
                      {enq.notes || <span style={{color: "#94a3b8", fontStyle: "italic"}}>No notes</span>}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                      {enq.addedBy || "Admin"}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>
                      {enq.orderId ? (
                        <span style={{ fontWeight: "700", color: "#0f172a" }}>{enq.orderId}</span>
                      ) : (
                        <span style={{ color: "#cbd5e1" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                        {canEditEnquiry(enq) && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(enq)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors"
                              title="Edit enquiry"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingEnquiryId(enq.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                              title="Delete enquiry"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                        {canConvertEnquiry(enq.status) ? (
                          canEdit ? (
                          <button 
                            onClick={() => openConvert(enq)}
                            style={{ padding: "6px 12px", background: "var(--color-primary)", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", color: "white", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-primary-container)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "var(--color-primary)"}
                          >
                            Convert to Order
                          </button>
                          ) : (
                            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>
                              {getStatusColor(enq.status).label}
                            </span>
                          )
                        ) : enq.orderId ? (
                          canViewOrder ? (
                            <Link
                              href={`${orderBasePath}/${enq.orderId}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "6px 12px",
                                background: "#f1f5f9",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#475569",
                                textDecoration: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#e2e8f0";
                                e.currentTarget.style.color = "#0f172a";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#f1f5f9";
                                e.currentTarget.style.color = "#475569";
                              }}
                            >
                              View Order
                            </Link>
                          ) : (
                            <span
                              title="You do not have access to view orders."
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "6px 12px",
                                background: "#f1f5f9",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#94a3b8",
                                cursor: "not-allowed",
                                whiteSpace: "nowrap",
                              }}
                            >
                              View Order
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", whiteSpace: "nowrap" }}>Converted</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEnquiries.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                    No enquiries found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={pagedEnquiries.page}
          totalPages={pagedEnquiries.totalPages}
          total={pagedEnquiries.total}
          pageSize={pagedEnquiries.pageSize}
          onPageChange={setPage}
          itemLabel="enquiries"
        />
      </div>
      
      {canEdit ? (
        <AddEnquiryModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddEnquiry}
        />
      ) : null}

      {canEdit && selectedEnquiry ? (
        <ConvertEnquiryModal
          isOpen={convertModalOpen}
          onClose={() => {
            setConvertModalOpen(false);
            setSelectedEnquiry(null);
          }}
          defaultClientName={selectedEnquiry.leadName || ""}
          defaultBusinessName={selectedEnquiry.businessName || ""}
          defaultRequirements={selectedEnquiry.notes || ""}
          businessOperationLabel={
            getBusinessOperation(selectedEnquiry.businessOperation || "signage").label
          }
          businessOperationId={selectedEnquiry.businessOperation || "signage"}
          onSubmit={async (clientName, businessName, productType, requirements, assignedAdmins) => {
            const enq = enquiries.find(e => e.id === selectedEnquiry.id);
            const res = await convertEnquiryToOrderLocal(selectedEnquiry.id, clientName, businessName, productType, requirements, assignedAdmins);
            setConvertModalOpen(false);
            
            if (res && res.success) {
              setCustomerMsg({
                key: "order_created",
                info: {
                  customerId: res.customerId,
                  orderId: res.orderId,
                  orderNo: res.orderId,
                  businessName: enq?.businessName || enq?.leadName || "Customer",
                  phone: enq?.whatsapp || enq?.phone || "",
                  email: enq?.email || "",
                },
                closeLabel: "Assign Employees",
                afterClose: "assignTeam",
              });
            }
            setSelectedEnquiry(null);
          }}
        />
      ) : null}

      {customerMsg && (
        <CustomerMessageModal
          isOpen
          templateKey={customerMsg.key}
          info={customerMsg.info}
          closeLabel={customerMsg.closeLabel}
          onClose={() => {
            const { afterClose, info } = customerMsg;
            setCustomerMsg(null);
            if (shouldOpenAssignTeamAfterConvert(afterClose)) {
              setAssignedOrderId(info.orderId || "");
              setAssignTeamModalOpen(true);
            }
          }}
        />
      )}

      {assignTeamModalOpen && (
        <AssignTeamModal 
          isOpen={assignTeamModalOpen}
          orderId={assignedOrderId}
          onClose={() => {
            setAssignTeamModalOpen(false);
            setSuccessModalData({
              title: "Order Converted & Team Assigned!",
              message: `Enquiry has been successfully converted to an order, welcome message sent, and team assignment skipped/completed.`
            });
            setSuccessModalOpen(true);
          }}
          onSuccess={() => {
            setAssignTeamModalOpen(false);
            setSuccessModalData({
              title: "Order Converted & Team Assigned!",
              message: `Enquiry has been successfully converted to an order, welcome message sent, and team assigned successfully.`
            });
            setSuccessModalOpen(true);
          }}
        />
      )}

      {successModalOpen && (
        <SuccessModal
          title={successModalData.title}
          message={successModalData.message}
          onClose={() => {
            setSuccessModalOpen(false);
            if (pendingCustomerMsg) {
              setCustomerMsg(pendingCustomerMsg);
              setPendingCustomerMsg(null);
            }
          }}
        />
      )}

      <LostReasonModal
        isOpen={!!lostReasonModalData}
        onClose={() => setLostReasonModalData(null)}
        onSubmit={(reason) => {
          if (lostReasonModalData) {
            applyEnquiryHealth(lostReasonModalData.enquiryId, "Lost", reason);
            setLostReasonModalData(null);
          }
        }}
      />

      <HoldFollowUpModal
        isOpen={!!holdModalEnquiryId}
        entityLabel="enquiry"
        onClose={() => setHoldModalEnquiryId(null)}
        onSubmit={(payload) => {
          if (!holdModalEnquiryId) return;
          const id = holdModalEnquiryId;
          setHoldModalEnquiryId(null);
          void applyEnquiryHealth(id, "On Hold", undefined, payload);
        }}
      />

      {editingEnquiry && (
        <AddEnquiryModal
          isOpen
          onClose={() => setEditingEnquiry(null)}
          onSubmit={handleEditEnquiry}
          initialData={editingEnquiry.formData}
        />
      )}

      {deletingEnquiryId &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
              onClick={() => setDeletingEnquiryId(null)}
              aria-hidden
            />
            <div className="relative z-[201] w-full max-w-[380px] mx-4 bg-white rounded-2xl shadow-2xl p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={28} className="text-red-500" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Delete Enquiry?</h3>
              <p className="text-sm text-slate-500 mb-5">
                This action cannot be undone. The enquiry will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingEnquiryId(null)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEnquiry(deletingEnquiryId)}
                  className="flex-1 py-2.5 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

