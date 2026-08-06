"use client";

import React from "react";
import { Upload, Loader2, Search, X, Phone, FileText, Trash2, Eye, ArrowLeft } from "lucide-react";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";
import { parseStoredRef } from "@/utils/storage/storageRef";
import { uploadFiles } from "@/utils/storage/uploadClient";
import { OrderImage } from "@/components/storage/OrderImage";
import { getSignedReadUrl } from "@/utils/storage/signedReadCache";
import {
  createServiceTicketAction,
  lookupOrdersByPhone,
  type TicketPhoto,
  type ServiceTicketRecord,
} from "@/features/service-tickets/actions/serviceTicketActions";
import { Logo } from "@/components/ui/Logo";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import { CopyLinkButton } from "./CopyLinkButton";
import { CustomerMessageModal } from "@/features/notifications/customer-message/CustomerMessageModal";

interface CreateServiceTicketModalProps {
  onClose: () => void;
  onCreated: () => void;
  /** Prefill from an existing order (e.g. orders list ⋮ menu). */
  preset?: {
    phone?: string;
    customerId?: string;
    orderId?: string;
    orderLabel?: string;
  };
}

type OrderOption = {
  id: string;
  orderId: string;
  label: string;
};

export function CreateServiceTicketModal({
  onClose,
  onCreated,
  preset,
}: CreateServiceTicketModalProps) {
  const digitsFromPreset = (preset?.phone || "").replace(/\D/g, "").replace(/^91/, "");
  const [phone, setPhone] = React.useState(digitsFromPreset);
  const [description, setDescription] = React.useState("");
  const [resolutionNotes, setResolutionNotes] = React.useState("");
  const [orders, setOrders] = React.useState<OrderOption[]>(() =>
    preset?.orderId
      ? [
          {
            id: preset.orderId,
            orderId: preset.orderId,
            label: preset.orderLabel || preset.orderId,
          },
        ]
      : []
  );
  const [selectedOrderId, setSelectedOrderId] = React.useState(preset?.orderId || "");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState(preset?.customerId || "");
  const [photos, setPhotos] = React.useState<TicketPhoto[]>([]);
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = React.useState<ServiceTicketRecord | null>(null);

  const canSubmit =
    selectedCustomerId &&
    selectedOrderId &&
    phone.trim() &&
    description.trim() &&
    !saveLoading;

  const getFormattedPhone = (p: string) => {
    let clean = p.replace(/\s+/g, "");
    if (clean.startsWith("+91")) return clean;
    if (clean.startsWith("91") && clean.length === 12) return "+" + clean;
    if (clean.startsWith("0") && clean.length === 11) return "+91" + clean.substring(1);
    return "+91" + clean;
  };

  async function handleLookup() {
    if (!phone.trim()) {
      setError("Please enter a phone number first.");
      return;
    }
    setLookupLoading(true);
    setError(null);
    try {
      const formattedPhone = getFormattedPhone(phone);
      const result = await lookupOrdersByPhone(formattedPhone);
      setSelectedCustomerId(result.customer?.id ?? "");
      setOrders(result.orders ?? []);
      setSelectedOrderId("");
      if (!result.customer || result.orders.length === 0) {
        setError("No customer orders found for this mobile number.");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to fetch orders"));
    } finally {
      setLookupLoading(false);
    }
  }

  async function uploadFilesHandler(files: FileList | null) {
    if (!files || files.length === 0 || !selectedOrderId) return;
    setError(null);
    try {
      const { ok, failed } = await uploadFiles(Array.from(files), {
        orderId: selectedOrderId,
        purpose: "service_ticket_photo",
        channel: "staff",
        concurrency: 3,
      });
      const uploadedPhotos: TicketPhoto[] = ok.map((o) => ({
        url: `${o.bucket}/${o.path}`,
        name: o.fileName,
        uploadedBy: "Admin",
        createdAt: new Date().toISOString(),
      }));
      setPhotos((prev) => [...prev, ...uploadedPhotos]);
      if (failed.length) {
        setError(`${failed.length} photo(s) failed to upload: ${failed[0].error}`);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Photo upload failed"));
    }
  }

  async function removePhoto(index: number) {
    const photo = photos[index];
    // Best-effort storage cleanup (photo is not yet linked to a DB record).
    try {
      const parsed = parseStoredRef(photo.url);
      if (parsed) {
        await deleteStorageFilesAction(parsed.bucket, [parsed.path]);
      }
    } catch {
      // best-effort cleanup
    }
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    if (!canSubmit) return;
    setSaveLoading(true);
    setError(null);
    try {
      const ticket = await createServiceTicketAction({
        customerId: selectedCustomerId,
        orderId: selectedOrderId,
        phone: getFormattedPhone(phone),
        description,
        photos,
        resolutionNotes: resolutionNotes || undefined,
      });
      setCreatedTicket(ticket);
    } catch (err: unknown) {
      // Roll back uploaded photos so they don't become storage orphans.
      const byBucket = new Map<string, string[]>();
      for (const p of photos) {
        const parsed = parseStoredRef(p.url);
        if (parsed) {
          const list = byBucket.get(parsed.bucket) || [];
          list.push(parsed.path);
          byBucket.set(parsed.bucket, list);
        }
      }
      for (const [bucket, paths] of byBucket) {
        await deleteStorageFilesAction(bucket, paths).catch(() => {});
      }
      setPhotos([]);
      setError(getErrorMessage(err, "Failed to create ticket"));
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center bg-[rgba(12,15,26,0.6)] p-0 sm:p-4 md:p-6"
        onClick={onClose}
      >
        <div
          className="prt-card prt-animate-in flex flex-col w-full max-h-[100dvh] sm:max-h-[92vh] sm:max-w-[760px] rounded-t-2xl sm:rounded-2xl overflow-hidden bg-white"
          onClick={(e) => e.stopPropagation()}
          style={{ padding: 0 }}
        >
          <div className="shrink-0 border-b border-slate-100 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-6 sm:pt-5 sm:pb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                type="button"
                onClick={onClose}
                className="sm:hidden inline-flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-2 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <div className="hidden sm:block min-w-0 overflow-visible">
                <Logo height={36} width={160} align="left" applyScale={false} />
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <CopyLinkButton />
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="sm:hidden mb-3 flex justify-center overflow-visible py-1">
              <Logo height={44} width={200} align="center" applyScale={false} />
            </div>

            <h2 className="m-0 text-[var(--color-primary)] text-lg sm:text-xl font-extrabold">
              Create Service Ticket
            </h2>
            <p className="m-0 mt-1 text-[var(--color-on-surface-variant)] text-xs sm:text-sm">
              Follow the steps below to record a new customer issue.
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 sm:px-4 text-sm text-[var(--color-error)]">
                {error}
              </div>
            )}

            <div className="mb-5 sm:mb-6">
              <label className="text-label-caps block mb-2 text-[var(--color-on-surface-variant)]">
                1. Customer Identity
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                <div className="relative flex-1 flex items-center min-w-0">
                  <div className="absolute left-3 sm:left-4 flex items-center gap-1.5 text-[var(--color-on-surface-variant)] pointer-events-none">
                    <Phone size={16} />
                    <span className="text-sm font-medium">+91</span>
                  </div>
                  <input
                    className="prt-input w-full !pl-[4.5rem] sm:!pl-[4.75rem]"
                    value={phone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, "");
                      if (val.length === 12 && val.startsWith("91")) val = val.slice(2);
                      else if (val.length === 11 && val.startsWith("0")) val = val.slice(1);
                      setPhone(val.slice(0, 10));
                    }}
                    placeholder="Mobile number"
                    disabled={orders.length > 0}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                  />
                </div>
                {orders.length === 0 ? (
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupLoading || phone.length < 10}
                    className="prt-btn prt-btn-primary w-full sm:w-auto justify-center"
                  >
                    {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {lookupLoading ? "Searching..." : "Find Orders"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOrders([]);
                      setSelectedOrderId("");
                      setSelectedCustomerId("");
                    }}
                    className="prt-btn prt-btn-secondary w-full sm:w-auto justify-center"
                  >
                    Change Number
                  </button>
                )}
              </div>
            </div>

            {orders.length > 0 && (
              <div className="prt-animate-in">
                <div className="p-4 sm:p-6 mb-4 sm:mb-6 rounded-[var(--radius-lg)] border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)]">
                  <h3 className="text-title-sm mb-4 sm:mb-5 text-[var(--color-on-surface)] flex items-center gap-2">
                    <FileText size={18} className="text-blue-600 shrink-0" /> 2. Ticket Details
                  </h3>

                  <div className="mb-4 sm:mb-5">
                    <label className="text-label-caps block mb-2 text-[var(--color-on-surface-variant)]">
                      Select Related Order
                    </label>
                    <select
                      className="prt-input w-full"
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                    >
                      <option value="">Select an order...</option>
                      {orders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4 sm:mb-5">
                    <label className="text-label-caps block mb-2 text-[var(--color-on-surface-variant)]">
                      Issue Description
                    </label>
                    <textarea
                      className="prt-input w-full resize-y"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what is wrong or needs service..."
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="text-label-caps block mb-2 text-[var(--color-on-surface-variant)]">
                      Initial Resolution (Optional)
                    </label>
                    <textarea
                      className="prt-input w-full resize-y"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Any initial steps taken or planned resolution..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-6 mb-5 sm:mb-8 rounded-[var(--radius-lg)] border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)]">
                  <h3 className="text-title-sm mb-4 sm:mb-5 text-[var(--color-on-surface)] flex items-center gap-2">
                    <Upload size={18} className="text-emerald-600 shrink-0" /> 3. Problem Photos
                  </h3>

                  <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[var(--color-outline-variant)] rounded-[var(--radius-lg)] px-4 py-6 sm:py-8 cursor-pointer bg-[var(--color-surface-container-low)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-container-lowest)] transition-all">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <Upload size={24} />
                    </div>
                    <div className="text-center">
                      <p className="text-title-sm m-0 mb-1 text-[var(--color-on-surface)]">
                        Click to upload images
                      </p>
                      <p className="text-body-md m-0 text-[var(--color-on-surface-variant)] text-xs sm:text-sm">
                        Upload photos showing the issue
                      </p>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const target = e.target;
                        await uploadFilesHandler(target.files);
                        target.value = "";
                      }}
                    />
                  </label>

                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-4 sm:mt-5">
                      {photos.map((photo, i) => (
                        <div
                          key={i}
                          className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-[var(--color-outline-variant)] shadow-sm"
                        >
                          <OrderImage
                            src={photo.url}
                            width={200}
                            alt={`Preview ${i}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 absolute inset-0 bg-slate-900/70 flex items-center justify-center gap-1.5 transition-opacity">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const parsed = parseStoredRef(photo.url);
                                  const href = parsed
                                    ? await getSignedReadUrl(parsed.bucket, parsed.path)
                                    : photo.url;
                                  window.open(href, "_blank", "noopener,noreferrer");
                                } catch {
                                  /* ignore */
                                }
                              }}
                              className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40"
                              title="View"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void removePhoto(i);
                              }}
                              className="w-7 h-7 rounded-full bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500"
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="prt-btn prt-btn-secondary w-full sm:w-auto justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!canSubmit}
                    className="prt-btn prt-btn-primary w-full sm:w-auto justify-center"
                    style={{
                      opacity: canSubmit ? 1 : 0.6,
                      cursor: canSubmit ? "pointer" : "not-allowed",
                    }}
                  >
                    {saveLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Creating...
                      </>
                    ) : (
                      "Create Service Ticket"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {createdTicket && (
          <div onClick={(e) => e.stopPropagation()}>
            <CustomerMessageModal
              isOpen
              templateKey="service_ticket_created"
              info={{
                customerId: createdTicket.customer_id,
                orderId: createdTicket.order_id,
                orderNo: createdTicket.order_code || undefined,
                businessName:
                  createdTicket.customer_business_name ||
                  createdTicket.customer_name ||
                  "Customer",
                phone: createdTicket.phone,
                ticketNo: createdTicket.ticket_id,
              }}
              onClose={() => {
                setCreatedTicket(null);
                onCreated();
                onClose();
              }}
            />
          </div>
        )}
      </div>
    </OverlayPortal>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
