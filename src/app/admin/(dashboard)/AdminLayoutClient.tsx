"use client";

import React, { useState, useEffect } from "react";
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
  Menu,
  X,
  IndianRupee,
  CalendarDays,
  Boxes,
  Plug,
  FileText,
  ListTodo,
  ShoppingCart,
  Landmark,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { PlatformMadeWithLove } from "@/components/ui/PlatformMadeWithLove";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "@/features/auth/actions/authActions";
import { IdleSessionGuard } from "@/features/auth/components/IdleSessionGuard";
import { createClient } from "@/utils/supabase/client";
import {
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
  savePushSubscription,
  togglePushEnabled,
  deleteNotification,
} from "@/features/notifications/actions/notificationActions";

/** Convert a Base64URL string to a Uint8Array */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
  { id: "/admin/integrations", label: "Integrations", icon: Plug },
  { id: "/admin/customers", label: "Customers", icon: Users, countKey: "customers" },
  { id: "/admin/service-tickets", label: "Service Tickets", icon: Wrench, countKey: "support" },
  { id: "/admin/employees", label: "Employees", icon: UserCheck },
  { id: "/admin/tasks", label: "Tasks", icon: ListTodo },
  { id: "/admin/reports", label: "Reports", icon: BarChart2 },
  { id: "/production/orders", label: "Production", icon: Factory, countKey: "production" },
  { id: "/installation/orders", label: "Installation", icon: Wrench, countKey: "installation" },
  { id: "/admin/payments", label: "Payments", icon: IndianRupee },
  { id: "/admin/invoices", label: "Invoices", icon: FileText },
  { id: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { id: "/admin/inventory", label: "Inventory", icon: Boxes },
  { id: "/admin/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { id: "/admin/finance", label: "Finance", icon: Landmark },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isExpanded = !collapsed || isHovered || isMobileMenuOpen;

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isWorksheetPage =
    pathname.startsWith("/admin/orders/") && pathname.replace(/\/$/, "") !== "/admin/orders";

  const [notifications, setNotifications] = useState<any[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    
    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) console.error("Error fetching notifications:", error);
      if (data) setNotifications(data);

      const { data: pushData } = await supabase
        .from("push_subscriptions")
        .select("push_enabled")
        .eq("user_id", profile.id)
        .limit(1)
        .maybeSingle();
      if (pushData) {
        setPushEnabled(pushData.push_enabled);
      }
    };

    fetchNotifs();

    const userId = profile.id;
    const channel = supabase
      .channel("notifications_channel_" + userId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          if (payload.new?.user_id !== userId) return;
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          if (payload.new?.user_id !== userId) return;
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? payload.new : n))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to notifications realtime');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  // Fetch order activity timeline when panel opens
  useEffect(() => {
    if (!isHistoryOpen) return;
    const supabase = createClient();
    setActivitiesLoading(true);
    supabase
      .from("order_activity")
      .select("id, order_id, actor_name, actor_role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setActivities(data || []);
        setActivitiesLoading(false);
      });
  }, [isHistoryOpen]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearNotifications = async () => {
    await clearAllNotifications();
    setNotifications([]);
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkRead = async (id: string, link?: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (link) {
      router.push(link);
      setIsNotifOpen(false);
    }
  };

  const handleEnablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push notifications are not supported by your browser.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Permission denied.");
        return;
      }
      
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/printoms/sw.js");
      }
      
      registration = await navigator.serviceWorker.ready;
      
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Missing VAPID key");
      
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const subData = JSON.parse(JSON.stringify(subscription));
      // In this demo, assuming Admin is global or has no fixed companyId, pass null for now. Or get from cookies.
      // Actually Admin may not belong to a specific company_id but we just pass null.
      await savePushSubscription(subData, null);
      await togglePushEnabled(true);
      setPushEnabled(true);
      alert("Push notifications enabled!");
    } catch (e: any) {
      console.error(e);
      alert("Failed to enable push notifications: " + (e.message || String(e)));
    }
  };

  const handleTogglePush = async () => {
    const newState = !pushEnabled;
    await togglePushEnabled(newState);
    setPushEnabled(newState);
  };

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
    <div style={{ display: "flex", height: "100dvh", maxHeight: "100dvh", overflow: "hidden", background: "var(--color-background)" }}>
      <IdleSessionGuard loginPath="/admin/login" />

      {/* ── DARK SIDEBAR ── */}
      <aside
        onMouseEnter={() => {
          if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
            setIsHovered(false);
          }
        }}
        className={`fixed inset-y-0 left-0 z-[60] transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} lg:sticky lg:top-0 lg:translate-x-0 transition-transform duration-300 lg:transition-none flex flex-col flex-shrink-0 overflow-hidden`}
        style={{
          width: isMobileMenuOpen ? "240px" : sidebarW,
          minHeight: "100dvh",
          background: "var(--sidebar-bg)",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          height: "100dvh",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: isExpanded ? "24px 20px" : "24px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            gap: 8,
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
        <nav className="scrollbar-none" style={{ flex: 1, minHeight: 0, padding: "8px 0", overflowY: "auto", overflowX: "hidden" }}>
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
                  setIsMobileMenuOpen(false);
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

        {/* Collapse Button — desktop only */}
        <div
          className="hidden lg:block"
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

        {isMobileMenuOpen && (
          <div className="lg:hidden p-3 shrink-0 border-t border-white/10 space-y-2">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                void handleLogout();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-300 bg-red-500/10 border border-red-400/25"
              aria-label="Logout"
            >
              <LogOut size={16} />
              Logout
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-200 bg-white/5 border border-white/15"
              aria-label="Close menu"
            >
              <X size={16} />
              Close
            </button>
          </div>
        )}
      </aside>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* ── MAIN WORKSPACE ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>

        {/* Top Bar — hidden on worksheet pages (except mobile menu) */}
        {!isWorksheetPage && (
          <header
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              height: "56px",
              background: "white",
              borderBottom: "1px solid #E2E8F0",
              paddingLeft: "16px",
              paddingRight: "16px",
              position: "sticky",
              top: 0,
              zIndex: 40,
              gap: "12px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="lg:hidden flex items-center justify-center p-2 rounded-md text-slate-500 hover:bg-slate-100"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
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
                    <div className="prt-animate-in fixed inset-x-4 top-[64px] sm:inset-x-auto sm:absolute sm:-right-2 sm:top-[calc(100%+8px)] w-auto sm:w-[380px] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      <div style={{ padding: "10px 16px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Order Activity Timeline</span>
                        <span style={{ fontSize: 10, color: "#94A3B8" }}>Latest 50 events</span>
                      </div>
                      <div style={{ maxHeight: 360, overflowY: "auto" }}>
                        {activitiesLoading ? (
                          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#94A3B8" }}>Loading...</div>
                        ) : activities.length === 0 ? (
                          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#94A3B8" }}>No activity recorded yet.</div>
                        ) : activities.map((act: any) => {
                          const ts = new Date(act.created_at);
                          const timeStr = ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                          const dateStr = ts.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                          return (
                            <div
                              key={act.id}
                              onClick={() => { if (act.order_id) { router.push(`/admin/orders/${act.order_id}`); setIsHistoryOpen(false); } }}
                              style={{ padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 10, borderBottom: "1px solid #F8FAFC", cursor: act.order_id ? "pointer" : "default", transition: "background 0.12s" }}
                              onMouseEnter={(e) => { if (act.order_id) (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "white"; }}
                            >
                              {/* Timeline dot */}
                              <div style={{ flexShrink: 0, marginTop: 3, width: 8, height: 8, borderRadius: "50%", background: act.actor_role === "System" ? "#94A3B8" : "var(--color-secondary)", border: "2px solid white", boxShadow: "0 0 0 1px #E2E8F0" }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#0F172A", background: "#F1F5F9", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>
                                    {act.order_id || "—"}
                                  </span>
                                  <span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>{act.actor_name}</span>
                                  <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: "auto", flexShrink: 0 }}>{dateStr} · {timeStr}</span>
                                </div>
                                <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.4, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{act.content}</span>
                              </div>
                            </div>
                          );
                        })}
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
                    <div className="prt-animate-in fixed inset-x-4 top-[64px] sm:inset-x-auto sm:absolute sm:-right-2 sm:top-[calc(100%+8px)] w-auto sm:w-[320px] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      <div style={{ padding: "10px 16px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notifications</span>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={handleMarkAllRead} style={{ fontSize: 11, color: "var(--color-secondary)", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Mark read</button>
                          <button onClick={handleClearNotifications} style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
                        </div>
                      </div>
                      
                      <div style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#64748B" }}>Desktop Alerts</span>
                        {pushEnabled ? (
                          <button onClick={handleTogglePush} style={{ fontSize: 11, background: "#EF4444", color: "white", padding: "2px 8px", borderRadius: 4 }}>Disable</button>
                        ) : (
                          <button onClick={handleEnablePush} style={{ fontSize: 11, background: "#22C55E", color: "white", padding: "2px 8px", borderRadius: 4 }}>Enable</button>
                        )}
                      </div>

                      <div style={{ maxHeight: 260, overflowY: "auto" }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#94A3B8" }}>No notifications.</div>
                        ) : notifications.map((notif: any) => (
                          <div 
                            key={notif.id} 
                            onClick={() => handleMarkRead(notif.id, notif.link)}
                            style={{ position: "relative", padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 10, borderBottom: "1px solid #F8FAFC", background: notif.read ? "white" : "#EFF6FF", cursor: notif.link ? "pointer" : "default" }}
                          >
                            <span style={{ marginTop: 1 }}>
                              {notif.type === "success" ? <CheckCircle size={13} color="#22C55E" /> :
                               notif.type === "error" || notif.type === "warning" ? <AlertCircle size={13} color="#EF4444" /> :
                               <Info size={13} color="#94A3B8" />}
                            </span>
                            <div style={{ flex: 1, paddingRight: 20 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>{notif.title}</div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{notif.message}</div>
                              <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3, fontFamily: "monospace" }}>
                                {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleDeleteNotification(notif.id, e)}
                              title="Delete notification"
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 12,
                                background: "none",
                                border: "none",
                                color: "#94A3B8",
                                cursor: "pointer",
                                padding: 2
                              }}
                            >
                              <X size={14} />
                            </button>
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
                    <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setIsProfileOpen(false)} />
                    <div className="prt-animate-in fixed right-4 top-[64px] w-[min(calc(100vw-2rem),240px)] bg-white border border-slate-200 rounded-xl shadow-lg z-[60] overflow-hidden p-1">
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{profile.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>{profile.email}</p>
                      </div>
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
        <main style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--color-background)", minHeight: 0, overflow: "hidden" }}>
          <PullToRefresh
            disabled={isWorksheetPage}
            className="flex-1 min-h-0"
            style={
              isWorksheetPage
                ? { display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }
                : { overflowY: "auto" }
            }
          >
            <div
              style={
                isWorksheetPage
                  ? { width: "100%", display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }
                  : { width: "100%", maxWidth: 1400, margin: "0 auto" }
              }
            >
              {children}
            </div>
          </PullToRefresh>
        </main>
        {!isWorksheetPage && (
          <div style={{
            textAlign: "center",
            padding: "8px 0 calc(8px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid #E2E8F0",
            color: "#94A3B8",
            fontSize: "13px",
            fontWeight: "600",
            width: "100%",
            background: "var(--color-background)",
            flexShrink: 0,
            position: "relative",
          }}>
            <PlatformMadeWithLove />
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
        }
        html, body { overflow: hidden !important; margin: 0; padding: 0; width: 100%; height: 100%; height: 100dvh; }
      `}</style>
    </div>
  );
}
