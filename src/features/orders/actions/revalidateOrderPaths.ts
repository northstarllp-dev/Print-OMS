import { revalidatePath } from "next/cache";

/** Revalidate order workspace + portal detail pages only (not list/queue pages). */
export function revalidateOrderDetailPaths(friendlyOrId: string) {
  revalidatePath(`/admin/orders/${friendlyOrId}`);
  revalidatePath(`/staff/orders/${friendlyOrId}`);
  revalidatePath(`/printoms/portal/order/${friendlyOrId}`);
}

/** Staff/admin order detail only — for internal quotation saves. */
export function revalidateStaffOrderDetailPaths(friendlyOrId: string) {
  revalidatePath(`/admin/orders/${friendlyOrId}`);
  revalidatePath(`/staff/orders/${friendlyOrId}`);
}
