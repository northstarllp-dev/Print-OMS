"use client";

import { useState } from "react";
import {
  customerApproveQuotation,
  customerRequestRevision,
} from "@/features/quotations/actions/quotationActions";
import { revalidateOrderPathsAction } from "@/features/orders/actions/orderActions";

export function useQuotationActions(
  orderId: string,
  customerName: string,
  onOrderUpdate: (updater: (prev: any) => any) => void
) {
  const [quoteFeedback, setQuoteFeedback] = useState("");
  const [showQuoteDeclineInput, setShowQuoteDeclineInput] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const handleApproveQuote = async () => {
    setUpdatingStatus("quote-approve");
    try {
      await customerApproveQuotation(orderId, customerName);
      onOrderUpdate((prev) => ({
        ...prev,
        stage: "Quotation Approved",
        quoteDetails: { ...(prev.quoteDetails || {}), status: "Approved" },
      }));
      await revalidateOrderPathsAction(orderId);
    } catch (err: any) {
      alert(err?.message || "Failed to approve quotation");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeclineQuote = async () => {
    if (!quoteFeedback.trim()) return;
    setUpdatingStatus("quote-decline");
    try {
      await customerRequestRevision(orderId, customerName, quoteFeedback);
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
      alert(err?.message || "Failed to submit feedback");
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
    handleApproveQuote,
    handleDeclineQuote,
  };
}
