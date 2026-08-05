"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveWriteCompanyId } from "@/lib/resolveWriteCompanyId";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";
import { dispatchDirectNotification, dispatchAdminNotification } from "@/features/notifications/lib/dispatchNotification";
import type {
  TaskCommentRecord,
  TaskRecord,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/features/tasks/types";

type TaskQueryRow = TaskRecord & {
  assignee?: { name?: string | null } | null;
  creator?: { name?: string | null } | null;
  orders?: { order_id?: string | null; company_id?: string | null } | null;
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

async function requireProfile() {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");
  if (!profile.company_id) throw new Error("Company context missing");
  return profile;
}

function mapTaskRow(row: TaskQueryRow): TaskRecord {
  return {
    ...row,
    assignee_name: row.assignee?.name ?? "",
    creator_name: row.creator?.name ?? "",
    order_code: row.orders?.order_id ?? "",
  };
}

async function ensureCanReadTask(taskId: string) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, assignee_id")
    .eq("company_id", profile.company_id)
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error("Task not found");
  if (profile.role !== "admin" && task.assignee_id !== profile.id) {
    throw new Error("Forbidden");
  }
  return { profile, supabase };
}

function revalidateTaskPaths() {
  revalidatePath("/admin/tasks");
  revalidatePath("/staff/tasks");
  revalidatePath("/admin/calendar");
  revalidatePath("/staff/calendar");
}

export async function getTasks(filters?: {
  assigneeId?: string;
  includeCompleted?: boolean;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const canSeeAll = profile.role === "admin";
  const effectiveAssigneeId = canSeeAll ? filters?.assigneeId : profile.id;
  const includeCompleted = filters?.includeCompleted ?? true;

  let query = supabase
    .from("tasks")
    .select(
      `
      *,
      assignee:assignee_id(name),
      creator:created_by(name),
      orders:order_id(order_id)
    `
    )
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (effectiveAssigneeId) {
    query = query.eq("assignee_id", effectiveAssigneeId);
  }
  if (!includeCompleted) {
    query = query.not("status", "in", '("Completed","Cancelled")');
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTaskRow(row as TaskQueryRow));
}

export async function getTaskById(taskId: string) {
  const { profile, supabase } = await ensureCanReadTask(taskId);

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      assignee:assignee_id(name),
      creator:created_by(name),
      orders:order_id(order_id)
    `
    )
    .eq("company_id", profile.company_id)
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapTaskRow(data as TaskQueryRow);
}

export async function createTaskAction(input: {
  title: string;
  description?: string;
  category: TaskCategory;
  taskType: TaskType;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeIds?: string[];
  dueDate?: string | null;
  orderId?: string | null;
}) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can assign tasks");
  const supabase = await getSupabase();
  const companyId = await resolveWriteCompanyId();

  const assigneeIds = Array.from(
    new Set(
      (input.assigneeIds?.length
        ? input.assigneeIds
        : input.assigneeId
          ? [input.assigneeId]
          : []
      ).filter(Boolean)
    )
  );
  if (assigneeIds.length === 0) {
    throw new Error("Select at least one assignee");
  }

  const assignedAt = new Date().toISOString().slice(0, 10);
  const payloads = assigneeIds.map((assigneeId) => ({
    company_id: companyId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    task_type: input.taskType,
    priority: input.priority,
    status: "Not Started" as TaskStatus,
    assignee_id: assigneeId,
    created_by: profile.id,
    order_id: input.orderId || null,
    due_date: input.dueDate || null,
    assigned_at: assignedAt,
  }));

  const { data, error } = await supabase
    .from("tasks")
    .insert(payloads)
    .select("id, task_id, order_id");
  if (error) throw new Error(error.message);

  const created = data ?? [];
  const firstWithOrder = created.find((row) => row.order_id);
  if (firstWithOrder?.order_id) {
    const { data: orderData } = await supabase
      .from("orders")
      .select("order_id, company_id")
      .eq("id", firstWithOrder.order_id)
      .maybeSingle();
    if (orderData?.company_id) {
      const taskLabels = created.map((row) => row.task_id).filter(Boolean).join(", ");
      await insertOrderActivity(supabase, {
        order_id: orderData.order_id || firstWithOrder.order_id,
        company_id: orderData.company_id,
        actor_name: profile.name || "Admin",
        actor_role: "Admin",
        actor_id: profile.id,
        content: `Task${created.length > 1 ? "s" : ""} ${taskLabels || "assigned"} assigned to ${created.length} assignee${created.length > 1 ? "s" : ""}.`,
        metadata: {
          action: "task_assigned",
          task_ids: created.map((row) => row.id),
        },
      });
    }
  }

  // Notify each assignee directly
  for (const assigneeId of assigneeIds) {
    await dispatchDirectNotification(
      assigneeId,
      profile.company_id,
      {
        title: `New Task Assigned: ${input.title}`,
        message: `You have been assigned a new task [${input.priority}].`,
        type: "info",
        link: `/staff/tasks`,
      }
    );
  }

  revalidateTaskPaths();
  return created[0] ?? { id: "" };
}

export async function updateTaskAction(
  taskId: string,
  input: {
    status?: TaskStatus;
  }
) {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("*, orders:order_id(order_id, company_id)")
    .eq("company_id", profile.company_id)
    .eq("id", taskId)
    .single();
  if (existingError) throw new Error(existingError.message);

  if (profile.role !== "admin" && existing.assignee_id !== profile.id) {
    throw new Error("Forbidden");
  }

  if (!input.status || input.status === existing.status) {
    return { id: taskId, status: existing.status };
  }

  const updates: Record<string, unknown> = {
    status: input.status,
    completed_at: input.status === "Completed" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("company_id", profile.company_id)
    .select("id, status, order_id, task_id")
    .single();
  if (error) throw new Error(error.message);

  if (input.status === "Completed" && data.order_id && existing.orders?.company_id) {
    await insertOrderActivity(supabase, {
      order_id: existing.orders.order_id || data.order_id,
      company_id: existing.orders.company_id,
      actor_name: profile.name || "Staff",
      actor_role: profile.role === "admin" ? "Admin" : "Staff",
      actor_id: profile.id,
      content: `Task ${data.task_id || "task"} marked completed.`,
      metadata: { action: "task_completed", task_id: taskId },
    });
    // Notify admins when a task is completed
    await dispatchAdminNotification(existing.orders.company_id, {
      title: `Task Completed`,
      message: `Task "${existing.title}" has been marked complete by ${profile.name || "Staff"}.`,
      type: "success",
      link: `/admin/tasks`,
    });
  }

  revalidateTaskPaths();
  return data;
}

export async function addTaskCommentAction(taskId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty");

  const { profile, supabase } = await ensureCanReadTask(taskId);
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("comments")
    .eq("id", taskId)
    .eq("company_id", profile.company_id)
    .single();
  if (taskError) throw new Error(taskError.message);

  const comment = {
    id: crypto.randomUUID(),
    author_id: profile.id,
    body: trimmed,
    created_at: new Date().toISOString(),
  };
  const comments = Array.isArray(task.comments) ? [...task.comments, comment] : [comment];

  const { error } = await supabase
    .from("tasks")
    .update({ comments })
    .eq("id", taskId)
    .eq("company_id", profile.company_id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/tasks");
  revalidatePath("/staff/tasks");
  return {
    ...comment,
    company_id: profile.company_id,
    task_id: taskId,
    updated_at: comment.created_at,
    author_name: profile.name || "",
  } as TaskCommentRecord;
}

export async function getTaskComments(taskId: string) {
  const { profile, supabase } = await ensureCanReadTask(taskId);
  const { data, error } = await supabase
    .from("tasks")
    .select("comments")
    .eq("id", taskId)
    .eq("company_id", profile.company_id)
    .single();
  if (error) throw new Error(error.message);

  const raw = Array.isArray(data.comments) ? data.comments : [];
  const authorIds = [
    ...new Set(raw.map((c: any) => c.author_id).filter(Boolean)),
  ] as string[];
  const nameMap = new Map<string, string>();
  if (authorIds.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", authorIds);
    for (const u of users ?? []) nameMap.set(u.id, u.name || "");
  }

  return raw
    .map((row: any) => ({
      id: String(row.id),
      company_id: profile.company_id,
      task_id: taskId,
      author_id: String(row.author_id),
      body: String(row.body ?? ""),
      created_at: String(row.created_at),
      updated_at: String(row.created_at),
      author_name: nameMap.get(String(row.author_id)) ?? "",
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)) as TaskCommentRecord[];
}
