"use client";

import React, { useState, useEffect } from "react";
import { X, User, Phone, MessageCircle, Mail, MapPin, Building2, Calendar, FileText, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Customer } from "@/types";
import { getEnquiryByOrderId } from "@/features/enquiries/actions/enquiryActions";
import { normalizeWhatsAppShareNumber } from "@/features/notifications/customer-message/buildShareLinks";

interface CustomerDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  orderId: string;
  /** Contact / lead person name for this order. */
  leadName?: string | null;
  /** Site-visit / skip-flow location used for installation. */
  installationAddress?: string | null;
  installationGps?: string | null;
}

function isUsableValue(value?: string | null): value is string {
  const v = value?.trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  return lower !== "n/a" && !lower.includes("pending");
}

function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function ContactLink({
  href,
  children,
  className = "",
  title,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      title={title}
      className={`text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline underline-offset-2 break-all ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}

export const CustomerDetailsDrawer: React.FC<CustomerDetailsDrawerProps> = ({
  isOpen,
  onClose,
  customer,
  orderId,
  leadName,
  installationAddress,
  installationGps,
}) => {
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      const fetchEnquiry = async () => {
        setLoading(true);
        try {
          const data = await getEnquiryByOrderId(orderId);
          setEnquiry(data);
        } catch (error) {
          console.error("Failed to fetch enquiry:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchEnquiry();
    }
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const whatsappRaw = customer.whatsapp || customer.phone;
  const whatsappHref = isUsableValue(whatsappRaw)
    ? `https://wa.me/${normalizeWhatsAppShareNumber(whatsappRaw)}`
    : null;
  const phoneHref = isUsableValue(customer.phone)
    ? `tel:${customer.phone.replace(/[^\d+]/g, "")}`
    : null;
  const emailHref = isUsableValue(customer.email) ? `mailto:${customer.email.trim()}` : null;

  const billingText = [customer.billingAddress, customer.city].filter(Boolean).join(", ");
  const billingHref = isUsableValue(customer.billingAddress) ? mapsSearchUrl(billingText) : null;

  const installDisplay =
    (isUsableValue(installationAddress) && installationAddress) ||
    (isUsableValue(customer.shippingAddress) && customer.shippingAddress) ||
    null;
  const installHref = installDisplay
    ? mapsSearchUrl(
        (isUsableValue(installationGps) ? installationGps : null) || installDisplay
      )
    : null;
  const installLabel = isUsableValue(installationAddress)
    ? "Installation Address"
    : "Shipping Address";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[999]"
        onClick={onClose}
        style={{ animation: "fadeIn 0.2s ease-out" }}
      />

      {/* Drawer — full screen on mobile/tablet, side panel on desktop */}
      <div
        className="fixed inset-0 lg:inset-y-0 lg:right-0 lg:left-auto w-full lg:max-w-[420px] bg-[#F8FAFC] shadow-2xl z-[1000] lg:border-l border-slate-200 flex flex-col"
        style={{ animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 bg-white border-b border-slate-200 shrink-0 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden inline-flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
              <User size={18} className="text-blue-600 sm:hidden" />
              <User size={20} className="text-blue-600 hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 leading-tight truncate">{customer.name}</h2>
              <div className="text-xs font-semibold text-slate-500 mt-0.5 font-mono truncate">
                {customer.customerCode || customer.customerId || "No ID"}
              </div>
              {(leadName?.trim() || enquiry?.leadName?.trim()) && (
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  Lead: {leadName?.trim() || enquiry?.leadName}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Contact Section (Bento Style) */}
          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 ml-1">Contact Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <MessageCircle size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp</div>
                    {whatsappHref ? (
                      <ContactLink href={whatsappHref}>{whatsappRaw}</ContactLink>
                    ) : (
                      <div className="text-sm font-semibold text-slate-700">N/A</div>
                    )}
                  </div>
                </div>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="w-8 h-8 shrink-0 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                  >
                    <ArrowRight size={14} />
                  </a>
                )}
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Phone size={14} className="text-slate-400" />
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Phone</div>
                </div>
                {phoneHref ? (
                  <ContactLink href={phoneHref} className="truncate block">
                    {customer.phone}
                  </ContactLink>
                ) : (
                  <div className="text-sm font-semibold text-slate-700 truncate">N/A</div>
                )}
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={14} className="text-slate-400" />
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Email</div>
                </div>
                {emailHref ? (
                  <ContactLink href={emailHref} className="truncate block" title={customer.email}>
                    {customer.email}
                  </ContactLink>
                ) : (
                  <div className="text-sm font-semibold text-slate-700 truncate" title={customer.email}>
                    N/A
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Location Section */}
          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 ml-1">Addresses</h3>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-start gap-3">
                <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Billing Address</div>
                  {billingHref ? (
                    <>
                      <ContactLink href={billingHref} className="text-xs font-medium leading-relaxed">
                        {customer.billingAddress}
                      </ContactLink>
                      {customer.city && <div className="text-xs text-slate-500 mt-1">{customer.city}</div>}
                    </>
                  ) : (
                    <div className="text-xs font-medium text-slate-700 leading-relaxed">
                      {customer.billingAddress || "No billing address provided."}
                      {customer.city && <div className="text-xs text-slate-500 mt-1">{customer.city}</div>}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 flex items-start gap-3 bg-slate-50/50">
                <Building2 size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{installLabel}</div>
                  {installHref && installDisplay ? (
                    <>
                      <ContactLink href={installHref} className="text-xs font-medium leading-relaxed">
                        {installDisplay}
                      </ContactLink>
                      {isUsableValue(installationGps) && (
                        <div className="text-[10px] font-mono text-slate-500 mt-1">{installationGps}</div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs font-medium text-slate-700 leading-relaxed">
                      {customer.shippingAddress ||
                        "Installation address pending — schedule or skip site visit to set map location."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Original Enquiry Section */}
          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 ml-1 flex items-center justify-between">
              Original Enquiry Context
              {loading && <Loader2 size={12} className="animate-spin text-slate-300" />}
            </h3>

            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center text-center">
                <Loader2 size={24} className="animate-spin text-slate-300 mb-2" />
                <div className="text-xs font-medium text-slate-500">Fetching enquiry data...</div>
              </div>
            ) : enquiry ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar size={14} className="text-slate-400" />
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Received</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-800">
                      {new Date(enquiry.dateReceived || enquiry.date_received).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50/30">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Source</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-800">{enquiry.source || "N/A"}</div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-slate-400" />
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Notes</div>
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    {enquiry.notes || "No initial notes recorded."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <FileText size={16} className="text-slate-300" />
                </div>
                <div className="text-xs font-medium text-slate-500">No linked enquiry found for this order.</div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-stretch md:justify-end pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onClose}
            className="w-full md:w-auto px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close Details
          </button>
        </div>
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
  );
};
