"use client";

import React, { useState } from "react";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  LogOut,
  History,
  RotateCcw,
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  Users,
  UserCheck,
  Factory,
  Wrench,
  BarChart2,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "@/features/auth/actions/authActions";

interface AdminLayoutClientProps {
  children: React.ReactNode;
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  counts?: {
    orders?: number;
    enquiries?: number;
    customers?: number;
    production?: number;
    installation?: number;
    payments?: number;
    support?: number;
  };
}

const NAV_ITEMS = [
  { id: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, exactMatch: true },
  { id: "/admin/orders", label: "Orders", icon: ShoppingBag, countKey: "orders" },
  { id: "/admin/enquire", label: "Enquiries", icon: MessageSquare, countKey: "enquiries" },
  { id: "/admin/customers", label: "Customers", icon: Users, countKey: "customers" },
  { id: "/admin/service-tickets", label: "Service Tickets", icon: Wrench, countKey: "support" },
  { id: "/admin/employees", label: "Employees", icon: UserCheck },
  { id: "/admin/reports", label: "Reports", icon: BarChart2 },
  { id: "/production/orders", label: "Production", icon: Factory, countKey: "production" },
  { id: "/installation/orders", label: "Installation", icon: Wrench, countKey: "installation" },
  { id: "/admin/products", label: "Products", icon: Package },
  { id: "/admin/settings", label: "Settings", icon: Settings },
] as const;

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  orders:       { bg: "#1E40AF", text: "#FFFFFF" },
  enquiries:    { bg: "#8B5CF6", text: "#FFFFFF" },
  customers:    { bg: "#3B82F6", text: "#FFFFFF" },
  production:   { bg: "#F97316", text: "#FFFFFF" },
  installation: { bg: "#14B8A6", text: "#FFFFFF" },
  support:      { bg: "#0F766E", text: "#FFFFFF" },
};

export function AdminLayoutClient({
  children,
  profile,
  counts = {},
}: AdminLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = !collapsed || isHovered;

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isWorksheetPage =
    pathname.startsWith("/admin/orders/") && pathname.replace(/\/$/, "") !== "/admin/orders";

  const [notifications, setNotifications] = useState<any[]>([
    {
      id: "NOT-1",
      title: "SLA Warning: Action Required",
      message:
        "Lead Rohan Varma has been pending without site visit for 50h. Escalate immediately.",
      time: "2 hours ago",
      type: "error",
      read: false,
    },
    {
      id: "NOT-2",
      title: "SLA Warning: WhatsApp Follow-up",
      message: "Lead Amit Sharma has been pending for 25h. Triggering WhatsApp alert.",
      time: "4 hours ago",
      type: "warning",
      read: false,
    },
    {
      id: "NOT-3",
      title: "New Webhook Submission",
      message: "New website enquiry logged automatically for Sneha Reddy.",
      time: "1 hour ago",
      type: "success",
      read: true,
    },
  ]);

  const [activities, setActivities] = useState<any[]>([]);
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const markAllNotificationsRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const clearNotifications = () => setNotifications([]);
  const undoActivity = (id: string) =>
    setActivities((prev) => prev.filter((a) => a.id !== id));

  const handleLogout = async () => {
    await signOut();
    router.push("/admin/login");
  };

  const isActivePath = (item: (typeof NAV_ITEMS)[number]) => {
    if ("exactMatch" in item && item.exactMatch) {
      return pathname === item.id || pathname === "/admin" || pathname === "/admin/dashboard";
    }
    if (item.id === "/admin/orders") {
      return pathname === "/admin/orders" || pathname.startsWith("/admin/orders/");
    }
    return pathname.startsWith(item.id);
  };

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const totalActiveOrders = counts.orders || 0;
  const sidebarW = isExpanded ? "240px" : "64px";

  return (
    <div style={{ display: "flex", height: "100vh", maxHeight: "100vh", overflow: "hidden", background: "var(--color-background)" }}>

      {/* ── DARK SIDEBAR ── */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="hidden md:flex flex-col"
        style={{
          width: sidebarW,
          minHeight: "100vh",
          background: "var(--sidebar-bg)",
          flexShrink: 0,
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: isExpanded ? "24px 20px" : "24px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "padding 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div style={{
            overflow: "hidden",
            width: isExpanded ? "180px" : "40px",
            height: isExpanded ? "56px" : "40px",
            transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
            display: "flex",
            background: "#ffffff",
            borderRadius: "8px",
            padding: isExpanded ? "8px 16px" : "4px",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Logo width={isExpanded ? 160 : 32} height={40} />
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = isActivePath(item);
            const Icon = item.icon;
            const countKey = "countKey" in item ? item.countKey : undefined;
            const count = countKey ? (counts as any)[countKey] : undefined;

            return (
              <button
                key={item.id}
                suppressHydrationWarning
                onClick={() => {
                  // For routes that don't exist yet, just navigate (will 404 gracefully)
                  router.push(item.id);
                }}
                title={!isExpanded ? item.label : undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: isExpanded ? "10px 16px" : "12px 24px",
                  justifyContent: isExpanded ? "flex-start" : "center",
                  background: isActive ? "var(--sidebar-active-bg)" : "transparent",
                  border: "none",
                  borderLeft: isActive ? "3px solid var(--sidebar-accent)" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "padding 0.25s cubic-bezier(0.4,0,0.2,1), background 0.15s ease, color 0.15s ease",
                  color: isActive ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                  textAlign: "left",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.color = "var(--sidebar-active-text)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--sidebar-text)";
                  }
                }}
              >
                <Icon
                  size={16}
                  style={{
                    flexShrink: 0,
                    color: isActive ? "var(--sidebar-accent)" : "inherit",
                  }}
                />
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  opacity: isExpanded ? 1 : 0,
                  maxWidth: isExpanded ? "200px" : "0px",
                  transition: "opacity 0.15s ease, max-width 0.25s cubic-bezier(0.4,0,0.2,1), margin-left 0.25s cubic-bezier(0.4,0,0.2,1)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  marginLeft: isExpanded ? "10px" : "0px",
                }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: isActive ? "700" : "500",
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.label}
                  </span>
                  {count !== undefined && count > 0 && countKey && (
                    <span
                      style={{
                        background: "var(--sidebar-accent)",
                        color: "#000000",
                        fontSize: "10px",
                        fontWeight: "800",
                        padding: "2px 7px",
                        borderRadius: "99px",
                        flexShrink: 0,
                        marginLeft: "6px",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Collapse Button */}
        <div
          style={{
            padding: "12px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: isExpanded ? "flex-start" : "center",
              padding: "8px 12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--sidebar-border)",
              borderRadius: "8px",
              cursor: "pointer",
              color: "var(--sidebar-text)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "var(--sidebar-active-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "var(--sidebar-text)";
            }}
          >
            {collapsed ? <ChevronRight size={14} style={{ flexShrink: 0 }} /> : <ChevronLeft size={14} style={{ flexShrink: 0 }} />}
            <span style={{
              fontSize: "12px",
              fontWeight: "600",
              opacity: isExpanded ? 1 : 0,
              maxWidth: isExpanded ? "100px" : "0px",
              transition: "opacity 0.15s ease, max-width 0.25s cubic-bezier(0.4,0,0.2,1), margin-left 0.25s cubic-bezier(0.4,0,0.2,1)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              marginLeft: isExpanded ? "8px" : "0px",
            }}>
              Collapse
            </span>
          </button>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top Bar — hidden on worksheet pages */}
        {!isWorksheetPage && (
          <header
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              height: "56px",
              background: "white",
              borderBottom: "1px solid #E2E8F0",
              paddingLeft: "24px",
              paddingRight: "24px",
              position: "sticky",
              top: 0,
              zIndex: 40,
              gap: "12px",
              flexShrink: 0,
            }}
          >
            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
              {/* History */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setIsHistoryOpen((p) => !p); setIsNotifOpen(false); setIsProfileOpen(false); }}
                  title="Action History"
                  style={{ width: 34, height: 34, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s" }}
                >
                  <History size={16} />
                </button>
                {isHistoryOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setIsHistoryOpen(false)} />
                    <div className="prt-animate-in" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Operation History</span>
                        <span style={{ fontSize: 10, color: "#94A3B8" }}>Rollback enabled</span>
                      </div>
                      <div style={{ maxHeight: 280, overflowY: "auto" }}>
                        {activities.length === 0 ? (
                          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#94A3B8" }}>No actions recorded yet.</div>
                        ) : activities.map((act: any) => (
                          <div key={act.id} style={{ padding: "10px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #F8FAFC" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", background: "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>{act.user}</span>
                                <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace" }}>{act.timestamp}</span>
                              </div>
                              <span style={{ fontSize: 12, color: "#64748B" }}>{act.description}</span>
                            </div>
                            <button
                              onClick={() => undoActivity(act.id)}
                              style={{ fontSize: 11, color: "var(--color-secondary)", background: "var(--secondary-container)", border: "1px solid rgba(79,70,229,0.2)", padding: "3px 8px", borderRadius: "6px", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, flexShrink: 0, whiteSpace: "nowrap" }}
                            >
                              <RotateCcw size={10} /> Undo
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Notifications */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setIsNotifOpen((p) => !p); setIsHistoryOpen(false); setIsProfileOpen(false); }}
                  title="Notifications"
                  style={{ width: 34, height: 34, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s", position: "relative" }}
                >
                  <Bell size={16} />
                  {unreadNotifCount > 0 && (
                    <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, background: "#EF4444", borderRadius: "50%", border: "2px solid white" }} />
                  )}
                </button>
                {isNotifOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setIsNotifOpen(false)} />
                    <div className="prt-animate-in" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 300, background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notifications</span>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={markAllNotificationsRead} style={{ fontSize: 11, color: "var(--color-secondary)", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Mark read</button>
                          <button onClick={clearNotifications} style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
                        </div>
                      </div>
                      <div style={{ maxHeight: 260, overflowY: "auto" }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#94A3B8" }}>No notifications.</div>
                        ) : notifications.map((notif: any) => (
                          <div key={notif.id} style={{ padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 10, borderBottom: "1px solid #F8FAFC", background: notif.read ? "white" : "#EFF6FF" }}>
                            <span style={{ marginTop: 1 }}>
                              {notif.type === "success" ? <CheckCircle size={13} color="#22C55E" /> :
                               notif.type === "error" || notif.type === "warning" ? <AlertCircle size={13} color="#EF4444" /> :
                               <Info size={13} color="#94A3B8" />}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>{notif.title}</div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{notif.message}</div>
                              <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, fontFamily: "monospace" }}>{notif.time}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Profile */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setIsProfileOpen((p) => !p); setIsNotifOpen(false); setIsHistoryOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", cursor: "pointer", padding: "4px 0 4px 12px" }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "var(--color-secondary)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "800",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#0F172A", lineHeight: 1.2 }}>
                      {profile.name}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", color: "#64748B", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Admin
                    </p>
                  </div>
                </button>
                {isProfileOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setIsProfileOpen(false)} />
                    <div className="prt-animate-in" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 180, background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden", padding: 4 }}>
                      <button
                        onClick={handleLogout}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "8px", fontSize: 13, fontWeight: 600, color: "#EF4444", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s", textAlign: "left" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF2F2"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--color-background)", minHeight: 0, overflowY: isWorksheetPage ? "hidden" : "auto" }}>
          <div
            style={
              isWorksheetPage
                ? { width: "100%", display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }
                : { width: "100%", maxWidth: 1400, margin: "0 auto" }
            }
          >
            {children}
            
            {!isWorksheetPage && (
              <div style={{
                textAlign: "center",
                padding: "24px 0",
                marginTop: "auto",
                borderTop: "1px solid #E2E8F0",
                color: "#94A3B8",
                fontSize: "13px",
                fontWeight: "600",
                width: "100%"
              }}>
                <a
          href="https://www.thepolarislabs.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontWeight: 600,
            margin: 0,
            color: "inherit",
            textDecoration: "none",
            cursor: "pointer",
            transition: "opacity 0.15s ease",
            pointerEvents: "auto",
          }}
        >
          Made with <span style={{ color: "#EF4444", fontSize: "14px" }}>❤️</span> by
          <img
            src="/clients/light withoutbg.png"
            alt="Polaris"
            style={{ height: "50px", marginLeft: "-2px", marginTop: "-16px", marginBottom: "-12px" }}
          />
        </a>
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
