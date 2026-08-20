import React, { useState, useEffect } from "react";
import { Order, Customer, Employee, SiteVisitDetails } from "@/types";
import { Users, Settings, Briefcase, CheckCircle2, XCircle, AlertTriangle, Shield, ShieldOff, HeartPulse } from "lucide-react";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import { fetchEmployeeStats, assignTeamToOrder } from "@/features/orders/actions/orderActions";
import { revokePortalAccessAction } from "@/features/portal/actions/portalAdminActions";
import { ORDER_HEALTH_VALUES, type OrderHealth } from "@/features/orders/lib/orderHealth";

interface AdminControlModuleProps {
  order: Order;
  customers: Customer[];
  employees: Employee[];
  onAdminApprove: () => Promise<void>;
  onAdminReject?: (notes: string) => Promise<void>;
  onApproveWithWorkflowChoice?: () => void;
  updateSiteVisitDetails: (orderId: string, details: Partial<SiteVisitDetails>) => Promise<void>;
  updateOrderStage: (orderId: string, stage: string) => Promise<void>;
  onUpdateHealth?: (
    health: string,
    lostReason?: string,
    callRemarks?: string,
    hold?: { note?: string | null; reachOutAt?: string | null } | null
  ) => Promise<void>;
  onReopen?: () => Promise<void>;
}

const HEALTH_HINT: Record<OrderHealth, string> = {
  Active: "Order is progressing normally.",
  "Needs Attention": "No stage progress for too long — review and call the customer.",
  "On Hold": "Temporarily paused.",
  Lost: "Soft-cancelled; approvals are blocked.",
};

export const AdminControlModule: React.FC<AdminControlModuleProps> = ({
  order,
  onAdminApprove,
  onAdminReject,
  onApproveWithWorkflowChoice,
  onUpdateHealth,
  onReopen,
}) => {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [employeeStats, setEmployeeStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    new Set(order.assignedEmployees || [])
  );
  const [savingTeam, setSavingTeam] = useState(false);

  const [revoking, setRevoking] = useState(false);
  const [revokeResult, setRevokeResult] = useState<string | null>(null);

  const currentHealth = (order.health || "Active") as OrderHealth;
  const [healthDraft, setHealthDraft] = useState<OrderHealth>(
    ORDER_HEALTH_VALUES.includes(currentHealth) ? currentHealth : "Active"
  );
  const [lostReason, setLostReason] = useState(order.lost_reason || "");
  const [holdNote, setHoldNote] = useState((order as any).hold_note || (order as any).holdNote || "");
  const [reachOutAt, setReachOutAt] = useState(
    (order as any).reach_out_at || (order as any).reachOutAt || ""
  );
  const [callRemarks, setCallRemarks] = useState("");
  const [savingHealth, setSavingHealth] = useState(false);

  useEffect(() => {
    setSelectedEmployeeIds(new Set(order.assignedEmployees || []));
  }, [order.assignedEmployees]);

  useEffect(() => {
    const h = (order.health || "Active") as OrderHealth;
    setHealthDraft(ORDER_HEALTH_VALUES.includes(h) ? h : "Active");
    setLostReason(order.lost_reason || "");
    setHoldNote((order as any).hold_note || (order as any).holdNote || "");
    setReachOutAt((order as any).reach_out_at || (order as any).reachOutAt || "");
  }, [order.health, order.lost_reason, (order as any).hold_note, (order as any).reach_out_at]);

  useEffect(() => {
    fetchEmployeeStats().then(data => {
      setEmployeeStats(data);
      setLoadingStats(false);
    }).catch(console.error);
  }, []);

  const handleSaveTeam = async () => {
    try {
      setSavingTeam(true);
      await assignTeamToOrder(order.id, Array.from(selectedEmployeeIds));
      alert("Team assignments updated!");
    } catch (e) {
      alert("Failed to assign team");
    } finally {
      setSavingTeam(false);
    }
  };

  const visibleEmployees = employeeStats;

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleRevokePortalAccess = async () => {
    if (!window.confirm("This will invalidate the customer's magic link sent via WhatsApp/Email. They will need a new link. Continue?")) return;
    setRevoking(true);
    setRevokeResult(null);
    try {
      const result = await revokePortalAccessAction(order.customerId || undefined, order.orderCode || order.orderId || undefined);
      setRevokeResult(result.message);
    } catch (e: any) {
      setRevokeResult(`Error: ${e.message}`);
    } finally {
      setRevoking(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!onAdminReject || !rejectNotes.trim()) return;
    setRejecting(true);
    try {
      await onAdminReject(rejectNotes.trim());
      setShowRejectModal(false);
      setRejectNotes("");
    } catch (e) {
      console.error(e);
    } finally {
      setRejecting(false);
    }
  };

  const handleSaveHealth = async () => {
    if (!onUpdateHealth) return;
    if (healthDraft === "Lost" && !lostReason.trim()) {
      alert("A reason is required when marking an order as Lost.");
      return;
    }
    if (healthDraft === "On Hold" && (!holdNote.trim() || !reachOutAt)) {
      alert("A note and reach-out date are required when putting an order On Hold.");
      return;
    }
    setSavingHealth(true);
    try {
      await onUpdateHealth(
        healthDraft,
        healthDraft === "Lost" ? lostReason.trim() : undefined,
        callRemarks.trim() || undefined,
        healthDraft === "On Hold"
          ? { note: holdNote.trim(), reachOutAt }
          : null
      );
      setCallRemarks("");
    } catch (e: any) {
      alert(e?.message || "Failed to update health");
    } finally {
      setSavingHealth(false);
    }
  };

  const isJobDonePending = order.stageStatus === "Pending Admin Approval: Job Done";
  const healthBannerClass =
    currentHealth === "Lost"
      ? "bg-red-50 border-red-200 text-red-900"
      : currentHealth === "Needs Attention"
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : currentHealth === "On Hold"
          ? "bg-slate-50 border-slate-200 text-slate-800"
          : "bg-emerald-50 border-emerald-200 text-emerald-900";

  return (
    <>
    <div className="space-y-6 max-w-none">

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-slate-500" />
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Workflow Stage & Approvals</h3>
          </div>
        </div>

        <div className="p-5">
          {order.health === "Lost" ? (
             <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
               <AlertTriangle size={32} className="text-red-400 mb-2" />
               <h4 className="text-sm font-bold text-slate-700">Order is Cancelled</h4>
               <p className="text-xs text-slate-500 mt-1">This order is lost/cancelled. Approvals are blocked.</p>
             </div>
          ) : order.stageStatus && order.stageStatus !== "Normal" ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Pending Stage Approval
                </h4>
                <p className="text-xs text-amber-700 mt-1">
                  {isJobDonePending ? (
                    <>
                      Installation team has marked the job as done. Review payments in the{" "}
                      <span className="font-bold">Payments</span> tab, then approve to mark the order{" "}
                      <span className="font-bold">Completed</span>.
                    </>
                  ) : (
                    <>
                      Staff has requested to advance from <span className="font-bold">{order.stage}</span>. Review the attached work in the respective tabs before approving.
                    </>
                  )}
                </p>
              </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 w-full sm:w-auto">
                  {onAdminReject && (
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="px-4 py-2.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto"
                    >
                      <XCircle size={16} />
                      Request Changes
                    </button>
                  )}
                  {order.stage.startsWith("Site Visit") && onApproveWithWorkflowChoice ? (
                    <button
                      onClick={onApproveWithWorkflowChoice}
                      className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto"
                    >
                      <CheckCircle2 size={16} />
                      <span className="sm:hidden">Approve Workflow</span>
                      <span className="hidden sm:inline">Choose Workflow &amp; Approve</span>
                    </button>
                  ) : (
                    <button
                      onClick={onAdminApprove}
                      className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto"
                    >
                      <CheckCircle2 size={16} />
                      {isJobDonePending
                        ? "Review Payments & Complete"
                        : (order.workflow_type || "quote_first") === "design_first"
                          ? order.stage === "Quotation Approved"
                            ? "Set deadline & start fabrication"
                            : "Approve Stage"
                          : order.stage === "Design Approved"
                            ? "Set deadline & start fabrication"
                            : "Approve Stage"}
                    </button>
                  )}
                </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No Pending Approvals</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                The order is in the <span className="font-bold">{order.stage}</span> stage with no staff push waiting.
                To move forward yourself, use <span className="font-bold">Approve &amp; Advance</span> on the current stage tab.
              </p>
            </div>
          )}
        </div>
      </div>

      {onUpdateHealth && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <HeartPulse size={18} className="text-slate-500" />
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Order Health</h3>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className={`rounded-xl border p-3 text-xs font-medium ${healthBannerClass}`}>
              Current: <span className="font-bold">{currentHealth}</span>
              {order.lost_reason && currentHealth === "Lost" ? ` — ${order.lost_reason}` : ""}
              {currentHealth === "On Hold" && ((order as any).reach_out_at || (order as any).reachOutAt) ? (
                <span>
                  {" "}
                  — reach out {(order as any).reach_out_at || (order as any).reachOutAt}
                  {(order as any).hold_note || (order as any).holdNote
                    ? `: ${(order as any).hold_note || (order as any).holdNote}`
                    : ""}
                </span>
              ) : null}
              <p className="mt-1 opacity-80">{HEALTH_HINT[ORDER_HEALTH_VALUES.includes(currentHealth) ? currentHealth : "Active"]}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Set health
                </label>
                <select
                  value={healthDraft}
                  onChange={(e) => setHealthDraft(e.target.value as OrderHealth)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                >
                  {ORDER_HEALTH_VALUES.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {healthDraft === "Lost" ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Lost reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    placeholder="e.g. Price too high, Unresponsive, Competitor"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                  />
                </div>
              ) : healthDraft === "On Hold" ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Reach out again on <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={reachOutAt}
                    onChange={(e) => setReachOutAt(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Call remarks (optional)
                  </label>
                  <input
                    type="text"
                    value={callRemarks}
                    onChange={(e) => setCallRemarks(e.target.value)}
                    placeholder="Notes from calling the customer…"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700"
                  />
                </div>
              )}
            </div>

            {healthDraft === "On Hold" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Hold note <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={holdNote}
                    onChange={(e) => setHoldNote(e.target.value)}
                    rows={2}
                    placeholder="Why is this on hold?"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 resize-y min-h-[68px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Call remarks (optional)
                  </label>
                  <textarea
                    value={callRemarks}
                    onChange={(e) => setCallRemarks(e.target.value)}
                    rows={2}
                    placeholder="Notes from calling the customer…"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 resize-y min-h-[68px]"
                  />
                </div>
              </div>
            )}

            {healthDraft === "Lost" && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Call remarks (optional)
                </label>
                <textarea
                  value={callRemarks}
                  onChange={(e) => setCallRemarks(e.target.value)}
                  rows={2}
                  placeholder="Notes from calling the customer…"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 resize-y"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSaveHealth}
                disabled={savingHealth}
                className="px-4 py-2.5 bg-[#1E40AF] text-white rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {savingHealth ? "Saving…" : "Update Health"}
              </button>
              {currentHealth === "Lost" && onReopen && (
                <button
                  type="button"
                  onClick={() => onReopen()}
                  disabled={savingHealth}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Reopen to Active
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-slate-500" />
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Portal Access Security</h3>
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-col md:flex-row md:items-start gap-3 md:justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-800">Customer Magic Link</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                The customer accesses the portal via a secure magic link sent via WhatsApp or Email. Revoking invalidates all active links for this customer/order. Use this if the link is compromised or the customer relationship ends.
              </p>
              {revokeResult && (
                <p className={`text-xs mt-2 font-medium ${revokeResult.includes("Error") ? "text-red-600" : "text-emerald-600"}`}>
                  {revokeResult}
                </p>
              )}
            </div>
            <button
              onClick={handleRevokePortalAccess}
              disabled={revoking}
              className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <ShieldOff size={14} />
              {revoking ? "Revoking..." : "Revoke Portal Access"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-slate-500" />
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Assign Employees</h3>
          </div>
          <button
            onClick={handleSaveTeam}
            disabled={savingTeam}
            className="px-4 py-1.5 bg-[#1E40AF] text-white rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
          >
            {savingTeam ? "Saving..." : "Save Assignments"}
          </button>
        </div>
        <div className="p-4 max-h-72 overflow-y-auto">
          {loadingStats ? (
            <div className="text-xs text-slate-500 text-center py-6">Loading staff availability...</div>
          ) : visibleEmployees.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-6">No assignable employees found.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleEmployees.map(emp => {
                const isSelected = selectedEmployeeIds.has(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleEmployee(emp.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-50/50 border-blue-200"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${
                      isSelected ? "bg-[#1E40AF] text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800">{emp.name}</div>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                        {emp.staff_role && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{emp.staff_role}</span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          emp.activeJobs > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-400"
                        }`}>
                          {emp.activeJobs} active job{emp.activeJobs !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                      isSelected ? "bg-[#1E40AF] border-[#1E40AF]" : "border-slate-300"
                    }`}>
                      {isSelected && <Briefcase size={10} color="white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>

    {showRejectModal && (
      <OverlayPortal>
      <div className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
        <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[92dvh] flex flex-col">
          <div className="px-4 md:px-5 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Request Changes</h3>
            <p className="text-xs text-slate-500 mt-1">Send the order back to staff with mandatory feedback.</p>
          </div>
          <div className="p-4 md:p-5 space-y-4 overflow-y-auto">
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Describe what needs to be revised..."
              rows={4}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              autoFocus
            />
            <div className="flex flex-col-reverse md:flex-row justify-end gap-2 pb-[max(0,env(safe-area-inset-bottom))]">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectNotes("");
                }}
                disabled={rejecting}
                className="px-4 py-2.5 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={rejecting || !rejectNotes.trim()}
                className="px-4 py-2.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {rejecting ? "Sending..." : "Send Back to Staff"}
              </button>
            </div>
          </div>
        </div>
      </div>
      </OverlayPortal>
    )}
    </>
  );
};
