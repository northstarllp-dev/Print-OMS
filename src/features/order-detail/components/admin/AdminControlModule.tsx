import React, { useState, useEffect } from "react";
import { Order, Customer, Employee, SiteVisitDetails, PipelineStage } from "@/types";
import { Users, Settings, Briefcase, FileText, CheckCircle2, XCircle, AlertTriangle, Shield, ShieldOff } from "lucide-react";
import { fetchEmployeeStats, assignTeamToOrder } from "@/features/orders/actions/orderActions";
import { revokePortalAccessAction } from "@/features/portal/actions/portalAdminActions";

interface AdminControlModuleProps {
  order: Order;
  customers: Customer[];
  employees: Employee[];
  onAdminApprove: () => Promise<void>;
  onApproveWithWorkflowChoice?: () => void;
  updateSiteVisitDetails: (orderId: string, details: Partial<SiteVisitDetails>) => Promise<void>;
  updateOrderStage: (orderId: string, stage: string) => Promise<void>;
}

const STAGE_LABEL: Record<string, { label: string; color: string }> = {
  "Site Visit Pending":    { label: "Site Visit Pending",  color: "#818CF8" },
  "Site Visit Scheduled":  { label: "Site Visit Scheduled",   color: "#818CF8" },
  "Site Visit Completed":  { label: "Site Visit Completed",   color: "#818CF8" },
  "Quotation In Progress": { label: "Quotation In Progress",     color: "#F97316" },
  "Quotation Sent":        { label: "Quotation Sent",  color: "#F97316" },
  "Quotation Negotiation": { label: "Quotation Negotiation", color: "#F97316" },
  "Quotation Approved":    { label: "Quotation Approved",    color: "#F97316" },
  "Design In Progress":    { label: "Design In Progress",      color: "#EC4899" },
  "Design Approved":       { label: "Design Approved",   color: "#EC4899" },
  "Production":            { label: "Production",  color: "#3B82F6" },
  "Ready For Installation":{ label: "Ready For Installation",       color: "#3B82F6" },
  "Installation Scheduled":{ label: "Installation Scheduled",     color: "#0EA5E9" },
  "Completed":             { label: "Completed",   color: "#22C55E" },
  "Closed":                { label: "Closed",      color: "#22C55E" },
};

export const AdminControlModule: React.FC<AdminControlModuleProps> = ({
  order,
  customers,
  employees,
  onAdminApprove,
  onApproveWithWorkflowChoice,
  updateSiteVisitDetails,
  updateOrderStage
}) => {
  const [savingNotes, setSavingNotes] = useState(false);

  // Employee stats for assignment
  const [employeeStats, setEmployeeStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Local state for assignments
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    new Set(order.assignedEmployees || [])
  );
  const [savingTeam, setSavingTeam] = useState(false);

  // Local state for revoke portal access
  const [revoking, setRevoking] = useState(false);
  const [revokeResult, setRevokeResult] = useState<string | null>(null);


  useEffect(() => {
    setSelectedEmployeeIds(new Set(order.assignedEmployees || []));
  }, [order.assignedEmployees]);

  useEffect(() => {
    fetchEmployeeStats().then(data => {
      setEmployeeStats(data);
      setLoadingStats(false);
    }).catch(console.error);
  }, []);

  const handleSaveTeam = async () => {
    try {
      setSavingTeam(true);
      // Auto-assign Installation and Production roles
      const autoAssignedIds = employeeStats
        .filter(emp => emp.staff_role === "Installation" || emp.staff_role === "Production")
        .map(emp => emp.id);
        
      const finalIds = Array.from(new Set([...Array.from(selectedEmployeeIds), ...autoAssignedIds]));
      
      await assignTeamToOrder(order.id, finalIds);
      alert("Team assignments updated!");
    } catch (e) {
      alert("Failed to assign team");
    } finally {
      setSavingTeam(false);
    }
  };

  const visibleEmployees = employeeStats.filter(emp => emp.staff_role === "Designer" || emp.staff_role === "Marketer");

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


  return (
    <div className="space-y-6 max-w-none">
      
      {/* ── APPROVALS AND STAGE OVERRIDE ── */}
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
                  Staff has requested to advance from <span className="font-bold">{order.stage}</span>. Review the attached work in the respective tabs before approving.
                </p>
              </div>
              
                <div className="flex gap-2 shrink-0">
                  {order.stage.startsWith("Site Visit") && onApproveWithWorkflowChoice ? (
                    <button
                      onClick={onApproveWithWorkflowChoice}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={16} />
                      Choose Workflow & Approve
                    </button>
                  ) : (
                    <button 
                      onClick={onAdminApprove} 
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={16} />
                      Approve Stage
                    </button>
                  )}
                </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No Pending Approvals</h4>
              <p className="text-xs text-slate-500 mt-1">The order is currently in the <span className="font-bold">{order.stage}</span> stage.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── PORTAL ACCESS SECURITY ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-slate-500" />
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Portal Access Security</h3>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
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
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <ShieldOff size={14} />
              {revoking ? "Revoking..." : "Revoke Portal Access"}
            </button>
          </div>
        </div>
      </div>

      {/* ── TEAM ASSIGNMENT ── */}
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
  );
};
