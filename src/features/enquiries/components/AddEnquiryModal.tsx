"use client";

import React, { useMemo, useState } from "react";
import { X, Send, Loader } from "lucide-react";
import {
  EMPTY_ENQUIRY_FORM,
  formatPhoneNumber,
  validateEnquiryForm,
  type EnquiryFormData,
} from "@/features/enquiries/enquiryFormLogic";
import { loadClientConfig } from "@/config/loadClientConfig";
import { getBusinessOperationsForTenant } from "@/features/orders/businessOperations";
import { DEFAULT_BUSINESS_OPERATION_ID } from "@/config/schema/businessOperations";

export type { EnquiryFormData };

interface AddEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EnquiryFormData) => void | Promise<void>;
  initialData?: EnquiryFormData | null;
}

const fieldClass =
  "w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-[14px] font-medium text-slate-800 outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-white";
const labelClass =
  "block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5";

export function AddEnquiryModal({ isOpen, onClose, onSubmit, initialData }: AddEnquiryModalProps) {
  const isEditMode = !!initialData;
  const businessOps = useMemo(
    () => getBusinessOperationsForTenant(loadClientConfig().businessOperations),
    []
  );
  const defaultOpId =
    businessOps[0]?.id || DEFAULT_BUSINESS_OPERATION_ID;

  const [formData, setFormData] = useState<EnquiryFormData>({
    ...EMPTY_ENQUIRY_FORM,
    businessOperation: defaultOpId,
  });

  React.useEffect(() => {
    if (isOpen && initialData) {
      setFormData(initialData);
    } else if (isOpen && !initialData) {
      setFormData({ ...EMPTY_ENQUIRY_FORM, businessOperation: defaultOpId });
    }
  }, [isOpen, initialData, defaultOpId]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncWhatsapp, setSyncWhatsapp] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const showBusinessOpPicker = businessOps.length > 1;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData((prev) => {
      const newData = { ...prev, phone: formatted };
      if (syncWhatsapp) newData.whatsappNumber = formatted;
      return newData;
    });
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "phone" && syncWhatsapp) next.whatsappNumber = value;
      return next;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSyncToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSyncWhatsapp(checked);
    if (checked) setFormData((prev) => ({ ...prev, whatsappNumber: prev.phone }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const newErrors = validateEnquiryForm(formData);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    await onSubmit({
      ...formData,
      businessOperation: formData.businessOperation || defaultOpId,
    });
    setIsSubmitting(false);
    if (!isEditMode) {
      setFormData({ ...EMPTY_ENQUIRY_FORM, businessOperation: defaultOpId });
      setSyncWhatsapp(false);
    }
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-enquiry-title"
        className="relative z-[101] w-full sm:w-[90%] sm:max-w-[600px] max-h-[92dvh] sm:max-h-[90vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-4 sm:px-6 bg-slate-50 border-b border-slate-200">
          <div className="min-w-0">
            <h2 id="add-enquiry-title" className="text-[17px] sm:text-lg font-extrabold text-slate-900 m-0">
              {isEditMode ? "Edit Enquiry" : "New Lead Enquiry"}
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-0">
              {isEditMode ? "Update the enquiry details below." : "Enter the client\u2019s details to log a new enquiry."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="enquiry-business">
                  Business Name *
                </label>
                <input
                  id="enquiry-business"
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Gourmet Cafe"
                  className={fieldClass}
                />
                {errors.businessName && (
                  <p className="text-xs text-red-500 mt-1 mb-0">{errors.businessName}</p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="enquiry-lead">
                  Lead Name *
                </label>
                <input
                  id="enquiry-lead"
                  type="text"
                  name="leadName"
                  value={formData.leadName}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Ramesh Kumar"
                  className={fieldClass}
                />
                {errors.leadName && (
                  <p className="text-xs text-red-500 mt-1 mb-0">{errors.leadName}</p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="enquiry-phone">
                  Phone Number *
                </label>
                <input
                  id="enquiry-phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  required
                  placeholder="Enter 10-digit phone number"
                  className={fieldClass}
                  inputMode="tel"
                />
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1 mb-0">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="enquiry-wa">
                  WhatsApp Number
                </label>
                <input
                  id="enquiry-wa"
                  type="tel"
                  name="whatsappNumber"
                  value={formData.whatsappNumber}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className={fieldClass}
                  inputMode="tel"
                />
                <label
                  htmlFor="sync-wa"
                  className="mt-2.5 flex items-center gap-2.5 min-h-[44px] sm:min-h-0 sm:mt-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    id="sync-wa"
                    checked={syncWhatsapp}
                    onChange={handleSyncToggle}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-500">
                    Same as phone number
                  </span>
                </label>
              </div>

              <div>
                <label className={labelClass} htmlFor="enquiry-email">
                  Email Address
                </label>
                <input
                  id="enquiry-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="client@company.com (optional)"
                  className={fieldClass}
                  inputMode="email"
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1 mb-0">{errors.email}</p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="enquiry-mode">
                  Primary Mode *
                </label>
                <select
                  id="enquiry-mode"
                  name="primaryMode"
                  value={formData.primaryMode}
                  onChange={handleChange}
                  className={`${fieldClass} cursor-pointer`}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="enquiry-source">
                  Source *
                </label>
                <select
                  id="enquiry-source"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className={`${fieldClass} cursor-pointer`}
                >
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Referrals">Referrals</option>
                  <option value="Walk-ins">Walk-ins</option>
                  <option value="Google Enquiry (Ph Call)">Google Enquiry (Ph Call)</option>
                  <option value="Website">Website</option>
                </select>
              </div>

              {showBusinessOpPicker ? (
                <div>
                  <label className={labelClass} htmlFor="enquiry-business-op">
                    Business Operation *
                  </label>
                  <select
                    id="enquiry-business-op"
                    name="businessOperation"
                    value={formData.businessOperation || defaultOpId}
                    onChange={handleChange}
                    className={`${fieldClass} cursor-pointer`}
                  >
                    {businessOps.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className={labelClass} htmlFor="enquiry-location">
                  Location / Area
                </label>
                <input
                  id="enquiry-location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., WhiteField, JP Nagar"
                  className={fieldClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="enquiry-notes">
                  Requirement Notes
                </label>
                <textarea
                  id="enquiry-notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Enter any details about their requirements..."
                  rows={4}
                  className={`${fieldClass} min-h-[100px] resize-y`}
                />
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 px-4 py-4 sm:px-6 border-t border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-3 sm:py-2.5 px-4 rounded-lg bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:flex-1 py-3 sm:py-2.5 px-4 rounded-lg bg-[var(--color-primary)] text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:opacity-95"
            >
              {isSubmitting ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {isSubmitting ? (isEditMode ? "Saving..." : "Creating...") : (isEditMode ? "Save Changes" : "Create Enquiry")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
