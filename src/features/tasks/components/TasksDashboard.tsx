"use client";

import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { TaskRecord } from "@/features/tasks/types";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailPanel } from "./TaskDetailPanel";

interface TasksDashboardProps {
  tasks: TaskRecord[];
  employees: Array<{ id: string; name: string }>;
  orders: Array<{ id: string; label: string }>;
  isAdmin: boolean;
}

function badgeClass(priority: string) {
  if (priority === "Critical") return "bg-red-100 text-red-700 border-red-200";
  if (priority === "High") return "bg-orange-100 text-orange-700 border-orange-200";
  if (priority === "Low") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

export function TasksDashboard({
  tasks,
  employees,
  orders,
  isAdmin,
}: TasksDashboardProps) {
  const [allTasks] = useState<TaskRecord[]>(tasks);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return allTasks.filter((task) => {
      if (statusFilter !== "ALL" && task.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const text = search.toLowerCase();
      return (
        task.title.toLowerCase().includes(text) ||
        task.task_id.toLowerCase().includes(text) ||
        (task.assignee_name || "").toLowerCase().includes(text)
      );
    });
  }, [allTasks, search, statusFilter]);

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-slate-900">Task Dashboard</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Assign and track employee tasks across teams.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Assign Task
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search task, assignee, ID..."
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          {[
            "Not Started",
            "In Progress",
            "Waiting for Approval",
            "Blocked",
            "Completed",
            "Cancelled",
          ].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[880px]">
          <thead className="bg-slate-50">
            <tr>
              {["Assigned To", "Task", "Priority", "Due Date", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => (
              <tr key={task.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-sm text-slate-700">{task.assignee_name || "-"}</td>
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                  <div className="text-xs text-slate-500">{task.task_id}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass(task.priority)}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{task.due_date || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{task.status}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTask(task)}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No tasks found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isCreateOpen ? (
        <CreateTaskModal
          employees={employees}
          orders={orders}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => window.location.reload()}
        />
      ) : null}

      {selectedTask ? (
        <TaskDetailPanel
          task={selectedTask}
          isAdmin={isAdmin}
          onClose={() => setSelectedTask(null)}
        />
      ) : null}
    </div>
  );
}
