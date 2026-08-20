"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";

export interface CalendarReminderRecord {
  id: string;
  company_id: string;
  title: string;
  note: string | null;
  reminder_date: string;
  created_by: string;
  viewer_ids: string[];
  created_at: string;
  updated_at: string;
}

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
          } catch {
            /* Server Component */
          }
        },
      },
    }
  );
}

function revalidateCalendarPaths() {
  revalidatePath("/admin/calendar");
  revalidatePath("/staff/calendar");
}

/** List reminders visible to the current user (admin: all company; staff: creator or viewer). */
export async function listCalendarReminders(): Promise<CalendarReminderRecord[]> {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("calendar_reminders")
    .select("*")
    .order("reminder_date", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data || []) as CalendarReminderRecord[];
  if (profile.role === "admin") return rows;

  return rows.filter(
    (r) =>
      r.created_by === profile.id ||
      (Array.isArray(r.viewer_ids) && r.viewer_ids.includes(profile.id))
  );
}

export async function createCalendarReminderAction(input: {
  title: string;
  note?: string | null;
  reminderDate: string;
  viewerIds: string[];
}): Promise<CalendarReminderRecord> {
  const profile = await getCurrentUser();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    throw new Error("Unauthorized");
  }
  if (!profile.company_id) throw new Error("Missing company");

  const title = input.title?.trim();
  if (!title) throw new Error("Title is required");
  if (!input.reminderDate) throw new Error("Reminder date is required");

  const viewerIds = Array.from(
    new Set((input.viewerIds || []).filter((id) => id && id !== profile.id))
  );

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("calendar_reminders")
    .insert({
      company_id: profile.company_id,
      title,
      note: input.note?.trim() || null,
      reminder_date: input.reminderDate,
      created_by: profile.id,
      viewer_ids: viewerIds,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateCalendarPaths();
  return data as CalendarReminderRecord;
}

export async function deleteCalendarReminderAction(reminderId: string): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");

  const supabase = await getSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("calendar_reminders")
    .select("id, created_by")
    .eq("id", reminderId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!row) throw new Error("Reminder not found");
  if (profile.role !== "admin" && row.created_by !== profile.id) {
    throw new Error("Forbidden: only the creator or an admin can delete this reminder");
  }

  const { error } = await supabase.from("calendar_reminders").delete().eq("id", reminderId);
  if (error) throw new Error(error.message);
  revalidateCalendarPaths();
}
