import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import {
  getStaffHomePath,
  QUEUE_SLUG_TO_STAGE,
} from "@/features/orders/workspace/shared/stageGrants";
import type { StageActor } from "@/features/orders/workspace/shared/types";

/**
 * Legacy per-stage queue URLs → unified My Orders with stage tab.
 * Bookmarks to /staff/site-visit, /staff/orders, etc. keep working.
 */
export default async function StaffDynamicQueuePage({
  params,
}: {
  params: Promise<{ queue: string }>;
}) {
  const { queue } = await params;

  const user = await getCurrentUser();
  if (!user || (user.role !== "staff" && user.role !== "admin")) {
    redirect("/staff/login");
  }

  const actor: StageActor = {
    role: user.role,
    staff_role: user.staff_role,
    company_id: user.company_id,
  };

  const stage = QUEUE_SLUG_TO_STAGE[queue];
  if (stage) {
    redirect(`/staff/my-orders?stage=${stage}`);
  }

  redirect(getStaffHomePath(actor));
}
