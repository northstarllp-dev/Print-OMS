"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  Plus,
  Search,
  Filter,
  ChevronDown,
  MoreVertical,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  Zap,
  DollarSign,
  Briefcase,
  AlertTriangle,
} from "lucide-react";

interface Order {
  id: string;
  date: string;
  projectName: string;
  customer: string;
  stage:
    | "enquired"
    | "site-visit"
    | "quotation"
    | "design"
    | "production"
    | "installation"
    | "completed";
  budget: number;
  revenue?: number;
  isOutstanding?: boolean;
  isDelayed?: boolean;
  orderCode?: string;
}

const generateMockOrders = (): Order[] => {
  const projectNames = [
    "Main Atrium Wayfinding",
    "Exterior Pylon Signage",
    "Vehicle Fleet Branding",
    "Hotel Neon Facade",
    "Corporate Office Branding",
    "Retail Store Signage",
    "Industrial Warehouse Lettering",
    "Restaurant Facade Design",
    "Medical Center Signage",
    "Educational Institution Banners",
    "Tech Campus Gateway Signs",
    "Airport Directional Boards",
  ];

  const customers = [
    "TechCorp Global",
    "Metro Retailers",
    "Swift Logistics",
    "Luxe Stay Group",
    "Global Industries",
    "Prime Retail Co",
    "Federal Express",
    "Hotel Chains Inc",
  ];

  const stages: Order["stage"][] = [
    "enquired",
    "site-visit",
    "quotation",
    "design",
    "production",
    "installation",
    "completed",
  ];

  const orders: Order[] = [];
  for (let i = 1; i <= 128; i++) {
    const budget = Math.floor(Math.random() * 100) * 1000 + 10000;
    const revenue = Math.random() > 0.3 ? budget : 0;
    orders.push({
      id: `ORD-${String(9600 + i).padStart(4, "0")}`,
      date: new Date(2024, 4, 25 - Math.floor(i / 8))
        .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      projectName: projectNames[i % projectNames.length],
      customer: customers[i % customers.length],
      stage: stages[i % stages.length],
      budget,
      revenue,
      isOutstanding: Math.random() > 0.7,
      isDelayed: i % 13 === 0,
    });
  }
  return orders;
};

const mockOrders = generateMockOrders();

const getStageColor = (stage: string) => {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    enquired: { bg: "#e0e7ff", text: "#6366f1", label: "ENQUIRED" },
    "site-visit": { bg: "#dbeafe", text: "#0284c7", label: "SITE VISIT" },
    quotation: { bg: "#fef3c7", text: "#ea580c", label: "QUOTATION" },
    design: { bg: "#f3e8ff", text: "#a855f7", label: "DESIGN" },
    production: { bg: "#fee2e2", text: "#dc2626", label: "PRODUCTION" },
    installation: { bg: "#dcfce7", text: "#16a34a", label: "INSTALLATION" },
    completed: { bg: "#dcfce7", text: "#16a34a", label: "COMPLETED" },
  };
  return colors[stage] || colors["enquired"];
};

interface OrdersEnhancedDashboardProps {
  onAddOrder?: () => void;
}

export function OrdersEnhancedDashboard({ onAddOrder }: OrdersEnhancedDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [orders] = useState(mockOrders);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Calculate metrics
  const totalActive = orders.filter(o => o.stage !== "completed").length;
  const ordersInProduction = orders.filter(o => o.stage === "production").length;
  const quotePending = orders.filter(
    (o) =>
      o.stage === "quotation" ||
      (typeof o.stage === "string" && o.stage.toLowerCase().includes("quotation"))
  ).length;
  const leftAfterQuote = orders.filter(o => o.isOutstanding).length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.revenue || 0), 0);
  const outstanding = orders.reduce((sum, o) => sum + (o.isOutstanding ? o.budget - (o.revenue || 0) : 0), 0);

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.projectName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    const matchesStage = !selectedStage || order.stage === selectedStage;
    return matchesSearch && matchesStage;
  });

  const stats = [
    {
      label: "TOTAL ACTIVE ORDERS",
      value: String(totalActive),
      subtext: "In progress or pending",
      icon: Briefcase,
      color: "#3b82f6",
    },
    {
      label: "ORDERS IN PRODUCTION",
      value: String(ordersInProduction),
      subtext: "Ready for manufacturing",
      icon: Zap,
      color: "#f59e0b",
    },
    {
      label: "QUOTES PENDING",
      value: String(quotePending),
      subtext: "Awaiting approval",
      icon: AlertCircle,
      color: "#f97316",
    },
    {
      label: "LEFT AFTER QUOTATION",
      value: String(leftAfterQuote),
      subtext: "No follow-up",
      icon: AlertTriangle,
      color: "#ef4444",
    },
  ];

  const financialStats = [
    {
      label: "TOTAL REVENUE COLLECTED",
      value: `₹${(totalRevenue / 100000).toFixed(1)}L`,
      subtext: `${orders.filter(o => o.revenue).length} orders completed`,
      icon: DollarSign,
      color: "var(--color-success)",
    },
    {
      label: "OUTSTANDING AMOUNT",
      value: `₹${(outstanding / 100000).toFixed(1)}L`,
      subtext: "Pending payments",
      icon: Clock,
      color: "#8b5cf6",
    },
  ];

  return (
    <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>
              Orders Management
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              Manage and track all customer orders across different stages
            </p>
          </div>
          <button
            onClick={onAddOrder}
            style={{
              padding: "10px 16px",
              background: "var(--color-primary)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              fontWeight: "600",
              color: "white",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-primary-container)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-primary)";
            }}
          >
            <Plus size={16} />
            Add Order
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  background: `${stat.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: stat.color,
                }}
              >
                <Icon size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", margin: "0 0 4px", letterSpacing: "0.5px" }}>
                  {stat.label}
                </p>
                <p style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px" }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                  {stat.subtext}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {financialStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "2px solid #e2e8f0",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  background: `${stat.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: stat.color,
                }}
              >
                <Icon size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", margin: "0 0 4px", letterSpacing: "0.5px" }}>
                  {stat.label}
                </p>
                <p style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px" }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                  {stat.subtext}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div style={{ background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search by order ID, project, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />
          </div>

          {/* Stage Filter */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setSelectedStage(null)}
              style={{
                padding: "10px 12px",
                background: !selectedStage ? "var(--color-primary)" : "white",
                border: `1px solid ${!selectedStage ? "var(--color-primary)" : "#e2e8f0"}`,
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                color: !selectedStage ? "white" : "#0f172a",
                transition: "all 0.2s",
              }}
            >
              All Stages
            </button>
          </div>

          {/* Stage Dropdown */}
          <select
            value={selectedStage || ""}
            onChange={(e) => setSelectedStage(e.target.value || null)}
            style={{
              padding: "10px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              background: "white",
            }}
          >
            <option value="">Filter by Stage...</option>
            <option value="enquired">Enquired</option>
            <option value="site-visit">Site Visit</option>
            <option value="quotation">Quotation</option>
            <option value="design">Design</option>
            <option value="production">Production</option>
            <option value="installation">Installation</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <p style={{ fontSize: "12px", color: "#64748b", margin: "12px 0 0", fontStyle: "italic" }}>
          Showing {filteredOrders.length} of {orders.length} orders
        </p>
      </div>

      {/* Orders Table */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div
          style={{
            overflowX: "auto",
            maxHeight: "600px",
            overflowY: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "#f8fafc" }}>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                  Order ID
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                  Project
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                  Customer
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                  Stage
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                  Budget
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const stageColor = getStageColor(order.stage);
                  return (
                    <tr key={order.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
                        {order.orderCode || order.id}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#0f172a", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {order.projectName}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#0f172a" }}>
                        {order.customer}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                        <span
                          style={{
                            background: stageColor.bg,
                            color: stageColor.text,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "600",
                          }}
                        >
                          {stageColor.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: "600", color: "var(--color-primary)" }}>
                        ₹{(order.budget / 1000).toFixed(0)}K
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {order.isDelayed && (
                            <span title="Delayed" style={{ fontSize: "11px", fontWeight: "600", color: "#dc2626", background: "#fee2e2", padding: "2px 6px", borderRadius: "4px" }}>
                              ⚠️ Delayed
                            </span>
                          )}
                          {order.isOutstanding && (
                            <span title="Payment Outstanding" style={{ fontSize: "11px", fontWeight: "600", color: "#f97316", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>
                              💰 Outstanding
                            </span>
                          )}
                          {!order.isDelayed && !order.isOutstanding && (
                            <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-success)", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>
                              ✓ On Track
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>
                    No orders found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
