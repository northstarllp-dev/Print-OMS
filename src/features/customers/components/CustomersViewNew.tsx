"use client";

import React, { useState } from "react";
import { Search, Filter, MapPin, Mail, Phone, X, ShoppingBag, ExternalLink, Share2, Pencil, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateCustomer } from "@/features/customers/actions/customerActions";

const getStatusColor = (status: string | undefined) => {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    "Active": { bg: "#dcfce7", text: "#16a34a", label: "ACTIVE" },
    "Inactive": { bg: "#fee2e2", text: "#dc2626", label: "INACTIVE" },
    "Pending": { bg: "#fef3c7", text: "#ea580c", label: "PENDING" },
  };
  return colors[status || "Active"] || colors["Active"];
};

const getHealthBadgeColor = (health: string) => {
  const colors: Record<string, string> = {
    "Active": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    "On Hold": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    "Lost": "bg-rose-500/10 text-rose-600 border-rose-500/20",
    "Cancelled": "bg-slate-500/10 text-slate-600 border-slate-500/20",
    "Completed": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  };
  return colors[health] || "bg-slate-100 text-slate-600 border-slate-200";
};

export function CustomersViewNew({ 
  initialCustomers, 
  initialOrders = [] 
}: { 
  initialCustomers: any[], 
  initialOrders?: any[] 
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [copiedCustomerId, setCopiedCustomerId] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedCustomer) {
      setEditForm({
        name: selectedCustomer.name || "",
        phone: selectedCustomer.phone || "",
        email: selectedCustomer.email || "",
        billing_address: selectedCustomer.billingAddress || "",
        shipping_address: selectedCustomer.shippingAddress || "",
        status: selectedCustomer.status || "Active"
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    try {
      await updateCustomer(selectedCustomer.id, editForm);
      setCustomers(customers.map(c => c.id === selectedCustomer.id ? {
        ...c,
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        billingAddress: editForm.billing_address,
        shippingAddress: editForm.shipping_address,
        status: editForm.status
      } : c));
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerOrders = selectedCustomer ? initialOrders.filter(o => o.customerId === selectedCustomer.id) : [];
  const totalSpend = 0;

  const handleCopyLink = async (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row selection when copying portal link
    try {
      const res = await fetch(`/printoms/api/portal-token?customer_id=${customerId}`);
      const data = await res.json();
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        setCopiedCustomerId(customerId);
        setTimeout(() => setCopiedCustomerId(null), 2000);
      }
    } catch (err) {
      console.error("Error fetching portal token:", err);
      alert("Failed to retrieve customer portal link");
    }
  };

  const handleCopyOrderLink = async (customerId: string, orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/printoms/api/portal-token?customer_id=${customerId}&order_id=${orderId}`);
      const data = await res.json();
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        setCopiedOrderId(orderId);
        setTimeout(() => setCopiedOrderId(null), 2000);
      }
    } catch (err) {
      console.error("Error fetching portal token:", err);
      alert("Failed to retrieve order portal link");
    }
  };

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === "Active").length;
  const pendingCustomers = customers.filter(c => c.status === "Pending").length;
  const activePercentage = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0;

  const stats = [
    {
      label: "TOTAL CUSTOMERS",
      value: totalCustomers.toString(),
      change: "All time",
      icon: MapPin,
      color: "var(--color-primary)",
    },
    {
      label: "ACTIVE ACCOUNTS",
      value: activeCustomers.toString(),
      change: `${activePercentage}% of total`,
      icon: Phone,
      color: "#3b82f6",
    },
    {
      label: "PENDING FOLLOW-UP",
      value: pendingCustomers.toString(),
      change: "Requires action",
      icon: Mail,
      color: "#f59e0b",
    },
    {
      label: "YTD REVENUE",
      value: "₹0.0L",
      change: "Based on active pipeline",
      icon: MapPin,
      color: "#06b6d4",
    },
  ];

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customerCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header Section */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>
              Customers Database
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              Browse customer contact details, profile info, and linked project orders
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "20px",
                  transition: "all 0.3s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {stat.label}
                  </span>
                  <div style={{ width: "32px", height: "32px", background: `${stat.color}15`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} style={{ color: stat.color }} />
                  </div>
                </div>
                <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {stat.change}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid View */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        
        {/* Left Hand: Customers List Table */}
        <div style={{ flex: selectedCustomerId ? "7" : "10", transition: "all 0.3s", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {/* Search & Filter Bar */}
          <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search by customer ID, name, phone or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#94a3b8";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(148, 163, 184, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            
            {/* Reset Button */}
            <button
              title="Reset Filters"
              onClick={() => setSearchTerm("")}
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
          <div style={{ overflowY: "auto", maxHeight: "650px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 10 }}>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>CUSTOMER ID</th>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>COMPANY NAME</th>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>PHONE</th>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>ORDERS</th>
                  <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>STATUS</th>
                  <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>PORTAL LINK</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => {
                  const statusColor = getStatusColor(cust.status);
                  const isSelected = selectedCustomerId === cust.id;
                  const count = initialOrders.filter(o => o.customerId === cust.id).length;
                  return (
                    <tr 
                      key={cust.id} 
                      onClick={() => setSelectedCustomerId(isSelected ? null : cust.id)}
                      style={{ 
                        borderBottom: "1px solid #e2e8f0", 
                        transition: "all 0.2s",
                        background: isSelected ? "rgba(1, 143, 16, 0.05)" : "transparent",
                        cursor: "pointer"
                      }} 
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }} 
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "16px 20px", fontSize: "12px", color: "#64748b", fontWeight: "700" }}>{cust.customerCode || cust.id}</td>
                      <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{cust.name}</td>
                      <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>{cust.phone}</td>
                      <td style={{ padding: "16px 20px", fontSize: "13px", color: "#0f172a" }}>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <ShoppingBag size={12} />
                          {count}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        <span style={{ display: "inline-block", padding: "4px 12px", background: statusColor.bg, color: statusColor.text, borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>{statusColor.label}</span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        <button
                          onClick={(e) => handleCopyLink(cust.customerId || cust.id, e)}
                          style={{
                            padding: "6px 12px",
                            background: copiedCustomerId === (cust.customerId || cust.id) ? "#dcfce7" : "var(--color-secondary)",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "600",
                            color: copiedCustomerId === (cust.customerId || cust.id) ? "#16a34a" : "white",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          {copiedCustomerId === (cust.customerId || cust.id) ? "Copied!" : "Copy Magic Link"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                      No customers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Hand: Selected Customer Detail Panel */}
        {selectedCustomer && (
          <div className="w-full md:w-[420px] shrink-0 bg-white border border-slate-200 rounded-xl shadow-lg p-6 sticky top-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">{selectedCustomer.customerCode || selectedCustomer.id}</span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-1">{selectedCustomer.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleEditClick}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition flex items-center gap-1 text-xs font-semibold"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button 
                  onClick={() => setSelectedCustomerId(null)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Profile Info */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{selectedCustomer.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <span>{selectedCustomer.phone}</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-600 pt-2 border-t border-slate-100">
                <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-xs text-slate-400 block uppercase tracking-wide">Billing Address</strong>
                  <span>{selectedCustomer.billingAddress || "Not Provided"}</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-xs text-slate-400 block uppercase tracking-wide">Shipping Address</strong>
                  <span>{selectedCustomer.shippingAddress || "Not Provided"}</span>
                </div>
              </div>
            </div>

            {/* Stats Breakdown */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Total Orders</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{customerOrders.length}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Total Spend</span>
                <span className="text-xl font-black text-emerald-600 mt-1.5 block">₹{totalSpend.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Orders List for Customer */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Linked Signage Orders</h3>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                {customerOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-lg">No orders associated yet.</p>
                ) : (
                  customerOrders.map(o => (
                    <div key={o.id} className="border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-3 flex flex-col justify-between gap-2 transition">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">{o.orderCode || o.id}</span>
                          <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate max-w-[180px]">{o.businessName || o.clientName}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => handleCopyOrderLink(selectedCustomer.customerId || selectedCustomer.id, o.orderId || o.id, e)}
                            className={`p-1 rounded border transition ${
                              copiedOrderId === (o.orderId || o.id)
                                ? "bg-emerald-50 border-emerald-250 text-[var(--color-success)]"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                            title={copiedOrderId === (o.orderId || o.id) ? "Copied!" : "Copy Order Magic Link"}
                          >
                            <Share2 size={12} />
                          </button>
                          <a 
                            href={`/admin/orders/${o.orderId || o.id}`}
                            className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition"
                            title="Open Worksheet"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>

                      <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100/50">
                        <span className="text-xs text-slate-500 font-semibold">₹0</span>
                        <div className="flex gap-1.5 items-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200 max-w-[100px] truncate">
                            {o.stage}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getHealthBadgeColor(o.health)}`}>
                            {o.health}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Edit Customer</h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                  <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Billing Address</label>
                <textarea value={editForm.billing_address} onChange={e => setEditForm({ ...editForm, billing_address: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"></textarea>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shipping Address</label>
                <textarea value={editForm.shipping_address} onChange={e => setEditForm({ ...editForm, shipping_address: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"></textarea>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
