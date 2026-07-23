import React from "react";
import ServiceTicketPublicClient from "./ServiceTicketPublicClient";
import { resolvePublicCompanyId } from "@/features/service-tickets/resolvePublicCompanyId";

export default async function PublicServiceTicketPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId: raw } = await params;
  // Accept slug or UUID in the URL; always hand the client a UUID for DB APIs.
  const companyId = resolvePublicCompanyId(raw) || raw;
  return <ServiceTicketPublicClient companyId={companyId} />;
}
