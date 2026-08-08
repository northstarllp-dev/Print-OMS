"use client";

import React, { useMemo } from "react";
import { loadClientConfig } from "@/config/loadClientConfig";
import {
  getBusinessOperation,
  getBusinessOperationsForTenant,
} from "@/features/orders/businessOperations";

/** True when the tenant has multiple business operations configured. */
export function tenantHasMultipleBusinessOperations(): boolean {
  return getBusinessOperationsForTenant(loadClientConfig().businessOperations).length > 1;
}

export function resolveBusinessOperationLabel(opId?: string | null): string {
  return getBusinessOperation(opId, loadClientConfig().businessOperations).label;
}

/**
 * Shows the business-operation label under an enquiry/order id
 * only when the tenant has more than one op configured.
 */
export function BusinessOperationCaption({
  opId,
  className = "text-[10px] font-semibold text-slate-500 mt-0.5 leading-tight",
  style,
}: {
  opId?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const show = useMemo(() => tenantHasMultipleBusinessOperations(), []);
  if (!show) return null;
  return (
    <div className={className} style={style}>
      {resolveBusinessOperationLabel(opId)}
    </div>
  );
}
