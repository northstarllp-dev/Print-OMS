import React from "react";
import ServiceTicketPublicClient from "./ServiceTicketPublicClient";

export default async function PublicServiceTicketPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return <ServiceTicketPublicClient companyId={companyId} />;
}

