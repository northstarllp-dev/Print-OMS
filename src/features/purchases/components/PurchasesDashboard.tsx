"use client";

import React, { useMemo, useState, useTransition } from "react";
import {
  ClipboardList,
  FileUp,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingCart,
  Star,
  Store,
  Trash2,
  X,
} from "lucide-react";
import type {
  PoPaymentStatus,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
  PurchaseRequestRecord,
  VendorRecord,
} from "@/features/purchases/types";
import {
  createPurchaseOrderAction,
  createPurchaseRequestAction,
  createVendorAction,
  deletePurchaseOrderAction,
  receivePurchaseOrderAction,
  setPurchaseOrderPaymentStatusAction,
  setPurchaseOrderStatusAction,
  setPurchaseRequestStatusAction,
  updatePurchaseOrderAction,
  updateVendorAction,
} from "@/features/purchases/actions/purchaseActions";
import {
  parseVendorPoPdfAction,
  type ParsedPoLine,
} from "@/features/purchases/actions/parseVendorPoPdf";
import { confirmParsedVendorPoAction } from "@/features/purchases/actions/confirmParsedVendorPo";

interface ProductOption {
  id: string;
  product_id: string;
  name: string;
  unit: string | null;
  purchase_price: number | null;
  gst_rate: number | null;
}

interface WarehouseOption {
  id: string;
  name: string;
}

interface PurchasesDashboardProps {
  purchaseOrders: PurchaseOrderRecord[];
  requests: PurchaseRequestRecord[];
  vendors: VendorRecord[];
  products: ProductOption[];
  warehouses: WarehouseOption[];
  isAdmin: boolean;
}

const STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  Draft: "border-slate-200 bg-slate-50 text-slate-600",
  Sent: "border-blue-200 bg-blue-50 text-blue-700",
  Approved: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Partially Received": "border-amber-200 bg-amber-50 text-amber-700",
  Received: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Cancelled: "border-red-200 bg-red-50 text-red-700",
  Closed: "border-slate-300 bg-slate-100 text-slate-700",
};

const PAYMENT_BADGE: Record<PoPaymentStatus, string> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  "Partially Paid": "border-blue-200 bg-blue-50 text-blue-700",
  Paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function PurchasesDashboard({
  purchaseOrders,
  requests,
  vendors,
  products,
  warehouses,
  isAdmin,
}: PurchasesDashboardProps) {
  const [tab, setTab] = useState<"orders" | "requests" | "vendors">("orders");
  const [showCreatePo, setShowCreatePo] = useState(false);
  const [showUploadPo, setShowUploadPo] = useState(false);
  const [uploadSeedFile, setUploadSeedFile] = useState<File | null>(null);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [receivingPo, setReceivingPo] = useState<PurchaseOrderRecord | null>(null);
  const [editingPo, setEditingPo] = useState<PurchaseOrderRecord | null>(null);
  const [convertingRequest, setConvertingRequest] = useState<PurchaseRequestRecord | null>(null);

  const pendingRequests = requests.filter((r) => r.status === "Pending").length;
  const openPos = purchaseOrders.filter(
    (po) => !["Received", "Cancelled", "Closed"].includes(po.status)
  ).length;
  const unpaidTotal = purchaseOrders
    .filter((po) => po.payment_status !== "Paid" && po.status !== "Cancelled")
    .reduce((sum, po) => sum + po.grand_total, 0);

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-slate-900">Purchase Orders</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Vendors, purchase requests, POs, and goods receipts into inventory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCreateRequest(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <ClipboardList size={15} /> New Request
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadSeedFile(null);
              setShowUploadPo(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <FileUp size={15} /> Upload Vendor PO
          </button>
          <button
            type="button"
            onClick={() => setShowCreatePo(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus size={15} /> New PO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Open POs", value: openPos },
          { label: "Pending Requests", value: pendingRequests },
          { label: "Vendors", value: vendors.filter((v) => v.is_active).length },
          { label: "Unpaid PO Value", value: `₹${unpaidTotal.toLocaleString("en-IN")}` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: "orders", label: `Purchase Orders (${purchaseOrders.length})`, icon: ShoppingCart },
          { id: "requests", label: `Requests (${requests.length})`, icon: ClipboardList },
          { id: "vendors", label: `Vendors (${vendors.length})`, icon: Store },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <PoTable
          purchaseOrders={purchaseOrders}
          isAdmin={isAdmin}
          onReceive={(po) => setReceivingPo(po)}
          onEdit={(po) => setEditingPo(po)}
          onUploadPdf={(file) => {
            setUploadSeedFile(file ?? null);
            setShowUploadPo(true);
          }}
        />
      ) : null}

      {tab === "requests" ? (
        <RequestsTable
          requests={requests}
          isAdmin={isAdmin}
          onConvert={(r) => setConvertingRequest(r)}
        />
      ) : null}

      {tab === "vendors" ? <VendorsTable vendors={vendors} isAdmin={isAdmin} onAdd={() => setShowCreateVendor(true)} /> : null}

      {showCreatePo || convertingRequest ? (
        <CreatePoModal
          vendors={vendors.filter((v) => v.is_active)}
          products={products}
          fromRequest={convertingRequest}
          onClose={() => {
            setShowCreatePo(false);
            setConvertingRequest(null);
          }}
        />
      ) : null}

      {showUploadPo ? (
        <UploadVendorPoModal
          vendors={vendors.filter((v) => v.is_active)}
          products={products}
          warehouses={warehouses}
          initialFile={uploadSeedFile}
          onClose={() => {
            setShowUploadPo(false);
            setUploadSeedFile(null);
          }}
        />
      ) : null}

      {showCreateRequest ? (
        <CreateRequestModal products={products} onClose={() => setShowCreateRequest(false)} />
      ) : null}

      {showCreateVendor ? <CreateVendorModal onClose={() => setShowCreateVendor(false)} /> : null}

      {receivingPo ? (
        <ReceivePoModal po={receivingPo} warehouses={warehouses} onClose={() => setReceivingPo(null)} />
      ) : null}

      {editingPo ? (
        <EditPoModal
          po={editingPo}
          vendors={vendors.filter((v) => v.is_active || v.id === editingPo.vendor_id)}
          products={products}
          onClose={() => setEditingPo(null)}
        />
      ) : null}
    </div>
  );
}

// â”€â”€ PO table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PoTable({
  purchaseOrders,
  isAdmin,
  onReceive,
  onEdit,
  onUploadPdf,
}: {
  purchaseOrders: PurchaseOrderRecord[];
  isAdmin: boolean;
  onReceive: (po: PurchaseOrderRecord) => void;
  onEdit: (po: PurchaseOrderRecord) => void;
  onUploadPdf: (file?: File) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleStatus = (po: PurchaseOrderRecord, status: PurchaseOrderStatus) => {
    startTransition(async () => {
      await setPurchaseOrderStatusAction(po.id, status);
      window.location.reload();
    });
  };

  const handlePayment = (po: PurchaseOrderRecord, status: PoPaymentStatus) => {
    startTransition(async () => {
      await setPurchaseOrderPaymentStatusAction(po.id, status);
      window.location.reload();
    });
  };

  const handleDelete = (po: PurchaseOrderRecord) => {
    const hasReceipts =
      (po.receipts?.length ?? 0) > 0 || (po.lines ?? []).some((l) => l.qty_received > 0);
    const msg = hasReceipts
      ? `Delete ${po.po_number}? Received stock will be reversed from inventory.`
      : `Delete ${po.po_number}? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      try {
        await deletePurchaseOrderAction(po.id);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Failed to delete PO.");
      }
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[980px]">
        <thead className="bg-slate-50">
          <tr>
            {["PO #", "Vendor", "Date", "Total", "Status", "Payment", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {purchaseOrders.map((po) => (
            <React.Fragment key={po.id}>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === po.id ? null : po.id)}
                    className="text-sm font-bold text-slate-900 underline-offset-2 hover:underline"
                  >
                    {po.po_number}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{po.vendor_name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{po.order_date}</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-900">
                  ₹{po.grand_total.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      value={po.status}
                      disabled={isPending}
                      onChange={(e) => handleStatus(po, e.target.value as PurchaseOrderStatus)}
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_BADGE[po.status]}`}
                    >
                      {(Object.keys(STATUS_BADGE) as PurchaseOrderStatus[]).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[po.status]}`}>
                      {po.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      value={po.payment_status}
                      disabled={isPending}
                      onChange={(e) => handlePayment(po, e.target.value as PoPaymentStatus)}
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${PAYMENT_BADGE[po.payment_status]}`}
                    >
                      {(Object.keys(PAYMENT_BADGE) as PoPaymentStatus[]).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${PAYMENT_BADGE[po.payment_status]}`}>
                      {po.payment_status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!["Received", "Cancelled", "Closed"].includes(po.status) ? (
                      <button
                        type="button"
                        onClick={() => onReceive(po)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                      >
                        <PackageCheck size={12} /> Receive
                      </button>
                    ) : null}
                    {isAdmin && !["Cancelled", "Closed"].includes(po.status) ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onEdit(po)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(po)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
              {expanded === po.id ? (
                <tr className="border-t border-slate-100 bg-slate-50/60">
                  <td colSpan={7} className="px-6 py-3">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {["Product", "Ordered", "Received", "Unit Cost", "Tax %"].map((h) => (
                            <th key={h} className="py-1 text-left text-[10px] font-bold uppercase text-slate-400">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(po.lines ?? []).map((l) => (
                          <tr key={l.id}>
                            <td className="py-1 text-xs font-semibold text-slate-700">
                              {l.product_name} <span className="font-normal text-slate-400">({l.product_code})</span>
                            </td>
                            <td className="py-1 text-xs text-slate-700">{l.qty_ordered} {l.unit || ""}</td>
                            <td className="py-1 text-xs text-slate-700">{l.qty_received}</td>
                            <td className="py-1 text-xs text-slate-700">₹{l.unit_cost}</td>
                            <td className="py-1 text-xs text-slate-700">{l.tax_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {po.notes ? <p className="m-0 mt-2 text-xs text-slate-500">Notes: {po.notes}</p> : null}
                  </td>
                </tr>
              ) : null}
            </React.Fragment>
          ))}
          {purchaseOrders.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-0">
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (
                      file &&
                      (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
                    ) {
                      onUploadPdf(file);
                    } else {
                      onUploadPdf();
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 px-4 py-12 text-center transition-colors ${
                    dragging ? "bg-slate-100" : "bg-white"
                  }`}
                >
                  <FileUp size={22} className={dragging ? "text-slate-800" : "text-slate-400"} />
                  <p className="m-0 text-sm font-semibold text-slate-700">
                    {dragging ? "Drop PDF to create a PO" : "No purchase orders yet"}
                  </p>
                  <p className="m-0 text-xs text-slate-500">
                    Drag & drop a vendor PO PDF here, or{" "}
                    <button
                      type="button"
                      onClick={() => onUploadPdf()}
                      className="font-bold text-slate-800 underline"
                    >
                      browse files
                    </button>
                  </p>
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// â”€â”€ Requests table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RequestsTable({
  requests,
  isAdmin,
  onConvert,
}: {
  requests: PurchaseRequestRecord[];
  isAdmin: boolean;
  onConvert: (r: PurchaseRequestRecord) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const act = (id: string, status: "Approved" | "Rejected") => {
    startTransition(async () => {
      await setPurchaseRequestStatusAction(id, status);
      window.location.reload();
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px]">
        <thead className="bg-slate-50">
          <tr>
            {["Requested", "Items", "Requested By", "Status", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </td>
              <td className="px-4 py-3 text-xs text-slate-700">
                {r.lines.map((l) => `${l.product_name ?? l.product_id} x ${l.quantity}`).join(", ")}
                {r.notes ? <div className="text-[10px] text-slate-400">{r.notes}</div> : null}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">{r.requester_name || "-"}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    r.status === "Pending"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : r.status === "Approved"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : r.status === "Converted"
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                          : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  {isAdmin && r.status === "Pending" ? (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => act(r.id, "Approved")}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => act(r.id, "Rejected")}
                        className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {r.status === "Approved" ? (
                    <button
                      type="button"
                      onClick={() => onConvert(r)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      Create PO
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {requests.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                No purchase requests.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// â”€â”€ Vendors table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function VendorsTable({
  vendors,
  isAdmin,
  onAdd,
}: {
  vendors: VendorRecord[];
  isAdmin: boolean;
  onAdd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      {isAdmin ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus size={15} /> Add Vendor
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[880px]">
          <thead className="bg-slate-50">
            <tr>
              {["Vendor", "GSTIN", "Contact", "POs", "Outstanding", "Rating", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{v.name}</div>
                  {v.address ? <div className="text-xs text-slate-500">{v.address}</div> : null}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-600">{v.gstin || "-"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {[v.phone, v.email].filter(Boolean).join(" Â· ") || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{v.po_count ?? 0}</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-900">
                  ₹{(v.outstanding_total ?? 0).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  {v.rating != null ? (
                    <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                      <Star size={13} className="fill-amber-400 text-amber-400" /> {v.rating}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      v.is_active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {v.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await updateVendorAction(v.id, { is_active: !v.is_active });
                          window.location.reload();
                        })
                      }
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      {v.is_active ? "Deactivate" : "Activate"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                  No vendors yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// â”€â”€ Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 text-base font-extrabold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"
          >
            <X size={14} className="text-slate-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const labelCls = "block text-[11px] font-bold uppercase text-slate-500";

interface PoLineDraft {
  key: string;
  lineId?: string;
  productId: string;
  qty: number;
  unitCost: number;
  taxRate: number;
  qtyReceived?: number;
}

function CreatePoModal({
  vendors,
  products,
  fromRequest,
  onClose,
}: {
  vendors: VendorRecord[];
  products: ProductOption[];
  fromRequest: PurchaseRequestRecord | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PoLineDraft[]>(() => {
    if (!fromRequest) return [];
    return fromRequest.lines
      .map((l, i) => {
        const product = products.find((p) => p.id === l.product_id);
        return {
          key: `${l.product_id}-${i}`,
          productId: l.product_id,
          qty: l.quantity,
          unitCost: product?.purchase_price ?? 0,
          taxRate: product?.gst_rate ?? 0,
        };
      })
      .filter((l) => products.some((p) => p.id === l.productId));
  });

  const addLine = () => {
    setLines((ls) => [
      ...ls,
      { key: `new-${Date.now()}`, productId: "", qty: 1, unitCost: 0, taxRate: 0 },
    ]);
  };

  const updateLine = (key: string, patch: Partial<PoLineDraft>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const tax = lines.reduce((s, l) => s + (l.qty * l.unitCost * l.taxRate) / 100, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await createPurchaseOrderAction({
          vendorId,
          requestId: fromRequest?.id ?? null,
          expectedDate: expectedDate || null,
          notes,
          lines: lines
            .filter((l) => l.productId && l.qty > 0)
            .map((l) => ({
              productId: l.productId,
              qty: l.qty,
              unitCost: l.unitCost,
              taxRate: l.taxRate,
            })),
        });
        window.location.reload();
      } catch (err: any) {
        setError(err.message || "Failed to create PO.");
      }
    });
  };

  return (
    <ModalShell title={fromRequest ? "Create PO from Request" : "New Purchase Order"} onClose={onClose}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Vendor *</label>
            <select required value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputCls}>
              <option value="">Select vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Expected Date</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Lines</label>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <Plus size={12} /> Add Line
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                <select
                  value={line.productId}
                  onChange={(e) => {
                    const product = products.find((p) => p.id === e.target.value);
                    updateLine(line.key, {
                      productId: e.target.value,
                      unitCost: product?.purchase_price ?? line.unitCost,
                      taxRate: product?.gst_rate ?? line.taxRate,
                    });
                  }}
                  className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_id})
                    </option>
                  ))}
                </select>
                <input
                  type="number" min="0.01" step="0.01" placeholder="Qty"
                  value={line.qty}
                  onChange={(e) => updateLine(line.key, { qty: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
                <input
                  type="number" min="0" step="0.01" placeholder="Unit ₹"
                  value={line.unitCost}
                  onChange={(e) => updateLine(line.key, { unitCost: Number(e.target.value) })}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
                <input
                  type="number" min="0" max="100" step="0.01" placeholder="Tax %"
                  value={line.taxRate}
                  onChange={(e) => updateLine(line.key, { taxRate: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                  className="rounded-md border border-slate-200 p-1.5 text-rose-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {lines.length === 0 ? (
              <p className="m-0 text-xs text-slate-400">No lines yet — add materials to order.</p>
            ) : null}
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-800">
            Subtotal ₹{subtotal.toFixed(2)} + Tax ₹{tax.toFixed(2)} ={" "}
            <span className="text-slate-900">₹{(subtotal + tax).toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create PO"}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function EditPoModal({
  po,
  vendors,
  products,
  onClose,
}: {
  po: PurchaseOrderRecord;
  vendors: VendorRecord[];
  products: ProductOption[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [vendorId, setVendorId] = useState(po.vendor_id || "");
  const [expectedDate, setExpectedDate] = useState(po.expected_date || "");
  const [notes, setNotes] = useState(po.notes || "");
  const [lines, setLines] = useState<PoLineDraft[]>(() =>
    (po.lines ?? []).map((l) => ({
      key: l.id,
      lineId: l.id,
      productId: l.product_id,
      qty: l.qty_ordered,
      unitCost: l.unit_cost,
      taxRate: l.tax_rate,
      qtyReceived: l.qty_received,
    }))
  );

  const addLine = () => {
    setLines((ls) => [
      ...ls,
      {
        key: `new-${Date.now()}`,
        productId: "",
        qty: 1,
        unitCost: 0,
        taxRate: 0,
        qtyReceived: 0,
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<PoLineDraft>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const tax = lines.reduce((s, l) => s + (l.qty * l.unitCost * l.taxRate) / 100, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await updatePurchaseOrderAction({
          poId: po.id,
          vendorId,
          expectedDate: expectedDate || null,
          notes,
          lines: lines
            .filter((l) => l.productId && l.qty > 0)
            .map((l) => ({
              id: l.lineId,
              productId: l.productId,
              qty: l.qty,
              unitCost: l.unitCost,
              taxRate: l.taxRate,
            })),
        });
        window.location.reload();
      } catch (err: any) {
        setError(err.message || "Failed to update PO.");
      }
    });
  };

  return (
    <ModalShell title={`Edit ${po.po_number}`} onClose={onClose}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Vendor *</label>
            <select required value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputCls}>
              <option value="">Select vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Expected Date</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Lines</label>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <Plus size={12} /> Add Line
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {lines.map((line) => {
              const locked = (line.qtyReceived ?? 0) > 0;
              return (
                <div key={line.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                  <select
                    value={line.productId}
                    disabled={locked}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value);
                      updateLine(line.key, {
                        productId: e.target.value,
                        unitCost: product?.purchase_price ?? line.unitCost,
                        taxRate: product?.gst_rate ?? line.taxRate,
                      });
                    }}
                    className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:opacity-60"
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.product_id})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={locked ? line.qtyReceived : 0.01}
                    step="0.01"
                    placeholder="Qty"
                    value={line.qty}
                    onChange={(e) => updateLine(line.key, { qty: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit ₹"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.key, { unitCost: Number(e.target.value) })}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="Tax %"
                    value={line.taxRate}
                    onChange={(e) => updateLine(line.key, { taxRate: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  {locked ? (
                    <span className="text-[10px] font-semibold text-amber-700">
                      Recv {line.qtyReceived}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                      className="rounded-md border border-slate-200 p-1.5 text-rose-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-800">
            Subtotal ₹{subtotal.toFixed(2)} + Tax ₹{tax.toFixed(2)} ={" "}
            <span className="text-slate-900">₹{(subtotal + tax).toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function CreateRequestModal({
  products,
  onClose,
}: {
  products: ProductOption[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ key: string; productId: string; qty: number }[]>([
    { key: "l1", productId: "", qty: 1 },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await createPurchaseRequestAction({
          notes,
          lines: lines
            .filter((l) => l.productId && l.qty > 0)
            .map((l) => ({
              product_id: l.productId,
              product_name: products.find((p) => p.id === l.productId)?.name,
              quantity: l.qty,
            })),
        });
        window.location.reload();
      } catch (err: any) {
        setError(err.message || "Failed to create request.");
      }
    });
  };

  return (
    <ModalShell title="New Purchase Request" onClose={onClose}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.key} className="flex items-center gap-2">
              <select
                value={line.productId}
                onChange={(e) =>
                  setLines((ls) => ls.map((l) => (l.key === line.key ? { ...l, productId: e.target.value } : l)))
                }
                className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.product_id})
                  </option>
                ))}
              </select>
              <input
                type="number" min="0.01" step="0.01"
                value={line.qty}
                onChange={(e) =>
                  setLines((ls) => ls.map((l) => (l.key === line.key ? { ...l, qty: Number(e.target.value) } : l)))
                }
                className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                className="rounded-md border border-slate-200 p-2 text-rose-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, { key: `l-${Date.now()}`, productId: "", qty: 1 }])}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
          >
            <Plus size={12} /> Add Line
          </button>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CreateVendorModal({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    gstin: "",
    address: "",
    phone: "",
    email: "",
    rating: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await createVendorAction({
          ...form,
          rating: form.rating ? Number(form.rating) : null,
        });
        window.location.reload();
      } catch (err: any) {
        setError(err.message || "Failed to create vendor.");
      }
    });
  };

  return (
    <ModalShell title="Add Vendor" onClose={onClose}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Name *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>GSTIN</label>
            <input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Rating (0-5)</label>
            <input type="number" min="0" max="5" step="0.5" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Address</label>
            <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {isPending ? "Saving..." : "Add Vendor"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ReceivePoModal({
  po,
  warehouses,
  onClose,
}: {
  po: PurchaseOrderRecord;
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const openLines = useMemo(
    () => (po.lines ?? []).filter((l) => l.qty_received < l.qty_ordered),
    [po]
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(openLines.map((l) => [l.id, String(l.qty_ordered - l.qty_received)]))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await receivePurchaseOrderAction({
          poId: po.id,
          warehouseId,
          notes,
          lines: openLines
            .map((l) => ({ lineId: l.id, qty: Number(quantities[l.id] || 0) }))
            .filter((l) => l.qty > 0),
        });
        window.location.reload();
      } catch (err: any) {
        setError(err.message || "Failed to receive.");
      }
    });
  };

  return (
    <ModalShell title={`Receive — ${po.po_number}`} onClose={onClose}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Receive into Warehouse</label>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          {openLines.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
              <div className="flex-1">
                <div className="text-xs font-bold text-slate-800">{l.product_name}</div>
                <div className="text-[10px] text-slate-400">
                  Ordered {l.qty_ordered} · Received {l.qty_received} · Remaining {l.qty_ordered - l.qty_received}
                </div>
              </div>
              <input
                type="number"
                min="0"
                max={l.qty_ordered - l.qty_received}
                step="0.01"
                value={quantities[l.id] ?? ""}
                onChange={(e) => setQuantities((q) => ({ ...q, [l.id]: e.target.value }))}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
            </div>
          ))}
          {openLines.length === 0 ? (
            <p className="m-0 text-xs text-slate-400">All lines fully received.</p>
          ) : null}
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || openLines.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Receiving..." : "Receive into Stock"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// â”€â”€ Upload vendor PO PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ConfirmLine = ParsedPoLine & {
  include: boolean;
  createAsNew: boolean;
};

function UploadVendorPoModal({
  vendors,
  products,
  warehouses,
  initialFile = null,
  onClose,
}: {
  vendors: VendorRecord[];
  products: ProductOption[];
  warehouses: WarehouseOption[];
  initialFile?: File | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [step, setStep] = useState<"upload" | "confirm">("upload");
  const [dragging, setDragging] = useState(false);
  const [vendorMode, setVendorMode] = useState<"existing" | "new">(
    vendors.length ? "existing" : "new"
  );
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [newVendorName, setNewVendorName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ConfirmLine[]>([]);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [receiveIntoStock, setReceiveIntoStock] = useState(true);
  const [meta, setMeta] = useState<{ vendorName: string | null; poNumber: string | null }>({
    vendorName: null,
    poNumber: null,
  });
  const seededRef = React.useRef(false);

  const included = lines.filter((l) => l.include);
  const matchedCount = included.filter((l) => l.matchedProductId && !l.createAsNew).length;
  const newProductCount = included.filter((l) => l.createAsNew).length;
  const needActionCount = included.filter((l) => !l.matchedProductId && !l.createAsNew).length;

  const handleFile = (file: File | null) => {
    if (!file) return;
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      try {
        const parsed = await parseVendorPoPdfAction(fd);
        setMeta({ vendorName: parsed.vendorName, poNumber: parsed.poNumber });
        setNotes(
          [parsed.poNumber ? `Vendor doc: ${parsed.poNumber}` : null, parsed.notes]
            .filter(Boolean)
            .join(" Â· ")
        );

        if (parsed.suggestedVendorId) {
          setVendorMode("existing");
          setVendorId(parsed.suggestedVendorId);
        } else if (parsed.vendorName) {
          setVendorMode("new");
          setNewVendorName(parsed.vendorName);
        } else if (!vendors.length) {
          setVendorMode("new");
        }

        setLines(
          parsed.lines.map((l) => ({
            ...l,
            include: true,
            createAsNew: l.matchLabel === "unmatched",
          }))
        );
        setStep("confirm");
      } catch (err: any) {
        setError(err?.message || "Failed to parse PDF");
      }
    });
  };

  const acceptPdf = (file: File | null | undefined) => {
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files are supported");
      return;
    }
    handleFile(file);
  };

  React.useEffect(() => {
    if (seededRef.current || !initialFile) return;
    seededRef.current = true;
    acceptPdf(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const updateLine = (key: string, patch: Partial<ConfirmLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const handleConfirm = () => {
    setError("");
    const selected = lines.filter((l) => l.include && l.quantity > 0);
    if (selected.length === 0) {
      setError("Include at least one line with quantity");
      return;
    }
    if (needActionCount > 0) {
      setError("Match each included line to a catalog product, or choose Create new product");
      return;
    }
    if (vendorMode === "existing" && !vendorId) {
      setError("Select a vendor, or switch to Create new vendor");
      return;
    }
    if (vendorMode === "new" && !newVendorName.trim()) {
      setError("Enter the new vendor name");
      return;
    }
    if (receiveIntoStock && !warehouseId) {
      setError("Select a warehouse to receive stock into");
      return;
    }

    const summary = [
      vendorMode === "new" ? `Create vendor "${newVendorName.trim()}"` : "Use existing vendor",
      newProductCount > 0 ? `Create ${newProductCount} new product(s) in catalog/inventory` : null,
      matchedCount > 0 ? `Link ${matchedCount} existing product(s)` : null,
      receiveIntoStock
        ? `Receive quantities into stock (${warehouses.find((w) => w.id === warehouseId)?.name || "warehouse"})`
        : "Create PO only (no stock receive yet)",
    ]
      .filter(Boolean)
      .join("\n• ");

    if (!window.confirm(`Confirm vendor PO import:\n\n• ${summary}\n\nContinue?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await confirmParsedVendorPoAction({
          vendorId: vendorMode === "existing" ? vendorId : null,
          createNewVendor: vendorMode === "new",
          newVendorName: newVendorName.trim(),
          notes,
          warehouseId,
          receiveIntoStock,
          lines: selected.map((l) => ({
            description: l.description,
            sku: l.sku,
            quantity: l.quantity,
            unitCost: l.unitCost,
            taxRate: l.taxRate,
            productId: l.createAsNew ? null : l.matchedProductId,
            createNewProduct: l.createAsNew,
          })),
        });
        window.location.reload();
      } catch (err: any) {
        setError(err?.message || "Failed to confirm PO import");
      }
    });
  };

  const badge = (line: ConfirmLine) => {
    const label = line.createAsNew ? "new" : line.matchLabel;
    const cls =
      label === "exact" || label === "new"
        ? label === "new"
          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
        : label === "likely"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : label === "weak"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-red-200 bg-red-50 text-red-700";
    return (
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
        {label === "new" ? "New product" : label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 text-base font-extrabold text-slate-900">
            {step === "upload" ? "Upload Vendor PO (PDF)" : "Confirm matched lines"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"
          >
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {step === "upload" ? (
          <div className="space-y-4">
            <p className="m-0 text-sm text-slate-600">
              Upload a vendor purchase order / invoice PDF. Line items will be extracted and matched
              against your product catalog for confirmation.
            </p>
            <div
              role="button"
              tabIndex={0}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isPending) setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isPending) setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(false);
                if (isPending) return;
                acceptPdf(e.dataTransfer.files?.[0]);
              }}
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
                dragging
                  ? "border-slate-900 bg-slate-100"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400"
              } ${isPending ? "opacity-70" : ""}`}
            >
              <FileUp size={28} className={dragging ? "text-slate-800" : "text-slate-400"} />
              <span className="mt-2 text-sm font-semibold text-slate-700">
                {isPending
                  ? "Parsing PDF..."
                  : dragging
                    ? "Drop PDF to upload"
                    : "Drag & drop PDF here"}
              </span>
              <span className="mt-1 text-xs text-slate-400">or click to browse Â· Max 8 MB</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={isPending}
                onChange={(e) => {
                  acceptPdf(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <label className={labelCls}>Vendor</label>
                <div className="flex flex-wrap gap-3 text-xs font-semibold">
                  <label className="inline-flex items-center gap-1.5 text-slate-700">
                    <input
                      type="radio"
                      name="vendorMode"
                      checked={vendorMode === "existing"}
                      disabled={vendors.length === 0}
                      onChange={() => setVendorMode("existing")}
                    />
                    Existing vendor
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-slate-700">
                    <input
                      type="radio"
                      name="vendorMode"
                      checked={vendorMode === "new"}
                      onChange={() => setVendorMode("new")}
                    />
                    Create new vendor
                  </label>
                </div>
                {vendorMode === "existing" ? (
                  vendors.length === 0 ? (
                    <p className="m-0 text-xs text-amber-700 font-semibold">
                      No vendors yet — switch to Create new vendor.
                    </p>
                  ) : (
                    <select
                      value={vendorId}
                      onChange={(e) => setVendorId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select vendor...</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  )
                ) : (
                  <input
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    className={inputCls}
                    placeholder="New vendor name"
                  />
                )}
                {meta.vendorName ? (
                  <p className="m-0 text-[11px] text-slate-400">
                    Detected in PDF: {meta.vendorName}
                    {vendorMode === "new" ? null : (
                      <>
                        {" Â· "}
                        <button
                          type="button"
                          className="font-bold text-slate-700 underline"
                          onClick={() => {
                            setVendorMode("new");
                            setNewVendorName(meta.vendorName || "");
                          }}
                        >
                          Use as new vendor
                        </button>
                      </>
                    )}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div>
                  <label className={labelCls}>Notes</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputCls}
                    placeholder="Optional notes"
                  />
                </div>
                <div>
                  <label className={labelCls}>Receive warehouse</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className={inputCls}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={receiveIntoStock}
                    onChange={(e) => setReceiveIntoStock(e.target.checked)}
                  />
                  After confirm, add quantities to inventory stock
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
              <span>{matchedCount} matched</span>
              <span className={newProductCount ? "text-indigo-700" : ""}>
                {newProductCount} new product(s)
              </span>
              <span className={needActionCount ? "text-amber-700" : ""}>
                {needActionCount} need action
              </span>
              {meta.poNumber ? <span>Doc #: {meta.poNumber}</span> : null}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    {["Incl", "PDF line (editable)", "Status", "Catalog / new product", "Qty", "Unit ₹", "Tax %"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.key} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={line.include}
                          onChange={(e) => updateLine(line.key, { include: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[220px]">
                        <textarea
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                          rows={2}
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                        />
                        <input
                          value={line.sku ?? ""}
                          onChange={(e) => updateLine(line.key, { sku: e.target.value || null })}
                          placeholder="SKU / code"
                          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-600"
                        />
                      </td>
                      <td className="px-3 py-2">{badge(line)}</td>
                      <td className="px-3 py-2 min-w-[220px]">
                        <div className="space-y-1.5">
                          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={line.createAsNew}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  createAsNew: e.target.checked,
                                  matchedProductId: e.target.checked ? null : line.matchedProductId,
                                  matchLabel: e.target.checked ? "unmatched" : line.matchLabel,
                                })
                              }
                            />
                            Create as new product
                          </label>
                          {!line.createAsNew ? (
                            <select
                              value={line.matchedProductId ?? ""}
                              onChange={(e) => {
                                const p = products.find((x) => x.id === e.target.value);
                                updateLine(line.key, {
                                  matchedProductId: p?.id ?? null,
                                  matchedProductCode: p?.product_id ?? null,
                                  matchedProductName: p?.name ?? null,
                                  matchLabel: p ? "exact" : "unmatched",
                                  matchConfidence: p ? 1 : 0,
                                  createAsNew: false,
                                  unitCost:
                                    line.unitCost ||
                                    (p?.purchase_price != null ? Number(p.purchase_price) : 0),
                                  taxRate:
                                    line.taxRate ||
                                    (p?.gst_rate != null ? Number(p.gst_rate) : 0),
                                });
                              }}
                              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                            >
                              <option value="">Select product...</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.product_id})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="m-0 text-[10px] text-indigo-700 font-semibold">
                              Will create PRD-### in catalog and inventory
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                          className="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitCost}
                          onChange={(e) => updateLine(line.key, { unitCost: Number(e.target.value) })}
                          className="w-24 rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.taxRate}
                          onChange={(e) => updateLine(line.key, { taxRate: Number(e.target.value) })}
                          className="w-16 rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setLines([]);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isPending ? "Confirming..." : "Confirm & Create PO"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
