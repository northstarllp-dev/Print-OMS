"use client";

import React, { useState } from "react";
import { 
  Bell, CheckCircle, AlertCircle, Info, LogOut,
  Lock, Loader2, Key,
  ChevronLeft, ChevronRight, Hammer, MapPin, Menu, X
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { useRouter, usePathname } from "next/navigation";
import { signOut, updateUserPassword } from "@/features/auth/actions/authActions";
import { getEditableStages } from "@/features/orders/workspace/shared/stageGrants";

interface InstallationLayoutClientProps {
  children: React.ReactNode;
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
    staff_role: string;
    company_id?: string | null;
  };
}

export function InstallationLayoutClient({ children, profile }: InstallationLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isWorksheetPage = false; 

  const [collapsed, setCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isExpanded = !collapsed || isHovered || isMobileMenuOpen;

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [notifications, setNotifications] = useState<any[]>([
    {
      id: "NOT-I1",
      title: "New Installation Job",
      message: "Order ACP Pillar Gate Banner is ready for installation.",
      time: "1 hour ago",
      type: "success",
      read: false
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/installation/login");
  };

  const canAccessSiteVisit = getEditableStages({
    role: profile.role,
    staff_role: profile.staff_role,
    company_id: profile.company_id ?? null,
  }).includes("site_visit");

  const navItems = [
    { id: "/installation/orders", label: "Installation Queue", icon: Hammer },
    ...(canAccessSiteVisit ? [{ id: "/installation/site-visit", label: "Site Visit", icon: MapPin }] : []),
    ...(profile.role === "admin" ? [{ id: "/admin/dashboard", label: "Back to Admin", icon: ChevronLeft }] : []),
  ] as const;

  const isActivePath = (item: typeof navItems[number]) => {
    if (item.id === "/installation/orders") {
      return pathname === "/installation/orders" || pathname === "/installation" || (pathname.startsWith("/installation/orders/") && pathname !== "/installation/orders");
    }
    return pathname.startsWith(item.id);
  };

  const initials = profile.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await updateUserPassword(newPassword);
      if (res.error) {
        setPasswordError(res.error);
      } else {
        setPasswordSuccess("Password updated successfully!");
        setTimeout(() => {
          setIsChangePasswordModalOpen(false);
          setNewPassword("");
          setConfirmPassword("");
        }, 1500);
      }
    } catch (err: any) {
      setPasswordError(err.message || "An error occurred.");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const sidebarW = isExpanded ? "240px" : "64px";

  return (
    <div style={{ display: "flex", height: "100dvh", maxHeight: "100dvh", overflow: "hidden", background: "var(--color-background)" }}>

      {/* ── DARK SIDEBAR ── */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
            height: isExpanded ? "auto" : "40px",
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
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
          {navItems.map((item) => {
            const isActive = isActivePath(item);
            const Icon = item.icon;

            return (
              <button
                key={item.id}
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
                </div>
              </button>
            );
          })}
        </nav>

        {/* Collapse Button — desktop only */}
        <div className="hidden lg:block" style={{ padding: "12px", flexShrink: 0 }}>
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

      {/* ── MAIN WORKSPACE ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>

        {/* Top Bar — hidden on worksheet pages */}
        {!isWorksheetPage && (
          <header
            className="flex items-center w-full h-[56px] bg-white border-b border-slate-200 px-4 md:px-6 sticky top-0 z-40 gap-3 shrink-0"
          >
            {/* Mobile Menu Toggle */}
            <button
              className="lg:hidden flex items-center justify-center p-2 rounded-md text-slate-500 hover:bg-slate-100"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu size={20} />
            </button>


            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
              {/* Notifications */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setIsNotifOpen((p) => !p); setIsHistoryOpen(false); setIsProfileOpen(false); }}
                  title="Notifications"
                  style={{ width: 34, height: 34, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s", position: "relative" }}
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
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
                      background: "#16a34a",
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
                  <div className="hidden sm:block" style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#0F172A", lineHeight: 1.2 }}>
                      {profile.name}
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", color: "#64748B", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {profile.staff_role || "Installation"}
                    </p>
                  </div>
                </button>
                {isProfileOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setIsProfileOpen(false)} />
                    <div className="prt-animate-in" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 180, background: "white", border: "1px solid #E2E8F0", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden", padding: 4 }}>
                      <button
                        onClick={() => { setIsChangePasswordModalOpen(true); setIsProfileOpen(false); setPasswordError(""); setPasswordSuccess(""); setNewPassword(""); setConfirmPassword(""); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "8px", fontSize: 13, fontWeight: 600, color: "#64748B", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s", textAlign: "left" }}
                      >
                        <Key size={14} /> Change Password
                      </button>
                      <div style={{ height: 1, background: "#E2E8F0", margin: "4px 0" }} />
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
            zIndex: 10, flexShrink: 0, position: "relative",
          }}>
            <a
              href="https://printoms.thepolarislabs.com/"
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
                src="/printoms/clients/light%20withoutbg.png"
                alt="Polaris"
                className="h-8 lg:h-9 w-auto ml-0.5"
              />
            </a>
          </div>
        )}
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {isChangePasswordModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "white", width: "100%", maxWidth: "400px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", padding: "24px" }} className="prt-animate-in">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
                <Lock size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Change Password</h3>
                <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>Update your installation portal password credentials</p>
              </div>
            </div>

            {passwordError && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: "6px", fontSize: "12px", color: "#BE123C", fontWeight: "600" }}>
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: "6px", fontSize: "12px", color: "#16A34A", fontWeight: "600" }}>
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", padding: "8px 12px", outline: "none" }}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", padding: "8px 12px", outline: "none" }}
                  placeholder="Repeat new password"
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(false)}
                  disabled={isSubmittingPassword}
                  style={{ flex: 1, padding: "8px 16px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontWeight: "700", color: "#475569", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  style={{ flex: 1, padding: "8px 16px", background: "#16a34a", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  {isSubmittingPassword ? <Loader2 size={14} style={{ animation: "prt-spin 1s linear infinite" }} /> : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        html, body { overflow: hidden !important; margin: 0; padding: 0; width: 100%; height: 100%; height: 100dvh; }
      `}</style>
    </div>
  );
}
