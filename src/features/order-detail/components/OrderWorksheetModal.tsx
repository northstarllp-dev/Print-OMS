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
  AlertTriangle, History,
} from "lucide-react";
import {
  Order, PipelineStage, SiteVisitDetails,
  DesignRecord, ProductionDetails, InstallationDetails, Customer, Employee,
} from "@/types";
import { SiteVisitModule } from "@/features/orders/workspace/modules/site-visit/SiteVisitModule";
import { SiteVisitReviewModal } from "@/features/orders/workspace/modules/site-visit/SiteVisitReviewModal";
import { QuotationModule } from "@/features/orders/workspace/modules/quotation/QuotationModule";
import { DesignModule } from "@/features/orders/workspace/modules/design/DesignModule";
import { Logo } from "@/components/ui/Logo";
import { AdminControlModule } from "./admin/AdminControlModule";
import { PaymentsModule } from "./payments/PaymentsModule";
import { CustomerDetailsDrawer } from "./CustomerDetailsDrawer";
import { WorkflowChoiceModal } from "./WorkflowChoiceModal";
import { ProductionModule } from "@/features/orders/workspace/modules/production/ProductionModule";
import { InstallationModule } from "@/features/orders/workspace/modules/installation/InstallationModule";
import { InstallationPaymentApprovalModal } from "./InstallationPaymentApprovalModal";
import { withBasePath } from "@/lib/appBasePath";

import {
  isTimelineStageAccessible,
  getStagePermissionInContext,
} from "@/features/orders/workspace/shared/permissions";
import type { OrderStage, StagePermission } from "@/features/orders/workspace/shared/types";
import { isStaffQueueCompleted } from "@/features/orders/workspace/shared/staffQueueStages";
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
  getOrderById,
} from "@/features/orders/actions/orderActions";
import { mapDbOrderToWorksheetOrder } from "@/features/orders/actions/orderClientMapper";
import { getQuotationByOrderId } from "@/features/quotations/actions/quotationActions";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import {
  markInstallationCompleted,
  updateInstallationDetails as updateInstallationDetailsServer,
} from "@/features/installations/actions/installationActions";
import {
  updateDesignDetailsAction,
  sendDesignToCustomerAction,
  getDesignByOrderId,
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
  "Quotation Sent": { label: "Quotation", color: "#F97316" },
  "Quotation Negotiation": { label: "Negotiating", color: "#F97316" },
  "Quotation Approved": { label: "Quote OK", color: "#F97316" },
  "Design In Progress": { label: "Design", color: "#EC4899" },
  "Design Approved": { label: "Design", color: "#EC4899" },
  "Production": { label: "Production", color: "#3B82F6" },
  "Ready For Installation": { label: "Ready", color: "#0EA5E9" },
  "Installation Scheduled": { label: "Install", color: "#0EA5E9" },
  "Completed": { label: "Closed", color: "#22C55E" },
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
      : "Pending Admin Approval: Design Stage";
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
  if (stage === "Installation Scheduled") {
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
        return 3;
      case "Ready For Installation":
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
      return 3;
    case "Ready For Installation":
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
  /** Open a specific worksheet tab on mount (e.g. payments). */
  initialStepTab?: number;
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
  initialStepTab,
}) => {
  const router = useRouter();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [localAlert, setLocalAlert] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [activeStepTab, setActiveStepTab] = useState(
    initialStepTab != null
      ? initialStepTab
      : entryStage != null
        ? orderStageToTabIndex(entryStage, initialOrder.workflow_type)
        : stageToTabIndex(initialOrder.stage, initialOrder.workflow_type)
  );
  const [showCustomerPanel, setShowCustomerPanel] = useState(false);
  const [activeRightPanel, setActiveRightPanel] = useState<"timeline" | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [siteVisitReviewMode, setSiteVisitReviewMode] = useState<"staff_push" | "admin_lock">("admin_lock");
  const [isWorkflowChoiceOpen, setIsWorkflowChoiceOpen] = useState(false);
  const [isInstallationPaymentModalOpen, setIsInstallationPaymentModalOpen] = useState(false);
  const [adminOverrideUnlocked, setAdminOverrideUnlocked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showLostReasonDropdown, setShowLostReasonDropdown] = useState(false);
  const [selectedLostReason, setSelectedLostReason] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderTab, setOrderTab] = useState<"all" | "active" | "pending">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [messages, setMessages] = useState<any[]>([]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const moduleBodyScrollRef = useRef<HTMLDivElement>(null);
  /** Sync ref so Save Draft always sends the latest locations, not a stale render snapshot. */
  const siteVisitDetailsRef = useRef(initialOrder.siteVisitDetails);
  const [quotationRealtimeRow, setQuotationRealtimeRow] = useState<Record<string, unknown> | null>(null);

  const triggerLocalAlert = useCallback((
    message: string,
    type: "info" | "success" | "warning" | "error"
  ) => {
    setLocalAlert({ message, type });
    setTimeout(() => setLocalAlert(null), 3500);
  }, []);

  const handleRefreshOrder = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const started = Date.now();
    try {
      const [freshOrder, freshQuotation, activityRes] = await Promise.all([
        getOrderById(orderRef.current.id),
        getQuotationByOrderId(orderRef.current.id).catch(() => null),
        createClient()
          .from("order_activity")
          .select("*")
          .eq("order_id", orderRef.current.orderId || orderRef.current.id)
          .eq("activity_type", "timeline"),
      ]);

      if (freshOrder) {
        const mapped = mapDbOrderToWorksheetOrder(freshOrder as Record<string, unknown>);
        setOrder(mapped);
        siteVisitDetailsRef.current = mapped.siteVisitDetails;
      }

      if (freshQuotation) {
        setQuotationRealtimeRow(freshQuotation as Record<string, unknown>);
      }

      if (activityRes.data) {
        setMessages(activityRes.data);
      }

      router.refresh();
    } catch {
      triggerLocalAlert("Could not refresh this order. Please try again.", "error");
    } finally {
      const wait = Math.max(0, 650 - (Date.now() - started));
      window.setTimeout(() => setIsRefreshing(false), wait);
    }
  }, [isRefreshing, router, triggerLocalAlert]);

  const entryStageRef = useRef(entryStage);
  entryStageRef.current = entryStage;
  /** When opened via ?tab=payments (or similar), do not auto-jump to pipeline stage. */
  const lockInitialTabRef = useRef(initialStepTab != null);

  useEffect(() => {
    setOrder(initialOrder);
    siteVisitDetailsRef.current = initialOrder.siteVisitDetails;
  }, [initialOrder]);
  useEffect(() => {
    if (entryStageRef.current != null) return;
    if (lockInitialTabRef.current) return;
    setActiveStepTab(stageToTabIndex(order.stage, order.workflow_type));
  }, [order.stage, order.workflow_type]);

  useEffect(() => {
    moduleBodyScrollRef.current?.scrollTo({ top: 0 });
  }, [activeStepTab]);

  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    async function loadMessages() {
      const { data } = await supabase
        .from("order_activity")
        .select("*")
        .eq("order_id", order.orderId || order.id)
        .eq("activity_type", "timeline");
      if (data) setMessages(data);
    }
    loadMessages();
  }, [isOpen, order.id, order.orderId]);

  useOrderDetailSync({
    orderId: order.id,
    businessOrderId: order.orderId || order.id,
    siteVisitId: order.siteVisitDetails?.id ?? null,
    enabled: isOpen,
    getOrderSnapshot: () => orderRef.current as unknown as Record<string, unknown>,
    onPatch: (patch) => {
      const prevStatus = orderRef.current.stageStatus;
      setOrder((prev) => {
        const next = mergeOrderDetailPatch(prev, patch);
        if (next.siteVisitDetails !== undefined) {
          siteVisitDetailsRef.current = next.siteVisitDetails as SiteVisitDetails | undefined;
        }
        return next;
      });
      // When staff submits Job Done, land admin on Admin Controls so pending review is visible immediately.
      if (
        currentUserRole === "Admin" &&
        patch.stageStatus === "Pending Admin Approval: Job Done" &&
        prevStatus !== "Pending Admin Approval: Job Done"
      ) {
        setActiveStepTab(ADMIN_TAB);
      }
      if (patch.quotationRow) {
        setQuotationRealtimeRow(patch.quotationRow);
      } else if (patch.quoteDetails) {
        const qd = patch.quoteDetails;
        setQuotationRealtimeRow({
          quotation_id: qd.quotationId,
          status: qd.status,
          notes: qd.notes,
          terms: qd.terms,
          shipping: qd.shipping,
          discount: qd.discount,
          rejection_reason: qd.rejectionReason,
          signage_options: qd.signageOptions,
          created_at: qd.createdAt,
          updated_at: qd.updatedAt ?? Date.now(),
        });
      }
    },
    onActivityChange: (payload) => {
      if (payload.eventType === "INSERT" && payload.new) {
        if (payload.new.activity_type && payload.new.activity_type !== "timeline") return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new!.id)) return prev;
          return [...prev, payload.new];
        });
      } else if (payload.eventType === "UPDATE" && payload.new) {
        if (payload.new.activity_type && payload.new.activity_type !== "timeline") return;
        setMessages((prev) =>
          prev.map((m) => (m.id === payload.new!.id ? payload.new : m))
        );
      } else if (payload.eventType === "DELETE" && payload.old) {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old!.id));
      }
    },
    onExternalStageChange: (message) => triggerLocalAlert(message, "info"),
  });

  const timelineCount = messages.filter((m) => m.tab === "timeline" || m.activity_type === "timeline").length;

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
  const isStaffQueueReadOnly =
    isEmployee &&
    entryStage != null &&
    isStaffQueueCompleted(order.stage, entryStage, order.workflow_type || undefined);
  const effectiveStagePermission = (stage: OrderStage): StagePermission => {
    const base = getStagePermissionInContext(stage, actor, entryStage);
    if (isStaffQueueReadOnly) return { canView: base.canView, canEdit: false };
    return base;
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
    setOrder((prev) => {
      const merged = {
        ...(prev.siteVisitDetails || {}),
        ...details,
      } as SiteVisitDetails;
      siteVisitDetailsRef.current = merged;
      const next: Order = { ...prev, siteVisitDetails: merged };
      // Local schedule mirror — server also sets stage; realtime covers other clients.
      if (
        (details.auditDate || details.preferredDate) &&
        prev.stage === "Site Visit Pending"
      ) {
        next.stage = "Site Visit Scheduled";
      }
      return next;
    });
  };
  // Quote details are now managed entirely by QuotationModule via quotationActions.
  const updateDesignDetails = async (orderId: string, details: Partial<DesignRecord>) => {
    const save = async (expectedUpdatedAt?: string) =>
      updateDesignDetailsAction(orderId, details, expectedUpdatedAt);

    try {
      const updated = await save(orderRef.current.design?.updated_at);
      setOrder((prev) => ({ ...prev, design: updated }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("updated by another user")) {
        const fresh = await getDesignByOrderId(orderId);
        const updated = await save(fresh?.updated_at);
        setOrder((prev) => ({ ...prev, design: updated }));
        return;
      }
      throw err;
    }
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
      stageStatus: "Pending Admin Approval: Job Done",
      installationDetails: {
        ...(prev.installationDetails || {}),
        checklist,
        afterPhotos: photos,
        photos,
        notes,
      } as InstallationDetails,
    }));
    router.refresh();
  };

  const executeAdminApprove = async () => {
    const wasJobDonePending = order.stageStatus === "Pending Admin Approval: Job Done";
    const fromStage = order.stage;
    const result = await adminApproveStageAction(order.id);
    const resultRow = Array.isArray(result) ? result[0] : (result as any);
    const nextStage =
      (resultRow?.stage as PipelineStage | undefined) ||
      (wasJobDonePending ? ("Completed" as PipelineStage) : undefined);
    setOrder((prev) => ({
      ...prev,
      ...(nextStage ? { stage: nextStage } : {}),
      stageStatus: "Normal",
      stageAdminNotes: "",
    }));
    if (nextStage) {
      setActiveStepTab(stageToTabIndex(nextStage, order.workflow_type || "quote_first"));
    }
    router.refresh();
    triggerLocalAlert(
      wasJobDonePending
        ? "Order marked as completed."
        : nextStage && nextStage !== fromStage
          ? `Advanced to ${nextStage}.`
          : "Stage approved and advanced.",
      "success"
    );
  };

  const handleAdminApprove = async () => {
    setIsProcessing(true);
    try {
      // Don't draft-save Admin/Payments tabs — they aren't stage worksheets.
      if (activeStepTab !== ADMIN_TAB && activeStepTab !== PAYMENTS_TAB) {
        await handleSaveDraft();
        setIsProcessing(true);
      }
      // On Site Visit tab with normal status, open review modal first.
      if (activeStepTab === 0 && order.stageStatus === "Normal") {
        setSiteVisitReviewMode("admin_lock");
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
      // Installation completion always goes through payment review — never skip Job Done.
      if (order.stageStatus === "Pending Admin Approval: Job Done") {
        setIsInstallationPaymentModalOpen(true);
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

    // Gate by order stage (not active tab) so Quote/other tabs cannot skip design readiness.
    if (order.stage === "Design In Progress") {
      const itemsList = (order.design as DesignRecord)?.items || [];
      const allDesignItemsApproved = areAllDesignItemsApproved(itemsList as any);
      const hasProductionFiles = itemsList.some(
        (item: any) => item.productionFiles && item.productionFiles.length > 0
      );
      if (!allDesignItemsApproved || !hasProductionFiles) {
        alert("All designs must be approved and final production files must be uploaded.");
        return;
      }
    }

    if ((activeStepTab === 0 || activeStepTab === designTabIndex) && !canAdvanceSiteVisit) {
      alert(siteVisitAdvanceTooltip);
      return;
    }

    setIsProcessing(true);
    try {
      if (activeStepTab !== designTabIndex) {
        await handleSaveDraft();
      }
      // Site Visit: show summary confirmation first (push only — no lock).
      if (activeStepTab === 0) {
        setSiteVisitReviewMode("staff_push");
        setIsReviewModalOpen(true);
        setIsProcessing(false);
        return;
      }

      // Installation: submit job-done package (checklist / photos / notes) for admin payment review.
      if (activeStepTab === 4) {
        if (
          !window.confirm(
            "Submit installation to admin for review? The order will stay open until admin confirms payments and marks it completed."
          )
        ) {
          setIsProcessing(false);
          return;
        }
        const details = orderRef.current.installationDetails || {};
        await handleMarkInstallationCompleted(
          order.id,
          Array.isArray(details.checklist) ? details.checklist : [],
          details.afterPhotos || [],
          details.notes || ""
        );
        triggerLocalAlert(
          "Installation submitted to admin. Awaiting payment review and order completion.",
          "success"
        );
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
      const res = await fetch(withBasePath(`/api/portal-token?customer_id=${client.customerId || client.id}&order_id=${order.orderId || order.id}`));
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
    // design_first:  0=SiteVisit, 1=Design, 2=Quote,  3=Production, 4=Installation
    const isDesignFirst = workflowType === "design_first";
    const designTab = isDesignFirst ? 1 : 2;
    const quoteTab = isDesignFirst ? 2 : 1;
    try {
      switch (activeStepTab) {
        case 0: { // Site Visit
          const details =
            siteVisitDetailsRef.current ||
            orderRef.current.siteVisitDetails;
          if (details) {
            const result = await updateSiteVisitDetailsAction(order.id, details);
            if (result?.siteVisitDetails) {
              siteVisitDetailsRef.current = result.siteVisitDetails as SiteVisitDetails;
              setOrder((prev) => ({
                ...prev,
                siteVisitDetails: result.siteVisitDetails as SiteVisitDetails,
              }));
            }
          }
          break;
        }
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
  const pd = order.productionDetails || { stage1: false, stage2: false, stage3: false, stage4: false, checklist: {} };
  const inst = order.installationDetails || { photoUrl: "", customerSignature: "", paymentCode: "" };

  // Compute workflow-aware tab assignments
  const workflowType = order.workflow_type || "quote_first";
  const isDesignFirst = workflowType === "design_first";
  const designTab = isDesignFirst ? 1 : 2;
  const quoteTab  = isDesignFirst ? 2 : 1;

  const isDesignPending =
    Boolean(order.stageStatus && order.stageStatus !== "Normal") &&
    (order.stage === "Design In Progress" || order.stage === "Design Approved");

  const isOrderClosed = order.stage === "Completed" || order.stage === "Closed";
  const effectiveAdminOverrideUnlocked = isOrderClosed ? false : adminOverrideUnlocked;
  // God Mode unlock only after that stage is done and the order has moved past it.
  const godModeSetterForTab = (tabIndex: number) =>
    !isOrderClosed && currentStageIndex > tabIndex ? setAdminOverrideUnlocked : undefined;

  const isSiteVisitFrozen =
    isOrderClosed ||
    ((!order.stage.startsWith("Site Visit") || (!!sv.completed && order.stageStatus !== "Normal")) &&
    !effectiveAdminOverrideUnlocked);

  const isDesignFrozen =
    isOrderClosed ||
    ((currentStageIndex > designTab || isDesignPending) &&
    !effectiveAdminOverrideUnlocked);

  const isCurrentTabFrozen =
    isOrderClosed ||
    isStaffQueueReadOnly ||
    (activeStepTab === 0 && isSiteVisitFrozen) ||
    (activeStepTab === designTab && isDesignFrozen);

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
    siteVisitAdvanceTooltip = !allDesignItemsApproved
      ? "All design items must be approved by the customer before requesting admin approval."
      : !hasProductionFiles
        ? "Final production files must be uploaded for at least one design item."
        : "";
  }

  const designItemsForGate = ((order.design as DesignRecord)?.items || []) as any[];
  const isDesignAdvanceReady =
    areAllDesignItemsApproved(designItemsForGate) &&
    designItemsForGate.some((item: any) => item.productionFiles && item.productionFiles.length > 0);
  // Stage-page Approve only when Normal — staff-push pending (incl. Job Done) is Admin Control only.
  const showAdminApproveButton =
    !isEmployee &&
    currentStageIndex === activeStepTab &&
    order.stageStatus === "Normal" &&
    activeStepTab !== 4 &&
    !(order.stage === "Design In Progress" && !isDesignAdvanceReady);
  // Hide staff advance while any approval is pending, or while waiting to schedule (Ready For Installation).
  const hideStaffAdvanceRequest =
    order.stage === "Ready For Installation" ||
    (Boolean(order.stageStatus && order.stageStatus !== "Normal") &&
      currentStageIndex === activeStepTab);

  // Whether the active tab's stage is inaccessible to this actor (RBAC + workflow progress)
  const isActiveStageInaccessible = (() => {
    const activeStage = tabIndexToOrderStage(activeStepTab, order.workflow_type);
    if (activeStage == null) return false; // Admin/Payments tabs — handled separately
    return !isTimelineStageAccessible(activeStage, actor, entryStage) || !hasStageBeenReached(activeStage);
  })();

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
            if (!getStagePermissionInContext("site_visit", actor, entryStage).canEdit) return;
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
          adminOverrideUnlocked={effectiveAdminOverrideUnlocked}
          setAdminOverrideUnlocked={godModeSetterForTab(0)}
          permission={getStagePermissionInContext("site_visit", actor, entryStage)}
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
          adminOverrideUnlocked={effectiveAdminOverrideUnlocked}
          setAdminOverrideUnlocked={godModeSetterForTab(quoteTab)}
          permission={getStagePermissionInContext("quotation", actor, entryStage)}
        />
      ),
      [designTab]: (
        <DesignModule
          order={order}
          isEmployee={isStaffOrAdmin}
          updateDesignDetails={updateDesignDetails}
          siteVisitItems={siteVisitItems}
          isFrozen={isDesignFrozen}
          isPendingReview={isDesignPending}
          adminOverrideUnlocked={effectiveAdminOverrideUnlocked}
          setAdminOverrideUnlocked={godModeSetterForTab(designTab)}
          stageAdminNotes={
            order.stage === "Design In Progress" || order.stage === "Design Approved"
              ? order.stageAdminNotes
              : undefined
          }
          currentUserRole={currentUserRole}
          permission={getStagePermissionInContext("design", actor, entryStage)}
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
          permission={effectiveStagePermission("production")}
          callbacks={{
            updateProductionDetails,
            onBack: () => {},
          }}
          adminOverrideUnlocked={effectiveAdminOverrideUnlocked}
          setAdminOverrideUnlocked={godModeSetterForTab(3)}
          currentUserRole={currentUserRole}
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
          permission={effectiveStagePermission("installation")}
          callbacks={{
            updateInstallationDetails,
            onBack: () => {},
            onInstallationScheduled: ({ scheduledDate, scheduledTime }) => {
              setOrder((prev) => ({
                ...prev,
                stage: "Installation Scheduled" as PipelineStage,
                installationDetails: {
                  ...(prev.installationDetails || {}),
                  scheduledDate,
                  scheduledTime,
                } as InstallationDetails,
              }));
              setActiveStepTab(4);
              router.refresh();
              triggerLocalAlert("Installation scheduled — stage advanced.", "success");
            },
          }}
          adminOverrideUnlocked={effectiveAdminOverrideUnlocked}
          setAdminOverrideUnlocked={godModeSetterForTab(4)}
          currentUserRole={currentUserRole}
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
          onApproveWithWorkflowChoice={async () => {
            // Staff push may leave site visit unlocked — lock before workflow choice.
            if (order.stage.startsWith("Site Visit") && !sv.completed) {
              setIsProcessing(true);
              try {
                await freezeSiteVisitAction(order.id);
                setOrder((prev) => ({
                  ...prev,
                  stageStatus: "Pending Admin Approval: Site Visit Completed",
                  siteVisitDetails: { ...prev.siteVisitDetails, completed: true } as any,
                }));
              } catch (err: any) {
                triggerLocalAlert(err?.message || "Failed to lock site visit.", "error");
                setIsProcessing(false);
                return;
              }
              setIsProcessing(false);
            }
            setIsWorkflowChoiceOpen(true);
          }}
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
          <div className="animate-pulse flex items-center justify-center drop-shadow-xl px-6">
            <Logo width={240} height={60} align="center" className="md:hidden" />
            <Logo width={400} height={100} align="center" className="hidden md:block" />
          </div>
        </div>
      )}

      {localAlert && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            padding: "6px 14px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "600",
            maxWidth: "min(90vw, 420px)",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            background: localAlert.type === "success" ? "#F0FDF4" : localAlert.type === "warning" ? "#FFFBEB" : localAlert.type === "error" ? "#FEF2F2" : "#EFF6FF",
            color: localAlert.type === "success" ? "#16A34A" : localAlert.type === "warning" ? "#D97706" : localAlert.type === "error" ? "#DC2626" : "#2563EB",
            border: `1px solid ${localAlert.type === "success" ? "#BBF7D0" : localAlert.type === "warning" ? "#FDE68A" : localAlert.type === "error" ? "#FECACA" : "#BFDBFE"}`,
          }}
        >
          {localAlert.message}
        </div>
      )}

      {/* ── 3 PANELS ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* ══ PANEL 1: ORDER LIST (desktop/tablet only — frees width on phones) ══ */}
        {allOrders.length > 0 && (
          <aside className="hidden lg:flex" style={{ width: "280px", flexShrink: 0, borderRight: "1px solid #E2E8F0", background: "white", flexDirection: "column", overflow: "hidden" }}>

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
          <div className="px-3 sm:px-4 md:px-6" style={{ background: "white", flexShrink: 0 }}>

            <div className="py-3 sm:py-4 border-b border-slate-100 space-y-3">
              {/* Row 1: Back + icon actions */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  title="Back"
                  aria-label="Back to orders"
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                >
                  <ArrowLeft size={16} className="shrink-0" />
                  <span className="text-[12px] font-bold">Back</span>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleRefreshOrder()}
                    disabled={isRefreshing}
                    title="Refresh order"
                    aria-label="Refresh order"
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border transition-all ${
                      isRefreshing
                        ? "border-[var(--color-secondary)]/25 bg-[var(--color-secondary)]/5 text-[var(--color-secondary)]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <RefreshCw
                      size={16}
                      className={isRefreshing ? "animate-[spin_0.85s_linear_infinite]" : ""}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRightPanel((prev) => (prev === "timeline" ? null : "timeline"))}
                    title="Order timeline"
                    aria-label="Order timeline"
                    aria-pressed={activeRightPanel === "timeline"}
                    className={`relative inline-flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                      activeRightPanel === "timeline"
                        ? "border-transparent bg-[var(--color-secondary)] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <History size={16} />
                    {timelineCount > 0 && (
                      <span
                        className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center text-white border-2 border-white ${
                          activeRightPanel === "timeline" ? "bg-white/30" : "bg-red-500"
                        }`}
                      >
                        {timelineCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomerPanel(true)}
                    title="Customer details"
                    aria-label="Customer details"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <User size={16} />
                  </button>
                </div>
              </div>

              {/* Row 2: Order identity + Portal/Admin/Payments (parallel to business name) */}
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {order.orderCode}
                </div>

                <div className="mt-1 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug truncate">
                      {order.businessName || "—"}
                    </div>
                    <div className="mt-0.5 text-sm text-slate-500 truncate">
                      Lead: {order.clientName || "—"}
                    </div>
                  </div>

                  {!isEmployee && (
                    <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:shrink-0 sm:min-w-[260px] md:min-w-[320px]">
                      {([
                        {
                          key: "portal",
                          label: copiedLink ? "Copied!" : "Portal",
                          shortLabel: copiedLink ? "Copied!" : "Portal",
                          icon: Share2,
                          onClick: handleCopyMagicLink,
                          active: false,
                          show: true,
                          badge: null as React.ReactNode,
                        },
                        {
                          key: "admin",
                          label: "Admin Controls",
                          shortLabel: "Admin",
                          icon: Lock,
                          onClick: () => setActiveStepTab(ADMIN_TAB),
                          active: activeStepTab === ADMIN_TAB,
                          show: true,
                          badge:
                            order.stageStatus && order.stageStatus !== "Normal" ? (
                              <span className="flex items-center justify-center w-3.5 h-3.5 shrink-0 text-[9px] font-bold text-white bg-red-500 rounded-full animate-pulse shadow-sm">
                                1
                              </span>
                            ) : null,
                        },
                        {
                          key: "payments",
                          label: "Payments",
                          shortLabel: "Payments",
                          icon: CreditCard,
                          onClick: () => setActiveStepTab(PAYMENTS_TAB),
                          active: activeStepTab === PAYMENTS_TAB,
                          show: true,
                          badge: null as React.ReactNode,
                        },
                      ] as const)
                        .filter((btn) => btn.show)
                        .map((btn) => {
                          const Icon = btn.icon;
                          return (
                            <button
                              key={btn.key}
                              type="button"
                              onClick={btn.onClick}
                              title={btn.label}
                              className="min-w-0 h-9 sm:h-10 inline-flex items-center justify-center gap-1 px-1.5 sm:px-2 rounded-lg text-[11px] font-semibold transition-all overflow-hidden"
                              style={{
                                background: btn.active ? "#0F172A" : "transparent",
                                border: btn.active ? "none" : "1px solid #E2E8F0",
                                color: btn.active ? "white" : "#475569",
                                boxShadow: btn.active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                              }}
                            >
                              <Icon size={13} className="shrink-0" />
                              <span className="truncate min-w-0">
                                <span className="sm:hidden">{btn.shortLabel}</span>
                                <span className="hidden sm:inline">{btn.label}</span>
                              </span>
                              {btn.badge}
                            </button>
                          );
                        })}
                    </div>
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
              return (
                <div className="py-3">
                  {/* Workflow stages — toggleable bar like site-visit items */}
                  <div
                    className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 border border-slate-200/60 rounded-xl w-full max-w-full"
                    style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {visibleSteps.map((step) => {
                      const isActive = activeStepTab === step.tabIndex;
                      const isDone = step.done || step.tabIndex < currentStageIndex;
                      const stageForStep = tabIndexToOrderStage(step.tabIndex, order.workflow_type);
                      const isLocked =
                        stageForStep != null &&
                        (!isTimelineStageAccessible(stageForStep, actor, entryStage) ||
                          !hasStageBeenReached(stageForStep));
                      const canSelect = step.tabIndex >= 0 && !isLocked;

                      return (
                        <button
                          key={step.label}
                          type="button"
                          title={step.label}
                          onClick={() => {
                            if (canSelect) setActiveStepTab(step.tabIndex);
                          }}
                          disabled={!canSelect}
                          className={`shrink-0 min-w-[5.5rem] md:flex-1 md:min-w-0 flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                            isActive
                              ? "bg-white text-[var(--color-secondary)] shadow-[0_1px_3px_rgba(0,0,0,0.1)] ring-1 ring-slate-900/5"
                              : isDone
                                ? "text-emerald-600 hover:bg-slate-200/50"
                                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                          }`}
                        >
                          {isDone && !isActive ? <Check size={12} strokeWidth={3} className="shrink-0" /> : null}
                          <span className="whitespace-nowrap md:truncate">{step.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Module Header (if not 99, we can still show a clean title) */}
          <div className="px-3 sm:px-4 md:px-6" style={{ paddingTop: activeStepTab === ADMIN_TAB || activeStepTab === PAYMENTS_TAB ? "16px" : "12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, flexWrap: "wrap", gap: "8px" }}>
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


              {/* Stage / payment lock status — changes-requested only on the stage tab that was rejected */}
              {order.stageStatus && order.stageStatus !== "Normal" ? (
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#EA580C", background: "#FFF7ED", border: "1px solid #FED7AA", padding: "4px 12px", borderRadius: "6px" }}>
                  Pending Approval
                </span>
              ) : order.stageAdminNotes && activeStepTab === currentStageIndex ? (
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 12px", borderRadius: "6px" }}>
                  Changes Requested
                </span>
              ) : null}
            </div>
          </div>

          {/* Module body (scrollable) — pull down on mobile to refresh */}
          <PullToRefresh
            ref={moduleBodyScrollRef}
            onRefresh={handleRefreshOrder}
            refreshing={isRefreshing}
            className="px-3 sm:px-4 md:px-6 pb-4 md:pb-6"
            style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
          >
            <div
              className={`transition-opacity duration-300 ease-out ${
                isRefreshing ? "opacity-[0.72] pointer-events-none" : "opacity-100"
              }`}
            >

            {order.stageAdminNotes &&
              order.stageStatus === "Normal" &&
              activeStepTab === currentStageIndex && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "12px 14px",
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <AlertTriangle size={16} style={{ color: "#D97706", flexShrink: 0, marginTop: "1px" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#92400E" }}>
                    Admin requested changes on {order.stage}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", fontWeight: 600, color: "#B45309", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {order.stageAdminNotes}
                  </p>
                </div>
              </div>
            )}

            <div style={{ background: "white", border: "1px solid #E2E8F0", borderTop: "none", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px", borderTopRightRadius: "12px", overflowX: "hidden", minHeight: "100%", minWidth: 0, borderTopLeftRadius: activeStepTab === ADMIN_TAB || activeStepTab === PAYMENTS_TAB ? "12px" : "0px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
              <div className="p-3 sm:p-4 md:p-6 min-w-0">
                {renderModule()}
              </div>
            </div>

            </div>
          </PullToRefresh>

          {/* Sticky footer actions — hidden entirely when the active stage is inaccessible */}
          <div className="px-3 sm:px-5 py-3 flex flex-row flex-wrap items-stretch sm:items-center justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ background: "#F8FAFC", borderTop: "1px solid #E2E8F0", flexShrink: 0, boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
            {isActiveStageInaccessible ? (
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#94A3B8", display: "flex", alignItems: "center", gap: "6px" }}>
                <Lock size={13} /> No actions available for this stage
              </span>
            ) : activeStepTab === quoteTab ? (
              order.health && order.health !== "Active" ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center w-full sm:w-auto flex-wrap">
                  <span style={{ fontSize: "12px", color: "#64748B", fontWeight: "600" }}>
                    Order is <strong style={{ color: "#DC2626" }}>{order.health}</strong>
                  </span>
                  <button onClick={handleReopen} className="w-full sm:w-auto justify-center" style={{ padding: "10px 16px", background: "var(--color-secondary)", border: "none", color: "white", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <RefreshCw size={13} /> Reopen Order
                  </button>
                </div>
              ) : (
                <div id="modal-footer-portal" className="flex flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center w-full sm:w-auto flex-wrap" />
              )
            ) : (
              <div className="flex flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center w-full sm:w-auto flex-wrap">
                {order.health && order.health !== "Active" ? (
                  <>
                    <span style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", display: "none" }}>
                      Order is <strong style={{ color: "#DC2626" }}>{order.health}</strong>
                    </span>
                    <button onClick={handleReopen} style={{ padding: "7px 16px", background: "var(--color-secondary)", border: "none", color: "white", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <RefreshCw size={13} /> Reopen Order
                    </button>
                  </>
                ) : (
                  <>
                    {isStaffQueueReadOnly && (
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Lock size={13} /> View only — completed in your queue
                      </span>
                    )}
                    {!isCurrentTabFrozen && (
                      <>
                        {(() => {
                          const activeStageForPerm = tabIndexToOrderStage(activeStepTab, order.workflow_type);
                          const stageCanEdit = activeStageForPerm
                            ? getStagePermissionInContext(activeStageForPerm, actor, entryStage).canEdit
                            : true;
                          if (!stageCanEdit) return null;
                          return (
                            <>
                              <button
                                onClick={handleSaveDraft}
                                className="flex-1 sm:flex-none min-w-0 justify-center"
                                style={
                                  activeStepTab === designTab
                                    ? {
                                        padding: "10px 16px",
                                        border: "none",
                                        background: "var(--color-primary)",
                                        color: "white",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        fontWeight: "700",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }
                                    : {
                                        padding: "10px 16px",
                                        border: "1px solid #E2E8F0",
                                        background: "white",
                                        color: "#64748B",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        fontWeight: "700",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }
                                }
                              >
                                {activeStepTab === designTab ? <><Send size={13} /> Send to Customer</> : <><Save size={13} /> Save Draft</>}
                              </button>

                              {isEmployee ? (
                                !hideStaffAdvanceRequest && (() => {
                                  const advanceBlocked =
                                    (activeStepTab === 0 || activeStepTab === designTab) &&
                                    !canAdvanceSiteVisit;
                                  const designNeedsCustomerApproval =
                                    activeStepTab === designTab &&
                                    !areAllDesignItemsApproved((dd.items || []) as any);
                                  return (
                                  <div className="flex-1 sm:flex-none min-w-0">
                                    <button
                                      onClick={() => {
                                        if (advanceBlocked) {
                                          alert(siteVisitAdvanceTooltip);
                                          return;
                                        }
                                        handleRequestAdvancement();
                                      }}
                                      disabled={advanceBlocked}
                                      title={
                                        designNeedsCustomerApproval
                                          ? "All design items must be approved by the customer first."
                                          : advanceBlocked
                                            ? siteVisitAdvanceTooltip
                                            : undefined
                                      }
                                      className="w-full justify-center"
                                      style={{
                                        padding: "10px 16px",
                                        background: advanceBlocked ? "#94A3B8" : "#22C55E",
                                        border: "none",
                                        color: "white",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        fontWeight: "800",
                                        cursor: advanceBlocked ? "not-allowed" : "pointer",
                                        opacity: advanceBlocked ? 0.7 : 1,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }}
                                    >
                                      <CheckCircle2 size={13} className="shrink-0" />
                                      <span className="md:hidden">Request Approval</span>
                                      <span className="hidden md:inline">Request Admin Approval for {activeModuleTitle}</span>
                                    </button>
                                  </div>
                                  );
                                })()
                              ) : (
                                showAdminApproveButton && (
                                  <div className="flex-1 sm:flex-none min-w-0">
                                    <button onClick={() => {
                                      if ((activeStepTab === 0 || activeStepTab === designTab) && !canAdvanceSiteVisit) {
                                        alert(siteVisitAdvanceTooltip);
                                        return;
                                      }
                                      handleAdminApprove();
                                    }} className="w-full justify-center" style={{ padding: "10px 16px", background: "#22C55E", border: "none", color: "white", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                                      <Check size={13} /> Approve & Advance
                                    </button>
                                  </div>
                                )
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

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
          mode={siteVisitReviewMode}
          onClose={() => setIsReviewModalOpen(false)}
          onConfirm={async () => {
            try {
              if (siteVisitReviewMode === "staff_push") {
                const workflowType = order.workflow_type || "quote_first";
                await requestStageAdvancementAction(order.id);
                const nextStatus = computePendingStageStatus(order.stage, workflowType);
                setOrder((prev) => ({ ...prev, stageStatus: nextStatus, stageAdminNotes: "" }));
                await addChatMessageAction(
                  order.id,
                  "System",
                  `${currentEmployee?.name || "Staff"} requested stage advancement.`
                );
                setIsReviewModalOpen(false);
                router.refresh();
                triggerLocalAlert("Site visit submitted for admin approval.", "success");
                return;
              }

              await freezeSiteVisitAction(order.id);
              setOrder((prev) => ({
                ...prev,
                stageStatus: "Pending Admin Approval: Site Visit Completed",
                siteVisitDetails: { ...prev.siteVisitDetails, completed: true } as any,
              }));
              setIsReviewModalOpen(false);
              router.refresh();
              setIsWorkflowChoiceOpen(true);
            } catch (err: any) {
              console.error(err);
              triggerLocalAlert(
                err?.message ||
                  (siteVisitReviewMode === "staff_push"
                    ? "Failed to request admin approval."
                    : "Failed to confirm site visit."),
                "error"
              );
            }
          }}
        />
      )}

      {isInstallationPaymentModalOpen && (
        <InstallationPaymentApprovalModal
          orderId={order.id}
          orderLabel={`${order.businessName || ""} - ${order.clientName || ""}`.trim() || order.orderId || ""}
          onClose={() => setIsInstallationPaymentModalOpen(false)}
          onConfirm={async () => {
            setIsProcessing(true);
            try {
              await executeAdminApprove();
              setIsInstallationPaymentModalOpen(false);
            } finally {
              setIsProcessing(false);
            }
          }}
        />
      )}
      
      {/* Timeline Drawer — same overlay pattern as CustomerDetailsDrawer */}
      {activeRightPanel === "timeline" && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[999]"
            onClick={() => setActiveRightPanel(null)}
            aria-hidden
            style={{ animation: "fadeIn 0.2s ease-out" }}
          />
          <div
            className="fixed inset-0 lg:inset-y-0 lg:right-0 lg:left-auto w-full lg:max-w-[420px] bg-white shadow-2xl z-[1000] lg:border-l border-slate-200 flex flex-col overflow-hidden"
            style={{ animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <OrderCommunicationCenter
              orderId={order.orderId || order.id}
              onClose={() => setActiveRightPanel(null)}
            />
          </div>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @keyframes slideInRight {
                  from { transform: translateX(100%); }
                  to { transform: translateX(0); }
                }
                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
              `,
            }}
          />
        </>
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
