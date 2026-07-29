import { redirect } from "next/navigation";

/** Old links included a company id; portal is now deploy-scoped. */
export default async function LegacyPublicServiceTicketPage() {
  redirect("/service-ticket");
}
