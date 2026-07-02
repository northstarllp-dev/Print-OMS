"use client";

import React, { useState } from "react";
import { X, Send, Loader, CheckSquare, Square } from "lucide-react";

interface AddEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EnquiryFormData) => void | Promise<void>;
}

export interface EnquiryFormData {
  businessName: string;
  leadName: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  primaryMode: "email" | "whatsapp";
  source: "Meta Ads" | "Referrals" | "Walk-ins" | "Google Enquiry (Ph Call)" | "Website";
  notes: string;
  location: string;
}

const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  let digits = value.replace(/\D/g, "");
  
  // If starts with 91, trim it (we'll add it back)
  if (digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  
  // If starts with 0, trim it
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  
  // Take only first 10 digits
  digits = digits.slice(0, 10);
  
  // Format with +91 prefix if we have 10 digits
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  
  return digits;
};

const validatePhoneNumber = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91");
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function AddEnquiryModal({ isOpen, onClose, onSubmit }: AddEnquiryModalProps) {
  const [formData, setFormData] = useState<EnquiryFormData>({
    businessName: "",
    leadName: "",
    phone: "",
    whatsappNumber: "",
    email: "",
    primaryMode: "whatsapp",
    source: "Website",
    notes: "",
    location: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncWhatsapp, setSyncWhatsapp] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => {
      const newData = { ...prev, phone: formatted };
      if (syncWhatsapp) {
        newData.whatsappNumber = formatted;
      }
      return newData;
    });
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: "" }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === "phone" && syncWhatsapp) {
        next.whatsappNumber = value;
      }
      return next;
    });
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSyncToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSyncWhatsapp(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, whatsappNumber: prev.phone }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.businessName.trim()) {
      newErrors.businessName = "Business name is required";
    }

    if (!formData.leadName.trim()) {
      newErrors.leadName = "Lead name is required";
    }
    
    if (!validatePhoneNumber(formData.phone)) {
      newErrors.phone = "Please enter a valid 10-digit phone number";
    }
    
    if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setIsSubmitting(true);
    
    // Execute actual submit
    await onSubmit(formData);
    
    setIsSubmitting(false);
    setFormData({
      businessName: "",
      leadName: "",
      phone: "",
      whatsappNumber: "",
      email: "",
      primaryMode: "whatsapp",
      source: "Website",
      notes: "",
      location: "",
    });
    setSyncWhatsapp(false);
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "white",
          borderRadius: "16px",
          width: "90%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "auto",
          zIndex: 51,
          animation: "slideUp 0.3s ease-out",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
              New Lead Enquiry
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
              Enter the client's details to log a new enquiry.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
              color: "#64748b",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
            onMouseLeave={(e) => e.currentTarget.style.background = "white"}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            
            {/* Business Name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Business Name *
              </label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                required
                placeholder="e.g. Gourmet Cafe"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  background: "#f8fafc"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              />
              {errors.businessName && (
                <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px", marginBottom: 0 }}>
                  {errors.businessName}
                </p>
              )}
            </div>

            {/* Lead Name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Lead Name *
              </label>
              <input
                type="text"
                name="leadName"
                value={formData.leadName}
                onChange={handleChange}
                required
                placeholder="e.g. Ramesh Kumar"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  background: "#f8fafc"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              />
              {errors.leadName && (
                <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px", marginBottom: 0 }}>
                  {errors.leadName}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                required
                placeholder="Enter 10-digit phone number"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  background: "#f8fafc"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              />
              {errors.phone && (
                <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px", marginBottom: 0 }}>
                  {errors.phone}
                </p>
              )}
            </div>

            {/* WhatsApp Number */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                WhatsApp Number
              </label>
              <input
                type="tel"
                name="whatsappNumber"
                value={formData.whatsappNumber}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  background: "#f8fafc"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
                <input 
                  type="checkbox" 
                  id="sync-wa" 
                  checked={syncWhatsapp} 
                  onChange={handleSyncToggle} 
                  style={{ cursor: "pointer", accentColor: "#018F10", width: "14px", height: "14px", margin: 0 }} 
                />
                <label htmlFor="sync-wa" style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", cursor: "pointer", userSelect: "none" }}>
                  Same as phone number
                </label>
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="client@company.com"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  background: "#f8fafc"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              />
              {errors.email && (
                <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px", marginBottom: 0 }}>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Primary Mode of Communication */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Primary Mode *
              </label>
              <select
                name="primaryMode"
                value={formData.primaryMode}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  background: "#f8fafc",
                  transition: "all 0.2s",
                  cursor: "pointer"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
            </div>

            {/* Source */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Source *
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  background: "#f8fafc",
                  transition: "all 0.2s",
                  cursor: "pointer"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              >
                <option value="Meta Ads">Meta Ads</option>
                <option value="Referrals">Referrals</option>
                <option value="Walk-ins">Walk-ins</option>
                <option value="Google Enquiry (Ph Call)">Google Enquiry (Ph Call)</option>
                <option value="Website">Website</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Location / Area
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., WhiteField, JP Nagar"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  background: "#f8fafc"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              />
            </div>

            {/* Requirements */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Requirement Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Enter any details about their requirements..."
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "14px",
                  minHeight: "100px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  resize: "vertical",
                  transition: "all 0.2s",
                  background: "#f8fafc"
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#018F10"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: "flex", gap: "12px", marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0f172a",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "var(--color-primary)",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "white",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isSubmitting ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = "var(--color-primary-container)";
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = "var(--color-primary)";
              }}
            >
              {isSubmitting ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
              {isSubmitting ? "Creating..." : "Create Enquiry"}
            </button>
          </div>
        </form>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translate(-50%, -45%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}
