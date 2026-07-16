"use client";

import { useState } from "react";
import {
  customerApproveQuotation,
  customerRequestRevision,
} from "@/features/quotations/actions/quotationActions";
import { revalidateOrderPathsAction } from "@/features/orders/actions/orderActions";

function friendlyError(err: any): string {
  const msg: string = err?.message || "";
  if (msg === "Unauthorized" || msg.toLowerCase().includes("unauthorized")) {
    return "Your session has expired. Please refresh the page and try again.";
  }
  return msg || "Something went wrong. Please try again.";
}

export function useQuotationActions(
  orderId: string,
  customerName: string,
  onOrderUpdate: (updater: (prev: any) => any) => void,
  portalToken?: string
) {
  const [quoteFeedback, setQuoteFeedback] = useState("");
  const [showQuoteDeclineInput, setShowQuoteDeclineInput] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApproveQuote = async () => {
    setActionError(null);
    setUpdatingStatus("quote-approve");
    try {
      await customerApproveQuotation(orderId, customerName, portalToken);
      onOrderUpdate((prev) => ({
        ...prev,
        stage: "Quotation Approved",
        quoteDetails: { ...(prev.quoteDetails || {}), status: "Approved" },
      }));
      await revalidateOrderPathsAction(orderId);
    } catch (err: any) {
      setActionError(friendlyError(err));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeclineQuote = async () => {
    if (!quoteFeedback.trim()) return;
    setActionError(null);
    setUpdatingStatus("quote-decline");
    try {
      await customerRequestRevision(orderId, customerName, quoteFeedback, portalToken);
      onOrderUpdate((prev) => ({
        ...prev,
        stage: "Quotation Negotiation",
        quoteDetails: {
          ...(prev.quoteDetails || {}),
          status: "Rejected",
          rejectionReason: quoteFeedback,
        },
      }));
      await revalidateOrderPathsAction(orderId);
      setQuoteFeedback("");
      setShowQuoteDeclineInput(false);
    } catch (err: any) {
      setActionError(friendlyError(err));
    } finally {
      setUpdatingStatus(null);
    }
  };

  return {
    quoteFeedback,
    setQuoteFeedback,
    showQuoteDeclineInput,
    setShowQuoteDeclineInput,
    updatingStatus,
    actionError,
    setActionError,
    handleApproveQuote,
    handleDeclineQuote,
  };
}
