"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveTicketPermission } from "@/features/service-tickets/ticketGrants";
import { assertAdminOnly } from "@/features/orders/workspace/shared/serverPermissions";

export type TicketPhoto = {
  url: string;
  name?: string;
  uploadedBy?: string;
  createdAt?: string;
};

export type ServiceTicketRecord = {
  id: string;
  ticket_id: string;
  company_id: string;
  customer_id: string;
  order_id: string;
  phone: string;
  description: string;
  photos: TicketPhoto[];
  resolution_notes: string | null;
  resolution_photos: TicketPhoto[];
  status: "open" | "with_service_manager" | "closed";
  source: "admin" | "public_link";
  created_by: string | null;
  sent_to_service_manager_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_business_name?: string;
  order_code?: string;
};

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

function normalizePhotos(input: unknown): TicketPhoto[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      if (typeof value.url !== "string" || value.url.length === 0) return null;
      return {
        url: value.url,
        name: typeof value.name === "string" ? value.name : undefined,
        uploadedBy: typeof value.uploadedBy === "string" ? value.uploadedBy : undefined,
        createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
      };
    })
    .filter((item): item is TicketPhoto => item !== null);
}

type TicketRow = {
  id: string;
  ticket_id: string;
  company_id: string;
  customer_id: string;
  order_id: string;
  phone: string;
  description: string;
  photos: unknown;
  resolution_notes: string | null;
  resolution_photos: unknown;
  status: "open" | "with_service_manager" | "closed";
  source: "admin" | "public_link";
  created_by: string | null;
  sent_to_service_manager_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: { name?: string | null; customer_id?: string | null } | null;
  orders?: {
    order_id?: string | null;
    business_name?: string | null;
    client_name?: string | null;
  } | null;
};

const TICKET_SELECT = `
  *,
  customers:customer_id(name, customer_id),
  orders:order_id(order_id, business_name, client_name)
`;

function mapTicketRow(row: TicketRow): ServiceTicketRecord {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    company_id: row.company_id,
    customer_id: row.customer_id,
    order_id: row.order_id,
    phone: row.phone,
    description: row.description,
    photos: normalizePhotos(row.photos),
    resolution_notes: row.resolution_notes ?? null,
    resolution_photos: normalizePhotos(row.resolution_photos),
    status: row.status,
    source: row.source,
    created_by: row.created_by ?? null,
    sent_to_service_manager_at: row.sent_to_service_manager_at ?? null,
    closed_at: row.closed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_name: row.customers?.name ?? "",
    customer_business_name: row.orders?.business_name ?? "",
    order_code: row.orders?.order_id ?? "",
  };
}

async function requireProfile() {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");
  if (!profile.company_id) throw new Error("Company context missing");
  return profile;
}

function assertTicketManagePermission(profile: Awaited<ReturnType<typeof requireProfile>>) {
  const ticketPerm = resolveTicketPermission({
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  });
  if (!ticketPerm.canManage) {
    throw new Error("Forbidden: you do not have permission to manage service tickets");
  }
}

export async function lookupOrdersByPhone(phone: string) {
  await assertAdminOnly();
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("Phone number is required");

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, customer_id, name, phone, whatsapp")
    .eq("company_id", profile.company_id)
    .or(`phone.eq.${normalized},whatsapp.eq.${normalized}`)
    .limit(1)
    .maybeSingle();

  if (customerError) throw new Error(customerError.message);
  if (!customer) {
    return {
      customer: null,
      orders: [] as Array<{
        id: string;
        orderId: string;
        label: string;
        stage: string;
        createdAt: string;
      }>,
    };
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_id, client_name, business_name, stage, date_created")
    .eq("company_id", profile.company_id)
    .eq("customer_id", customer.id)
    .order("date_created", { ascending: false });

  if (ordersError) throw new Error(ordersError.message);

  return {
    customer,
    orders: (orders ?? []).map((o) => ({
      id: o.id,
      orderId: o.order_id,
      label: `${o.order_id} - ${o.client_name || o.business_name || "Order"}`,
      stage: o.stage,
      createdAt: o.date_created,
    })),
  };
}

export async function createServiceTicketAction(input: {
  customerId: string;
  orderId: string;
  phone: string;
  description: string;
  photos?: TicketPhoto[];
  resolutionNotes?: string;
}) {
  await assertAdminOnly();
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const payload = {
    company_id: profile.company_id,
    customer_id: input.customerId,
    order_id: input.orderId,
    phone: normalizePhone(input.phone),
    description: input.description.trim(),
    photos: normalizePhotos(input.photos),
    resolution_notes: input.resolutionNotes?.trim() || null,
    source: "admin",
    status: "open",
    created_by: profile.id,
  };

  const { data, error } = await supabase
    .from("service_tickets")
    .insert(payload)
    .select(TICKET_SELECT)
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin/service-tickets");
  revalidatePath("/staff/service-tickets");
  return mapTicketRow(data);
}

export async function getServiceTickets() {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("service_tickets")
    .select(TICKET_SELECT)
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const mapped = (data ?? []).map(mapTicketRow);
  if (profile.role === "admin") return mapped;

  const ticketPerm = resolveTicketPermission({
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  });
  if (!ticketPerm.canView) return [];
  return mapped.filter((ticket) => ticket.status !== "open");
}

export async function getOpenServiceTicketCount() {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { count, error } = await supabase
    .from("service_tickets")
    .select("*", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .neq("status", "closed");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getTicketById(ticketId: string) {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("service_tickets")
    .select(TICKET_SELECT)
    .eq("company_id", profile.company_id)
    .eq("id", ticketId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const mapped = mapTicketRow(data);
  if (profile.role === "admin") return mapped;

  const ticketPerm = resolveTicketPermission({
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  });
  if (!ticketPerm.canView) throw new Error("Forbidden");
  if (mapped.status === "open") throw new Error("Forbidden");

  return mapped;
}

export async function sendToServiceManagerAction(ticketId: string) {
  await assertAdminOnly();
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("service_tickets")
    .update({
      status: "with_service_manager",
      sent_to_service_manager_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .eq("company_id", profile.company_id)
    .select("id, status")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/service-tickets");
  revalidatePath("/staff/service-tickets");
  return data;
}

export async function updateTicketResolutionAction(
  ticketId: string,
  input: { resolutionNotes?: string; resolutionPhotos?: TicketPhoto[] }
) {
  const profile = await requireProfile();
  assertTicketManagePermission(profile);
  const supabase = await getSupabase();

  const updates: Record<string, unknown> = {};
  if (typeof input.resolutionNotes === "string") {
    updates.resolution_notes = input.resolutionNotes.trim();
  }
  if (input.resolutionPhotos) {
    updates.resolution_photos = normalizePhotos(input.resolutionPhotos);
  }

  const { data, error } = await supabase
    .from("service_tickets")
    .update(updates)
    .eq("id", ticketId)
    .eq("company_id", profile.company_id)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/service-tickets");
  revalidatePath("/staff/service-tickets");
  return data;
}

export async function completeTicketAction(ticketId: string) {
  const profile = await requireProfile();
  assertTicketManagePermission(profile);
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("service_tickets")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .eq("company_id", profile.company_id)
    .select("id, status, closed_at")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/service-tickets");
  revalidatePath("/staff/service-tickets");
  return data;
}

