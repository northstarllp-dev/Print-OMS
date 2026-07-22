"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Filter, Plus, AlertCircle, CheckCircle, Clock, Phone, Copy, MessageSquare, Mail, X, Check, ArrowRight, Calendar, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { AddEnquiryModal, EnquiryFormData } from "./AddEnquiryModal";
import { ConvertEnquiryModal } from "./ConvertEnquiryModal";
import { AssignTeamModal } from "./AssignTeamModal";
import { createEnquiry, updateEnquiry, convertEnquiryToOrderAction } from "@/features/enquiries/actions/enquiryActions";
import { createOrder } from "@/features/orders/actions/orderActions";
import { createCustomer } from "@/features/customers/actions/customerActions";

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

export function EnquiriesViewNew({ initialEnquiries, initialCustomers }: { initialEnquiries: any[], initialCustomers: any[] }) {
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
  const [selectedEnquiry, setSelectedEnquiry] = useState<{id: string, businessName: string, leadName: string, notes?: string} | null>(null);

  // Welcome message states
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeCustomerInfo, setWelcomeCustomerInfo] = useState<{ customerId: string; customerName: string; phone: string; email: string; orderId?: string } | null>(null);

  // Success modal states
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState({ title: "", message: "" });

  const handleAddEnquiry = async (data: EnquiryFormData) => {
    try {
      const newEnq = {
        lead_name: data.leadName,
        business_name: data.businessName,
        phone: data.phone.replace(/\s+/g, ""),
        whatsapp: data.whatsappNumber.replace(/\s+/g, ""),
        email: data.email,
        source: data.source,
        notes: data.notes,
        primary_communication_mode: data.primaryMode === "whatsapp" ? "WHATSAPP" : "MAIL",
        location: data.location,
        status: "Pending"
      };
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

  const totalEnquiries = enquiries.length;
  const pendingResponses = enquiries.filter(e => e.status === "Pending").length;
  const convertedCount = enquiries.filter(e => e.status === "Converted").length;
  const conversionRate = totalEnquiries > 0 ? Math.round((convertedCount / totalEnquiries) * 100) : 0;

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
    return enquiries.filter((e) => {
      const matchesSearch =
        (e.businessName || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (e.leadName || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (e.phone || "").includes(debouncedSearchTerm);
      const matchesSource = sourceFilter === "All" || e.source === sourceFilter;
      const matchesAddedBy = addedByFilter === "All" || (e.addedBy || "Admin") === addedByFilter;

      if (selectedKpi === "pending" && e.status !== "Pending") return false;
      if (selectedKpi === "converted" && e.status !== "Converted") return false;

      let matchesDate = true;
      if (e.dateReceived) {
        try {
          const enqDate = new Date(e.dateReceived);
          const enqDateStr = enqDate.toISOString().split("T")[0];
          if (dateFilterType === "range") {
            if (startDate && enqDateStr < startDate) matchesDate = false;
            if (endDate && enqDateStr > endDate) matchesDate = false;
          }
        } catch {
          matchesDate = false;
        }
      } else if (dateFilterType !== "all") {
        matchesDate = false;
      }

      return matchesSearch && matchesSource && matchesAddedBy && matchesDate;
    });
  }, [enquiries, debouncedSearchTerm, sourceFilter, addedByFilter, selectedKpi, dateFilterType, startDate, endDate]);

  const resetFilters = () => {
    setDateFilterType("range");
    setStartDate("");
    setEndDate("");
    setAddedByFilter("All");
    setSourceFilter("All");
    setSearchTerm("");
    setSelectedKpi(null);
  };

  const activeFilterCount = [
    sourceFilter !== "All",
    addedByFilter !== "All",
    Boolean(startDate || endDate),
    Boolean(selectedKpi),
  ].filter(Boolean).length;

  const openConvert = (enq: any) => {
    setSelectedEnquiry({
      id: enq.id,
      businessName: enq.businessName || enq.leadName,
      leadName: enq.leadName,
      notes: enq.notes,
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
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-[13px] font-semibold text-white bg-[var(--color-primary)] rounded-lg"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} /> New Enquiry
          </button>
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
        {/* Search & Filter Bar — Orders-style */}
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

          {mobileFiltersOpen && (
            <div className="lg:hidden fixed inset-0 z-[80]">
              <button
                type="button"
                aria-label="Close filters"
                className="absolute inset-0 bg-slate-900/40"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl">
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white rounded-t-2xl">
                  <h3 className="text-sm font-extrabold text-slate-900">Filters</h3>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
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
                <div className="sticky bottom-0 flex gap-2 px-4 py-3 border-t border-slate-100 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
            </div>
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
            filteredEnquiries.map((enq) => {
              const statusColor = getStatusColor(enq.status);
              const dateStr = enq.dateReceived
                ? new Date(enq.dateReceived).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                : "—";
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
                          </div>
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
                        {enq.status !== "Converted" ? (
                          <button
                            type="button"
                            onClick={() => openConvert(enq)}
                            className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white bg-[var(--color-primary)] whitespace-nowrap"
                          >
                            Convert to Order
                          </button>
                        ) : enq.orderId ? (
                          <a
                            href={`/admin/orders/${enq.orderId}`}
                            className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap"
                          >
                            View Order
                          </a>
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
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>REQ NOTES</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ADDED BY</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ORDER ID</th>
                <th style={{ padding: "14px 20px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnquiries.map((enq) => {
                return (
                  <tr key={enq.id} style={{ borderBottom: "1px solid #e2e8f0", transition: "background 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a", fontWeight: "700" }}>{enq.enquireId || enq.id.substring(0, 8)}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#64748b", fontWeight: "500" }}>{new Date(enq.dateReceived).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>
                      <div style={{ fontWeight: "700" }}>{enq.businessName}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{enq.leadName}</div>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>{enq.phone}</td>
                    <td style={{ padding: "16px 20px", fontSize: "12px", color: "#64748b" }}>{enq.source}</td>
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
                        {enq.status !== "Converted" ? (
                          <button 
                            onClick={() => openConvert(enq)}
                            style={{ padding: "6px 12px", background: "var(--color-primary)", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", color: "white", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-primary-container)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "var(--color-primary)"}
                          >
                            Convert to Order
                          </button>
                        ) : enq.orderId ? (
                          <a
                            href={`/admin/orders/${enq.orderId}`}
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
                          </a>
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
      </div>
      
      <AddEnquiryModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddEnquiry}
      />

      {selectedEnquiry && (
        <ConvertEnquiryModal
          isOpen={convertModalOpen}
          onClose={() => {
            setConvertModalOpen(false);
            setSelectedEnquiry(null);
          }}
          defaultClientName={selectedEnquiry.leadName || ""}
          defaultBusinessName={selectedEnquiry.businessName || ""}
          defaultRequirements={selectedEnquiry.notes || ""}
          onSubmit={async (clientName, businessName, productType, requirements, assignedAdmins) => {
            const enq = enquiries.find(e => e.id === selectedEnquiry.id);
            const res = await convertEnquiryToOrderLocal(selectedEnquiry.id, clientName, businessName, productType, requirements, assignedAdmins);
            setConvertModalOpen(false);
            
            if (res && res.success) {
              setWelcomeCustomerInfo({
                customerId: res.customerId,
                customerName: enq?.businessName || enq?.leadName || "Customer",
                phone: enq?.phone || "",
                email: enq?.email || "",
                orderId: res.orderId
              });
              setWelcomeModalOpen(true);
            }
            setSelectedEnquiry(null);
          }}
        />
      )}

      {welcomeCustomerInfo && (
        <WelcomeMessageModal
          isOpen={welcomeModalOpen}
          onClose={() => {
            setWelcomeModalOpen(false);
            setAssignedOrderId(welcomeCustomerInfo.orderId || "");
            setWelcomeCustomerInfo(null);
            
            // Show AssignTeamModal
            setAssignTeamModalOpen(true);
          }}
          customerInfo={welcomeCustomerInfo}
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
          onClose={() => setSuccessModalOpen(false)}
        />
      )}
    </div>
  );
}

interface WelcomeMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerInfo: { customerId: string; customerName: string; phone: string; email: string; orderId?: string };
}

export function WelcomeMessageModal({ isOpen, onClose, customerInfo }: WelcomeMessageModalProps) {
  const [loading, setLoading] = useState(true);
  const [portalUrl, setPortalUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && customerInfo.customerId) {
      setLoading(true);
      const params = new URLSearchParams({ customer_id: customerInfo.customerId });
      if (customerInfo.orderId) {
        params.append("order_id", customerInfo.orderId);
      }
      fetch(`/printoms/api/portal-token?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            setPortalUrl(data.url);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching portal token:", err);
          setLoading(false);
        });
    }
  }, [isOpen, customerInfo.customerId, customerInfo.orderId]);

  if (!isOpen) return null;

  const messageText = `Hello ${customerInfo.customerName},

Welcome to Printoms! We are excited to work with you on your signage project.

You can track your order status, approve quotations/designs, make payments, and chat directly with our team on your secure Customer Portal:
${portalUrl || "Loading link..."}

Best regards,
Printoms Team`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = customerInfo.phone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const encodedText = encodeURIComponent(messageText);
    window.open(`https://wa.me/${formattedPhone}?text=${encodedText}`, "_blank");
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent("Welcome to Printoms - Customer Portal Link");
    const body = encodeURIComponent(messageText);
    window.open(`mailto:${customerInfo.email || ""}?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.4)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1100,
      padding: "20px",
      fontFamily: "var(--font-sans), sans-serif"
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "520px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        display: "flex",
        flexDirection: "column",
        maxHeight: "90vh",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f8fafc"
        }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>Customer Portal Welcome Message</h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>Review and send the magic portal link to the customer.</p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: "var(--color-primary)",
              border: "none",
              color: "white",
              cursor: "pointer",
              padding: "6px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              gap: "6px"
            }}
          >
            Assign Employees <ArrowRight size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              <div style={{ width: "24px", height: "24px", border: "2px solid var(--color-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              Generating secure customer link...
            </div>
          ) : (
            <>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                  Message Preview
                </label>
                <textarea 
                  readOnly
                  value={messageText}
                  style={{
                    width: "100%",
                    height: "180px",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#334155",
                    fontFamily: "inherit",
                    resize: "none",
                    background: "#f8fafc"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleCopy}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: copied ? "#dcfce7" : "#f1f5f9",
                    border: `1px solid ${copied ? "#86efac" : "#cbd5e1"}`,
                    color: copied ? "#16a34a" : "#475569",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    cursor: "pointer"
                  }}
                >
                  <Copy size={14} />
                  {copied ? "Copied!" : "Copy Message"}
                </button>

                <button
                  onClick={handleSendWhatsApp}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "#25D366",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    cursor: "pointer"
                  }}
                >
                  <MessageSquare size={14} />
                  Send WhatsApp
                </button>

                <button
                  onClick={handleSendEmail}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "var(--color-secondary)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    cursor: "pointer"
                  }}
                >
                  <Mail size={14} />
                  Send Email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
