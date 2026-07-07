"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { OrderCommunicationCenter } from "@/components/communication/OrderCommunicationCenter";
import {
  Search, Send, X, Maximize2, RefreshCw,
  Check, Share2, Pencil, CheckCircle2,
  MapPin, FileText, LayoutDashboard, CheckSquare,
  ArrowLeft, MoreVertical, Lock, Save,
  BarChart3, Palette, Package, Wrench, User, CreditCard,
} from "lucide-react";
import {
  Order, PipelineStage, SiteVisitDetails,
  DesignRecord, ProductionDetails, InstallationDetails, Customer, Employee,
} from "@/types";
import { SiteVisitModule } from "@/features/orders/workspace/modules/site-visit/SiteVisitModule";
import { SiteVisitReviewModal } from "@/features/orders/workspace/modules/site-visit/SiteVisitReviewModal";
import { QuotationModule } from "@/features/orders/workspace/modules/quotation/QuotationModule";
import { DesignModule } from "@/features/orders/workspace/modules/design/DesignModule";
import LoadingLines from "@/components/ui/loading-lines";
import { AdminControlModule } from "./admin/AdminControlModule";
import { PaymentsModule } from "./payments/PaymentsModule";
import { CustomerDetailsDrawer } from "./CustomerDetailsDrawer";
import { WorkflowChoiceModal } from "./WorkflowChoiceModal";
import { ProductionModule } from "@/features/orders/workspace/modules/production/ProductionModule";
import { InstallationModule } from "@/features/orders/workspace/modules/installation/InstallationModule";

import { resolveStagePermission, isTimelineStageAccessible } from "@/features/orders/workspace/shared/permissions";
import type { OrderStage } from "@/features/orders/workspace/shared/types";
import {
  updateSiteVisitDetailsAction,
  updateProductionDetailsAction,
  updateInstallationDetailsAction,
  requestStageAdvancementAction,
  adminApproveStageAction,
  adminRejectStageAction,
  updateOrderStageAction,
  addChatMessageAction,
  updateOrderHealthAction,
  reopenOrderAction,
  approveSiteVisitAction,
  freezeSiteVisitAction,
  setWorkflowTypeAction,
} from "@/features/orders/actions/orderActions";
import {
  markInstallationCompleted,
  requestInstallationLocationAction,
  updateInstallationDetails as updateInstallationDetailsServer,
} from "@/features/installations/actions/installationActions";
import {
  updateDesignDetailsAction,
  sendDesignToCustomerAction,
} from "@/features/designs/actions/designActions";
import {
  mergeOrderDetailPatch,
  useOrderDetailSync,
} from "@/features/orders/realtime/useOrderDetailSync";
import { areAllDesignItemsApproved } from "@/features/designs/utils/designApproval";

/* ─── helpers ──────────────────────────────────────────────────── */
const STAGE_LABEL: Record<string, { label: string; color: string }> = {
  "Site Visit Pending": { label: "Site Visit", color: "#818CF8" },
  "Site Visit Scheduled": { label: "Scheduled", color: "#818CF8" },
  "Site Visit Completed": { label: "Site Done", color: "#818CF8" },
  "Quotation In Progress": { label: "Quoting", color: "#F97316" },
  "Quotation Sent": { label: "Quote Sent", color: "#F97316" },
  "Quotation Negotiation": { label: "Negotiating", color: "#F97316" },
  "Quotation Approved": { label: "Quote OK", color: "#F97316" },
  "Design In Progress": { label: "Design", color: "#EC4899" },
  "Design Approved": { label: "Design OK", color: "#EC4899" },
  "Production": { label: "Production", color: "#3B82F6" },
  "Ready For Installation": { label: "Ready", color: "#3B82F6" },
  "Installation Scheduled": { label: "Install", color: "#0EA5E9" },
  "Completed": { label: "Completed", color: "#22C55E" },
  "Closed": { label: "Closed", color: "#22C55E" },
};



/** Payments tab sits next to Admin Controls (not a pipeline stage). */
const PAYMENTS_TAB = 98;
const ADMIN_TAB = 99;

function computePendingStageStatus(
  stage: string,
  workflowType: "quote_first" | "design_first" = "quote_first"
): string {
  const isDesignFirst = workflowType === "design_first";
  if (stage === "Site Visit Pending" || stage === "Site Visit Scheduled") {
    return "Pending Admin Approval: Site Visit Completed";
  }
  if (stage === "Site Visit Completed") {
    return isDesignFirst
      ? "Pending Admin Approval: Design Stage"
      : "Pending Admin Approval: Quote Stage";
  }
  if (stage === "Quotation In Progress" || stage === "Quotation Sent" || stage === "Quotation Negotiation") {
    return "Pending Admin Approval: Quote Approval";
  }
  if (stage === "Quotation Approved") {
    return isDesignFirst
      ? "Pending Admin Approval: Production Ready"
      : "Pending Admin Approval: Design Approval";
  }
  if (stage === "Design In Progress") {
    return "Pending Admin Approval: Design Approval";
  }
  if (stage === "Design Approved") {
    return isDesignFirst
      ? "Pending Admin Approval: Quote Stage"
      : "Pending Admin Approval: Production Ready";
  }
  if (stage === "Production") {
    return "Pending Admin Approval: Production Ready";
  }
  if (stage === "Ready For Installation" || stage === "Installation Scheduled") {
    return "Pending Admin Approval: Job Done";
  }
  return "Normal";
}

const WORKFLOW_STEPS = [
  { label: "Enquiry", tab: -1, icon: "📋" },
  { label: "Site Visit", tab: 0, icon: "📍" },
  { label: "Quote", tab: 1, icon: "📄" },
  { label: "Design", tab: 2, icon: "🎨" },
  { label: "Production", tab: 3, icon: "🏭" },
  { label: "Installation", tab: 4, icon: "🔧" },
];

function stageToTabIndex(stage: PipelineStage, workflowType: "quote_first" | "design_first" = "quote_first"): number {
  if (workflowType === "design_first") {
    switch (stage) {
      case "Site Visit Pending":
      case "Site Visit Scheduled":
      case "Site Visit Completed":
        return 0;
      case "Design In Progress":
      case "Design Approved":
        return 1;
      case "Quotation In Progress":
      case "Quotation Sent":
      case "Quotation Negotiation":
      case "Quotation Approved":
        return 2;
      case "Production":
      case "Ready For Installation":
        return 3;
      case "Installation Scheduled":
      case "Completed":
      case "Closed":
        return 4;
      default:
        return 0;
    }
  }
  // Default: quote_first
  switch (stage) {
    case "Site Visit Pending":
    case "Site Visit Scheduled":
    case "Site Visit Completed":
      return 0;
    case "Quotation In Progress":
    case "Quotation Sent":
    case "Quotation Negotiation":
    case "Quotation Approved":
      return 1;
    case "Design In Progress":
    case "Design Approved":
      return 2;
    case "Production":
    case "Ready For Installation":
      return 3;
    case "Installation Scheduled":
    case "Completed":
    case "Closed":
      return 4;
    default:
      return 0;
  }
}

/** Maps a workflow step tabIndex to its OrderStage (for RBAC timeline lock). Null for non-stage tabs. */
function tabIndexToOrderStage(tabIndex: number, workflowType: "quote_first" | "design_first" = "quote_first"): OrderStage | null {
  const isDesignFirst = workflowType === "design_first";
  switch (tabIndex) {
    case 0: return "site_visit";
    case 1: return isDesignFirst ? "design" : "quotation";
    case 2: return isDesignFirst ? "quotation" : "design";
    case 3: return "production";
    case 4: return "installation";
    default: return null;
  }
}

/** Reverse of tabIndexToOrderStage — used to land on the entryStage's tab when queue-scoped. */
function orderStageToTabIndex(stage: OrderStage, workflowType: "quote_first" | "design_first" = "quote_first"): number {
  const isDesignFirst = workflowType === "design_first";
  switch (stage) {
    case "site_visit": return 0;
    case "quotation": return isDesignFirst ? 2 : 1;
    case "design": return isDesignFirst ? 1 : 2;
    case "production": return 3;
    case "installation": return 4;
    default: return 0;
  }
}

/* ─── Props ─────────────────────────────────────────────────────── */
interface Product {
  id: string;
  product_id: string;
  name: string;
  category: string | null;
  pricing_type?: string | null;
  is_active: boolean;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  images?: string[];
}

interface SiteVisitItem {
  id: string;
  name: string;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  notes?: string | null;
}

interface OrderWorksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  customers: Customer[];
  employees: Employee[];
  allOrders?: any[];
  currentUserRole: "Admin" | "Employee";
  currentEmployee: Employee | null;
  products?: Product[];
  initialQuotation?: any;
  siteVisitItems?: SiteVisitItem[];
  /** Queue-scoped entry: when set, only this stage's timeline node is accessible for staff. */
  entryStage?: OrderStage;
  /** Tenant key for per-company stage grant overrides (Phase 4b). */
  companyId?: string | null;
}

/* ─── Component ─────────────────────────────────────────────────── */
export const OrderWorksheetModal: React.FC<OrderWorksheetModalProps> = ({
  isOpen,
  onClose,
  order: initialOrder,
  customers,
  employees,
  allOrders = [],
  currentUserRole,
  currentEmployee,
  products = [],
  initialQuotation = null,
  siteVisitItems = [],
  entryStage,
  companyId = null,
}) => {
  const router = useRouter();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [localAlert, setLocalAlert] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [activeStepTab, setActiveStepTab] = useState(
    entryStage != null
      ? orderStageToTabIndex(entryStage, initialOrder.workflow_type)
      : stageToTabIndex(initialOrder.stage, initialOrder.workflow_type)
  );
  const [showCustomerPanel, setShowCustomerPanel] = useState(false);
  const [activeRightPanel, setActiveRightPanel] = useState<"logs" | "chat" | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isWorkflowChoiceOpen, setIsWorkflowChoiceOpen] = useState(false);
  const [adminOverrideUnlocked, setAdminOverrideUnlocked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showLostReasonDropdown, setShowLostReasonDropdown] = useState(false);
  const [selectedLostReason, setSelectedLostReason] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderTab, setOrderTab] = useState<"all" | "active" | "pending">("all");

  const [messages, setMessages] = useState<any[]>([]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const [quotationRealtimeRow, setQuotationRealtimeRow] = useState<Record<string, unknown> | null>(null);

  const triggerLocalAlert = useCallback((
    message: string,
    type: "info" | "success" | "warning" | "error"
  ) => {
    setLocalAlert({ message, type });
    setTimeout(() => setLocalAlert(null), 3500);
  }, []);

  useEffect(() => { setOrder(initialOrder); }, [initialOrder]);
  useEffect(() => { setActiveStepTab(stageToTabIndex(order.stage, order.workflow_type)); }, [order.stage, order.workflow_type]);

  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    async function loadMessages() {
      const { data } = await supabase
        .from("order_activity")
        .select("*")
        .eq("order_id", order.orderId || order.id);
      if (data) setMessages(data);
    }
    loadMessages();
  }, [isOpen, order.id, order.orderId]);

  useOrderDetailSync({
    orderId: order.id,
    businessOrderId: order.orderId || order.id,
    enabled: isOpen,
    getOrderSnapshot: () => orderRef.current as unknown as Record<string, unknown>,
    onPatch: (patch) => {
      setOrder((prev) => mergeOrderDetailPatch(prev, patch));
      if (patch.quoteDetails) {
        const qd = patch.quoteDetails;
        setQuotationRealtimeRow({
          quotation_id: qd.quotationId,
          status: qd.status,
          notes: qd.notes,
          terms: qd.terms,
          shipping: qd.shipping,
          signage_options: qd.signageOptions,
        });
      }
    },
    onActivityChange: (payload) => {
      if (payload.eventType === "INSERT" && payload.new) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new!.id)) return prev;
          return [...prev, payload.new];
        });
      } else if (payload.eventType === "UPDATE" && payload.new) {
        setMessages((prev) =>
          prev.map((m) => (m.id === payload.new!.id ? payload.new : m))
        );
      } else if (payload.eventType === "DELETE" && payload.old) {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old!.id));
      }
    },
    onExternalStageChange: (message) => triggerLocalAlert(message, "info"),
  });

  const logsCount = messages.filter((m) => m.tab === "timeline").length;
  const chatCount = messages.filter((m) => m.tab === "internal").length;

  if (!isOpen) return null;

  /* ── Data ── */
  const client = customers.find((c) => c.id === order.customerId);
  const isEmployee = currentUserRole === "Employee";
  const isStaffOrAdmin = currentUserRole === "Employee" || currentUserRole === "Admin";
  const currentStageIndex = stageToTabIndex(order.stage, order.workflow_type);
  const actor = {
    role: currentUserRole === "Admin" ? "admin" : "staff",
    staff_role: currentEmployee?.role ?? null,
    company_id: companyId ?? null,
  };
  /**
   * Workflow progression gate (Phase 6): separate from resolveStagePermission (RBAC).
   * A staff member's granted stage only becomes accessible once the order has actually
   * reached (or passed) it. Admin bypasses, consistent with their existing ability to
   * freely preview any stage.
   */
  const hasStageBeenReached = (stage: OrderStage): boolean => {
    if (actor.role === "admin") return true;
    return orderStageToTabIndex(stage, order.workflow_type) <= currentStageIndex;
  };

  /* ── Local State Wrappers ── */
  const updateSiteVisitDetails = async (orderId: string, details: Partial<SiteVisitDetails>) => {
    setOrder((prev) => ({ ...prev, siteVisitDetails: { ...(prev.siteVisitDetails || {}), ...details } as SiteVisitDetails }));
  };
  // Quote details are now managed entirely by QuotationModule via quotationActions.
  const updateDesignDetails = async (orderId: string, details: Partial<DesignRecord>) => {
    const updated = await updateDesignDetailsAction(orderId, details, order.design?.updated_at);
    setOrder((prev) => ({ ...prev, design: updated }));
  };
  const updateProductionDetails = async (orderId: string, details: Partial<ProductionDetails>) => {
    setOrder((prev) => ({ ...prev, productionDetails: { ...(prev.productionDetails || {}), ...details } as ProductionDetails }));
    await updateProductionDetailsAction(orderId, details);
  };
  const updateInstallationDetails = async (orderId: string, details: Partial<InstallationDetails> & { afterPhotos?: string[]; photos?: string[] }) => {
    const photoList = details.afterPhotos ?? details.photos;
    const payload = {
      ...details,
      ...(photoList !== undefined ? { afterPhotos: photoList, photos: photoList } : {}),
    };
    setOrder((prev) => {
      const prevInst = prev.installationDetails || {};
      const photos =
        photoList ??
        (prevInst as any).afterPhotos ??
        (prevInst as any).photos;
      return {
        ...prev,
        installationDetails: {
          ...prevInst,
          ...payload,
          ...(photos !== undefined ? { afterPhotos: photos, photos } : {}),
        } as InstallationDetails,
      };
    });
    // Same path as installation portal: ensure row exists, then update
    await updateInstallationDetailsServer(orderId, payload);
  };
  const handleMarkInstallationCompleted = async (
    orderId: string,
    checklist: any[],
    photos: any[],
    notes: string
  ) => {
    await markInstallationCompleted(orderId, checklist, photos, notes);
    setOrder((prev) => ({
      ...prev,
      stage: "Completed" as PipelineStage,
      installationDetails: {
        ...(prev.installationDetails || {}),
        checklist,
        afterPhotos: photos,
        photos,
        notes,
      } as InstallationDetails,
    }));
  };

  const executeAdminApprove = async () => {
    await adminApproveStageAction(order.id);
    setOrder(prev => ({ ...prev, stageStatus: "Normal" }));
    router.refresh();
    triggerLocalAlert("Stage approved and advanced.", "success");
  };

  const handleAdminApprove = async () => {
    setIsProcessing(true);
    try {
      await handleSaveDraft();
      // On Site Visit tab with normal status, open review modal first.
      if (activeStepTab === 0 && order.stageStatus === "Normal") {
        setIsReviewModalOpen(true);
        setIsProcessing(false);
        return;
      }
      // Leaving Site Visit with pending admin approval → choose workflow path
      if (
        order.stage.startsWith("Site Visit") &&
        order.stageStatus &&
        order.stageStatus !== "Normal"
      ) {
        setIsWorkflowChoiceOpen(true);
        setIsProcessing(false);
        return;
      }
      await executeAdminApprove();
      setIsProcessing(false);
    } catch (err: any) {
      triggerLocalAlert(err?.message || "Failed to approve stage.", "error");
      setIsProcessing(false);
    }
  };

  const handleUpdateOrderStage = async (orderId: string, stage: string) => {
    setIsProcessing(true);
    try {
      await updateOrderStageAction(orderId, stage);
      setOrder(prev => ({ ...prev, stage: stage as PipelineStage }));
      router.refresh();
      triggerLocalAlert(`Stage changed to ${stage}`, "success");
    } catch (err: any) {
      console.error(err);
      triggerLocalAlert(err?.message || "Failed to change stage", "error");
    } finally { setIsProcessing(false); }
  };
  const handleRequestAdvancement = async () => {
    const workflowType = order.workflow_type || "quote_first";
    const isDesignFirst = workflowType === "design_first";
    const designTabIndex = isDesignFirst ? 1 : 2;

    if ((activeStepTab === 0 || activeStepTab === designTabIndex) && !canAdvanceSiteVisit) {
      alert(siteVisitAdvanceTooltip);
      return;
    }

    setIsProcessing(true);
    try {
      if (activeStepTab !== designTabIndex) {
        await handleSaveDraft();
      }
      // If on the Site Visit tab, don't execute immediately; open the review modal instead.
      if (activeStepTab === 0) {
        setIsReviewModalOpen(true);
        setIsProcessing(false);
        return;
      }

      await requestStageAdvancementAction(order.id);
      const nextStatus = computePendingStageStatus(order.stage, workflowType);
      setOrder((prev) => ({ ...prev, stageStatus: nextStatus, stageAdminNotes: "" }));
      await addChatMessageAction(order.id, "System", `${currentEmployee?.name || "Staff"} requested stage advancement.`);
      router.refresh();
      triggerLocalAlert("Stage advancement requested.", "success");
    } catch (err: any) {
      triggerLocalAlert(err?.message || "Failed to submit.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdminReject = async (notes: string) => {
    setIsProcessing(true);
    try {
      await adminRejectStageAction(order.id, notes);
      setOrder((prev) => ({ ...prev, stageStatus: "Normal", stageAdminNotes: notes }));
      setAdminOverrideUnlocked(false);
      router.refresh();
      triggerLocalAlert("Changes requested. Staff can now revise.", "success");
    } catch (err: any) {
      triggerLocalAlert(err?.message || "Failed to request changes.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  /** Quotation tab: staff requests approval; admin advances to Design/Production. */
  const handleQuotationAdvance = async () => {
    if (isEmployee) {
      await handleRequestAdvancement();
      return;
    }

    setIsProcessing(true);
    try {
      // Admin can advance without waiting for customer approval.
      if (order.stage !== "Quotation Approved") {
        const { adminMarkQuotationApprovedAction } = await import(
          "@/features/quotations/actions/quotationActions"
        );
        await adminMarkQuotationApprovedAction(order.id);
        setOrder((prev) => ({
          ...prev,
          stage: "Quotation Approved" as PipelineStage,
          stageStatus: "Normal",
        }));
      }

      await executeAdminApprove();
      setIsProcessing(false);
    } catch (err: any) {
      triggerLocalAlert(err?.message || "Failed to advance stage.", "error");
      setIsProcessing(false);
    }
  };
  const handleUpdateHealth = async (health: string, reason?: string) => {
    setIsProcessing(true);
    try {
      const res = await updateOrderHealthAction(order.id, health, reason);
      if (res && res.length > 0) {
        setOrder((prev) => ({ ...prev, health: res[0].health, lost_reason: res[0].lost_reason, chatHistory: res[0].chat_history }));
        triggerLocalAlert(`Order health set to ${health}.`, "success");
        router.refresh();
      }
    } catch (err) { triggerLocalAlert("Failed to update health.", "error"); }
    finally { setIsProcessing(false); }
  };
  const handleReopen = async () => {
    setIsProcessing(true);
    try {
      const res = await reopenOrderAction(order.id);
      if (res && res.length > 0) {
        setOrder((prev) => ({ ...prev, health: res[0].health, lost_reason: res[0].lost_reason, chatHistory: res[0].chat_history }));
        triggerLocalAlert("Order reopened.", "success");
        router.refresh();
      }
    } catch (err) { triggerLocalAlert("Failed to reopen.", "error"); }
    finally { setIsProcessing(false); }
  };



  const handleCopyMagicLink = async () => {
    if (!client) return;
    try {
      const res = await fetch(`/api/portal-token?customer_id=${client.customerId || client.id}&order_id=${order.orderId || order.id}`);
      const data = await res.json();
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        triggerLocalAlert("Magic portal link copied!", "success");
      }
    } catch (err) { triggerLocalAlert("Failed to copy portal link.", "error"); }
  };

  const handleSaveDraft = async () => {
    setIsProcessing(true);
    const workflowType = order.workflow_type || "quote_first";
    // Tab indices depend on workflow:
    // quote_first:  0=SiteVisit, 1=Quote, 2=Design, 3=Production, 4=Installation
    // design_first: 0=SiteVisit, 1=Design, 2=Quote,  3=Production, 4=Installation
    const isDesignFirst = workflowType === "design_first";
    const designTab = isDesignFirst ? 1 : 2;
    const quoteTab = isDesignFirst ? 2 : 1;
    try {
      switch (activeStepTab) {
        case 0: // Site Visit
          if (order.siteVisitDetails) {
            await updateSiteVisitDetailsAction(order.id, order.siteVisitDetails);
          }
          break;
        case quoteTab: // Quotation — saved directly from QuotationModule
          break;
        case designTab: // Design
          if (order.design) {
            const updated = await sendDesignToCustomerAction(order.id);
            setOrder(prev => ({ ...prev, design: updated }));
          }
          break;
        case 3: // Production
          if (order.productionDetails) {
            await updateProductionDetailsAction(order.id, order.productionDetails);
          }
          break;
        case 4: // Installation
          if (order.installationDetails) {
            await updateInstallationDetailsAction(order.id, order.installationDetails);
          }
          break;
      }
      triggerLocalAlert("Draft saved successfully!", "success");
      router.refresh();
    } catch (err) {
      triggerLocalAlert("Failed to save draft.", "error");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  /* ── Module fallbacks ── */
  const sv = order.siteVisitDetails || { width: 0, height: 0, depth: 0, auditDate: "", auditTime: "", sitePersonnel: "", photos: [], completed: false, notes: "", locations: [] };
  const dd = (order.design as DesignRecord) || { resources: [], items: [], payment_verified: false };
  const pd = order.productionDetails || { procurementOfMaterials: false, acpAndAcrylicCutting: false, lightingAndWiring: false, qualityCheck: false };
  const inst = order.installationDetails || { photoUrl: "", customerSignature: "", paymentCode: "" };

  // Compute workflow-aware tab assignments
  const workflowType = order.workflow_type || "quote_first";
  const isDesignFirst = workflowType === "design_first";
  const designTab = isDesignFirst ? 1 : 2;
  const quoteTab  = isDesignFirst ? 2 : 1;

  const isDesignPending =
    order.stageStatus !== "Normal" &&
    (order.stage === "Design In Progress" || order.stage === "Design Approved");

  const isSiteVisitFrozen =
    (!order.stage.startsWith("Site Visit") || (!!sv.completed && order.stageStatus !== "Normal")) &&
    !adminOverrideUnlocked;

  const isCurrentTabFrozen =
    (activeStepTab === 0 && isSiteVisitFrozen) ||
    (activeStepTab === designTab && isDesignPending && !adminOverrideUnlocked);

  // Strict Site Visit Validations
  const isSiteVisitScheduled = !!(sv.auditDate && sv.auditTime);
  const hasSiteVisitLocations = !!(sv.locations && sv.locations.length > 0);
  let canAdvanceSiteVisit = true;
  let siteVisitAdvanceTooltip = "";
  if (activeStepTab === 0) {
    canAdvanceSiteVisit = isSiteVisitScheduled && hasSiteVisitLocations;
    siteVisitAdvanceTooltip = !canAdvanceSiteVisit ? "Schedule the visit and add at least one location item to unlock approval." : "";
  } else if (activeStepTab === designTab) {
    const itemsList = dd.items || [];
    const allDesignItemsApproved = areAllDesignItemsApproved(itemsList as any);
    const hasProductionFiles = itemsList.some((item: any) => item.productionFiles && item.productionFiles.length > 0);
    
    canAdvanceSiteVisit = allDesignItemsApproved && hasProductionFiles;
    siteVisitAdvanceTooltip = !canAdvanceSiteVisit ? "All designs must be approved and final production files must be uploaded." : "";
  }

  const actionButtonsNode = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
      {order.health && order.health !== "Active" ? (
        <>
          <span style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", display: "none" }}>
            Order is <strong style={{ color: "#DC2626" }}>{order.health}</strong>
          </span>
          <button onClick={handleReopen} style={{ padding: "6px 14px", background: "var(--color-secondary)", border: "none", color: "white", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <RefreshCw size={13} /> Reopen
          </button>
        </>
      ) : (
        (!isCurrentTabFrozen && (
          <>
            <button onClick={handleSaveDraft} style={{ padding: "6px 14px", border: "1px solid #E2E8F0", background: "white", color: "#0F172A", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", transition: "color 0.15s, background-color 0.15s" }}>
              {activeStepTab === designTab ? <><Send size={13} /> Send to Customer</> : <><Save size={13} /> Save Draft</>}
            </button>
            {isEmployee ? (
              <button onClick={handleRequestAdvancement} style={{ padding: "6px 14px", background: "#22C55E", border: "none", color: "white", borderRadius: "6px", fontSize: "12px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", transition: "color 0.15s, background-color 0.15s" }}>
                <CheckCircle2 size={13} /> Request Admin Approval
              </button>
            ) : (
              currentStageIndex === activeStepTab && order.stageStatus === "Normal" && (
                <button onClick={handleAdminApprove} style={{ padding: "6px 14px", background: "#22C55E", border: "none", color: "white", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", transition: "color 0.15s, background-color 0.15s" }}>
                  <Check size={13} /> Approve & Advance
                </button>
              )
            )}
          </>
        ))
      )}
    </div>
  );

  /* ── Filtered order list for left panel ── */
  const filteredOrders = allOrders.filter((o) => {
    const matchesSearch =
      o.clientName?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.businessName?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.orderCode?.toLowerCase().includes(orderSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (orderTab === "active") return o.stage !== "Completed" && o.stage !== "Closed";
    if (orderTab === "pending") return o.stage === "Site Visit Pending" || o.stage === "Quotation In Progress";
    return true;
  });

  /* ── Module content ── */
  const renderModule = () => {
    const activeStage = tabIndexToOrderStage(activeStepTab, order.workflow_type);
    if (activeStage != null && (!isTimelineStageAccessible(activeStage, actor, entryStage) || !hasStageBeenReached(activeStage))) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", color: "#94A3B8", gap: "8px" }}>
          <Lock size={28} />
          <div style={{ fontSize: "14px", fontWeight: "600" }}>You don&apos;t have access to this stage</div>
        </div>
      );
    }

    const productionOrder = {
      ...order,
      orderCode: order.orderCode || order.orderId || order.id,
      designDetails: (order as any).designDetails || (order as any).design,
    };
    const installationRecord = {
      ...(order.installationDetails || {}),
      photos:
        (order.installationDetails as any)?.photos ||
        (order.installationDetails as any)?.afterPhotos ||
        [],
      afterPhotos:
        (order.installationDetails as any)?.afterPhotos ||
        (order.installationDetails as any)?.photos ||
        [],
    };

    // Map tab indices to module based on workflow
    const tabToModule: Record<number, React.ReactElement | null> = {
      0: (
        <SiteVisitModule
          order={order} customers={customers} employees={employees}
          currentUserRole={currentUserRole} currentEmployee={currentEmployee}
          onClose={onClose} onUpdate={(d) => updateSiteVisitDetails(order.id, d)}
          onSubmitForApproval={handleRequestAdvancement}
          onAdminApprove={async (): Promise<void> => { await handleAdminApprove(); }}
          onSkipSiteVisit={async () => {
            const now = new Date().toISOString();
            const newDetails = {
              ...(order.siteVisitDetails || {}),
              auditDate: now.split("T")[0],
              auditTime: now.split("T")[1].substring(0, 5),
              customerAddress: "Skipped - Direct Measurement (Manual Entry)",
              gpsLocation: "N/A"
            };
            await updateSiteVisitDetailsAction(order.id, newDetails);
            setOrder(prev => ({ ...prev, siteVisitDetails: newDetails as any }));
            await handleUpdateOrderStage(order.id, "Site Visit Scheduled");
          }}
          adminOverrideUnlocked={adminOverrideUnlocked}
          setAdminOverrideUnlocked={setAdminOverrideUnlocked}
        />
      ),
      [quoteTab]: (
        <QuotationModule
          order={{
            id: order.id,
            orderId: order.orderId,
            clientName: order.clientName,
            businessName: order.businessName,
            customerName: order.customerName,
            customerId: order.customerId,
            stage: order.stage,
            stageStatus: order.stageStatus,
            workflow_type: order.workflow_type,
          }}
          isEmployee={isStaffOrAdmin}
          currentUserRole={currentUserRole}
          currentUserName={currentEmployee?.name || currentUserRole}
          products={products as any}
          initialQuotation={initialQuotation}
          siteVisitItems={siteVisitItems}
          onRequestAdvance={handleQuotationAdvance}
          externalRealtime
          realtimeQuotation={quotationRealtimeRow}
        />
      ),
      [designTab]: (
        <DesignModule
          order={order}
          isEmployee={isStaffOrAdmin}
          updateDesignDetails={updateDesignDetails}
          siteVisitItems={siteVisitItems}
          isFrozen={isDesignPending && !adminOverrideUnlocked}
          adminOverrideUnlocked={adminOverrideUnlocked}
          setAdminOverrideUnlocked={setAdminOverrideUnlocked}
          stageAdminNotes={order.stageAdminNotes}
          currentUserRole={currentUserRole}
        />
      ),
      3: (
        <ProductionModule
          embedded
          data={{
            order: productionOrder,
            customers,
            employees,
            products,
            quotation: initialQuotation,
            siteVisitItems,
          }}
          permission={resolveStagePermission("production", actor)}
          callbacks={{
            updateProductionDetails,
            onBack: () => {},
          }}
        />
      ),
      4: (
        <InstallationModule
          embedded
          data={{
            order: productionOrder,
            customers,
            installation: installationRecord,
          }}
          permission={resolveStagePermission("installation", actor)}
          callbacks={{
            updateInstallationDetails,
            markInstallationCompleted: handleMarkInstallationCompleted,
            requestInstallationLocationAction,
            onBack: () => {},
            onCompleted: () => {},
          }}
        />
      ),
    };

    if (activeStepTab === ADMIN_TAB) {
      return (
        <AdminControlModule
          order={order}
          customers={customers}
          employees={employees}
          onAdminApprove={handleAdminApprove}
          onAdminReject={handleAdminReject}
          onApproveWithWorkflowChoice={() => setIsWorkflowChoiceOpen(true)}
          updateSiteVisitDetails={updateSiteVisitDetails}
          updateOrderStage={handleUpdateOrderStage}
        />
      );
    }

    if (activeStepTab === PAYMENTS_TAB) {
      if (isEmployee) {
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", color: "#94A3B8", gap: "8px" }}>
            <Lock size={28} />
            <div style={{ fontSize: "14px", fontWeight: "600" }}>Payments is an Admin-only section</div>
          </div>
        );
      }
      return (
        <PaymentsModule
          orderId={order.id}
          currentStage={order.stage}
          currentUserRole={currentUserRole}
          isEmployee={isStaffOrAdmin}
          onPaymentsChanged={() => router.refresh()}
        />
      );
    }

    return tabToModule[activeStepTab] ?? null;
  };

  /* ── Workflow steps for middle panel (Payments is a header tab, not a pipeline step) ── */
  const workflowSteps = isDesignFirst
    ? [
        ...(isEmployee ? [] : [{ label: "Enquiries", tabIndex: -1, done: true, icon: FileText }]),
        ...(isEmployee ? [] : [{ label: "Admin Controls", tabIndex: ADMIN_TAB, done: false, icon: Lock }]),
        { label: "Site Visit", tabIndex: 0, done: currentStageIndex > 0, icon: MapPin },
        { label: "Design",    tabIndex: 1, done: currentStageIndex > 1, icon: Palette },
        { label: "Quote",     tabIndex: 2, done: currentStageIndex > 2, icon: BarChart3 },
        { label: "Production",  tabIndex: 3, done: currentStageIndex > 3, icon: Package },
        { label: "Installation", tabIndex: 4, done: currentStageIndex > 4, icon: Wrench },
      ]
    : [
        ...(isEmployee ? [] : [{ label: "Enquiries", tabIndex: -1, done: true, icon: FileText }]),
        ...(isEmployee ? [] : [{ label: "Admin Controls", tabIndex: ADMIN_TAB, done: false, icon: Lock }]),
        { label: "Site Visit",  tabIndex: 0, done: currentStageIndex > 0, icon: MapPin },
        { label: "Quote",       tabIndex: 1, done: currentStageIndex > 1, icon: BarChart3 },
        { label: "Design",      tabIndex: 2, done: currentStageIndex > 2, icon: Palette },
        { label: "Production",  tabIndex: 3, done: currentStageIndex > 3, icon: Package },
        { label: "Installation", tabIndex: 4, done: currentStageIndex > 4, icon: Wrench },
      ];

  const getModuleTitle = () => {
    if (activeStepTab === ADMIN_TAB) return "Admin Control Panel";
    if (activeStepTab === PAYMENTS_TAB) return "Payment Milestones";
    if (activeStepTab === 0) return "Site Visit Audit";
    if (isDesignFirst) {
      if (activeStepTab === 1) return "Design Workflow";
      if (activeStepTab === 2) return "Product Quote";
    } else {
      if (activeStepTab === 1) return "Product Quote";
      if (activeStepTab === 2) return "Design Workflow";
    }
    if (activeStepTab === 3) return "Fabrication Checklist";
    if (activeStepTab === 4) return "Field Installation";
    return "Order Details";
  };
  const activeModuleTitle = getModuleTitle();

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, height: "100%", maxHeight: "100%", overflow: "hidden", background: "#F8FAFC" }}>
      {isProcessing && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <LoadingLines />
        </div>
      )}

      {/* ── TOP BAR ── */}
      <header style={{ height: "52px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", paddingLeft: "16px", paddingRight: "20px", gap: "12px", flexShrink: 0, zIndex: 30 }}>
        <button
          onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: "13px", fontWeight: "600", padding: "0 8px 0 0" }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ width: "1px", height: "20px", background: "#E2E8F0" }} />
        <span style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Order Management</span>

        <div style={{ marginLeft: "auto" }} />

        {localAlert && (
          <div style={{
            marginLeft: "8px", padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
            background: localAlert.type === "success" ? "#F0FDF4" : localAlert.type === "warning" ? "#FFFBEB" : localAlert.type === "error" ? "#FEF2F2" : "#EFF6FF",
            color: localAlert.type === "success" ? "#16A34A" : localAlert.type === "warning" ? "#D97706" : localAlert.type === "error" ? "#DC2626" : "#2563EB",
            border: `1px solid ${localAlert.type === "success" ? "#BBF7D0" : localAlert.type === "warning" ? "#FDE68A" : localAlert.type === "error" ? "#FECACA" : "#BFDBFE"}`,
          }}>
            {localAlert.message}
          </div>
        )}
      </header>

      {/* ── 3 PANELS ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* ══ PANEL 1: ORDER LIST ══ */}
        {allOrders.length > 0 && (
          <aside style={{ width: "280px", flexShrink: 0, borderRight: "1px solid #E2E8F0", background: "white", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Search */}
            <div style={{ padding: "12px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ position: "relative" }}>
                <Search size={12} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px 6px 28px", border: "1px solid #E2E8F0", borderRadius: "7px", fontSize: "12px", background: "#F8FAFC", outline: "none", fontFamily: "inherit", color: "#0F172A" }}
                />
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", padding: "8px 10px", gap: "4px", borderBottom: "1px solid #F1F5F9" }}>
              {(["all", "active", "pending"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setOrderTab(tab)}
                  style={{
                    flex: 1, padding: "5px 4px", fontSize: "11px", fontWeight: "700",
                    background: orderTab === tab ? "var(--color-secondary)" : "transparent",
                    color: orderTab === tab ? "white" : "#94A3B8",
                    border: "none", borderRadius: "6px", cursor: "pointer",
                    textTransform: "capitalize", transition: "color 0.15s, background-color 0.15s",
                  }}
                >
                  {tab === "all" ? "All" : tab === "active" ? "Active" : "Pending"}
                </button>
              ))}
            </div>

            {/* Order Cards */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredOrders.map((o) => {
                const isSelected = o.id === order.id;
                
                const isSiteVisitStage = o.stage === "Site Visit Scheduled" || o.stage === "Site Visit Completed";
                const hasNoDate = !o.siteVisitDetails || !o.siteVisitDetails.auditDate;
                const displayStage = (isSiteVisitStage && hasNoDate) ? "Site Visit Pending" : o.stage;
                const stageInfo = STAGE_LABEL[displayStage] || { label: displayStage, color: "#94A3B8" };

                const progress = Math.round(((stageToTabIndex(displayStage) + 1) / 5) * 100);

                return (
                  <div
                    key={o.id}
                    onClick={() => router.push(`/admin/orders/${o.orderId || o.id}`)}
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #F1F5F9",
                      cursor: "pointer",
                      background: isSelected ? "linear-gradient(to right, #FFF7ED, transparent)" : "white",
                      borderLeft: isSelected ? "3px solid #F97316" : "3px solid transparent",
                      transition: "color 0.15s, background-color 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#F8FAFC"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "white"; }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "4px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A", lineHeight: 1.3, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.clientName}
                      </span>

                    </div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "6px" }}>
                      {o.orderCode} • {o.businessName || o.customerName || "—"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: stageInfo.color, flexShrink: 0 }} />
                      <span style={{ fontSize: "11px", color: "#64748B", fontWeight: "600" }}>{stageInfo.label}</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ width: "100%", height: "3px", background: "#E2E8F0", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: "var(--color-secondary)", borderRadius: "99px", transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "4px", textAlign: "right" }}>
                      {new Date(o.dateCreated).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                );
              })}
              {filteredOrders.length === 0 && (
                <div style={{ padding: "24px 12px", textAlign: "center", fontSize: "12px", color: "#94A3B8" }}>
                  No orders found.
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ══ PANEL 2: REMOVED (Replaced by horizontal timeline) ══ */}

        {/* ══ PANEL 3: MODULE CONTENT ══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", background: "#F1F5F9" }}>

          {/* Customer Strip & Horizontal Timeline Header */}
          <div style={{ background: "white", flexShrink: 0, padding: "0 24px" }}>

            {/* Top row: Order Info & Customer */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "16px 0", borderBottom: "1px solid #F1F5F9" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                  {order.orderCode}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0F172A", lineHeight: 1.2 }}>
                    {order.businessName} - {order.clientName}
                  </h2>
                </div>
              </div>

              {/* Customer Info & Actions */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => setShowCustomerPanel(true)}
                    style={{ background: "transparent", border: "1px solid #E2E8F0", color: "#475569", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "6px", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#0F172A"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#475569"; }}
                  >
                    <User size={14} /> Customer Details
                  </button>
                  {!isEmployee && (
                    <button
                      onClick={handleCopyMagicLink}
                      style={{ background: "transparent", border: "1px solid #E2E8F0", color: "#475569", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "6px", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#0F172A"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#475569"; }}
                    >
                      <Share2 size={14} /> {copiedLink ? "Copied!" : "Portal"}
                    </button>
                  )}
                  {!isEmployee && (
                    <button
                      onClick={() => setActiveStepTab(ADMIN_TAB)}
                      style={{
                        background: activeStepTab === ADMIN_TAB ? "#0F172A" : "transparent",
                        border: activeStepTab === ADMIN_TAB ? "none" : "1px solid #E2E8F0",
                        color: activeStepTab === ADMIN_TAB ? "white" : "#475569",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        transition: "all 0.15s",
                        boxShadow: activeStepTab === ADMIN_TAB ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (activeStepTab !== ADMIN_TAB) {
                          e.currentTarget.style.background = "#F8FAFC";
                          e.currentTarget.style.color = "#0F172A";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeStepTab !== ADMIN_TAB) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#475569";
                        }
                      }}
                    >
                      <Lock size={14} /> Admin Controls
                      {order.stageStatus && order.stageStatus !== "Normal" && (
                        <span className="flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse shadow-sm">
                          1
                        </span>
                      )}
                    </button>
                  )}
                  {!isEmployee && (
                    <button
                      onClick={() => setActiveStepTab(PAYMENTS_TAB)}
                      style={{
                        background: activeStepTab === PAYMENTS_TAB ? "#0F172A" : "transparent",
                        border: activeStepTab === PAYMENTS_TAB ? "none" : "1px solid #E2E8F0",
                        color: activeStepTab === PAYMENTS_TAB ? "white" : "#475569",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        transition: "all 0.15s",
                        boxShadow: activeStepTab === PAYMENTS_TAB ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (activeStepTab !== PAYMENTS_TAB) {
                          e.currentTarget.style.background = "#F8FAFC";
                          e.currentTarget.style.color = "#0F172A";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeStepTab !== PAYMENTS_TAB) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#475569";
                        }
                      }}
                    >
                      <CreditCard size={14} /> Payment
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Horizontal Timeline */}
            {activeStepTab !== ADMIN_TAB && activeStepTab !== PAYMENTS_TAB && (() => {
              // Include Enquiries (tabIndex -1); exclude Admin Controls and Payment header tabs only
              const visibleSteps = workflowSteps.filter(
                (s) => s.tabIndex !== ADMIN_TAB && s.tabIndex !== PAYMENTS_TAB
              );
              const activeIndex = visibleSteps.findIndex(s => s.tabIndex === activeStepTab);
              // Progress starts after Enquiries (always complete for an open order)
              const progressIndex = activeIndex < 0 ? 0 : activeIndex;
              const filledPct = visibleSteps.length > 1
                ? (progressIndex / (visibleSteps.length - 1)) * 100
                : 0;
              const insetPct = visibleSteps.length > 0 ? 100 / (2 * visibleSteps.length) : 0;
              return (
                <div className="hidden md:flex" style={{ position: "relative", paddingTop: "24px", paddingBottom: "16px", justifyContent: "space-between", alignItems: "flex-start" }}>
                  {/* Grey base line */}
                  <div style={{ position: "absolute", top: "42px", left: `${insetPct}%`, right: `${insetPct}%`, height: "2.5px", background: "#E2E8F0", borderRadius: "99px", zIndex: 0 }} />
                  {/* Green filled progress line */}
                  <div style={{ position: "absolute", top: "42px", left: `${insetPct}%`, width: `calc((100% - ${insetPct * 2}%) * ${filledPct / 100})`, height: "2.5px", background: "#22C55E", borderRadius: "99px", zIndex: 1, transition: "width 0.45s ease" }} />

                  {visibleSteps.map((step, i) => {
                    const isActive = activeStepTab === step.tabIndex;
                    const isDone = step.done || step.tabIndex < currentStageIndex;
                    const StepIcon = step.icon as any;

                    const stageForStep = tabIndexToOrderStage(step.tabIndex, order.workflow_type);
                    const isLocked = stageForStep != null && (!isTimelineStageAccessible(stageForStep, actor, entryStage) || !hasStageBeenReached(stageForStep));

                    // Node colours
                    const nodeBg = isLocked ? "#F1F5F9" : isDone ? "#22C55E" : isActive ? "var(--color-secondary)" : "#F8FAFC";
                    const nodeBorder = isLocked ? "#E2E8F0" : isDone ? "#22C55E" : isActive ? "var(--color-secondary)" : "#CBD5E1";
                    const iconColor = isLocked ? "#CBD5E1" : (isDone || isActive) ? "white" : "#94A3B8";

                    // Label colours
                    const labelColor = isLocked ? "#CBD5E1" : isDone ? "#16A34A" : isActive ? "var(--color-secondary)" : "#94A3B8";
                    const labelWeight = isActive ? "800" : isDone ? "700" : "500";

                    return (
                      <button
                        key={step.label}
                        onClick={() => { if (step.tabIndex >= 0 && !isLocked) setActiveStepTab(step.tabIndex); }}
                        disabled={step.tabIndex < 0 || isLocked}
                        style={{
                          position: "relative", zIndex: 2, background: "none", border: "none", padding: "0 4px",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                          cursor: step.tabIndex >= 0 && !isLocked ? "pointer" : "default", flex: 1,
                          outline: "none"
                        }}
                      >
                        {/* Node */}
                        <div style={{
                          width: "36px", height: "36px", borderRadius: "50%",
                          background: nodeBg,
                          border: `2px solid ${nodeBorder}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: isActive ? "0 0 0 5px #EFF6FF" : isDone ? "0 0 0 3px #DCFCE7" : "none",
                          transition: "all 0.25s ease",
                          flexShrink: 0,
                        }}>
                          {isDone ? (
                            <Check size={16} color="white" strokeWidth={3} />
                          ) : (
                            StepIcon && <StepIcon size={15} color={iconColor} strokeWidth={2} />
                          )}
                        </div>

                        {/* Label */}
                        <div style={{
                          fontSize: "12px",
                          fontWeight: labelWeight,
                          color: labelColor,
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          letterSpacing: isActive ? "0.01em" : "normal",
                          transition: "color 0.2s ease",
                        }}>
                          {step.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Module Header (if not 99, we can still show a clean title) */}
          <div style={{ padding: activeStepTab === ADMIN_TAB || activeStepTab === PAYMENTS_TAB ? "24px 24px 0 24px" : "16px 24px 0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {(activeStepTab === ADMIN_TAB || activeStepTab === PAYMENTS_TAB) && (
                <button
                  onClick={() => setActiveStepTab(stageToTabIndex(order.stage, order.workflow_type))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "var(--color-primary-container)",
                    border: "1.5px solid var(--color-primary)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    color: "var(--color-primary)",
                    fontSize: "12px",
                    fontWeight: "700",
                    padding: "7px 14px",
                    transition: "all 0.15s",
                    boxShadow: "0 1px 3px rgba(30, 64, 175, 0.15)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#BFDBFE";
                    e.currentTarget.style.borderColor = "#1D4ED8";
                    e.currentTarget.style.color = "#1D4ED8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--color-primary-container)";
                    e.currentTarget.style.borderColor = "var(--color-primary)";
                    e.currentTarget.style.color = "var(--color-primary)";
                  }}
                >
                  <ArrowLeft size={14} /> Back to Worksheet
                </button>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F172A" }}>
                  {activeModuleTitle}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94A3B8" }}></p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>


              {/* Stage / payment lock status */}
              {order.stageStatus && order.stageStatus !== "Normal" ? (
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#EA580C", background: "#FFF7ED", border: "1px solid #FED7AA", padding: "4px 12px", borderRadius: "6px" }}>
                  Pending Approval
                </span>
              ) : null}
            </div>
          </div>

          {/* Module body (scrollable) */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px 24px" }}>

            <div style={{ background: "white", border: "1px solid #E2E8F0", borderTop: "none", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px", borderTopRightRadius: "12px", overflow: "visible", minHeight: "100%", borderTopLeftRadius: activeStepTab === ADMIN_TAB || activeStepTab === PAYMENTS_TAB ? "12px" : "0px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
              <div style={{ padding: "24px" }}>
                {renderModule()}
              </div>
            </div>

          </div>

          {/* Sticky footer actions */}
          <div style={{ padding: "14px 20px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
            <div />
            {activeStepTab === quoteTab ? (
              order.health && order.health !== "Active" ? (
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#64748B", fontWeight: "600" }}>
                    Order is <strong style={{ color: "#DC2626" }}>{order.health}</strong>
                  </span>
                  <button onClick={handleReopen} style={{ padding: "7px 16px", background: "var(--color-secondary)", border: "none", color: "white", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <RefreshCw size={13} /> Reopen Order
                  </button>
                </div>
              ) : (
                <div id="modal-footer-portal" style={{ display: "flex", gap: "10px", alignItems: "center" }} />
              )
            ) : (
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {order.health && order.health !== "Active" ? (
                  <>
                    <span style={{ fontSize: "12px", color: "#64748B", fontWeight: "600" }}>
                      Order is <strong style={{ color: "#DC2626" }}>{order.health}</strong>
                    </span>
                    <button onClick={handleReopen} style={{ padding: "7px 16px", background: "var(--color-secondary)", border: "none", color: "white", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <RefreshCw size={13} /> Reopen Order
                    </button>
                  </>
                ) : (
                  <>
                    {!isCurrentTabFrozen && (
                      <>
                        {/* Save Draft button */}
                        <button onClick={handleSaveDraft} style={{ padding: "7px 16px", border: "1px solid #E2E8F0", background: "white", color: "#64748B", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                          {activeStepTab === designTab ? <><Send size={13} /> Send to Customer</> : <><Save size={13} /> Save Draft</>}
                        </button>
    
                        {/* Advance stage / Staff section approval push */}
                        {isEmployee ? (
                          <div style={{ display: "inline-block" }}>
                            <button onClick={handleRequestAdvancement} style={{ padding: "8px 18px", background: "#22C55E", border: "none", color: "white", borderRadius: "8px", fontSize: "12px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                              <CheckCircle2 size={13} /> Request Admin Approval for {activeModuleTitle}
                            </button>
                          </div>
                        ) : (
                          currentStageIndex === activeStepTab && order.stageStatus === "Normal" && (
                            <div style={{ display: "inline-block" }}>
                              <button onClick={() => {
                                if ((activeStepTab === 0 || activeStepTab === designTab) && !canAdvanceSiteVisit) {
                                  alert(siteVisitAdvanceTooltip);
                                  return;
                                }
                                handleAdminApprove();
                              }} style={{ padding: "7px 16px", background: "#22C55E", border: "none", color: "white", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                                <Check size={13} /> Approve & Advance
                              </button>
                            </div>
                          )
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ PANEL 4: SLIDING DRAWER PANEL ══ */}
        {activeRightPanel && (
          <aside style={{
            width: "380px",
            flexShrink: 0,
            borderLeft: "1px solid #E2E8F0",
            background: "white",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            height: "100%",
            zIndex: 40
          }}>
            <OrderCommunicationCenter
              orderId={order.orderId || order.id}
              currentUserId={currentEmployee?.id || "admin-id"}
              currentUserRole={currentUserRole}
              currentUserName={currentUserRole === "Admin" ? "Admin" : (currentEmployee?.name || "Staff")}
              employees={employees}
              customers={customers}
              onClose={() => setActiveRightPanel(null)}
              defaultTab={activeRightPanel === "logs" ? "timeline" : "internal"}
            />
          </aside>
        )}
      </div>

      {/* ── FLOATING CHAT BUTTON (Order Hub) ── */}
      {!activeRightPanel && (
        <button
          onClick={() => setActiveRightPanel("chat")}
          style={{
            position: "absolute",
            bottom: "96px",
            right: "24px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "var(--color-secondary)",
            color: "white",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 50,
            transition: "transform 0.2s, box-shadow 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)"; }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          {(logsCount > 0 || chatCount > 0) && (
            <span style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              background: "#EF4444",
              color: "white",
              minWidth: "20px",
              height: "20px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}>
              {logsCount + chatCount}
            </span>
          )}
        </button>
      )}

      {/* ── WORKFLOW CHOICE MODAL ── */}
      {isWorkflowChoiceOpen && (
        <WorkflowChoiceModal
          isOpen={isWorkflowChoiceOpen}
          onClose={() => setIsWorkflowChoiceOpen(false)}
          onChoose={async (workflowType) => {
            setIsWorkflowChoiceOpen(false);
            setIsProcessing(true);
            try {
              await setWorkflowTypeAction(order.id, workflowType);
              setOrder((prev) => ({
                ...prev,
                workflow_type: workflowType,
                stage:
                  workflowType === "design_first"
                    ? "Design In Progress"
                    : "Quotation In Progress",
                stageStatus: "Normal",
              }));
              router.refresh();
              triggerLocalAlert(
                `Workflow set to "${workflowType === "design_first" ? "Design First" : "Quote First"}". Order advanced.`,
                "success"
              );
            } catch (err: any) {
              triggerLocalAlert(err?.message || "Failed to set workflow.", "error");
            } finally {
              setIsProcessing(false);
            }
          }}
        />
      )}

      {/* ── REVIEW & CONFIRM MODAL (Site Visit) ── */}
      {isReviewModalOpen && (
        <SiteVisitReviewModal
          siteVisit={sv}
          orderName={`${order.businessName || ""} - ${order.clientName || ""}`.trim() || order.orderId || ""}
          onClose={() => setIsReviewModalOpen(false)}
          onConfirm={async () => {
            try {
              await freezeSiteVisitAction(order.id);
              
              // Both Staff AND Admin must explicitly approve the stage from the Admin Control Panel after locking.
              setOrder(prev => ({ 
                ...prev, 
                stageStatus: "Pending Admin Approval: Site Visit Completed", 
                siteVisitDetails: { ...prev.siteVisitDetails, completed: true } as any 
              }));
              triggerLocalAlert("Site visit confirmed and locked. Awaiting admin review.", "success");
              
              router.refresh();
              setIsReviewModalOpen(false);
            } catch (err) {
              console.error(err);
              triggerLocalAlert("Failed to confirm site visit.", "error");
            }
          }}
        />
      )}
      
      {/* Customer Details Drawer */}
      {client && (
        <CustomerDetailsDrawer
          isOpen={showCustomerPanel}
          onClose={() => setShowCustomerPanel(false)}
          customer={client}
          orderId={initialOrder.id}
        />
      )}
    </div>
  );
};
