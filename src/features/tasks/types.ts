export const TASK_CATEGORIES = [
  "Order Related",
  "Internal",
  "Follow Up",
  "Maintenance",
  "Purchase",
  "HR",
] as const;

export const TASK_TYPES = [
  "Sales",
  "Production",
  "Inventory",
  "Design",
  "Installation",
  "Accounts",
  "Administration",
] as const;

export const TASK_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;

export const TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "Waiting for Approval",
  "Blocked",
  "Completed",
  "Cancelled",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export type TaskType = (typeof TASK_TYPES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskRecord {
  id: string;
  task_id: string;
  company_id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignee_id: string;
  created_by: string;
  order_id: string | null;
  assigned_at: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee_name?: string;
  creator_name?: string;
  order_code?: string;
}

export interface TaskCommentRecord {
  id: string;
  company_id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
}
